import { test } from "bun:test"
import { createAppFixture } from "./fixture/app"
import { tmpdir } from "./fixture/fixture"
import { directory, json } from "./fixture/tui-client"

const location = { directory, project: { id: "proj_test", directory, canonical: directory } }

test("footer shows context, spend, and OpenCode Go usage", async () => {
  await using state = await tmpdir()
  const session = {
    id: "ses_go_usage",
    projectID: "proj_test",
    location: { directory },
    title: "Go usage",
    agent: "build",
    model: { providerID: "opencode-go", id: "kimi-k2.6" },
    cost: 8.01,
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    time: { created: 1, updated: 1 },
  }
  const meter = (percent: number) => ({ percent, limited: false, resetsAt: Date.parse("2026-11-02T00:00:00.000Z") })
  const limits = {
    workspace: { id: "wrk_1", usageURL: "https://opencode.ai/wrk_1" },
    budgets: [],
    go: { rolling: meter(16), weekly: meter(6), monthly: meter(3) },
  }
  await using setup = await createAppFixture({
    width: 110,
    height: 36,
    state: state.path,
    args: { sessionID: session.id },
    config: { animations: false, tabs: { mode: "off" } },
    fetch: (url) => {
      if (url.pathname === "/api/session") return json({ data: [session], cursor: {} })
      if (url.pathname === `/api/session/${session.id}`) return json({ data: session })
      if (url.pathname === `/api/session/${session.id}/message`)
        return json({
          data: [
            {
              id: "msg_answer",
              type: "assistant",
              agent: "build",
              model: session.model,
              content: [{ type: "text", text: "Done." }],
              finish: "stop",
              tokens: { input: 300_000, output: 39_952, reasoning: 0, cache: { read: 0, write: 0 } },
              cost: 8.01,
              time: { created: 2, completed: 3 },
            },
          ],
          cursor: {},
        })
      if ([`/api/session/${session.id}/inbox`, `/api/session/${session.id}/permission`].includes(url.pathname))
        return json({ data: [] })
      if (url.pathname === "/api/agent")
        return json({ location, data: [{ id: "build", mode: "primary", hidden: false, permissions: [] }] })
      if (url.pathname === "/api/provider")
        return json({ location, data: [{ id: "opencode-go", integrationID: "opencode", name: "OpenCode Go" }] })
      if (url.pathname === "/api/model")
        return json({
          location,
          data: [
            {
              id: "kimi-k2.6",
              modelID: "kimi-k2.6",
              providerID: "opencode-go",
              name: "Kimi K2.6",
              status: "active",
              enabled: true,
              cost: [{ input: 1, output: 5, cache: { read: 0, write: 0 } }],
              capabilities: { input: ["text"], output: ["text"], reasoning: false, toolCall: true, attachment: false },
              limit: { context: 1_000_000, output: 32_000 },
              variants: [],
              time: { released: 1 },
            },
          ],
        })
      if (url.pathname === "/api/experimental/usage/limits") return json({ location, data: limits })
      return undefined
    },
  })

  await setup.ready
  await setup.waitForFrame((frame) => frame.includes("Context 339,952 · 34% used · $8.01 · OpenCode Go: 16%·6%·3%"))
})

test("home screen shows OpenCode Go usage", async () => {
  await using state = await tmpdir()
  const model = {
    id: "kimi-k2.6",
    modelID: "kimi-k2.6",
    providerID: "opencode-go",
    name: "Kimi K2.6",
    status: "active",
    enabled: true,
    cost: [{ input: 1, output: 5, cache: { read: 0, write: 0 } }],
    capabilities: { input: ["text"], output: ["text"], reasoning: false, toolCall: true, attachment: false },
    limit: { context: 200_000, output: 32_000 },
    variants: [],
    time: { released: 1 },
  }
  const meter = (percent: number) => ({ percent, limited: false, resetsAt: Date.parse("2026-11-02T00:00:00.000Z") })
  const limits = {
    workspace: { id: "wrk_1", usageURL: "https://opencode.ai/wrk_1" },
    budgets: [],
    go: { rolling: meter(46), weekly: meter(18), monthly: meter(9) },
  }
  await using setup = await createAppFixture({
    width: 110,
    height: 36,
    state: state.path,
    config: { animations: false, tabs: { mode: "off" } },
    fetch: (url) => {
      if (url.pathname === "/api/session") return json({ data: [], cursor: {} })
      if (url.pathname === "/api/agent")
        return json({ location, data: [{ id: "build", mode: "primary", hidden: false, permissions: [] }] })
      if (url.pathname === "/api/provider")
        return json({ location, data: [{ id: "opencode-go", integrationID: "opencode", name: "OpenCode Go" }] })
      if (url.pathname === "/api/model") return json({ location, data: [model] })
      if (url.pathname === "/api/experimental/usage/limits")
        return json({ location: { ...location, directory: `${directory}/canonical` }, data: limits })
      return undefined
    },
  })

  await setup.ready
  await setup.waitForFrame((frame) => frame.includes("OpenCode Go: 46%·18%·9%"))
})
