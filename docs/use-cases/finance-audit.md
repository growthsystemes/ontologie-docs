# Use case: Finance audit evidence and anomaly review

## Business situation

A finance team wants an AI agent to review invoices, controls, journal entries, and anomalies. The agent can summarize risk and propose corrections, but accounting data is high-stakes.

The agent should not directly change ledger entries or control outcomes without a verifiable plan, policy checks, and audit evidence.

Ontologie gives the agent bounded actions such as `Invoice.flagAnomaly`, `Control.markReviewed`, and `JournalEntry.proposeCorrection`.

## Why a normal agent interface is unsafe

Without Ontologie, an agent might:

- Modify a journal entry directly.
- Mark a control as reviewed without evidence.
- Hide anomalies by changing status fields.
- Propose a correction that is applied without human review.
- Lose the connection between the decision, the evidence, and the policy version.

## What Ontologie adds

- Invoices, controls, anomalies, and evidence packs are typed objects.
- Sensitive fields are protected by `mutableBy`.
- High-risk changes use `plan_only` mode (proposal without mutation).
- Dry-run shows exactly what review state would change.
- Audit trails connect the action, plan, actor, and policy.
- Finance keeps control over final source-system postings.

## Model sketch

```ts
const InvoiceStatus = enumType('InvoiceStatus', [
  'received',
  'matched',
  'exception',
  'approved',
]);

const ControlStatus = enumType('ControlStatus', [
  'open',
  'in_review',
  'reviewed',
  'failed',
]);

const Invoice = objectType('Invoice', {
  externalRef: string().required().indexed(),
  vendorName: string().required().indexed(),
  amount: number().required(),
  currency: string().default('EUR'),
  status: InvoiceStatus.default('received')
    .mutableBy(['Invoice.flagAnomaly', 'Invoice.clearAnomaly', 'Invoice.approve']),
  anomalyReason: string().optional()
    .mutableBy(['Invoice.flagAnomaly', 'Invoice.clearAnomaly']),
});

const Control = objectType('Control', {
  name: string().required().indexed(),
  status: ControlStatus.default('open')
    .mutableBy(['Control.markInReview', 'Control.markReviewed', 'Control.markFailed']),
  reviewComment: string().optional()
    .mutableBy(['Control.markReviewed', 'Control.markFailed']),
});

const EvidencePack = objectType('EvidencePack', {
  title: string().required().indexed(),
  summary: string().optional(),
});

const InvoiceToEvidence = link('Invoice', 'EvidencePack')
  .cardinality('one_to_many')
  .label('has_evidence');
```

## Actions

| Action | Purpose | Execution mode |
|--------|---------|----------------|
| `Invoice.flagAnomaly` | Mark an invoice as an exception | `twin_apply` |
| `Invoice.clearAnomaly` | Clear an anomaly after review | `twin_apply` |
| `EvidencePack.approve` | Approve an evidence pack after review | `twin_apply` |
| `EvidencePack.reject` | Reject an evidence pack | `twin_apply` |
| `Control.markReviewed` | Mark a control as reviewed with evidence | `twin_apply` |
| `Control.markFailed` | Mark a failed control | `twin_apply` |
| `JournalEntry.proposeCorrection` | Produce a correction proposal without mutation | `plan_only` |

## Policy sketch

```json
{
  "requireDryRunBeforeMutation": true,
  "forbidDelete": true,
  "maxObjectsTouched": 1,
  "allowedActions": [
    "Invoice.flagAnomaly",
    "Invoice.clearAnomaly",
    "EvidencePack.approve",
    "EvidencePack.reject",
    "Control.markReviewed",
    "Control.markFailed",
    "JournalEntry.proposeCorrection"
  ]
}
```

Business rules:

- Ledger entries should not be directly changed by agents.
- High-severity anomalies require human review.
- Control review requires evidence references.
- Every failed control requires a comment.
- Direct edits to `status` and `anomalyReason` are forbidden.

## Agent task card

```
Task: Review finance anomalies safely.

Goal:
Flag anomalies or mark controls reviewed only through declared actions.
For ledger corrections, produce a proposal (plan_only) rather than a direct mutation.

Allowed commands:
- dataforge schema describe --format json
- dataforge query invoice --filter-json '{"status":{"eq":"received"}}' --format json
- dataforge graph neighbors <invoiceId> --format json
- dataforge actions describe Invoice.flagAnomaly --format json
- dataforge actions run Invoice.flagAnomaly <invoiceId> --input-json '{"reason":"<reason>","severity":"medium"}' --dry-run --format json
- dataforge plan inspect <planId> --format markdown
- dataforge actions run Invoice.flagAnomaly <invoiceId> --apply-plan <planId> --plan-hash <hash> --idempotency-key <key> --format json

Forbidden:
- Do not mutate ledger entries directly.
- Do not mark controls reviewed without evidence.
- Do not clear high-severity anomalies automatically.
- Do not retry policy mismatches.

Success criteria:
- Anomaly or control state changes only through declared actions.
- Plan captures the exact diff and evidence context.
- Audit contains actor, action, plan, and policy version.
```

## Demo script

```bash
# 1. Find invoices to review
dataforge query invoice \
  --filter-json '{"status":{"eq":"received"}}' \
  --format json

# 2. Check linked evidence
dataforge graph neighbors <invoiceId> --format json

# 3. Describe the action
dataforge actions describe Invoice.flagAnomaly --format json

# 4. Dry-run
dataforge actions run Invoice.flagAnomaly <invoiceId> \
  --input-json '{"reason":"Amount does not match purchase order","severity":"medium"}' \
  --dry-run \
  --format json

# 5. Inspect
dataforge plan inspect <planId> --format markdown

# 6. Apply
dataforge actions run Invoice.flagAnomaly <invoiceId> \
  --apply-plan <planId> \
  --plan-hash <hash> \
  --idempotency-key flag-anomaly-<invoiceId>-001 \
  --format json
```

## What the user understands

**Before Ontologie:**

> "The agent can inspect finance data, but we are afraid of giving it tools that change accounting records."

**With Ontologie:**

> "The agent can flag anomalies and produce evidence-backed proposals. Sensitive financial mutations remain bounded, previewed, policy-checked, and audited."

## Proof produced

- `planId` and `planHash`.
- Before/after invoice or control state.
- Reason and severity captured in the plan.
- Linked evidence inspected by the agent.
- Actor binding.
- Policy version.
- Idempotency key.
- Audit event id.

## Scope note

This use case demonstrates anomaly governance and evidence capture. Ontologie does not replace a ledger, accounting system, or audit platform. The safest demo is `Invoice.flagAnomaly` or `Control.markReviewed` in the operational twin.
