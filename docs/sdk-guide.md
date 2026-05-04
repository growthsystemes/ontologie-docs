# SDK Guide

The TypeScript SDK (`@dataforge/sdk-client`) provides a typed, programmatic interface to Ontologie. It projects the same contract as the CLI with the same scopes, policies, and safety guarantees.

---

## Install

```bash
npm install @dataforge/sdk-client @dataforge/schema
```

---

## Authentication

```typescript
import { createClient } from '@dataforge/sdk-client';

// Server-side only (API key)
const client = createClient({
  apiKey: process.env.DATAFORGE_API_KEY!,
  workspaceId: process.env.DATAFORGE_WORKSPACE_ID!,
});

// Browser (OAuth PKCE) -- use @dataforge/oauth
import { createOAuthClient } from '@dataforge/oauth';
const oauthClient = createOAuthClient({ clientId: 'your-app-id' });
```

API keys are forbidden in frontend code. Use OAuth PKCE for browser applications.

**Return convention:** The SDK returns typed payloads directly and throws `DataForgeError` on failure. The CLI and HTTP API use the `{ ok, data, error, page, meta }` envelope; the SDK unwraps it internally.

---

## Schema discovery

```typescript
// Describe the full schema
const schema = await client.schema.describe();

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
  direction: 'outgoing',
  linkType: 'belongs_to',
});

// Bounded traversal (Preview)
const graph = await client.graph.traverse('con_001', {
  maxDepth: 2,
  maxResults: 50,
});
```

---

## Search

```typescript
// Keyword search
const results = await client.search('Acme Corp', { limit: 10 });

// Semantic search (Preview, Cloud Runtime+)
const semantic = await client.search('contracts pending legal review', {
  mode: 'semantic',
  limit: 10,
});
```

---

## Action lifecycle (the safety loop)

```typescript
// 1. Dry-run -- creates a signed plan
const plan = await client.actions.dryRun('Contract.approve', 'con_001', {
  input: { comment: 'Reviewed by legal' },
});

console.log(plan.planId);
console.log(plan.effects);      // before/after diff
console.log(plan.costEstimate); // DFU cost
console.log(plan.policyChecks); // pass/fail array

// 2. Inspect (optional)
const details = await client.plans.inspect(plan.planId);

// 3. Verify (optional -- checks plan is still valid)
const valid = await client.plans.verify(plan.planId);

// 4. Apply with idempotency key
const result = await client.actions.applyPlan('Contract.approve', 'con_001', {
  planId: plan.planId,
  idempotencyKey: 'approve-con-001-001',
});

console.log(result.version); // new version
```

---

## Error handling

```typescript
import { DataForgeError } from '@dataforge/sdk-client';

try {
  const result = await client.actions.applyPlan(...);
} catch (err) {
  if (err instanceof DataForgeError) {
    console.log(err.code);          // 'PLAN_EXPIRED'
    console.log(err.retryable);     // true
    console.log(err.remediation);   // { summary, command }
    console.log(err.exitCode);      // 7

    if (err.code === 'PLAN_EXPIRED') {
      // Create a new dry-run
      const newPlan = await client.actions.dryRun(...);
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
  objective: 'review pending contracts',
  include: ['schema', 'actions', 'limits'],
  budgetTokens: 4000,
});
// Returns markdown string suitable for LLM context
```

---

## Capabilities

```typescript
const caps = await client.capabilities.export();
// Machine-readable manifest: object types, actions, links, limits, policy
```

---

## Usage and cost

```typescript
const usage = await client.usage.me();
console.log(usage.period);           // current billing period
console.log(usage.consumed);         // DFU used
console.log(usage.budget);           // DFU budget
console.log(usage.remaining);        // DFU remaining
```

---

## Import

```typescript
// Dry-run import
const preview = await client.import.dryRun('Contract', './contracts.csv');
console.log(preview.validRows, preview.errors);

// Apply import
const result = await client.import.apply('Contract', './contracts.csv', {
  planId: preview.planId,
  idempotencyKey: 'import-contracts-001',
});
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
import { useOntologyQuery, useAction } from '@dataforge/react';

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
| `@dataforge/sdk-client` | Core client (queries, actions, plans) | Stable |
| `@dataforge/schema` | Schema DSL (objectType, action, link, enum) | Stable |
| `@dataforge/react` | React hooks | Platform |
| `@dataforge/oauth` | OAuth PKCE for browsers | Platform |
| `@dataforge/mock-server` | Local mock runtime | Stable |
| `@dataforge/types` | Shared TypeScript types | Stable |
| `@dataforge/generator` | Codegen from schema | Stable |
| `@dataforge/mcp` | MCP adapter (stdio proxy) | Preview |

---

## Security rules

- API keys: server-side only, scoped, rotatable
- Browser apps: OAuth PKCE only (`@dataforge/oauth`)
- Never embed API keys in frontend code
- The SDK enforces the same policies as the CLI
- All mutations go through the signed plan lifecycle
