export type VerifyReport = {
  unverified: string[]
  notFound: number
}

const URL = /https?:\/\/\S+/g

// Paths with a slash, and bare filenames with a known extension. Both may
// carry an optional :line suffix.
const SLASH_REF = /(?:[\w.@-]+\/)+[\w.@-]+\.\w{1,10}(?::\d+)?/g
const BARE_REF =
  /\b[\w.@-]+\.(?:ts|tsx|js|jsx|mjs|cjs|py|go|rs|rb|java|kt|php|json|jsonc|yaml|yml|toml|md|sql|sh|bash|zsh|c|cc|cpp|h|hpp|cs|swift|vue|svelte|astro|css|scss|html|xml)(?::\d+)?\b/g

const NOT_FOUND =
  /not found|no such file|does not exist|doesn't exist|ENOENT|unknown (?:symbol|command|tool)|cannot find|unable to locate/i

type AnyRecord = Record<string, any>

function toolParts(parts: ReadonlyArray<unknown>): AnyRecord[] {
  return parts.filter((part): part is AnyRecord => {
    if (!part || typeof part !== "object") return false
    return (part as AnyRecord).type === "tool"
  })
}

const seenCache = new WeakMap<object, string>()
const refsCache = new WeakMap<object, string[]>()

function assistantRefs(part: unknown): string[] {
  if (!part || typeof part !== "object") return []
  const cached = refsCache.get(part)
  if (cached) return cached
  const item = part as AnyRecord
  const found: string[] = []
  if (item.type === "text" && typeof item.text === "string") {
    const clean = item.text.replace(URL, " ")
    for (const match of clean.matchAll(SLASH_REF)) found.push(match[0])
    for (const match of clean.matchAll(BARE_REF)) found.push(match[0])
  }
  refsCache.set(part, found)
  return found
}

function seenText(part: AnyRecord): string {
  const cached = seenCache.get(part)
  if (cached !== undefined) return cached
  const state = part.state
  if (!state || typeof state !== "object") {
    seenCache.set(part, "")
    return ""
  }
  const chunks: string[] = []
  if (state.input) chunks.push(JSON.stringify(state.input))
  if (typeof state.output === "string") chunks.push(state.output)
  if (typeof state.error === "string") chunks.push(state.error)
  const display = state.metadata?.display
  if (display && typeof display.path === "string") chunks.push(display.path)
  const text = chunks.join("\n")
  seenCache.set(part, text)
  return text
}

export function verify(input: {
  messages: ReadonlyArray<unknown>
  partsOf: (message: unknown) => ReadonlyArray<unknown>
}): VerifyReport {
  const refs = new Set<string>()
  const seen: string[] = []
  let notFound = 0

  for (const message of input.messages) {
    if (!message || typeof message !== "object") continue
    const item = message as AnyRecord
    const parts = input.partsOf(message)
    const tools = toolParts(parts)
    for (const part of tools) {
      seen.push(seenText(part))
      const state = part.state
      if (
        state &&
        typeof state === "object" &&
        state.status === "error" &&
        typeof state.error === "string" &&
        NOT_FOUND.test(state.error)
      ) {
        notFound++
      }
    }
    if (item.role !== "assistant") continue
    for (const part of parts) {
      for (const ref of assistantRefs(part)) refs.add(ref)
    }
  }

  const unverified: string[] = []
  for (const ref of refs) {
    const base = ref.split(":")[0].split("/").pop() ?? ref
    const found = seen.some((text) => text.includes(ref) || text.includes(base))
    if (!found) unverified.push(ref)
  }
  return { unverified: unverified.slice(0, 50), notFound }
}
