# SDK Guide

The TypeScript SDK (`@ontologie/sdk-client`) provides a typed, programmatic interface to Ontologie. It projects the same contract as the CLI with the same scopes, policies, and safety guarantees.

---

## Install

```bash
npm install @ontologie/sdk-client @ontologie/schema
```

---

## Authentication

```typescript
import { createClient } from '@ontologie/sdk-client';

// Server-side only (API key)
const client = createClient({
  apiKey: process.env.DATAFORGE_API_KEY!,
  workspaceId: process.env.DATAFORGE_WORKSPACE_ID!,
});

// Browser (OAuth PKCE) -- use @ontologie/oauth
import { createOAuthClient } from '@ontologie/oauth';
const oauthClient = createOAuthClient({ clientId: 'your-app-id' });
```

API keys are forbidden in frontend code. Use OAuth PKCE for browser applications.

**Return convention:** The SDK returns typed payloads directly and throws `DataForgeError` on failure. The CLI and HTTP API use the `{ ok, data, error, page, meta }` envelope; the SDK unwraps it internally.

---

## Schema and action discovery

```typescript
// Schema discovery is CLI-first in the current stable surface:
// dataforge schema describe --format json

// Describe a specific action
const action = await client.actions.describe('Contract.approve');
console.log(action.preconditions, action.inputs, action.executionMode);
```

---

## Querying instances

```typescript
// ObjectSet query with filters
const contracts = await client.ontology.Contract
  .where({ status: { eq: 'pending_review' } })
  .orderBy('createdAt', 'desc')
  .fetchPage({ limit: 20 });

// Access results
contracts.data.forEach(c => console.log(c.reference, c.amount));
console.log(contracts.page.total, contracts.page.hasMore);
```

---

## Graph traversal

```typescript
// 1-hop neighbors
const neighbors = await client.graph.neighbors('con_001', {
  direction: 'outbound',
  edgeTypes: ['belongs_to'],
});

// Bounded traversal (Preview)
const graph = await client.graph.traverse('con_001', {
  maxDepth: 2,
  limit: 50,
});

// Graph-constrained search
const graphMatches = await client.graph.search('contracts pending legal review', {
  nodeTypes: ['Contract'],
  limit: 10,
});
```

---

## Search

```typescript
// Global discovery search
const results = await client.search.global({
  query: 'Acme Corp',
  limit: 10,
});
```

For graph-scoped search, use `client.graph.search()`. Its SDK route is
`POST /api/v1/graph/constrained-search`.

---

## Action lifecycle (the safety loop)

```typescript
// 1. Dry-run -- creates a signed plan
const plan = await client.actions.dryRun('Contract.approve', {
  targetId: 'con_001',
  input: { comment: 'Reviewed by legal' },
});

console.log(plan.planId);
console.log(plan.planHash);
console.log(plan.body.effects);      // before/after diff
console.log(plan.body.costEstimate); // DFU cost
console.log(plan.body.policyChecks); // pass/fail array

// 2. Inspect (optional)
const details = await client.plans.inspect(plan.planId);

// 3. Verify (optional -- checks plan is still valid)
const valid = await client.plans.verify(plan.planId);

// 4. Apply with idempotency key
const result = await client.actions.applyPlan(
  'Contract.approve',
  plan.planId,
  'approve-con-001-001',
  {
    planHash: plan.planHash,
    confirmed: true,
  },
);

console.log(result.summary);
```

There is intentionally no `dataforge plan apply` command. CLI apply goes through:

```bash
dataforge actions run Contract.approve con_001 \
  --apply-plan <planId> \
  --plan-hash <hash> \
  --idempotency-key approve-con-001-001
```

---

## Error handling

```typescript
import { DataForgeError } from '@ontologie/sdk-client';

try {
  const result = await client.actions.applyPlan(
    'Contract.approve',
    plan.planId,
    'approve-con-001-retry',
    { planHash: plan.planHash },
  );
} catch (err) {
  if (err instanceof DataForgeError) {
    console.log(err.code);          // 'PLAN_EXPIRED'
    console.log(err.retryable);     // true
    console.log(err.remediation);   // { summary, command }
    console.log(err.exitCode);      // 7

    if (err.code === 'PLAN_EXPIRED') {
      // Create a new dry-run
      const newPlan = await client.actions.dryRun('Contract.approve', {
        targetId: 'con_001',
        input: { comment: 'Reviewed by legal' },
      });
    }
  }
}
```

All SDK errors follow the same taxonomy as CLI exit codes and error envelopes.

---

## Pagination

```typescript
// Offset-based
const page1 = await client.ontology.Contract
  .where({ status: { eq: 'draft' } })
  .fetchPage({ limit: 50, offset: 0 });

// Cursor-based (large result sets)
let cursor = undefined;
do {
  const page = await client.ontology.Contract.fetchPage({ limit: 100, cursor });
  process.stdout.write(page.data.map(c => JSON.stringify(c)).join('\n'));
  cursor = page.page.nextCursor;
} while (cursor);
```

---

## Context pack

```typescript
const context = await client.context.pack({
  query: 'review pending contracts',
  include: ['ontology', 'graph'],
  budget: 4000,
});
console.log(context.sections);
```

---

## Capabilities

Capabilities are currently CLI-first in the stable contract:

```bash
dataforge capabilities export --format json
```

---

## Usage and cost

```typescript
const usage = await client.usage.me();
console.log(usage.period);           // current billing period
console.log(usage.usage.costUnitsUsed);
console.log(usage.usage.costUnitsLimit);
console.log(usage.usage.costUnitsRemaining);

const forecast = await client.usage.forecast();
console.log(forecast.projected);
```

---

## Import

Import is CLI-first in the stable contract. Use the generated plan id and
idempotency key exactly as with actions:

```bash
dataforge import Contract ./contracts.csv --dry-run --format json
dataforge import Contract ./contracts.csv --apply-plan <planId> --plan-hash <hash> --idempotency-key import-contracts-001
```

---

## Generated types

After `dataforge generate`, import typed models:

```typescript
import { Contract, ContractStatus } from './generated/ontologie';

// Type-safe access
const contracts: Contract[] = page.data;
const status: ContractStatus = contracts[0].status; // 'draft' | 'pending_review' | ...
```

---

## React hooks

```typescript
import { useOntologyQuery, useAction } from '@ontologie/react';

function ContractList() {
  const { data, isLoading } = useOntologyQuery('Contract', {
    where: { status: { eq: 'pending_review' } },
    limit: 20,
  });

  const approve = useAction('Contract.approve');

  return (
    <ul>
      {data?.map(c => (
        <li key={c.id}>
          {c.reference}
          <button onClick={() => approve.dryRun(c.id, { comment: 'OK' })}>
            Approve
          </button>
        </li>
      ))}
    </ul>
  );
}
```

---

## Packages

| Package | Purpose | Stability |
|---------|---------|-----------|
| `@ontologie/sdk-client` | Core client (queries, graph, search, context, usage, actions, plans) | Stable |
| `@ontologie/schema` | Schema DSL (objectType, action, link, enum) | Stable |
| `@ontologie/react` | React hooks | Platform |
| `@ontologie/oauth` | OAuth PKCE for browsers | Platform |
| `@ontologie/mock-server` | Local mock runtime | Stable |
| `@ontologie/types` | Shared TypeScript types | Stable |
| `@ontologie/generator` | Codegen from schema | Stable |
| `@ontologie/mcp` | MCP adapter (stdio proxy) | Preview |

---

## Security rules

- API keys: server-side only, scoped, rotatable
- Browser apps: OAuth PKCE only (`@ontologie/oauth`)
- Never embed API keys in frontend code
- The SDK enforces the same policies as the CLI
- All mutations go through the signed plan lifecycle
