import { RGBA } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js"
import { useConfig } from "../config"
import { useData } from "../context/data"
import { COFFEE_AFTER, COFFEE_FOR, COLORS, activity, displayState, dominantColor, lastActivity, resolvePet, resolveState, screen } from "./pet-model"

export function Pet(props: { sessionID?: string }) {
  const config = useConfig().data
  const data = useData()
  const dimensions = useTerminalDimensions()
  const mountedAt = Date.now()

  const pet = createMemo(() => resolvePet(config.pet.active, config.pet.custom))
  const tinted = createMemo(() => {
    const current = pet()
    const color = config.pet.color
    if (!current || !color || color === "default") return current
    const hex = COLORS[color] ?? (/^#[0-9a-f]{6}$/i.test(color) ? color : undefined)
    const frame = current.states.idle[0]
    const char = frame ? dominantColor(frame) : undefined
    if (!hex || !char) return current
    return { ...current, palette: { ...current.palette, [char]: hex } }
  })
  const messages = createMemo(() => (props.sessionID ? data.session.message.list(props.sessionID) : []))
  const base = createMemo(() => {
    const pending = props.sessionID
      ? {
          permissions: data.session.permission.list(props.sessionID)?.length ?? 0,
          forms: data.session.form.list(props.sessionID)?.length ?? 0,
        }
      : { permissions: 0, forms: 0 }
    return resolveState(
      props.sessionID ? data.session.status(props.sessionID) : undefined,
      activity(messages()),
      pending,
    )
  })

  const [now, setNow] = createSignal(Date.now())
  createEffect(() => {
    if (!config.pet.enabled) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    onCleanup(() => clearInterval(timer))
  })

  const [workStart, setWorkStart] = createSignal<number>()
  const [coffeeUntil, setCoffeeUntil] = createSignal(0)
  createEffect(() => {
    const value = base()
    const stamp = now()
    if (value === "think" || value === "code") {
      if (workStart() === undefined) setWorkStart(stamp)
      return
    }
    const start = workStart()
    if (start === undefined) return
    setWorkStart(undefined)
    if (value === "idle" && stamp - start >= COFFEE_AFTER) setCoffeeUntil(stamp + COFFEE_FOR)
  })

  const state = createMemo(() =>
    displayState(base(), {
      now: now(),
      idleSince: lastActivity(messages()) ?? mountedAt,
      coffeeUntil: coffeeUntil(),
    }),
  )
  const frames = createMemo(() => pet()?.states[state()] ?? [])
  const [index, setIndex] = createSignal(0)

  createEffect(() => {
    const list = frames()
    setIndex(0)
    if (!(config.pet.animations && (config.animations ?? true)) || list.length < 2) return
    const timer = setInterval(() => setIndex((value) => (value + 1) % list.length), config.pet.interval[state()])
    onCleanup(() => clearInterval(timer))
  })

  const rows = createMemo(() => {
    const current = tinted()
    const frame = frames()[index()]
    if (!current || !frame) return []
    return screen(frame, current.palette).map((row) =>
      row.map((cell) => ({
        ch: cell.ch,
        fg: cell.fg ? RGBA.fromHex(cell.fg) : undefined,
        bg: cell.bg ? RGBA.fromHex(cell.bg) : undefined,
      })),
    )
  })

  return (
    <Show when={config.pet.enabled && dimensions().width >= 44 && rows().length > 0}>
      <box flexDirection="column" flexShrink={0}>
        <For each={rows()}>
          {(row) => (
            <box flexDirection="row">
              <For each={row}>{(cell) => <text fg={cell.fg} bg={cell.bg}>{cell.ch}</text>}</For>
            </box>
          )}
        </For>
      </box>
    </Show>
  )
}
