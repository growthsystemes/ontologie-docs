# Use case: Vendor onboarding

> Procurement | 5 actions | Template: [`vendor-risk`](../../templates/README.md) | [Run this demo](#run-this-demo)

## Situation and risk

A company receives a request to onboard a new supplier. An AI agent can collect context, check required documents, summarize risk, and recommend whether the vendor should be approved. The sensitive part is the final state change — approving a supplier makes it available for purchase orders, invoices, and payments.

Without Ontologie, an agent might approve a high-risk supplier, skip required documents, change bank or tax fields directly, perform duplicate approvals, or leave no auditable link between the decision and the current vendor state.

## Model

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

## Actions and policy

| Action | Purpose | Execution mode |
|--------|---------|----------------|
| `Vendor.submitForReview` | Move a draft vendor into procurement review | `twin_apply` |
| `Vendor.updateRiskAssessment` | Attach or update risk decision metadata | `twin_apply` |
| `Vendor.approve` | Approve a low-risk vendor | `twin_apply` |
| `Vendor.reject` | Reject a vendor with a reason | `twin_apply` |
| `Vendor.requestHumanReview` | Mark a vendor for manual review | `twin_apply` |

```json
{
  "requireDryRunBeforeMutation": true,
  "forbidDelete": true,
  "maxObjectsTouched": 1,
  "allowedActions": [
    "Vendor.submitForReview", "Vendor.updateRiskAssessment",
    "Vendor.approve", "Vendor.reject", "Vendor.requestHumanReview"
  ]
}
```

- Approval requires the `procurement_manager` role.
- High-risk vendors cannot be auto-approved.
- Missing tax, bank, insurance, or compliance documents route to human review.

## Run this demo

```bash
dataforge init my-vendor-demo --template vendor-risk
cd my-vendor-demo && dataforge dev
# In another terminal:
dataforge query Vendor --format json
dataforge actions describe Vendor.approve --format json
dataforge actions run Vendor.approve v-001 \
  --input-json '{"comment":"All documents present; risk tier low"}' \
  --dry-run --format json
# Then inspect, verify, and apply — same safety loop as contract approval.
```

The safety loop is the same as [contract approval](./contract-approval.md#try-it-now): dry-run, inspect, apply with plan hash and idempotency key.

## Before / After

| Without Ontologie | With Ontologie |
|---|---|
| "The agent has vendor API access. We need to trust that it only updates the right fields." | "Only declared vendor actions. Dry-run, policy checks, document verification, and audit on every change." |

## Scope note

V1 treats Ontologie as the governed vendor decision layer. Automatic ERP vendor-master creation requires source-system connectors (`external_commit` mode), which is a future capability.
