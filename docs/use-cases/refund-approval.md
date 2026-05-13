# Use case: Customer refund approval

> Support / Finance | 3 actions | [Run this demo](#run-this-demo)

## Situation and risk

A customer asks for a refund. An AI support agent can read the ticket, order history, policy, and customer context, then recommend a decision. The risky part is approving the refund — it affects revenue, customer trust, fraud exposure, and auditability.

Without Ontologie, an agent might refund the wrong order, approve a refund above policy limits, issue duplicate refunds, bypass fraud checks, or leave no proof of the policy context used at approval time.

## Model

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
    "RefundRequest.approve", "RefundRequest.reject", "RefundRequest.requestHumanReview"
  ]
}
```

- Auto-approval only for low-value refunds (below threshold).
- High-risk customers require human review.
- Refund must be linked to an order.
- Direct payment gateway calls are outside the agent's permissions.

## Run this demo

This use case follows the same safety loop as [contract approval](./contract-approval.md#try-it-now). Start with the `contract-review` template, then replace the schema with the model sketch above.

```bash
dataforge init my-refund-demo --template contract-review
cd my-refund-demo && dataforge dev
# Adapt the schema, then: query -> describe -> dry-run -> inspect -> apply
```

## Before / After

| Without Ontologie | With Ontologie |
|---|---|
| "The support agent can refund customers. We need to trust that it follows the policy." | "The agent can only approve a typed RefundRequest through a declared action. Preview, policy checks, idempotency, and audit on every decision." |

## Scope note

V1 demonstrates refund decision governance, not automatic money movement. Payment execution is a downstream manual step or future `workflow_handoff` integration.
