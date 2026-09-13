---
name: bug-identification
description: "Find bugs by source review, taint analysis, dangerous functions, data flow. Triggers - code audit, source review, static analysis, bug hunting."
tags: [vuln_assess, recon]
---

## Rules of Engagement
Only test systems you are authorized to assess. Confirm the written scope and rate limits before active commands. Prefer the least-invasive check that proves impact; stop on evidence of production impact.

# Bug Identification

## Methodology

1. **Reconnaissance** - Enumerate version, dependencies, configuration. Map every input vector, API, and protocol. Review RFCs/specs and prior art (CVE, exploit-db, bug trackers).
2. **Static** - Read parsing/validation code if available. Reverse binaries with Ghidra/IDA. Patch-diff vulnerable vs patched. Check third-party SBOM components.
3. **Dynamic** - Trace syscalls, network, and file I/O. Debug with controlled input. Instrument for coverage. Track taint propagation.
4. **Fuzzing** - Generate valid seeds, isolate target in a harness, monitor coverage, triage crashes. See the dedicated fuzzing skill.
5. **Exploitation** - Convert the bug into reliable primitives, bypass mitigations, build payload. Only if authorized.

## Patch Diffing

### General workflow

1. Acquire vulnerable and patched binaries close in version.
2. Run auto-analysis on both; correlate functions.
3. Inspect unmatched functions (new/removed) and low-similarity functions (changed).
4. Focus on names/handlers related to the CVE or protocol (`Validate`, `Parse`, `Copy`, `Check`, `*Reassemble`, `*Receive*`).
5. Confirm the added check (bounds, size, privilege) and map it to the root cause.

Tools: BinDiff 8, Ghidriff, Diaphora, Ghidra Version Tracking (11+ built-in Partial Match Correlator), radiff2.

### Windows 11 / Windows binaries

```bash
# Pull specific builds of a binary
winbindex download tcpip.sys 10.0.22631.3447 10.0.22631.3525

# Extract a cumulative update and its UUP bundle
mkdir pre,post
wget -Uri https://www.catalog.update.microsoft.com/Download.aspx?q=KB5037778 -OutFile kb.msu
expand -F:* .\kb.msu .\post
uup_download_windows.cmd --extract
# Copy changed PE files into pre/ and post/
```

```powershell
# Fetch matching PDB symbols (Debugging Tools for Windows)
foreach ($ver in '3447','3525') {
    symchk /r .\$ver /s SRV*https://msdl.microsoft.com/download/symbols
}
```

Load both binaries in IDA 8+ or Ghidra 11 with symbols resolved, save the IDBs, then diff:

```bash
# Headless
ghidriff diff pre/tcpip.sys post/tcpip.sys -o tcpip.diff
# Or BinDiff CLI, restrict to .text for large modules like ntoskrnl.exe
bindiff --primary ntoskrnl_pre.i64 --secondary ntoskrnl_post.i64 --section .text
```

Sort by similarity ascending and investigate below ~95%. Validate on two lab VMs, pre-patch and post-patch, with kernel WinDbg (`bcdedit /dbgsettings net hostip:<IP> port:<PORT>`).

Manual extraction of individual updates:

```shell
mkdir 2022-09
mv *.msu 2022-09
cd 2022-09
mkdir extract
mkdir patch
expand -F:* .\*.msu .\extract
expand -F:* .\extract\<largest>.cab .\patch
expand -F:* .\patch\<largest>.cab .\patch
expand -F:* .\patch\Cab_* .\patch\
```

```shell
gci -Recurse c:\windows\WinSxS\ -Filter ntdll.dll
# copy the biggest file somewhere
.\delta_patch.py -i .\NTDLL\ntdll.dll -o ntdll.2020-10.dll .\NTDLL\r\ntdll.dll .\2020-10\x64\ntdll_<stuff>\f\ntdll.dll
.\delta_patch.py -i .\NTDLL\ntdll.dll -o ntdll.2020-11.dll .\NTDLL\r\ntdll.dll .\2020-11\x64\ntdll_<stuff>\f\ntdll.dll
```

Open the unpatched binary as BinDiff primary, the patched as secondary, then inspect red (changed) then yellow (matched) blocks. Use [WinbIndex](https://winbindex.m417z.com/) to locate builds; [Patch Extract](https://gist.github.com/abzcoding/f6191c3aa9ca6d019f360b429d6b510f) automates unpacking.

### Linux kernel

```bash
# Ubuntu/Debian: discover and download image + modules
apt list -a linux-image-generic | cat
apt-get download linux-image-unsigned-<ver>-generic linux-modules-<ver>-generic
export DEBUGINFOD_URLS="https://debuginfod.ubuntu.com https://debuginfod.debian.net"

# Fedora/RHEL/CentOS
dnf download kernel-core-<ver> kernel-debuginfo-<ver>
rpm2cpio kernel-core-<ver>.rpm | cpio -idmv
rpm2cpio kernel-debuginfo-<ver>.rpm | cpio -idmv

# Extract vmlinux if only vmlinuz is present
/usr/src/linux-headers-<ver>/scripts/extract-vmlinux /boot/vmlinuz-<ver> > vmlinux-<ver>

# Find changed modules between trees
rsync -rcn --delete /lib/modules/<pre>/ /lib/modules/<post>/ | grep -E "\.ko$" | sed 's/^/chg: /'

# Source-level triage when sources are available
git diff --no-index -- function.c.orig function.c.patched | less

# Symbolize and map crashes
./scripts/decode_stacktrace.sh vmlinux /lib/modules/<ver>/build < dmesg.log
addr2line -e vmlinux-<ver> 0xffffffff81234567
```

Diff hot subsystems (`io_uring`, `net/ipv6`, `fs/overlayfs`) at function level with Ghidra 11/IDA 8 plus Diaphora/BinDiff/Ghidriff. Clang-built kernels produce many small KCFI/CFI thunk changes; filter to real function-body deltas. Check syzbot for reproducers and fix commits.

### Apple IPSW / DSC

```bash
# Download the update and the N-1 version
ipsw download --device Macmini9,1 -V -b 23A344
ipsw download --device Macmini9,1 -V -b 23B74

# Compare two IPSWs
ipsw diff UniversalMac_14.0_23A344.ipsw UniversalMac_14.1_23B74.ipsw

# Inspect and extract the dyld shared cache
ipsw extract -d IPSW
ipsw extract -f -p file
ipsw macho lipo Contacts
```

Map the changed binary to the CVE, set Ghidra Decompiler Parameter ID on, load [IDAObjectTypes](https://github.com/PoomSmart/IDAObjcTypes), and diff to root cause. `.ipsw` files are zip archives.

## Parser Bug Heuristics (SMB2/KSMBD-inspired)

Cross-field invariants:

- Validate `(offset + length) <= remaining_buffer` and `<= total_buffer` in a widened type (e.g. `u64`) before arithmetic; reject overflow with `check_add_overflow()`/`array_size()`.
- For chained entries with `next`, assert `next >= sizeof(entry_header)`, `next <= remaining_buffer`, and that advancement makes progress. For sub-lengths (`name_len`, `value_len`) assert `header + name_len + value_len <= next`.
- Do not cast to a struct until the full header is present and aligned; gate recasts behind a prior `buf_len` check.

Fixed-size buffers:

- Ban unbounded copies/decompression into fixed arrays. Require `len <= sizeof(array)` or clamp with `min_t()` and bail.
- Crypto helpers that copy `len` bytes into fixed buffers (e.g. session keys) must bound `len` against a named maximum; prefer allocating from validated `len`.

Type/width hazards:

- Normalize parser math to a wide unsigned type before comparison. Avoid truncating `u32/u64` to `u16` for size checks; use `size_t/u64` and compare against a same-width `buf_len`.

Loop structure:

- Flag `e = (struct entry *)((char *)e + next);` with no preceding revalidation of `buf_len` and sub-lengths.
- Ensure a break on exhaustion; reject zero/negative progress to avoid stalls.

Allocation correlation:

- When parser-controlled `len` influences a write into an object from a fixed SLUB cache (e.g. `kmalloc-512`), bound the write by the destination field, not just the incoming length.

Patch-diff signals:

- New `if (len > CONST) return -EINVAL;`, `if (buf_len < sizeof(struct foo)) return -EINVAL;`, or `min_t(size_t, len, sizeof(...))` conversions.
- New `check_add_overflow(offset, len, &sum)` or `array_size(n, sz)` in hot parse paths.

### Semgrep/CodeQL seeds (tune per codebase)

```yaml
rules:
  - id: c-fixed-array-unbounded-copy
    languages: [c, cpp]
    patterns:
      - pattern: memcpy($DST, $SRC, $LEN)
      - pattern-inside: |
          struct $S { ... char $BUF[$N]; ... };
          ...
          $DST = &...->$BUF
      - pattern-not: memcpy($DST, $SRC, MIN($LEN, sizeof(*$DST)))
    message: Unbounded copy into fixed-size struct field
    severity: WARNING
```

```yaml
- id: c-parser-next-missing-bounds
  languages: [c, cpp]
  pattern: |
    $E = (struct $T *)((char *)$E + $NEXT);
  message: Parser advances by user-controlled 'next' without prior buf_len/sizeof checks
  severity: WARNING
```

Seed crypto/decompression writes with function names in the tree (`*_crypt`, `*_decrypt`, `decompress_*`).

Dynamic confirmation: send `next < header`, `next > remaining`, `name_len + value_len > next`, and `len > MAX_CONST` variants; expect `-EINVAL`. If not, investigate. Drive packet/SMB paths with TUN/TAP + KCOV and enable KASAN/KMSAN.

Reference: KSMBD 0-click RCE writeup (`https://www.willsroot.io/2025/09/ksmbd-0-click.html`).

## Static Analysis Tools

| Tool | Use |
| --- | --- |
| Semgrep | Custom pattern rules over source and extracted pseudo-code |
| CodeQL | Semantic queries and variant analysis |
| Weggli | Fast semantic search for C/C++ patterns |
| Joern | Code property graph analysis |
| Ghidra 11 | Binary analysis, version tracking, ML signature recognition |
| Binary Ninja | HLIL decompilation and collaboration |
| Cutter/Rizin | GUI decompiler integration |
| rhabdomancer | IDA headless; finds calls to insecure API functions, emits JSON/SARIF |
| haruspex | IDA headless; exports decompiler pseudo-code for Semgrep/weggli |
| augur | IDA headless; extracts strings and referencing pseudo-code |
| Diaphora/Ghidriff/BinDiff 8 | Binary diffing |
| radiff2 | CLI binary diff |

Reference: [Streamlining vulnerability research with IDA Pro and Rust](https://security.humanativaspa.it/streamlining-vulnerability-research-with-ida-pro-and-rust/).

## Tool Migration Path

| Old Tool | New Alternative | Migration Notes |
| --- | --- | --- |
| Intel Pin | DynamoRIO or Frida-Stalker | Pin is sustain-only |
| WinAFL | AFL++ 4.x | Integrated Windows support |
| Radamsa | LibAFL mutators | Better coverage awareness |
| BinDiff 7 | BinDiff 8 / Ghidriff | Improved algorithms |
| IDA 7.x | IDA 8.x / Ghidra 11 | Better decompilation |
