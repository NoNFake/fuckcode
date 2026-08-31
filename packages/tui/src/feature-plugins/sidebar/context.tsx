import type { AssistantMessage } from "@opencode-ai/sdk/v2"
import type { TuiPlugin, TuiPluginApi } from "@opencode-ai/plugin/tui"
import type { BuiltinTuiPlugin } from "../builtins"
import { createMemo, Show } from "solid-js"
import { DialogEco } from "../../component/dialog-eco"
import { useDialog } from "../../ui/dialog"
import { EcoMetrics } from "@opencode-ai/core/util/eco-metrics"

const id = "internal:sidebar-context"

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

function View(props: { api: TuiPluginApi; session_id: string }) {
  const dialog = useDialog()
  const theme = () => props.api.theme.current
  const msg = createMemo(() => props.api.state.session.messages(props.session_id))
  const session = createMemo(() => props.api.state.session.get(props.session_id))
  const cost = createMemo(() => session()?.cost ?? 0)
  const tokenSavingEnabled = createMemo(() => props.api.kv.get("token_saving_enabled", true))
  const metrics = createMemo(() => {
    let cacheRead = 0
    let contextCut = 0
    for (const item of msg()) {
      if (item.role === "assistant") {
        cacheRead += item.tokens?.cache?.read ?? 0
      }
      if ("parts" in item && Array.isArray((item as any).parts)) {
        for (const part of (item as any).parts) {
          contextCut += EcoMetrics.extractTruncationSaved(part)
        }
      }
    }
    return { cacheRead, contextCut }
  })

  const state = createMemo(() => {
    const last = msg().findLast((item): item is AssistantMessage => item.role === "assistant" && item.tokens.output > 0)
    if (!last) {
      return {
        tokens: 0,
        percent: null,
      }
    }

    const tokens =
      last.tokens.input + last.tokens.output + last.tokens.reasoning + last.tokens.cache.read + last.tokens.cache.write
    const model = props.api.state.provider.find((item) => item.id === last.providerID)?.models[last.modelID]
    return {
      tokens,
      percent: model?.limit.context ? Math.round((tokens / model.limit.context) * 100) : null,
    }
  })

  return (
    <box>
      <text fg={theme().text}>
        <b>Context</b>
      </text>
      <text fg={theme().textMuted}>{state().tokens.toLocaleString()} tokens</text>
      <text fg={theme().textMuted}>{state().percent ?? 0}% used</text>
      <text fg={theme().textMuted}>{money.format(cost())} spent</text>
      <Show when={tokenSavingEnabled()}>
        <text
          fg={theme().success}
          onMouseUp={() => dialog.replace(() => <DialogEco sessionID={props.session_id} />)}
        >
          ◈ eco{" "}
          <Show
            when={metrics().contextCut > 0 || metrics().cacheRead > 0}
            fallback={<span>active</span>}
          >
            <span style={{ fg: theme().textMuted }}>
              ({[
                metrics().contextCut > 0 ? `cut -${metrics().contextCut >= 1000 ? `${(metrics().contextCut / 1000).toFixed(1)}k` : metrics().contextCut}` : "",
                metrics().cacheRead > 0 ? `cache ${metrics().cacheRead >= 1000 ? `${(metrics().cacheRead / 1000).toFixed(1)}k` : metrics().cacheRead}` : "",
              ].filter(Boolean).join(" · ")})
            </span>
          </Show>
        </text>
      </Show>
    </box>
  )
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 100,
    slots: {
      sidebar_content(_ctx, props) {
        return <View api={api} session_id={props.session_id} />
      },
    },
  })
}

const plugin: BuiltinTuiPlugin = {
  id,
  tui,
}

export default plugin
