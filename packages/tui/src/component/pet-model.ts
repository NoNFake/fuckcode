import { Schema } from "effect"
import { BUILTIN, BUILTIN_IDS } from "./pet-builtins"

export const STATES = ["idle", "think", "code", "alert", "sleep", "coffee"] as const
export type PetState = (typeof STATES)[number]

export const SLEEP_AFTER = 90_000
export const COFFEE_AFTER = 20_000
export const COFFEE_FOR = 8_000

export const DEFAULT_INTERVAL: Record<PetState, number> = {
  idle: 1300,
  think: 320,
  code: 170,
  alert: 500,
  sleep: 1800,
  coffee: 300,
}

export interface PetDefinition extends Schema.Schema.Type<typeof PetDefinition> {}
export const PetDefinition = Schema.Struct({
  palette: Schema.Record(Schema.String, Schema.String),
  states: Schema.Record(Schema.String, Schema.Array(Schema.Array(Schema.String))),
})

export interface PetOptions extends Schema.Schema.Type<typeof PetOptions> {}
export const PetOptions = Schema.Struct({
  enabled: Schema.optional(Schema.Boolean),
  active: Schema.optional(Schema.String),
  interval: Schema.optional(
    Schema.Struct({
      idle: Schema.optional(Schema.Int),
      think: Schema.optional(Schema.Int),
      code: Schema.optional(Schema.Int),
      alert: Schema.optional(Schema.Int),
      sleep: Schema.optional(Schema.Int),
      coffee: Schema.optional(Schema.Int),
    }),
  ),
  custom: Schema.optional(Schema.Record(Schema.String, PetDefinition)),
})

export type ResolvedPet = {
  palette: Record<string, string>
  states: Record<PetState, readonly (readonly string[])[]>
}

export type PetCell = {
  ch: string
  fg?: string
  bg?: string
}

type MessageLike = {
  type?: string
  error?: unknown
  time?: Record<string, number | undefined>
  content?: readonly PartLike[]
}

type PartLike = {
  type?: string
  text?: string
  time?: { completed?: number }
  state?: { status?: string }
}

export type Activity = {
  runningTool: boolean
  streamingText: boolean
  streamingReasoning: boolean
  toolError: boolean
}

const HEX = /^#[0-9a-f]{6}$/i

// Scans the current turn from the end. A user message closes the turn, so an
// old tool error does not keep the pet upset after the next prompt.
export function activity(messages: readonly MessageLike[]): Activity {
  const result: Activity = {
    runningTool: false,
    streamingText: false,
    streamingReasoning: false,
    toolError: false,
  }
  for (const message of messages.toReversed()) {
    if (message.type !== "assistant") break
    if (message.error) result.toolError = true
    const streaming = message.time?.streamed === undefined
    for (const part of message.content ?? []) {
      if (part.type === "tool") {
        const status = part.state?.status
        if (status === "running" || status === "streaming") result.runningTool = true
        if (status === "error") result.toolError = true
      }
      if (part.type === "text" && streaming && part.text) result.streamingText = true
      if (part.type === "reasoning" && streaming && part.time?.completed === undefined)
        result.streamingReasoning = true
    }
  }
  return result
}

export function resolveState(
  status: string | undefined,
  flags: Activity,
  pending: { permissions: number; forms: number },
): PetState {
  if (pending.permissions > 0 || pending.forms > 0 || status === "retry" || flags.toolError) return "alert"
  if (!status || status === "idle") return "idle"
  if (flags.runningTool || flags.streamingText) return "code"
  return "think"
}

export function lastActivity(messages: readonly MessageLike[]): number | undefined {
  let latest: number | undefined
  for (const message of messages) {
    const stamp = message.time?.completed ?? message.time?.streamed ?? message.time?.created
    if (stamp !== undefined && (latest === undefined || stamp > latest)) latest = stamp
  }
  return latest
}

// Coffee wins over sleep for a few seconds after a long turn, then idle falls
// back to sleep once nothing happened for a while.
export function displayState(
  base: PetState,
  input: { now: number; idleSince: number; coffeeUntil: number },
): PetState {
  if (base !== "idle") return base
  if (input.coffeeUntil > input.now) return "coffee"
  if (input.now - input.idleSince >= SLEEP_AFTER) return "sleep"
  return "idle"
}

export function resolvePet(name: string, custom: Record<string, PetDefinition> | undefined): ResolvedPet | undefined {
  const candidate = custom?.[name]
  const chosen = candidate ? parsePet(candidate) : undefined
  return chosen ?? parsePet(BUILTIN[name] ?? BUILTIN[BUILTIN_IDS[0]])
}

export function parsePet(definition: PetDefinition): ResolvedPet | undefined {
  const palette = Object.fromEntries(
    Object.entries(definition.palette).filter(([key, value]) => key.length === 1 && HEX.test(value)),
  )
  const states = {} as Record<PetState, readonly (readonly string[])[]>
  for (const state of STATES) {
    const frames = (definition.states[state] ?? []).filter((frame) => validFrame(frame, palette))
    if (frames.length) states[state] = frames
  }
  if (!states.idle?.length) return undefined
  for (const state of STATES) states[state] ??= states.idle
  return { palette, states }
}

function validFrame(frame: readonly string[], palette: Record<string, string>) {
  if (frame.length === 0 || frame.length % 2 !== 0) return false
  const width = frame[0]!.length
  if (width < 2 || width > 32) return false
  if (!frame.every((row) => row.length === width)) return false
  return frame.every((row) => [...row].every((char) => char === "." || char in palette))
}

// Two pixel rows become one terminal row: top half in fg, bottom half in bg.
export function screen(frame: readonly string[], palette: Record<string, string>): PetCell[][] {
  const width = frame[0]?.length ?? 0
  const rows: PetCell[][] = []
  for (let y = 0; y < frame.length / 2; y++) {
    const top = frame[y * 2]!
    const bottom = frame[y * 2 + 1]!
    const row: PetCell[] = []
    for (let x = 0; x < width; x++) {
      const fg = palette[top[x]!]
      const bg = palette[bottom[x]!]
      if (fg && bg) row.push({ ch: "▀", fg, bg })
      else if (fg) row.push({ ch: "▀", fg })
      else if (bg) row.push({ ch: "▄", fg: bg })
      else row.push({ ch: " " })
    }
    while (row.length > 0 && row[row.length - 1]!.ch === " ") row.pop()
    rows.push(row)
  }
  return rows
}
