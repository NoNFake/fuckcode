---
name: fast-checking
description: "Rapid offensive checklist: quick-win vulns, fast recon, scanner defaults, triage. Triggers - fast check, quick recon, CTF, time-boxed."
tags: [recon, enumeration]
---

## Rules of Engagement
Only test systems you are authorized to assess. Confirm the written scope and rate limits before active commands. Prefer the least-invasive check that proves impact; stop on evidence of production impact.

## Recon and Fingerprinting
- Enumerate subdomains: `subfinder -d target.com -silent | httpx -silent -status-code -title`.
- Probe live hosts and tech: `httpx -l hosts.txt -tech-detect -favicon -jarm`.
- Record server, framework, language, and cookie names from responses.
- Scan services: `naabu -host target.com -top-ports 100`, then banner-grab each open port.
- Probe docs and contracts: `/swagger`, `/openapi.json`, `/graphql`, `?wsdl`; diff against observed traffic.
- Brute hidden paths: `ffuf -w wordlist -u https://target/FUZZ -mc 200,204,301,302,401,403`.
- Query the Wayback Machine for retired endpoints, params, and JS files.
- Extract params with `paramspider`/`arjun`, then fuzz only the discovered names.
- Add debug params `?debug=1&test=1&admin=1` and compare size, status, and headers.
- Pull routes from JS: `curl -s https://target/app.js | grep -Eo '"/[A-Za-z0-9_/.-]+"'`.
- Crawl with `katana -u https://target -jc -d 3` to collect forms and parameters.
- Check headers for `X-Powered-By`, version banners, and missing `Strict-Transport-Security`, `Content-Security-Policy`, `X-Frame-Options`.
- Look up the identified stack version for known CVEs before deeper testing.
- Fetch `/robots.txt` and `/sitemap.xml` for unlinked paths.
- Probe exposed files: `/.git/HEAD`, `/.env`, `/server-status`, `/WEB-INF/web.xml`, `/backup.zip`.
- Detect subdomain takeover: resolve CNAMEs pointing at unclaimed cloud/SaaS hosts.
- Reflect `Origin: https://evil.example` on API routes; flag credentialed wildcard CORS.
- Check allowed methods: `curl -X OPTIONS -i https://target/`.
- Screenshot live hosts (`gowitness`) to spot staging, admin, and default installs.
- Weak TLS: `testssl.sh target.com` for expired certs and legacy ciphers.

### Origin IP behind CDN/WAF
- Historical DNS: SecurityTrails/DNSDumpster for pre-CDN A records.
- Certificates: Censys/Shodan SANs and the target cert fingerprint across IPs.
- Mail headers: inspect `Received` and `X-Originating-IP` from a target email.
- Direct test: `curl --resolve target.com:443:<ip> https://target.com/`.
- Compare body, headers, and cert against the CDN response.
- Follow HTTP/3 `Alt-Svc` hosts and test Host/SNI mismatch.

## Access Control

### Authentication and session
- Username enum: compare status, message, and timing for valid vs invalid users.
- Test the same on password reset and registration.
- Default creds: try `admin/admin`, `admin/password`, `root/root`, and vendor defaults on every panel.
- Password guessing: send 20+ attempts and check for rate limit or lockout.
- Test case variants `admin` vs `Admin` and trailing whitespace.
- Reset tokens: decode, check expiry, reuse, and predictable sequence.
- Test Host header injection in reset email links.
- Verify reset tokens are invalidated after a password change.
- OTP/MFA: skip enrollment, replay a used code, brute short numeric codes.
- Attempt to disable MFA directly via the profile endpoint.
- Session: verify logout invalidates the token server-side.
- Check rotation on login, privilege change, and logout.
- Collect 20+ session IDs and look for sequential, timestamp, or low-variance tokens.
- Fixation: set a known session cookie pre-login, confirm it rotates after auth.
- CSRF: replay a state-changing request with the token removed.
- Change POST to GET, switch `Content-Type`, drop `Origin`/`Referer`.
- Login CSRF: force login as attacker and check the victim session binds to it.
- Check `SameSite` on session cookies; flag missing `Secure`/`HttpOnly`.
- Flag over-broad `Domain`/`Path` cookie scope.
- Account takeover: change email or phone without re-auth or verification.
- Register a weak password and observe whether policy is enforced server-side.
- Change password or email without supplying the current password.

### IDOR and forced browsing
- Swap IDs in URL, body, cookies, and headers (`id`, `user_id`, `account_id`).
- Try `1` to `2`, alternate UUIDs, and base64/hex decode.
- Add missing IDs (`user_id` on `/api/messages`) and duplicate params (`id=a&id=victim`).
- Wrap IDs in arrays/objects: `id=1` to `id=[1]` or `id={"id":1}`.
- Change method GET to PUT/DELETE and extension `/resource/1` to `/resource/1.json`.
- Bypass path filters with `/admin/`, `/./admin`, `/admin..;/`, `%2e%2e/admin`, `//admin`.
- Force-browse `/admin`, `/dashboard`, `/internal`, and older `/v1/` while low-privileged.
- Verb tamper with `OPTIONS`, `HEAD`, `TRACE`, and `X-HTTP-Method-Override`.
- Try `X-Original-URL`/`X-Rewrite-URL` header bypasses on blocked routes.
- Mass assignment: resend a fetched object as PUT with extra fields (`role`, `is_admin`, `balance`).
- Try `application/merge-patch+json` to sneak forbidden fields.
- Test report/file download endpoints for sequential or guessable object IDs.

## Input Validation
- SQLi probes: `'`, `''`, `' OR '1'='1`; watch errors and boolean differences.
- Time-based: `'; WAITFOR DELAY '0:0:5'--`; confirm with `sqlmap -u <url> --batch --level 3`.
- NoSQLi: send `' || '1'=='1`, `{"$gt":""}`, `{"$ne":null}`, and array-form params.
- Second-order: store a payload during create, trigger it later on admin views or exports.
- XSS: inject `<svg/onload=alert(1)>` into reflected params, JSON fields, and headers.
- Confirm reflection context before escalating; then test stored on profiles/comments.
- SSRF: point URL/callback params at `http://127.0.0.1:80` and `http://169.254.169.254/latest/meta-data/`.
- Use the `oob` tool for blind callback confirmation.
- LFI: try `?file=../../../../etc/passwd`, `%2e%2e%2f`, and double-encoding.
- Try wrappers: `php://filter/convert.base64-encode/resource=index.php`, `php://input`, `data://`.
- SSTI: send `{{7*7}}`, `${7*7}`, `<%= 7*7 %>`, `${{7*7}}`; a `49` confirms.
- Escalate with engine payloads (Jinja2, FreeMarker, Smarty) for read or RCE.
- Command injection: append `;id`, `|id`, `$(id)`, and backticks to params, headers, filenames.
- Use `;sleep 5` when the response is blind.
- XXE: send `<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]>` in XML bodies and SVG/DOCX uploads.
- Try XML payloads even when `Content-Type` is JSON.
- JSON parsing: send nested objects, arrays, and duplicate keys to find parser disagreements.
- Numeric fields: test overflow, negative values, and scientific notation in IDs and amounts.

### File upload triage
- Bypass filters with `.phtml`, `.php5`, `.PHP`, `file.php.jpg`, `file.php%00.jpg`, `file.php.`, `file.php::$DATA`.
- Set `Content-Type: image/jpeg` on a script and prepend `GIF89a;` to the body.
- Test `filename="../../etc/passwd"` and archive Zip Slip/symlink entries.
- Probe post-upload processing (thumbnailer/EXIF/AV) for RCE or SSRF.
- Disable client-side JS checks and intercept the raw multipart request.
- Confirm where the file lands and whether it is served or executed.

## Business Logic
- Replay a completed checkout/payment and verify idempotency keys block double-spend.
- Submit negative, zero, fractional, and overflow quantities/prices.
- Apply the same coupon repeatedly and stack discounts.
- Test refund/credit flows for negative or over-refund.
- Test currency rounding and partial-payment edge cases.
- Skip steps in multi-stage flows by calling the final endpoint directly.
- Tamper with client-supplied totals, currency, or role fields.
- Race delayed operations (withdraw, redeem, invite) with parallel requests for TOCTOU windows.
- Reuse a single-use token or invite across multiple accounts.
- Reorder or omit required fields; send truncated and duplicate fields to find unhandled states.
