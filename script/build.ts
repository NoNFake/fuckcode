#!/usr/bin/env bun

import { $ } from "bun"
import path from "path"
import { fileURLToPath } from "url"

const rootDir = fileURLToPath(new URL("..", import.meta.url))
process.chdir(rootDir)

const args = process.argv.slice(2)

function printHelp() {
  console.log(`
Использование: bun run script/build.ts [опции]

Опции:
  --version, -v <версия>    Указать версию билда (напр., --version 1.18.25)
  --channel, -c <канал>     Указать канал (latest, dev, local, beta; по умолчанию: latest, если версия задана)
  --all, -a                 Собрать для всех платформ (по умолчанию: только для текущей платформы)
  --single, -s              Собрать только для текущей платформы (по умолчанию)
  --skip-ui                 Пропустить сборку встроенного Web UI (быстрее)
  --skip-install            Пропустить установку зависимостей для сборки
  --sourcemaps              Генерировать sourcemap файлы
  --help, -h                Показать эту справку

Примеры:
  bun run script/build.ts
  bun run script/build.ts --version 1.18.25
  bun run script/build.ts --version 1.18.25 --skip-ui
  bun run script/build.ts --all --version 1.18.25
`)
  process.exit(0)
}

if (args.includes("--help") || args.includes("-h")) {
  printHelp()
}

let version: string | undefined = process.env.OPENCODE_VERSION
let channel: string | undefined = process.env.OPENCODE_CHANNEL
let isAll = false
let skipUi = false
let skipInstall = false
let sourcemaps = false
let archive = false

for (let i = 0; i < args.length; i++) {
  const arg = args[i]
  if (arg === "--version" || arg === "-v") {
    version = args[++i]
  } else if (arg.startsWith("--version=")) {
    version = arg.split("=")[1]
  } else if (arg === "--channel" || arg === "-c") {
    channel = args[++i]
  } else if (arg.startsWith("--channel=")) {
    channel = arg.split("=")[1]
  } else if (arg === "--all" || arg === "-a") {
    isAll = true
    archive = true
  } else if (arg === "--single" || arg === "-s") {
    isAll = false
  } else if (arg === "--archive") {
    archive = true
  } else if (arg === "--skip-ui") {
    skipUi = true
  } else if (arg === "--skip-install") {
    skipInstall = true
  } else if (arg === "--sourcemaps") {
    sourcemaps = true
  }
}

const opencodeDir = path.join(rootDir, "packages", "opencode")
const buildArgs: string[] = []

if (!isAll) {
  buildArgs.push("--single")
}
if (archive) {
  buildArgs.push("--archive")
}
if (skipUi) {
  buildArgs.push("--skip-embed-web-ui")
}
if (skipInstall) {
  buildArgs.push("--skip-install")
}
if (sourcemaps) {
  buildArgs.push("--sourcemaps")
}

const env: Record<string, string> = {
  ...process.env,
}

if (version) {
  env.OPENCODE_VERSION = version
  if (!channel) {
    env.OPENCODE_CHANNEL = "latest"
  }
}

if (channel) {
  env.OPENCODE_CHANNEL = channel
}

console.log("=== Сборка OpenCode / FuckCode ===")
console.log(`Режим: ${isAll ? "Все платформы" : "Текущая платформа (--single)"}`)
console.log(`Версия: ${version ?? "автоматически из git/ветки"}`)
console.log(`Канал: ${env.OPENCODE_CHANNEL ?? "автоматически"}`)
if (skipUi) console.log("Web UI: пропущен (--skip-ui)")
console.log("")

const proc = Bun.spawn({
  cmd: ["bun", "run", "script/build.ts", ...buildArgs],
  cwd: opencodeDir,
  env,
  stdio: ["inherit", "inherit", "inherit"],
})

const exitCode = await proc.exited
if (exitCode !== 0) {
  console.error(`\n❌ Сборка завершилась с ошибкой (код ${exitCode})`)
  process.exit(exitCode)
}

console.log("\n✅ Сборка успешно завершена!")
console.log(`Бинарные файлы находятся в: ${path.join(opencodeDir, "dist")}`)
