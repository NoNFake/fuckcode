# Reverse Engineering

Static analysis of ELF binaries: triage, disassembly, byte reads, byte-pattern search, and patching of copies.

## Enable

```jsonc
{
  "reverse": {
    "enabled": true,
    "allowedDirs": ["/home/me/targets"],
    "allowPatch": true,
    "workDir": "/home/me/reverse-work",
    "maxFileSize": 268435456
  }
}
```

Or set `FUCKCODE_REVERSE=1`. Registering the tools is gated on `reverse.enabled` or that environment variable.

- `allowedDirs`: empty allows any path; non-empty restricts reads and patches to those directories (symlinks are resolved first).
- `allowPatch`: must be `true` for the `patch` action. Patches always write a copy into `workDir`; the original is never modified.
- `ensure_tools` is available when reverse or pentest is enabled.

## Tools

`binary` actions: `info`, `sections`, `imports`, `exports`, `strings`, `disasm`, `decompile`, `xrefs`, `read_bytes`, `search_bytes`, `patch`.

Permissions: read actions use the `reverse` action, `patch` uses `reverse_patch`.

Backends: `file`, `readelf`, `objdump`, `nm`, `strings`, and optional `checksec` are required for the core actions. `disasm` prefers radare2 when present and falls back to objdump. `decompile` and `xrefs` require radare2 (and r2ghidra for decompilation).

Install external tools with the `ensure_tools` tool.

## MCP alternative

The built-in `binary` tool covers static analysis without extra processes. For richer analysis you can also point opencode at an existing MCP server. These run alongside the native tool.

```jsonc
{
  "mcp": {
    "radare2": {
      "type": "local",
      "command": ["node", "/path/to/radare2-mcp/dist/index.js"],
      "environment": { "ALLOWED_DIRS": "/home/me/targets" }
    },
    "ghidra": {
      "type": "local",
      "command": ["python3", "/path/to/ghidra-mcp/server.py"]
    }
  }
}
```

## Limitations

- ELF only in this MVP. PE and Mach-O are not supported yet.
- No dynamic execution. Debugging, live memory writes, and Frida require an isolated VM or container; do not run untrusted binaries on the host.
- `search_bytes` reads the whole file into memory. Large-file scanning should switch to a chunked scan.
