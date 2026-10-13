import { createMemo, createSignal } from "solid-js"
import { applyEdits, modify } from "jsonc-parser"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { Global } from "@opencode/util/global"
import { useLocal } from "../context/local"
import { DialogSelect } from "../ui/dialog-select"
import { useDialog } from "../ui/dialog"
import { DialogPrompt } from "../ui/dialog-prompt"
import { DialogIntegration } from "./dialog-integration"
import { DialogVariant } from "./dialog-variant"
import * as fuzzysort from "fuzzysort"
import { useConnected } from "./use-connected"
import { useData } from "../context/data"
import { modelPreferenceKey } from "../model-preference"
import { useLocation } from "../context/location"
import { useToast } from "../ui/toast"

const CONFIG_NAMES = ["opencode.json", "opencode.jsonc", "fuckcode.json", "fuckcode.jsonc"]

function configFile() {
  for (const name of CONFIG_NAMES) {
    const file = path.join(Global.Path.config, name)
    if (existsSync(file)) return file
  }
  return path.join(Global.Path.config, "fuckcode.jsonc")
}

function saveLlamacppURL(url: string) {
  const file = configFile()
  mkdirSync(path.dirname(file), { recursive: true })
  const text = existsSync(file) ? readFileSync(file, "utf8") : "{}\n"
  const updated = applyEdits(
    text,
    modify(text, ["providers", "llamacpp", "settings", "baseURL"], url, {
      formattingOptions: { tabSize: 2, insertSpaces: true },
    }),
  )
  writeFileSync(file, updated.endsWith("\n") ? updated : `${updated}\n`)
}

export function DialogModel(props: { providerID?: string }) {
  const local = useLocal()
  const data = useData()
  const dialog = useDialog()
  const toast = useToast()
  const location = useLocation()
  const [query, setQuery] = createSignal("")
  const favoritePriority = new Set(local.model.favorite().map(modelPreferenceKey))

  const connected = useConnected()
  const providers = createMemo(
    () => new Map((data.location.provider.list(location.ref) ?? []).map((item) => [item.id, item])),
  )
  const models = createMemo(() => data.location.model.list(location.ref) ?? [])

  const showExtra = createMemo(() => connected() && !props.providerID)

  const options = createMemo(() => {
    const needle = query().trim()
    const showSections = showExtra() && needle.length === 0
    const favorites = connected() ? local.model.favorite() : []
    const recents = local.model.recent()

    function toOptions(items: typeof favorites, category: string) {
      if (!showSections) return []
      return items.flatMap((item) => {
        const model = models().find((model) => model.providerID === item.providerID && model.id === item.modelID)
        if (!model) return []
        const provider = providers().get(model.providerID)
        return [
          {
            key: item,
            value: { providerID: model.providerID, modelID: model.id },
            title: model.name,
            releaseDate: model.time.released,
            description: provider?.name ?? model.providerID,
            category,
            footer: free(model) ? "Free" : undefined,
            onSelect: () => {
              onSelect(model.providerID, model.id)
            },
          },
        ]
      })
    }

    const favoriteOptions = toOptions(favorites, "Favorites")
    const recentOptions = toOptions(
      recents.filter(
        (item) => !favorites.some((fav) => fav.providerID === item.providerID && fav.modelID === item.modelID),
      ),
      "Recent",
    )

    const modelOptions = sortModelOptions(
      models()
        .filter((model) => model.status !== "deprecated")
        .filter((model) => (props.providerID ? model.providerID === props.providerID : true))
        .map((model) => {
          const provider = providers().get(model.providerID)
          const key = modelPreferenceKey({ providerID: model.providerID, modelID: model.id })
          const favorite = favorites.some((item) => modelPreferenceKey(item) === key)
          return {
            value: { providerID: model.providerID, modelID: model.id },
            providerID: model.providerID,
            providerName: provider?.name ?? model.providerID,
            title: model.name,
            releaseDate: model.time.released,
            description: favorite ? "(Favorite)" : undefined,
            category: connected() ? (provider?.name ?? model.providerID) : undefined,
            footer: free(model) ? "Free" : undefined,
            onSelect() {
              onSelect(model.providerID, model.id)
            },
          }
        })
        .filter((option) => {
          if (!showSections) return true
          if (
            favorites.some(
              (item) => item.providerID === option.value.providerID && item.modelID === option.value.modelID,
            )
          )
            return false
          if (
            recents.some((item) => item.providerID === option.value.providerID && item.modelID === option.value.modelID)
          )
            return false
          return true
        }),
      connected(),
    )

    const llamacppOptions =
      !props.providerID || props.providerID === "llamacpp"
        ? [
            {
              value: { providerID: "llamacpp", modelID: "__configure_url__" },
              title: "Set llama.cpp Server URL...",
              releaseDate: "9999",
              description: `(current: ${providers().get("llamacpp")?.settings?.baseURL ?? "http://127.0.0.1:8080/v1"})`,
              category: connected() ? (providers().get("llamacpp")?.name ?? "llama.cpp Local") : undefined,
              onSelect() {
                dialog.replace(() => (
                  <DialogPrompt
                    title="llama.cpp Server URL"
                    placeholder="http://127.0.0.1:8080"
                    onConfirm={(value) => {
                      const raw = value?.trim() || "http://127.0.0.1:8080"
                      const prefixed = raw.startsWith("http") ? raw : `http://${raw}`
                      const normalized = prefixed.replace(/\/+$/, "")
                      const withV1 = normalized.endsWith("/v1") ? normalized : `${normalized}/v1`
                      saveLlamacppURL(withV1)
                      toast.show({ message: `llama.cpp URL saved: ${withV1}`, variant: "info" })
                      dialog.clear()
                    }}
                  />
                ))
              },
            },
          ]
        : []

    if (needle) {
      return [
        ...prioritizeFavorites(
          sortModelOptions(
            fuzzysort.go(needle, modelOptions, { keys: ["title", "category"] }).map((item) => item.obj),
            false,
          ),
          favoritePriority,
        ),
        ...llamacppOptions.filter(
          (option) => option.title.toLowerCase().includes(needle.toLowerCase()) || needle.length === 0,
        ),
      ]
    }

    return [...favoriteOptions, ...recentOptions, ...modelOptions, ...llamacppOptions]
  })

  const provider = createMemo(() => (props.providerID ? providers().get(props.providerID) : undefined))

  const title = createMemo(() => {
    const value = provider()
    if (!value) return "Select model"
    return value.name
  })

  function onSelect(providerID: string, modelID: string) {
    local.model.set({ providerID, modelID }, { recent: true })
    const list = local.model.variant.list()
    const cur = local.model.variant.current()
    if (cur && list.includes(cur)) {
      dialog.clear()
      return
    }
    if (list.length > 0) {
      dialog.replace(() => <DialogVariant />)
      return
    }
    dialog.clear()
  }

  return (
    <DialogSelect<ReturnType<typeof options>[number]["value"]>
      options={options()}
      actions={[
        {
          command: "model.dialog.provider",
          title: connected() ? "Connect an integration" : "View all integrations",
          selection: "none",
          onTrigger() {
            dialog.replace(() => (
              <DialogIntegration
                onConnected={(providerID) => dialog.replace(() => <DialogModel providerID={providerID} />)}
              />
            ))
          },
        },
        {
          command: "model.dialog.favorite",
          title: "Favorite",
          hidden: !connected(),
          onTrigger: (option) => {
            local.model.toggleFavorite(option.value as { providerID: string; modelID: string })
          },
        },
      ]}
      onFilter={setQuery}
      flat={true}
      skipFilter={true}
      title={title()}
      current={local.model.current()}
      focusCurrent={false}
    />
  )
}

export function prioritizeFavorites<T extends { value: { providerID: string; modelID: string } }>(
  options: T[],
  favorites: Set<string>,
) {
  return options.toSorted(
    (a, b) => Number(favorites.has(modelPreferenceKey(b.value))) - Number(favorites.has(modelPreferenceKey(a.value))),
  )
}

export function sortModelOptions<
  T extends {
    providerID?: string
    providerName?: string
    releaseDate: string | number
    title: string
    footer?: string
  },
>(options: T[], grouped = true) {
  return options.toSorted((a, b) => {
    const provider = grouped
      ? Number(b.providerID === "opencode-go") - Number(a.providerID === "opencode-go") ||
        Number(b.providerID === "opencode") - Number(a.providerID === "opencode")
      : 0
    if (provider !== 0) return provider

    const name = grouped ? (a.providerName ?? "").localeCompare(b.providerName ?? "") : 0
    if (name !== 0) return name

    const free = Number(b.footer === "Free") - Number(a.footer === "Free")
    if (free !== 0) return free

    const release = Number(b.releaseDate) - Number(a.releaseDate)
    if (release !== 0) return release

    return a.title.localeCompare(b.title)
  })
}

function free(model: { cost: Array<{ input: number }> }) {
  return model.cost.length > 0 && model.cost.every((cost) => cost.input === 0)
}
