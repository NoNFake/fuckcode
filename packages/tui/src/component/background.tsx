import { RGBA } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { createMemo, For, Show } from "solid-js"
import { useTuiConfig } from "../config"
import { DEFAULT_BACKGROUND_BASE64 } from "./default-background"

interface Chunk {
  text: string
  fg?: RGBA
  bg?: RGBA
}

export interface BackgroundSettings {
  dim?: number
  mode?: "half" | "ascii" | "block" | "braille" | "sextant" | "all"
  color_mode?: "full" | "256" | "16" | "none"
  dither?: "none" | "ordered" | "diffusion" | "noise"
}

const CANDIDATES = [
  "background-image/background.jpg",
  "background-image/background.png",
  "background-image/background.jpeg",
  "background.jpg",
  "background.png",
  "background.jpeg",
]

let defaultBuffer: Buffer | undefined
function getDefaultBackgroundBuffer(): Buffer {
  if (!defaultBuffer) {
    defaultBuffer = Buffer.from(DEFAULT_BACKGROUND_BASE64, "base64")
  }
  return defaultBuffer
}

let hasChafaCache: boolean | undefined
function isChafaAvailable(): boolean {
  if (hasChafaCache !== undefined) return hasChafaCache
  try {
    const res = spawnSync("chafa", ["--version"])
    hasChafaCache = !res.error && res.status === 0
  } catch {
    hasChafaCache = false
  }
  return hasChafaCache
}

function findBackgroundImage(): string | undefined {
  let current = path.resolve(process.cwd())
  while (true) {
    for (const rel of CANDIDATES) {
      const full = path.join(current, rel)
      if (existsSync(full)) return full
    }
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }

  const home = os.homedir()
  const globalDirs = [
    path.join(home, ".config/fuckcode"),
    path.join(home, ".config/fuckcode/background-image"),
    path.join(home, ".config/opencode"),
    path.join(home, ".config/opencode/background-image"),
  ]
  for (const dir of globalDirs) {
    for (const ext of ["jpg", "png", "jpeg"]) {
      const file = path.join(dir, `background.${ext}`)
      if (existsSync(file)) return file
    }
  }

  return undefined
}

function readBackgroundSettings(imagePath?: string): BackgroundSettings {
  if (!imagePath) return {}
  const configPath = path.join(path.dirname(imagePath), "background.json")
  if (!existsSync(configPath)) return {}
  try {
    return JSON.parse(readFileSync(configPath, "utf8")) as BackgroundSettings
  } catch {
    return {}
  }
}

function sameColor(a?: RGBA, b?: RGBA): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a
}

function pushChunk(row: Chunk[], text: string, fg?: RGBA, bg?: RGBA) {
  if (!text) return
  const last = row[row.length - 1]
  if (last && sameColor(last.fg, fg) && sameColor(last.bg, bg)) {
    last.text += text
    return
  }
  row.push({ text, fg, bg })
}

function parseAnsiChunks(ansi: string, dim: number): Chunk[][] {
  const clean = ansi.replace(/\x1b\[\?25[lh]/g, "").trimEnd()
  const lines = clean.split("\n")
  const result: Chunk[][] = []
  const ansiRegex = /\x1b\[([0-9;]+)m/g

  const applyDim = (r: number, g: number, b: number): RGBA => {
    return RGBA.fromInts(
      Math.round(r * dim),
      Math.round(g * dim),
      Math.round(b * dim),
      255,
    )
  }

  for (const line of lines) {
    let currFg: RGBA | undefined
    let currBg: RGBA | undefined
    let lastIndex = 0
    let match: RegExpExecArray | null
    const rowChunks: Chunk[] = []

    ansiRegex.lastIndex = 0
    while ((match = ansiRegex.exec(line)) !== null) {
      const text = line.slice(lastIndex, match.index)
      pushChunk(rowChunks, text, currFg, currBg)
      lastIndex = ansiRegex.lastIndex

      const codes = match[1].split(";").map(Number)
      for (let i = 0; i < codes.length; i++) {
        const code = codes[i]
        if (code === 0) {
          currFg = undefined
          currBg = undefined
        } else if (code === 39) {
          currFg = undefined
        } else if (code === 49) {
          currBg = undefined
        } else if (code === 38 && codes[i + 1] === 2) {
          currFg = applyDim(codes[i + 2], codes[i + 3], codes[i + 4])
          i += 4
        } else if (code === 48 && codes[i + 1] === 2) {
          currBg = applyDim(codes[i + 2], codes[i + 3], codes[i + 4])
          i += 4
        }
      }
    }
    const rem = line.slice(lastIndex)
    pushChunk(rowChunks, rem, currFg, currBg)
    result.push(rowChunks)
  }
  return result
}

export function hasBackgroundImage(): boolean {
  return isChafaAvailable()
}

export function Background() {
  const dimensions = useTerminalDimensions()
  const tuiConfig = useTuiConfig()

  if (tuiConfig.background_enabled === false || !isChafaAvailable()) {
    return null
  }

  const customImagePath = createMemo(() => findBackgroundImage())
  const fileSettings = createMemo(() => readBackgroundSettings(customImagePath()))

  const dim = createMemo(() => {
    if (typeof tuiConfig.background_dim === "number") return Math.max(0, Math.min(1, tuiConfig.background_dim))
    if (typeof fileSettings().dim === "number") return Math.max(0, Math.min(1, fileSettings().dim!))
    return 0.35
  })

  const mode = createMemo(() => {
    return tuiConfig.background_mode ?? fileSettings().mode ?? "half"
  })

  const dither = createMemo(() => {
    return fileSettings().dither ?? "none"
  })

  let lastKey = ""
  let lastResult: Chunk[][] = []

  const rows = createMemo(() => {
    const width = dimensions().width
    const height = dimensions().height
    if (width <= 0 || height <= 0) return []

    const file = customImagePath()
    const m = mode()
    const d = dither()
    const c = fileSettings().color_mode ?? "full"
    const brightness = dim()
    const target = file ?? "embedded"
    const key = `${target}:${width}x${height}:${m}:${c}:${d}:${brightness}`
    if (key === lastKey) return lastResult

    try {
      const chafaArgs = [
        "--format=symbols",
        `--symbols=${m}`,
        `--colors=${c}`,
        `--dither=${d}`,
        "--size",
        `${width}x${height}`,
        file ? file : "-",
      ]
      const proc = spawnSync("chafa", chafaArgs, {
        input: file ? undefined : getDefaultBackgroundBuffer(),
      })
      if (proc.error || proc.status !== 0 || !proc.stdout) return []
      lastKey = key
      lastResult = parseAnsiChunks(proc.stdout.toString(), brightness)
      return lastResult
    } catch {
      return []
    }
  })

  return (
    <Show when={rows().length > 0}>
      <box
        position="absolute"
        top={0}
        left={0}
        width={dimensions().width}
        height={dimensions().height}
        zIndex={0}
      >
        <For each={rows()}>
          {(row) => (
            <box flexDirection="row">
              <For each={row}>
                {(chunk) => (
                  <text fg={chunk.fg} bg={chunk.bg}>
                    {chunk.text}
                  </text>
                )}
              </For>
            </box>
          )}
        </For>
      </box>
    </Show>
  )
}
