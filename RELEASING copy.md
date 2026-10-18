# Releasing

This repository releases CLI binaries for every supported platform through GitHub Actions. The release version comes from the tag name, not from `package.json`.

## 1. Prepare

- Land all changes on `dev`, commit them, and make sure the working tree is clean.
- Push `dev` so the release commit exists on the remote.
- Pick the next version tag, for example `v1.4.5` (`v<major>.<minor>.<patch>`).
- Draft the release description in the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format used by [CHANGELOG.md](./CHANGELOG.md).

## 2. Verify locally before tagging

Build one platform and run the smoke test so CI is not the first check:

```bash
OPENCODE_VERSION=1.4.5 BINARY_NAME=fuckcode bun run script/build.ts --single --skip-ui --skip-install
```

`--skip-ui` and `--skip-install` keep this fast; CI builds the embedded web UI and cross-platform native dependencies.

## 3. Tag and push

Create an annotated tag on the release commit and push it. The `release.yml` workflow triggers on any pushed `v*` tag.

```bash
# New tag
git tag -a v1.4.5 <sha> -m "v1.4.5"
git push origin v1.4.5

# Move an existing tag (for example to pick up a CI fix)
git tag -f -a v1.4.5 <sha> -m "v1.4.5"
git push -f origin v1.4.5
```

## 4. Watch the build

The workflow builds 12 targets under `packages/opencode/dist` and runs `gh release create` with auto-generated notes.

```bash
gh run list --workflow release --repo NoNFake/fuckcode
gh run watch <run-id> --repo NoNFake/fuckcode --exit-status
```

If a step fails, read the failed log with `gh run view <run-id> --repo NoNFake/fuckcode --log-failed`.

## 5. Replace the release notes

CI always publishes `--generate-notes`, so overwrite the body with the changelog file:

```bash
gh release edit v1.4.5 --repo NoNFake/fuckcode --notes-file notes.md
```

## 6. Verify the release

```bash
gh release view v1.4.5 --repo NoNFake/fuckcode --json isDraft,tagName,assets --jq '{tagName,isDraft,assets:[.assets[].name]}'
```

Expected assets: `fuckcode-linux-{x64,arm64}[-baseline][-musl].tar.gz`, `fuckcode-darwin-{x64,arm64}[-baseline].zip`, `fuckcode-windows-{x64,arm64}[-baseline].zip`, and `sha256.txt`.

## CI requirements

The release build depends on two root-level peer packages. Do not remove them:

- `@opentui/solid` must be a root devDependency so `bunfig.toml` can load its preload.
- `@opentelemetry/sdk-trace-node` must stay in `packages/opencode` dependencies; `@effect/opentelemetry` imports it at bundle time.
