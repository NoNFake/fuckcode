import { describe, expect, test } from "bun:test"
import path from "path"
import fs from "fs"
import { Token } from "@opencode-ai/core/util/token"
import { EMBEDDED_SKILLS } from "../../src/skill/embedded.gen"

const root = path.resolve(import.meta.dir, "../..")

// Tool-call-shaped words that skills must not invent. Real tools are declared
// with Tool.define("<id>") under src; anything ending in a parse/analyze verb
// or prefixed add_/record_ that is not registered is a hallucinated tool name.
const PHANTOM_SUFFIX = /_(parse|analyze|spray|detect|lookup)$/
const PHANTOM_PREFIX = /^(add|record)_/

const ROE_MARKER = "Rules of Engagement"

// Skills whose offline/coding nature does not warrant the pentest ROE block.
const ROE_EXEMPT = new Set(["effect"])

// Ratchet over the current catalog (~39.6k tokens). Bump deliberately when the
// catalog genuinely grows; this catches prompt-bloat regressions.
const BODY_BUDGET = 42_000

function registeredTools() {
  const names = new Set<string>(["bash", "read", "write", "edit", "glob", "grep", "task", "webfetch", "websearch"])
  for (const file of new Bun.Glob("src/**/*.ts").scanSync({ cwd: root, onlyFiles: true })) {
    const text = fs.readFileSync(path.join(root, file), "utf-8")
    for (const match of text.matchAll(/Tool\.define\(\s*"([a-z_]+)"/g)) names.add(match[1])
  }
  return names
}

function bodies() {
  return Object.entries(EMBEDDED_SKILLS).map(([file, content]) => {
    const name = content.match(/^name:\s*(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "") ?? file
    return { file, name, content }
  })
}

function phantomRefs(content: string, registered: Set<string>) {
  const refs = new Set<string>()
  for (const match of content.matchAll(/`([a-z][a-z0-9_]*)`/g)) {
    const word = match[1]
    if (registered.has(word)) continue
    if (PHANTOM_SUFFIX.test(word) || PHANTOM_PREFIX.test(word)) refs.add(word)
  }
  return [...refs]
}

describe("eval: skill quality", () => {
  test("skills have unique names", () => {
    const list = bodies()
    const names = list.map((s) => s.name)
    expect(new Set(names).size).toBe(names.length)
  })

  test("skills never reference unregistered tools", () => {
    const registered = registeredTools()
    const refs = bodies().flatMap((s) => phantomRefs(s.content, registered).map((tool) => `${s.name}:${tool}`))
    console.log(`METRIC skill_phantom_refs=${refs.length}`)
    expect(refs).toEqual([])
  })

  test("offensive skills carry a rules-of-engagement block", () => {
    const missing = bodies()
      .filter((s) => !ROE_EXEMPT.has(s.name))
      .filter((s) => !s.content.includes(ROE_MARKER))
      .map((s) => s.name)
    console.log(`METRIC skill_missing_roe=${missing.length}`)
    expect(missing).toEqual([])
  })

  test("skills drop converted-course boilerplate", () => {
    const bad = bodies()
      .filter((s) => /^## (Metadata|Trigger Phrases|Instructions for Claude|Full Methodology)$/m.test(s.content))
      .map((s) => s.name)
    console.log(`METRIC skill_boilerplate=${bad.length}`)
    expect(bad).toEqual([])
  })

  test("skills do not pipe remote scripts into a shell", () => {
    const bad = bodies()
      .filter((s) => /\|\s*(sh|bash)\b/.test(s.content))
      .map((s) => s.name)
    console.log(`METRIC skill_pipe_to_shell=${bad.length}`)
    expect(bad).toEqual([])
  })

  test("skill bodies stay within the aggregate token budget", () => {
    const list = bodies()
    const measured = list.map((s) => ({ name: s.name, tokens: Token.estimate(s.content) }))
    const total = measured.reduce((sum, s) => sum + s.tokens, 0)
    console.log(`METRIC skill_body_tokens=${total}`)
    console.log(`METRIC skill_tokens_csv=${measured.map((s) => `${s.name}:${s.tokens}`).join(",")}`)
    expect(total).toBeLessThanOrEqual(BODY_BUDGET)
  })
})
