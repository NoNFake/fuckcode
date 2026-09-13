---
name: offensive-reporting
description: "Pentest report writing: exec summary, findings, CVSS, evidence hygiene, remediation. Triggers - report deliverable, CVSS, retest."
---

## Rules of Engagement
Only test systems you are authorized to assess. Confirm the written scope and rate limits before active commands. Prefer the least-invasive check that proves impact; stop on evidence of production impact.

# Penetration Test Reporting

The report is the deliverable the client pays for and the developer fixes from. Draft each finding while context is fresh; build the executive summary last, after all findings are scored. The report itself is produced with the `report_gen` tool and the `/report` command; `report_gen` emits markdown, json, and sarif.

## Executive Summary

For the CISO, GRC, and board. One page max:

1. Engagement context — what was tested, when, by whom.
2. Headline finding — the worst issue in business terms.
3. Risk verdict — overall posture in plain language.
4. Counts — findings by severity.
5. Top three programmatic recommendations.

Translate jargon. Write "an attacker could run arbitrary commands on the server", not "RCE via deserialization gadget chain". Anchor every finding to a business consequence: customer data, regulatory exposure, operational disruption, financial loss.

## Finding Template

```markdown
## Finding ID — Short Descriptive Title

**Severity:** Critical (CVSS 9.8 — vector below)
**Affected Asset:** <hosts/URLs/components, with version where relevant>
**Status:** Open / Fixed in retest / Accepted Risk
**CWE:** CWE-89 (SQL Injection)
**OWASP:** A03:2021 — Injection

### Summary
One paragraph. What the finding is, why it matters, the worst case.

### Description
Root cause, not just symptom.

### Reproduction Steps
1. Numbered, copy-paste ready.
2. Exact request/response, redacted.
3. A reader with no engagement context reproduces in under 15 minutes.

### Evidence
- `screenshots/finding-007/01-payload.png`
- `requests/finding-007/initial-poc.http`
- `evidence-log.csv` line 142

### Impact
Concrete and quantified where possible: records exposed, accounts compromised, tenants crossed.

### Remediation
1. **Fix** — exact code change or config flag.
2. **Defense in depth** — secondary control (WAF rule, input validation).
3. **Detection** — log line or SIEM rule that would have caught the exploit.

### Notes for Retest
The specific request and expected response that verify the fix.
```

## Severity and CVSS

CVSS is a tool, not a verdict. Score it, then sanity-check against business impact.

```
CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H = 9.8 Critical
```

Justify every metric in one sentence: AV (exposure), AC (preconditions), PR (authentication), UI (interaction), S (scope crossing), C/I/A (read/write/availability impact). If two reasonable people would score differently, document why you chose your vector. Do not inflate: a report where everything is Critical loses trust.

CVSS does not capture business context. A "Medium" XSS in a PII-handling agent panel can outrank an unauthenticated "High" on an isolated internal service. Score CVSS honestly, then add a Business Impact Adjustment paragraph arguing for higher reporting severity. Use CVSS v4.0 only when the client mandates it; v3.1 is otherwise the default.

## Evidence Hygiene

Capture, per finding: UTC ISO 8601 timestamp, source IP (including pivots), target, action sent, result received, and a hash of any data extracted.

```csv
timestamp,operator,src_ip,target,action,result_hash,notes
<UTC ISO 8601>,<operator>,<src_ip>,<target>,<probe>,sha256:<hash>,<notes>
```

Redaction before any artifact leaves the secure environment:

- Replace credentials and tokens with placeholders: `<REDACTED-PASSWORD>`, `<TOKEN-A1>`.
- Hash extracted PII; never include real names, emails, or identifiers in screenshots.
- Crop screenshots to the relevant area and check for leaked browser tabs or session tokens in visible URLs.
- Strip EXIF from images.
- Remove debug toolbars that reveal client infrastructure paths.

Chain of custody: encrypted volume during the engagement with a per-engagement key; wipe to client specification after delivery (typically 30–90 days); retain only the report and a hash manifest, deletable on request.

## Scope, Limitations, Assumptions

Be explicit; these protect both sides. Scope is what was tested, with the engagement window and exclusions. Limitations are what blocked you: internet-only testing, no source review, no production mutations, restricted testing windows. Assumptions are environmental premises you did not verify, such as staging mirroring production. Do not conflate scope with limitations.

## Retest and Closeout

Report each finding's retest status with the verification date, and include the exact request and response that proves the fix. Without proof, "fixed" is hearsay. A standing finding stays open until verified.

| Finding | Original Severity | Retest Status | Verification Date |
|---------|-------------------|---------------|-------------------|
| #1 | Critical | Fixed (verified) | <date> |
| #2 | High | Partially fixed | <date> |
| #5 | Medium | Not fixed — finding stands | <date> |
| #11 | Low | Accepted Risk (client decision) | <date> |

## Common Mistakes

- Over-scoring CVSS or using marketing language.
- Dumping raw tool output instead of curating the relevant lines.
- Generic remediation ("validate input") instead of a specific change.
- Missing reproduction steps or untimed evidence.
- Confusing scope with limitations.
- Omitting the retest verification method.
