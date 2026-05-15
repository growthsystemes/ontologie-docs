# Use case: CRM pipeline governance

> Revenue ops | 5 actions | [Run this demo](#run-this-demo)

## Situation and risk

A revenue operations team wants an AI agent to review stale opportunities, move deals to the right stage, assign owners, and mark low-quality leads as disqualified. CRM state is business-critical: a bad bulk update can break forecasts, route accounts incorrectly, or erase sales history.

Without Ontologie, an agent might move many opportunities to the wrong stage, overwrite owner assignments, disqualify valid leads, apply stale recommendations after a sales rep updated the record, or leave no audit trail for forecast changes.

## Model

```ts
const OpportunityStage = enumType('OpportunityStage', [
  'DISCOVERY',
  'QUALIFICATION',
  'DEMO',
  'PROPOSAL',
  'NEGOTIATION',
  'CLOSED_WON',
  'CLOSED_LOST',
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
  value: number().optional(),
  stage: OpportunityStage.default('NEGOTIATION')
    .mutableBy(['Opportunity.moveStage', 'Opportunity.markStale']),
  ownerEmail: string().optional()
    .mutableBy(['Opportunity.assignOwner']),
  lossReason: string().optional()
    .mutableBy(['Opportunity.moveStage']),
  stageReason: string().optional()
    .mutableBy(['Opportunity.markStale']),
});

const Lead = objectType('Lead', {
  email: string().required().indexed(),
  status: LeadStatus.default('new')
    .mutableBy(['Lead.qualify', 'Lead.disqualify']),
});

const Account = objectType('Account', {
  name: string().required().indexed(),
  segment: string().optional().indexed(),
});

const OpportunityToAccount = link('Opportunity', 'Account')
  .cardinality('many_to_one')
  .label('for_account');

const OpportunityToLead = link('Opportunity', 'Lead')
  .cardinality('many_to_one')
  .label('from_lead');
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
    "Opportunity.moveStage",
    "Opportunity.assignOwner",
    "Opportunity.markStale",
    "Lead.qualify",
    "Lead.disqualify"
  ]
}
```

- High-value opportunities require a manager role.
- `CLOSED_WON` and `CLOSED_LOST` are restricted transitions.
- Every disqualification requires a reason.

## Run this demo

```bash
dataforge init my-crm-demo --template contract-review
cd my-crm-demo && dataforge dev
```

Discover the live CRM surface:

```bash
dataforge whoami --format json
dataforge schema search opportunity --types ObjectType,Action --format json
dataforge schema search lead --types ObjectType,Action --format json
dataforge query opportunity --format json
dataforge graph neighbors <opportunityId> --format json
dataforge actions describe Opportunity.moveStage --format json
dataforge actions describe Opportunity.assignOwner --format json
dataforge actions describe Opportunity.markStale --format json
dataforge actions describe Lead.qualify --format json
dataforge actions describe Lead.disqualify --format json
```

Create input files for the mutations you want to run:

```bash
cat > crm-move-stage-input.json <<'JSON'
{
  "stage": "CLOSED_LOST",
  "lossReason": "NO_DECISION",
  "reason": "No activity for 120 days"
}
JSON

cat > crm-assign-owner-input.json <<'JSON'
{
  "ownerEmail": "new.owner@company.com",
  "reason": "Territory change"
}
JSON

cat > crm-mark-stale-input.json <<'JSON'
{
  "reason": "No activity in 90 days"
}
JSON

cat > crm-qualify-lead-input.json <<'JSON'
{
  "reason": "Meeting confirmed, budget available"
}
JSON

cat > crm-disqualify-lead-input.json <<'JSON'
{
  "reason": "Low fit and no buying intent after qualification review"
}
JSON
```

Run the governed safety loop:

```bash
dataforge actions run Opportunity.moveStage <opportunityId> \
  --input-file crm-move-stage-input.json \
  --dry-run --format json

dataforge plan inspect <planId> --plan-format markdown

dataforge plan verify <planId> \
  --risk-acknowledged \
  --confirmed \
  --format json

dataforge actions run Opportunity.moveStage <opportunityId> \
  --input-file crm-move-stage-input.json \
  --apply-plan <planId> \
  --plan-hash <planHash> \
  --idempotency-key crm-move-stage-<opportunityId> \
  --format json

dataforge instance get <opportunityId> --format json
```

Use the same dry-run, inspect, verify, apply, and final `instance get` loop for `Opportunity.assignOwner`, `Opportunity.markStale`, `Lead.qualify`, and `Lead.disqualify`. The staging validation currently observes these final fields:

| Action | Required starting state | Observed final fields |
|--------|-------------------------|-----------------------|
| `Opportunity.moveStage` | `stage=NEGOTIATION` | `stage=CLOSED_LOST`, `lossReason=NO_DECISION` |
| `Opportunity.assignOwner` | any opportunity | `ownerEmail=new.owner@company.com` |
| `Opportunity.markStale` | `stage != stale_review` | `stage=stale_review`, `stageReason=<input.reason>` |
| `Lead.qualify` | `status=new` or `status=working` | `status=qualified` |
| `Lead.disqualify` | `status=new` or `status=working` | `status=disqualified` |

## Local validation

```bash
node tests/scripts/public-cli-crm-pipeline-check.cjs
```

Latest staging result: `PASS=41 FAIL=0 GAP=0` on backend image `staging-bea33ac2fdd9`.

## Before / After

| Without Ontologie | With Ontologie |
|---|---|
| "The agent can update Salesforce records. It might make a mistake at CRM scale." | "Only declared CRM actions. Every stage or owner change is previewed, version-checked, policy-checked, and audited." |

## Scope note

Ontologie acts as the governed operational twin for CRM state. Direct Salesforce or HubSpot writes require `external_commit` mode, which is a future capability.
