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
    "planId": "845f9bf5-caf4-4ae2-bb0c-a96c3610c6df",
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
        "principalType": "api_key",
        "principalId": "key_local_dev"
      },
      "workspace": "local",
      "manifestVersion": 1,
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
    "hash": "sha256:7f3a...",
    "signature": "ed25519:...",
    "createdAt": "2026-05-04T14:30:00Z",
    "expiresAt": "2026-05-04T14:45:00Z"
  },
  "page": null,
  "meta": {
    "requestId": "req_789",
    "durationMs": 45,
    "costUnits": 0,
    "manifestVersion": 1,
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

Copy the `planId` and `hash` from the dry-run response above:

```bash
dataforge actions run Contract.approve con_001 \
  --apply-plan 845f9bf5-caf4-4ae2-bb0c-a96c3610c6df \
  --plan-hash sha256:7f3a... \
  --idempotency-key approve-con-001-001 \
  --format json
```

The server re-validates all 27 PlanGuard checks and applies atomically.

## Failure cases

Try these with the seed data:

```bash
# Precondition failure: con_003 is in "draft", not "pending_review"
dataforge actions run Contract.approve con_003 \
  --input-json '{"comment":"Trying to approve a draft"}' \
  --dry-run --format json

# Idempotency replay: re-apply the same key after success
dataforge actions run Contract.approve con_001 \
  --apply-plan <planId> \
  --plan-hash <hash> \
  --idempotency-key approve-con-001-001 \
  --format json
# Returns cached result without re-mutation
```
