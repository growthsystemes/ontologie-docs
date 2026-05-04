# Errors

Every error in Ontologie is structured, machine-readable, and actionable. Agents and applications can programmatically determine what went wrong, whether to retry, and how to recover.

---

## Error envelope

```json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "PLAN_EXPIRED",
    "message": "Plan ttl exceeded (300s)",
    "retryable": true,
    "remediation": {
      "summary": "Create a new dry-run to get a fresh plan.",
      "command": "dataforge actions run Contract.approve con_001 --dry-run --format json"
    },
    "details": {
      "planId": "plan_xyz",
      "expiredAt": "2026-05-04T10:05:00Z",
      "ttlSeconds": 300
    }
  },
  "page": null,
  "meta": {
    "requestId": "req_def456",
    "durationMs": 12
  }
}
```

| Field | Type | Always present | Description |
|-------|------|---------------|-------------|
| `error.code` | string | Yes | Machine-readable error identifier |
| `error.message` | string | Yes | Human-readable description |
| `error.retryable` | boolean | Yes | Whether the operation can be retried |
| `error.remediation.summary` | string | Yes | Actionable recovery instruction |
| `error.remediation.command` | string | When applicable | Suggested CLI command to recover |
| `error.details` | object | When applicable | Additional structured context |

---

## Error families

| Family | Codes | HTTP range | CLI exit |
|--------|-------|-----------|----------|
| Validation | `INVALID_INPUT`, `MISSING_FIELD`, `TYPE_MISMATCH` | 400 | 2 |
| Authentication | `AUTH_FAILED`, `TOKEN_EXPIRED`, `KEY_INVALID` | 401 | 3 |
| Authorization | `SCOPE_DENIED`, `WRITE_POLICY_VIOLATION`, `RBAC_DENIED` | 403 | 4 |
| Drift | `PLAN_SCHEMA_MISMATCH`, `PLAN_POLICY_MISMATCH`, `PLAN_ACTION_MISMATCH`, `SCHEMA_DRIFT` | 409 | 5 |
| Conflict | `PLAN_EXPIRED`, `PLAN_REVOKED`, `PLAN_ALREADY_APPLIED`, `PLAN_TARGET_VERSION_CONFLICT`, `PLAN_IDEMPOTENCY_CONFLICT`, `OCC_CONFLICT` | 409/410 | 7 |
| Rate/Quota | `RATE_LIMITED`, `BUDGET_EXCEEDED`, `COMMAND_COST_LIMIT_EXCEEDED`, `QUOTA_EXCEEDED` | 429 | 8/11 |
| Network | `TIMEOUT_ERROR`, `NETWORK_ERROR` | 504 | 9 |
| Precondition | `ACTION_PRECONDITION_FAILED`, `CONFIRMATION_REQUIRED` | 412 | 10 |
| Configuration | `MISSING_CONFIG`, `INVALID_CONFIG` | 400 | 12 |

---

## Plan errors (most common for agents)

| Code | HTTP | Retryable | Agent recovery |
|------|------|-----------|----------------|
| `PLAN_NOT_FOUND` | 404 | No | Check the plan ID |
| `PLAN_SIGNATURE_INVALID` | 400 | No | Re-run dry-run (plan corrupted) |
| `PLAN_EXPIRED` | 410 | Yes | New dry-run for a fresh plan |
| `PLAN_REVOKED` | 410 | Yes | New dry-run |
| `PLAN_ALREADY_APPLIED` | 409 | No | Plan consumed. New dry-run needed. |
| `PLAN_ACTOR_MISMATCH` | 403 | No | Same actor must apply. Check session/key. |
| `PLAN_SCHEMA_MISMATCH` | 409 | Yes | Re-discover schema, new dry-run |
| `PLAN_POLICY_MISMATCH` | 409 | No | Policy updated. Do not retry. Re-authorize with workspace owner. |
| `PLAN_ACTION_MISMATCH` | 409 | Yes | Action modified. New dry-run. |
| `PLAN_TARGET_VERSION_CONFLICT` | 409 | Yes | Re-query target, new dry-run |
| `PLAN_TOO_LARGE` | 400 | No | Reduce objects in plan |
| `PLAN_EXECUTION_MODE_MISMATCH` | 409 | Yes | Mode changed. New dry-run. |

---

## Policy errors

| Code | HTTP | Retryable | Recovery |
|------|------|-----------|----------|
| `POLICY_VIOLATION` | 403 | No | Request violates workspace policy |
| `WRITE_POLICY_VIOLATION` | 403 | No | Use the declared action for this field |
| `PLAN_POLICY_MISMATCH` | 409 | No | Policy changed. Do not retry. Re-authorize with workspace owner. |

---

## Quota and rate errors

| Code | HTTP | Retryable | Recovery |
|------|------|-----------|----------|
| `RATE_LIMITED` | 429 | Yes | Wait `retryAfterSeconds` |
| `BUDGET_EXCEEDED` | 429 | No* | Wait for period reset or increase budget |
| `COMMAND_COST_LIMIT_EXCEEDED` | 429 | No | Reduce scope or increase per-command cap |
| `QUOTA_EXCEEDED` | 429 | No* | Contact admin or upgrade plan |

*Budget resets at period boundary.

---

## Agent recovery rules

| Rule | When |
|------|------|
| Stop and retry after `retryAfterSeconds` | `RATE_LIMITED` |
| Create a new dry-run | `PLAN_EXPIRED`, `PLAN_REVOKED`, `PLAN_ALREADY_APPLIED` |
| Re-query + new dry-run | `PLAN_TARGET_VERSION_CONFLICT` |
| Re-discover schema + new dry-run | `PLAN_SCHEMA_MISMATCH` |
| Do NOT retry automatically | `PLAN_POLICY_MISMATCH`, `QUOTA_EXCEEDED` |
| Use the correct action | `WRITE_POLICY_VIOLATION` |
| Check allowed actions | `ACTION_PRECONDITION_FAILED` |
| Surface to user | `QUOTA_EXCEEDED`, `BUDGET_EXCEEDED` |

---

## Exit codes (CLI)

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Validation (invalid input) |
| 3 | Authentication |
| 4 | Authorization |
| 5 | Capability drift |
| 6 | Schema drift |
| 7 | Conflict |
| 8 | Rate limited |
| 9 | Network/timeout |
| 10 | Precondition failed |
| 11 | Quota exceeded |
| 12 | Configuration error |

---

## Best practices

1. **Always check `error.retryable`** before attempting a retry.
2. **Use `error.code`** for programmatic handling, not `error.message`.
3. **Respect `Retry-After` header** -- do not implement aggressive retry loops.
4. **Surface quota errors** to users rather than retrying indefinitely.
5. **Log `meta.requestId`** for support requests and debugging.
6. **Re-run dry-run** (not the same apply) when a plan error occurs.
