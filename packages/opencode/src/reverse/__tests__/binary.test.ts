import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { Effect, Layer } from "effect"
import { createHash } from "crypto"
import { spawnSync } from "child_process"
import { mkdtempSync, realpathSync, rmSync } from "fs"
import os from "os"
import path from "path"
import { Truncate } from "../../tool/truncate"
import { Agent } from "@/agent/agent"
import * as Tool from "../../tool/tool"
import { BinaryTool } from "../binary"
import { loadFromConfig, makeService, pathAllowed, Service } from "../config"

const marker = "FUCKCODE_REVERSE_MARKER"

const fakeTruncate = Truncate.Service.of({
  cleanup: () => Effect.void,
  write: () => Effect.succeed("/tmp/truncate"),
  output: (content) => Effect.succeed({ content, truncated: false }),
  limits: () => Effect.succeed({ maxLines: 1000, maxBytes: 100000 }),
})

const fakeAgent = Agent.Service.of({
  get: (agent) =>
    Effect.succeed({
      name: agent,
      mode: "primary",
      native: true,
      permissions: [],
      options: {},
    } as any),
  list: () => Effect.succeed([]),
  defaultInfo: () => Effect.die("not implemented"),
  defaultAgent: () => Effect.succeed("build"),
  generate: () => Effect.die("not implemented"),
})

const ctx: any = {
  sessionID: "session",
  messageID: "message",
  agent: "build",
  abort: new AbortController().signal,
  messages: [],
  ask: () => Effect.void,
  metadata: () => Effect.void,
}

let dir: string
let so: string

const hashOf = async (file: string) =>
  createHash("sha256")
    .update(Buffer.from(await Bun.file(file).arrayBuffer()))
    .digest("hex")

async function makeTool(overrides: Record<string, unknown> = {}) {
  const config = loadFromConfig({
    enabled: true,
    allowedDirs: [realpathSync(dir)],
    allowPatch: true,
    workDir: path.join(dir, "work"),
    ...overrides,
  })
  const layer = Layer.mergeAll(
    Layer.succeed(Truncate.Service, fakeTruncate),
    Layer.succeed(Agent.Service, fakeAgent),
    Layer.succeed(Service, makeService(config)),
  )
  const info = await Effect.runPromise(BinaryTool.pipe(Effect.provide(layer)))
  return Effect.runPromise(Tool.init(info).pipe(Effect.provide(layer)))
}

async function execute(tool: Awaited<ReturnType<typeof makeTool>>, params: Record<string, unknown>) {
  return Effect.runPromise(tool.execute(params as any, ctx))
}

beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "reverse-test-"))
  const source = path.join(dir, "fixture.c")
  so = path.join(dir, "libfixture.so")
  Bun.write(
    source,
    `#include <string.h>\nconst char marker[] = "${marker}";\nint greet(void) { return 42; }\nint add(int a, int b) { return a + b; }\n`,
  )
  const result = spawnSync("cc", ["-shared", "-fPIC", "-O0", "-o", so, source], { encoding: "utf-8" })
  if (result.status !== 0) throw new Error(`cc failed: ${result.stderr}`)
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe("binary tool", () => {
  it("reports file info, hash, and ELF header", async () => {
    const tool = await makeTool()
    const result = await execute(tool, { action: "info", file: so })
    expect(result.output).toContain("ELF")
    expect(result.output).toContain("sha256:")
    expect(result.output.length).toBeGreaterThan(100)
  })

  it("lists sections, imports, exports, and strings", async () => {
    const tool = await makeTool()
    expect((await execute(tool, { action: "sections", file: so })).output).toContain(".text")
    expect((await execute(tool, { action: "exports", file: so })).output).toContain("greet")
    expect((await execute(tool, { action: "imports", file: so })).output.length).toBeGreaterThan(0)
    expect((await execute(tool, { action: "strings", file: so })).output).toContain(marker)
  })

  it("reads raw bytes as a hex dump", async () => {
    const tool = await makeTool()
    const result = await execute(tool, { action: "read_bytes", file: so, offset: 0, count: 16 })
    expect(result.output).toContain("read 16 bytes at offset 0")
    expect(result.output).toContain("7f 45 4c 46")
  })

  it("finds a byte pattern and reports offsets", async () => {
    const tool = await makeTool()
    const hex = Buffer.from(marker).toString("hex")
    const result = await execute(tool, { action: "search_bytes", file: so, hex })
    expect(result.output).toContain("Found 1 match")
    expect(result.output).toContain("0x")
  })

  it("patches a copy and leaves the original unchanged", async () => {
    const tool = await makeTool()
    const before = await hashOf(so)
    const result = await execute(tool, { action: "patch", file: so, offset: 0, hex: "0000" })
    const patched = result.output.split("patched copy: ")[1].split("\n")[0]
    expect(await hashOf(so)).toBe(before)
    expect(await hashOf(patched)).not.toBe(before)
    expect(result.output).toContain("original file unchanged")
  })

  it("refuses to patch when allowPatch is false", async () => {
    const tool = await makeTool({ allowPatch: false })
    await expect(execute(tool, { action: "patch", file: so, offset: 0, hex: "00" })).rejects.toThrow(
      "Patching is disabled",
    )
  })

  it("refuses files outside allowedDirs", async () => {
    const outside = path.join(os.tmpdir(), "reverse-outside.so")
    await Bun.write(outside, "not elf")
    const tool = await makeTool()
    await expect(execute(tool, { action: "info", file: outside })).rejects.toThrow("outside reverse.allowedDirs")
    rmSync(outside, { force: true })
  })

  it("rejects r2 targets that are not hex or symbols", async () => {
    const tool = await makeTool()
    await expect(execute(tool, { action: "emulate", file: so, address: "!sh", count: 1 })).rejects.toThrow(
      "address must be a hex address or symbol name",
    )
  })

  it.skipIf(!Bun.which("r2"))("emulates greet() and returns a register state", async () => {
    const tool = await makeTool()
    const result = await execute(tool, { action: "emulate", file: so, address: "sym.greet", count: 8 })
    expect(result.output).toContain("rax = 0x0000002a")
    expect(result.output).toContain("rsp")
  })
})

describe("reverse config", () => {
  it("restricts paths only when allowedDirs is non-empty", () => {
    expect(pathAllowed(loadFromConfig({ allowedDirs: [] }), "/etc/passwd")).toBe(true)
    expect(pathAllowed(loadFromConfig({ allowedDirs: ["/srv"] }), "/srv/lib.so")).toBe(true)
    expect(pathAllowed(loadFromConfig({ allowedDirs: ["/srv"] }), "/etc/passwd")).toBe(false)
  })
})
