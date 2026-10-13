#!/usr/bin/env bun

import { $ } from "bun"
import { cp, mkdir, readdir, rm } from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"

const rootDir = fileURLToPath(new URL("..", import.meta.url))
process.chdir(rootDir)

const args = process.argv.slice(2)
const all = args.includes("--all")
const skipInstall = args.includes("--skip-install")

const distDir = path.join(rootDir, "dist")
const cliDir = path.join(rootDir, "packages", "cli")
const staging = path.join(distDir, ".staging")

await rm(distDir, { recursive: true, force: true })
await mkdir(staging, { recursive: true })

const buildArgs = [`--outdir=${distDir}`]
if (!all) buildArgs.push("--single")
if (skipInstall) buildArgs.push("--skip-install")
console.log(`=== build ${all ? "all platforms" : "current platform"} (version ${process.env.OPENCODE_VERSION ?? "auto"}) ===`)
await $`bun run script/build.ts ${buildArgs}`.cwd(cliDir)

const entries = await readdir(distDir, { withFileTypes: true })
let packaged = 0
for (const entry of entries) {
  if (!entry.isDirectory() || !entry.name.startsWith("cli-")) continue
  const suffix = entry.name.slice("cli-".length)
  const isWindows = suffix.startsWith("windows")
  const source = path.join(distDir, entry.name, "bin", isWindows ? "opencode.exe" : "opencode")
  if (!(await Bun.file(source).exists())) continue
  const inner = isWindows ? "fuckcode.exe" : "fuckcode"
  const staged = path.join(staging, inner)
  await cp(source, staged)
  if (!isWindows) await $`chmod 755 ${staged}`
  if (suffix.startsWith("linux")) {
    await $`tar -czf ${path.join(distDir, `fuckcode-${suffix}.tar.gz`)} -C ${staging} ${inner}`
  } else {
    await $`zip -jq ${path.join(distDir, `fuckcode-${suffix}.zip`)} ${staged}`
  }
  await rm(staged)
  packaged++
}
await rm(staging, { recursive: true, force: true })

const archives = (await readdir(distDir)).filter((name) => name.endsWith(".tar.gz") || name.endsWith(".zip")).sort()
if (archives.length > 0) {
  await $`sh -c ${`cd ${distDir} && sha256sum ${archives.join(" ")} > sha256.txt`}`
}

console.log(`=== packaged ${packaged} release assets into ${distDir} ===`)
