import { createMemo, Match, onCleanup, onMount, Show, Switch } from "solid-js"
import { useTheme } from "../../context/theme"
import { useSync } from "../../context/sync"
import { useDirectory } from "../../context/directory"
import { useConnected } from "../../component/use-connected"
import { createStore } from "solid-js/store"
import { useRoute } from "../../context/route"
import { useKV } from "../../context/kv"
import { useDialog } from "../../ui/dialog"
import { DialogEco } from "../../component/dialog-eco"
import { EcoMetrics } from "@opencode-ai/core/util/eco-metrics"

export function Footer() {
  const { theme } = useTheme()
  const sync = useSync()
  const route = useRoute()
  const dialog = useDialog()
  const kv = useKV()
  const tokenSavingEnabled = createMemo(() => kv.get("token_saving_enabled", true))
  const msg = createMemo(() => (route.data.type === "session" ? (sync.data.message[route.data.sessionID] ?? []) : []))
  const metrics = createMemo(() => {
    let cacheRead = 0
    let contextCut = 0
    for (const item of msg()) {
      if (item.role === "assistant") {
        cacheRead += item.tokens?.cache?.read ?? 0
      }
      const parts = "parts" in item && Array.isArray((item as any).parts)
        ? (item as any).parts
        : (sync.data.part[item.id] ?? [])
      for (const part of parts) {
        contextCut += EcoMetrics.extractTruncationSaved(part)
      }
    }
    return { cacheRead, contextCut }
  })
  const mcp = createMemo(() => Object.values(sync.data.mcp).filter((x) => x.status === "connected").length)
  const mcpError = createMemo(() => Object.values(sync.data.mcp).some((x) => x.status === "failed"))
  const lsp = createMemo(() => Object.keys(sync.data.lsp))
  const permissions = createMemo(() => {
    if (route.data.type !== "session") return []
    return sync.data.permission[route.data.sessionID] ?? []
  })
  const directory = useDirectory()
  const connected = useConnected()

  const [store, setStore] = createStore({
    welcome: false,
  })

  onMount(() => {
    // Track all timeouts to ensure proper cleanup
    const timeouts: ReturnType<typeof setTimeout>[] = []

    function tick() {
      if (connected()) return
      if (!store.welcome) {
        setStore("welcome", true)
        timeouts.push(setTimeout(() => tick(), 5000))
        return
      }

      if (store.welcome) {
        setStore("welcome", false)
        timeouts.push(setTimeout(() => tick(), 10_000))
        return
      }
    }
    timeouts.push(setTimeout(() => tick(), 10_000))

    onCleanup(() => {
      timeouts.forEach(clearTimeout)
    })
  })

  return (
    <box flexDirection="row" justifyContent="space-between" gap={1} flexShrink={0}>
      <text fg={theme.textMuted}>{directory()}</text>
      <box gap={2} flexDirection="row" flexShrink={0}>
        <Switch>
          <Match when={store.welcome}>
            <text fg={theme.text}>
              Get started <span style={{ fg: theme.textMuted }}>/connect</span>
            </text>
          </Match>
          <Match when={connected()}>
            <Show when={permissions().length > 0}>
              <text fg={theme.warning}>
                <span style={{ fg: theme.warning }}>△</span> {permissions().length} Permission
                {permissions().length > 1 ? "s" : ""}
              </text>
            </Show>
            <text fg={theme.text}>
              <span style={{ fg: lsp().length > 0 ? theme.success : theme.textMuted }}>•</span> {lsp().length} LSP
            </text>
            <Show when={mcp()}>
              <text fg={theme.text}>
                <Switch>
                  <Match when={mcpError()}>
                    <span style={{ fg: theme.error }}>⊙ </span>
                  </Match>
                  <Match when={true}>
                    <span style={{ fg: theme.success }}>⊙ </span>
                  </Match>
                </Switch>
                {mcp()} MCP
              </text>
            </Show>
            <Show when={tokenSavingEnabled()}>
              <text fg={theme.success} onMouseUp={() => dialog.replace(() => <DialogEco />)}>
                <span>◈ eco</span>
                <Show when={metrics().contextCut > 0 || metrics().cacheRead > 0}>
                  <span style={{ fg: theme.textMuted }}>
                    {metrics().contextCut > 0
                      ? ` (cut -${metrics().contextCut >= 1000 ? `${(metrics().contextCut / 1000).toFixed(1)}k` : metrics().contextCut})`
                      : ""}
                    {metrics().cacheRead > 0
                      ? ` (cache ${metrics().cacheRead >= 1000 ? `${(metrics().cacheRead / 1000).toFixed(1)}k` : metrics().cacheRead})`
                      : ""}
                  </span>
                </Show>
              </text>
            </Show>
            <text fg={theme.textMuted}>/status</text>
          </Match>
        </Switch>
      </box>
    </box>
  )
}
