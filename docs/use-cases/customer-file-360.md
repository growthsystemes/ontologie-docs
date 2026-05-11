# Use case: Customer file 360

## Business situation

A team wants an AI agent to help maintain customer files: identity details, company context, owner, status, notes, interactions, document references, duplicate records, and data-quality evidence.

The customer file is sensitive operational state. A bad write can expose personal data, corrupt customer history, merge the wrong records, or create an audit gap. Ontologie turns customer-file maintenance into declared actions such as `Customer.updateProfile`, `Customer.addNote`, `Customer.recordInteraction`, `Customer.attachDocument`, `Customer.setStatus`, `Customer.mergeDuplicate`, and the GDPR actions `Customer.requestDataExport`, `Customer.completeDataExport`, `Customer.requestErasure`, `Customer.suppressProcessing`, and `Customer.completeErasure`.

This use case deliberately does not claim bidirectional CRM sync. In V1.1, Ontologie is the governed operational twin. CRM writeback remains an external-commit integration concern.

## Why a normal agent interface is unsafe

Without Ontologie, an agent might:

- Overwrite PII fields from weak evidence.
- Add unreviewed notes with sensitive content.
- Attach a document to the wrong customer.
- Merge two different people or companies.
- Change customer status without a durable reason.
- Export or erase PII without proving who requested it, what was delivered, and what was redacted.
- Bypass retention, masking, and audit expectations.

Ontologie makes the agent prove the exact change before writing it.

## What Ontologie adds

- `UnifiedCustomer` is the customer-file nucleus.
- Notes, documents, and interactions are modelled as typed linked records.
- PII-bearing fields are declared and action-gated.
- Each customer-file mutation is a signed plan with an exact diff.
- Apply requires the same plan, actor, object version, and idempotency key.
- The applied plan exposes audit evidence: actor, request id, idempotency hash, execution mode, and status.

## Model sketch

```ts
const CustomerStatus = enumType('CustomerStatus', [
  'prospect',
  'active',
  'at_risk',
  'inactive',
  'do_not_contact',
  'duplicate_candidate',
  'merged',
  'erased',
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
    .mutableBy(['Customer.setStatus', 'Customer.mergeDuplicate', 'Customer.suppressProcessing', 'Customer.completeErasure']),
  statusReason: string().optional()
    .mutableBy(['Customer.setStatus', 'Customer.suppressProcessing', 'Customer.completeErasure']),
  segment: string().optional().indexed()
    .mutableBy(['Customer.updateProfile']),
  riskTier: string().optional().indexed()
    .mutableBy(['Customer.updateProfile']),
  ownerEmail: string().optional().indexed()
    .sensitive()
    .mutableBy(['Customer.updateProfile', 'Customer.completeErasure']),
  dataRetentionUntil: date().optional()
    .mutableBy(['Customer.updateProfile', 'Customer.setStatus', 'Customer.requestErasure', 'Customer.completeErasure']),

  lastNote: string().optional()
    .sensitive()
    .mutableBy(['Customer.addNote', 'Customer.completeErasure']),
  lastInteractionType: string().optional()
    .mutableBy(['Customer.recordInteraction']),
  lastInteractionSummary: string().optional()
    .sensitive()
    .mutableBy(['Customer.recordInteraction', 'Customer.completeErasure']),
  lastDocumentId: string().optional()
    .mutableBy(['Customer.attachDocument']),
  mergedIntoCustomerId: string().optional()
    .mutableBy(['Customer.mergeDuplicate']),

  gdprExportStatus: string().optional().indexed()
    .mutableBy(['Customer.requestDataExport', 'Customer.completeDataExport']),
  gdprExportRequestId: string().optional().indexed()
    .mutableBy(['Customer.requestDataExport']),
  gdprExportFormat: string().optional().indexed()
    .mutableBy(['Customer.requestDataExport']),
  gdprExportDeliveryRef: string().optional()
    .mutableBy(['Customer.completeDataExport']),
  gdprExportedFields: string().optional()
    .mutableBy(['Customer.completeDataExport']),
  gdprExportSourceHash: string().optional()
    .mutableBy(['Customer.completeDataExport']),
  gdprExportEvidence: string().optional()
    .mutableBy(['Customer.completeDataExport']),
  gdprErasureStatus: string().optional().indexed()
    .mutableBy(['Customer.requestErasure', 'Customer.suppressProcessing', 'Customer.completeErasure']),
  gdprErasureRequestId: string().optional().indexed()
    .mutableBy(['Customer.requestErasure']),
  processingSuppressed: boolean().optional().indexed()
    .mutableBy(['Customer.suppressProcessing', 'Customer.completeErasure']),
  piiRedactionStatus: string().optional().indexed()
    .mutableBy(['Customer.completeErasure']),
  erasureEvidenceRef: string().optional()
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
  storageMode: string().required(),
  knowledgeDocumentId: string().optional().indexed(),
  retentionUntil: date().optional(),
  containsPii: boolean().required(),
});

const CustomerInteraction = objectType('CustomerInteraction', {
  interactionId: string().required().indexed(),
  customerId: string().required().indexed(),
  type: string().required().indexed(),
  summary: string().optional().sensitive(),
  occurredAt: date().required(),
  source: string().optional().indexed(),
});
```

## Actions

| Action | Purpose | Execution mode |
|--------|---------|----------------|
| `Customer.updateProfile` | Update governed profile fields such as phone, segment, risk tier, owner | `twin_apply` |
| `Customer.addNote` | Record the latest governed customer note on the file | `twin_apply` |
| `Customer.recordInteraction` | Record the latest customer interaction summary | `twin_apply` |
| `Customer.attachDocument` | Attach a structured document reference to the customer file | `twin_apply` |
| `Customer.setStatus` | Change customer status with a reason | `twin_apply` |
| `Customer.mergeDuplicate` | Mark a duplicate customer as merged into a primary customer | `twin_apply` |
| `Customer.requestDataExport` | Register a GDPR data export request with request id, format, and reason | `twin_apply` |
| `Customer.completeDataExport` | Mark the export bundle as delivered with delivery reference, exported fields, evidence, and source snapshot hash | `twin_apply` |
| `Customer.requestErasure` | Register an erasure request and retention deadline | `twin_apply` |
| `Customer.suppressProcessing` | Suppress processing and move the customer to `do_not_contact` while erasure is completed | `twin_apply` |
| `Customer.completeErasure` | Redact PII fields and close the erasure workflow with evidence | `twin_apply` |

## Document decision

V1.1 uses **structured document references** for this use case:

- `CustomerDocument` stores title, category, retention, PII marker, and optional `knowledgeDocumentId`.
- `Customer.attachDocument` attaches a governed reference to the customer file.
- The binary file itself is not stored in the customer ObjectType.
- Knowledge ingestion can be linked through `knowledgeDocumentId`, but Knowledge-backed retrieval is not required for the first customer-file proof.

This avoids mixing binary storage, RAG ingestion, and customer-file write safety in the same first iteration.

## PII and GDPR policy sketch

```json
{
  "requireDryRunBeforeMutation": true,
  "forbidPhysicalDeleteWithoutErasureWorkflow": true,
  "maxObjectsTouched": 1,
  "allowedActions": [
    "Customer.updateProfile",
    "Customer.addNote",
    "Customer.recordInteraction",
    "Customer.attachDocument",
    "Customer.setStatus",
    "Customer.mergeDuplicate",
    "Customer.requestDataExport",
    "Customer.completeDataExport",
    "Customer.requestErasure",
    "Customer.suppressProcessing",
    "Customer.completeErasure"
  ],
  "pii": {
    "sensitiveFields": [
      "primaryEmail",
      "primaryPhone",
      "firstName",
      "lastName",
      "ownerEmail",
      "authorEmail"
    ],
    "maskInDefaultContext": true,
    "requireReasonForPiiChange": true,
    "retentionField": "dataRetentionUntil"
  }
}
```

Business rules:

- PII changes require a reason and must use `Customer.updateProfile`.
- GDPR export and erasure are high-risk actions and require dry-run inspection, a request id, reason, and evidence reference before final apply.
- Notes and interaction summaries are treated as internal data.
- Documents that contain PII must declare `containsPii=true` and a retention date when applicable.
- Duplicate merge is high risk and must include evidence.
- `Customer.requestDataExport` must run before `Customer.completeDataExport`; the final state is `gdprExportStatus=delivered` with `gdprExportDeliveryRef`, `gdprExportedFields`, and `gdprExportSourceHash`.
- `Customer.requestErasure` must run before `Customer.suppressProcessing`; the suppression step sets `processingSuppressed=true` and `status=do_not_contact`.
- `Customer.completeErasure` can only run after suppression; it redacts PII on the customer file, stores `erasureEvidenceRef`, sets `piiRedactionStatus=redacted`, and moves the customer to `status=erased`.
- Physical deletion from downstream systems is outside this twin-only use case; V1.1 proves the public governed export, suppression, redaction, and audit workflow end-to-end.

## Agent task card

```
Task: Maintain one customer file safely.

Goal:
Update one customer file only through declared Customer.* actions after
dry-run inspection confirms the exact field diff.

Allowed commands:
- dataforge schema describe --format json
- dataforge query unified_customer --filter-json '{"status":{"eq":"active"}}' --format json
- dataforge graph neighbors <customerId> --format json
- dataforge actions describe Customer.updateProfile --format json
- dataforge actions run Customer.updateProfile <customerId> --input-json '{"segment":"Enterprise","riskTier":"medium","reason":"Reviewed by CSM"}' --dry-run --format json
- dataforge actions describe Customer.requestDataExport --format json
- dataforge actions describe Customer.completeErasure --format json
- dataforge plan inspect <planId> --format markdown
- dataforge actions run Customer.updateProfile <customerId> --apply-plan <planId> --plan-hash <hash> --idempotency-key <key> --format json

Forbidden:
- Do not use generic update endpoints for governed fields.
- Do not store raw binary documents in the customer object.
- Do not merge duplicates without evidence.
- Do not expose PII in generated summaries unless the current context allows it.
- Do not export, suppress, or erase PII through generic update endpoints.
- Do not use CRM writeback; this use case is twin-only.
```

## Demo script

```bash
# 1. Find active customer files
dataforge query unified_customer \
  --filter-json '{"status":{"eq":"active"}}' \
  --format json

# 2. Describe a governed profile update
dataforge actions describe Customer.updateProfile --format json

# 3. Dry-run
dataforge actions run Customer.updateProfile <customerId> \
  --input-json '{"primaryPhone":"+33611111111","segment":"Enterprise","riskTier":"medium","ownerEmail":"senior-csm@example.com","reason":"Customer profile reviewed"}' \
  --dry-run \
  --format json

# 4. Inspect
dataforge plan inspect <planId> --format markdown

# 5. Apply
dataforge actions run Customer.updateProfile <customerId> \
  --apply-plan <planId> \
  --plan-hash <hash> \
  --idempotency-key customer-profile-<customerId>-001 \
  --format json

# 6. Verify proof
dataforge plan proof <planId> --format json

# 7. GDPR export request
dataforge actions run Customer.requestDataExport <customerId> \
  --input-json '{"requestId":"DSAR-EXPORT-001","format":"json","reason":"Customer requested a machine-readable GDPR export"}' \
  --dry-run \
  --format json

dataforge actions run Customer.requestDataExport <customerId> \
  --apply-plan <exportPlanId> \
  --plan-hash <hash> \
  --idempotency-key customer-export-<customerId>-001 \
  --format json

# 8. GDPR export delivery
dataforge actions run Customer.completeDataExport <customerId> \
  --input-json '{"deliveryRef":"EXPORT-BUNDLE-001","exportedFields":"customerId,primaryEmail,primaryPhone,firstName,lastName,companyName,ownerEmail,dataRetentionUntil","sourceSnapshotHash":"<sha256>","evidence":"Secure delivery receipt captured"}' \
  --dry-run \
  --format json
dataforge actions run Customer.completeDataExport <customerId> \
  --apply-plan <deliveryPlanId> \
  --plan-hash <hash> \
  --idempotency-key customer-export-delivery-<customerId>-001 \
  --format json

# 9. GDPR erasure request and suppression
dataforge actions run Customer.requestErasure <customerId> \
  --input-json '{"requestId":"DSAR-ERASURE-001","reason":"Customer requested erasure after export delivery","retentionUntil":"2026-05-06T00:00:00Z"}' \
  --dry-run \
  --format json
dataforge actions run Customer.requestErasure <customerId> \
  --apply-plan <erasurePlanId> \
  --plan-hash <hash> \
  --idempotency-key customer-erasure-request-<customerId>-001 \
  --format json

dataforge actions run Customer.suppressProcessing <customerId> \
  --input-json '{"reason":"Processing suppressed while erasure is completed","evidence":"Compliance approval captured"}' \
  --dry-run \
  --format json
dataforge actions run Customer.suppressProcessing <customerId> \
  --apply-plan <suppressionPlanId> \
  --plan-hash <hash> \
  --idempotency-key customer-suppress-<customerId>-001 \
  --format json

# 10. GDPR final redaction
dataforge actions run Customer.completeErasure <customerId> \
  --input-json '{"evidenceRef":"ERASURE-PROOF-001","reason":"PII redacted after validated erasure request","retentionUntil":"2026-05-06T00:00:00Z","redactedEmail":"redacted@example.invalid","redactedPhone":"REDACTED","redactedFirstName":"REDACTED","redactedLastName":"REDACTED","redactedOwnerEmail":"redacted-owner@example.invalid"}' \
  --dry-run \
  --format json
dataforge actions run Customer.completeErasure <customerId> \
  --apply-plan <redactionPlanId> \
  --plan-hash <hash> \
  --idempotency-key customer-erasure-complete-<customerId>-001 \
  --format json
```

## Proof produced

- `planId` and `planHash`.
- Exact before/after diff for every customer-file field touched.
- Actor binding and policy version.
- Action version and execution mode.
- Idempotency key hash.
- Plan audit trail with `status=applied`.
- Final customer file state.
- GDPR export state `delivered`, suppression state `processingSuppressed=true`, and erasure state `piiRedactionStatus=redacted`.

## Scope note

This is the V1.1 customer-file proof, not the full Customer 360 / CDP product. The broader CDP bundle can add identity resolution, LTV, churn, segmentation, enrichment and marketing activation after the governed customer-file loop is proven.
