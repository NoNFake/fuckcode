import { expect, test } from "bun:test"
import { intelligenceLevel, intelligenceScore } from "../src/component/model-intelligence"

test("matches catalog names across case, punctuation, provider prefix, and trailing dates", () => {
  expect(intelligenceScore({ id: "whatever", name: "Claude Opus 5.5" })).toBe(58.4)
  expect(intelligenceScore({ id: "whatever", name: "Qwen3.8 Max 0902" })).toBe(33.6)
  expect(intelligenceScore({ id: "qwen3.8-max", name: "Qwen3.8 Max" })).toBe(33.6)
  expect(intelligenceScore({ id: "z-ai/glm-5.3", name: "unknown" })).toBe(31.7)
})

test("keeps plus tiers distinct and ignores unknown models", () => {
  expect(intelligenceScore({ id: "command-a", name: "Command A" })).toBeUndefined()
  expect(intelligenceScore({ id: "command-a-plus", name: "Command A+" })).toBe(6.2)
  expect(intelligenceScore({ id: "unknown", name: "Not A Model" })).toBeUndefined()
})

test("classifies scores into high (green), medium (orange), and low (red) tiers", () => {
  expect(intelligenceLevel(58.4)).toBe("high")
  expect(intelligenceLevel(40)).toBe("high")
  expect(intelligenceLevel(33.6)).toBe("medium")
  expect(intelligenceLevel(25)).toBe("medium")
  expect(intelligenceLevel(23.1)).toBe("low")
  expect(intelligenceLevel(4.3)).toBe("low")
})
