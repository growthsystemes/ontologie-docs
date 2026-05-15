# Use case: Vendor onboarding

> Procurement | 6 actions | Template: [`vendor-risk`](../../templates/README.md) | [Run this demo](#run-this-demo)

## Situation and risk

A company receives a request to onboard a new supplier. An AI agent can collect context, check required documents, summarize risk, and recommend whether the vendor should be approved. The sensitive part is the final state change: approving a supplier makes it available for purchase orders, invoices, and payments.

Without Ontologie, an agent might approve a high-risk supplier, skip required documents, change bank or tax fields directly, perform duplicate approvals, or leave no auditable link between the decision and the current vendor state.

## Model

```ts
const VendorStatus = enumType('VendorStatus', [
  'draft',
  'documents_pending',
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
  riskTier: RiskTier.default('unknown'),
  riskScore: number().optional()
    .mutableBy(['Vendor.updateRiskAssessment']),
  riskCategory: string().optional()
    .mutableBy(['Vendor.updateRiskAssessment']),
  status: VendorStatus.default('draft')
    .mutableBy([
      'Vendor.submitForReview',
      'Vendor.approve',
      'Vendor.reject',
      'Vendor.requestDocuments',
      'Vendor.requestHumanReview',
    ]),
  approvedAt: date().optional()
    .mutableBy(['Vendor.approve']),
});

const VendorDocument = objectType('VendorDocument', {
  kind: string().required().indexed(),
  status: string().required().indexed(),
  uploadedAt: date().optional(),
});

const VendorRiskAssessment = objectType('VendorRiskAssessment', {
  status: string().required().indexed(),
  riskScore: number().optional(),
  riskCategory: string().optional().indexed(),
  assessedBy: string().optional(),
});

const VendorToDocument = link('VendorDocument', 'Vendor')
  .cardinality('many_to_one')
  .label('belongs_to_vendor');

const VendorToRiskAssessment = link('VendorRiskAssessment', 'Vendor')
  .cardinality('many_to_one')
  .label('assesses_vendor');
```

## Actions and policy

| Action | Purpose | Execution mode |
|--------|---------|----------------|
| `Vendor.submitForReview` | Move a draft vendor into procurement review | `twin_apply` |
| `Vendor.updateRiskAssessment` | Attach or update risk decision metadata | `twin_apply` |
| `Vendor.approve` | Approve a vendor after required evidence is present | `twin_apply` |
| `Vendor.reject` | Reject a vendor with a reason | `twin_apply` |
| `Vendor.requestDocuments` | Request missing vendor documents | `twin_apply` |
| `Vendor.requestHumanReview` | Mark a vendor for manual review | `twin_apply` |

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
    "Vendor.requestDocuments",
    "Vendor.requestHumanReview"
  ]
}
```

- Approval requires the `procurement_manager` role.
- High-risk vendors cannot be auto-approved.
- Missing tax, bank, insurance, or compliance documents route to document collection or human review.

## Run this demo

```bash
dataforge init my-vendor-demo --template vendor-risk
cd my-vendor-demo && dataforge dev
```

Discover the live public surface:

```bash
dataforge whoami --format json
dataforge schema search vendor --types ObjectType,Action --format json
dataforge query vendor --format json
dataforge graph neighbors <vendorId> --format json
dataforge actions describe Vendor.approve --format json
dataforge actions describe Vendor.requestDocuments --format json
dataforge actions describe Vendor.updateRiskAssessment --format json
```

Create input files instead of embedding JSON inline. This keeps the signed dry-run body identical across inspect, verify, and apply.

```bash
cat > vendor-approve-input.json <<'JSON'
{
  "comment": "All required documents present; risk tier low"
}
JSON

cat > vendor-documents-input.json <<'JSON'
{
  "documentTypes": ["insurance_certificate", "tax_registration"]
}
JSON

cat > vendor-risk-input.json <<'JSON'
{
  "riskScore": 72,
  "riskCategory": "medium"
}
JSON
```

Run the safety loop:

```bash
dataforge actions run Vendor.approve <vendorId> \
  --input-file vendor-approve-input.json \
  --dry-run --format json

dataforge plan inspect <planId> --plan-format markdown

dataforge plan verify <planId> \
  --risk-acknowledged \
  --confirmed \
  --format json

dataforge actions run Vendor.approve <vendorId> \
  --input-file vendor-approve-input.json \
  --plan-id <planId> \
  --plan-hash <planHash> \
  --idempotency-key vendor-approve-<vendorId> \
  --format json

dataforge instance get <vendorId> --format json
```

Use the same loop for `Vendor.reject`, `Vendor.requestDocuments`, `Vendor.requestHumanReview`, `Vendor.submitForReview`, and `Vendor.updateRiskAssessment`. The staging validation currently observes these final states:

| Action | Required starting state | Observed final fields |
|--------|-------------------------|-----------------------|
| `Vendor.approve` | `pending_review` | `status=approved` |
| `Vendor.reject` | `pending_review` | `status=rejected` |
| `Vendor.requestDocuments` | `pending_review` or `documents_pending` | `status=documents_pending` |
| `Vendor.requestHumanReview` | `pending_review` | `status=needs_human_review` |
| `Vendor.submitForReview` | `draft` | `status=pending_review` |
| `Vendor.updateRiskAssessment` | any vendor | `riskScore=<input>`, `riskCategory=<input>` |

## Local validation

```bash
node tests/scripts/public-cli-vendor-onboarding-check.cjs
```

Latest staging result: `PASS=47 FAIL=0 GAP=0` on backend image `staging-aca3f98ac252`.

## Before / After

| Without Ontologie | With Ontologie |
|---|---|
| "The agent has vendor API access. We need to trust that it only updates the right fields." | "Only declared vendor actions. Dry-run, policy checks, document verification, and audit on every change." |

## Scope note

V1 treats Ontologie as the governed vendor decision layer. Automatic ERP vendor-master creation requires source-system connectors (`external_commit` mode), which is a future capability.
