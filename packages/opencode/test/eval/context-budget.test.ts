import { describe, expect, test } from "bun:test"
import path from "path"
import fs from "fs"
import { Token } from "@opencode-ai/core/util/token"
import { EMBEDDED_SKILLS } from "../../src/skill/embedded.gen"

// Static ceilings with headroom over current measurements. Bump deliberately
// when the catalog genuinely grows; this catches prompt-bloat regressions.
// Upgrade path: split into per-surface budgets if the prompt grows more.
const BUDGET = {
  skillCompact: 1900,
  skillVerbose: 2600,
  skillDescription: 60,
  toolDescriptions: 1800,
}

const root = path.resolve(import.meta.dir, "../..")

function frontmatter(content: string) {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {} as Record<string, string>
  const out: Record<string, string> = {}
  for (const line of match[1].split("\n")) {
    const index = line.indexOf(":")
    if (index < 0) continue
    out[line.slice(0, index).trim()] = line
      .slice(index + 1)
      .trim()
      .replace(/^["']|["']$/g, "")
  }
  return out
}

function skills() {
  return Object.values(EMBEDDED_SKILLS)
    .map((content) => frontmatter(content))
    .map((data) => ({ name: data.name, description: data.description }))
}

function compactGuidance(list: { name: string; description: string }[]) {
  return ["## Available Skills", ...list.map((s) => `- **${s.name}**: ${s.description}`)].join("\n")
}

function verboseGuidance(list: { name: string; description: string }[]) {
  return [
    "<available_skills>",
    ...list.flatMap((s) => [
      "  <skill>",
      `    <name>${s.name}</name>`,
      `    <description>${s.description}</description>`,
      "  </skill>",
    ]),
    "</available_skills>",
  ].join("\n")
}

function toolDescriptions() {
  const files = Array.from(new Bun.Glob("src/tool/**/*.txt").scanSync({ cwd: root, onlyFiles: true }))
  let total = 0
  for (const file of files) total += Token.estimate(fs.readFileSync(path.join(root, file), "utf-8"))
  return { files: files.length, total }
}

describe("eval: context budget", () => {
  test("skill catalog is intact", () => {
    const list = skills()
    const names = list.map((s) => s.name)
    expect(names.length).toBeGreaterThanOrEqual(30)
    expect(new Set(names).size).toBe(names.length)
    expect(list.every((s) => typeof s.description === "string" && s.description.length > 0)).toBe(true)
  })

  test("every skill description stays within budget", () => {
    const over = skills()
      .map((s) => ({ name: s.name, tokens: Token.estimate(s.description) }))
      .filter((s) => s.tokens > BUDGET.skillDescription)
    expect(over).toEqual([])
  })

  test("skill guidance stays within budget", () => {
    const list = skills().toSorted((a, b) => a.name.localeCompare(b.name))
    const compact = Token.estimate(compactGuidance(list))
    const verbose = Token.estimate(verboseGuidance(list))
    console.log(`eval:context skills=${list.length} compact=${compact} verbose=${verbose}`)
    expect(compact).toBeLessThanOrEqual(BUDGET.skillCompact)
    expect(verbose).toBeLessThanOrEqual(BUDGET.skillVerbose)
  })

  test("tool descriptions stay within budget", () => {
    const result = toolDescriptions()
    console.log(`eval:context toolDescriptions files=${result.files} tokens=${result.total}`)
    expect(result.total).toBeLessThanOrEqual(BUDGET.toolDescriptions)
  })
})
