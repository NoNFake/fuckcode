- Regenerate the legacy JavaScript SDK with `./packages/sdk/js/script/build.ts`.
- After changing the public Protocol or Server `HttpApi`, run `bun run generate` from `packages/client`. Do not edit `src/generated` or `src/generated-effect`.
- Keep runtime dependencies directed Schema -> Core/Protocol -> Server. Client runtime may depend on Schema and Protocol, never Core or Server.
- Default branch is `dev`. Local `main` may not exist; use `dev` or `origin/dev` for diffs.

## Branch Names

Short, max three hyphen-separated words. No slashes or `feat/`/`fix/` prefixes. Examples: `session-recovery`, `fix-scroll-state`.

## Commits and PR Titles

Conventional: `type(scope): summary`. Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`. Scope optional; use the affected package (`core`, `opencode`, `tui`, `app`, `desktop`, `sdk`, `plugin`). Examples: `fix(tui): simplify thinking toggle styling`, `chore(sdk): regenerate types`.

## Style Guide

- Keep things in one function unless composable or reusable. Do not extract single-use helpers preemptively; inline at the call site unless reused, hides a genuinely complex boundary, or the name improves the caller.
- Avoid `try`/`catch` where possible. Avoid `any`.
- Use Bun APIs, e.g. `Bun.file()`.
- Rely on type inference; avoid explicit annotations or interfaces unless needed for exports or clarity.
- Prefer `flatMap`/`filter`/`map` over loops; use type guards on `filter` to keep inference downstream.
- In `src/config`, follow the self-export pattern (`export * as ConfigAgent from "./agent"`) for new config modules.
- In Effect generators, bind services to named variables first; never `yield* (yield* Foo.Service).bar()`.
- Inline values used once to reduce variable count.

### Destructuring

Prefer dot notation over destructuring.

### Imports

- Never alias or rename imports (`import { foo as bar }`).
- Never use star imports (`import * as Foo`), including `import type * as`.
- For a namespace value, import the module's own exported namespace by name: `import { Project } from "@opencode-ai/core/project"`, then `Project.ID`.
- Prefer dynamic imports for heavy, path-specific modules, especially in startup-sensitive entrypoints. Destructure the import near the top of the narrowest scope; avoid inline chains like `await import("./m").then((m) => m.value())`. Keep branch-specific imports inside their branch.

### Variables

Prefer `const`. Use ternaries or early returns instead of reassignment.

### Control Flow

Avoid `else`; prefer early returns.

### Complex Logic

Make the main function read as the happy path; move validation branches and supporting details into small helpers below it.

- Keep helpers close to their code.
- Do not over-abstract simple expressions; extract only for real concepts like `requireConfig`.
- Do not return `Effect` from helpers unless they do effectful work. Synchronous parsing, validation, and option building stay synchronous.
- For untrusted JSON, prefer `Schema.UnknownFromJsonString` and `Schema.decodeUnknownOption` over `JSON.parse` inside `Effect.try`.
- Comment non-obvious constraints and surprising behavior, not obvious code.

### Schema Definitions (Drizzle)

Use snake_case fields so column names are not restated.

```ts
const table = sqliteTable("session", {
  id: text().primaryKey(),
  project_id: text().notNull(),
  created_at: integer().notNull(),
})
```

## Testing

- Avoid mocks; never use `globalThis.*` unless it is the only option.
- Test the real implementation; do not duplicate logic in tests.
- Tests do not run from the repo root (guard: `do-not-run-tests-from-root`); run from package dirs like `packages/opencode`.

## Type Checking

Run `bun typecheck` from package directories (e.g. `packages/opencode`), never `tsc`.

## V2 Session Core

- Keep durable prompt admission separate from model execution. `SessionV2.prompt(...)` admits one durable `session_input` row, then schedules advisory `SessionExecution.wake(sessionID)`, unless `resume: false` requests admit-only. The serialized runner promotes admitted inputs to visible user messages at safe boundaries.
- Reusing a Session ID adopts the Session. Reusing a prompt message ID reconciles an exact retry only when Session, prompt, and delivery mode match; conflicting reuse fails. Historical projected prompts lazily synthesize promoted inbox records on exact retry.
- Keep `SessionExecution` process-global and Session-ID based. Its local implementation owns the process-local coordinator and discovers placement through `SessionStore` plus `LocationServiceMap.get(session.location)` only when a drain starts; no layer takes a Session ID. V2 interruption targets the active process-local ownership chain; idle or missing interruption is a no-op.
- Keep `SessionRunner`, model resolution, tool registry, permissions, and filesystem Location-scoped. Omitted `Location.workspaceID` means implicit-local placement; explicit workspace identity is reserved for future placement.
- Preserve one `llm.stream(request)` call per provider turn and reload projected history before durable continuation. Do not bridge through legacy `SessionPrompt.loop(...)` or an in-memory tool loop.
- Keep local Session drains process-local until clustering. `SessionRunCoordinator` joins explicit same-Session resumes, coalesces prompt wakeups, and runs different Sessions concurrently. Advisory wakes drain eligible durable inbox rows only; post-crash continuation recovery needs a separate explicit design before retrying provider work. A drain has no durable identity or transcript boundary.
- Keep delivery vocabulary explicit. Prompts steer by default and promote at the next safe provider-turn boundary while the drain requires continuation. A `queue` input stays pending until the Session would be idle; promote one queued input at that boundary, then reevaluate continuation. Promoting new user input resets the selected agent's provider-turn allowance; a batch of steers resets it once.
- Keep EventV2 replay owner claims separate from clustered Session execution ownership.
- Keep the System Context algebra, registry, and built-ins in `src/system-context`; keep Context Source producers with their observed domains, and Session History selection plus Context Epoch persistence Session-owned.
