# Use case: Customer refund approval

> Support / Finance | 3 actions | [Run this demo](#run-this-demo)

## Situation and risk

A customer asks for a refund. An AI support agent can read the ticket, order history, policy, and customer context, then recommend a decision. The risky part is approving the refund: it affects revenue, customer trust, fraud exposure, and auditability.

Without Ontologie, an agent might refund the wrong order, approve a refund above policy limits, issue duplicate refunds, bypass fraud checks, or leave no proof of the policy context used at approval time.

## Model

```ts
const RefundStatus = enumType('RefundStatus', [
  'pending_review',
  'approved',
  'rejected',
  'escalated',
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
    .mutableBy([
      'RefundRequest.approve',
      'RefundRequest.reject',
      'RefundRequest.requestHumanReview',
    ]),
  reason: string().optional(),
  approvedAt: date().optional()
    .mutableBy(['RefundRequest.approve']),
});

const RefundToOrder = link('RefundRequest', 'Order')
  .cardinality('many_to_one')
  .label('for_order');

const RefundToCustomer = link('RefundRequest', 'Customer')
  .cardinality('many_to_one')
  .label('requested_by');

const OrderToCustomer = link('Order', 'Customer')
  .cardinality('many_to_one')
  .label('placed_by');
```

## Actions and policy

| Action | Purpose | Execution mode |
|--------|---------|----------------|
| `RefundRequest.approve` | Approve a refund request | `twin_apply` |
| `RefundRequest.reject` | Reject the request with a reason | `twin_apply` |
| `RefundRequest.requestHumanReview` | Route high-risk refunds to manual review | `twin_apply` |

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

- Auto-approval only for low-value refunds.
- High-risk customers require human review.
- Refund must be linked to an order.
- Direct payment gateway calls are outside the agent's permissions.

## Run this demo

```bash
dataforge init my-refund-demo --template contract-review
cd my-refund-demo && dataforge dev
```

Discover the live refund surface:

```bash
dataforge whoami --format json
dataforge schema describe --format json
dataforge query refund_request --format json
dataforge graph neighbors <refundRequestId> --format json
dataforge actions describe RefundRequest.approve --format json
dataforge actions describe RefundRequest.reject --format json
dataforge actions describe RefundRequest.requestHumanReview --format json
```

Create input files for each decision:

```bash
cat > refund-approve-input.json <<'JSON'
{
  "comment": "Eligible under refund policy; amount below threshold",
  "refundMethod": "original_payment"
}
JSON

cat > refund-reject-input.json <<'JSON'
{
  "reason": "Outside return window"
}
JSON

cat > refund-human-review-input.json <<'JSON'
{
  "reason": "Amount exceeds automated approval threshold"
}
JSON
```

Run the safety loop:

```bash
dataforge actions run RefundRequest.approve <refundRequestId> \
  --input-file refund-approve-input.json \
  --dry-run --format json

dataforge plan inspect <planId> --plan-format markdown

dataforge plan verify <planId> \
  --risk-acknowledged \
  --confirmed \
  --format json

dataforge actions run RefundRequest.approve <refundRequestId> \
  --input-file refund-approve-input.json \
  --apply-plan <planId> \
  --plan-hash <planHash> \
  --idempotency-key refund-approve-<refundRequestId> \
  --format json

dataforge instance get <refundRequestId> --format json
```

Use the same dry-run, inspect, verify, apply, and final `instance get` loop for `RefundRequest.reject` and `RefundRequest.requestHumanReview`. The staging validation currently observes these final states:

| Action | Required starting state | Observed final fields |
|--------|-------------------------|-----------------------|
| `RefundRequest.approve` | `status=pending_review` | `status=approved` |
| `RefundRequest.reject` | `status=pending_review` | `status=rejected` |
| `RefundRequest.requestHumanReview` | `status=pending_review` | `status=escalated` |

## Local validation

```bash
node tests/scripts/public-cli-refund-approval-check.cjs
```

Latest staging result: `PASS=26 FAIL=0 GAP=0` on backend image `staging-aafb7b49d2b8`.

## Before / After

| Without Ontologie | With Ontologie |
|---|---|
| "The support agent can refund customers. We need to trust that it follows the policy." | "The agent can only approve a typed RefundRequest through a declared action. Preview, policy checks, idempotency, and audit on every decision." |

## Scope note

V1 demonstrates refund decision governance, not automatic money movement. Payment execution is a downstream manual step or future `workflow_handoff` integration.
