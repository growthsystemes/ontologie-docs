# Use case: IT access request approval

## Business situation

An employee requests access to an internal tool. An AI agent can inspect the requester, team, manager approval, resource, access level, and policy context.

The agent should not directly grant production access or modify IAM state through a generic admin API. It should use declared actions such as `AccessRequest.approve` and `AccessRequest.deny`.

## Why a normal agent interface is unsafe

Without Ontologie, an agent might:

- Grant access to the wrong user.
- Grant a higher access level than requested.
- Skip manager approval.
- Create non-expiring access.
- Apply stale decisions after the request changed.
- Leave no clean audit trail for security review.

## What Ontologie adds

- Access requests, resources, and grants are typed objects.
- Actions declare allowed transitions and preconditions.
- Protected fields are controlled by `mutableBy`.
- Dry-run shows the exact access decision diff.
- Policy can require expiry, role, and max objects touched.
- Idempotency prevents duplicate approvals.
- Audit records who approved what under which policy.

## Model sketch

```ts
const AccessRequestStatus = enumType('AccessRequestStatus', [
  'submitted',
  'pending_manager_approval',
  'pending_it_review',
  'approved',
  'denied',
  'needs_human_review',
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

## Actions

| Action | Purpose | Execution mode |
|--------|---------|----------------|
| `AccessRequest.approve` | Approve the request with an expiry | `twin_apply` |
| `AccessRequest.deny` | Deny access with a reason | `twin_apply` |
| `AccessRequest.requestHumanReview` | Route risky access to manual review | `twin_apply` |

## Policy sketch

```json
{
  "requireDryRunBeforeMutation": true,
  "forbidDelete": true,
  "maxObjectsTouched": 1,
  "allowedActions": [
    "AccessRequest.approve",
    "AccessRequest.deny",
    "AccessRequest.requestHumanReview"
  ]
}
```

Business rules:

- Admin access requires human review.
- Production access requires manager approval.
- All grants require an expiry date.
- Only IT or security roles can approve.
- Direct edits to status and access fields are forbidden.

## Agent task card

```
Task: Approve an access request safely.

Goal:
Approve an AccessRequest only if manager approval, resource risk,
requested level, and expiry satisfy action and policy requirements.

Allowed commands:
- dataforge schema describe --format json
- dataforge query access_request --filter-json '{"status":{"eq":"pending_it_review"}}' --format json
- dataforge graph neighbors <accessRequestId> --format json
- dataforge actions describe AccessRequest.approve --format json
- dataforge actions run AccessRequest.approve <accessRequestId> --input-json '{"comment":"<reason>","expiresAt":"<date>"}' --dry-run --format json
- dataforge plan inspect <planId> --format markdown
- dataforge actions run AccessRequest.approve <accessRequestId> --apply-plan <planId> --idempotency-key <key> --format json

Forbidden:
- Do not directly modify IAM.
- Do not approve admin access automatically.
- Do not approve access without expiry.
- Do not mutate AccessRequest.status directly.
- Do not retry policy mismatches.

Success criteria:
- Request status becomes approved once.
- Expiry is present in the plan.
- Audit captures actor, action, plan, policy, and target.
```

## Demo script

```bash
# 1. Find requests pending IT review
dataforge query access_request \
  --filter-json '{"status":{"eq":"pending_it_review"}}' \
  --format json

# 2. Check requester and resource
dataforge graph neighbors <accessRequestId> --format json

# 3. Describe the action
dataforge actions describe AccessRequest.approve --format json

# 4. Dry-run with expiry
dataforge actions run AccessRequest.approve <accessRequestId> \
  --input-json '{"comment":"Manager approved; read access only","expiresAt":"2026-06-04T00:00:00Z"}' \
  --dry-run \
  --format json

# 5. Inspect
dataforge plan inspect <planId> --format markdown

# 6. Apply
dataforge actions run AccessRequest.approve <accessRequestId> \
  --apply-plan <planId> \
  --idempotency-key approve-access-<accessRequestId>-001 \
  --format json
```

## What the user understands

**Before Ontologie:**

> "The agent has an admin tool. It may accidentally grant the wrong access."

**With Ontologie:**

> "The agent can only approve a typed access request through policy-checked actions. Every approval requires a dry-run, an exact diff, an expiry, and an audit event."

## Proof produced

- `planId` and `planHash`.
- Access request before/after status.
- Requested level and expiry in the plan input.
- Actor binding.
- Policy version.
- Object version.
- Idempotency key.
- Audit event id.

## Scope note

For V1, this shows the access decision in the operational twin. Automated IAM provisioning requires `external_commit` mode (future capability).
