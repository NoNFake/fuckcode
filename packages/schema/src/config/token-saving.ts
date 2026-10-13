export * as ConfigTokenSaving from "./token-saving.js"

import { Schema } from "effect"
import { optional, PositiveInt } from "../schema.js"

export const Mode = Schema.Literals(["off", "moderate", "aggressive"])
export type Mode = Schema.Schema.Type<typeof Mode>

export class Info extends Schema.Class<Info>("Config.TokenSaving")({
  enabled: Schema.Boolean.pipe(optional).annotate({
    description: "Enable token saving optimizations across tool outputs and prompt assembly",
  }),
  mode: Mode.pipe(optional).annotate({
    description: "Aggressiveness level for token saving: off, moderate, or aggressive",
  }),
  max_tool_lines: PositiveInt.pipe(optional).annotate({
    description: "Override maximum lines returned by tools before truncation occurs",
  }),
}) {}
