// Artificial Analysis Intelligence Index v5.0, snapshot 2026-11-01.
// https://artificialanalysis.ai/evaluations/artificial-analysis-intelligence-index
// shortcut: hand-copied snapshot because the index has no public API; refresh it when scores drift.
const snapshot: Record<string, number> = {
  "Gemini 4 Carbon": 59.4,
  "Claude Opus 5.5": 58.4,
  "GPT-6 Astra": 56.9,
  "GPT-6.1 Sol": 54.5,
  "Claude Sonnet 5.5": 54.2,
  "GPT-6.1 Terra": 51.0,
  "Gemini 4 Argon": 50.4,
  "Claude Fable 5.1": 49.7,
  "Muse Wonder Full": 49.7,
  "Kimi K3.1 Pro": 46.0,
  "Muse Wonder": 43.3,
  "Claude Haiku 5.5": 36.2,
  "Grok 4.7": 35.0,
  "Qwen3.8 Max (0902)": 33.6,
  "DeepSeek V4.1 Flash 1017": 32.5,
  "GLM-5.3": 31.7,
  "Gemini 3.8 Flash": 30.5,
  "MiMo-V2.6-Pro": 29.9,
  "Ling 3.1 Flash 1019": 29.5,
  "MiniMax-M3.1-Flash": 28.9,
  "Step 5 Preview": 28.5,
  "GLM-5.3-Flash": 27.8,
  "GPT-6 Luna": 27.8,
  "MiMo-V2.6-Flash": 26.7,
  "Mistral Large 4": 26.0,
  "Muse Spark Open": 24.7,
  "DeepSeek V4 Pro 0813": 23.1,
  "Qwen3.8 27B": 20.1,
  "MiniMax-M3": 18.7,
  "K2 Horizon 375B A23B": 17.8,
  "Beam 1.0": 17.7,
  "Nemotron 3.5 Super VL": 13.6,
  "Inkling Small": 12.9,
  Inkling: 12.5,
  "Nemotron 3 Ultra 550B A55B": 11.8,
  "Gemini 3.5 Flash-Lite": 11.7,
  "Muse Glimmer": 6.3,
  "Command A+": 6.2,
  "Nemotron 3.5 Lightning": 5.5,
  "Granite 4.2 3B": 4.7,
  "Mistral Small 4": 4.3,
  "NVIDIA Nemotron 3 Nano 4B": 1.8,
}

// Catalog names and ids differ in case, punctuation, provider prefixes ("z-ai/glm-5.3"),
// or trailing release dates ("Qwen3.8 Max" vs "Qwen3.8 Max (0902)"), while "+" is a distinct tier.
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9+]/g, "")
const stripDate = (value: string) =>
  normalize(value.replace(/[-_\s(]*(?:free|preview|latest|\b\d{4}(?:\d{4})?\b)[)]*/gi, ""))

const scores = new Map<string, number>()
for (const [name, score] of Object.entries(snapshot)) {
  scores.set(normalize(name), score)
  scores.set(stripDate(name), score)
}

export function intelligenceScore(model: { readonly id: string; readonly name: string }) {
  const tail = model.id.split("/").pop() ?? model.id
  return (
    scores.get(normalize(model.name)) ??
    scores.get(normalize(model.id)) ??
    scores.get(normalize(tail)) ??
    scores.get(stripDate(model.name)) ??
    scores.get(stripDate(tail))
  )
}

/**
 * The index runs to ~60: 40+ is frontier (green), 25-39 is mid-tier (orange), and <25 is low-tier (red).
 */
export function intelligenceLevel(score: number): "high" | "medium" | "low" {
  if (score >= 40) return "high"
  if (score >= 25) return "medium"
  return "low"
}
