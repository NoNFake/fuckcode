export * as EcoMetrics from "./eco-metrics"

import { Token } from "./token"

export interface Metrics {
  truncatedTokens: number
  truncatedEvents: number
  cachedTokens: number
  prunedContextTokens: number
  compactionRuns: number
  totalSaved: number
}

export class Tracker {
  private metrics: Metrics = {
    truncatedTokens: 0,
    truncatedEvents: 0,
    cachedTokens: 0,
    prunedContextTokens: 0,
    compactionRuns: 0,
    totalSaved: 0,
  }

  /**
   * Records a tool output truncation event with accurate token calculation.
   */
  recordTruncation(original: string, preview: string): number {
    try {
      const origTokens = Token.estimate(original)
      const prevTokens = Token.estimate(preview)
      const saved = Math.max(0, origTokens - prevTokens)

      this.metrics.truncatedTokens += saved
      this.metrics.truncatedEvents += 1
      this.metrics.totalSaved += saved
      return saved
    } catch {
      const saved = Math.max(0, Math.round((original.length - preview.length) / 4))
      this.metrics.truncatedTokens += saved
      this.metrics.truncatedEvents += 1
      this.metrics.totalSaved += saved
      return saved
    }
  }

  /**
   * Records a prompt cache hit from API response metadata.
   */
  recordCacheHit(cachedTokens: number) {
    if (cachedTokens > 0) {
      this.metrics.cachedTokens += cachedTokens
      this.metrics.totalSaved += cachedTokens
    }
  }

  /**
   * Records a context compaction event.
   */
  recordCompaction(prunedTokens: number) {
    if (prunedTokens > 0) {
      this.metrics.prunedContextTokens += prunedTokens
      this.metrics.compactionRuns += 1
    }
  }

  getMetrics(): Metrics {
    return { ...this.metrics }
  }

  reset() {
    this.metrics = {
      truncatedTokens: 0,
      truncatedEvents: 0,
      cachedTokens: 0,
      prunedContextTokens: 0,
      compactionRuns: 0,
      totalSaved: 0,
    }
  }
}

export const globalTracker = new Tracker()

export function extractTruncationSaved(part: unknown): number {
  if (!part || typeof part !== "object") return 0
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

export function formatEcoSuffix(metrics: Metrics): string {
  const parts: string[] = []

  if (metrics.truncatedEvents > 0 && metrics.truncatedTokens > 0) {
    const k = metrics.truncatedTokens >= 1000
      ? `${(metrics.truncatedTokens / 1000).toFixed(1)}k`
      : `${metrics.truncatedTokens}`
    parts.push(`◈ cut -${k}`)
  }

  if (metrics.cachedTokens > 0) {
    const val = metrics.cachedTokens >= 1000
      ? `${(metrics.cachedTokens / 1000).toFixed(1)}k`
      : `${metrics.cachedTokens}`
    parts.push(`◈ cached ${val}`)
  }

  return parts.length > 0 ? ` · ${parts.join(" · ")}` : ""
}

