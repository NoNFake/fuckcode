import { describe, expect, it } from "bun:test"
import { verify } from "./verify"

describe("verify", () => {
  it("flags file references never seen in a tool result", () => {
    const messages = [
      {
        role: "assistant",
        parts: [{ type: "text", text: "Fixed it in src/fake/missing.ts:12 and src/real/file.ts:3." }],
      },
      {
        role: "assistant",
        parts: [
          { type: "tool", tool: "read", state: { status: "completed", input: { filePath: "/repo/src/real/file.ts" }, output: "3: content" } },
        ],
      },
    ]
    const report = verify({ messages, partsOf: (message) => (message as any).parts ?? [] })
    expect(report.unverified).toContain("src/fake/missing.ts:12")
    expect(report.unverified).not.toContain("src/real/file.ts:3")
  })

  it("counts not-found tool errors", () => {
    const messages = [
      {
        role: "assistant",
        parts: [
          { type: "tool", tool: "read", state: { status: "error", error: "ENOENT: no such file or directory" } },
          { type: "tool", tool: "grep", state: { status: "error", error: "permission denied" } },
        ],
      },
    ]
    const report = verify({ messages, partsOf: (message) => (message as any).parts ?? [] })
    expect(report.notFound).toBe(1)
  })
})
