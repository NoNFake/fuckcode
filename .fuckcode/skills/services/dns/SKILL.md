---
name: svc-dns
description: "DNS attacks: zone transfer, subdomain takeover, dangling CNAME, DNSSEC, open resolver. Triggers - port 53, AXFR, dangling CNAME."
---

## Rules of Engagement
Only test systems you are authorized to assess. Confirm the written scope and rate limits before active commands. Prefer the least-invasive check that proves impact; stop on evidence of production impact.

# DNS Attack Reference

## Zone Transfer (AXFR)
```bash
dig AXFR <domain> @<ns_server>
host -t AXFR <domain> <ns_server>
dnsrecon -d <domain> -a
```

## Enumeration
```bash
dig <domain> A +short; dig <domain> AAAA +short; dig <domain> MX +short
dig <domain> NS +short; dig <domain> TXT +short; dig <domain> SOA +short; dig <domain> SRV +short
dnsrecon -r <cidr>                       # reverse DNS for a range
dnsrecon -d <domain> -D /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt -t brt
dnsenum <domain>
fierce --domain <domain>
```

## Subdomain Takeover
```bash
dig CNAME <subdomain>                    # dangling CNAME to unclaimed S3/Heroku/GitHub Pages/Azure = candidate
dnsreaper subdomain --domain <domain>
nuclei -t takeovers/ -l subdomains.txt
```

## Resolver Checks
```bash
dig @<target> example.com +recurse        # open resolver?
dig @<target> <popular_domain> +norecurse # cache snooping via non-recursive query
```

## DNSSEC
```bash
dig <domain> DNSKEY +dnssec
dig <domain> DS @<parent_ns>
```

## Tunneling (detection)
Long labels, unusual TXT, high query volume to one domain. `iodine`/`dnscat2` establish tunnels; test only when explicitly in scope.
