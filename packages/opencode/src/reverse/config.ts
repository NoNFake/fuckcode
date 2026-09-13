import { Context, Effect, Layer } from "effect"
import { Global } from "@opencode-ai/core/global"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import path from "path"

export interface Config {
  readonly enabled: boolean
  readonly allowedDirs: readonly string[]
  readonly allowPatch: boolean
  readonly workDir: string
  readonly maxFileSize: number
}

const defaultWorkDir = path.join(Global.Path.data, "reverse-work")

export const defaultConfig: Config = {
  enabled: false,
  allowedDirs: [],
  allowPatch: false,
  workDir: defaultWorkDir,
  maxFileSize: 256 * 1024 * 1024,
}

export interface Interface {
  readonly get: () => Effect.Effect<Config>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/ReverseConfig") {}

export function pathAllowed(config: Config, file: string): boolean {
  if (config.allowedDirs.length === 0) return true
  const resolved = path.resolve(file)
  return config.allowedDirs.some((dir) => resolved === dir || resolved.startsWith(dir + path.sep))
}

export function loadFromConfig(rawReverse: unknown): Config {
  if (!rawReverse || typeof rawReverse !== "object") return defaultConfig
  const r = rawReverse as Record<string, unknown>
  const allowedDirs = Array.isArray(r.allowedDirs)
    ? r.allowedDirs
        .filter((d): d is string => typeof d === "string" && d.length > 0)
        .map((d) => path.resolve(d))
    : []
  const maxFileSize =
    typeof r.maxFileSize === "number" && Number.isFinite(r.maxFileSize) && r.maxFileSize > 0
      ? Math.floor(r.maxFileSize)
      : defaultConfig.maxFileSize
  return {
    enabled: r.enabled === true,
    allowedDirs,
    allowPatch: r.allowPatch === true,
    workDir: typeof r.workDir === "string" && r.workDir.length > 0 ? path.resolve(r.workDir) : defaultWorkDir,
    maxFileSize,
  }
}

export function makeService(config: Config): Interface {
  return Service.of({ get: () => Effect.succeed(config) })
}

export const layer = Layer.succeed(Service, makeService(defaultConfig))

export const node = LayerNode.make({ service: Service, layer, deps: [] })

export * as ReverseConfig from "./config"
