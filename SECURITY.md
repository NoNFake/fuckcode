# Security

## IMPORTANT

We do not accept AI generated security reports. We receive a large number of
these and we absolutely do not have the resources to review them all. If you
submit one that will be an automatic ban from the project.

## Threat Model

### Overview

OpenCode is an AI-powered coding assistant that runs locally on your machine. It provides an agent system with access to powerful tools including shell execution, file operations, and web access.

### No Sandbox

OpenCode does **not** sandbox the agent. The permission system exists as a UX feature to help users stay aware of what actions the agent is taking - it prompts for confirmation before executing commands, writing files, etc. However, it is not designed to provide security isolation.

If you need true isolation, run OpenCode inside a Docker container or VM.

### Pentest Sandbox

The pentest module (`pentest.enabled`) adds a separate command runner, `pentest_shell`, that is not covered by the regular permission prompt. Its isolation guarantees and limits:

- Network isolation is applied with `nftables` inside a new network namespace (`unshare --net`) or by `pasta`. Rules default to `drop` and only allow the configured scope CIDRs, the configured TCP ports, loopback, and DNS to the embedded forwarder.
- DNS is filtered by an embedded forwarder. Only configured domains resolve; everything else returns `NXDOMAIN`.
- Commands whose explicit IP or URL targets fall outside the configured scope are rejected before execution, and the violation is logged.
- There is **no** memory, CPU, PID, or filesystem isolation. The command runs as the current user and can read and write files the user can access.
- `pasta` is preferred when installed; otherwise `unshare` is required. If neither backend can enforce rules, the command is not run.
- Scope is only as strong as the network path. Do not run untrusted code, and do not rely on this sandbox to contain a determined attacker.

### Server Mode

Server mode is opt-in only. When enabled, set `OPENCODE_SERVER_PASSWORD` to require HTTP Basic Auth. Without this, the server runs unauthenticated (with a warning). It is the end user's responsibility to secure the server - any functionality it provides is not a vulnerability.

### Out of Scope

| Category                        | Rationale                                                               |
| ------------------------------- | ----------------------------------------------------------------------- |
| **Server access when opted-in** | If you enable server mode, API access is expected behavior              |
| **Sandbox escapes**             | The permission system is not a sandbox (see above)                      |
| **LLM provider data handling**  | Data sent to your configured LLM provider is governed by their policies |
| **MCP server behavior**         | External MCP servers you configure are outside our trust boundary       |
| **Malicious config files**      | Users control their own config; modifying it is not an attack vector    |

---

# Reporting Security Issues

We appreciate your efforts to responsibly disclose your findings, and will make every effort to acknowledge your contributions.

To report a security issue, please use the GitHub Security Advisory ["Report a Vulnerability"](https://github.com/NoNFake/fuckcode/security/advisories/new) tab.

The team will send a response indicating the next steps in handling your report. After the initial reply to your report, the security team will keep you informed of the progress towards a fix and full announcement, and may ask for additional information or guidance.

## Escalation

If you do not receive an acknowledgement of your report within 6 business days, you may send an email to dev.nonfake@gmail.com
