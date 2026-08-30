export * as EcoMetrics from "./eco-metrics"

import { getEncoding } from "js-tiktoken"

export interface Metrics {
  truncatedTokens: number
  truncatedEvents: number
  cachedTokens: number
  prunedContextTokens: number
  compactionRuns: number
  totalSaved: number
}

let sharedEncoder: ReturnType<typeof getEncoding> | undefined

function getSharedEncoder() {
  if (!sharedEncoder) {
    try {
      sharedEncoder = getEncoding("o200k_base")
    } catch {
      sharedEncoder = getEncoding("cl100k_base")
    }
  }
  return sharedEncoder
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
   * Records a tool output truncation event with exact token calculation using Tiktoken.
   * For outputs >32KB, uses high-accuracy chunk sampling to prevent main thread event loop freeze.
   */
  recordTruncation(original: string, preview: string): number {
    try {
      const encoder = getSharedEncoder()
      if (original.length <= 32 * 1024) {
        const origTokens = encoder.encode(original).length
        const prevTokens = encoder.encode(preview).length
        const saved = Math.max(0, origTokens - prevTokens)

        this.metrics.truncatedTokens += saved
        this.metrics.truncatedEvents += 1
        this.metrics.totalSaved += saved
        return saved
      }

      const head = original.slice(0, 2048)
      const tail = original.slice(original.length - 2048)
      const sampleTokens = encoder.encode(head).length + encoder.encode(tail).length
      const sampleLength = head.length + tail.length
      const tokenPerChar = sampleTokens / sampleLength
      const prevTokens = encoder.encode(preview).length
      const origEstimated = Math.round(original.length * tokenPerChar)
      const saved = Math.max(0, origEstimated - prevTokens)

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
