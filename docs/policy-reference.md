# Policy Reference

---

## Overview

Each workspace has a policy document that defines hard constraints on operations. Policies are enforced server-side -- they are not advisory and cannot be bypassed by agents or SDKs.

---

## Policy rules

| Rule | Type | Default | Description |
|------|------|---------|-------------|
| `defaultMode` | `read_only` \| `dry_run` \| `live` | `live` | Default operation mode for the workspace |
| `requireDryRunBeforeMutation` | boolean | `true` | Block direct apply without prior dry-run |
| `requireIdempotencyKey` | boolean | `true` | Every apply must carry a unique key |
| `forbidDelete` | boolean | `false` | No delete operations accepted |
| `allowedActions` | string[] | all | Whitelist of permitted action keys |
| `maxObjectsTouched` | integer | 20 | Max objects a single command can modify |
| `maxCostUnitsPerCommand` | integer | 50 | DFU cap per command |

---

## Reading the policy

```bash
dataforge capabilities export --format json
```

The policy is included in the capabilities manifest under the `policy` key:

```json
{
  "policy": {
    "defaultMode": "live",
    "requireDryRunBeforeMutation": true,
    "requireIdempotencyKey": true,
    "forbidDelete": false,
    "maxObjectsTouched": 20,
    "maxCostUnitsPerCommand": 50
  }
}
```

---

## Configuring the policy

Workspace policies are configured in the Ontologie Cloud console by workspace administrators. CLI-based policy management is planned for V1.1.

Policy changes take effect immediately. Pending plans created before a policy change will be rejected at apply time with `PLAN_POLICY_MISMATCH`.

---

## Policy by tier

| Rule | Sandbox | Runtime | Governance | Enterprise |
|------|---------|---------|------------|------------|
| `requireDryRunBeforeMutation` | true (locked) | configurable | configurable | configurable |
| `forbidDelete` | true (locked) | configurable | configurable | configurable |
| `maxObjectsTouched` | 20 (locked) | 100 | configurable | configurable |
| `maxCostUnitsPerCommand` | 10 | 50 | 100 | contractual |

---

## Agent policy

Agent-facing principals (those with `agent_on_behalf_of` principal type) have additional constraints applied:

- `requireDryRunBeforeMutation` is always enforced for agent principals
- `requireIdempotencyKey` is always enforced for agent principals
- These cannot be relaxed even if the workspace policy is more permissive

---

## Errors

| Code | HTTP | Retryable | Meaning |
|------|------|-----------|---------|
| `POLICY_VIOLATION` | 403 | No | Request violates workspace policy |
| `PLAN_POLICY_MISMATCH` | 409 | No | Policy changed between dry-run and apply |
