export * as Token from "./token"

import type { countTokens as countTokensFn } from "gpt-tokenizer"

let countTokens: typeof countTokensFn
let loaded = false

export const estimate = (input: string): number => {
  if (!input) return 0
  try {
    if (!loaded) {
      countTokens = require("gpt-tokenizer").countTokens
      loaded = true
    }
    return countTokens(input)
  } catch {
    return Math.max(0, Math.round(input.length / 4))
  }
}
