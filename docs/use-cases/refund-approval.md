# Use case: Customer refund approval

## Business situation

A customer asks for a refund. An AI support agent can read the ticket, order history, policy, and customer context, then recommend a decision.

The risky part is approving the refund. A refund decision affects revenue, customer trust, fraud exposure, and auditability. The agent should not call a generic refund endpoint directly.

Ontologie turns the decision into declared actions: `RefundRequest.approve`, `RefundRequest.reject`, and `RefundRequest.requestHumanReview`.

## Why a normal agent interface is unsafe

Without Ontologie, an agent might:

- Refund the wrong order.
- Approve a refund above policy limits.
- Issue duplicate refunds.
- Bypass fraud or chargeback checks.
- Mutate ticket and refund state inconsistently.
- Leave no proof of the policy context used at approval time.

## What Ontologie adds

- Refund requests are typed objects with declared status transitions.
- Refund status is protected by `mutableBy`.
- `RefundRequest.approve` requires role, amount, status, and policy preconditions.
- Dry-run shows the exact decision diff before apply.
- Idempotency prevents duplicate approval.
- High-risk refunds can be routed to manual review.
- The final decision is auditable.

## Model sketch

```ts
const RefundStatus = enumType('RefundStatus', [
  'pending_review',
  'approved',
  'rejected',
  'needs_human_review',
]);

const Customer = objectType('Customer', {
  externalRef: string().required().indexed(),
  email: string().required().indexed(),
  riskTier: string().default('low').indexed(),
});

const Order = objectType('Order', {
  externalRef: string().required().indexed(),
  amount: number().required(),
  currency: string().default('EUR'),
});

const RefundRequest = objectType('RefundRequest', {
  amount: number().required(),
  currency: string().default('EUR'),
  status: RefundStatus.default('pending_review')
    .mutableBy(['RefundRequest.approve', 'RefundRequest.reject', 'RefundRequest.requestHumanReview']),
  reason: string().optional(),
  approvedAt: date().optional()
    .mutableBy(['RefundRequest.approve']),
  decisionComment: string().optional()
    .mutableBy(['RefundRequest.approve', 'RefundRequest.reject', 'RefundRequest.requestHumanReview']),
});

const RefundToOrder = link('RefundRequest', 'Order')
  .cardinality('many_to_one')
  .label('refunds_order');

const OrderToCustomer = link('Order', 'Customer')
  .cardinality('many_to_one')
  .label('belongs_to_customer');
```

## Actions

| Action | Purpose | Execution mode |
|--------|---------|----------------|
| `RefundRequest.approve` | Approve a refund request | `twin_apply` |
| `RefundRequest.reject` | Reject the request with a reason | `twin_apply` |
| `RefundRequest.requestHumanReview` | Route high-risk refunds to manual review | `twin_apply` |

## Policy sketch

```json
{
  "requireDryRunBeforeMutation": true,
  "forbidDelete": true,
  "maxObjectsTouched": 1,
  "allowedActions": [
    "RefundRequest.approve",
    "RefundRequest.reject",
    "RefundRequest.requestHumanReview"
  ]
}
```

Business rules:

- Auto-approval only for low-value refunds (below threshold).
- High-risk customers require human review.
- Refund must be linked to an order.
- Duplicate refunds are not allowed (idempotency key).
- Direct payment gateway calls are outside the agent's permissions.

## Agent task card

```
Task: Approve a refund request safely.

Goal:
Approve a RefundRequest only if the amount, customer risk, and refund status
satisfy the declared action and workspace policy.

Allowed commands:
- dataforge schema describe --format json
- dataforge query refund_request --filter-json '{"status":{"eq":"pending_review"}}' --format json
- dataforge graph neighbors <refundRequestId> --format json
- dataforge actions describe RefundRequest.approve --format json
- dataforge actions run RefundRequest.approve <refundRequestId> --input-json '{"comment":"<reason>"}' --dry-run --format json
- dataforge plan inspect <planId> --format markdown
- dataforge actions run RefundRequest.approve <refundRequestId> --apply-plan <planId> --idempotency-key <key> --format json

Forbidden:
- Do not call a payment processor directly.
- Do not approve a refund without a linked order.
- Do not approve high-risk refunds automatically.
- Do not mutate RefundRequest.status directly.
- Do not retry on policy mismatch.

Success criteria:
- RefundRequest status becomes approved once.
- The plan diff matches the action description.
- Audit records the action, plan, actor, and idempotency key.
```

## Demo script

```bash
# 1. Find pending refund requests
dataforge query refund_request \
  --filter-json '{"status":{"eq":"pending_review"}}' \
  --format json

# 2. Check linked order and customer
dataforge graph neighbors <refundRequestId> --format json

# 3. Describe the action
dataforge actions describe RefundRequest.approve --format json

# 4. Dry-run
dataforge actions run RefundRequest.approve <refundRequestId> \
  --input-json '{"comment":"Eligible under refund policy; amount below threshold"}' \
  --dry-run \
  --format json

# 5. Inspect plan
dataforge plan inspect <planId> --format markdown

# 6. Apply
dataforge actions run RefundRequest.approve <refundRequestId> \
  --apply-plan <planId> \
  --idempotency-key approve-refund-<refundRequestId>-001 \
  --format json
```

## What the user understands

**Before Ontologie:**

> "The support agent can refund customers. We need to trust that it follows the refund policy."

**With Ontologie:**

> "The support agent can only approve a typed RefundRequest through a declared action. The runtime previews the exact state change, rejects invalid plans, requires idempotency, and leaves an audit trail."

## Proof produced

- `planId` and `planHash`.
- Refund request before/after status.
- Amount and currency captured in the plan context.
- Actor binding.
- Policy version.
- Object version.
- Idempotency key.
- Audit event id.

## Scope note

For V1, this demonstrates refund decision governance, not automatic money movement. If payment execution is required, it should be documented as a downstream manual step or future `workflow_handoff` integration.
