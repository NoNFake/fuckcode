# Contributing to FuckCode

FuckCode is a fork of [OpenCode](https://github.com/anomalyco/opencode) focused on security auditing, penetration testing, and coding assistance. Contributions that fit that direction are welcome:

- Bug fixes
- Pentest and security tooling improvements
- Context window, token efficiency, and performance work
- Additional LSPs / formatters
- Provider support
- Documentation improvements

Open an issue before large features so the direction can be discussed.

## Cloning

The repository carries the full upstream OpenCode history, so a regular clone is heavy. Use a blobless partial clone to avoid downloading historical blobs:

```bash
git clone --filter=blob:none https://github.com/NoNFake/fuckcode.git
```

Git fetches file contents on demand afterward.

## Developing FuckCode

- Requirements: Bun 1.3+
- Install dependencies and start the dev TUI from the repo root:

  ```bash
  bun install
  bun dev
  ```

### Running against a different directory

By default, `bun dev` runs FuckCode in the `packages/opencode` directory. To run it against a different directory:

```bash
bun dev <directory>
```

To run it in the root of this repo:

```bash
bun dev .
```

### Building a standalone executable

```bash
./packages/opencode/script/build.ts --single
```

Then run it:

```bash
./packages/opencode/dist/fuckcode-<platform>/bin/fuckcode
```

Replace `<platform>` with your platform (e.g. `darwin-arm64`, `linux-x64`).

To build every platform and produce release archives:

```bash
bun run build:all
```

### Core packages

- `packages/opencode`: core business logic and server.
- `packages/tui`: the TUI, written in SolidJS with [opentui](https://github.com/sst/opentui).
- `packages/app`: shared web UI components, written in SolidJS.
- `packages/desktop`: native desktop app, built with Electron.
- `packages/plugin`: source for `@opencode-ai/plugin`.

### API server

```bash
bun dev serve
```

The headless server listens on port 4096 by default. Use `--port` to change it.

### Web app

Start the server, then:

```bash
bun run --cwd packages/app dev
```

### Desktop app

```bash
bun run --cwd packages/desktop dev
```

> [!NOTE]
> If you change the API or SDK, run `./script/generate.ts` to regenerate the SDK and related files.

Follow the [style guide](./AGENTS.md).

## Pull Requests

- Keep pull requests small and focused.
- Explain the issue and why the change fixes it.
- Link the issue with `Fixes #123` or `Closes #123`.
- For UI changes, include before/after screenshots.
- For logic changes, explain how you verified the change.
- Prefer short descriptions over long generated text.

### Titles

Use conventional commit style:

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation
- `chore:` maintenance, dependency updates
- `refactor:` behavior-preserving refactor
- `test:` tests

Optional scope, e.g. `feat(app):`, `fix(desktop):`, `chore(opencode):`.

### Style preferences

- Keep logic in one function unless a split adds clear reuse.
- Avoid unnecessary destructuring and `else` statements.
- Reach for precise types and avoid `any`.
- Prefer immutable patterns over `let`.
- Use Bun helpers such as `Bun.file()` where they fit.
- Follow `AGENTS.md` for package conventions.

## Feature Requests

Open an issue describing the problem, the proposed approach, and why it belongs in FuckCode. Wait for approval before opening a large feature PR.
