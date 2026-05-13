# Use case: Finance audit evidence

> Finance / Audit | 7 actions | [Run this demo](#run-this-demo)

## Situation and risk

A finance team wants an AI agent to review invoices, controls, journal entries, and anomalies. The agent can summarize risk and propose corrections, but accounting data is high-stakes. A bad write can hide anomalies, misattribute evidence, or change ledger entries without a verifiable trail.

Without Ontologie, an agent might modify a journal entry directly, mark a control as reviewed without evidence, hide anomalies by changing status fields, or lose the connection between the decision and the policy version.

## Model

```ts
const InvoiceStatus = enumType('InvoiceStatus', [
  'received', 'matched', 'exception', 'approved',
]);

const ControlStatus = enumType('ControlStatus', [
  'open', 'in_review', 'reviewed', 'failed',
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

## Actions and policy

| Action | Purpose | Execution mode |
|--------|---------|----------------|
| `Invoice.flagAnomaly` | Mark an invoice as an exception | `twin_apply` |
| `Invoice.clearAnomaly` | Clear an anomaly after review | `twin_apply` |
| `EvidencePack.approve` | Approve an evidence pack | `twin_apply` |
| `EvidencePack.reject` | Reject an evidence pack | `twin_apply` |
| `Control.markReviewed` | Mark a control as reviewed with evidence | `twin_apply` |
| `Control.markFailed` | Mark a failed control | `twin_apply` |
| `JournalEntry.proposeCorrection` | Produce a correction proposal **without mutation** | **`plan_only`** |

```json
{
  "requireDryRunBeforeMutation": true,
  "forbidDelete": true,
  "maxObjectsTouched": 1,
  "allowedActions": [
    "Invoice.flagAnomaly", "Invoice.clearAnomaly",
    "EvidencePack.approve", "EvidencePack.reject",
    "Control.markReviewed", "Control.markFailed",
    "JournalEntry.proposeCorrection"
  ]
}
```

- Ledger entries are never directly changed by agents.
- High-severity anomalies require human review.
- Control review requires linked evidence.

**Distinguishing feature**: `JournalEntry.proposeCorrection` uses `plan_only` mode — the plan is produced as evidence but **not applied**. The correction proposal is a signed artifact that finance can review before committing to the source system.

## Run this demo

This use case follows the same safety loop as [contract approval](./contract-approval.md#try-it-now), with one key difference: `plan_only` actions produce a plan that cannot be applied — they are proposals, not mutations.

```bash
dataforge init my-audit-demo --template contract-review
cd my-audit-demo && dataforge dev
# Adapt the schema, then try both twin_apply (Invoice.flagAnomaly)
# and plan_only (JournalEntry.proposeCorrection) to see the difference.
```

## Before / After

| Without Ontologie | With Ontologie |
|---|---|
| "The agent can inspect finance data, but we are afraid of giving it tools that change accounting records." | "The agent can flag anomalies and produce evidence-backed proposals. Sensitive mutations are bounded, previewed, and audited." |

## Scope note

Ontologie does not replace a ledger or audit platform. The safest demo is `Invoice.flagAnomaly` or `Control.markReviewed` in the operational twin.
