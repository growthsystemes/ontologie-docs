# Schema DSL Reference

Complete API reference for the `@ontologie/schema` package.

---

## Import

```typescript
import {
  objectType, string, number, date, boolean, json,
  enumType, link, action, role, now, compile,
} from '@ontologie/schema';
```

---

## objectType(name, properties)

Declares a typed business entity.

```typescript
const Contract = objectType('Contract', {
  reference: string().required().indexed(),
  amount: number(),
  status: ContractStatus.default('draft'),
});
```

---

## Property types

| Builder | TypeScript type | Description |
|---------|----------------|-------------|
| `string()` | `string` | Text field |
| `number()` | `number` | Numeric field (integer or float) |
| `date()` | `string` (ISO 8601) | Date/datetime field |
| `boolean()` | `boolean` | True/false |
| `json()` | `object` | Arbitrary JSON object |

### Property modifiers

| Modifier | Effect |
|----------|--------|
| `.required()` | Field must be present on creation |
| `.optional()` | Field may be null/absent (default) |
| `.default(value)` | Default value if not provided |
| `.indexed()` | Indexed for fast query filtering |
| `.mutableBy([actions])` | Only listed actions can modify this field |

---

## enumType(name, values)

Declares a fixed set of allowed values.

```typescript
const ContractStatus = enumType('ContractStatus', [
  'draft', 'pending_review', 'approved', 'rejected',
]);
```

Use as a property type:

```typescript
status: ContractStatus.default('draft'),
```

Enum values can be extended (new values added) but not removed without a breaking schema change.

---

## link(source, target)

Declares a typed relationship between two ObjectTypes.

```typescript
const ContractToClient = link('Contract', 'Client')
  .cardinality('many_to_one')
  .label('belongs_to');
```

### Link modifiers

| Modifier | Values | Description |
|----------|--------|-------------|
| `.cardinality(c)` | `one_to_one`, `one_to_many`, `many_to_one`, `many_to_many` | Relationship cardinality |
| `.label(name)` | string | Human-readable link label |

---

## action(name)

Declares a bounded mutation on an ObjectType.

```typescript
const approveContract = action('approve')
  .on(Contract)
  .executionMode('twin_apply')
  .riskLevel('medium')
  .input({ comment: string().optional() })
  .requires(role('manager'))
  .when(c => c.status.eq('pending_review'))
  .set({ status: 'approved', approvedAt: now() });
```

### Action modifiers

| Modifier | Description |
|----------|-------------|
| `.on(ObjectType)` | Target ObjectType |
| `.executionMode(mode)` | One of: `descriptive`, `plan_only`, `twin_apply`, `human_handoff`, `workflow_handoff`, `external_commit` |
| `.riskLevel(level)` | `low` (60min TTL), `medium` (15min TTL), `high` (5min TTL) |
| `.input({ ... })` | Typed input parameters the caller provides |
| `.requires(role(name))` | Required role for execution |
| `.when(predicate)` | Precondition that must be true |
| `.set(effects)` | Object literal or function returning field mutations |

---

## role(name)

Declares a named role for RBAC.

```typescript
.requires(role('manager'))
```

---

## now()

Dynamic timestamp token. Resolved at apply time, not at dry-run time.

```typescript
.set({ approvedAt: now() })
```

In the plan artifact, `now()` appears as `{ "$ref": "$applyTime" }`. The plan hash covers the token reference, not the resolved value.

---

## compile(types, options?)

Compiles ObjectTypes into the final manifest for export.

```typescript
export const manifest = compile([Client, Contract], {
  actions: [submitContract, approveContract],
});
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `types` | `ObjectTypeDefinition[]` | All ObjectTypes to include |
| `options.actions` | `ActionDefinition[]` | Actions to include (must be passed explicitly) |
| `options.workspaceId` | `string` | Optional workspace ID for deterministic hashing |

Links defined via `link()` on ObjectType fields are auto-collected and do not need to be passed explicitly. Actions must always be listed in `options.actions` -- they are not auto-registered.

This is the required export from `dataforge.schema.ts`. The CLI and SDK read this manifest for schema operations.

---

## Precondition operators

Available inside `.when()`:

| Operator | Usage | Description |
|----------|-------|-------------|
| `.eq(value)` | `c.status.eq('draft')` | Equals |
| `.neq(value)` | `c.status.neq('rejected')` | Not equals |
| `.in([values])` | `c.status.in(['draft', 'pending_review'])` | In set |
| `.notIn([values])` | `c.status.notIn(['approved'])` | Not in set |
| `.gt(value)` | `c.amount.gt(1000)` | Greater than |
| `.gte(value)` | `c.amount.gte(0)` | Greater than or equal |
| `.lt(value)` | `c.amount.lt(100000)` | Less than |
| `.lte(value)` | `c.amount.lte(50000)` | Less than or equal |
| `.contains(value)` | `c.title.contains('urgent')` | String contains |
| `.startsWith(value)` | `c.reference.startsWith('CON-')` | String starts with |

---

## Complete example

```typescript
import {
  objectType, string, number, date, enumType,
  link, action, role, now, compile,
} from '@ontologie/schema';

const ContractStatus = enumType('ContractStatus', [
  'draft', 'pending_review', 'approved', 'rejected',
]);

const Client = objectType('Client', {
  name: string().required().indexed(),
  email: string().optional(),
});

const Contract = objectType('Contract', {
  reference: string().required().indexed(),
  title: string().required(),
  amount: number(),
  status: ContractStatus.default('draft')
    .mutableBy(['Contract.submit', 'Contract.approve', 'Contract.reject']),
  approvedAt: date().optional()
    .mutableBy(['Contract.approve']),
});

const ContractToClient = link('Contract', 'Client')
  .cardinality('many_to_one')
  .label('belongs_to');

const submitContract = action('submit')
  .on(Contract)
  .executionMode('twin_apply')
  .riskLevel('low')
  .when(c => c.status.eq('draft'))
  .set({ status: 'pending_review' });

const approveContract = action('approve')
  .on(Contract)
  .executionMode('twin_apply')
  .riskLevel('medium')
  .input({ comment: string().optional() })
  .requires(role('manager'))
  .when(c => c.status.eq('pending_review'))
  .set({ status: 'approved', approvedAt: now() });

export const manifest = compile([Client, Contract], {
  actions: [submitContract, approveContract],
});
```
