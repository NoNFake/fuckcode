// Artificial Analysis Intelligence Index, snapshot 2026-10-30.
// https://artificialanalysis.ai/evaluations/artificial-analysis-intelligence-index
// shortcut: hand-copied snapshot because the index has no public API; refresh it when scores drift.
const snapshot: Record<string, number> = {
  "Claude Opus 5.5": 58.4,
  "GPT-6 Astra": 56.9,
  "GPT-6.1 Sol": 54.5,
  "Claude Sonnet 5.5": 54.2,
  "GPT-6.1 Terra": 51.0,
  "Gemini 4 Argon": 50.4,
  "Claude Fable 5.1": 49.0,
  "Kimi K3.1 Pro": 46.0,
  "Muse Wonder": 43.3,
  "Claude Haiku 5.5": 36.2,
  "Grok 4.7": 34.3,
  "Qwen3.8 Max (0902)": 33.6,
  "DeepSeek V4.1 Flash 1017": 32.5,
  "GLM 5.3": 31.7,
  "Gemini 3.8 Flash": 30.5,
  "MiMo-V2.6-Pro": 29.9,
  "Ling 3.1 flash 1019": 29.5,
  "MiniMax M3.1 Flash": 28.9,
  "Step 5 Preview": 28.5,
  "GPT-6 Luna": 27.8,
  "GLM 5.3 Flash": 27.8,
  "MiMo-V2.6-Flash": 26.7,
  "Muse Spark Open": 24.7,
  "DeepSeek V4 Pro 0813": 23.1,
  "Qwen3.8 27B": 20.1,
  "MiniMax M3": 18.7,
  "Inkling Small": 12.9,
  Inkling: 12.5,
  "Gemini 3.5 Flash Lite": 11.7,
  "Command A+": 6.2,
  "Nemotron 3.5 Lightning": 5.5,
  "granite 4.2 3b": 4.7,
  "Mistral Small 4": 4.3,
}

// Catalog names and ids differ only in case and punctuation ("Qwen3.8 Max 0902" vs "Qwen3.8 Max (0902)"),
// but "+" is a different model tier, so it stays.
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9+]/g, "")
const scores = new Map(Object.entries(snapshot).map(([name, score]) => [normalize(name), score]))

export function intelligenceScore(model: { readonly id: string; readonly name: string }) {
  return scores.get(normalize(model.name)) ?? scores.get(normalize(model.id))
}

/** The index runs to about 60; 40 and up is the current frontier tier. */
export const strongIntelligenceScore = 40
