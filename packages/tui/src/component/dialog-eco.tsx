import { TextAttributes } from "@opentui/core"
import { useTheme } from "../context/theme"
import { useDialog } from "../ui/dialog"
import { useSync } from "../context/sync"
import { useRoute } from "../context/route"
import { useKV } from "../context/kv"
import { createMemo, onMount, Show } from "solid-js"
import { EcoMetrics } from "@opencode-ai/core/util/eco-metrics"
import type { AssistantMessage } from "@opencode-ai/sdk/v2"

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
})

export function DialogEco(props: { sessionID?: string }) {
  const sync = useSync()
  const { theme } = useTheme()
  const dialog = useDialog()
  const route = useRoute()
  const kv = useKV()

  onMount(() => {
    dialog.setSize("large")
  })

  const sessionID = () => props.sessionID ?? (route.data.type === "session" ? route.data.sessionID : undefined)
  const enabled = createMemo(() => kv.get("token_saving_enabled", true))
  const messages = createMemo(() => (sessionID() ? (sync.data.message[sessionID()!] ?? []) : []))

  const stats = createMemo(() => {
    let cacheRead = 0
    let cacheWrite = 0
    let toolTruncationSaved = 0
    let cumulativeContextSaved = 0
    let truncatedCount = 0
    let compactionCount = 0
    let totalPromptTokens = 0
    let totalCompletionTokens = 0

    const msgs = messages()
    const assistantIndices: number[] = []
    for (let i = 0; i < msgs.length; i++) {
      if (msgs[i].role === "assistant") {
        assistantIndices.push(i)
      }
    }

    for (let i = 0; i < msgs.length; i++) {
      const item = msgs[i]
      if (item.role === "assistant") {
        cacheRead += item.tokens?.cache?.read ?? 0
        cacheWrite += item.tokens?.cache?.write ?? 0
        totalPromptTokens += item.tokens?.input ?? 0
        totalCompletionTokens += item.tokens?.output ?? 0
        if (item.summary) compactionCount++
      }

      const parts = "parts" in item && Array.isArray((item as any).parts)
        ? (item as any).parts
        : (sync.data.part[item.id] ?? [])
      for (const part of parts) {
        const saved = EcoMetrics.extractTruncationSaved(part)
        if (saved > 0) {
          toolTruncationSaved += saved
          truncatedCount++
          // Subsequent assistant turns in the session avoided paying for this truncated payload
          const subsequentTurns = assistantIndices.filter((idx) => idx > i).length
          cumulativeContextSaved += saved * (subsequentTurns + 1)
        }
      }
    }

    // Identify active model pricing for financial savings calculation
    const lastAssistant = msgs.findLast((m): m is AssistantMessage => m.role === "assistant" && Boolean(m.modelID))
    const provider = lastAssistant ? sync.data.provider.find((p) => p.id === lastAssistant.providerID) : undefined
    const model = (provider && lastAssistant) ? provider.models[lastAssistant.modelID] : undefined

    const inputPrice = model?.cost?.input ?? 3.0 // per million
    const cacheReadPrice = model?.cost?.cache?.read ?? (inputPrice * 0.1)
    const cacheWritePrice = model?.cost?.cache?.write ?? (inputPrice * 1.25)

    // Formula for real cost savings
    const truncationDollarsSaved = (toolTruncationSaved / 1_000_000) * inputPrice
    const cacheReadDollarsSaved = (cacheRead / 1_000_000) * (inputPrice - cacheReadPrice)
    const cacheWriteDollarsExpense = (cacheWrite / 1_000_000) * Math.max(0, cacheWritePrice - inputPrice)
    const netDollarsSaved = Math.max(0, truncationDollarsSaved + cacheReadDollarsSaved - cacheWriteDollarsExpense)

    const cacheWriteCost = Math.round(cacheWrite * 1.25)
    const netCacheBenefit = cacheRead - cacheWriteCost

    return {
      cacheRead,
      cacheWrite,
      cacheWriteCost,
      netCacheBenefit,
      toolTruncationSaved,
      cumulativeContextSaved,
      truncatedCount,
      compactionCount,
      totalPromptTokens,
      totalCompletionTokens,
      netDollarsSaved,
    }
  })

  return (
    <box paddingLeft={2} paddingRight={2} gap={1} paddingBottom={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={theme.text} attributes={TextAttributes.BOLD}>
          ◈ Eco Mode Breakdown & Token Savings
        </text>
        <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
          esc
        </text>
      </box>

      <box gap={1} paddingTop={1}>
        <box flexDirection="row" justifyContent="space-between">
          <text fg={theme.textMuted}>Mode Status:</text>
          <text fg={enabled() ? theme.success : theme.error}>
            {enabled() ? "Active (Enabled)" : "Disabled (Standard Limits)"}
          </text>
        </box>

        <text fg={theme.text} attributes={TextAttributes.BOLD}>
          1. Context Prevention (Tool Output Truncation)
        </text>
        <box flexDirection="row" justifyContent="space-between" paddingLeft={2}>
          <text fg={theme.textMuted}>Eliminated payload (single-event cut):</text>
          <text fg={theme.text}>
            <b>{stats().toolTruncationSaved.toLocaleString()}</b> tokens{" "}
            <span style={{ fg: theme.textMuted }}>({stats().truncatedCount} events)</span>
          </text>
        </box>
        <box flexDirection="row" justifyContent="space-between" paddingLeft={2}>
          <text fg={theme.textMuted}>Cumulative lifetime turn impact:</text>
          <text fg={theme.success}>
            <b>~{stats().cumulativeContextSaved.toLocaleString()}</b> tokens prevented
          </text>
        </box>
        <Show when={stats().compactionCount > 0}>
          <box flexDirection="row" justifyContent="space-between" paddingLeft={2}>
            <text fg={theme.textMuted}>Context size compaction:</text>
            <text fg={theme.text}>
              <b>{stats().compactionCount}</b> runs
            </text>
          </box>
        </Show>

        <text fg={theme.text} attributes={TextAttributes.BOLD}>
          2. Provider Prompt Caching
        </text>
        <box flexDirection="row" justifyContent="space-between" paddingLeft={2}>
          <text fg={theme.textMuted}>Cache read hits (reused at ~90% discount):</text>
          <text fg={theme.text}>
            <b>+{stats().cacheRead.toLocaleString()}</b> tokens
          </text>
        </box>
        <Show when={stats().cacheWrite > 0}>
          <box flexDirection="row" justifyContent="space-between" paddingLeft={2}>
            <text fg={theme.textMuted}>Cache write overhead (1.25x creation rate):</text>
            <text fg={theme.error}>
              -{stats().cacheWriteCost.toLocaleString()} tokens eq.
            </text>
          </box>
        </Show>

        <text fg={theme.borderSubtle}>{"─".repeat(78)}</text>

        <box flexDirection="row" justifyContent="space-between">
          <text fg={theme.text} attributes={TextAttributes.BOLD}>
            Estimated Net Financial Savings:
          </text>
          <text fg={theme.success} attributes={TextAttributes.BOLD}>
            {money.format(stats().netDollarsSaved)}
          </text>
        </box>
        <box flexDirection="row" justifyContent="space-between">
          <text fg={theme.textMuted}>Summary Breakdown:</text>
          <text fg={theme.textMuted}>
            Physical cut: <b>{stats().toolTruncationSaved.toLocaleString()}</b> | Cache hits: <b>{stats().cacheRead.toLocaleString()}</b>
          </text>
        </box>
      </box>

      <box paddingTop={1} flexDirection="row" justifyContent="space-between">
        <text fg={theme.textMuted}>
          Click or select to toggle mode
        </text>
        <text
          fg={theme.primary}
          onMouseUp={() => {
            kv.set("token_saving_enabled", !enabled())
          }}
        >
          [{enabled() ? "Disable Eco Mode" : "Enable Eco Mode"}]
        </text>
      </box>
    </box>
  )
}
