import { describe, expect, it } from "bun:test"
import { Effect, Layer } from "effect"
import { Truncate } from "../../tool/truncate"
import { Agent } from "@/agent/agent"
import * as Tool from "../../tool/tool"
import { BinaryTool } from "../binary"
import { loadFromConfig, makeService, Service } from "../config"

const fakeTruncate = Truncate.Service.of({
  cleanup: () => Effect.void,
  write: () => Effect.succeed("/tmp/truncate"),
  output: (content) => Effect.succeed({ content, truncated: false }),
  limits: () => Effect.succeed({ maxLines: 1000, maxBytes: 100000 }),
})

const fakeAgent = Agent.Service.of({
  get: (agent) => Effect.succeed({ name: agent, mode: "primary", native: true, permissions: [], options: {} } as any),
  list: () => Effect.succeed([]),
  defaultInfo: () => Effect.die("not implemented"),
  defaultAgent: () => Effect.succeed("build"),
  generate: () => Effect.die("not implemented"),
})

const ctx: any = {
  sessionID: "s",
  messageID: "m",
  agent: "build",
  abort: new AbortController().signal,
  messages: [],
  ask: () => Effect.void,
  metadata: () => Effect.void,
}

// Manual end-to-end check against a real binary. Skipped unless REAL_TARGET is set.
// Run: REAL_TARGET=/usr/lib/libc.so.6 bun test src/reverse/__tests__/real.local.test.ts
const target = process.env.REAL_TARGET ?? "/usr/lib/libc.so.6"

async function tool() {
  const config = loadFromConfig({ enabled: true, allowPatch: true, workDir: "/tmp/fuckcode/reverse-work" })
  const layer = Layer.mergeAll(
    Layer.succeed(Truncate.Service, fakeTruncate),
    Layer.succeed(Agent.Service, fakeAgent),
    Layer.succeed(Service, makeService(config)),
  )
  const info = await Effect.runPromise(BinaryTool.pipe(Effect.provide(layer)))
  return Effect.runPromise(Tool.init(info).pipe(Effect.provide(layer)))
}

async function run(t: Awaited<ReturnType<typeof tool>>, params: Record<string, unknown>) {
  return Effect.runPromise(t.execute(params as any, ctx))
}

describe("real binary", () => {
  it.skipIf(!process.env.REAL_TARGET)("runs the full static workflow on a real shared library", async () => {
    const t = await tool()
    const info = await run(t, { action: "info", file: target })
    const entropy = await run(t, { action: "entropy", file: target })
    const exports = await run(t, { action: "exports", file: target })
    const imports = await run(t, { action: "imports", file: target })
    const strings = await run(t, { action: "strings", file: target })
    const functions = await run(t, { action: "functions", file: target })
    const disasm = await run(t, { action: "disasm", file: target, count: 8 })

    console.log("=== info ===\n" + info.output.split("\n").slice(0, 8).join("\n"))
    console.log("=== entropy (top) ===\n" + entropy.output.split("\n").slice(0, 6).join("\n"))
    console.log("=== exports (head) ===\n" + exports.output.split("\n").slice(0, 5).join("\n"))
    console.log("=== imports (head) ===\n" + imports.output.split("\n").slice(0, 5).join("\n"))
    console.log("=== strings (head) ===\n" + strings.output.split("\n").slice(0, 5).join("\n"))
    console.log("=== functions (head) ===\n" + functions.output.split("\n").slice(0, 5).join("\n"))
    console.log("=== disasm ===\n" + disasm.output.split("\n").slice(0, 6).join("\n"))

    expect(info.output).toContain("ELF")
    expect(entropy.output).toContain("whole file entropy=")
    expect(exports.output.length).toBeGreaterThan(0)
  })
})
