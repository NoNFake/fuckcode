# opencode database guide

## Database

- Schema: Drizzle lives in `packages/core/src/**/*.sql.ts`.
- Migrations: live in `packages/core` and are applied by core.

## Development server

- `bun dev` from `packages/opencode` starts the live TUI. Do not run it blocking in the foreground.
- Run it in tmux: `tmux new-session -d -s opencode-dev 'bun dev'`.
- Capture output: `tmux capture-pane -pt opencode-dev`.
- Stop it: `tmux kill-session -t opencode-dev`.

# Module shape

Do not use `export namespace Foo { ... }`. It is not standard ESM, prevents tree-shaking, and breaks Node's TypeScript runner. Use flat top-level exports plus a self-reexport at the bottom:

```ts
// src/foo/foo.ts
export interface Interface { ... }
export class Service extends Context.Service<Service, Interface>()("@opencode/Foo") {}
export const layer = Layer.effect(Service, ...)
export const defaultLayer = layer.pipe(...)

export * as Foo from "./foo"
```

Consumers import the namespace projection:

```ts
import { Foo } from "@/foo/foo"
yield * Foo.Service
Foo.layer
```

Namespace-private helpers stay non-exported top-level declarations in the same file.

## When the file is an `index.ts`

For `foo/index.ts` (single-namespace directory), self-reexport with `"."`:

```ts
export * as Foo from "."
```

## Multi-sibling directories

For independent modules in one directory (e.g. `src/session/`, `src/config/`), keep each sibling as its own file with its own self-reexport and no barrel `index.ts`. Import the specific sibling:

```ts
import { SessionRetry } from "@/session/retry"
```

Barrels force every import to evaluate every sibling, defeating tree-shaking and slowing module load.

# opencode Effect rules

Apply when writing or migrating Effect code. See `specs/effect/migration.md` for patterns.

## Core

- Use `Effect.gen(function* () { ... })` for composition.
- Use `Effect.fn("Domain.method")` for named/traced effects; `Effect.fnUntraced` for internal helpers.
- `Effect.fn` accepts pipeable operators as extra arguments; avoid outer `.pipe()` wrappers.
- Use `Effect.callback` for callback APIs.
- Use `Effect.void`, not `Effect.succeed(undefined)`.
- Prefer `DateTime.nowAsDate` over `new Date(yield* Clock.currentTimeMillis)`.

## Module conventions

- In `src/config`, follow the self-export pattern (`export * as ConfigAgent from "./agent"`) for new modules.

## Schemas and errors

- `Schema.Class` for multi-field data; `Schema.brand` for single values; `Schema.TaggedErrorClass` for typed errors; `Schema.Defect` instead of `unknown` for defects.
- In `Effect.gen`/`Effect.fn`, prefer `yield* new MyError(...)` over `yield* Effect.fail(new MyError(...))`.

## Runtime vs InstanceState

- Use `makeRuntime` (`src/effect/run-service.ts`) for all services; it returns `{ runPromise, runFork, runCallback }` backed by a shared `memoMap` that deduplicates layers.
- Use `InstanceState` (`src/effect/instance-state.ts`) for per-directory or per-project state with per-instance cleanup. It uses a `ScopedCache` keyed by directory, cleaned on disposal.
- If two open directories must not share a service copy, it needs `InstanceState`.
- Do the work directly in the `InstanceState.make` closure; `ScopedCache` handles run-once. Do not add fibers, `ensure()` callbacks, or `started` flags.
- Use `Effect.addFinalizer` or `Effect.acquireRelease` inside the closure for cleanup.
- Use `Effect.forkScoped` inside the closure for background stream consumers.
- To make `init()` non-blocking, fork `InstanceState.get(state)` at the call site (`Effect.forkIn(scope)`), never inside the closure.
- `src/project/bootstrap.ts` wraps every service `init()` in `Effect.forkDetach`, so `init()` is fire-and-forget in production. Keep `init()` synchronous internally; the caller controls concurrency.

## Effect v4 beta API

- `Effect.fork` and `Effect.forkDaemon` do not exist. Use `Effect.forkIn(scope)`.

## Preferred Effect services

- Prefer yielding existing Effect services over ad hoc platform APIs.
- Prefer `FileSystem.FileSystem` over raw `fs/promises`.
- Prefer `ChildProcessSpawner` with `ChildProcess.make(...)` over custom process wrappers.
- Prefer `HttpClient` over raw `fetch`.
- Prefer `Path.Path`, `Config`, `Clock`, `DateTime` where already in Effect scope.
- For background loops, use `Effect.repeat`/`Effect.schedule` with `Effect.forkScoped` in the layer.

## Effect.cached for deduplication

Use `Effect.cached` to share a single in-flight computation among concurrent callers instead of manual `Fiber | undefined`/`Promise | undefined`. See `specs/effect/migration.md`.

## Callback boundaries

Use `EffectBridge` for native/external callbacks (`@parcel/watcher`, `node-pty`, `fs.watch`, plugin callbacks) that re-enter Effect services with instance/workspace context.

Plain async code passes explicit context or stays inside an Effect fiber; do not add ambient instance context shims.
