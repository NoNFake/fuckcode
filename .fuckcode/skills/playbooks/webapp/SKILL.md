---
name: playbook-webapp
description: "Web app pentest router: recon, map, OWASP-class testing, proof, report, plus Apache/nginx/IIS misconfig and path traversal. Triggers - web app, HTTP API, systematic testing, Server header, Tomcat, /server-status."
tags: [vuln_assess, exploitation]
---

## Rules of Engagement
Only test systems you are authorized to assess. Confirm the written scope and rate limits before active commands. Prefer the least-invasive check that proves impact; stop on evidence of production impact.

# Web App Pentest — methodology + skill router

This is the ORDER of operations and the map to the deep skills. Each vuln CLASS has a dedicated `web-<class>` skill with exact payloads + detect→exploit→PROVE — load the one matching the surface; don't test from this index.

## 1. Recon + active scan FIRST
Fingerprint stack+version (whatweb/httpx, headers), CMS (wpscan/etc.), APIs (/swagger, /graphql, /.well-known). Then a content-matched `nuclei -u <t>` pass BEFORE exhaustive dir-fuzz (framework-runtime RCEs don't appear as routes) — run it via `pentest_shell`, output auto-parses. Version + a known CVE → fetch & vet a public PoC (shared exploitation methodology).

## 2. Map (hidden surface, AFTER the scan)
`ffuf`/`gobuster` (run via `pentest_shell`), vhosts (`ffuf -H Host:FUZZ`), params (`arjun`), auth endpoints (login/register/reset/OAuth), API routes. Review client-side JS for endpoints/secrets.

## 3. Server software layer (after version fingerprint)
- Apache: probe `/server-status`, `/server-info`, `/.htaccess`, `/.htpasswd`; traversal via double-encoded dots in a `/cgi-bin/` path (path-normalization CVEs in 2.4.49/50).
- nginx: `/nginx_status`, `/status`; alias traversal `GET /static../etc/passwd`; range-filter info leak on old versions.
- IIS: `~1` shortname enumeration (`GET /~1/`); WebDAV `OPTIONS /`; HTTP.sys header issues.
- Tomcat: `/manager/html`, `/host-manager/html`, default/weak manager creds.
- Generic: directory indexing, `TRACE`/`PUT`/`DELETE` enabled, backup/source files (`*.bak`, `*.old`, `*.swp`, `~`), default install pages.
- Leaks: `X-Powered-By`, verbose error pages exposing stack/paths, front-end vs back-end normalization or `CL`/`TE` disagreement (request smuggling).
- Read the `Server` banner, map it to the version's CVE (look it up — do not replay stale payloads), confirm with `nuclei -u <t> -tags apache,nginx,iis` via `pentest_shell`.

## 4. Test by class → load the matching skill
| Signal / surface | Load |
|---|---|
| param → DB query, SQL error/differential | **web-sqli** |
| input renders in a server template ({{7*7}}) | **web-ssti** |
| server fetches a URL you control (webhook/proxy/import) | **web-ssrf** |
| file param / download / `../` reflection | **web-lfi-traversal** |
| file upload sink | **web-upload-rce** |
| XML/SOAP/SAML/DOCX/SVG parsing | **web-xxe** |
| serialized blob (rO0/O:/VIEWSTATE/pickle) | **web-deserialization** |
| object IDs, roles, JWT, admin funcs | **web-auth-bypass-idor** |
| known framework+version CVE | shared exploitation methodology + searchsploit/nuclei |
Also-check (no dedicated skill yet): XSS (`dalfox`, `inject_probe`), command injection (`;id`/`$(id)`), CSRF, CORS/security-headers, crypto/secrets-in-JS, business-logic/race conditions.

## 5. PROVE + Report
A finding is `suspected` until you reproduce concrete impact (dumped canary row / `id` / file bytes / cloud creds / cross-user data) — then mark it confirmed via `state_update` with the evidence. Never mark a host resolved/"safe" without a completed active scan. Report: reproduction steps + request/response evidence + CVSS + OWASP-WSTG mapping.
