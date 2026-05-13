# Use case: Contract approval

## What this demonstrates

An AI agent approves a pending contract through the full Ontologie safety loop — in under 5 minutes, on your machine.

- **Typed model**: `Contract` is a declared ObjectType with constrained status values, not a free-form row.
- **Bounded action**: `Contract.approve` declares preconditions, effects, execution mode, and risk level.
- **Signed plan**: a dry-run produces a plan artifact with the exact before/after diff.
- **Verified apply**: apply requires the same plan hash, actor, current object version, and an idempotency key.
- **Durable proof**: the resulting event is auditable with full provenance.

---

## Try it now

```bash
# Scaffold and start the local mock server
npx create-ontologie-app my-demo --template contract-review
cd my-demo
dataforge dev
```

In a second terminal:

```bash
# 1. Discover the model
dataforge schema describe --format json

# 2. Find pending contracts (seed has con_001 and con_002 in pending_review)
dataforge query Contract \
  --filter-json '{"status":{"eq":"pending_review"}}' \
  --format json

# 3. What does approve do?
dataforge actions describe Contract.approve --format json

# 4. Dry-run: create a signed plan (no mutation yet)
dataforge actions run Contract.approve con_001 \
  --input-json '{"comment":"Budget verified by finance"}' \
  --dry-run --format json

# The response contains planId and hash. Copy them for the next steps.

# 5. Inspect the plan
dataforge plan inspect <planId-from-output> --plan-format markdown

# 6. Apply the verified plan
dataforge actions run Contract.approve con_001 \
  --apply-plan <planId-from-output> \
  --plan-hash <hash-from-output> \
  --idempotency-key approve-con-001-001 \
  --format json

# 7. Confirm final state
dataforge query Contract \
  --filter-json '{"reference":{"eq":"CTR-2024-001"}}' \
  --format json
```

The only values you copy-paste are `planId` and `hash` from the dry-run output in step 4. Everything else uses concrete IDs from the seeded data.

---

## What just happened

| Step | What the runtime did |
|------|---------------------|
| **schema describe** | Returned the `Contract` ObjectType with status enum, `mutableBy` constraints, and three declared actions |
| **query** | Found `con_001` (CTR-2024-001, 45,000 EUR) and `con_002` (CTR-2024-002, 12,000 EUR) in `pending_review` |
| **actions describe** | Showed that `Contract.approve` requires `status == pending_review`, role `manager`, execution mode `twin_apply`, risk level `medium` |
| **dry-run** | Created a plan with the exact diff (`status: pending_review -> approved`, `approvedAt: null -> <applyTime>`), policy checks, cost estimate, and Ed25519 signature |
| **plan inspect** | Displayed the diff in human-readable markdown |
| **apply** | Re-validated all 27 PlanGuard checks, applied atomically, returned the updated object with incremented version |
| **final query** | Confirmed `status: approved`, `approvedAt` populated, version incremented once |

The agent never touched `Contract.status` directly. The runtime enforced the action contract at every step.

---

## Business situation

A sales, legal, or operations team wants an AI agent to review pending contracts and approve low-risk ones. The agent may have enough context, but the business cannot let it update contract status through a raw database write or a broad tool call. Ontologie turns the task into a bounded action: `Contract.approve`.

## Why raw agent access is unsafe

Without a governed runtime, an agent might:

- Mutate `Contract.status` directly.
- Approve a contract that is not in `pending_review`.
- Bypass role checks.
- Approve the wrong contract after stale data.
- Apply the same change twice.
- Leave no durable proof of who approved what and under which policy.

---

## Model

This is the actual schema from the [`contract-review` template](../../templates/README.md) (`dataforge.schema.ts`):

```ts
const ContractStatus = enumType('ContractStatus', [
  'draft',
  'pending_review',
  'approved',
  'rejected',
]);

const Client = objectType('Client', {
  name: string().required().indexed(),
  email: string().optional(),
  sector: string().optional(),
});

const Contract = objectType('Contract', {
  reference: string().required().indexed(),
  title: string().required(),
  amount: number(),
  currency: string().default('EUR'),
  status: ContractStatus.default('draft')
    .mutableBy(['Contract.submit', 'Contract.approve', 'Contract.reject']),
  submittedAt: date().optional()
    .mutableBy(['Contract.submit']),
  approvedAt: date().optional()
    .mutableBy(['Contract.approve']),
  rejectedAt: date().optional()
    .mutableBy(['Contract.reject']),
  rejectionReason: string().optional()
    .mutableBy(['Contract.reject']),
});

const ContractBelongsToClient = link('Contract', 'Client')
  .cardinality('many_to_one')
  .label('belongs_to');

const approveContract = action('approve')
  .on(Contract)
  .executionMode('twin_apply')
  .riskLevel('medium')
  .input({ comment: string().optional() })
  .requires(role('manager'))
  .when(c => c.status.eq('pending_review'))
  .set({ status: 'approved', approvedAt: now() });
```

---

## Actions and policy

| Action | Purpose | Execution mode |
|--------|---------|----------------|
| `Contract.submit` | Move a draft contract into review | `twin_apply` |
| `Contract.approve` | Approve a pending contract | `twin_apply` |
| `Contract.reject` | Reject a pending contract | `twin_apply` |

```json
{
  "requireDryRunBeforeMutation": true,
  "forbidDelete": true,
  "maxObjectsTouched": 1,
  "allowedActions": ["Contract.submit", "Contract.approve", "Contract.reject"]
}
```

- Only `manager` role can approve.
- Only contracts in `pending_review` can be approved.
- High-value contracts (above threshold) route to human review.
- Rejected contracts require a `rejectionReason`.
- `status`, `approvedAt`, and `rejectedAt` are protected by `mutableBy` — no direct writes.

---

## Agent task card

```
Task: Approve a pending contract safely.

Goal:
Approve one Contract only if the runtime says the action is available
and the dry-run plan passes policy checks.

Allowed commands:
- dataforge context pack "approve the pending contract safely" --format markdown
- dataforge schema describe --format json
- dataforge query contract --filter-json '{"status":{"eq":"pending_review"}}' --format json
- dataforge actions describe Contract.approve --format json
- dataforge actions run Contract.approve <contractId> --input-json '{"comment":"..."}' --dry-run --format json
- dataforge plan inspect <planId> --plan-format markdown
- dataforge plan verify <planId> --risk-acknowledged --confirmed --format json
- dataforge actions run Contract.approve <contractId> --apply-plan <planId> --plan-hash <hash> --idempotency-key <key> --format json
- dataforge instance get <contractId> --format json

Forbidden:
- Do not invent action keys.
- Do not update Contract.status directly.
- Do not apply without a dry-run.
- Do not apply a plan created by another actor.
- Do not retry a policy mismatch.

Success criteria:
- The contract status is approved.
- The object version increments once.
- An audit event references the action and plan.
```

---

## Expected plan output

When the dry-run succeeds, the JSON response looks like:

```json
{
  "ok": true,
  "data": {
    "planId": "845f9bf5-caf4-4ae2-bb0c-a96c3610c6df",
    "state": "pending",
    "action": {
      "key": "Contract.approve",
      "version": 1,
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
        "before": { "status": "pending_review", "approvedAt": null },
        "after": { "status": "approved", "approvedAt": { "$ref": "$applyTime" } }
      }
    ],
    "inputs": { "comment": "Budget verified by finance" },
    "policyChecks": [
      { "check": "mutableBy_status", "passed": true },
      { "check": "precondition_status_eq_pending_review", "passed": true },
      { "check": "required_role_manager", "passed": true }
    ],
    "hash": "sha256:7f3a...",
    "signature": "ed25519:...",
    "expiresAt": "2026-05-05T14:45:00Z"
  }
}
```

And `plan inspect --plan-format markdown` shows:

```markdown
# DataForge Action Plan

Plan: `845f9bf5-caf4-4ae2-bb0c-a96c3610c6df`
Status: `pending`
Action: `Contract.approve`
Risk: **medium**

## Changes

| Op | Object | Field | Before | After |
|:---|:-------|:------|:-------|:------|
| object.update | contract#con_001 | status | `pending_review` | `approved` |
| object.update | contract#con_001 | approvedAt | `null` | `2026-05-05T08:48:06Z` |
| object.update | contract#con_001 | decisionComment | `null` | `Budget verified...` |

## Policy Checks

| Check | Status | Severity |
|:------|:-------|:---------|
| status eq "pending_review" | PASS | blocking |

## Apply
dataforge actions run Contract.approve con_001 \
  --apply-plan 845f9bf5-caf4-4ae2-bb0c-a96c3610c6df \
  --plan-hash sha256:7f3a... \
  --idempotency-key approve-con-001-001
```

---

## Before / After

**Before Ontologie:**

> "The agent approved a contract by calling an API. We hope it picked the right record and followed our rules."

**With Ontologie:**

> "The agent could only call `Contract.approve`. The runtime checked the current contract state, role, policy, object version, and exact diff before applying the change. We have the signed plan and audit event."

## Proof produced

A successful run produces:

- `planId` and `planHash` (SHA-256).
- Exact before/after diff (e.g., `status: pending_review -> approved`).
- Target contract id and object version.
- Actor binding (who applied, credential type).
- Policy version active at the time of the check.
- Action version.
- Idempotency key (prevents duplicate application).
- Audit event with full provenance.

---

## Try the failure cases

The seed data includes `con_003` (status: `draft`). Use it to see how the runtime rejects unsafe operations:

**1. Precondition failure** — approve a contract that is not in `pending_review`:

```bash
dataforge actions run Contract.approve con_003 \
  --input-json '{"comment":"Trying to approve a draft"}' \
  --dry-run --format json
# Returns error: precondition failed (status is "draft", expected "pending_review")
```

**2. Idempotency replay** — re-apply the same key after a successful apply:

```bash
dataforge actions run Contract.approve con_001 \
  --apply-plan <planId> \
  --plan-hash <hash> \
  --idempotency-key approve-con-001-001 \
  --format json
# Returns the cached result without re-mutating the object
```

**3. Version conflict** — approve con_002, then try to apply a plan created before that approval:

```bash
# First, create a plan for con_002
dataforge actions run Contract.approve con_002 \
  --input-json '{"comment":"First approval"}' \
  --dry-run --format json
# Save the planId. Now approve con_001 (this increments the manifest version).
# Then try to apply the stale con_002 plan:
# Returns error: version conflict (object changed since dry-run)
```

Failures are where safety becomes tangible. The runtime never silently succeeds when preconditions, versions, or policies don't match.

---

## Validation primitives

These primitives make this use case reusable as the reference pattern for all other use cases:

| Primitive | Required proof |
|-----------|----------------|
| Context grounding | `dataforge context pack` returns a non-empty context before action selection |
| Twin query | `dataforge query` returns at least one target object in the expected state |
| Action contract | `actions describe` exposes the action key, execution mode, preconditions, effects, and input schema |
| Signed plan creation | Dry-run returns `planId`, `planHash`, `signature.algorithm=ed25519`, target binding, and expiry |
| Inspectability | `plan inspect` returns a readable diff or effect list before any apply |
| Verifiability | `plan verify` returns zero failed checks, or `PLAN_CONTEXT_MISMATCH` when a new dry-run is required |
| Governed apply | `--apply-plan` requires `--plan-hash` and an idempotency key and cannot mutate outside the signed plan |
| Durable proof | Audit or action execution references the `planId`, actor, idempotency hash, and final status |
