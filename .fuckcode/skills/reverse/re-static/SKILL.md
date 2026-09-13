---
name: reverse-static
tags: [reverse, binary, elf, pe, vulnerability]
description: "Static reverse engineering of ELF (.so, .a, .o) and PE (.dll, .exe) binaries: triage, disassembly, byte patching, and vulnerability hunting. Triggers - reverse engineering, binary analysis, .so, .dll, disassembly, decompile, patch bytes, ELF, PE."
---

## Rules of Engagement

Analyze only binaries you own or are authorized to assess. Static analysis never executes the target, but patched copies and extracted strings may contain sensitive data. Keep artifacts inside the configured reverse work directory.

# Static Reverse Engineering Checklist

Use the `binary` tool. Read-only actions (everything except `patch`) never modify the target. The tool auto-detects ELF and PE; PE details need radare2.

## 1. Triage

- `binary action=info file=<path>`: file type, size, sha256, header, hardening. ELF hardening covers RELRO, canary, NX, PIE, FORTIFY. PE hardening covers canary, NX, PIE/PIC.
- Record `sha256` in state before any patching. That hash is the chain-of-custody anchor.
- Check hardening: NX, PIE, RELRO, stack canary, FORTIFY. Missing NX or PIE widens exploitation options.
- `binary action=sections file=<path>`: writable, executable, and unusual sections.
- `binary action=entropy file=<path>`: per-section Shannon entropy. Sections above 7.0 are likely packed, encrypted, or compressed; treat the binary as packed and look for a stub.
- `binary action=strings file=<path> [encoding=utf16le]`: paths, URLs, keys, format strings, error messages, version banners. Use `encoding=utf16le` for Windows binaries, where most strings are wide.

## 2. Symbols and linkage

- `binary action=imports file=<path>`: undefined dynamic symbols reveal called APIs (network, exec, crypto, `system`, `strcpy`, `sprintf`).
- `binary action=exports file=<path>`: exported functions define the attack surface of a shared library.
- `binary action=functions file=<path>`: function list with addresses and sizes (radare2 analysis, or `nm` when radare2 is absent). Use it to navigate a stripped or symbol-rich binary.
- Correlate imports with risky sinks: `strcpy`, `strcat`, `sprintf`, `memcpy` with attacker-controlled length, `system`, `popen`, `execve`, `dlopen`.

## 3. Code review

- `binary action=disasm file=<path> address=<symbol|0xaddr> count=<n>`: disassembly. radare2 is used when installed, otherwise objdump.
- `binary action=xrefs file=<path> address=<symbol>`: who calls an address (radare2).
- `binary action=decompile file=<path> address=<symbol>`: pseudo-C via r2ghidra (radare2 + pdg).
- Trace input flow from entry points (exported functions, `main`, callbacks, `read`/`recv` sites) toward risky sinks.

## 4. Byte-level work

- `binary action=read_bytes file=<path> offset=<n> count=<n>`: hex dump at a file offset.
- `binary action=search_bytes file=<path> hex=<hexbytes>`: find a byte pattern; returns file offsets.
- `binary action=patch file=<path> offset=<n> hex=<hexbytes> [output=<path>]`: writes raw bytes into a copy under the reverse work directory. The original is never modified. Requires `reverse.allowPatch=true`.
- `binary action=patch file=<path> offset=<n> asm="<instruction>" [output=<path>]`: assembles one or more instructions for the file's own architecture with radare2 `rasm2`, then writes the result. Prefer this over hand-computed hex for instruction edits.

Use patching to neutralize a check, flip a branch, or force a code path, then compare behavior. Always keep the recorded original hash and the patch diff.

## 5. Emulation

No process is executed, so emulation is safe on untrusted code and needs no VM.

- `binary action=emulate file=<path> address=<symbol|0xaddr> count=<n> [write=<addr> hex=<bytes>] [dump=<addr>]`: initialize the radare2 ESIL VM, optionally write bytes into emulated memory, step instructions, then return registers and a memory dump.
- Set arguments through memory when a calling convention is needed: write the argument values at the stack or a buffer, then step the function.
- If ESIL stops on an unsupported instruction or a syscall, narrow the address range or inspect with disassembly instead.
- Requires radare2.

## 6. Vulnerability patterns

ELF:
- Unbounded copies: `strcpy`/`strcat`/`sprintf`/`gets` into fixed stack or heap buffers.
- Integer issues: allocation size computed from a length field, then copied with a different length (signed/unsigned, truncation, overflow).
- Off-by-one in loop bounds or terminator writes.
- Format string: user data passed as the format argument.
- Use-after-free and double-free in `free`/`realloc` paths, especially on error handling.
- Command injection: `system`/`popen`/`exec*` with constructed strings.
- Path traversal in file open paths.
- Insecure deserialization and type confusion in parsers.
- Missing bounds checks in protocol handlers (length field versus buffer capacity).

PE:
- Exported DLL functions are the attack surface. Check every export for unchecked lengths and pointer arithmetic.
- DLL search-order and side-loading: unsigned `LoadLibrary`/`LoadLibraryEx` paths, missing `SetDefaultDllDirectories`, or a writable directory in the search order.
- Ordinal-only imports and forwarded exports hide the real target; resolve them through `rabin2 -i`.
- `strcpy`/`strcat`/`sprintf` and `lstrcpy` variants with fixed `MAX_PATH` buffers.
- Structured exception handling and atom tables abused from parsed input.
- Check `DllMain` for work under the loader lock.
- Signed-binary bypasses: overlay data, section slack, and certificate table padding.

## 7. Tooling

- `ensure_tools` installs: radare2, rizin, binutils, checksec, binwalk, patchelf, yara.
- Prefer binutils (`readelf`, `objdump`, `nm`, `strings`) for guaranteed ELF availability; radare2 adds PE support, decompilation, xrefs, emulation, and richer disassembly.
- Ghidra headless and Frida are not part of the static MVP. Real dynamic execution (debugging, memory writes) requires an isolated VM or container; do not run untrusted binaries on the host.

## Phase Completion Criteria

Move to exploitation only when:
- The binary hash, hardening, and attack surface are recorded.
- Candidate sinks are identified with addresses.
- A concrete input path reaches at least one candidate sink.
- Reproduction or a patched-copy experiment confirms the behavior.
