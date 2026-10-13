import { Effect, Schema } from "effect"
import { createLocalProviderPlugin } from "./local.js"

const RemoteModel = Schema.Struct({
  id: Schema.String,
})

const Response = Schema.Struct({ data: Schema.Array(RemoteModel) })

export const make = createLocalProviderPlugin({
  id: "opencode.provider.llamacpp",
  providerID: "llamacpp",
  name: "llama.cpp Local",
  origin: "http://127.0.0.1:8080",
  stripPathSuffix: /\/v1$/,
  discover: (client) =>
    Effect.gen(function* () {
      const response = yield* client.getJson("/v1/models", Response)
      return response.data.filter((model) => model.id.length > 0)
    }),
  model: (item) => ({
    id: item.id,
    name: `llama.cpp: ${item.id}`,
    tools: true,
    context: 32768,
  }),
})

export const LlamacppPlugin = make()
