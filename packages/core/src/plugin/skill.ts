/// <reference path="../markdown.d.ts" />

export * as SkillPlugin from "./skill"

import { define } from "./internal"
import { Effect } from "effect"
import { AbsolutePath } from "../schema"
import { SkillV2 } from "../skill"
import customizeOpencodeContent from "./skill/customize-opencode.md" with { type: "text" }

export const CustomizeOpencodeContent = customizeOpencodeContent

export const Plugin = define({
  id: "skill",
  effect: Effect.fn(function* (ctx) {
    yield* ctx.skill.transform((draft) => {
      draft.source(
        SkillV2.EmbeddedSource.make({
          type: "embedded",
          skill: SkillV2.Info.make({
            name: "customize-fuckcode",
            description:
              "Use ONLY when the user is explicitly editing or creating FuckCode's own configuration files: fuckcode.json, fuckcode.jsonc, files under .fuckcode/, or files under ~/.config/fuckcode/. Do not use for general questions, user tasks, pentest tasks, or coding.",
            location: AbsolutePath.make("/builtin/customize-fuckcode.md"),
            content: CustomizeOpencodeContent,
          }),
        }),
      )
    })
  }),
})
