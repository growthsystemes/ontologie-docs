# Use case: Data quality remediation

> Operations / Data | 5 actions | [Run this demo](#run-this-demo)

## Situation and risk

An operations team wants an AI agent to find stale records, missing fields, duplicate contacts, invalid emails, and inconsistent account metadata. The agent can identify likely fixes, but direct writes are risky: data quality work often touches many records and can silently damage source systems.

Without Ontologie, an agent might overwrite customer fields based on weak evidence, merge the wrong duplicates, perform uncontrolled bulk updates, or erase the reason for a correction.

## Model

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
    .mutableBy(['DataIssue.proposeFix', 'DataIssue.markResolved']),
  summary: string().required(),
  proposedValue: string().optional(),
  resolutionComment: string().optional(),
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
    "DataIssue.proposeFix",
    "Contact.updateEmail",
    "Contact.markDuplicate",
    "Account.updateSegment",
    "DataIssue.markResolved"
  ]
}
```

- Never delete records automatically.
- Start with proposals for uncertain fixes.
- Require evidence for email changes and duplicate markings.

## Run this demo

```bash
dataforge init my-dq-demo --template contract-review
cd my-dq-demo && dataforge dev
```

Discover the live data-quality surface:

```bash
dataforge whoami --format json
dataforge schema search "data issue" --types ObjectType,Action --format json
dataforge schema search contact --types ObjectType,Action --format json
dataforge query data_issue --format json
dataforge graph neighbors <issueId> --format json
dataforge actions describe DataIssue.proposeFix --format json
dataforge actions describe Contact.updateEmail --format json
dataforge actions describe Contact.markDuplicate --format json
dataforge actions describe Account.updateSegment --format json
dataforge actions describe DataIssue.markResolved --format json
```

Create input files for the governed mutations:

```bash
cat > data-quality-propose-fix-input.json <<'JSON'
{
  "proposedValue": "+33611111111",
  "evidence": "Verified via support ticket"
}
JSON

cat > data-quality-update-email-input.json <<'JSON'
{
  "email": "alex.thompson@newdomain.io",
  "reason": "Verified from customer portal profile"
}
JSON

cat > data-quality-mark-duplicate-input.json <<'JSON'
{
  "primaryContactId": "<primaryContactId>",
  "evidence": "Same name, account, and overlapping contact history"
}
JSON

cat > data-quality-update-segment-input.json <<'JSON'
{
  "segment": "Enterprise",
  "reason": "Upgraded after deal closed"
}
JSON

cat > data-quality-resolve-issue-input.json <<'JSON'
{
  "resolutionComment": "Email correction applied and verified"
}
JSON
```

Run the safety loop:

```bash
dataforge actions run Contact.updateEmail <contactId> \
  --input-file data-quality-update-email-input.json \
  --dry-run --format json

dataforge plan inspect <planId> --plan-format markdown

dataforge plan verify <planId> \
  --risk-acknowledged \
  --confirmed \
  --format json

dataforge actions run Contact.updateEmail <contactId> \
  --input-file data-quality-update-email-input.json \
  --apply-plan <planId> \
  --plan-hash <planHash> \
  --idempotency-key data-quality-email-<contactId> \
  --format json

dataforge instance get <contactId> --format json
```

Use the same dry-run, inspect, verify, apply, and final `instance get` loop for `DataIssue.proposeFix`, `Contact.markDuplicate`, `Account.updateSegment`, and `DataIssue.markResolved`. The staging validation currently observes these final fields:

| Action | Required starting state | Observed final fields |
|--------|-------------------------|-----------------------|
| `DataIssue.proposeFix` | `status=open` | `status=proposed` |
| `Contact.updateEmail` | any contact | `email=<input.email>` |
| `Contact.markDuplicate` | any contact | `duplicateOf=<input.primaryContactId>` |
| `Account.updateSegment` | any account | `segment=Enterprise` |
| `DataIssue.markResolved` | `status=open` or `status=proposed` | `status=resolved` |

The two-step correction pattern remains explicit: apply the data correction, then close the issue as a separate governed action with its own signed plan.

## Local validation

```bash
node tests/scripts/public-cli-data-quality-check.cjs
```

Latest staging result: `PASS=41 FAIL=0 GAP=0` on backend image `staging-bdc9f18eb68e`.

## Before / After

| Without Ontologie | With Ontologie |
|---|---|
| "The agent can clean the database, but it may overwrite good data or make uncontrolled bulk changes." | "Only declared corrections. Every fix has a previewed diff, policy checks, version checks, and an audit trail." |

## Scope note

Start with one issue, one correction, one plan, and one audit event. Autonomous bulk cleanup requires verified batch actions in the runtime.
