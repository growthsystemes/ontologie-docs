# Expected Plan Output

When you run:

```bash
dataforge actions run Contract.approve con_001 \
  --input-json '{"comment":"Budget verified by finance"}' \
  --dry-run --format json
```

The server returns a plan artifact like:

```json
{
  "ok": true,
  "data": {
    "planId": "plan_abc123def456",
    "state": "pending",
    "action": {
      "key": "Contract.approve",
      "version": 1,
      "definitionHash": "sha256:a1b2c3...",
      "executionMode": "twin_apply",
      "riskLevel": "medium"
    },
    "target": {
      "objectType": "Contract",
      "instanceId": "con_001",
      "version": 2
    },
    "effects": [
      {
        "type": "update",
        "objectType": "Contract",
        "instanceId": "con_001",
        "before": {
          "status": "pending_review",
          "approvedAt": null
        },
        "after": {
          "status": "approved",
          "approvedAt": { "$ref": "$applyTime" }
        }
      }
    ],
    "inputs": {
      "comment": "Budget verified by finance"
    },
    "bindings": {
      "actor": {
        "principalType": "agent_on_behalf_of",
        "principalId": "agent_xyz",
        "onBehalfOf": "user_jane"
      },
      "workspace": "ws_abc",
      "manifestVersion": 3,
      "policyVersion": 1
    },
    "costEstimate": {
      "totalDfu": 5,
      "breakdown": [
        { "operation": "apply_action", "dfu": 5 }
      ]
    },
    "policyChecks": [
      { "check": "workspace_policy", "passed": true },
      { "check": "mutableBy_status", "passed": true },
      { "check": "precondition_status_eq_pending_review", "passed": true },
      { "check": "required_role_manager", "passed": true },
      { "check": "budget_available", "passed": true }
    ],
    "hash": "sha256:deadbeef...",
    "signature": "ed25519:base64signature...",
    "createdAt": "2026-05-04T14:30:00Z",
    "expiresAt": "2026-05-04T14:45:00Z"
  },
  "page": null,
  "meta": {
    "requestId": "req_789",
    "durationMs": 45,
    "costUnits": 0,
    "manifestVersion": 3,
    "policyVersion": 1
  }
}
```

## What to verify before apply

1. `effects[0].after.status` is `"approved"` (expected change)
2. `effects[0].after.approvedAt` is `{"$ref":"$applyTime"}` (resolved at apply time)
3. `policyChecks` all passed
4. `costEstimate.totalDfu` is acceptable (dry-run itself is free: `meta.costUnits: 0`)
5. `expiresAt` gives enough time to apply
6. `bindings.actor` matches your identity

## Apply command

```bash
dataforge actions run Contract.approve con_001 \
  --apply-plan plan_abc123def456 \
  --idempotency-key approve-con-001-20260504 \
  --format json
```

The server re-validates all 27 PlanGuard checks and applies atomically.
