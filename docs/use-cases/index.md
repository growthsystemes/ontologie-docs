# Use cases

Ontologie is most useful when an AI agent needs to act on business state, but raw database writes, generic CRUD APIs, broad MCP tools, or prompt-only rules are too risky.

The core pattern is always the same:

1. Discover the typed business model.
2. Query the current operational state.
3. Describe the bounded action the agent wants to use.
4. Dry-run the action to produce a signed plan with the exact diff.
5. Inspect the plan.
6. Apply the verified plan with an idempotency key.
7. Verify the resulting state and audit trail.

---

## Available use cases

| Use case | Domain | Complexity |
|----------|--------|-----------|
| [Contract approval](./contract-approval.md) | Legal / Sales ops | Simple (single object, single action) |
| [Vendor onboarding](./vendor-onboarding.md) | Procurement | Medium (linked objects, document checks) |
| [Customer refund approval](./refund-approval.md) | Support / Finance | Medium (amount policies, linked orders) |
| [CRM pipeline governance](./crm-pipeline.md) | Revenue ops | Medium (multiple action types, bulk awareness) |
| [Finance audit evidence](./finance-audit.md) | Finance / Audit | Medium (proposal mode, evidence linking) |
| [IT access request](./it-access-request.md) | IT / Security | Medium (expiry rules, risk tiers) |
| [Data quality remediation](./data-quality.md) | Operations / Data | Medium (corrections, proposals, evidence) |

Start with **Contract approval** — it is the simplest complete demonstration of the safety loop.

---

## How to read these use cases

Each use case includes:

- The business situation and why it requires governed agent access.
- A model sketch showing ObjectTypes, links, and actions.
- A policy sketch.
- An agent task card with allowed and forbidden commands.
- A demo script using the CLI.
- The proof artifacts produced by a successful run.

---

## CLI command reference

All demos use the stable CLI contract (`dataforge.cli.v1`). The full command grammar:

```
dataforge <domain> <verb> [target] [flags]
```

Key commands used across all demos:

```bash
dataforge schema describe --format json          # Discover the model
dataforge query <type> --filter-json '{...}'     # Query instances
dataforge graph neighbors <id> --format json     # Traverse linked objects
dataforge actions describe <key> --format json   # Describe an action
dataforge actions run <key> <id> --dry-run       # Create a signed plan
dataforge plan inspect <planId> --format markdown # Inspect the plan
dataforge actions run <key> <id> \
  --apply-plan <planId> \
  --idempotency-key <key> --format json          # Apply the plan
```

See [CLI contract](../cli-contract.md) for the full specification.

---

## Execution modes

| Mode | Meaning | V1 status |
|------|---------|-----------|
| `twin_apply` | The operational twin changes immediately | Stable |
| `plan_only` | The plan is produced but not applied (proposal) | Stable |
| `human_handoff` | Route to a human reviewer | Future |
| `workflow_handoff` | Trigger a workflow for further processing | Future |
| `external_commit` | Commit to a source system via connector | Future |

All V1 demos use `twin_apply` or `plan_only`. Future modes are documented but not promised.
