export * as FlagConfig from "./flag-config"

import { Config } from "effect"

// Effect `Config` values, kept out of `./flag` so importing plain flags does not
// pull the Effect runtime. Consumers yield these inside an Effect.
export const OPENCODE_EXPERIMENTAL_FILEWATCHER = Config.boolean("OPENCODE_EXPERIMENTAL_FILEWATCHER").pipe(
  Config.withDefault(false),
)

export const OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER = Config.boolean("OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER").pipe(
  Config.withDefault(false),
)
