<!--
  Built-in skill for FuckCode configuration.
-->

# Customizing FuckCode

FuckCode validates its configuration strictly and refuses to start when a field is wrong. The shapes below cover the common surface area.

## Where files live

| Scope                         | Path                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Project config                | `./fuckcode.json`, `./fuckcode.jsonc`, or `.fuckcode/fuckcode.json` (also supports legacy `opencode.json`)                |
| Global config                 | `~/.config/fuckcode/fuckcode.json` or `~/.config/fuckcode/fuckcode.jsonc` (NOT `~/.fuckcode/`)                            |
| Project agents                | `.fuckcode/agent/<name>.md` or `.fuckcode/agents/<name>.md`                                                               |
| Global agents                 | `~/.config/fuckcode/agent(s)/<name>.md`                                                                                   |
| Project commands              | `.fuckcode/command/<name>.md` or `.fuckcode/commands/<name>.md`                                                           |
| Global commands               | `~/.config/fuckcode/command(s)/<name>.md`                                                                                 |
| Project skills                | `.fuckcode/skills/<name>/SKILL.md`                                                                                        |
| Global skills                 | `~/.config/fuckcode/skills/<name>/SKILL.md`                                                                               |
| External skills (auto-loaded) | `~/.claude/skills/<name>/SKILL.md`, `~/.agents/skills/<name>/SKILL.md`                                                    |

Configs from each scope are deep-merged. Project overrides global.

## fuckcode.json

Every field is optional.

```json
{
  "$schema": "https://opencode.ai/config.json",
  "username": "string",
  "model": "llamacpp/default",
  "small_model": "llamacpp/default",
  "default_agent": "build",
  "shell": "/bin/bash",
  "logLevel": "INFO",
  "share": "disabled",
  "autoupdate": false,
  "instructions": ["INSTRUCTIONS.md", "AGENTS.md"],

  "provider": {
    "llamacpp": {
      "baseURL": "http://127.0.0.1:8080/v1"
    }
  },

  "skills": {
    "paths": [".fuckcode/skills", "/abs/path/to/skills"]
  },

  "agent": {
    "pentest": {
      "model": "llamacpp/default",
      "mode": "primary",
      "description": "Autonomous security assessment and penetration testing agent",
      "prompt": "You are FuckCode, specialized in security assessment. Be concise, direct, and never use emojis."
    }
  },

  "permission": {
    "*": "allow",
    "bash": "allow",
    "edit": "allow"
  }
}
```

## Agent Definitions (`.fuckcode/agent/<name>.md`)

```markdown
---
name: security-auditor
description: Specialized agent for code auditing and vulnerability assessment
mode: primary
model: llamacpp/default
---

You are FuckCode, an autonomous AI security assistant and code reviewer.
CRITICAL RULE: NEVER use emojis in your responses under any circumstances.
Be direct, concise, and focused on technical findings, reproduction steps, and remediation.
```

## Applying changes

Configuration is loaded once when FuckCode starts. After modifying `fuckcode.json` or agent files, restart FuckCode for changes to take effect.
