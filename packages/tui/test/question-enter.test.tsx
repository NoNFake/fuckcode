/** @jsxImportSource @opentui/solid */
import type { QuestionRequest } from "@opencode-ai/sdk/v2"
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui"
import { testRender, useRenderer } from "@opentui/solid"
import { expect, test } from "bun:test"
import { mkdir } from "node:fs/promises"
import path from "node:path"
import { onCleanup } from "solid-js"
import { TuiConfigProvider } from "../src/config"
import { KVProvider } from "../src/context/kv"
import { SDKProvider } from "../src/context/sdk"
import { ThemeProvider } from "../src/context/theme"
import { OpencodeKeymapProvider, registerOpencodeKeymap } from "../src/keymap"
import { QuestionPrompt } from "../src/routes/session/question"
import { tmpdir } from "./fixture/fixture"
import { TestTuiContexts } from "./fixture/tui-environment"
import { createTuiResolvedConfig } from "./fixture/tui-runtime"

const request: QuestionRequest = {
  id: "que_test",
  sessionID: "ses_test",
  questions: [
    { question: "Q1?", header: "One", options: [{ label: "A", description: "" }, { label: "B", description: "" }] },
    { question: "Q2?", header: "Two", options: [{ label: "C", description: "" }, { label: "D", description: "" }] },
    { question: "Q3?", header: "Three", options: [{ label: "E", description: "" }, { label: "F", description: "" }] },
  ],
}

test("question prompt: enter on confirm submits after the custom answer editor was opened", async () => {
  await using tmp = await tmpdir()
  const state = path.join(tmp.path, "state")
  await mkdir(state, { recursive: true })
  await Bun.write(path.join(state, "kv.json"), "{}")

  const calls: string[] = []
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    const method = input instanceof Request ? input.method : (init?.method ?? "GET")
    calls.push(`${method} ${url.pathname}`)
    return new Response(JSON.stringify(true), { headers: { "content-type": "application/json" } })
  }) as typeof globalThis.fetch

  function Harness() {
    const renderer = useRenderer()
    const keymap = createDefaultOpenTuiKeymap(renderer)
    const config = createTuiResolvedConfig({})
    const off = registerOpencodeKeymap(keymap, renderer, config)
    onCleanup(off)
    return (
      <TestTuiContexts directory={tmp.path} paths={{ home: tmp.path, state, worktree: tmp.path }}>
        <OpencodeKeymapProvider keymap={keymap}>
          <TuiConfigProvider config={config}>
            <KVProvider>
              <ThemeProvider mode="dark">
                <SDKProvider url="http://test" directory={tmp.path} fetch={fetch}>
                  <QuestionPrompt request={request} directory={tmp.path} />
                </SDKProvider>
              </ThemeProvider>
            </KVProvider>
          </TuiConfigProvider>
        </OpencodeKeymapProvider>
      </TestTuiContexts>
    )
  }

  const app = await testRender(() => <Harness />, { kittyKeyboard: true })
  try {
    await Bun.sleep(80)
    await app.renderOnce()
    const frame = () => app.captureCharFrame().split("\n")
    const row = (text: string) => frame().findIndex((line) => line.includes(text))
    const col = (text: string, needle: string) => frame()[row(text)].indexOf(needle)

    await app.mockMouse.click(col("Type your own answer", "Type your own answer") + 2, row("Type your own answer"))
    await Bun.sleep(60)
    await app.mockMouse.click(col("Confirm", "Confirm") + 1, row("Confirm"))
    await Bun.sleep(60)
    await app.renderOnce()
    expect(frame().some((line) => line.includes("Review"))).toBe(true)

    app.mockInput.pressEnter()
    await Bun.sleep(60)
    expect(calls).toContain("POST /question/que_test/reply")
  } finally {
    app.renderer.destroy()
  }
})
