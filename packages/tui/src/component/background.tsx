import { RGBA } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"
import { createMemo, For, Show } from "solid-js"

interface Chunk {
  text: string
  fg?: RGBA
  bg?: RGBA
}

function findBackgroundImage(): string | undefined {
  const candidates = [
    path.resolve(process.cwd(), "background-image/background.jpg"),
    path.resolve(process.cwd(), "background-image/background.png"),
    path.resolve(process.cwd(), "background-image/angel.jpg"),
    path.resolve(process.cwd(), "background.jpg"),
    path.resolve(process.cwd(), "background.png"),
  ]
  return candidates.find(existsSync)
}

function parseAnsiChunks(ansi: string): Chunk[][] {
  const clean = ansi.replace(/\x1b\[\?25[lh]/g, "").trimEnd()
  const lines = clean.split("\n")
  const result: Chunk[][] = []
  const ansiRegex = /\x1b\[([0-9;]+)m/g

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
          currFg = RGBA.fromInts(codes[i + 2], codes[i + 3], codes[i + 4], 255)
          i += 4
        } else if (codes[i] === 48 && codes[i + 1] === 2) {
          currBg = RGBA.fromInts(codes[i + 2], codes[i + 3], codes[i + 4], 255)
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
  const imagePath = createMemo(() => findBackgroundImage())

  const rows = createMemo(() => {
    const file = imagePath()
    if (!file) return []
    const width = dimensions().width
    const height = dimensions().height
    if (width <= 0 || height <= 0) return []

    const proc = spawnSync("chafa", [
      "--format=symbols",
      "--symbols=half",
      "--colors=full",
      "--size",
      `${width}x${height}`,
      file,
    ])

    if (proc.status !== 0 || !proc.stdout) return []
    return parseAnsiChunks(proc.stdout.toString())
  })

  return (
    <Show when={rows().length > 0}>
      <box
        position="absolute"
        top={0}
        left={0}
        width={dimensions().width}
        height={dimensions().height}
        zIndex={-1}
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
