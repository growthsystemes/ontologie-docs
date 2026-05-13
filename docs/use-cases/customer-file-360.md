# Use case: Customer file 360

> Customer ops / CRM | 11 actions | PII + GDPR | [Run this demo](#run-this-demo)

## Situation and risk

A team wants an AI agent to help maintain customer files: identity details, company context, owner, status, notes, interactions, document references, duplicate records, and data-quality evidence. The customer file is sensitive operational state — a bad write can expose personal data, corrupt customer history, merge the wrong records, or create an audit gap.

Without Ontologie, an agent might overwrite PII fields from weak evidence, merge two different people, export or erase PII without proving who requested it, or bypass retention and masking expectations.

This use case deliberately does not claim bidirectional CRM sync. Ontologie is the governed operational twin; CRM writeback remains an `external_commit` integration concern.

## Model

```ts
const CustomerStatus = enumType('CustomerStatus', [
  'prospect', 'active', 'at_risk', 'inactive',
  'do_not_contact', 'duplicate_candidate', 'merged', 'erased',
]);

const UnifiedCustomer = objectType('UnifiedCustomer', {
  customerId: string().required().indexed(),
  primaryEmail: string().optional().indexed()
    .sensitive()
    .mutableBy(['Customer.updateProfile', 'Customer.completeErasure']),
  primaryPhone: string().optional().indexed()
    .sensitive()
    .mutableBy(['Customer.updateProfile', 'Customer.completeErasure']),
  firstName: string().optional().indexed()
    .sensitive()
    .mutableBy(['Customer.updateProfile', 'Customer.completeErasure']),
  lastName: string().optional().indexed()
    .sensitive()
    .mutableBy(['Customer.updateProfile', 'Customer.completeErasure']),
  companyName: string().optional().indexed()
    .mutableBy(['Customer.updateProfile']),
  status: CustomerStatus.default('active').indexed()
    .mutableBy(['Customer.setStatus', 'Customer.mergeDuplicate',
                'Customer.suppressProcessing', 'Customer.completeErasure']),
  segment: string().optional().indexed()
    .mutableBy(['Customer.updateProfile']),
  ownerEmail: string().optional().indexed()
    .sensitive()
    .mutableBy(['Customer.updateProfile', 'Customer.completeErasure']),
  gdprExportStatus: string().optional().indexed()
    .mutableBy(['Customer.requestDataExport', 'Customer.completeDataExport']),
  gdprErasureStatus: string().optional().indexed()
    .mutableBy(['Customer.requestErasure', 'Customer.suppressProcessing', 'Customer.completeErasure']),
  processingSuppressed: boolean().optional().indexed()
    .mutableBy(['Customer.suppressProcessing', 'Customer.completeErasure']),
  piiRedactionStatus: string().optional().indexed()
    .mutableBy(['Customer.completeErasure']),
});

const CustomerNote = objectType('CustomerNote', {
  noteId: string().required().indexed(),
  customerId: string().required().indexed(),
  authorEmail: string().optional().sensitive(),
  body: string().required().sensitive(),
  createdAt: date().required(),
});

const CustomerDocument = objectType('CustomerDocument', {
  documentId: string().required().indexed(),
  customerId: string().required().indexed(),
  title: string().required().indexed(),
  category: string().required().indexed(),
  containsPii: boolean().required(),
});

const CustomerInteraction = objectType('CustomerInteraction', {
  interactionId: string().required().indexed(),
  customerId: string().required().indexed(),
  type: string().required().indexed(),
  summary: string().optional().sensitive(),
  occurredAt: date().required(),
});
```

## Actions

| Action | Purpose | Execution mode |
|--------|---------|----------------|
| `Customer.updateProfile` | Update governed profile fields (phone, segment, risk tier, owner) | `twin_apply` |
| `Customer.addNote` | Record a governed customer note | `twin_apply` |
| `Customer.recordInteraction` | Record the latest interaction summary | `twin_apply` |
| `Customer.attachDocument` | Attach a structured document reference | `twin_apply` |
| `Customer.setStatus` | Change customer status with a reason | `twin_apply` |
| `Customer.mergeDuplicate` | Mark a duplicate customer as merged into a primary | `twin_apply` |
| `Customer.requestDataExport` | Register a GDPR data export request | `twin_apply` |
| `Customer.completeDataExport` | Mark the export bundle as delivered with evidence | `twin_apply` |
| `Customer.requestErasure` | Register an erasure request and retention deadline | `twin_apply` |
| `Customer.suppressProcessing` | Suppress processing, move to `do_not_contact` | `twin_apply` |
| `Customer.completeErasure` | Redact PII fields and close the erasure workflow | `twin_apply` |

## PII and GDPR policy

```json
{
  "requireDryRunBeforeMutation": true,
  "forbidPhysicalDeleteWithoutErasureWorkflow": true,
  "maxObjectsTouched": 1,
  "pii": {
    "sensitiveFields": ["primaryEmail", "primaryPhone", "firstName", "lastName", "ownerEmail"],
    "maskInDefaultContext": true,
    "requireReasonForPiiChange": true
  }
}
```

- PII changes require a reason and must use `Customer.updateProfile`.
- GDPR export and erasure are high-risk: require dry-run, request id, reason, and evidence.
- Duplicate merge is high risk and must include evidence.

**GDPR action chain** (must execute in order):

1. `Customer.requestDataExport` → `Customer.completeDataExport` (delivery ref + exported fields + source hash)
2. `Customer.requestErasure` → `Customer.suppressProcessing` (sets `do_not_contact`) → `Customer.completeErasure` (redacts PII, sets `status: erased`)

Each step is a separate plan with its own dry-run, verify, and apply. The runtime enforces ordering through preconditions on status fields.

## Run this demo

This use case follows the same safety loop as [contract approval](./contract-approval.md#try-it-now). The distinguishing features are `.sensitive()` field declarations, the 3-step GDPR erasure chain, and 11 governed actions covering the full customer-file lifecycle.

```bash
dataforge init my-customer-demo --template contract-review
cd my-customer-demo && dataforge dev
# Adapt the schema with the model above, then:
# 1. Try Customer.updateProfile (basic field update)
# 2. Try the full GDPR chain: requestDataExport -> completeDataExport
#    -> requestErasure -> suppressProcessing -> completeErasure
```

## Before / After

| Without Ontologie | With Ontologie |
|---|---|
| "The agent has access to customer records. We hope it doesn't overwrite PII or bypass GDPR." | "Every customer-file mutation is a signed plan. PII fields are declared sensitive, GDPR actions enforce ordering, and every step is auditable." |

## Scope note

This is the V1.1 customer-file proof, not the full CDP product. Identity resolution, LTV, churn, segmentation, enrichment, and marketing activation can be added after the governed customer-file loop is proven.
