import { Prompt, type PromptRef } from "../component/prompt"
import { createEffect, createMemo, createSignal, onMount, Show } from "solid-js"
import { Logo } from "../component/logo"
import { useSync } from "../context/sync"
import { Toast } from "../ui/toast"
import { useArgs } from "../context/args"
import { useRouteData } from "../context/route"
import { usePromptRef } from "../context/prompt"
import { useLocal } from "../context/local"
import { usePluginRuntime } from "../plugin/runtime"
import { useEditorContext } from "../context/editor"
import { useTerminalDimensions } from "@opentui/solid"
import { useTuiConfig } from "../config"
import { HomeSessionDestinationProvider } from "./home/session-destination"
import { useUpdateNotification } from "../context/update-notification"
import { useTheme } from "../context/theme"
import { useExit } from "../context/exit"

let once = false
const placeholder = {
  normal: [
    "Scan codebase for SQL injection and auth bypasses",
    "Audit API endpoints for IDOR, SSRF and broken ACL",
    "Find hardcoded credentials, JWT secrets and API keys",
    "Analyze attack surface and expose CVE vectors",
    "Review crypto implementation and token generation",
    "Write an exploit PoC for this vulnerability",
    "Audit memory safety and buffer overflow vectors",
    "Reverse engineer API logic and parameter pollution",
  ],
  shell: [
    "nmap -sV -sC -Pn target.local",
    "sqlmap -u 'http://target/api' --batch --dbs",
    "ffuf -u http://target/FUZZ -w wordlist.txt",
    "gobuster dir -u http://target -w /usr/share/wordlists/dirb/common.txt",
    "subfinder -d target.com | httpx -title",
    "nikto -h http://target.local",
  ],
}

export function Home() {
  const pluginRuntime = usePluginRuntime()
  const sync = useSync()
  const route = useRouteData("home")
  const promptRef = usePromptRef()
  const [ref, setRef] = createSignal<PromptRef | undefined>()
  const args = useArgs()
  const local = useLocal()
  const editor = useEditorContext()
  const dimensions = useTerminalDimensions()
  const tuiConfig = useTuiConfig()
  const [logoWidth, setLogoWidth] = createSignal(0)
  const promptMaxWidth = createMemo(() => {
    const configured = tuiConfig.prompt?.max_width
    if (configured === "auto") return Math.max(75, Math.floor(dimensions().width * 0.7))
    return configured ?? 75
  })
  let sent = false

  onMount(() => {
    editor.clearSelection()
  })

  const bind = (r: PromptRef | undefined) => {
    setRef(r)
    promptRef.set(r)
    if (once || !r) return
    if (route.prompt) {
      r.set(route.prompt)
      once = true
      return
    }
    if (!args.prompt) return
    r.set({ input: args.prompt, parts: [] })
    once = true
  }

  // Wait for sync and model store to be ready before auto-submitting --prompt
  createEffect(() => {
    const r = ref()
    if (sent) return
    if (!r) return
    if (!sync.ready || !local.model.ready) return
    if (!args.prompt) return
    if (r.current.input !== args.prompt) return
    sent = true
    r.submit()
  })

  return (
    <HomeSessionDestinationProvider>
      <box flexGrow={1} alignItems="center" paddingLeft={2} paddingRight={2}>
        <box flexGrow={1} minHeight={0} />
        <box height={4} minHeight={0} flexShrink={1} />
        <box
          flexShrink={0}
          onSizeChange={function () {
            setLogoWidth(this.width)
          }}
        >
          <pluginRuntime.Slot name="home_logo" mode="replace">
            <Logo />
          </pluginRuntime.Slot>
        </box>
        <box height={1} minHeight={0} flexShrink={1} />
        <UpdateNotification width={logoWidth()} />
        <box width="100%" maxWidth={promptMaxWidth()} zIndex={1000} paddingTop={1} flexShrink={0}>
          <pluginRuntime.Slot name="home_prompt" mode="replace" ref={bind}>
            <Prompt ref={bind} right={<pluginRuntime.Slot name="home_prompt_right" />} placeholders={placeholder} />
          </pluginRuntime.Slot>
        </box>
        <pluginRuntime.Slot name="home_bottom" />
        <box flexGrow={1} minHeight={0} />
        <Toast />
      </box>
      <box width="100%" flexShrink={0}>
        <pluginRuntime.Slot name="home_footer" mode="single_winner" />
      </box>
    </HomeSessionDestinationProvider>
  )
}

function UpdateNotification(props: { width: number }) {
  const update = useUpdateNotification()
  const exit = useExit()
  const { theme } = useTheme()
  const [hovered, setHovered] = createSignal(false)
  createEffect(() => {
    update.notification()
    setHovered(false)
  })

  return (
    <Show when={update.notification()} keyed>
      {(state) => (
        <box
          flexShrink={0}
          flexDirection="row"
          justifyContent="center"
          width={props.width}
          maxWidth="100%"
          gap={1}
          backgroundColor={hovered() ? theme.backgroundElement : undefined}
          onMouseOver={() => setHovered(true)}
          onMouseOut={() => setHovered(false)}
          onMouseUp={() => {
            if (state.type === "installed") return exit()
            update.open?.()
          }}
        >
          <text fg={theme.textMuted}>
            <span style={{ fg: theme.primary }}>{state.type === "installed" ? "/exit" : "/update"}</span>
            {state.type === "available"
              ? ` to install v${state.version}`
              : state.type === "major"
                ? " to upgrade to OpenCode 2.0"
                : state.target.type === "major"
                  ? " restart to use OpenCode 2.0"
                  : ` restart to use v${state.target.version}`}
          </text>
        </box>
      )}
    </Show>
  )
}
