import type { ModelInfo } from "@opencode/client"
import { createMemo, createSignal, onMount, Show } from "solid-js"
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
import { useNewDesigns } from "../config"
import { useToast } from "../ui/toast"
import { DialogFreeModels } from "./dialog-model-free"
import {
  FavoriteMarker,
  ModelDetail,
  isFreeModel,
  modelPrice,
  prioritizeFavorites,
  sortModelOptions,
} from "./model-options"
import { DialogUsage, useUsageLimits } from "./usage"
import { formatDollars, usageLevel } from "../util/usage-limits"
import { intelligenceLevel, intelligenceScore } from "./model-intelligence"
import { useTheme } from "../context/theme"

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
  const dialog = useDialog()
  const newDesigns = useNewDesigns()
  const connected = useConnected()

  function select(providerID: string, modelID: string) {
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

  function connect() {
    dialog.replace(() => (
      <DialogIntegration onConnected={(providerID) => dialog.replace(() => <DialogModel providerID={providerID} />)} />
    ))
  }

  return (
    <Show
      when={newDesigns() && !connected() && !props.providerID}
      fallback={<DialogConnectedModels providerID={props.providerID} onSelect={select} onConnect={connect} />}
    >
      <DialogFreeModels onSelect={select} onConnect={connect} />
    </Show>
  )
}

function DialogConnectedModels(props: {
  providerID?: string
  onSelect: (providerID: string, modelID: string) => void
  onConnect: () => void
}) {
  const local = useLocal()
  const newDesigns = useNewDesigns()
  const theme = useTheme().surface("dialog")
  const data = useData()
  const toast = useToast()
  const location = useLocation()
  const dialog = useDialog()
  const limits = useUsageLimits()
  // Spend moves with every request, so the picker shows fresh limits.
  onMount(() => limits.load(true))
  const usage = (model: ModelInfo) => {
    const value = limits.usage(model)
    if (value) {
      const level = usageLevel(value, model)
      return { text: `${formatDollars(value.left)} left`, danger: level === "out" || level === "reached" }
    }
    if (limits.unlimited(model)) return { text: "No limit" }
    return undefined
  }
  const [query, setQuery] = createSignal("")
  // Under new designs, favoriting does not reorder the list until the dialog is reopened.
  const favoritesAtOpen = [...local.model.favorite()]
  const favoritePriority = new Set(favoritesAtOpen.map(modelPreferenceKey))
  const isFavorite = (value: { providerID: string; modelID: string } | undefined) =>
    value !== undefined &&
    local.model.favorite().some((item) => item.providerID === value.providerID && item.modelID === value.modelID)
  // Right-hand slot: the favorite marker under new designs, then price and the Artificial Analysis
  // index colored by tier (green >= 40, orange 25-39, red < 25).
  const trailing = (model: ModelInfo, favorite: boolean) => {
    const score = intelligenceScore(model)
    const price = modelPrice(model)
    const level = score === undefined ? undefined : intelligenceLevel(score)
    const scoreColor =
      level === "high"
        ? theme.text.feedback.success.base
        : level === "medium"
          ? theme.text.feedback.warning.base
          : level === "low"
            ? theme.text.feedback.error.base
            : undefined
    if (price === "" && score === undefined) return newDesigns() && favorite ? <FavoriteMarker /> : undefined
    const content = (
      <>
        {price === "" ? undefined : <span style={{ fg: theme.text.muted }}>{price}</span>}
        {price !== "" && score !== undefined ? <span style={{ fg: theme.text.muted }}> · </span> : undefined}
        {score === undefined ? undefined : <span style={{ fg: scoreColor }}>AA {score}</span>}
      </>
    )
    return newDesigns() && favorite ? (
      <>
        <FavoriteMarker /> {content}
      </>
    ) : (
      content
    )
  }
  // OpenCode's own free models get their own group at the end of the list instead of joining "OpenCode".
  const freeGroup = (model: ModelInfo) =>
    newDesigns() && !props.providerID && model.providerID === "opencode" && isFreeModel(model)

  const connected = useConnected()
  const providers = createMemo(
    () => new Map((data.location.provider.list(location.ref) ?? []).map((item) => [item.id, item])),
  )
  const models = createMemo(() => data.location.model.list(location.ref) ?? [])

  const showExtra = createMemo(() => connected() && !props.providerID)

  const options = createMemo(() => {
    const needle = query().trim()
    const showSections = showExtra() && needle.length === 0
    const favorites = connected() ? (newDesigns() ? favoritesAtOpen : local.model.favorite()) : []
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
            footer: trailing(model, isFavorite(item)),
            detail: () => <ModelDetail model={model} usage={usage(model)} />,
            onSelect: () => {
              props.onSelect(model.providerID, model.id)
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
          const value = { providerID: model.providerID, modelID: model.id }
          // Users with nothing connected can only favorite models in the free picker (new designs); this picker keeps them unavailable.
          const favorite = connected() && isFavorite(value)
          return {
            value,
            providerID: model.providerID,
            providerName: provider?.name ?? model.providerID,
            title: model.name,
            releaseDate: model.time.released,
            description: newDesigns() ? undefined : favorite ? "(Favorite)" : undefined,
            category: connected() ? (freeGroup(model) ? "Free" : (provider?.name ?? model.providerID)) : undefined,
            footer: trailing(model, favorite),
            free: isFreeModel(model),
            detail: () => <ModelDetail model={model} usage={usage(model)} />,
            onSelect() {
              props.onSelect(model.providerID, model.id)
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
      const results = prioritizeFavorites(
        sortModelOptions(
          fuzzysort.go(needle, modelOptions, { keys: ["title", "category"] }).map((item) => item.obj),
          false,
        ),
        favoritePriority,
      )
      const llamacppMatches = llamacppOptions.filter((option) =>
        option.title.toLowerCase().includes(needle.toLowerCase()),
      )
      // Search results name the provider inline. Without a category, the trailing slot keeps the favorite marker
      // instead of falling back to the provider name.
      if (!newDesigns()) return [...results, ...llamacppMatches]
      return [
        ...results.map((option) => ({ ...option, description: option.providerName, category: undefined })),
        ...llamacppMatches,
      ]
    }

    return [
      ...favoriteOptions,
      ...recentOptions,
      ...modelOptions.filter((option) => option.category !== "Free"),
      ...modelOptions.filter((option) => option.category === "Free"),
      ...llamacppOptions,
    ]
  })

  const provider = createMemo(() => (props.providerID ? providers().get(props.providerID) : undefined))

  const title = createMemo(() => {
    const value = provider()
    if (!value) return "Select model"
    return value.name
  })

  return (
    <DialogSelect<ReturnType<typeof options>[number]["value"]>
      searchInTitle
      titlePlaceholder="Search models"
      options={options()}
      actions={[
        {
          command: "model.dialog.provider",
          title: newDesigns()
            ? connected()
              ? "connect integration"
              : "view all integrations"
            : connected()
              ? "Connect an integration"
              : "View all integrations",
          selection: "none",
          onTrigger: props.onConnect,
        },
        {
          command: "model.dialog.usage",
          title: newDesigns() ? "usage" : "Usage",
          selection: "none",
          hidden: !limits.info(),
          onTrigger: () => dialog.replace(() => <DialogUsage />),
        },
        {
          command: "model.dialog.favorite",
          title: newDesigns() ? (option) => (isFavorite(option?.value) ? "unfavorite" : "favorite") : "Favorite",
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
    />
  )
}
