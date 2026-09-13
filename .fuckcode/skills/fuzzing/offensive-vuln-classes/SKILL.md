---
name: vulnerability-classes
description: "Exploit development: buffer overflow, UAF, heap overflow, integer overflow, type confusion, race. Triggers - memory corruption, CVE case study."
tags: [exploitation, vuln_assess]
---

## Rules of Engagement
Only test systems you are authorized to assess. Confirm the written scope and rate limits before active commands. Prefer the least-invasive check that proves impact; stop on evidence of production impact.

# Vulnerability Classes

Map a crash or code smell to its primitive, prove the primitive under a sanitizer, then argue exploitability from what the attacker controls. Pair with `offensive-fuzzing` for harness and campaign mechanics.

## Class Reference

| Class | Primitive | Detection (sanitizer / smell / signature) | Exploitable when |
|-------|-----------|-------------------------------------------|------------------|
| Stack overflow | Overwrite saved frame, canary, return address | ASan `stack-buffer-overflow`; `strcpy`/`gets`/`sprintf`/`alloca` into fixed local; SIGSEGV on `ret`, canary value in `bt` | Attacker controls copy length and canary/ASLR has a leak |
| Heap overflow | Corrupt adjacent chunk metadata or object | ASan `heap-buffer-overflow`; glibc `malloc(): corrupted top size` / `free(): invalid next size`; size vs write mismatch | Attacker controls write length and contents; allocator reuse is reachable |
| Use-after-free | Dangling pointer reused as live object | ASan `heap-use-after-free` with alloc/free/use stacks; UBSan vptr; stale field across free | Freed slot can be refilled with an attacker-shaped same-size object before the use |
| Out-of-bounds read | Info leak of pointers, metadata, KASLR | ASan `heap-buffer-overflow READ`; KASAN `slab-out-of-bounds`; read length derived from untrusted field | Leaked bytes reach the attacker or feed an address/size used later |
| Uninitialized memory | Leaks stale pointers, flags, lengths | MSan `use-of-uninitialized-value`; KMSAN; local read before any write on a path; uninit struct copied to user | Uninit field is copied out, used as a pointer, or gates a check |
| Reference-count bug | Premature free (UAF) or counter overflow | Missing get/put on error path; refcount_t underflow/saturation warnings; KASAN UAF after put | Attacker can force an extra put or saturate a get while a live reference remains |
| NULL dereference | DoS, or controlled low-address access | `BUG: kernel NULL pointer dereference`; `unable to handle page fault for address: 000000000000...`; unchecked lookup return | Privileged context and attacker controls an offset into a mappable low page, or availability matters |
| Race / TOCTOU / double-fetch | Inconsistent state, free-during-use, check/use gap | TSan `data race`; KCSAN; shared or user memory read twice; check-then-use on a mutable path; threaded repro flakiness | Attacker wins the window and controls the object swapped between check/use or the two fetches |
| Type confusion | Wrong layout read as another: addrof/fakeobj/arb R/W | UBSan `-fsanitize=vptr`; TypeSan; unchecked tag or downcast; union/void* cast without validation | Attacker controls the tag or vtable and the confused layout exposes useful fields |
| Integer overflow / truncation | Undersized allocation, wrong bound, bad index | UBSan `signed integer overflow`, `implicit conversion`; product/sum feeds `malloc` then `memcpy`; narrowing cast | Wrapped size or index is attacker-influenced and reaches allocation, bounds, or copy length |
| Format string | `%n` arbitrary write, `%s`/`%p` leak | `-Wformat-security`; user data passed as the format argument; crash or garbage output on `%n`/`%s` | Attacker controls the format string and can place pointers on the stack or in argument slots |
| Parser / IOCTL / filesystem | Length desync to OOB; callback from pointer field; traversal | ASan/KASAN on the parse path; `copy_from_user` length differs from what is used; IOCTL accepting kernel pointers; `..`/symlink escape | Attacker controls the IPC/IOCTL/file input and a privileged parser misvalidates length or pointer |
| JIT / native | Bounds-check elimination, type confusion, RWX pivot | Grammar/differential fuzzing (Fuzzilli); engine type asserts; `CheckBounds` eliminated; engine `--jit-fuzzing` mode | JIT trusts profiling assumptions the attacker can violate and a RWX or WASM page is reachable |

## Per-Class Checks

- Stack / heap overflow: rerun the crash under ASan; identify the copy frame; confirm where the length came from.
- UAF: rerun under ASan and read alloc/free/use stacks; try refilling the slot with a same-size allocation.
- OOB read / uninitialized: ASan for the OOB boundary, MSan for the uninit use; confirm the bytes reach the caller.
- Reference count: audit get/put balance on every error path; watch for `refcount_t` underflow/saturation warnings.
- NULL deref: `gdb -q ./target core.* -ex bt`; find which unchecked lookup returned NULL.
- Race / TOCTOU / double-fetch: loop the repro under TSan; for kernel, write a two-thread repro and enable KCSAN.
- Type confusion: rebuild with `-fsanitize=vptr,undefined`; inspect the tag or downcast that selected the layout.
- Integer: rebuild with `-fsanitize=integer,implicit-conversion`; trace the wrapped value into allocation or copy.
- Format string: grep for input passed as the format; probe with a `%p.%p.%n` marker under the debugger.
- Parser / IOCTL / filesystem: fuzz the parse path under ASan; diff `copy_from_user` length against use; test `..` and symlinks.
- JIT / native: run Fuzzilli or differential campaigns; enable engine type asserts; hunt eliminated bounds checks.

## Detection Signals

- Run the class oracle from `offensive-fuzzing`: ASan/HWASan for memory safety, MSan for uninitialized, TSan/KCSAN for races, UBSan for integer and vptr.
- Symbolize every crash with `ASAN_OPTIONS=abort_on_error=1:symbolize=1` and read the first frame in target code, not the allocator.
- Grep for the smell before fuzzing: unsafe copy APIs, `int` arithmetic feeding sizes, casts on tags, `copy_from_user` on a twice-read structure, format args from input.
- Distinguish read from write in the report; OOB read is an info leak, OOB write is corruption.
- Kernel: `dmesg -T` for `kasan`/`kmsan`/`kcsan` and `decode_stacktrace.sh vmlinux < dmesg.log`.

## Triage Workflow

1. Fuzz the narrowest input surface that reaches the suspect code; capture the raw crashing input.
2. Reproduce under the matching sanitizer with symbolization on, and confirm the crash signature is stable.
3. Dedup by top target frame plus sanitizer category, not by input bytes or surface address.
4. Establish root cause: trace the data and size from the attacker-controlled source to the faulting access.
5. Minimize to a deterministic repro (`afl-tmin` or manual) that fails without the sanitizer too, where possible.
6. Assess exploitability: name the primitive, state exactly which bytes/pointers the attacker controls, and list the mitigations still in the way (canary, ASLR, CFI, sandbox). Downgrade to DoS/info leak when no control is provable.

Report the primitive and the control argument; a crash without a control argument is a bug report, not an exploit.
