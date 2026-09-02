import { describe, expect, it } from "bun:test"
import { EcoMetrics } from "@opencode-ai/core/util/eco-metrics"

describe("EcoMetrics", () => {
  it("extracts structured tokensSaved from tool state structured metadata", () => {
    const part = {
      type: "tool",
      state: {
        status: "completed",
        structured: { tokensSaved: 1250, truncatedTokens: 1250 },
      },
    }
    expect(EcoMetrics.extractTruncationSaved(part)).toBe(1250)
  })

  it("extracts structured tokensSaved from tool state metadata", () => {
    const part = {
      type: "tool",
      state: {
        status: "completed",
        metadata: { tokensSaved: 3400 },
      },
    }
    expect(EcoMetrics.extractTruncationSaved(part)).toBe(3400)
  })

  it("extracts structured tokensSaved from top-level part metadata", () => {
    const part = {
      type: "tool",
      metadata: { truncatedTokens: 890 },
    }
    expect(EcoMetrics.extractTruncationSaved(part)).toBe(890)
  })

  it("falls back to regex parsing for historical text messages", () => {
    const part = {
      type: "tool",
      state: {
        output: "... output truncated (4,520 tokens saved); full content saved to /path ...",
      },
    }
    expect(EcoMetrics.extractTruncationSaved(part)).toBe(4520)
  })

  it("extracts from V2 SessionMessage ToolStateCompleted content array", () => {
    const part = {
      type: "tool",
      state: {
        status: "completed",
        content: [
          {
            type: "text",
            text: "... output truncated (5,678 tokens saved); full content saved to /path ...",
          },
        ],
      },
    }
    expect(EcoMetrics.extractTruncationSaved(part)).toBe(5678)
  })

  it("extracts from state.truncatedTokens number directly", () => {
    const part = {
      type: "tool",
      state: {
        status: "completed",
        truncatedTokens: 9999,
      },
    }
    expect(EcoMetrics.extractTruncationSaved(part)).toBe(9999)
  })

  it("returns 0 when no truncation happened", () => {
    const part = {
      type: "tool",
      state: {
        output: "normal output",
      },
    }
    expect(EcoMetrics.extractTruncationSaved(part)).toBe(0)
    expect(EcoMetrics.extractTruncationSaved(null)).toBe(0)
    expect(EcoMetrics.extractTruncationSaved({})).toBe(0)
  })
})
