---
name: enumeration-phase
tags: [enumeration]
description: "Enumeration phase: port scanning, service detection, banner grabbing. Triggers - ENUMERATION phase, nmap, banner."
---

## Rules of Engagement
Only test systems you are authorized to assess. Confirm the written scope and rate limits before active commands. Prefer the least-invasive check that proves impact; stop on evidence of production impact.

# Active Enumeration Checklist

## Port Scanning & Service Detection
```bash
# Discovery & top ports
nmap -sS --top-ports 1000 --min-rate 3000 -oA quick <target>
# Full TCP scan
nmap -sS -p- --min-rate 5000 -oA full_tcp <target>
# Service detection
nmap -sV -sC -p <found_ports> -oA services <target>
```

## Protocol-Specific Enumeration
```bash
# Web
whatweb http://<target> -a 3
ffuf -u http://<target>/FUZZ -w /usr/share/seclists/Discovery/Web-Content/raft-medium-directories.txt -mc 200,301,302,403

# SMB (445)
crackmapexec smb <target> --shares
enum4linux-ng -A <target>

# LDAP (389/636)
ldapsearch -x -H ldap://<target> -b "" -s base namingContexts

# SNMP (161)
onesixtyone -c /usr/share/seclists/Discovery/SNMP/common-snmp-community-strings.txt <target>

# NFS (2049)
showmount -e <target>
```
