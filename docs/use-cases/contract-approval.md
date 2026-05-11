# Use case: Contract approval

## Business situation

A sales, legal, or operations team wants an AI agent to review pending contracts and approve low-risk ones.

The agent may have enough context to recommend an approval, but the business cannot let it update contract status through a raw database write, a generic CRUD endpoint, or a broad tool call.

Ontologie turns the task into a bounded business action: `Contract.approve`.

## Why a normal agent interface is unsafe

Without a governed runtime, an agent might:

- Mutate `Contract.status` directly.
- Approve a contract that is not in `pending_review`.
- Bypass role checks.
- Approve the wrong contract after stale data.
- Apply the same change twice.
- Leave no durable proof of who approved what and under which policy.

Ontologie makes the agent prove the intended change before anything is written.

## What Ontologie adds

- `Contract` is a typed ObjectType with declared properties.
- `status` is constrained to declared values, not a free-form string.
- `status` can only be changed by declared actions (`Contract.approve`, `Contract.reject`).
- `Contract.approve` declares preconditions, inputs, effects, execution mode, and risk level.
- A dry-run creates a signed plan with the exact before/after diff.
- Apply requires the same plan, same actor, current object version, and an idempotency key.
- The resulting event is auditable with full provenance.

## Model sketch

```ts
const ContractStatus = enumType('ContractStatus', [
  'draft',
  'pending_review',
  'approved',
  'rejected',
  'needs_human_review',
]);

const Client = objectType('Client', {
  name: string().required().indexed(),
  riskTier: string().optional().indexed(),
});

const Contract = objectType('Contract', {
  reference: string().required().indexed(),
  amount: number().required(),
  currency: string().default('EUR'),
  status: ContractStatus.default('draft')
    .mutableBy(['Contract.submitForReview', 'Contract.approve', 'Contract.reject']),
  approvedAt: date().optional()
    .mutableBy(['Contract.approve']),
  rejectedAt: date().optional()
    .mutableBy(['Contract.reject']),
  decisionComment: string().optional()
    .mutableBy(['Contract.approve', 'Contract.reject']),
});

const ContractToClient = link('Contract', 'Client')
  .cardinality('many_to_one')
  .label('belongs_to');
```

## Actions

| Action | Purpose | Execution mode |
|--------|---------|----------------|
| `Contract.submitForReview` | Move a draft contract into review | `twin_apply` |
| `Contract.approve` | Approve a pending contract | `twin_apply` |
| `Contract.reject` | Reject a pending contract | `twin_apply` |

## Policy sketch

```json
{
  "requireDryRunBeforeMutation": true,
  "forbidDelete": true,
  "maxObjectsTouched": 1,
  "allowedActions": [
    "Contract.submitForReview",
    "Contract.approve",
    "Contract.reject"
  ]
}
```

Business rules:

- Only `manager` role can approve.
- Only contracts in `pending_review` can be approved.
- High-value contracts (above threshold) should route to human review.
- Rejected contracts require a `decisionComment`.
- Direct writes to `status`, `approvedAt`, and `rejectedAt` are forbidden by `mutableBy`.

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
- dataforge actions run Contract.approve <contractId> --input-json '{"comment":"<reason>"}' --dry-run --format json
- dataforge plan inspect <planId> --format markdown
- dataforge plan verify <planId> --format json
- dataforge actions run Contract.approve <contractId> --apply-plan <planId> --plan-hash <hash> --idempotency-key <key> --format json

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

## Demo script

```bash
# 1. Generate agent-readable context
dataforge context pack "approve the pending contract safely" --format markdown

# 2. Discover the model
dataforge schema describe --format json

# 3. Find contracts pending review
dataforge query contract \
  --filter-json '{"status":{"eq":"pending_review"}}' \
  --format json

# 4. Describe the approval action
dataforge actions describe Contract.approve --format json

# 5. Dry-run: create a signed plan
dataforge actions run Contract.approve <contractId> \
  --input-json '{"comment":"Budget verified and terms match policy"}' \
  --dry-run \
  --format json

# 6. Inspect the plan
dataforge plan inspect <planId> --format markdown

# 7. Verify the plan
dataforge plan verify <planId> --format json

# 8. Apply the plan
dataforge actions run Contract.approve <contractId> \
  --apply-plan <planId> \
  --plan-hash <hash> \
  --idempotency-key approve-contract-<contractId>-001 \
  --format json

# 9. Verify final state
dataforge query contract \
  --filter-json '{"id":{"eq":"<contractId>"}}' \
  --format json
```

## What the user understands

**Before Ontologie:**

> "The agent approved a contract by calling an API. We hope it picked the right record and followed our rules."

**With Ontologie:**

> "The agent could only call `Contract.approve`. The runtime checked the current contract state, role, policy, object version, and exact diff before applying the change. We have the signed plan and audit event."

## Proof produced

A successful run produces:

- `planId` — unique identifier for the signed plan.
- `planHash` — SHA-256 hash of the plan content.
- Exact before/after diff (e.g., `status: pending_review -> approved`).
- Target contract id and object version.
- Actor binding (who applied, credential type).
- Policy version active at the time of the check.
- Action version.
- Idempotency key (prevents duplicate application).
- Audit event with full provenance.

## Validation primitives

These primitives make this use case reusable as the reference pattern for future public templates:

| Primitive | Required proof |
|-----------|----------------|
| Context grounding | `dataforge context pack` returns a non-empty context before action selection |
| Twin query | `dataforge query` returns at least one target object in the expected state |
| Action contract | `actions describe` exposes the action key, execution mode, preconditions, effects, and input schema |
| Signed plan creation | Dry-run returns `planId`, `planHash`, `signature.algorithm=ed25519`, target binding, and expiry |
| Inspectability | `plan inspect` returns a readable diff or effect list before any apply |
| Verifiability | `plan verify` returns zero failed checks |
| Governed apply | `--apply-plan` requires `--plan-hash` and an idempotency key and cannot mutate outside the signed plan |
| Durable proof | Audit or action execution references the `planId`, actor, idempotency hash, and final status |

## Example plan output

When a dry-run succeeds, the inspect command shows:

```markdown
# DataForge Action Plan

Plan: `845f9bf5-caf4-4ae2-bb0c-a96c3610c6df`
Status: `pending`
Action: `Contract.approve`
Risk: **medium**

## Changes

| Op | Object | Field | Before | After |
|:---|:-------|:------|:-------|:------|
| object.update | contract#3532be68 | status | `pending_review` | `approved` |
| object.update | contract#3532be68 | decidedAt | `null` | `2026-05-05T08:48:06Z` |
| object.update | contract#3532be68 | decisionComment | `null` | `Budget verified...` |

## Policy Checks

| Check | Status | Severity |
|:------|:-------|:---------|
| status eq "pending_review" | PASS | blocking |

## Apply
dataforge actions run Contract.approve \
  --apply-plan 845f9bf5-caf4-4ae2-bb0c-a96c3610c6df \
  --plan-hash <hash> \
  --idempotency-key <key>
```

This output was captured from a live staging environment on 2026-05-05.
