import { RGBA } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { createMemo, For, Show } from "solid-js"
import { useTuiConfig } from "../config"

interface Chunk {
  text: string
  fg?: RGBA
  bg?: RGBA
}

export interface BackgroundSettings {
  dim?: number // 0.0 - 1.0, e.g. 0.3 means 30% brightness
  mode?: "half" | "ascii" | "block" | "braille" | "sextant" | "all"
  color_mode?: "full" | "256" | "16" | "none"
  dither?: "none" | "ordered" | "diffusion" | "noise"
}

function findBackgroundDirectory(): string | undefined {
  let current = path.resolve(process.cwd())
  while (true) {
    if (existsSync(path.join(current, "background-image"))) {
      return path.join(current, "background-image")
    }
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }
  return undefined
}

function findBackgroundImage(): string | undefined {
  let current = path.resolve(process.cwd())
  while (true) {
    const candidates = [
      path.join(current, "background-image/background.jpg"),
      path.join(current, "background-image/background.png"),
      path.join(current, "background-image/background.jpeg"),
      path.join(current, "background-image/angel.jpg"),
      path.join(current, "background.jpg"),
      path.join(current, "background.png"),
      path.join(current, "background.jpeg"),
    ]
    const found = candidates.find(existsSync)
    if (found) return found
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }
  return undefined
}

function readBackgroundSettings(): BackgroundSettings {
  const dir = findBackgroundDirectory()
  if (!dir) return {}
  const configPath = path.join(dir, "background.json")
  if (!existsSync(configPath)) return {}
  try {
    return JSON.parse(readFileSync(configPath, "utf8")) as BackgroundSettings
  } catch {
    return {}
  }
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
      if (text.length > 0) {
        rowChunks.push({ text, fg: currFg, bg: currBg })
      }
      lastIndex = ansiRegex.lastIndex

      const codes = match[1].split(";").map(Number)
      for (let i = 0; i < codes.length; i++) {
        if (codes[i] === 0) {
          currFg = undefined
          currBg = undefined
        } else if (codes[i] === 38 && codes[i + 1] === 2) {
          currFg = applyDim(codes[i + 2], codes[i + 3], codes[i + 4])
          i += 4
        } else if (codes[i] === 48 && codes[i + 1] === 2) {
          currBg = applyDim(codes[i + 2], codes[i + 3], codes[i + 4])
          i += 4
        }
      }
    }
    const rem = line.slice(lastIndex)
    if (rem.length > 0) {
      rowChunks.push({ text: rem, fg: currFg, bg: currBg })
    }
    result.push(rowChunks)
  }
  return result
}

export function hasBackgroundImage(): boolean {
  return findBackgroundImage() !== undefined
}

export function Background() {
  const dimensions = useTerminalDimensions()
  const tuiConfig = useTuiConfig()

  const imagePath = createMemo(() => findBackgroundImage())
  const fileSettings = createMemo(() => readBackgroundSettings())

  const dim = createMemo(() => {
    const fromConfig = (tuiConfig as { background_dim?: number }).background_dim
    if (typeof fromConfig === "number") return Math.max(0, Math.min(1, fromConfig))
    if (typeof fileSettings().dim === "number") return Math.max(0, Math.min(1, fileSettings().dim!))
    return 1.0
  })

  const mode = createMemo(() => {
    const fromConfig = (tuiConfig as { background_mode?: string }).background_mode
    return fromConfig ?? fileSettings().mode ?? "half"
  })

  const dither = createMemo(() => {
    return fileSettings().dither ?? "none"
  })

  const rows = createMemo(() => {
    const file = imagePath()
    if (!file) return []
    const width = dimensions().width
    const height = dimensions().height
    if (width <= 0 || height <= 0) return []

    const chafaArgs = [
      "--format=symbols",
      `--symbols=${mode()}`,
      `--colors=${fileSettings().color_mode ?? "full"}`,
      `--dither=${dither()}`,
      "--size",
      `${width}x${height}`,
      file,
    ]

    const proc = spawnSync("chafa", chafaArgs)

    if (proc.status !== 0 || !proc.stdout) return []
    return parseAnsiChunks(proc.stdout.toString(), dim())
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
