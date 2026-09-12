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
