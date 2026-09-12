import { describe, expect, it } from "bun:test"
import fs from "fs"
import path from "path"
import { EMBEDDED_SKILLS } from "./embedded.gen"
import { materializeEmbeddedSkills } from "./index"

describe("embedded skills", () => {
  it("ships the offensive skill catalog", () => {
    const entries = Object.entries(EMBEDDED_SKILLS)
    expect(entries.length).toBeGreaterThanOrEqual(40)

    for (const [relative, content] of entries) {
      expect(relative.endsWith("SKILL.md")).toBe(true)
      expect(relative.includes("..")).toBe(false)
      expect(content).toContain("name:")
    }
  })

  it("includes the web and phases skills", () => {
    expect(EMBEDDED_SKILLS["web/sqli/SKILL.md"]).toBeDefined()
    expect(EMBEDDED_SKILLS["phases/recon/SKILL.md"]).toBeDefined()
  })

  it("materializes every embedded skill to disk", () => {
    const root = materializeEmbeddedSkills()
    expect(fs.existsSync(path.join(root, "web/sqli/SKILL.md"))).toBe(true)
    expect(fs.readFileSync(path.join(root, "web/sqli/SKILL.md"), "utf-8")).toBe(EMBEDDED_SKILLS["web/sqli/SKILL.md"])
  })
})
