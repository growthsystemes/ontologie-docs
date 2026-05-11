# Use case: CRM pipeline governance

## Business situation

A revenue operations team wants an AI agent to review stale opportunities, move deals to the right stage, assign owners, and mark low-quality leads as disqualified.

The agent has useful context, but CRM state is business-critical. A bad bulk update can break forecasts, route accounts incorrectly, or erase important sales history.

Ontologie gives the agent declared actions such as `Opportunity.moveStage`, `Opportunity.assignOwner`, and `Lead.disqualify` instead of raw CRM writes.

## Why a normal agent interface is unsafe

Without Ontologie, an agent might:

- Move many opportunities to the wrong stage.
- Overwrite owner assignments.
- Disqualify valid leads.
- Mutate fields that should only be changed by specific sales motions.
- Apply stale recommendations after a sales rep updated the record.
- Leave no clear audit trail for forecast changes.

## What Ontologie adds

- CRM objects are represented as typed operational state.
- Stage, owner, and disqualification reason are protected by `mutableBy`.
- Each state transition is a declared action.
- Dry-run shows exactly which opportunity or lead would change.
- Policy limits the number of objects touched per plan.
- Stale object versions are rejected (OCC).
- Every applied plan is auditable.

## Model sketch

```ts
const OpportunityStage = enumType('OpportunityStage', [
  'new',
  'qualified',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost',
  'stale_review',
]);

const LeadStatus = enumType('LeadStatus', [
  'new',
  'working',
  'qualified',
  'disqualified',
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

## Actions

| Action | Purpose | Execution mode |
|--------|---------|----------------|
| `Opportunity.moveStage` | Move a deal to an allowed stage | `twin_apply` |
| `Opportunity.assignOwner` | Assign a sales owner | `twin_apply` |
| `Opportunity.markStale` | Flag a deal for stale review | `twin_apply` |
| `Lead.qualify` | Mark a lead as qualified | `twin_apply` |
| `Lead.disqualify` | Mark a lead as disqualified with a reason | `twin_apply` |

## Policy sketch

```json
{
  "requireDryRunBeforeMutation": true,
  "forbidDelete": true,
  "maxObjectsTouched": 20,
  "allowedActions": [
    "Opportunity.moveStage",
    "Opportunity.assignOwner",
    "Opportunity.markStale",
    "Lead.qualify",
    "Lead.disqualify"
  ]
}
```

Business rules:

- High-value opportunities require a manager role.
- `closed_won` and `closed_lost` stages are restricted transitions.
- Changes are applied one record per plan unless bulk apply is verified.
- Every disqualification requires a reason.
- Direct writes to `stage`, `ownerEmail`, and `status` are forbidden.

## Agent task card

```
Task: Clean CRM pipeline state safely.

Goal:
Apply only declared CRM state transitions after dry-run inspection.
One record per plan unless bulk behavior is verified.

Allowed commands:
- dataforge schema describe --format json
- dataforge query opportunity --filter-json '{"stage":{"eq":"stale_review"}}' --format json
- dataforge actions describe Opportunity.moveStage --format json
- dataforge actions run Opportunity.moveStage <id> --input-json '{"stage":"closed_lost","reason":"<reason>"}' --dry-run --format json
- dataforge plan inspect <planId> --format markdown
- dataforge actions run Opportunity.moveStage <id> --apply-plan <planId> --plan-hash <hash> --idempotency-key <key> --format json

Forbidden:
- Do not use generic CRM writes.
- Do not update closed_won or closed_lost without explicit policy.
- Do not mutate protected fields directly.

Success criteria:
- Only declared actions are applied.
- Each plan has an exact diff.
- Forecast-impacting changes are auditable.
```

## Demo script

```bash
# 1. Find stale opportunities
dataforge query opportunity \
  --filter-json '{"stage":{"eq":"stale_review"}}' \
  --format json

# 2. Describe the action
dataforge actions describe Opportunity.moveStage --format json

# 3. Dry-run
dataforge actions run Opportunity.moveStage <opportunityId> \
  --input-json '{"stage":"closed_lost","reason":"No activity for 120 days"}' \
  --dry-run \
  --format json

# 4. Inspect
dataforge plan inspect <planId> --format markdown

# 5. Apply
dataforge actions run Opportunity.moveStage <opportunityId> \
  --apply-plan <planId> \
  --plan-hash <hash> \
  --idempotency-key move-stage-<opportunityId>-001 \
  --format json
```

## What the user understands

**Before Ontologie:**

> "The agent can update Salesforce or HubSpot records. It might make a mistake at CRM scale."

**With Ontologie:**

> "The agent can only perform declared CRM actions. Every stage or owner change is previewed, version-checked, policy-checked, and audited."

## Proof produced

- `planId` and `planHash`.
- Opportunity or lead before/after diff.
- Object version before and after.
- Actor binding.
- Policy version.
- Idempotency key.
- Audit event id.

## Scope note

Ontologie acts as the governed operational twin for CRM state. Direct Salesforce or HubSpot writes require `external_commit` mode (future). For current demos, show governed changes in the twin and explain how teams reconcile with source systems.
