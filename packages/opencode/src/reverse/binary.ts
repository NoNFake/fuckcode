import { Effect, Schema } from "effect"
import { spawnSync } from "child_process"
import { createHash } from "crypto"
import { createReadStream, mkdtempSync, rmSync, writeFileSync } from "fs"
import { open, copyFile, mkdir, realpath, stat } from "fs/promises"
import os from "os"
import path from "path"
import * as Tool from "../tool/tool"
import { ReverseConfig } from "./config"

const Actions = [
  "info",
  "sections",
  "imports",
  "exports",
  "strings",
  "disasm",
  "decompile",
  "xrefs",
  "read_bytes",
  "search_bytes",
  "patch",
  "emulate",
  "entropy",
  "functions",
] as const

const Parameters = Schema.Struct({
  action: Schema.Literals(Actions),
  file: Schema.String.annotate({ description: "Path to the binary (ELF or PE)" }),
  offset: Schema.optional(Schema.Number).annotate({
    description: "File offset in bytes for read_bytes",
  }),
  address: Schema.optional(Schema.String).annotate({
    description: "Virtual address or symbol name for disasm, decompile, and xrefs",
  }),
  count: Schema.optional(Schema.Number).annotate({ description: "Number of bytes to read or instructions to disassemble" }),
  hex: Schema.optional(Schema.String).annotate({
    description: "Hex byte pattern: search pattern for search_bytes, replacement bytes for patch, memory bytes for emulate",
  }),
  output: Schema.optional(Schema.String).annotate({
    description: "Output path for patch (default: reverse.workDir/<name>.patched)",
  }),
  write: Schema.optional(Schema.String).annotate({
    description: "Emulated memory address to write hex bytes to before emulating",
  }),
  dump: Schema.optional(Schema.String).annotate({
    description: "Emulated memory address to dump after emulating (default: rsp)",
  }),
  encoding: Schema.optional(Schema.Literals(["ascii", "utf16le"])).annotate({
    description: "String encoding for the strings action (default: ascii). Use utf16le for Windows binaries",
  }),
  asm: Schema.optional(Schema.String).annotate({
    description: "Assembly to assemble and write for the patch action, instead of hex. Example: 'mov eax, 1'",
  }),
})

type Params = typeof Parameters.Type

function requireBinary(name: string) {
  if (!Bun.which(name)) throw new Error(`Required tool '${name}' not found on PATH. Run ensure_tools to install it.`)
}

function run(binary: string, args: string[], timeoutMs = 30_000) {
  requireBinary(binary)
  return runOptional(binary, args, timeoutMs)
}

function runOptional(binary: string, args: string[], timeoutMs = 30_000) {
  const result = spawnSync(binary, args, {
    encoding: "utf-8",
    timeout: timeoutMs,
    maxBuffer: 16 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  })
  if (result.error) throw new Error(`${binary} failed: ${result.error.message}`)
  const parts = [result.stdout ?? "", result.stderr ?? ""].filter((p) => p.trim().length > 0)
  return parts.join("\n").trim() || "(no output)"
}

async function sha256(file: string) {
  const hash = createHash("sha256")
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  return hash.digest("hex")
}

async function resolveFile(config: ReverseConfig.Config, file: string) {
  const resolved = await realpath(path.resolve(file))
  if (!ReverseConfig.pathAllowed(config, resolved)) {
    throw new Error(`Path is outside reverse.allowedDirs: ${resolved}`)
  }
  const info = await stat(resolved)
  if (!info.isFile()) throw new Error(`Not a file: ${resolved}`)
  if (info.size > config.maxFileSize) {
    throw new Error(`File exceeds reverse.maxFileSize (${config.maxFileSize} bytes): ${resolved}`)
  }
  return { resolved, size: info.size }
}

function parseHex(hex: string): Buffer {
  const cleaned = hex.replace(/[^0-9a-fA-F]/g, "")
  if (cleaned.length === 0 || cleaned.length % 2 !== 0) {
    throw new Error("hex must contain an even, non-zero number of hex digits")
  }
  return Buffer.from(cleaned, "hex")
}

const r2Target = /^(0x[0-9a-fA-F]+|[A-Za-z_][A-Za-z0-9_.$]*)$/

// r2 command strings are not a shell, but r2 can still run system commands and
// write files. Any value interpolated into a -c script must be a hex address or
// symbol name, never free text.
function assertR2Target(value: string, field: string) {
  if (!r2Target.test(value)) throw new Error(`${field} must be a hex address or symbol name`)
}

function r2Address(params: Params) {
  if (!params.address) return undefined
  assertR2Target(params.address, "address")
  return params.address
}

async function readBytes(file: string, offset: number, length: number) {
  const handle = await open(file, "r")
  try {
    const buffer = Buffer.alloc(length)
    const { bytesRead } = await handle.read(buffer, 0, length, offset)
    return buffer.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}

function formatHexDump(bytes: Buffer, offset: number) {
  const lines: string[] = []
  for (let i = 0; i < bytes.length; i += 16) {
    const slice = bytes.subarray(i, i + 16)
    const hex = [...slice].map((b) => b.toString(16).padStart(2, "0")).join(" ")
    const ascii = [...slice].map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : ".")).join("")
    lines.push(`${(offset + i).toString(16).padStart(8, "0")}  ${hex.padEnd(47)}  ${ascii}`)
  }
  return lines.join("\n")
}

// ponytail: reads the whole file into memory; chunked scan if multi-GB analysis matters.
async function searchBytes(file: string, pattern: Buffer) {
  const buffer = Buffer.from(await Bun.file(file).arrayBuffer())
  const hits: number[] = []
  let index = buffer.indexOf(pattern)
  while (index !== -1 && hits.length < 1000) {
    hits.push(index)
    index = buffer.indexOf(pattern, index + 1)
  }
  return hits
}

// Assembles through rasm2 with the file's own arch/bits. The assembly is written
// to a temp file and read with -f, so it never becomes part of an r2 command string.
// ponytail: rasm2 takes arch/bits, not the exact cpu/endian features `pa` inherits;
// if exotic instructions fail, assemble inside r2 and pass the bytes as hex.
function assemble(file: string, asm: string) {
  if (asm.length === 0 || asm.length > 4096) throw new Error("asm must be 1..4096 characters")
  const r2 = requireR2("assembly patch")
  const settings = run(r2, ["-q", "-e", "scr.color=0", "-c", "e asm.arch; e asm.bits; e asm.syntax", file])
  const arch = settings.match(/asm\.arch\s*=\s*(\S+)/)?.[1] ?? "x86"
  const bits = settings.match(/asm\.bits\s*=\s*(\d+)/)?.[1] ?? "64"
  const syntax = settings.match(/asm\.syntax\s*=\s*(\S+)/)?.[1]
  const dir = mkdtempSync(path.join(os.tmpdir(), "reverse-asm-"))
  try {
    const source = path.join(dir, "in.asm")
    writeFileSync(source, asm)
    const args = ["-a", arch, "-b", bits, ...(syntax ? ["-S", syntax] : []), "-f", source]
    const result = spawnSync("rasm2", args, { encoding: "utf-8", timeout: 10_000, stdio: ["ignore", "pipe", "pipe"] })
    if (result.status !== 0) {
      const detail = (result.stderr || result.stdout || "assembler failed").trim().split("\n").slice(-2).join(" | ")
      throw new Error(`Cannot assemble '${asm}': ${detail}`)
    }
    const cleaned = (result.stdout ?? "").trim().replace(/[^0-9a-fA-F]/g, "")
    if (cleaned.length === 0 || cleaned.length % 2 !== 0) throw new Error(`Cannot assemble '${asm}'`)
    return Buffer.from(cleaned, "hex")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

async function patchFile(config: ReverseConfig.Config, params: Params, file: string, pattern: Buffer) {
  if (!config.allowPatch) throw new Error("Patching is disabled. Set reverse.allowPatch=true to enable it.")
  const offset = params.offset
  if (offset === undefined || offset < 0) throw new Error("patch requires a non-negative offset")
  const before = await sha256(file)
  const target = path.resolve(params.output ?? path.join(config.workDir, `${path.basename(file)}.patched`))
  await mkdir(path.dirname(target), { recursive: true })
  await copyFile(file, target)
  const handle = await open(target, "r+")
  try {
    const { bytesWritten } = await handle.write(pattern, 0, pattern.length, offset)
    if (bytesWritten !== pattern.length) throw new Error(`Short write: ${bytesWritten}/${pattern.length} bytes`)
  } finally {
    await handle.close()
  }
  const after = await sha256(target)
  return { target, before, after, offset, bytes: pattern.length }
}

function disasm(file: string, params: Params, format: Format) {
  const r2 = Bun.which("r2")
  if (r2) {
    const count = params.count ?? 40
    const address = r2Address(params)
    const target = address ? `@ ${address}` : ""
    return run(r2, ["-q", "-e", "scr.color=0", "-e", "bin.relocs.apply=true", "-c", `aaa; pd ${count} ${target}`, file])
  }
  if (format === "pe") throw new Error("PE disassembly requires radare2. Run ensure_tools to install it.")
  const start = params.address && /^0x[0-9a-fA-F]+$/.test(params.address) ? parseInt(params.address, 16) : undefined
  const count = params.count ?? 40
  const args = ["-d", "-M", "intel"]
  if (start !== undefined) {
    args.push(`--start-address=${params.address}`, `--stop-address=0x${(start + count * 16).toString(16)}`)
  }
  args.push(file)
  const output = run("objdump", args)
  return start !== undefined ? output : output.split("\n").slice(0, count + 7).join("\n")
}

function emulate(file: string, params: Params) {
  const address = params.address ? r2Address(params) : undefined
  if (params.write) assertR2Target(params.write, "write")
  if (params.dump) assertR2Target(params.dump, "dump")
  const r2 = Bun.which("r2")
  if (!r2) throw new Error("emulate requires radare2. Run ensure_tools to install it.")
  const count = Math.min(Math.max(params.count ?? 20, 1), 1000)
  if (params.write && !params.hex) throw new Error("emulate write requires hex bytes")
  const bytes = params.write ? parseHex(params.hex ?? "").toString("hex") : undefined
  const script = [
    "aaa",
    "aeim",
    ...(params.write && bytes ? [`wx ${bytes} @ ${params.write}`] : []),
    `s ${address ?? "entry0"}`,
    "aeip",
    ...Array.from({ length: count }, () => "aes"),
    "aer",
    `px 128 @ ${params.dump ?? "rsp"}`,
  ].join("; ")
  return run(r2, ["-q", "-e", "scr.color=0", "-e", "bin.relocs.apply=true", "-c", script, file], 120_000)
}

function entropyOf(buffer: Buffer) {
  if (buffer.length === 0) return 0
  const counts = new Array(256).fill(0)
  for (const byte of buffer) counts[byte]++
  let value = 0
  for (const count of counts) {
    if (count === 0) continue
    const p = count / buffer.length
    value -= p * Math.log2(p)
  }
  return value
}

type Format = "elf" | "pe"

function detectFormat(file: string): Format {
  const description = runOptional("file", ["-b", file])
  if (/PE32/i.test(description)) return "pe"
  if (/ELF/i.test(description)) return "elf"
  throw new Error(`Unsupported binary format: ${description}`)
}

function requireR2(action: string) {
  const r2 = Bun.which("r2")
  if (!r2) throw new Error(`${action} requires radare2. Run ensure_tools to install it.`)
  return r2
}

function elfSections(file: string) {
  return run("readelf", ["-S", "-W", file])
    .split("\n")
    .flatMap((line) => {
      const match = line.match(
        /^\s*\[\s*\d+\]\s+(\S+)\s+([A-Z_][A-Z0-9_]*)\s+[0-9a-f]+\s+([0-9a-f]+)\s+([0-9a-f]+)/,
      )
      if (!match || match[2] === "NOBITS") return []
      return [{ name: match[1], offset: parseInt(match[3], 16), size: parseInt(match[4], 16) }]
    })
}

function peSections(file: string) {
  return run("rabin2", ["-S", file])
    .split("\n")
    .flatMap((line) => {
      const match = line.match(
        /^\d+\s+(0x[0-9a-f]+)\s+(0x[0-9a-f]+)\s+0x[0-9a-f]+\s+0x[0-9a-f]+\s+\S+\s+\S+\s+\S+\s+(\S+)/,
      )
      if (!match) return []
      return [{ name: match[3], offset: parseInt(match[1], 16), size: parseInt(match[2], 16) }]
    })
}

async function entropyReport(file: string, format: Format) {
  const whole = entropyOf(Buffer.from(await Bun.file(file).arrayBuffer()))
  const sections = format === "elf" ? elfSections(file) : peSections(file)
  const rows: string[] = []
  for (const section of sections) {
    if (section.size === 0) continue
    const data = await readBytes(file, section.offset, Math.min(section.size, 16 * 1024 * 1024))
    const value = entropyOf(data)
    const flag = value > 7 ? "  HIGH: packed, encrypted, or compressed?" : ""
    rows.push(
      `${section.name.padEnd(24)} offset=0x${section.offset.toString(16)} size=${section.size} entropy=${value.toFixed(4)}${flag}`,
    )
  }
  return [`format=${format}`, `whole file entropy=${whole.toFixed(4)} (max 8.0)`, "", ...rows].join("\n")
}

function hardening(file: string, format: Format) {
  if (Bun.which("checksec")) return run("checksec", ["--file", file])
  if (format === "pe") {
    const info = run("rabin2", ["-I", file])
    const pick = (key: string) => info.match(new RegExp(`^${key}\\s+(\\S+)`, "m"))?.[1] ?? "?"
    return [`Stack canary: ${pick("canary")}`, `NX: ${pick("nx")}`, `PIE/PIC: ${pick("pic")}`].join("\n")
  }
  const header = run("readelf", ["-h", "-W", file])
  const segments = run("readelf", ["-l", "-W", file])
  const dynamic = run("readelf", ["-d", "-W", file])
  const symbols = run("nm", ["-D", file]) + "\n" + run("readelf", ["-s", "-W", file])
  const type = header.match(/Type:\s+(\S+)/)?.[1] ?? "?"
  const relro = /GNU_RELRO/.test(segments) ? (/BIND_NOW/.test(dynamic) ? "Full" : "Partial") : "No"
  const nx = /GNU_STACK.*\bRWE\b/.test(segments) ? "disabled" : "enabled"
  const canary = /__stack_chk_fail/.test(symbols) ? "present" : "absent"
  const fortify = /__fortify_fail/.test(symbols) ? "present" : "absent"
  const pie = /DYN/.test(type) ? "PIE/PIC" : "No PIE (EXEC)"
  return [`RELRO: ${relro}`, `Stack canary: ${canary}`, `NX: ${nx}`, `PIE: ${pie}`, `FORTIFY: ${fortify}`].join("\n")
}

function functions(file: string, format: Format) {
  const r2 = Bun.which("r2")
  if (r2) {
    return run(
      r2,
      ["-q", "-e", "scr.color=0", "-e", "bin.relocs.apply=true", "-c", "aaa; afl", file],
      120_000,
    )
  }
  if (format === "pe") throw new Error("functions for PE requires radare2. Run ensure_tools to install it.")
  return run("nm", ["-C", "--defined-only", file])
}

async function dispatch(config: ReverseConfig.Config, params: Params) {
  const { resolved, size } = await resolveFile(config, params.file)

  switch (params.action) {
    case "info": {
      const format = detectFormat(resolved)
      const fileType = run("file", ["-b", resolved])
      const hash = await sha256(resolved)
      const lines = [`file: ${fileType}`, `size: ${size} bytes`, `sha256: ${hash}`]
      if (format === "pe") {
        const details = Bun.which("rabin2")
          ? run("rabin2", ["-I", resolved])
          : "(rabin2 not installed; install radare2 via ensure_tools for PE details)"
        const hardness =
          Bun.which("checksec") || Bun.which("rabin2")
            ? hardening(resolved, format)
            : "(install checksec or radare2 for hardening)"
        lines.push("", details, "", `hardening:\n${hardness}`)
      } else {
        lines.push(
          "",
          run("readelf", ["-h", "-W", resolved]),
          "",
          run("readelf", ["-l", "-W", resolved]),
          "",
          `hardening:\n${hardening(resolved, format)}`,
        )
      }
      return lines.join("\n")
    }
    case "sections":
      return detectFormat(resolved) === "pe"
        ? run("rabin2", ["-S", resolved])
        : run("readelf", ["-S", "-W", resolved])
    case "imports":
      return detectFormat(resolved) === "pe"
        ? run("rabin2", ["-i", resolved])
        : run("nm", ["-D", "--undefined-only", resolved])
    case "exports":
      return detectFormat(resolved) === "pe"
        ? run("rabin2", ["-E", resolved])
        : run("nm", ["-D", "--defined-only", resolved])
    case "strings": {
      const args = ["-a", "-t", "x"]
      if (params.encoding === "utf16le") args.push("-e", "l")
      args.push(resolved)
      return run("strings", args)
    }
    case "disasm":
      return disasm(resolved, params, detectFormat(resolved))
    case "decompile": {
      const r2 = requireR2("decompile")
      const address = r2Address(params)
      const target = address ? `@ ${address}` : "@ entry0"
      return run(r2, ["-q", "-e", "scr.color=0", "-e", "bin.relocs.apply=true", "-c", `aaa; pdg ${target}`, resolved])
    }
    case "xrefs": {
      const r2 = requireR2("xrefs")
      const address = r2Address(params)
      const target = address ? `@ ${address}` : "@ entry0"
      return run(r2, ["-q", "-e", "scr.color=0", "-e", "bin.relocs.apply=true", "-c", `aaa; axt ${target}`, resolved])
    }
    case "emulate":
      return emulate(resolved, params)
    case "entropy":
      return entropyReport(resolved, detectFormat(resolved))
    case "functions":
      return functions(resolved, detectFormat(resolved))
    case "read_bytes": {
      const offset = params.offset ?? 0
      const length = Math.min(params.count ?? 256, 65536)
      if (offset < 0 || length <= 0) throw new Error("read_bytes requires a non-negative offset and positive count")
      const bytes = await readBytes(resolved, offset, length)
      return `read ${bytes.length} bytes at offset ${offset}\n\n${formatHexDump(bytes, offset)}`
    }
    case "search_bytes": {
      const pattern = parseHex(params.hex ?? "")
      const hits = await searchBytes(resolved, pattern)
      if (hits.length === 0) return `Pattern not found: ${params.hex}`
      return `Found ${hits.length} match(es):\n${hits.map((h) => `0x${h.toString(16)}`).join("\n")}`
    }
    case "patch": {
      if (params.hex !== undefined && params.asm !== undefined) {
        throw new Error("patch takes either hex or asm, not both")
      }
      const pattern = params.asm !== undefined ? assemble(resolved, params.asm) : parseHex(params.hex ?? "")
      const result = await patchFile(config, params, resolved, pattern)
      return [
        `patched copy: ${result.target}`,
        `bytes written: ${result.bytes} at offset ${result.offset}`,
        `sha256 before: ${result.before}`,
        `sha256 after:  ${result.after}`,
        "original file unchanged",
      ].join("\n")
    }
  }
}

export const BinaryTool = Tool.define(
  "binary",
  Effect.gen(function* () {
    const config = yield* ReverseConfig.Service
    return {
      description:
        "Static analysis of ELF (.so, .a, .o, executables) and PE (.dll, .exe) binaries: file info and hardening, sections, imports, exports, function list, strings, entropy, disassembly, decompilation, cross-references, raw byte reads, byte-pattern search, byte patching of a copy (raw hex or assembled instruction), and register/memory emulation via radare2 ESIL. Read-only actions never modify the target; patch writes a copy under reverse.workDir and leaves the original unchanged.",
      parameters: Parameters,
      jsonSchema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: [...Actions],
            description:
              "info: file type, size, hashes, header and hardening (ELF and PE); sections/imports/exports/functions/strings/entropy: static lists; disasm/decompile/xrefs: code views; read_bytes: hex dump at offset; search_bytes: find a hex pattern; patch: write raw hex or assembled instructions into a copy; emulate: step radare2 ESIL and dump registers plus memory",
          },
          file: { type: "string", description: "Path to the binary (ELF or PE)" },
          offset: { type: "number", description: "File offset in bytes for read_bytes and patch" },
          address: { type: "string", description: "Virtual address or symbol for disasm, decompile, xrefs, and the emulate start" },
          count: { type: "number", description: "Bytes to read, instructions to disassemble, or instructions to emulate" },
          hex: { type: "string", description: "Hex pattern for search_bytes, replacement bytes for patch, or memory bytes for emulate" },
          output: { type: "string", description: "Output path for patch (default: reverse.workDir/<name>.patched)" },
          write: { type: "string", description: "Emulated memory address to write hex bytes to before emulating" },
          dump: { type: "string", description: "Emulated memory address to dump after emulating (default: rsp)" },
          encoding: {
            type: "string",
            enum: ["ascii", "utf16le"],
            description: "String encoding for the strings action (default: ascii). Use utf16le for Windows binaries",
          },
          asm: { type: "string", description: "Assembly to assemble and write for the patch action, instead of hex" },
        },
        required: ["action", "file"],
      },
      execute: (params: Params, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const cfg = yield* config.get()
          const patch = params.action === "patch"
          yield* ctx.ask({
            permission: patch ? "reverse_patch" : "reverse",
            patterns: [params.file],
            always: patch ? [] : ["*"],
            metadata: { action: params.action, file: params.file },
          })
          const output = yield* Effect.tryPromise({
            try: () => dispatch(cfg, params),
            catch: (error) => (error instanceof Error ? error : new Error(String(error))),
          }).pipe(Effect.orDie)
          return {
            title: `${params.action}: ${path.basename(params.file)}`,
            metadata: { action: params.action, file: params.file } as Record<string, unknown>,
            output,
          }
        }).pipe(Effect.orDie),
    }
  }),
)
