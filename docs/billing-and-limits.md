# Billing and Limits

> Free locally. Metered in the cloud. Governed when it matters.

---

## Plans

| Plan | Price | What you get | Environments |
|------|-------|-------------|--------------|
| **Local Free** | Free, no account | Model, generate, mock, test | Local |
| **Cloud Sandbox** | Free, no card | Operational twin, 10K DFU hard cap | dev |
| **Cloud Runtime** | Prepaid DFU packs | Production, signed plans, budget controls | dev + prod |
| **+ Governance** | Per workspace/month | RBAC, approvals, audit retention | dev + staging + prod |
| **Enterprise** | Contract | SSO, SCIM, data residency, dedicated | Custom |

---

## What is free, what is paid

**Always free:**
- Local modeling, schema design, type generation, dry-run validation
- Cloud Sandbox: 10,000 DFU/month hard cap. No overages. No card required. When the cap is reached, mutations stop.

**Paid (Cloud Runtime+):**
- Prepaid DFU packs with configurable budget controls
- Production workspaces, higher budgets, governed plans
- Preview capabilities (semantic search, deep traversal, MCP write tools)

---

## DataForge Units (DFU)

One DFU approximates one lightweight read. Heavier operations cost more. The CLI reports actual DFU spend per command via `X-Cost-Units` header.

### Indicative cost per operation

| Operation | DFU |
|-----------|-----|
| Schema describe | 1 |
| Context pack | 2 |
| Query (page of 20) | 2 -- 5 |
| Aggregate | 8 -- 70 |
| Search (keyword) | 5 -- 20 |
| Graph neighbors (depth 1) | 10 |
| Action apply-plan | 5 -- 45 |

Dry-runs are free. They return a `costEstimate` showing what the future apply will cost. The `meta.costUnits` field is 0 for dry-run responses.

### Scenario examples

| Scenario | Approximate DFU |
|----------|-----------------|
| Context pack + query + dry-run + inspect + verify | 5 -- 10 |
| Apply one contract approval (`twin_apply`) | 5 -- 10 |
| Import 500 contracts (apply) | 50 -- 100 |
| Daily agent review of 50 contracts | 150 -- 250 |
| Schema push (dry-run + apply) | 10 -- 15 |

---

## Budget controls

| Control | Effect |
|---------|--------|
| Monthly cap | Hard ceiling on total DFU per workspace |
| Daily cap | Optional limit to spread usage evenly |
| Per-command cap | Maximum DFU a single command can consume |

When a cap is hit, the command returns a budget-exceeded error. No partial charges. No silent continuation.

```bash
# Preview cost before executing
dataforge actions run Contract.approve con_001 --dry-run --explain-cost --format json

# Limit query to 20 results (reduces DFU by fetching fewer rows)
dataforge query Contract --limit 20 --format json
```

---

## Runtime limits

### Plan limits

| Limit | Cloud Sandbox | Cloud Runtime | + Governance |
|-------|--------------|--------------|--------------|
| Max objects per plan | 20 | 100 | Configurable |
| Max linked writes | 5 | 5 | 10 |
| Max plan input size | 64 KB | 256 KB | 1 MB |
| Plan retention | 24 hours | 7 days | 30 days |
| Apply lock timeout | 5s | 5s | 5s |

### Plan TTL by risk level

| Risk | Default TTL | Max TTL |
|------|-------------|---------|
| `low` | 60 min | 60 min |
| `medium` | 15 min | 30 min |
| `high` | 5 min | 15 min |

### Query limits

| Limit | Value |
|-------|-------|
| Max `--limit` | 10,000 |
| Default `--limit` | 50 |
| Max `--offset` | 100,000 |
| Response body max | 10 MB |

### Graph limits

| Operation | Max depth | Max results | Timeout |
|-----------|-----------|-------------|---------|
| `neighbors` | 1 hop | 100 | 10s |
| `traverse` | 2 hops | 200 | 30s |
| `shortestPath` | 5 hops | 1 | 15s |

### Import/Export limits

| Limit | Value |
|-------|-------|
| Import max rows | 10,000 |
| Import max file size | 50 MB |
| Export max rows | 100,000 |
| Export timeout | 120s |

### API rate limits

| Limit | Value |
|-------|-------|
| Requests per hour | 1,000 |
| Burst (per second) | 10 |

---

## Per-tier quotas

| Limit | Sandbox | Runtime | Governance | Enterprise |
|-------|---------|---------|------------|------------|
| Workspaces | 1 | Unlimited | Unlimited | Custom |
| Environments | dev | dev + prod | dev + staging + prod | Custom |
| Objects | 5,000 | Unlimited | Unlimited | Unlimited |
| DFU/month | 10K (hard) | Configurable | Configurable | Contractual |
| Graph depth | 1 | 3 | 5+ | Custom |
| Search | Keyword | Keyword + semantic | Full | Full |
| Audit retention | 7 days | 30 days | 30-365 days | Custom |
| Max API keys | 5 | 25 | Unlimited | Unlimited |
| MCP tools | None | Read + dry-run | All (governed) | All |

---

## Response headers

| Header | When | Description |
|--------|------|-------------|
| `X-Cost-Units` | Every metered response | DFU consumed |
| `X-Budget-Remaining` | Every metered response | DFU remaining |
| `X-Budget-Warning` | > 80% consumed | Budget running low |
| `X-RateLimit-Remaining` | Every response | Requests remaining |
| `X-RateLimit-Reset` | On 429 | Window reset timestamp |
| `Retry-After` | On 429 or 503 | Seconds to wait |

---

## Agent protections by tier

| Protection | Sandbox | Runtime | Governance | Enterprise |
|-----------|---------|---------|------------|------------|
| Default agent mode | read-only | read-only | read-write | custom |
| Max DFU per command | 10 | 50 | 100 | configurable |
| Semantic search | No | Preview | Yes | Yes |
| MCP tools | None | Read + dry-run | All | All |
| Loop detection | Yes | Yes | Yes | Yes |
| Hard-stop mode | Fail-closed | Budget cap | Budget cap | SLA |

---

## Discovering limits

All limits are available programmatically:

```bash
dataforge capabilities export --format json
```

The response includes your workspace's effective limits, adjusted for your tier and any custom configuration.

---

## Error codes for limit violations

| Code | HTTP | Meaning |
|------|------|---------|
| `RATE_LIMITED` | 429 | Too many requests |
| `BUDGET_EXCEEDED` | 429 | Workspace budget cap reached |
| `COMMAND_COST_LIMIT_EXCEEDED` | 429 | Single command exceeds per-command cap |
| `PLAN_EXPIRED` | 410 | Plan TTL exceeded |
| `PLAN_TOO_LARGE` | 400 | Plan exceeds max effects |
| `IMPORT_TOO_LARGE` | 400 | File exceeds size/row limits |
| `QUERY_LIMIT_EXCEEDED` | 400 | Query exceeds max limit/offset |
| `TIMEOUT_ERROR` | 504 | Operation exceeded timeout |

All error responses include `retryable`, `remediation.summary`, and the relevant limit value.
