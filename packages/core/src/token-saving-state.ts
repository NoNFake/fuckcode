export * as TokenSavingState from "./token-saving-state"

import fs from "fs"
import path from "path"
import { Global } from "./global"

// The TUI runs in the CLI process while tools run in the worker, so a plain
// env var cannot carry the live toggle. Both sides share this state file.
const file = () => path.join(Global.Path.state, "token-saving.json")

export function read(): boolean | undefined {
  try {
    const parsed: Record<string, unknown> = JSON.parse(fs.readFileSync(file(), "utf-8"))
    return typeof parsed.enabled === "boolean" ? parsed.enabled : undefined
  } catch {
    return undefined
  }
}

export function write(enabled: boolean): void {
  try {
    fs.mkdirSync(path.dirname(file()), { recursive: true })
    const tmp = `${file()}.tmp`
    fs.writeFileSync(tmp, JSON.stringify({ enabled }))
    fs.renameSync(tmp, file())
  } catch {}
}
