import { TextAttributes } from "@opentui/core"
import { useTheme } from "../context/theme"
import { useDialog } from "../ui/dialog"
import { useSync } from "../context/sync"
import { useRoute } from "../context/route"
import { useKV } from "../context/kv"
import { createMemo, For, onMount, Show } from "solid-js"

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
    let truncatedCount = 0
    let compactionCount = 0
    let totalPromptTokens = 0
    let totalCompletionTokens = 0

    for (const item of messages()) {
      if (item.role === "assistant") {
        cacheRead += item.tokens?.cache?.read ?? 0
        cacheWrite += item.tokens?.cache?.write ?? 0
        totalPromptTokens += item.tokens?.input ?? 0
        totalCompletionTokens += item.tokens?.output ?? 0
        if (item.summary) compactionCount++
      }

      if ("parts" in item && Array.isArray((item as any).parts)) {
        for (const part of (item as any).parts) {
          const text = part.content ?? part.text ?? ""
          if (typeof text === "string" && text.includes("tokens saved")) {
            const match = text.match(/([0-9,]+)\s*tokens saved/)
            if (match && match[1]) {
              toolTruncationSaved += Number.parseInt(match[1].replace(/,/g, ""), 10) || 0
              truncatedCount++
            }
          }
        }
      }
    }

    const cacheWriteCost = Math.round(cacheWrite * 1.25)
    const netCacheBenefit = cacheRead - cacheWriteCost
    const totalNetSaved = toolTruncationSaved + Math.max(0, netCacheBenefit)

    return {
      cacheRead,
      cacheWrite,
      cacheWriteCost,
      netCacheBenefit,
      toolTruncationSaved,
      truncatedCount,
      compactionCount,
      totalPromptTokens,
      totalCompletionTokens,
      totalNetSaved,
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
            {enabled() ? "Active (Enabled)" : "Disabled"}
          </text>
        </box>

        <box flexDirection="row" justifyContent="space-between">
          <text fg={theme.textMuted}>Tool output truncation (eliminated payload):</text>
          <text fg={theme.text}>
            <b>{stats().toolTruncationSaved.toLocaleString()}</b> tokens{" "}
            <span style={{ fg: theme.textMuted }}>({stats().truncatedCount} events)</span>
          </text>
        </box>

        <box flexDirection="row" justifyContent="space-between">
          <text fg={theme.textMuted}>Prompt cache read hits (reused without recomputing):</text>
          <text fg={theme.text}>
            <b>+{stats().cacheRead.toLocaleString()}</b> tokens
          </text>
        </box>

        <Show when={stats().cacheWrite > 0}>
          <box flexDirection="row" justifyContent="space-between">
            <text fg={theme.textMuted}>Prompt cache write expense (1.25x creation rate):</text>
            <text fg={theme.error}>
              -{stats().cacheWriteCost.toLocaleString()} tokens equivalent
            </text>
          </box>
        </Show>

        <box flexDirection="row" justifyContent="space-between">
          <text fg={theme.textMuted}>Context size reduction (compaction):</text>
          <text fg={theme.text}>
            <b>{stats().compactionCount}</b> runs{" "}
            <span style={{ fg: theme.textMuted }}>(* saved per future request)</span>
          </text>
        </box>

        <text fg={theme.borderSubtle}>{"─".repeat(78)}</text>

        <box flexDirection="row" justifyContent="space-between">
          <text fg={theme.text} attributes={TextAttributes.BOLD}>
            Net Verified Tokens Saved (Truncation + Net Cache):
          </text>
          <text fg={theme.success} attributes={TextAttributes.BOLD}>
            -{stats().totalNetSaved.toLocaleString()} tokens
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
