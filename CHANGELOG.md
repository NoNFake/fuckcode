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
