import { describe, expect, test } from "bun:test"
import { BUILTIN_IDS } from "../../src/component/pet-builtins"
import { activity, parsePet, resolvePet, resolveState, screen } from "../../src/component/pet-model"

const idle = { runningTool: false, streamingText: false, streamingReasoning: false, toolError: false }
const pending = { permissions: 0, forms: 0 }

describe("pet state", () => {
  test("pending work and errors alert, idle wins over activity", () => {
    expect(resolveState("running", idle, { permissions: 1, forms: 0 })).toBe("alert")
    expect(resolveState("running", idle, { permissions: 0, forms: 1 })).toBe("alert")
    expect(resolveState("running", { ...idle, toolError: true }, pending)).toBe("alert")
    expect(resolveState("idle", { ...idle, runningTool: true }, pending)).toBe("idle")
  })

  test("busy maps a running tool or streaming text to code, reasoning to think", () => {
    expect(resolveState("running", { ...idle, runningTool: true }, pending)).toBe("code")
    expect(resolveState("running", { ...idle, streamingText: true }, pending)).toBe("code")
    expect(resolveState("running", { ...idle, streamingReasoning: true }, pending)).toBe("think")
    expect(resolveState("running", idle, pending)).toBe("think")
  })

  test("activity only reads the current turn", () => {
    const assistant = (content: unknown[], time = {}) => ({ type: "assistant", time, content })
    const messages = [
      assistant([{ type: "tool", state: { status: "error" } }]),
      { type: "user", content: [] },
      assistant([{ type: "tool", state: { status: "running" } }, { type: "text", text: "hi" }]),
    ]
    expect(activity(messages)).toEqual({ ...idle, runningTool: true, streamingText: true })
  })
})

describe("pet frames", () => {
  const palette = { a: "#ff0000", b: "#00ff00" }

  test("rejects uneven rows and unknown palette characters", () => {
    expect(parsePet({ palette, states: { idle: [["aa", "bb", "aa"]] } })).toBeUndefined()
    expect(parsePet({ palette, states: { idle: [["aa", "bx"]] } })).toBeUndefined()
  })

  test("falls back to idle frames for missing states", () => {
    const pet = parsePet({ palette, states: { idle: [["aa", "bb"]] } })
    expect(pet?.states.think).toEqual(pet?.states.idle)
    expect(pet?.states.alert).toEqual(pet?.states.idle)
  })

  test("merges two pixel rows into one half-block row", () => {
    const rows = screen(["ab", "ba"], palette)
    expect(rows).toEqual([
      [
        { ch: "▀", fg: "#ff0000", bg: "#00ff00" },
        { ch: "▀", fg: "#00ff00", bg: "#ff0000" },
      ],
    ])
    expect(screen(["a.", "."], palette)[0]).toEqual([{ ch: "▀", fg: "#ff0000" }])
    expect(screen([".", "a"], palette)[0]).toEqual([{ ch: "▄", fg: "#ff0000" }])
  })

  test("every builtin parses and the unknown name still yields a pet", () => {
    for (const id of BUILTIN_IDS) expect(resolvePet(id, undefined)?.states.idle.length).toBeGreaterThan(0)
    expect(resolvePet("missing", undefined)?.states.idle.length).toBeGreaterThan(0)
  })
})
