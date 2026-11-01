# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## How to maintain this file

- Put unreleased work under `## [Unreleased]`. Never rewrite or reorder released sections.
- Group entries under Keep a Changelog categories: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.
- One bullet per user-facing change. Write what changed for the user, not the internal code move.
- Skip commits that are only CI, tests, chores, refactors, or otherwise invisible to users.
- Do not copy commit prefixes (`fix:`, `feat:`) or trailing PR numbers.
- Only keep an `(@username)` suffix when the change author is an external contributor. Never invent one.
- On release, move the `Unreleased` entries under `## [x.y.z] - YYYY-MM-DD` and open a fresh empty `## [Unreleased]`.

Release notes in this repository are generated from git history, not hand-written:

- `bun script/raw-changelog.ts` builds the filtered, grouped commit input since the last non-draft release.
- Run the `changelog` command (`.opencode/command/changelog.md`) over that input to write `UPCOMING_CHANGELOG.md`.
- `script/version.ts` attaches `UPCOMING_CHANGELOG.md` to the GitHub release at publish time.

## [Unreleased]

### Added

- The prompt footer shows the session's context tokens and percent used, its spend, and OpenCode Go day, week and month usage on one line.

### Fixed

- `fuckcode upgrade` downloads the installer for the target version; it requested a literal `${version}` URL and failed with HTTP 404.

## [2.0.2] - 2026-11-01

### Added

- The model picker shows each model's Artificial Analysis Intelligence Index score, green for frontier models, orange for mid-tier and red for low-tier.
- The model picker shows each model's price on every row, not only on the highlighted model.
- The prompt footer shows OpenCode Go usage as rolling, weekly and monthly percentages.

### Changed

- Synced with upstream OpenCode dev (2.2.5): session and model code, the tool loop, the request pipeline and the usage limits moved to upstream's structure.
- The model detail bar (price, modalities, context and reasoning) is always shown in the model picker; it no longer needs the `new-designs` experiment.

### Fixed

- Windows managed-service ports move out of the ranges Windows and WSL reserve, so the service no longer fails as "in use" while nothing listens on it.
- Concurrent writers of the service configuration no longer overwrite each other's temporary file.

## [2.0.1] - 2026-10-18

### Changed

- Synced with upstream OpenCode dev (2.0.32). The upstream dialog redesign and the `opencode2` theme stay behind the `new-designs` experiment; theme `opencode` keeps its 2.0.0 palette by default.
- PowerShell installations are recognized by `fuckcode upgrade`, so they update in place.

### Fixed

- The knowledge store keeps the newest learned rules and false-positive patterns once a list is full; new entries were silently dropped before.
- The eco toggle applies immediately; it previously took effect only after a restart.
- Crash-recovery job records expire after 7 days instead of accumulating forever.
- Long-running tools are no longer interrupted as "inactivity" while the session still emits events.
- Failed or partial downloads no longer look like successful installs; the installer fails loudly on empty archives and uses a private temp directory.
- The release workflow can be re-run and fails when a build output or archive is missing; `script/release.ts` triggers the fork's `release.yml` with an explicit version.
- TUI footer hints keep their normal contrast while a dialog is open, and the resize listener warning no longer appears in settings.

### Security

- Pentest scope is enforced in the sandbox for domain-only engagements: outbound traffic is denied by default, only addresses resolved through the scope resolver are allowed, `ip6` traffic is filtered, and the resolver itself stays reachable. Bare hostnames and IPv6 literals can no longer leave scope.
- `upgrade --method curl` fetches the installer from the release tag instead of the `dev` branch, and both installers verify the download against the published `sha256.txt`.
- `report_gen` refuses to write outside the working directory; `binary patch` obeys `reverse.allowedDirs` and never overwrites the original file.

### Removed

- Unused dependencies in `gui-extensions`, `desktop` and `session-ui`, and three unused `session-ui` component exports.

## [2.0.0] - 2026-10-13

### Added

- Migrated FuckCode to the OpenCode 2.0 core: rewritten session engine, CLI, TUI and plugin system.
- Pentest tool suite rebuilt on the 2.0 tool API: `pentest_shell`, `recon`, `inject_probe`, `chain`, `oob`, `os_hook`, `ensure_tools`, `filename_bypass`, `knowledge_update`, `read_evidence`, `report_gen`, `scan_import`, `scope_import`, `session`, `state_update`. Tools load when `FUCKCODE_PENTEST=1` or `pentest.enabled` is true.
- `binary` reverse-engineering tool on the 2.0 tool API: info, sections, imports, exports, functions, strings, entropy, disassembly, decompilation, cross-references, byte search, patching a copy, and ESIL emulation. Loads when `FUCKCODE_REVERSE=1` or `reverse.enabled` is true.
- Eco mode: `token_saving` config section, `/eco` dialog and footer/sidebar indicators, smaller read limits, tool-output truncation thresholds, and pruning of stale tool results in prompt history.
- llama.cpp local provider: models are discovered from the server's `/v1/models`, the model dialog offers "Set llama.cpp Server URL...", and `fuckcode auth login llamacpp` saves the URL.
- 32 pentest skills ship embedded in the binary; `/report` and `/reflect` commands; `reflector` agent for post-engagement reflection.
- Unverified-claims report dialog: the prompt footer shows a warning that opens references without matching tool results.

### Changed

- Config discovery accepts `fuckcode.json`, `fuckcode.jsonc` and `.fuckcode/` directories alongside the `opencode` names; new global config files are created as `fuckcode.jsonc`.
- CLI is branded `fuckcode` and release archives are named `fuckcode-<os>-<arch>[-baseline][-musl]` (`.tar.gz` on Linux, `.zip` elsewhere) with a `sha256.txt` checksum file.
- The red FuckCode accent palette moved to the 2.0 theme format (accent, interactive, red, orange, cyan, blue, purple hues).
- Pentest and reverse settings are read live from the `pentest` and `reverse` config sections.

### Removed

- Upstream CI workflows and translated README files that the fork does not use.

## [1.4.7] - 2026-10-09

### Added

- Pentest exploit chain library and forge: named multi-step chains with CVE and remediation metadata.
- Pentest recon steps for ProjectDiscovery tools and nmap.

### Changed

- Pentest evidence and exploit chains are stored under `~/.fuckcode/` (`pentest-evidence`, `chains`) instead of the opencode data directory. Existing data is not migrated.
- Pentest sandbox DNS upstream is configurable with `pentest.dnsUpstream` (default `1.1.1.1`).
- Synced with upstream OpenCode v1.18.35: free Zen models proxy to the new inference backend, Haiku 5.5 and Sonnet 5.5 are listed in Zen and Go model tables, Mistral Large 4 and Exo Free are added to Zen, monthly inference spend is captured, and the OpenAI `ultrafast` service tier is accepted.

### Fixed

- TUI question prompt submits on Confirm after the custom answer editor was opened.
- Pentest sandbox isolation works without root: the `unshare` fallback runs in an unprivileged user namespace.
- Pentest sandbox kills the whole sandboxed process group on timeout or cancel, not only the wrapper.
- Pentest sandbox reports spawn failures instead of crashing the process.
- Pentest sandbox network rules load: the blocked-traffic log prefix is quoted correctly.
- Sandbox CI fails when network isolation cannot be tested, instead of passing silently.
- Stats attribute Exo usage to an unknown provider and hide models listed in a secret.
- xAI tool-result images are sent correctly (`@ai-sdk/xai` 3.0.139).

## [1.4.6] - 2026-09-29

### Added

- Source builds on Android (Termux): `lightningcss` is pinned to a release that ships Android arm64 binaries.

### Changed

- Synced with upstream OpenCode v1.18.33: Cloudflare AI Gateway models honor provider timeouts, MCP browser launcher failures surface correctly, `debug config` redacts credentials, Gemini thinking defaults were updated, TogetherAI streams report usage, and Bedrock tool images are kept except for Claude and Nova. OpenAI Codex allows GPT-6 Sol and Luna.
- TUI no longer loads the decorative background image by default, which also shortens startup.

## [1.4.5] - 2026-09-19

### Added

- `binary` tool for reverse engineering: `emulate` runs instructions in radare2's ESIL VM, `entropy` reports per-section entropy, `functions` lists ELF functions, `patch` accepts assembly through rasm2, and hardening reports no longer require `checksec`.
- Reverse engineering tools load only when the reverse config is enabled, with allowed-directory validation.
- Update check in the TUI: the footer reports when a newer FuckCode release is available.

### Changed

- Embedded skill catalog trimmed from 40 to 30 entries; stale skills are pruned when materialized, reducing prompt size.
- Skill checks reject boilerplate content and remote scripts piped into a shell.
- Synced with upstream OpenCode v1.18.31, including clearer TUI startup authentication errors and refreshed provider dependencies.

### Fixed

- Remote authentication failures during TUI startup now surface an actionable error instead of a generic failure.

[1.4.7]: https://github.com/NoNFake/fuckcode/compare/1.4.6...1.4.7
