# FORK.md — FuckCode fork notes for LLM agents

FuckCode is a fork of [anomalyco/opencode](https://github.com/anomalyco/opencode) ("upstream"), distributed from
`NoNFake/fuckcode`. It is the same Bun/TypeScript monorepo (CLI, TUI, server, core) with security-tooling
additions and its own release pipeline. Product overview: `README.md`. Contribution rules: `AGENTS.md`.

## What this fork adds or changes

| Area | Where | Why it matters |
| --- | --- | --- |
| Pentest tools (`pentest_shell`, scope import, report gen, chains, OOB, evidence) | `packages/core/src/pentest/` | Scope enforcement runs in `sandbox.ts` (nft deny-by-default + DNS forwarder allow-set). Do not weaken it. |
| Reverse-engineering tools | `packages/core/src/reverse/` | `reverse.allowedDirs` and `allowPatch`; patching never overwrites the original file. |
| Token saving / eco mode | `packages/core/src/tool-output.ts`, `token-saving-state.ts`, `config/plugin/tool-output.ts` | TUI writes the toggle to a state file; the worker reloads caps when it changes. Do not cache the toggle at startup. |
| Verify indicator (`verify N`) | `packages/tui/src/util/verify.ts`, prompt footer | Heuristic only; it is not a correctness proof. |
| Security skill catalog | `.opencode/skills/` | Loaded on demand by task context. |
| Fork red palette | `packages/tui/src/theme/assets/v2/opencode.json` | Brand accent is red. Keep it while upstream adds themes. |
| Distinct service ports | `packages/cli/src/services/service-config.ts` | `0xf0c0` (releases) / `0xf0c1` (local) so FuckCode and upstream OpenCode can run side by side. |
| Own installer / updater | `install`, `install.ps1`, `packages/cli/src/services/updater.ts` | Installer is fetched from the release tag, never `dev`, and both installers verify the published `sha256.txt`. |
| Own versioning | root and `packages/cli/package.json` | Fork release line (`2.0.0`), independent of upstream dev versions. |
| Own release workflow | `.github/workflows/release.yml` | Built by `script/build.ts`, assets `fuckcode-*` plus `sha256.txt`. Upstream publish/deploy workflows are deleted here and must stay deleted. |

## Updating from upstream

```sh
bun run sync        # script/sync-upstream.sh: fetch upstream/dev, merge into the current branch, bun install
```

Expect conflicts in the files below. Resolution policy:

- `.github/workflows/deploy.yml`, `publish.yml`, `nix-hashes.yml` (and siblings): keep deleted. This fork uses `release.yml`.
- `CHANGELOG.md`: keep the fork file. Do not import upstream release sections.
- `package.json`, `packages/cli/package.json`, `bun.lock`: take the upstream file, then re-apply the fork
  description (root), version `2.0.0` (root and CLI), the `fuckcode` bin entry, and the `sync` / `build` / `build:all` scripts.
  Run `bun install` afterwards.
- `packages/cli/src/services/service-config.ts`: keep the fork ports, keep upstream's platform handling
  (Windows remaps ports `0xC000-0xFFFF` into the `0xB000` block). Update `packages/cli/test/service.test.ts` expectations with it.
- `install`, `install.ps1`: keep `NoNFake/fuckcode` naming and checksum verification; accept upstream download/progress fixes.
- `packages/tui/src/theme/assets/v2/opencode.json`: keep the fork palette overrides; upstream may add tokens. A missing
  token resolves to a default, usually a dim gray — add the fork value rather than deleting the token.
- TUI components: when upstream adds a new look behind the `new-designs` experiment, the fork style stays the
  default path. The prompt footer hints must not fade with `TextAttributes.DIM`; that reads as broken "thin" text on some terminals.

After resolving:

```sh
bun install
bun typecheck            # per affected package (cli, core, tui, ...), never tsc directly, never from root
bun test                 # must run from a package directory
bun run check            # canonical lint + typecheck from the repo root
```

## Releasing

```sh
bun script/release.ts 2.0.1   # prompts, then triggers .github/workflows/release.yml on dev
```

The workflow builds all platforms (`bun run build:all`), fails when a build output is missing, packages
`fuckcode-<os>-<arch>.*` into `dist/`, writes `sha256.txt`, and creates the `v<version>` GitHub release.
Re-running is safe: an existing release is left alone.

## Invariants to keep while editing

1. Pentest scope is enforced in the sandbox, not only by command parsing. Keep the nft allow-sets, the IPv6 table,
   the resolver allow rule, and the DNS forwarder adding each resolved address; the pre-check stays best-effort.
2. Downloads verify `sha256.txt`; upgrades install the installer from `v<version>`, never from a branch.
3. `report_gen` writes inside the working directory only; `reverse_binary patch` stays inside `reverse.allowedDirs`
   and never writes over the original file.
4. Cap-evicted lists keep the newest entries (`knowledge.ts`).
5. Crash-recovery job records expire; do not reintroduce an unbounded `job.background/` key space.
6. Never edit generated client files; run `bun run generate` from `packages/client` after protocol or server API changes.
7. Follow `AGENTS.md` for theme tokens, session-core rules, branch names, and commit style.

## Provenance

- Upstream: `https://github.com/anomalyco/opencode`, branch `dev`.
- Remote name in a clone of this fork: `upstream` (added by the sync script).
- The sync script merges `upstream/dev`; it does not rebase and does not push.
