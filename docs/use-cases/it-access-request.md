# Use case: IT access request approval

> IT / Security | 3 actions | [Run this demo](#run-this-demo)

## Situation and risk

An employee requests access to an internal tool. An AI agent can inspect the requester, team, manager approval, resource, access level, and policy context. The agent should not directly grant production access or modify IAM state through a generic admin API.

Without Ontologie, an agent might grant access to the wrong user, grant a higher level than requested, skip manager approval, create non-expiring access, or leave no clean audit trail for security review.

## Model

```ts
const AccessRequestStatus = enumType('AccessRequestStatus', [
  'submitted', 'pending_manager_approval', 'pending_it_review',
  'approved', 'denied', 'needs_human_review',
]);

const AccessLevel = enumType('AccessLevel', ['read', 'write', 'admin']);

const Employee = objectType('Employee', {
  email: string().required().indexed(),
  department: string().optional().indexed(),
  managerEmail: string().optional().indexed(),
});

const AppResource = objectType('AppResource', {
  name: string().required().indexed(),
  environment: string().required().indexed(),
  riskTier: string().default('medium').indexed(),
});

const AccessRequest = objectType('AccessRequest', {
  requestedLevel: AccessLevel.required(),
  status: AccessRequestStatus.default('submitted')
    .mutableBy(['AccessRequest.approve', 'AccessRequest.deny', 'AccessRequest.requestHumanReview']),
  decisionComment: string().optional()
    .mutableBy(['AccessRequest.approve', 'AccessRequest.deny']),
  expiresAt: date().optional()
    .mutableBy(['AccessRequest.approve']),
});

const RequestToEmployee = link('AccessRequest', 'Employee')
  .cardinality('many_to_one')
  .label('requested_by');

const RequestToResource = link('AccessRequest', 'AppResource')
  .cardinality('many_to_one')
  .label('requests_resource');
```

## Actions and policy

| Action | Purpose | Execution mode |
|--------|---------|----------------|
| `AccessRequest.approve` | Approve the request with an expiry | `twin_apply` |
| `AccessRequest.deny` | Deny access with a reason | `twin_apply` |
| `AccessRequest.requestHumanReview` | Route risky access to manual review | `twin_apply` |

```json
{
  "requireDryRunBeforeMutation": true,
  "forbidDelete": true,
  "maxObjectsTouched": 1,
  "allowedActions": [
    "AccessRequest.approve", "AccessRequest.deny", "AccessRequest.requestHumanReview"
  ]
}
```

- Admin access requires human review.
- Production access requires manager approval.
- All grants require an expiry date.
- Only IT or security roles can approve.

## Run this demo

This use case follows the same safety loop as [contract approval](./contract-approval.md#try-it-now). The distinguishing feature is that every approval **must include an expiry date** — the runtime rejects plans without one.

```bash
dataforge init my-access-demo --template contract-review
cd my-access-demo && dataforge dev
# Adapt the schema, then: query -> describe -> dry-run -> inspect -> apply
```

Validated public CLI shape:

```bash
# Discover the access model and actions
dataforge schema search access --types ObjectType,Action --format json
dataforge query access_request --format json
dataforge graph neighbors <accessRequestId> --format json

# Describe all governed decisions
dataforge actions describe AccessRequest.approve --format json
dataforge actions describe AccessRequest.deny --format json
dataforge actions describe AccessRequest.requestHumanReview --format json

# Prepare structured inputs
# Windows PowerShell:
# '{"comment":"Manager approved; read access expires after incident window","expiresAt":"2026-06-04T00:00:00Z"}' | Set-Content -Encoding utf8 it-access-approve-input.json
# '{"reason":"Admin access not justified for this task"}' | Set-Content -Encoding utf8 it-access-deny-input.json
# '{"reason":"Admin access requires manual security review"}' | Set-Content -Encoding utf8 it-access-human-review-input.json
#
# Bash:
cat > it-access-approve-input.json <<'JSON'
{
  "comment": "Manager approved; read access expires after incident window",
  "expiresAt": "2026-06-04T00:00:00Z"
}
JSON

cat > it-access-deny-input.json <<'JSON'
{
  "reason": "Admin access not justified for this task"
}
JSON

cat > it-access-human-review-input.json <<'JSON'
{
  "reason": "Admin access requires manual security review"
}
JSON

# Dry-run one decision
dataforge actions run AccessRequest.approve <accessRequestId> \
  --input-file it-access-approve-input.json \
  --dry-run \
  --format json

# Inspect, verify, apply, and confirm final state
dataforge plan inspect <planId> --plan-format markdown
dataforge plan verify <planId> --risk-acknowledged --confirmed --format json
dataforge actions run AccessRequest.approve <accessRequestId> \
  --apply-plan <planId> \
  --plan-hash <hash> \
  --idempotency-key approve-access-<accessRequestId>-001 \
  --format json
dataforge instance get <accessRequestId> --format json
```

Use the same dry-run, inspect, verify, apply, and `instance get` sequence for
`AccessRequest.deny` and `AccessRequest.requestHumanReview`, switching only the
action key and input file.

## Before / After

| Without Ontologie | With Ontologie |
|---|---|
| "The agent has an admin tool. It may accidentally grant the wrong access." | "Only policy-checked actions. Every approval requires a dry-run, an exact diff, an expiry, and an audit event." |

## Scope note

V1 shows the access decision in the operational twin. Automated IAM provisioning requires `external_commit` mode (future).

## Local validation

This use case is covered by the repeatable local CLI runbook:

```bash
node tests/scripts/public-cli-it-access-request-check.cjs
```

Latest staging result on 2026-05-13: `PASS=28 FAIL=0 GAP=0`.
