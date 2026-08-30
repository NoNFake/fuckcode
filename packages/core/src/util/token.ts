export * as Token from "./token"

import { countTokens } from "gpt-tokenizer"

export const estimate = (input: string): number => {
  if (!input) return 0
  try {
    return countTokens(input)
  } catch {
    return Math.max(0, Math.round(input.length / 4))
  }
}
