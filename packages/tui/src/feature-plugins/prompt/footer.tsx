import { Plugin } from "@opencode/plugin/tui"
import { createMemo, createSignal, Match, Show, Switch } from "solid-js"
import { contextUsage, formatContextUsage } from "../../util/session"
import { useTerminalDimensions } from "@opentui/solid"
import { stringWidth } from "../../util/string-width"
import { DialogEco } from "../../component/dialog-eco"
import { DialogVerify } from "../../component/dialog-verify"
import { EcoMetrics } from "@opencode/core/util/eco-metrics"
import { verify } from "../../util/verify"

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

export function PromptFooter(props: {
  context: Plugin.Context
  sessionID?: string
  mode: "normal" | "shell"
  showDetails: boolean
}) {
  const dimensions = useTerminalDimensions()
  const [liveHovered, setLiveHovered] = createSignal(false)
  const subagents = createMemo(() => {
    if (!props.sessionID) return 0
    const count = props.context.data.session
      .family(props.sessionID)
      .filter((id) => id !== props.sessionID && props.context.data.session.status(id) === "running").length
    return count ? `${count} subagent${count === 1 ? "" : "s"}` : undefined
  })
  const shells = createMemo(() => {
    if (!props.sessionID) return 0
    const count = props.context.data.shell
      .list(props.context.location)
      .filter((shell) => shell.metadata.sessionID === props.sessionID).length
    return count ? `${count} shell${count === 1 ? "" : "s"}` : undefined
  })
  const status = createMemo(() => {
    if (!props.sessionID) return []
    const session = props.context.data.session.get(props.sessionID)
    if (!session) return []
    const usage = contextUsage(
      props.context.data.session.message.list(props.sessionID),
      props.context.data.location.model.list(session.location),
      session.revert?.messageID,
    )
    const cost = props.context.data.session.cost(props.sessionID)
    return [
      usage ? formatContextUsage(usage.tokens, usage.percent) : undefined,
      cost > 0 ? money.format(cost) : undefined,
    ].filter((item): item is string => Boolean(item))
  })
  const live = createMemo(() => Boolean(subagents() || shells()))
  const saved = createMemo(() => {
    if (!props.sessionID) return 0
    let total = 0
    for (const message of props.context.data.session.message.list(props.sessionID)) {
      if (message.type !== "assistant") continue
      for (const part of message.content) total += EcoMetrics.extractTruncationSaved(part)
    }
    return total
  })
  const unverified = createMemo(() => {
    if (!props.sessionID) return 0
    const report = verify({
      messages: props.context.data.session.message.list(props.sessionID),
      partsOf: (message) =>
        message && typeof message === "object" && "content" in message && Array.isArray(message.content)
          ? message.content
          : [],
    })
    return report.unverified.length
  })
  const formatTokens = (value: number) => (value >= 1000 ? `${(value / 1000).toFixed(1)}k` : `${value}`)
  const shortcut = (id: string) => props.context.keymap.shortcuts(id)[0]
  const layout = createMemo(() => {
    const command = shortcut("command.palette.show")
    if (status().length === 0) return { usage: false, shortcuts: dimensions().width >= 44 }
    return promptFooterLayout({
      width: Math.max(0, dimensions().width - 8),
      usage: status(),
      shortcuts: command ? [`${command} commands`] : [],
    })
  })

  return (
    <Switch>
      <Match when={props.mode === "normal"}>
        <Switch>
          <Match when={live() || status().length > 0}>
            <box flexDirection="row" flexShrink={props.showDetails && layout().usage ? 0 : 1} minWidth={0}>
              <Show when={live()}>
                <box
                  flexShrink={0}
                  onMouseOver={() => setLiveHovered(true)}
                  onMouseOut={() => setLiveHovered(false)}
                  onMouseUp={() => props.context.keymap.dispatch("session.child.first")}
                >
                  <text
                    fg={liveHovered() ? props.context.theme.text.base : props.context.theme.text.muted}
                    wrapMode="none"
                  >
                    <Show when={shortcut("session.child.first")}>
                      {(value) => <span style={{ fg: props.context.theme.text.base }}>{value()} </span>}
                    </Show>
                    <Show when={subagents()}>{(value) => <>{value()}</>}</Show>
                    <Show when={subagents() && shells()}> · </Show>
                    <Show when={shells()}>{(value) => <>{value()}</>}</Show>
                  </text>
                </box>
              </Show>
              <Show when={props.showDetails && layout().usage && status().length > 0}>
                <text fg={props.context.theme.text.muted} wrapMode="none" flexShrink={0}>
                  <Show when={live()}> · </Show>
                  {status().join(" · ")}
                </text>
              </Show>
            </box>
          </Match>
          <Match when={props.showDetails && layout().shortcuts}>
            <text fg={props.context.theme.text.base} flexShrink={0}>
              {shortcut("agent.cycle")} <span style={{ fg: props.context.theme.text.muted }}>agents</span>
            </text>
          </Match>
        </Switch>
        <Show when={props.showDetails && saved() > 0}>
          <text
            fg={props.context.theme.text.feedback.success.base}
            wrapMode="none"
            flexShrink={0}
            onMouseUp={() => props.context.ui.dialog.show(() => <DialogEco sessionID={props.sessionID} />)}
          >
            ◈ eco (-{formatTokens(saved())})
          </text>
        </Show>
        <Show when={props.showDetails && unverified() > 0}>
          <text
            fg={props.context.theme.text.feedback.warning.base}
            wrapMode="none"
            flexShrink={0}
            onMouseUp={() =>
              props.context.ui.dialog.show(() => (
                <DialogVerify
                  report={verify({
                    messages: props.context.data.session.message.list(props.sessionID ?? ""),
                    partsOf: (message) =>
                      message &&
                      typeof message === "object" &&
                      "content" in message &&
                      Array.isArray(message.content)
                        ? message.content
                        : [],
                  })}
                />
              ))
            }
          >
            ⚠ {unverified()} unverified
          </text>
        </Show>
        <Show when={props.showDetails && layout().shortcuts}>
          <text fg={props.context.theme.text.base} wrapMode="none" flexShrink={0}>
            {shortcut("command.palette.show")} <span style={{ fg: props.context.theme.text.muted }}>commands</span>
          </text>
        </Show>
      </Match>
      <Match when={props.mode === "shell"}>
        <text fg={props.context.theme.text.base} flexShrink={0}>
          esc{" "}
          <span style={{ fg: props.context.theme.text.muted }}>
            {dimensions().width < 44 ? "shell" : "exit shell mode"}
          </span>
        </text>
      </Match>
    </Switch>
  )
}

export default Plugin.define({
  id: "opencode.prompt.footer",
  setup(context) {
    context.ui.slot({
      append: "prompt.footer",
      render: (props) => (
        <PromptFooter context={context} sessionID={props.sessionID} mode={props.mode} showDetails={props.showDetails} />
      ),
    })
  },
})

function promptFooterLayout(input: { width: number; usage: string[]; shortcuts: string[] }) {
  const usage = input.usage.join(" · ")
  const shortcuts = input.shortcuts.join(" · ")
  const available = Math.max(0, input.width - Math.min(28, Math.floor(input.width / 2)))
  if (usage && shortcuts && stringWidth(`${usage} · ${shortcuts}`) <= available) {
    return { usage: true, shortcuts: true }
  }
  if (usage && stringWidth(usage) <= available) return { usage: true, shortcuts: false }
  if (!usage && shortcuts && stringWidth(shortcuts) <= available) return { usage: false, shortcuts: true }
  return { usage: false, shortcuts: false }
}
