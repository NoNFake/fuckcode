#!/usr/bin/env bun
import { Glob } from "bun"
import path from "path"
import fs from "fs"
import { fileURLToPath } from "url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")
const skillsRoot = path.join(root, ".fuckcode", "skills")
const outFile = path.join(root, "packages", "core", "src", "pentest", "skills.gen.ts")

const files = (await Array.fromAsync(new Glob("**/SKILL.md").scan({ cwd: skillsRoot, onlyFiles: true }))).toSorted()

const entries: Array<{ path: string; name: string; description: string; content: string }> = []
for (const file of files) {
  const text = fs.readFileSync(path.join(skillsRoot, file), "utf-8")
  const match = text.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!match) continue
  const name = match[1]
    .match(/^name:\s*(.+)$/m)?.[1]
    ?.trim()
    .replace(/^["']|["']$/g, "")
  const description = match[1]
    .match(/^description:\s*(.+)$/m)?.[1]
    ?.trim()
    .replace(/^["']|["']$/g, "")
  if (!name) continue
  entries.push({ path: file, name, description: description ?? "", content: text })
}

const body = entries
  .map(
    (entry) =>
      `  {\n    path: ${JSON.stringify(entry.path)},\n    name: ${JSON.stringify(entry.name)},\n    description: ${JSON.stringify(entry.description)},\n    content: ${JSON.stringify(entry.content)},\n  },`,
  )
  .join("\n")

fs.writeFileSync(outFile, `export const EMBEDDED_SKILLS = [\n${body}\n] as const\n`)
console.log(`embedded skills: ${entries.length} -> ${path.relative(root, outFile)}`)
