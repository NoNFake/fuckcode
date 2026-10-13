export * as ConfigToolOutputPlugin from "./tool-output.js"

import { define } from "@opencode/plugin/effect/plugin"
import { Effect } from "effect"
import { Config } from "../../config.js"
import { TokenSavingState } from "../../token-saving-state.js"
import { ToolOutput } from "../../tool-output.js"
import { ConfigEntryObserver } from "./entry-observer.js"

export const Plugin = define({
  id: "opencode.config.tool-output",
  effect: Effect.fn(function* (ctx) {
    const config = yield* Config.Service
    const output = yield* ToolOutput.Service
    const loaded = yield* ConfigEntryObserver.observe(config, ctx.event, output.reload())
    yield* output.transform((editor) => {
      const configured = Config.latest(loaded.entries, "tool_output")
      const tokenSaving = Config.latest(loaded.entries, "token_saving") ?? {}
      const live = TokenSavingState.read()
      const isSavingEnabled =
        process.env.FUCKCODE_TOKEN_SAVING === "1" ||
        (process.env.FUCKCODE_TOKEN_SAVING !== "0" &&
          (live ??
            (tokenSaving.enabled === true ||
              tokenSaving.mode === "aggressive" ||
              tokenSaving.mode === "moderate")))
      const savingMaxLines = tokenSaving.mode === "aggressive" ? 40 : 80
      const savingMaxBytes = tokenSaving.mode === "aggressive" ? 8 * 1024 : 16 * 1024
      const defaultMaxLines = isSavingEnabled ? (tokenSaving.max_tool_lines ?? savingMaxLines) : undefined
      const defaultMaxBytes = isSavingEnabled ? savingMaxBytes : undefined
      editor.configure({
        ...(configured?.max_lines === undefined ? {} : { maxLines: configured.max_lines }),
        ...(configured?.max_bytes === undefined ? {} : { maxBytes: configured.max_bytes }),
        ...(defaultMaxLines === undefined || configured?.max_lines !== undefined
          ? {}
          : { maxLines: defaultMaxLines }),
        ...(defaultMaxBytes === undefined || configured?.max_bytes !== undefined
          ? {}
          : { maxBytes: defaultMaxBytes }),
      })
    })
  }),
})
