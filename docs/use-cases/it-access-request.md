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

## Before / After

| Without Ontologie | With Ontologie |
|---|---|
| "The agent has an admin tool. It may accidentally grant the wrong access." | "Only policy-checked actions. Every approval requires a dry-run, an exact diff, an expiry, and an audit event." |

## Scope note

V1 shows the access decision in the operational twin. Automated IAM provisioning requires `external_commit` mode (future).
