# FuckCode

> **FuckCode** is a specialized fork of [OpenCode](https://github.com/anomalyco/opencode) engineered for **security auditing, penetration testing, reverse engineering, and infrastructure vulnerability assessment**.

---

<p align="center">
  <img src="https://github.com/NoNFake/fuckcode/raw/dev/.github/logo.png" alt="fuckcode" />
</p>

## Key Features & Fork Highlights

1. **Native `llama.cpp` Integration**:
   - Out-of-the-box connection to local `llama-server` instances without complex boilerplate JSON.
   - Dynamic model discovery from `/v1/models`.
   - Interactive server URL configuration (`http://127.0.0.1:8080`) directly from the model picker dialog (`Ctrl+P`).

2. **Context Window & Token Efficiency**:
   - Automatic terminal output sanitization (stripping ANSI color codes, progress animations, and escape sequences).
   - Deterministic tool output capping with full raw output logging to disk.
   - Intelligent pruning of stale tool results from historical turns to maintain prompt cache locality and avoid context overflow.
   - **Eco mode** (`--token-saving` / `--eco`, or `token_saving` in config): caps tool output (moderate 80 lines / 16 KB, aggressive 40 / 8 KB), serves a compact skill list, and skips re-reading an unchanged file slice that is still present in message history.
   - **Verification indicator**: the footer shows `⚠ verify N` when assistant text references files that no tool result confirms, or when tool calls fail as "not found". This is a heuristic prompt to verify, not proof of hallucination.

3. **Built-in Security Skills & Methodology Catalog (41 Skills)**:
   - **Engagement Phases (`phases/`)**: `recon-phase`, `enumeration-phase`, `vuln-assessment-phase`, `exploitation-phase`, `post-exploit-phase`, `reporting-phase`.
   - **Services & Protocols (`services/`)**: `svc-web-server`, `svc-database`, `svc-smb`, `svc-ssh`, `svc-docker-k8s`, `svc-cicd`, `svc-dns`, `svc-mail`, `svc-ftp`, `svc-pivoting`.
   - **Playbooks (`playbooks/`)**: `playbook-webapp`, `playbook-ad`, `playbook-cloud`, `playbook-infra`.
   - **Web Vulnerabilities (`web/`)**: `web-sqli`, `web-auth-bypass-idor`, `web-upload-rce`, `web-ssti`, `web-deserialization`, `web-ssrf`, `web-lfi-traversal`, `web-xxe`.
   - **Methodology (`api/`, `cloud/`, `cicd/`, `fuzzing/`, `ai/`, `utility/`)**: API abuse/security, cloud, CI/CD pipeline and secrets, fuzzing, AI security, bug identification, vulnerability classes, fast checking, reporting.
   - **Repo-specific (`effect/`)**: Effect v4 patterns for this codebase.

4. **Red & Black Theme & Configuration Discovery**:
   - High-contrast visual theme (deep black background `#0a0a0a` with crimson/red accent colors and borders).
   - Project-level and global configuration discovery for `fuckcode.json` and `fuckcode.jsonc` in `~/.config/fuckcode/`.

---

## Quick Start

### 1. Installation & Running

FuckCode requires [Bun](https://bun.sh):

```bash
# Install dependencies
bun install

# Start the interactive TUI in development mode
bun run dev
```

### 2. Connecting to a Local Model (llama.cpp)

1. Launch your `llama-server` instance:

   ```bash
   ./llama-server -m /path/to/your/model.gguf --port 8080 -c 32768
   ```

2. Start FuckCode:

   ```bash
   bun run dev
   ```

3. Press **`Ctrl+P`** (Model Selection):
   - When the server runs on the default port (`http://127.0.0.1:8080`), active models are automatically detected.
   - To connect to a different host/port, select **`Set llama.cpp Server URL...`** and enter your endpoint.

---

## Configuration (`fuckcode.json`)

Configure project-level or global settings in `fuckcode.json` or `~/.config/fuckcode/fuckcode.json`:

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

---

## Using Security Skills & CLI Tools

FuckCode is designed to work with non-interactive command-line utilities. The agent automatically references instructions from `INSTRUCTIONS.md` and loads matching skills on demand based on task context.

### Example Prompts:

- **Network Reconnaissance & Port Enumeration**:

  > _"Perform active reconnaissance and port discovery on 192.168.1.50"_
  - Executes `rustscan` / `nmap` with service version detection (`-sV -sC -Pn`), followed by HTTP service validation via `httpx`.

- **Web Application Security Assessment (OWASP Top 10)**:

  > _"Test http://target.local/api/item?id=1 for SQL injection and XSS vulnerabilities"_
  - Activates `web-sqli` and `web-owasp` checklists, running `ghauri`/`sqlmap` and `dalfox` in non-interactive batch mode (`--batch`, `-silent`).

- **Active Directory & SMB Auditing**:

  > _"Enumerate network shares, users, and permissions on 10.10.10.10"_
  - Loads `svc-smb` and `playbook-ad`, executing `nxc smb` and `enum4linux-ng`.

- **Audit Reporting & Remediation**:
  > _"Generate a structured security assessment report with CVSS scoring and remediation steps"_
  - Applies `reporting-phase` to document findings, reproduction steps, technical evidence, and actionable fixes.

---

## Pentest Module — Sandboxed Execution & Evidence Engine

The pentest module provides an isolated execution sandbox, automated evidence logging, structured vulnerability parsing, and hierarchical scope enforcement for security engagements.

### Architecture

```
pentest/
├── config.ts           # TargetScope schema (domains, CIDRs, ports, named child scopes)
├── sandbox.ts          # Rootless namespace wrapper (pasta/slirp4netns/unshare), -sS to -sT rewrite
├── dns-forwarder.ts    # Embedded DNS resolver (127.0.0.1:53), whitelist filtering, NXDOMAIN for non-scope
├── evidence.ts         # SQLite WAL store (audit_log, findings, evidence_fts), atomic writes, deduplication
├── context.ts          # SystemContext provider (pentest/findings) for ambient LLM and subagent awareness
├── sanitizer.ts        # Output compression, ANSI stripping, structured summaries
├── read-evidence.ts    # FTS5 trigram grep and pagination tool for large scan logs
├── shell-tool.ts       # Sandbox shell with immediate findings extraction in output
├── inject-probe.ts     # HTTP injection probes (xss, ssti, cmdi, sqli, nosql, lfi, ssrf, ldap, xpath)
├── filename.ts         # Filename normalization-bypass generator
├── oob.ts              # Out-of-band interaction testing via interactsh
├── recon.ts            # Scoped recon chain (subfinder, httpx, nuclei)
├── scan-import.ts      # Import Burp, HAR, Nmap, and OpenAPI artifacts as findings
├── scope-import.ts     # Parse HackerOne scope exports into pentest config
├── session.ts          # Authenticated session store (headers, cookies)
├── os-hook.ts          # Post-exploitation command generator per OS/module
├── ensure-tools.ts     # Check or install common pentest tools
├── state-update.ts     # Engagement state store
├── report-gen.ts       # markdown / JSON / SARIF reports
├── knowledge.ts        # Cross-engagement knowledge store and learned rules
├── knowledge-update.ts # knowledge_update tool
├── observability.ts    # Trace context propagation, structured logging, audit trails
└── parsers/            # nmap, nuclei, cme, ffuf, sqlmap, nikto, whatweb, burp, har, openapi, recon
```

### Key Capabilities

| Capability                          | Description                                                                                                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Multi-backend Isolation**         | Automatically detects and selects the best available backend (`pasta` -> `slirp4netns` -> `unshare`). Network traffic is restricted strictly to scope CIDRs.        |
| **DNS Whitelist Enforcement**       | Embedded forwarder blocks non-scoped domains with NXDOMAIN and prevents DoH/DoT bypasses.                                                                           |
| **Automated Vulnerability Parsers** | Raw stdout and imported artifacts are parsed into typed findings (Nmap, Nuclei, CME, FFuf, SQLMap, Nikto, WhatWeb, Burp, HAR, OpenAPI, recon).                      |
| **Context Window Injection**        | Findings are injected directly into `PentestShellTool` output summaries and continuously maintained in ambient `SystemContext` for multi-turn models and subagents. |
| **Hierarchical Scopes**             | Supports named child scopes (`web`, `internal`) with inherited constraints and subagent task scoping (`scope_override`).                                            |
| **High-Performance Evidence Store** | SQLite WAL with transaction batching (`db.transaction`), memory PRAGMAs, FTS5 trigram full-text indexing capped to 64KB, and query deduplication.                   |
| **read_evidence Tool**              | Safe pagination and grep over arbitrary scan sizes (100MB+) without context window overflow.                                                                        |
| **state_update Tool**               | Update or query active pentest engagement state (phase, targets, credentials, hashes).                                                                              |
| **report_gen Tool**                 | Generate markdown/JSON/SARIF pentest reports from accumulated findings and evidence chains.                                                                         |
| **inject_probe Tool**               | Nonce-tagged HTTP injection probes; returns observations to verify, not confirmed findings.                                                                         |
| **filename_bypass Tool**            | Encoded filename variants (control chars, entities, overlong UTF-8) for upload and path filters.                                                                    |
| **oob Tool**                        | Out-of-band interaction testing via interactsh (DNS/HTTP/SMTP/LDAP callbacks).                                                                                      |
| **recon Tool**                      | Scoped subfinder/httpx/nuclei chain with evidence storage.                                                                                                          |
| **scan_import Tool**                | Import Burp XML, HAR, Nmap XML, and OpenAPI artifacts as findings.                                                                                                  |
| **scope_import Tool**               | Parse HackerOne scope exports into a paste-ready `pentest.scope` block.                                                                                             |
| **ensure_tools Tool**               | Check or install 21 common pentest tools.                                                                                                                           |
| **os_hook Tool**                    | Post-exploitation command generator per OS and module.                                                                                                              |
| **session Tool**                    | Authenticated session store applied to inject_probe and pentest_shell.                                                                                              |
| **knowledge_update Tool**           | Cross-engagement knowledge store and learned skills.                                                                                                                |
| **/report Command**                 | Slash command to generate a full pentest report.                                                                                                                    |
| **Result**                          | Domain admin hash in hand — every step recorded with its evidence chain.                                                                                            |

### Configuration (`fuckcode.json`)

```json
{
  "pentest": {
    "enabled": true,
    "sandboxTimeout": 30000,
    "evidenceDir": "~/.local/share/fuckcode/pentest-evidence",
    "scope": {
      "domains": ["target.corp", "*.target.corp"],
      "cidrs": ["10.0.0.0/8", "172.16.0.0/12"],
      "ports": [80, 443],
      "children": {
        "web": {
          "domains": ["web.target.corp"],
          "cidrs": ["10.10.0.0/16"],
          "ports": [80, 443, 8080, 8443]
        },
        "internal": {
          "domains": ["dc01.target.corp"],
          "cidrs": ["10.20.0.0/24"],
          "ports": [88, 389, 445, 636]
        }
      }
    }
  }
}
```

### Tests

```bash
# Run all pentest unit and integration tests
bun test src/pentest/__tests__/
```

- **pentest.test.ts** — Evidence writes, FTS5 trigram searches, parser verification (Nmap, Nuclei, CME, FFuf, SQLMap, Nikto, WhatWeb).
- **integration.test.ts** — End-to-end scope boundary enforcement, hierarchical child scopes, finding deduplication, and SystemContext formatting.
- **safety-bypass.test.ts** — Over 50 scope evasion attempts (environment variables, subshells, hex IPs, DNS rebinding).
- **concurrency.test.ts** — Multi-threaded concurrent writes, crash recovery, and orphan detection.
- **benchmark.test.ts** — Parser and evidence throughput benchmarks.
- **filename.test.ts** — Filename variant generation (`../filename.test.ts`, run separately).

---

## Development & Verification

```bash
# Type check all packages
bun run --cwd packages/opencode typecheck
bun run --cwd packages/tui typecheck
bun run --cwd packages/core typecheck

# Run unit tests
bun test
```
