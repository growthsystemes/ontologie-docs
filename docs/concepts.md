# Concepts

Ontologie is built on a small set of precise primitives. Understanding them is the foundation for using the CLI, SDK, and MCP surfaces.

---

## ObjectType

A typed business entity. Defined in the schema DSL with properties, validation rules, and metadata.

```typescript
const Contract = objectType('Contract', {
  reference: string().required().indexed(),
  amount: number(),
  status: ContractStatus.default('draft'),
  signedAt: date().optional(),
});
```

An ObjectType is the equivalent of a table -- but with declared actions, write policies, and schema evolution rules. ObjectTypes are the nouns of your business model.

---

## Instance

A concrete record of an ObjectType. Instances are versioned (OCC -- Optimistic Concurrency Control). Every mutation increments the version. Stale writes are rejected.

---

## Property

A typed field on an ObjectType. Properties support:
- Type validation (`string`, `number`, `date`, `boolean`, `enum`, `json`)
- Required/optional
- Default values
- Indexing
- `mutableBy` -- restricts which actions can modify this field

---

## Enum

A fixed set of values for a property. Enums are declared in the schema and enforced at runtime.

```typescript
const ContractStatus = enumType('ContractStatus', [
  'draft', 'pending_review', 'approved', 'rejected',
]);
```

Enum values can be extended (new values added) but not removed without migration.

---

## LinkType

A typed relation between two ObjectTypes. Links have:
- Direction (source -> target)
- Cardinality (`one_to_one`, `one_to_many`, `many_to_many`)
- A unique name (the `.label()` value) used as the identifier in queries and seed data

```typescript
const ContractToClient = link('Contract', 'Client')
  .cardinality('many_to_one')
  .label('belongs_to');
```

The label `belongs_to` becomes the link's stable identifier. Use it in graph queries (`--link-type belongs_to`) and seed files (`"type": "belongs_to"`).

Links form the operational graph. Graph queries (`neighbors`, `traverse`, `shortestPath`) operate on links.

---

## Action

A bounded, declared mutation. Actions are the verbs of your business model.

```typescript
const approveContract = action('approve')
  .on(Contract)
  .executionMode('twin_apply')
  .input({ comment: string().optional() })
  .requires(role('manager'))
  .when(c => c.status.eq('pending_review'))
  .set({ status: 'approved', approvedAt: now() });
```

An action declares:
- **Target** -- which ObjectType it operates on
- **Execution mode** -- what happens at apply time (see below)
- **Inputs** -- typed parameters the caller provides
- **Preconditions** -- state that must be true before execution
- **Effects** -- what changes when the action is applied. Dynamic values like `now()` are captured as token references (`$applyTime`) and resolved at apply time, not at dry-run time. The plan hash covers the token reference, not the resolved value.
- **Risk level** -- `low`, `medium`, `high` (affects plan TTL)
- **Required role** -- who can execute this action

Agents cannot invent actions. Only actions declared in the schema are available.

---

## Execution mode

Every action declares exactly one execution mode. The mode determines what happens when a plan is applied.

| Mode | What changes | V1 status |
|------|-------------|-----------|
| `descriptive` | Nothing -- documentation only | Enforced |
| `plan_only` | Nothing -- creates a verifiable proposal | Enforced |
| `twin_apply` | The operational twin (instances, links, versions) | Enforced |
| `human_handoff` | A decision request is created for a human | Declared (V1.1) |
| `workflow_handoff` | Plan routed to a workflow engine | Declared (V1.1) |
| `external_commit` | Source system updated via connector | Declared (V1.1) |

See [Execution semantics](execution-semantics.md) for detailed behavior.

---

## Operational Twin

The Ontologie cloud maintains a live, versioned representation of your business state. This is the **operational twin** -- not a database, not a cache, but a governed state layer with:

- Typed instances with OCC versioning
- Graph relationships (links)
- Declared actions with preconditions
- Append-only audit trail
- Policy enforcement

The twin is the source of truth for agent-readable business state. External systems remain the source of truth for their own data unless explicitly configured otherwise (`sourceOfTruth: ontologie_twin`).

---

## Signed Plan

When an agent (or human) runs a dry-run, the server produces a **plan artifact**:

- The exact diff (before/after state)
- Policy version, schema version, action version
- Actor binding
- Normalized inputs
- Canonical hash of the plan body
- Ed25519 signature

The plan is single-use, time-limited (TTL by risk level), and tamper-evident. Apply requires the same actor, same workspace, and passes 27 server-side verification checks.

---

## Policy

Workspace-level rules enforced by the server:

- `defaultMode` -- `read_only`, `dry_run`, or `live`
- `requireDryRunBeforeMutation` -- block direct apply
- `forbidDelete` -- no delete operations accepted
- `allowedActions` -- whitelist of permitted actions
- `maxObjectsTouched` -- ceiling per command
- `maxCostUnitsPerCommand` -- DFU cap per command

Policies are not advisory. They are hard gates.

---

## mutableBy (Write Policy)

Per-property declaration of which actions can modify a field:

```typescript
status: ContractStatus.default('draft')
  .mutableBy(['Contract.approve', 'Contract.reject']),
```

A field marked `mutableBy` cannot be changed through raw writes or actions not listed. The server rejects the mutation with `WRITE_POLICY_VIOLATION`.

---

## Context Pack

A compact, agent-readable summary of the workspace: schema, actions, limits, policy, examples. Generated by:

```bash
dataforge context pack --format markdown --budget-tokens 4000
```

Context packs include trust levels:
- `systemTrusted` -- produced by the runtime, authoritative
- `workspaceAuthored` -- written by members, useful but not verified
- `untrustedRuntimeData` -- live samples, opt-in only

---

## Capabilities Manifest

Machine-readable contract listing all available object types, actions, links, graph limits, and policy constraints:

```bash
dataforge capabilities export --format json
```

Agents use this to discover what verbs are available before starting a task.

---

## DataForge Units (DFU)

The billing unit across all Ontologie cloud operations. One DFU approximates one lightweight read. Operations report actual DFU cost via the `X-Cost-Units` response header.

---

## What Ontologie is NOT

- **Not a workflow engine** -- use `workflow_handoff` to delegate orchestration to Temporal, n8n, or similar
- **Not a data warehouse** -- it governs operational state, not analytical queries
- **Not a search engine for unstructured documents** -- keyword and semantic search operate over typed instances
- **Not a real-time streaming platform** -- use Live Data connectors for ingestion; subscriptions are Preview for change events
- **Not a replacement for your source systems** -- unless explicitly configured (`sourceOfTruth: ontologie_twin`)
- **Not self-hosted** -- CLI/SDK packages are open-source (MIT); the cloud runtime is proprietary
