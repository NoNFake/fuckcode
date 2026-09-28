# FuckCode

FuckCode is a fork of [OpenCode](https://github.com/anomalyco/opencode) built for security auditing, penetration testing, reverse engineering, and infrastructure vulnerability assessment.

![fuckcode](https://github.com/NoNFake/fuckcode/raw/dev/.github/logo.png)

## Features

- **Local models (llama.cpp)**: connect to a local `llama-server` without boilerplate JSON, discover models from `/v1/models`, and set the server URL from the model picker (`Ctrl+P`).
- **Token efficiency**: ANSI and progress stripping from tool output, capped tool output with full logs on disk, pruning of stale tool results, and eco mode (`--token-saving` / `--eco`, or `token_saving` in config) with moderate and aggressive caps.
- **Verification indicator**: the footer shows `verify N` when assistant text references files that no tool result confirms. This is a heuristic prompt to verify, not proof of hallucination.
- **Security skill catalog**: 30+ embedded skills covering engagement phases, services, playbooks, web vulnerability classes, API/cloud/CI-CD/deserialization classes, fuzzing, AI security, and reverse engineering. Skills load on demand based on task context.
- **Reverse engineering tools**: `binary` tool with `emulate` (radare2 ESIL), `entropy`, `functions`, `patch` (rasm2), and hardening reports; loads only when the reverse config is enabled.
- **Pentest module**: sandboxed execution, scope enforcement, evidence store, structured parsing, and report generation (details below).
- **Red and black theme**: high-contrast palette with project and global config discovery for `fuckcode.json` and `fuckcode.jsonc`.

## Quick start

FuckCode requires [Bun](https://bun.sh):

```bash
bun install
bun run dev                                  # interactive TUI from source
bun run script/build.ts --single --skip-ui   # build a local binary
```

### Local model (llama.cpp)

```bash
./llama-server -m /path/to/model.gguf --port 8080 -c 32768
bun run dev
```

Open the model picker with `Ctrl+P`. Models on `http://127.0.0.1:8080` are detected automatically; use "Set llama.cpp Server URL..." for other hosts.

## Configuration

Project `fuckcode.json` or global `~/.config/fuckcode/fuckcode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "llamacpp": {
      "baseURL": "http://127.0.0.1:8080/v1"
    }
  }
}
```

Pentest scope:

```json
{
  "pentest": {
    "enabled": true,
    "sandboxTimeout": 30000,
    "scope": {
      "domains": ["target.corp", "*.target.corp"],
      "cidrs": ["10.0.0.0/8", "172.16.0.0/12"],
      "ports": [80, 443],
      "children": {
        "web": { "domains": ["web.target.corp"], "ports": [80, 443, 8080, 8443] }
      }
    }
  }
}
```

## Security skills

The agent loads skills on demand from the embedded catalog:

- **Phases**: recon, enumeration, vulnerability assessment, exploitation, post-exploitation, reporting.
- **Services**: SSH, SMB, DNS, database, Docker/Kubernetes, FTP, mail, pivoting.
- **Playbooks**: web application, Active Directory, cloud, infrastructure.
- **Web classes**: SQL injection, auth bypass and IDOR, upload RCE, SSTI, SSRF, XXE, LFI and traversal, deserialization.
- **Other**: API security, cloud, CI/CD pipelines, fuzzing, AI security, bug identification, vulnerability classes, fast checking, Effect v4 patterns for this codebase.

Example prompts:

- "Perform active reconnaissance and port discovery on 192.168.1.50"
- "Test http://target.local/api/item?id=1 for SQL injection and XSS"
- "Enumerate shares, users, and permissions on 10.10.10.10"
- "Generate a structured security assessment report with CVSS scoring and remediation steps"

## Pentest module

- **Sandbox**: rootless namespace wrapper (pasta, slirp4netns, or unshare) with egress restricted to scope.
- **DNS whitelist**: embedded forwarder answers NXDOMAIN for out-of-scope domains and blocks DoH/DoT bypasses.
- **Scopes**: hierarchical child scopes with inherited constraints and subagent `scope_override`.
- **Evidence store**: SQLite WAL with FTS5 trigram search, transaction batching, and deduplication.
- **Parsers**: nmap, nuclei, cme, ffuf, sqlmap, nikto, whatweb, Burp, HAR, OpenAPI, recon.
- **Tools**: `read_evidence`, `state_update`, `report_gen`, `inject_probe`, `filename_bypass`, `oob`, `recon`, `scan_import`, `scope_import`, `ensure_tools`, `os_hook`, `session`, `knowledge_update`, plus the `/report` command.
- **Reports**: markdown, JSON, and SARIF output with evidence chains.

Tests:

```bash
bun test src/pentest/__tests__/
```

## Development

```bash
bun run --cwd packages/opencode typecheck
bun run --cwd packages/tui typecheck
bun run --cwd packages/core typecheck
bun run lint
```

Run tests from package directories, for example `bun test` in `packages/opencode`.

## Upstream

FuckCode tracks upstream OpenCode through `bun run sync` and adds the security tooling on top. See [CHANGELOG.md](./CHANGELOG.md) for release notes.
