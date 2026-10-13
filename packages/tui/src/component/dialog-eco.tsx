import { TextAttributes } from "@opentui/core"
import { useTheme } from "../context/theme"
import { useDialog } from "../ui/dialog"
import { useData } from "../context/data"
import { useRoute } from "../context/route"
import { useLocation } from "../context/location"
import { useStorage } from "../context/storage"
import { createMemo, onMount, Show } from "solid-js"
import { EcoMetrics } from "@opencode/core/util/eco-metrics"
import { TokenSavingState } from "@opencode/core/token-saving-state"
import type { SessionMessageAssistant } from "@opencode/client"

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
})

export function DialogEco(props: { sessionID?: string }) {
  const data = useData()
  const theme = useTheme()
  const dialog = useDialog()
  const route = useRoute()
  const location = useLocation()
  const [saving, updateSaving] = useStorage().store("token-saving", { initial: { enabled: true, saved: 0 } })

  onMount(() => {
    dialog.setSize("large")
  })

  const sessionID = () => props.sessionID ?? (route.data.type === "session" ? route.data.sessionID : undefined)
  const enabled = () => saving.enabled
  const messages = createMemo(() => (sessionID() ? (data.session.message.list(sessionID()!) ?? []) : []))

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
      if (msgs[i].type === "assistant") {
        assistantIndices.push(i)
      }
    }

    for (let i = 0; i < msgs.length; i++) {
      const item = msgs[i]
      if (item.type === "assistant") {
        cacheRead += item.tokens?.cache?.read ?? 0
        cacheWrite += item.tokens?.cache?.write ?? 0
        totalPromptTokens += item.tokens?.input ?? 0
        totalCompletionTokens += item.tokens?.output ?? 0
      }
      if (item.type === "compaction") compactionCount++

      const parts = item.type === "assistant" ? item.content : []
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
    const lastAssistant = msgs.findLast(
      (m): m is SessionMessageAssistant => m.type === "assistant" && Boolean(m.model),
    )
    const model = lastAssistant
      ? (data.location.model.list(location.ref) ?? []).find(
          (m) => m.providerID === lastAssistant.model.providerID && m.modelID === lastAssistant.model.id,
        )
      : undefined
    const cost = model?.cost[0]

    const inputPrice = cost?.input ?? 3.0 // per million
    const cacheReadPrice = cost?.cache?.read ?? inputPrice * 0.1
    const cacheWritePrice = cost?.cache?.write ?? inputPrice * 1.25

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
        <text fg={theme.text.base} attributes={TextAttributes.BOLD}>
          ◈ Eco Mode Breakdown & Token Savings
        </text>
        <text fg={theme.text.muted} onMouseUp={() => dialog.clear()}>
          esc
        </text>
      </box>

      <box gap={1} paddingTop={1}>
        <box flexDirection="row" justifyContent="space-between">
          <text fg={theme.text.muted}>Mode Status:</text>
          <text fg={enabled() ? theme.text.feedback.success.base : theme.text.feedback.error.base}>
            {enabled() ? "Active (Enabled)" : "Disabled (Standard Limits)"}
          </text>
        </box>

        <text fg={theme.text.base} attributes={TextAttributes.BOLD}>
          1. Context Prevention (Tool Output Truncation)
        </text>
        <box flexDirection="row" justifyContent="space-between" paddingLeft={2}>
          <text fg={theme.text.muted}>Eliminated payload (single-event cut):</text>
          <text fg={theme.text.base}>
            <b>{stats().toolTruncationSaved.toLocaleString()}</b> tokens{" "}
            <span style={{ fg: theme.text.muted }}>({stats().truncatedCount} events)</span>
          </text>
        </box>
        <box flexDirection="row" justifyContent="space-between" paddingLeft={2}>
          <text fg={theme.text.muted}>Cumulative lifetime turn impact:</text>
          <text fg={theme.text.feedback.success.base}>
            <b>~{stats().cumulativeContextSaved.toLocaleString()}</b> tokens prevented
          </text>
        </box>
        <Show when={stats().compactionCount > 0}>
          <box flexDirection="row" justifyContent="space-between" paddingLeft={2}>
            <text fg={theme.text.muted}>Context size compaction:</text>
            <text fg={theme.text.base}>
              <b>{stats().compactionCount}</b> runs
            </text>
          </box>
        </Show>

        <text fg={theme.text.base} attributes={TextAttributes.BOLD}>
          2. Provider Prompt Caching
        </text>
        <box flexDirection="row" justifyContent="space-between" paddingLeft={2}>
          <text fg={theme.text.muted}>Cache read hits (reused at ~90% discount):</text>
          <text fg={theme.text.base}>
            <b>+{stats().cacheRead.toLocaleString()}</b> tokens
          </text>
        </box>
        <Show when={stats().cacheWrite > 0}>
          <box flexDirection="row" justifyContent="space-between" paddingLeft={2}>
            <text fg={theme.text.muted}>Cache write overhead (1.25x creation rate):</text>
            <text fg={theme.text.feedback.error.base}>-{stats().cacheWriteCost.toLocaleString()} tokens eq.</text>
          </box>
        </Show>

        <text fg={theme.border.base}>{"─".repeat(78)}</text>

        <box flexDirection="row" justifyContent="space-between">
          <text fg={theme.text.base} attributes={TextAttributes.BOLD}>
            Estimated Net Financial Savings:
          </text>
          <text fg={theme.text.feedback.success.base} attributes={TextAttributes.BOLD}>
            {money.format(stats().netDollarsSaved)}
          </text>
        </box>
        <box flexDirection="row" justifyContent="space-between">
          <text fg={theme.text.muted}>Summary Breakdown:</text>
          <text fg={theme.text.muted}>
            Physical cut: <b>{stats().toolTruncationSaved.toLocaleString()}</b> | Cache hits:{" "}
            <b>{stats().cacheRead.toLocaleString()}</b>
          </text>
        </box>
      </box>

      <box paddingTop={1} flexDirection="row" justifyContent="space-between">
        <text fg={theme.text.muted}>Click or select to toggle mode</text>
        <text
          fg={theme.text.action.primary.base}
          onMouseUp={() => {
            const next = !enabled()
            updateSaving((draft) => {
              draft.enabled = next
            })
            TokenSavingState.write(next)
          }}
        >
          [{enabled() ? "Disable Eco Mode" : "Enable Eco Mode"}]
        </text>
      </box>
    </box>
  )
}
