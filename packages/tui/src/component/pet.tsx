import { RGBA } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js"
import { useConfig } from "../config"
import { useData } from "../context/data"
import { activity, resolvePet, resolveState, screen } from "./pet-model"

export function Pet(props: { sessionID?: string }) {
  const config = useConfig().data
  const data = useData()
  const dimensions = useTerminalDimensions()

  const pet = createMemo(() => resolvePet(config.pet.active, config.pet.custom))
  const state = createMemo(() => {
    const pending = props.sessionID
      ? {
          permissions: data.session.permission.list(props.sessionID)?.length ?? 0,
          forms: data.session.form.list(props.sessionID)?.length ?? 0,
        }
      : { permissions: 0, forms: 0 }
    const messages = props.sessionID ? data.session.message.list(props.sessionID) : []
    return resolveState(props.sessionID ? data.session.status(props.sessionID) : undefined, activity(messages), pending)
  })
  const frames = createMemo(() => pet()?.states[state()] ?? [])
  const [index, setIndex] = createSignal(0)

  createEffect(() => {
    const list = frames()
    setIndex(0)
    if (!(config.animations ?? true) || list.length < 2) return
    const timer = setInterval(() => setIndex((value) => (value + 1) % list.length), config.pet.interval[state()])
    onCleanup(() => clearInterval(timer))
  })

  const rows = createMemo(() => {
    const current = pet()
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
