# Query Reference

Complete reference for querying instances via CLI and SDK.

---

## CLI query

```bash
dataforge query <Type> [--filter-json '<json>'] [--limit N] [--offset N] [--format json]
```

### Examples

```bash
# All contracts (default limit 50)
dataforge query Contract --format json

# With filter
dataforge query Contract --filter-json '{"status":{"eq":"pending_review"}}' --format json

# With pagination
dataforge query Contract --limit 20 --offset 40 --format json

# Compound filter
dataforge query Contract --filter-json '{"and":[{"status":{"eq":"approved"}},{"amount":{"gt":10000}}]}' --format json
```

---

## Filter operators

| Operator | Syntax | Description |
|----------|--------|-------------|
| `eq` | `{"field":{"eq":"value"}}` | Equals |
| `neq` | `{"field":{"neq":"value"}}` | Not equals |
| `in` | `{"field":{"in":["a","b"]}}` | In set |
| `notIn` | `{"field":{"notIn":["a","b"]}}` | Not in set |
| `gt` | `{"field":{"gt":100}}` | Greater than |
| `gte` | `{"field":{"gte":100}}` | Greater than or equal |
| `lt` | `{"field":{"lt":1000}}` | Less than |
| `lte` | `{"field":{"lte":1000}}` | Less than or equal |
| `contains` | `{"field":{"contains":"text"}}` | String contains (case-sensitive) |
| `startsWith` | `{"field":{"startsWith":"CON-"}}` | String prefix match |

---

## Logical operators

| Operator | Syntax | Description |
|----------|--------|-------------|
| `and` | `{"and":[filter1, filter2]}` | All conditions must match |
| `or` | `{"or":[filter1, filter2]}` | Any condition must match |
| `not` | `{"not":filter}` | Negate a condition |

### Nested example

```json
{
  "or": [
    {"status": {"eq": "approved"}},
    {"and": [
      {"status": {"eq": "pending_review"}},
      {"amount": {"lte": 5000}}
    ]}
  ]
}
```

---

## Date filters

Date values use ISO 8601 format:

```json
{"createdAt": {"gte": "2026-01-01T00:00:00Z"}}
{"approvedAt": {"lt": "2026-06-01"}}
```

---

## Pagination

| Parameter | Default | Max | Description |
|-----------|---------|-----|-------------|
| `--limit` | 50 | 10,000 | Number of results per page |
| `--offset` | 0 | 100,000 | Skip N results |

### Response

```json
{
  "page": {
    "limit": 50,
    "offset": 0,
    "total": 142,
    "hasMore": true,
    "nextCursor": "cursor_abc"
  }
}
```

Use `--limit` and `--offset` for offset-based pagination. For large result sets, use cursor-based pagination with `--cursor`.

---

## SDK query

```typescript
import { createClient } from '@ontologie/sdk-client';

const client = createClient({
  apiKey: process.env.DATAFORGE_API_KEY!,
  workspaceId: process.env.DATAFORGE_WORKSPACE_ID!,
});

// Simple query
const contracts = await client.ontology.Contract.where({
  status: { eq: 'pending_review' },
}).fetchPage({ limit: 20 });

// Compound filter
const results = await client.ontology.Contract.where({
  and: [
    { status: { eq: 'approved' } },
    { amount: { gt: 10000 } },
  ],
}).fetchPage({ limit: 50 });

// Pagination
const page2 = await client.ontology.Contract.where()
  .fetchPage({ limit: 20, offset: 20 });
```

---

## Ordering

```bash
dataforge query Contract --order-by amount:desc --format json
```

```typescript
const results = await client.ontology.Contract.where()
  .orderBy('amount', 'desc')
  .fetchPage({ limit: 20 });
```

---

## Search

Keyword search across all indexed fields:

```bash
dataforge search "Acme consulting" --format json
dataforge search "Acme" --limit 5 --format json
```

```typescript
const results = await client.search.global({
  query: 'Acme consulting',
  limit: 5,
});
```

Semantic search (Preview, Cloud Runtime+):

```bash
dataforge search "contracts needing urgent approval" --mode semantic --format json
```

---

## Graph queries

### Neighbors (Stable)

```bash
dataforge graph neighbors con_001 --format json
dataforge graph neighbors con_001 --direction outbound --format json
dataforge graph neighbors con_001 --edge-types belongs_to --format json
```

```typescript
const neighbors = await client.graph.neighbors('con_001', {
  direction: 'outbound',
  edgeTypes: ['belongs_to'],
});
```

### Traverse (Stable)

```bash
dataforge graph traverse con_001 --depth 2 --format json
```

```typescript
const graph = await client.graph.traverse('con_001', {
  direction: 'outbound',
  maxDepth: 2,
  limit: 50,
});
```

### Shortest path (Stable)

```bash
dataforge graph path con_001 cli_042 --format json
```

```typescript
const path = await client.graph.shortestPath('con_001', 'cli_042', {
  maxHops: 5,
});
```

### Graph-constrained search (Stable)

```typescript
const matches = await client.graph.search('contracts pending legal review', {
  nodeTypes: ['Contract'],
  limit: 10,
});
```

The SDK source of truth route for `client.graph.search()` is
`POST /api/v1/graph/constrained-search`.

---

## Limits

| Limit | Value |
|-------|-------|
| Max `--limit` | 10,000 |
| Default `--limit` | 50 |
| Max `--offset` | 100,000 |
| Response body max | 10 MB |
| Graph neighbors max results | 100 |
| Graph traverse max depth | 2 (Preview) |
