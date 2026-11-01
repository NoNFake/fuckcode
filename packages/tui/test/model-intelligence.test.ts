import { expect, test } from "bun:test"
import { intelligenceScore } from "../src/component/model-intelligence"

test("matches catalog names across case and punctuation", () => {
  expect(intelligenceScore({ id: "whatever", name: "Claude Opus 5.5" })).toBe(58.4)
  expect(intelligenceScore({ id: "whatever", name: "Qwen3.8 Max 0902" })).toBe(33.6)
  expect(intelligenceScore({ id: "glm-5.3", name: "unknown" })).toBe(31.7)
})

test("keeps plus tiers distinct and ignores unknown models", () => {
  expect(intelligenceScore({ id: "command-a", name: "Command A" })).toBeUndefined()
  expect(intelligenceScore({ id: "command-a-plus", name: "Command A+" })).toBe(6.2)
  expect(intelligenceScore({ id: "unknown", name: "Not A Model" })).toBeUndefined()
})
