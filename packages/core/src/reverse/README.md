# Reverse Engineering

Static analysis of ELF and PE binaries: triage, disassembly, byte reads, byte-pattern search, and patching of copies.

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

`binary` actions: `info`, `sections`, `imports`, `exports`, `functions`, `strings`, `entropy`, `disasm`, `decompile`, `xrefs`, `read_bytes`, `search_bytes`, `patch`, `emulate`.

Permissions: read actions use the `reverse` action, `patch` uses `reverse_patch`.

Backends: `file` and `strings` are always required. ELF uses `readelf`, `objdump`, `nm`; PE uses radare2's `rabin2` for sections, imports, exports, and header/hardening. `info` uses `checksec` when installed and otherwise derives hardening itself. `disasm` prefers radare2 when present and falls back to objdump for ELF. `decompile`, `xrefs`, `emulate`, and PE `functions` require radare2; ELF `functions` falls back to `nm`.

`emulate` runs radare2's ESIL VM: it maps a stack, optionally writes `hex` bytes at `write`, seeks to `address` (a symbol or hex), steps `count` instructions, then returns registers and a 128-byte dump at `dump` (default `rsp`). No process is executed.

`strings` defaults to ASCII; pass `encoding=utf16le` for Windows binaries.

`patch` accepts raw bytes with `hex` or an instruction with `asm`. The `asm` form assembles through `rasm2` using the file's own architecture and bits, so instruction edits do not need hand-computed bytes. Both forms write a copy under `workDir`.

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

- ELF and PE are supported. Mach-O is not.
- PE sections, imports, exports, and headers need radare2 (`rabin2`); PE disassembly and functions need radare2. Without it, `info` still reports the file type, size, and hash.
- No dynamic execution. Debugging, live memory writes, and Frida require an isolated VM or container; do not run untrusted binaries on the host. `emulate` is ESIL emulation, not execution.
- `search_bytes` reads the whole file into memory. Large-file scanning should switch to a chunked scan.
