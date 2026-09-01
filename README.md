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

## PentestCode — Sandboxed Execution Engine (Phase 1)

PentestCode provides network-isolated command execution with structured evidence storage for pentest engagements.

### Architecture

```
pentest/
├── config.ts           # TargetScope schema (domains, CIDRs, ports)
├── preflight.ts        # Dependency checks (pasta/slirp4netns, nftables, dnsmasq), FTS5 validation
├── sandbox.ts          # Rootless namespace wrapper (pasta or slirp4netns), -sS → -sT rewrite
├── dns.ts              # Local DNS proxy (127.0.0.1:5353), whitelist-only, NXDOMAIN for non-scope
├── filter.ts           # nftables DROP rules for IPs outside allowed CIDRs
├── evidence.ts         # SQLite WAL store (audit_log, findings, evidence_fts), atomic writes, path traversal guard
├── sanitizer.ts        # Key-line extraction, <300 token structured summaries
├── read-evidence.ts    # FTS5 grep/pagination tool, two-tier output (summary never enters LLM context raw)
├── shell-tool.ts       # Sandbox-aware shell, all output stored as evidence
└── observability.ts    # trace_id/span_id propagation, structured logging, scope violation events
```

### Key Properties

| Property | Description |
|----------|-------------|
| **Network isolation** | Commands run inside `pasta` or `slirp4netns` namespaces. Only IPs in `target_scope.cidrs` are reachable. |
| **DNS lockdown** | Built-in resolver on `127.0.0.1:5353` returns NXDOMAIN for non-whitelisted domains. |
| **Two-tier output** | Raw tool output is stored on disk; LLM receives only a `<300 token` summary + `evidence_id`. |
| **read_evidence** | FTS5-backed retrieval by evidence ID with grep, offset, limit. Sub-5ms on 100MB logs. |
| **Crash safety** | WAL mode, FK constraints, orphan reconcile on startup. Mid-transaction SIGKILL does not corrupt data. |
| **Trace chain** | Every tool call carries `trace_id` → `span_id` through scope guard → spawn → capture → DB insert. |

### Configuration

```json
{
  "pentest": {
    "enabled": true,
    "scope": {
      "domains": ["target.com", "*.target.com"],
      "cidrs": ["10.0.0.0/8", "192.168.1.0/24"],
      "ports": [22, 80, 443, 8080]
    },
    "sandboxTimeout": 30000,
    "evidenceDir": "~/.local/share/opencode/pentest-evidence"
  }
}
```

### Tests

```bash
# Run pentest tests from packages/opencode
bun test src/pentest/__tests__/
```

- **pentest.test.ts** — Evidence write/read, sanitization, observability
- **safety-bypass.test.ts** — 50+ scope bypass attempts (env vars, subshells, hex IP, DNS rebinding, protocol tricks)
- **concurrency.test.ts** — 10 parallel writers × 10 ops, crash recovery, orphan detection

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
