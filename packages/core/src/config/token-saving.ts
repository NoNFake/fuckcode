export * as ConfigTokenSaving from "./token-saving"

import { Schema } from "effect"
import { PositiveInt } from "../schema"

export const Mode = Schema.Literals(["off", "moderate", "aggressive"])
export type Mode = typeof Mode.Type

export class Info extends Schema.Class<Info>("ConfigV2.TokenSaving")({
  enabled: Schema.Boolean.pipe(Schema.optional).annotate({
    description: "Enable token saving optimizations across tool outputs and prompt assembly",
  }),
  mode: Mode.pipe(Schema.optional).annotate({
    description: "Aggressiveness level for token saving: off, moderate, or aggressive",
  }),
  max_tool_lines: PositiveInt.pipe(Schema.optional).annotate({
    description: "Override maximum lines returned by tools before truncation occurs",
  }),
  cache_tools: Schema.Boolean.pipe(Schema.optional).annotate({
    description: "Enable hash-based file read deduplication to avoid reloading unchanged files",
  }),
  compact_instructions: Schema.Boolean.pipe(Schema.optional).annotate({
    description: "Strip verbose instruction formatting and redundant guidance",
  }),
}) {}
