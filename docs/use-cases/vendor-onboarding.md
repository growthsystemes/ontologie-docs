# Use case: Vendor onboarding and procurement approval

## Business situation

A company receives a request to onboard a new supplier. An AI agent can collect context, check required documents, summarize risk, and recommend whether the vendor should be approved.

The sensitive part is the final state change. Approving a supplier can make it available for purchase orders, invoices, and payments. The agent should not be able to directly mutate the vendor master.

Ontologie turns the workflow into declared actions such as `Vendor.approve`, `Vendor.reject`, and `Vendor.requestHumanReview`.

## Why a normal agent interface is unsafe

Without Ontologie, an agent might:

- Create or approve a vendor through a broad ERP API.
- Skip required documents.
- Approve a high-risk supplier.
- Change bank or tax fields directly.
- Perform a duplicate approval.
- Leave no auditable link between the decision, policy, and current vendor state.

## What Ontologie adds

Ontologie separates reading, reasoning, and applying:

- The agent can query typed vendors and linked documents.
- The agent can describe the allowed vendor actions.
- Approval is a bounded action with typed inputs and preconditions.
- Sensitive fields (`status`, `approvedAt`, `riskDecision`) are protected by `mutableBy`.
- Dry-run creates a plan that procurement can inspect.
- Apply is verified against current object versions and policy.
- The final decision is auditable.

## Model sketch

```ts
const VendorStatus = enumType('VendorStatus', [
  'draft',
  'documents_missing',
  'pending_review',
  'approved',
  'rejected',
  'needs_human_review',
]);

const RiskTier = enumType('RiskTier', ['unknown', 'low', 'medium', 'high']);

const Vendor = objectType('Vendor', {
  legalName: string().required().indexed(),
  country: string().required().indexed(),
  category: string().optional().indexed(),
  riskTier: RiskTier.default('unknown')
    .mutableBy(['Vendor.updateRiskAssessment']),
  status: VendorStatus.default('draft')
    .mutableBy(['Vendor.submitForReview', 'Vendor.approve', 'Vendor.reject', 'Vendor.requestHumanReview']),
  approvedAt: date().optional()
    .mutableBy(['Vendor.approve']),
  reviewComment: string().optional()
    .mutableBy(['Vendor.approve', 'Vendor.reject', 'Vendor.requestHumanReview']),
});

const VendorDocument = objectType('VendorDocument', {
  kind: string().required().indexed(),
  status: string().required().indexed(),
  uploadedAt: date().optional(),
});

const VendorToDocument = link('Vendor', 'VendorDocument')
  .cardinality('one_to_many')
  .label('has_document');
```

## Actions

| Action | Purpose | Execution mode |
|--------|---------|----------------|
| `Vendor.submitForReview` | Move a draft vendor into procurement review | `twin_apply` |
| `Vendor.updateRiskAssessment` | Attach or update risk decision metadata | `twin_apply` |
| `Vendor.approve` | Approve a low-risk vendor | `twin_apply` |
| `Vendor.reject` | Reject a vendor with a reason | `twin_apply` |
| `Vendor.requestHumanReview` | Mark a vendor for manual review | `twin_apply` |

## Policy sketch

```json
{
  "requireDryRunBeforeMutation": true,
  "forbidDelete": true,
  "maxObjectsTouched": 1,
  "allowedActions": [
    "Vendor.submitForReview",
    "Vendor.updateRiskAssessment",
    "Vendor.approve",
    "Vendor.reject",
    "Vendor.requestHumanReview"
  ]
}
```

Business rules:

- Approval requires the `procurement_manager` role.
- `status` can only change through declared actions.
- High-risk vendors cannot be auto-approved.
- Missing tax, bank, insurance, or compliance documents should route to human review.
- Direct edits to bank and tax fields are disallowed.

## Agent task card

```
Task: Review and approve a supplier safely.

Goal:
Approve a Vendor only if it is pending review, required documents are present,
risk is acceptable, and the runtime returns a valid dry-run plan.

Allowed commands:
- dataforge schema describe --format json
- dataforge query vendor --filter-json '{"status":{"eq":"pending_review"}}' --format json
- dataforge graph neighbors <vendorId> --format json
- dataforge actions describe Vendor.approve --format json
- dataforge actions run Vendor.approve <vendorId> --input-json '{"comment":"<reason>"}' --dry-run --format json
- dataforge plan inspect <planId> --format markdown
- dataforge actions run Vendor.approve <vendorId> --apply-plan <planId> --idempotency-key <key> --format json

Forbidden:
- Do not approve vendors with missing required documents.
- Do not invent ERP write operations.
- Do not directly mutate Vendor.status.
- Do not update bank details through a generic action.
- Do not retry policy mismatches.

Success criteria:
- Vendor status becomes approved once.
- The plan diff is limited to approved fields.
- Audit shows actor, action, plan, and policy.
```

## Demo script

```bash
# 1. Discover the model
dataforge schema describe --format json

# 2. Find vendors pending review
dataforge query vendor \
  --filter-json '{"status":{"eq":"pending_review"}}' \
  --format json

# 3. Check linked documents
dataforge graph neighbors <vendorId> --format json

# 4. Describe the approval action
dataforge actions describe Vendor.approve --format json

# 5. Dry-run
dataforge actions run Vendor.approve <vendorId> \
  --input-json '{"comment":"All required documents present; risk tier low"}' \
  --dry-run \
  --format json

# 6. Inspect the plan
dataforge plan inspect <planId> --format markdown

# 7. Apply
dataforge actions run Vendor.approve <vendorId> \
  --apply-plan <planId> \
  --idempotency-key approve-vendor-<vendorId>-001 \
  --format json
```

## What the user understands

**Before Ontologie:**

> "The agent has access to the vendor API. We need to trust that it only updates the right fields."

**With Ontologie:**

> "The agent can only use declared vendor actions. Approval requires a dry-run, policy checks, a verified plan, and an audit event."

## Proof produced

- `planId` and `planHash`.
- Vendor before/after status.
- List of affected fields.
- Actor binding.
- Policy version.
- Vendor object version.
- Idempotency key.
- Audit event id.
- Linked evidence inspected by the agent (via graph neighbors).

## Scope note

For V1, treat Ontologie as the governed vendor decision layer. Automatic ERP vendor-master creation requires source-system connectors (`external_commit` mode) which is a future capability.
