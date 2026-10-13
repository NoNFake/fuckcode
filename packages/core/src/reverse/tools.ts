import { Effect } from "effect"
import type { Context } from "@opencode/plugin/effect/plugin"
import { ReverseConfig } from "./config.js"
import { Plugin as Binary } from "./binary.js"

export const enabled = (value: { enabled?: boolean } | undefined, env: string | undefined) =>
  env === "1" || env === "true" || value?.enabled === true

export const ReverseToolsPlugin = {
  id: "opencode.tool.reverse",
  effect: Effect.fn("ReverseToolsPlugin")(function* (ctx: Context) {
    const config = yield* ReverseConfig.Service
    const current = yield* config.get()
    if (!enabled(current, process.env.FUCKCODE_REVERSE)) return
    yield* Binary.effect(ctx)
  }),
}
