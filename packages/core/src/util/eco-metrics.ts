export * as EcoMetrics from "./eco-metrics"

import { Token } from "./token"

// Tokens avoided by replacing `original` with `preview` in the prompt.
export function truncationSaved(original: string, preview: string): number {
  try {
    return Math.max(0, Token.estimate(original) - Token.estimate(preview))
  } catch {
    return Math.max(0, Math.round((original.length - preview.length) / 4))
  }
}

const truncationCache = new WeakMap<object, number>()

export function extractTruncationSaved(part: unknown): number {
  if (!part || typeof part !== "object") return 0
  const cached = truncationCache.get(part)
  if (cached !== undefined) return cached
  const saved = extractTruncationSavedUncached(part)
  truncationCache.set(part, saved)
  return saved
}

function extractTruncationSavedUncached(part: object): number {
  const anyPart = part as Record<string, any>

  if (typeof anyPart.state?.structured?.tokensSaved === "number") return anyPart.state.structured.tokensSaved
  if (typeof anyPart.state?.structured?.truncatedTokens === "number") return anyPart.state.structured.truncatedTokens
  if (typeof anyPart.state?.truncatedTokens === "number") return anyPart.state.truncatedTokens
  if (typeof anyPart.state?.tokensSaved === "number") return anyPart.state.tokensSaved
  if (typeof anyPart.state?.metadata?.tokensSaved === "number") return anyPart.state.metadata.tokensSaved
  if (typeof anyPart.state?.metadata?.truncatedTokens === "number") return anyPart.state.metadata.truncatedTokens
  if (typeof anyPart.metadata?.tokensSaved === "number") return anyPart.metadata.tokensSaved
  if (typeof anyPart.metadata?.truncatedTokens === "number") return anyPart.metadata.truncatedTokens

  const texts: string[] = []
  if (typeof anyPart.state?.output === "string") texts.push(anyPart.state.output)
  if (typeof anyPart.text === "string") texts.push(anyPart.text)
  if (typeof anyPart.content === "string") texts.push(anyPart.content)

  if (Array.isArray(anyPart.state?.content)) {
    for (const item of anyPart.state.content) {
      if (typeof item === "string") texts.push(item)
      else if (typeof item?.text === "string") texts.push(item.text)
    }
  }

  if (Array.isArray(anyPart.content)) {
    for (const item of anyPart.content) {
      if (typeof item === "string") texts.push(item)
      else if (typeof item?.text === "string") texts.push(item.text)
    }
  }

  for (const text of texts) {
    if (text.includes("tokens saved")) {
      const match = text.match(/([0-9,]+)\s*tokens saved/)
      if (match && match[1]) {
        const parsed = Number.parseInt(match[1].replace(/,/g, ""), 10)
        if (!Number.isNaN(parsed) && parsed > 0) return parsed
      }
    }
  }
  return 0
}

