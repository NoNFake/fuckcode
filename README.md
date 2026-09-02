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

3. **Built-in Security Skills & Methodology Catalog (31 Skills)**:
   - **Engagement Phases (`phases/`)**: `recon-phase`, `enumeration-phase`, `vuln-assessment-phase`, `exploitation-phase`, `post-exploit-phase`, `reporting-phase`.
   - **Services & Protocols (`services/`)**: `svc-web-server`, `svc-database`, `svc-smb`, `svc-ssh`, `svc-docker-k8s`, `svc-cicd`, `svc-dns`, `svc-mail`, `svc-ftp`, `svc-pivoting`.
   - **Playbooks (`playbooks/`)**: `playbook-webapp`, `playbook-ad`, `playbook-cloud`, `playbook-infra`.
   - **Web Vulnerabilities (`web/`)**: `web-sqli`, `web-auth-bypass-idor`, `web-upload-rce`, `web-ssti`, `web-deserialization`, `web-ssrf`, `web-lfi-traversal`, `web-xxe`.

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
  > *"Perform active reconnaissance and port discovery on 192.168.1.50"*
  - Executes `rustscan` / `nmap` with service version detection (`-sV -sC -Pn`), followed by HTTP service validation via `httpx`.

- **Web Application Security Assessment (OWASP Top 10)**:
  > *"Test http://target.local/api/item?id=1 for SQL injection and XSS vulnerabilities"*
  - Activates `web-sqli` and `web-owasp` checklists, running `ghauri`/`sqlmap` and `dalfox` in non-interactive batch mode (`--batch`, `-silent`).

- **Active Directory & SMB Auditing**:
  > *"Enumerate network shares, users, and permissions on 10.10.10.10"*
  - Loads `svc-smb` and `playbook-ad`, executing `nxc smb` and `enum4linux-ng`.

- **Audit Reporting & Remediation**:
  > *"Generate a structured security assessment report with CVSS scoring and remediation steps"*
  - Applies `reporting-phase` to document findings, reproduction steps, technical evidence, and actionable fixes.

---

## Pentest Module — Sandboxed Execution & Evidence Engine

The pentest module provides an isolated execution sandbox, automated evidence logging, structured vulnerability parsing, and hierarchical scope enforcement for security engagements.

### Architecture

```
pentest/
├── config.ts           # TargetScope schema (domains, CIDRs, ports, named child scopes)
├── preflight.ts        # Backend validation (pasta, slirp4netns, unshare), FTS5 checks
├── sandbox.ts          # Rootless namespace wrapper (pasta/slirp4netns/unshare), -sS to -sT rewrite
├── dns-forwarder.ts    # Embedded DNS resolver (127.0.0.1:53), whitelist filtering, NXDOMAIN for non-scope
├── filter.ts           # nftables output filtering rules outside allowed CIDRs
├── evidence.ts         # SQLite WAL store (audit_log, findings, evidence_fts), atomic transaction writes, deduplication
├── context.ts          # SystemContext provider (pentest/findings) for ambient LLM and subagent awareness
├── sanitizer.ts        # Output compression, ANSI stripping, structured summaries
├── read-evidence.ts    # FTS5 trigram grep and pagination tool for large scan logs
├── shell-tool.ts       # Sandbox shell with immediate findings extraction in output
├── parsers/            # Automated finding parsers
│   ├── nmap.ts         # Port scanning, service versions, OS detection, script CVEs
│   ├── nuclei.ts       # Vulnerability templates, severities, CVSS scores
│   ├── cme.ts          # SMB/LDAP/WinRM enumeration, Pwn3d admin flags, credentials
│   ├── ffuf.ts         # Web fuzzing endpoints, status codes, redirects
│   ├── sqlmap.ts       # SQL injection points, back-end DBMS, extracted databases, hash dumps
│   ├── nikto.ts        # Web server banners, sensitive files (.git, .env, backups), missing headers
│   └── whatweb.ts      # Web technology stacks, CMS versions, server components
└── observability.ts    # Trace context propagation, structured logging, audit trails
```

### Key Capabilities

| Capability | Description |
|---|---|
| **Multi-backend Isolation** | Automatically detects and selects the best available backend (`pasta` -> `slirp4netns` -> `unshare`). Network traffic is restricted strictly to scope CIDRs. |
| **DNS Whitelist Enforcement** | Embedded forwarder blocks non-scoped domains with NXDOMAIN and prevents DoH/DoT bypasses. |
| **Automated Vulnerability Parsers** | Raw stdout is parsed in real time into typed findings across 7 tool categories (Nmap, Nuclei, CME, FFuf, SQLMap, Nikto, WhatWeb). |
| **Context Window Injection** | Findings are injected directly into `PentestShellTool` output summaries and continuously maintained in ambient `SystemContext` for multi-turn models and subagents. |
| **Hierarchical Scopes** | Supports named child scopes (`web`, `internal`) with inherited constraints and subagent task scoping (`scope_override`). |
| **High-Performance Evidence Store** | SQLite WAL with transaction batching (`db.transaction`), memory PRAGMAs, FTS5 trigram full-text indexing capped to 64KB, and query deduplication. |
| **read_evidence Tool** | Safe pagination and grep over arbitrary scan sizes (100MB+) without context window overflow. |

### Configuration (`fuckcode.json`)

```json
{
  "pentest": {
    "enabled": true,
    "sandboxTimeout": 30000,
    "evidenceDir": "~/.local/share/opencode/pentest-evidence",
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
