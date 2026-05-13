# Use case: CRM pipeline governance

> Revenue ops | 5 actions | [Run this demo](#run-this-demo)

## Situation and risk

A revenue operations team wants an AI agent to review stale opportunities, move deals to the right stage, assign owners, and mark low-quality leads as disqualified. CRM state is business-critical — a bad bulk update can break forecasts, route accounts incorrectly, or erase sales history.

Without Ontologie, an agent might move many opportunities to the wrong stage, overwrite owner assignments, disqualify valid leads, apply stale recommendations after a sales rep updated the record, or leave no audit trail for forecast changes.

## Model

```ts
const OpportunityStage = enumType('OpportunityStage', [
  'new', 'qualified', 'proposal', 'negotiation',
  'closed_won', 'closed_lost', 'stale_review',
]);

const LeadStatus = enumType('LeadStatus', [
  'new', 'working', 'qualified', 'disqualified',
]);

const Opportunity = objectType('Opportunity', {
  name: string().required().indexed(),
  amount: number().optional(),
  stage: OpportunityStage.default('new')
    .mutableBy(['Opportunity.moveStage', 'Opportunity.markStale']),
  ownerEmail: string().optional()
    .mutableBy(['Opportunity.assignOwner']),
  stageReason: string().optional()
    .mutableBy(['Opportunity.moveStage', 'Opportunity.markStale']),
});

const Lead = objectType('Lead', {
  email: string().required().indexed(),
  status: LeadStatus.default('new')
    .mutableBy(['Lead.qualify', 'Lead.disqualify']),
  disqualificationReason: string().optional()
    .mutableBy(['Lead.disqualify']),
});

const Account = objectType('Account', {
  name: string().required().indexed(),
  segment: string().optional().indexed(),
});

const OpportunityToAccount = link('Opportunity', 'Account')
  .cardinality('many_to_one')
  .label('belongs_to_account');
```

## Actions and policy

| Action | Purpose | Execution mode |
|--------|---------|----------------|
| `Opportunity.moveStage` | Move a deal to an allowed stage | `twin_apply` |
| `Opportunity.assignOwner` | Assign a sales owner | `twin_apply` |
| `Opportunity.markStale` | Flag a deal for stale review | `twin_apply` |
| `Lead.qualify` | Mark a lead as qualified | `twin_apply` |
| `Lead.disqualify` | Mark a lead as disqualified with a reason | `twin_apply` |

```json
{
  "requireDryRunBeforeMutation": true,
  "forbidDelete": true,
  "maxObjectsTouched": 20,
  "allowedActions": [
    "Opportunity.moveStage", "Opportunity.assignOwner", "Opportunity.markStale",
    "Lead.qualify", "Lead.disqualify"
  ]
}
```

- High-value opportunities require a manager role.
- `closed_won` and `closed_lost` are restricted transitions.
- Every disqualification requires a reason.

## Run this demo

This use case follows the same safety loop as [contract approval](./contract-approval.md#try-it-now). The distinguishing feature is multi-object awareness: `maxObjectsTouched: 20` allows batch reviews, but each plan still shows the exact diff per record.

```bash
dataforge init my-crm-demo --template contract-review
cd my-crm-demo && dataforge dev
# Adapt the schema, then: query -> describe -> dry-run -> inspect -> apply
```

## Before / After

| Without Ontologie | With Ontologie |
|---|---|
| "The agent can update Salesforce records. It might make a mistake at CRM scale." | "Only declared CRM actions. Every stage or owner change is previewed, version-checked, policy-checked, and audited." |

## Scope note

Ontologie acts as the governed operational twin for CRM state. Direct Salesforce or HubSpot writes require `external_commit` mode (future).
