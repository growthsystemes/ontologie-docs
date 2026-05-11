# Use case: Data quality remediation

## Business situation

An operations team wants an AI agent to find stale records, missing fields, duplicate contacts, invalid emails, and inconsistent account metadata.

The agent can identify likely fixes, but direct writes are risky. Data quality work often touches many records and can silently damage source systems if the agent guesses wrong.

Ontologie turns remediation into bounded actions such as `Contact.updateEmail`, `Contact.markDuplicate`, and `DataIssue.markResolved`.

## Why a normal agent interface is unsafe

Without Ontologie, an agent might:

- Overwrite customer fields based on weak evidence.
- Merge the wrong duplicate records.
- Perform uncontrolled bulk updates.
- Bypass field-level rules.
- Erase the reason for a correction.
- Leave no audit trail of what was changed and why.

## What Ontologie adds

- Data issues and proposed fixes are typed objects.
- Corrections are declared actions, not free-form writes.
- Sensitive fields are protected with `mutableBy`.
- Dry-run shows the exact field-level diff.
- Policy limits how many objects can be touched per plan.
- The agent can create proposals before applying fixes.
- Every accepted correction is auditable.

## Model sketch

```ts
const DataIssueStatus = enumType('DataIssueStatus', [
  'open',
  'proposed',
  'resolved',
  'rejected',
  'needs_human_review',
]);

const DataIssueKind = enumType('DataIssueKind', [
  'missing_field',
  'invalid_email',
  'duplicate_record',
  'stale_status',
  'inconsistent_metadata',
]);

const Contact = objectType('Contact', {
  email: string().optional().indexed()
    .mutableBy(['Contact.updateEmail']),
  fullName: string().optional(),
  duplicateOf: string().optional()
    .mutableBy(['Contact.markDuplicate']),
});

const Account = objectType('Account', {
  name: string().required().indexed(),
  domain: string().optional().indexed(),
  segment: string().optional()
    .mutableBy(['Account.updateSegment']),
});

const DataIssue = objectType('DataIssue', {
  kind: DataIssueKind.required().indexed(),
  status: DataIssueStatus.default('open')
    .mutableBy(['DataIssue.proposeFix', 'DataIssue.markResolved', 'DataIssue.rejectFix']),
  summary: string().required(),
  proposedValue: string().optional()
    .mutableBy(['DataIssue.proposeFix']),
  resolutionComment: string().optional()
    .mutableBy(['DataIssue.markResolved', 'DataIssue.rejectFix']),
});

const IssueToContact = link('DataIssue', 'Contact')
  .cardinality('many_to_one')
  .label('affects_contact');

const ContactToAccount = link('Contact', 'Account')
  .cardinality('many_to_one')
  .label('belongs_to_account');
```

## Actions

| Action | Purpose | Execution mode |
|--------|---------|----------------|
| `DataIssue.proposeFix` | Store a proposed correction | `twin_apply` |
| `Contact.updateEmail` | Apply a validated email correction | `twin_apply` |
| `Contact.markDuplicate` | Mark a contact as a duplicate | `twin_apply` |
| `Account.updateSegment` | Update account metadata | `twin_apply` |
| `DataIssue.markResolved` | Close an issue after a fix | `twin_apply` |

## Policy sketch

```json
{
  "requireDryRunBeforeMutation": true,
  "forbidDelete": true,
  "maxObjectsTouched": 5,
  "allowedActions": [
    "DataIssue.proposeFix",
    "Contact.updateEmail",
    "Contact.markDuplicate",
    "Account.updateSegment",
    "DataIssue.markResolved",
    "DataIssue.rejectFix"
  ]
}
```

Business rules:

- Never delete records automatically.
- Start with proposals for uncertain fixes.
- Apply one correction per plan until batch behavior is validated.
- Require evidence for email changes and duplicate markings.
- High-confidence, low-risk corrections can be auto-applied under policy.

## Agent task card

```
Task: Remediate one data quality issue safely.

Goal:
Apply a correction only through a declared action and only after
dry-run inspection confirms the exact intended field diff.

Allowed commands:
- dataforge schema describe --format json
- dataforge query data_issue --filter-json '{"status":{"eq":"open"}}' --format json
- dataforge graph neighbors <dataIssueId> --format json
- dataforge actions describe Contact.updateEmail --format json
- dataforge actions run Contact.updateEmail <contactId> --input-json '{"email":"<correct>","reason":"<evidence>"}' --dry-run --format json
- dataforge plan inspect <planId> --format markdown
- dataforge actions run Contact.updateEmail <contactId> --apply-plan <planId> --plan-hash <hash> --idempotency-key <key> --format json

Forbidden:
- Do not delete records.
- Do not use generic update endpoints.
- Do not apply low-confidence corrections.
- Do not perform unbounded batch changes.
- Do not mutate protected fields directly.

Success criteria:
- Only the intended field changes.
- The issue can be marked resolved with a separate action.
- Audit captures the plan, action, actor, and policy.
```

## Demo script

```bash
# 1. Find open data issues
dataforge query data_issue \
  --filter-json '{"status":{"eq":"open"}}' \
  --format json

# 2. Check affected contact
dataforge graph neighbors <dataIssueId> --format json

# 3. Describe the action
dataforge actions describe Contact.updateEmail --format json

# 4. Dry-run
dataforge actions run Contact.updateEmail <contactId> \
  --input-json '{"email":"alex@example.com","reason":"Verified from customer portal profile"}' \
  --dry-run \
  --format json

# 5. Inspect
dataforge plan inspect <planId> --format markdown

# 6. Apply
dataforge actions run Contact.updateEmail <contactId> \
  --apply-plan <planId> \
  --plan-hash <hash> \
  --idempotency-key update-email-<contactId>-001 \
  --format json
```

## What the user understands

**Before Ontologie:**

> "The agent can clean the database, but it may overwrite good data or make uncontrolled bulk changes."

**With Ontologie:**

> "The agent can only apply declared corrections. Every fix has a previewed diff, policy checks, version checks, and an audit trail."

## Proof produced

- `planId` and `planHash`.
- Affected object id and version.
- Exact before/after field diff.
- Correction evidence or reason.
- Actor binding.
- Policy version.
- Idempotency key.
- Audit event id.

## Scope note

Start with one issue, one correction, one plan, and one audit event. Autonomous bulk cleanup should only be documented once batch actions are verified in the runtime.
