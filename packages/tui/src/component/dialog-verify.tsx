import { For, onMount, Show } from "solid-js"
import { useTheme } from "../context/theme"
import { useDialog } from "../ui/dialog"

export function DialogVerify(props: { report: { unverified: string[]; notFound: number } }) {
  const { theme } = useTheme()
  const dialog = useDialog()

  onMount(() => {
    dialog.setSize("large")
  })

  return (
    <box paddingLeft={2} paddingRight={2} gap={1} paddingBottom={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={theme.text}>
          <b>Unverified claims</b>
        </text>
        <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
          esc
        </text>
      </box>
      <text fg={theme.textMuted}>
        Not proof of hallucination. These references have no matching tool result; verify before trusting.
      </text>
      <Show when={props.report.notFound > 0}>
        <text fg={theme.error}>{props.report.notFound} tool error(s) looked like "not found".</text>
      </Show>
      <Show
        when={props.report.unverified.length > 0}
        fallback={<text fg={theme.success}>No unverified file references.</text>}
      >
        <For each={props.report.unverified}>{(ref) => <text fg={theme.warning}>{ref}</text>}</For>
      </Show>
    </box>
  )
}
