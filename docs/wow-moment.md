# The Ontologie Wow Moment

> From zero to a cryptographically signed, inspectable, auditable plan proof in 7 commands.

---

## The story in 7 commands

This is the canonical demonstration of what Ontologie does. Every use case, template, and quickstart leads to this loop.

### 1. Scaffold

```bash
npx create-ontologie-app my-project --template contract-review
cd my-project
```

You get a typed business model: `Contract`, `Company`, `Reviewer`, `ApprovalTask`, with actions like `Contract.approve` that declare preconditions, roles, execution modes, and mutableBy constraints.

### 2. Start local

```bash
dataforge dev
```

A local mock server starts. No account, no cloud, no billing. You can model and test without any network.

### 3. Discover

```bash
dataforge schema describe --format json
```

The agent (or you) discovers the full ontology: object types, properties, enums, links, actions, states, transitions, and policies. This is what makes the business legible to machines.

### 4. Query

```bash
dataforge query Contract --filter-json '{"status":{"eq":"pending_review"}}' --format json
```

The agent reads the operational twin. It sees real objects with real state. No database access, no guessing.

### 5. Dry-run

```bash
dataforge actions run Contract.approve con_001 \
  --input-json '{"comment":"Reviewed and approved by legal"}' \
  --dry-run --format json
```

The agent proposes a change. The system returns a **signed plan artifact** containing:
- The exact effects (what will change)
- Policy checks (what was validated)
- Risk level (low/medium/high/critical)
- Version dependencies (what state was read)
- Expiration (how long this plan is valid)
- Ed25519 signature (cryptographic proof of intent)

Nothing has changed yet. The plan is a proposal, not an execution.

### 6. Inspect

```bash
dataforge plan inspect <planId> --plan-format markdown
```

The agent (or a human reviewer) reads the plan in plain language:
- What action, on what object, by whom
- What will change (before/after diff)
- What checks passed or failed
- Whether the plan can be applied

This is the moment of transparency. The agent's intent is fully visible before anything happens.

### 7. Apply

```bash
dataforge actions run Contract.approve con_001 \
  --apply-plan <planId> \
  --plan-hash <hash> \
  --idempotency-key approve-con-001-001 \
  --format json
```

The signed plan is applied to the operational twin. The system enforces:
- Plan hash matches (no tampering)
- Version dependencies still hold (no stale state)
- Idempotency key prevents duplicate execution
- mutableBy policy restricts which actions can touch which fields
- Audit trail records planId, principalType, requestId

After apply, you can export the proof:

```bash
dataforge plan proof <planId> --format markdown
```

A portable, shareable proof bundle: who did what, when, with what authorization, verified by what checks.

---

## What you just proved

In 7 commands, you demonstrated that an AI agent can:

1. **Understand** a business domain without documentation drift
2. **Query** live operational state without database access
3. **Propose** a change as a signed, inspectable artifact
4. **Not modify anything** until the plan is explicitly applied
5. **Prove** exactly what happened, to whom, with cryptographic evidence

This is the signed-plan safety loop. It is the core value proposition of Ontologie.

---

## What this is not

- Not a database wrapper (agents never see SQL)
- Not a CRUD API (all writes go through signed plans)
- Not prompt engineering (business rules are typed, not prompted)
- Not just an MCP server (the CLI is the stable contract; MCP is a preview projection)

---

## Next steps

- [Quickstart](../QUICKSTART.md) -- full step-by-step guide
- [Signed plans and safety](signed-plans-and-safety.md) -- deep dive on the trust model
- [CLI contract](cli-contract.md) -- complete command reference
- [SDK guide](sdk-guide.md) -- build applications with TypeScript
- [Use cases](use-cases/) -- 8 worked examples across industries
