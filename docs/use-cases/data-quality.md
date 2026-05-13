# Use case: Data quality remediation

> Operations / Data | 5 actions | [Run this demo](#run-this-demo)

## Situation and risk

An operations team wants an AI agent to find stale records, missing fields, duplicate contacts, invalid emails, and inconsistent account metadata. The agent can identify likely fixes, but direct writes are risky — data quality work often touches many records and can silently damage source systems.

Without Ontologie, an agent might overwrite customer fields based on weak evidence, merge the wrong duplicates, perform uncontrolled bulk updates, or erase the reason for a correction.

## Model

```ts
const DataIssueStatus = enumType('DataIssueStatus', [
  'open', 'proposed', 'resolved', 'rejected', 'needs_human_review',
]);

const DataIssueKind = enumType('DataIssueKind', [
  'missing_field', 'invalid_email', 'duplicate_record',
  'stale_status', 'inconsistent_metadata',
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

## Actions and policy

| Action | Purpose | Execution mode |
|--------|---------|----------------|
| `DataIssue.proposeFix` | Store a proposed correction | `twin_apply` |
| `Contact.updateEmail` | Apply a validated email correction | `twin_apply` |
| `Contact.markDuplicate` | Mark a contact as a duplicate | `twin_apply` |
| `Account.updateSegment` | Update account metadata | `twin_apply` |
| `DataIssue.markResolved` | Close an issue after a fix | `twin_apply` |

```json
{
  "requireDryRunBeforeMutation": true,
  "forbidDelete": true,
  "maxObjectsTouched": 5,
  "allowedActions": [
    "DataIssue.proposeFix", "Contact.updateEmail", "Contact.markDuplicate",
    "Account.updateSegment", "DataIssue.markResolved", "DataIssue.rejectFix"
  ]
}
```

- Never delete records automatically.
- Start with proposals for uncertain fixes.
- Require evidence for email changes and duplicate markings.

**Distinguishing feature**: two-step pattern — first apply the correction (`Contact.updateEmail`), then close the issue (`DataIssue.markResolved`) as a separate governed action.

## Run this demo

This use case follows the same safety loop as [contract approval](./contract-approval.md#try-it-now). The two-step correction-then-resolve pattern demonstrates how Ontologie chains multiple actions on related objects while keeping each plan atomic.

```bash
dataforge init my-dq-demo --template contract-review
cd my-dq-demo && dataforge dev
# Adapt the schema, then: query -> describe -> dry-run -> inspect -> apply
```

## Before / After

| Without Ontologie | With Ontologie |
|---|---|
| "The agent can clean the database, but it may overwrite good data or make uncontrolled bulk changes." | "Only declared corrections. Every fix has a previewed diff, policy checks, version checks, and an audit trail." |

## Scope note

Start with one issue, one correction, one plan, and one audit event. Autonomous bulk cleanup requires verified batch actions in the runtime.
