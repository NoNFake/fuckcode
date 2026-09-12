export * as TokenSavingState from "./token-saving-state"

import fs from "fs"
import path from "path"
import { Global } from "./global"

// The TUI runs in the CLI process while tools run in the worker, so a plain
// env var cannot carry the live toggle. Both sides share this state file.
const file = () => path.join(Global.Path.state, "token-saving.json")

let cache: { mtime: number; value: boolean | undefined } | undefined

export function read(): boolean | undefined {
  try {
    const mtime = fs.statSync(file()).mtimeMs
    if (cache && cache.mtime === mtime) return cache.value
    const parsed: Record<string, unknown> = JSON.parse(fs.readFileSync(file(), "utf-8"))
    const value = typeof parsed.enabled === "boolean" ? parsed.enabled : undefined
    cache = { mtime, value }
    return value
  } catch {
    return undefined
  }
}

// Precedence: explicit env wins, otherwise the live TUI toggle in the state file.
export function enabled(): boolean {
  return (
    process.env.FUCKCODE_TOKEN_SAVING === "1" ||
    (process.env.FUCKCODE_TOKEN_SAVING !== "0" && read() === true)
  )
}

export function write(enabled: boolean): void {
  try {
    fs.mkdirSync(path.dirname(file()), { recursive: true })
    const tmp = `${file()}.tmp`
    fs.writeFileSync(tmp, JSON.stringify({ enabled }))
    fs.renameSync(tmp, file())
    cache = undefined
  } catch {}
}
