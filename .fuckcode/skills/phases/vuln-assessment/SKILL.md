---
name: vuln-assessment-phase
tags: [vuln_assess]
description: "Vulnerability assessment and exploitation: scanning, CVE lookup, misconfig detection, exploit verification, credential attacks, foothold. Triggers - VULN_ASSESS phase, EXPLOITATION phase, CVE, misconfig, credential attack."
---

## Rules of Engagement
Only test systems you are authorized to assess. Confirm the written scope and rate limits before active commands. Prefer the least-invasive check that proves impact; stop on evidence of production impact.

# Vulnerability Assessment Checklist

## Automated Vulnerability Scanning
```bash
# Nuclei — critical and high first
nuclei -u <target> -severity critical,high -o nuclei_crithigh.txt
nuclei -u <target> -t cves/ -o nuclei_cves.txt
nuclei -u <target> -t misconfiguration/ -o nuclei_misconfig.txt
nuclei -u <target> -t exposures/ -o nuclei_exposures.txt

# From list of URLs
nuclei -l urls.txt -severity critical,high -o nuclei_bulk.txt

# Nmap vuln scripts
nmap --script vuln -p <ports> <target> -oA vuln_scan
```

## CVE and Exploit Lookup
For each identified service version, after scope is confirmed:
```bash
searchsploit <service> <version>
searchsploit --nmap services.xml   # parse nmap output
searchsploit -m <exploit_id>       # only after scope confirmed
```
Resolve the version to an exploit only after scope confirmation, then prove applicability with a non-destructive check (read-only banner, version probe) before any attempt.

## Default Credentials and Credential Attacks
Test common defaults for discovered services:
- Web admin panels: admin/admin, admin/password, root/root
- Databases: root/(empty), sa/(empty), postgres/postgres
- SSH: root/toor, admin/admin
- Network devices: admin/admin, cisco/cisco

```bash
# Single default credential test
hydra -l admin -p admin <target> <protocol>
```

Credential attacks are noisy and lockout-prone. Run only under confirmed authorization and rate limits:
```bash
hydra -l <user> -P /usr/share/wordlists/rockyou.txt ssh://<target> -t 4
netexec smb <target> -u users.txt -p passwords.txt
```

## Web Vulnerability Assessment
```bash
# SQL injection: detection, then scoped extraction
sqlmap -u "http://<target>/page?id=1" --batch --level 3 --risk 2
sqlmap -u "http://<target>/page?id=1" --batch --dbs
sqlmap -u "http://<target>/page?id=1" --batch -D <db> -T <table> --dump

# XSS scanning
dalfox url "http://<target>/page?q=test"

# SSL/TLS issues
sslscan <target>
testssl.sh <target>

# Security headers
curl -sI http://<target> | grep -iE "x-frame|x-content|strict-transport|content-security|x-xss"
```
Run sqlmap extraction only after scope is confirmed and the injection is verified with a harmless boolean or timing check; avoid `--dump` on production data unless authorized.

## LFI / Command Injection / SSRF Confirmation
Confirm only after scope is confirmed and a non-destructive check has passed.
- LFI: demonstrate with a benign, world-readable file (`/etc/hostname`) rather than blind traversal; escalate to sensitive files only with authorization.
- Command injection: prove with a timing or benign marker (e.g. `sleep`), never a bare `;id` chain.
- SSRF: use a controlled callback or known-safe internal endpoint; never probe cloud metadata (IMDS) without explicit written authorization.

## Misconfiguration Checks
- Anonymous FTP access: `ftp <target>` with anonymous/anonymous
- Open Redis: `redis-cli -h <target> INFO`
- MongoDB no auth: `mongosh --host <target> --eval "db.adminCommand('listDatabases')"`
- Elasticsearch open: `curl http://<target>:9200/_cat/indices`
- Docker API exposed: `curl http://<target>:2375/version`
- Kubernetes API: `curl -k https://<target>:6443/api`

## Severity Classification
- **Critical**: RCE, auth bypass, default creds on critical service, SQLi with data access
- **High**: File read/write, privilege escalation vector, SSRF to internal
- **Medium**: XSS (stored), information disclosure (sensitive), misconfig with limited impact
- **Low**: XSS (reflected), verbose errors, minor info disclosure
- **Info**: Open ports, version disclosure, missing headers

## Post-Authentication Foothold
After credentials or code execution are confirmed and documented, establish the least-privileged foothold needed to prove access. Re-confirm scope and rate limits before pivoting.
```bash
ssh <user>@<target>
evil-winrm -i <target> -u <user> -p '<pass>'
impacket-psexec <domain>/<user>:'<pass>'@<target>
```

## Phase Completion Criteria
- Automated scans completed
- CVEs checked for all versioned services
- Default credentials tested
- Web vulns assessed
- Verified exploits and footholds documented with severity and evidence
