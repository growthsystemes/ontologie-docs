# Ontologie

**Ontologie is the governed operational layer for AI agents, built by [Growthsystemes](https://www.growthsystemes.com/).**

Model your business as a governed operational twin that Claude Code, Codex, MCP clients and app backends can query and modify only through signed plans.

It turns business operations into an **agent-safe operational twin**: typed objects, states, links, policies, bounded actions, dry runs, signed plans, and audit. **Any AI agent that can use tools, run commands, or call APIs can use Ontologie**.

Agents can **discover the model**, **query live operational state**, **understand allowed next steps**, and **apply only verified plans through governed paths**, without raw database access.

The product is Ontologie. The agent and developer surface is `dataforge`: CLI, SDK, npm packages, and MCP adapter.

---

## Why Ontologie

Most software exposes the wrong interface to agents:

- Raw databases bypass business rules
- CRUD APIs allow arbitrary writes
- Prompt-only rules are hard to audit
- MCP wrappers often expose too much power

Ontologie resolves the five uncertainties an agent faces before modifying business state:

```mermaid
flowchart TB
  Agent["AI Agent: Approve this contract"]

  Agent --> Q1["What is a Contract?"]
  Agent --> Q2["What is true right now?"]
  Agent --> Q3["What am I allowed to do?"]
  Agent --> Q4["What will change exactly?"]
  Agent --> Q5["How do we prove what happened?"]

  Q1 --> A1["Typed objects, enums, declared links"]
  Q2 --> A2["Queries, graph context, object versions"]
  Q3 --> A3["Actions describe, RBAC, policy, mutableBy"]
  Q4 --> A4["Dry-run, plan diff, execution mode"]
  Q5 --> A5["Signed plan, idempotency, audit trail"]
```

---

## Quickstart

```bash
npm install -g @dataforge/cli
dataforge init --template contract-review
cd contract-review
dataforge dev
```

In another terminal:

```bash
dataforge schema describe --format json
dataforge query Contract --format json
dataforge actions describe Contract.approve --format json
dataforge actions run Contract.approve con_001 --dry-run --format json
dataforge plan inspect <planId> --format markdown
dataforge actions run Contract.approve con_001 \
  --apply-plan <planId> \
  --idempotency-key approve-con-001 \
  --format json
```

See the full [Quickstart guide](QUICKSTART.md) for local and cloud walkthroughs.

---

## The safety loop

Every mutation follows the same loop:

1. **Discover** schema and actions
2. **Query** current state
3. **Describe** the action
4. **Dry-run** the mutation
5. **Inspect / verify** the signed plan
6. **Apply** the verified plan with an idempotency key

At apply time, the runtime verifies actor, workspace, action, inputs, object versions, schema version, policy version, expiry, and idempotency before writing anything.

### Plan lifecycle

```mermaid
stateDiagram-v2
  [*] --> Pending: dry-run creates plan

  Pending --> Applied: apply-plan + idempotency key
  Pending --> Revoked: revoke
  Pending --> Expired: TTL exceeded
  Pending --> Rejected: actor / workspace / policy / version mismatch

  Applied --> [*]
  Revoked --> [*]
  Expired --> [*]

  Applied --> Applied: same plan + same key = replay
  Applied --> Rejected: same plan + different key
```

---

## Minimal model

```typescript
import {
  objectType, string, number, date, enumType,
  action, role, now, compile,
} from '@dataforge/schema';

const ContractStatus = enumType('ContractStatus', [
  'draft', 'pending_review', 'approved', 'rejected',
]);

const Client = objectType('Client', {
  name: string().required().indexed(),
});

const Contract = objectType('Contract', {
  reference: string().required().indexed(),
  amount: number(),
  status: ContractStatus.default('draft')
    .mutableBy(['Contract.approve', 'Contract.reject']),
  approvedAt: date().optional()
    .mutableBy(['Contract.approve']),
});

const approveContract = action('approve')
  .on(Contract)
  .executionMode('twin_apply')
  .requires(role('manager'))
  .when(c => c.status.eq('pending_review'))
  .set({ status: 'approved', approvedAt: now() });

export const manifest = compile([Client, Contract], {
  actions: [approveContract],
});
```

Fields protected by `mutableBy` cannot be changed through raw writes. The server rejects unauthorized mutations with `WRITE_POLICY_VIOLATION`.

See the full [contract-review example](examples/contract-review/) with seed data, agent files, and expected plan output.

---

## Surfaces

| Surface | Use case | Stability |
|---------|----------|-----------|
| **CLI** (`@dataforge/cli`) | Agents, CI, scripts | Stable |
| **SDK** (`@dataforge/sdk-client`) | TypeScript / Node.js apps | Stable |
| **MCP** (`@dataforge/mcp`) | Claude Code, Codex, MCP clients | Preview |

The CLI is the canonical contract. SDK and MCP expose the same capabilities with the same scopes, policies, signed plans, and audit. The MCP adapter never has more power than the CLI.

Works with Claude Code, Codex, any MCP client, and regular CLI/CI workflows.

---

## Architecture

```mermaid
flowchart LR
  subgraph Agent["Agent and developer surfaces"]
    A["AI Agent"]
    CLI["dataforge CLI"]
    SDK["TypeScript SDK"]
    MCP["MCP Adapter"]
  end

  subgraph Runtime["Ontologie governed runtime"]
    Contract["Public contract"]
    Guard["Policy + RBAC"]
    Plan["Dry-run + signed plan"]
    Verify["Server-side verification"]
    Apply["Verified apply"]
    Twin["Operational twin"]
    Audit["Append-only audit"]
  end

  subgraph Systems["Your systems"]
    DB[("Database")]
    Workflow["Workflow engine"]
    External["External systems"]
  end

  A --> CLI
  A --> SDK
  A --> MCP

  CLI --> Contract
  SDK --> Contract
  MCP --> Contract

  Contract --> Guard
  Guard --> Plan
  Plan --> Verify
  Verify --> Apply
  Apply --> Twin
  Apply --> Audit

  Twin -. "controlled sync" .-> DB
  Apply -. "workflow_handoff" .-> Workflow
  Apply -. "external_commit" .-> External

  A -. "no raw access" .-> DB
  A -. "no implicit writes" .-> External
```

---

## Local vs Cloud

**Local** is free and accountless: schema authoring, code generation, mock queries, mock dry-runs, and agent instruction files.

**Ontologie Cloud** adds persistent state, signed plans (Ed25519), policy enforcement, audit, quotas, team governance, and production execution.

```mermaid
flowchart LR
  subgraph Local["Local — free, no account"]
    L1["Schema design"] ~~~ L2["Type generation"] ~~~ L3["Mock dry-runs + queries"] ~~~ L4["Agent files"]
  end

  subgraph Cloud["Ontologie Cloud — governed"]
    C1["Persistent twin"] ~~~ C2["Ed25519 signed plans"] ~~~ C3["Policy + audit"] ~~~ C4["DFU metering"]
  end

  Local -. "mock runtime, no durable state" .-> Cloud
```

See [Local vs Cloud](docs/local-vs-cloud.md) for a detailed comparison.

---

## Security

Agent safety is enforced at the runtime layer, not through prompt instructions.

- Agents discover a typed schema — no raw database access
- Scoped API keys (server-side only) and OAuth PKCE (browser)
- Dry-run before mutation, signed plan before apply
- Server-side policy enforcement and per-field write control (`mutableBy`)
- Idempotency keys on every apply
- Append-only audit trail with principal type, action, plan reference

See [Signed plans and safety](docs/signed-plans-and-safety.md) and [SECURITY.md](SECURITY.md) for details.

---

## Use cases

See how real teams use Ontologie to let agents act safely:

| Use case | Domain |
|----------|--------|
| [Contract approval](docs/use-cases/contract-approval.md) | Legal / Sales ops |
| [Vendor onboarding](docs/use-cases/vendor-onboarding.md) | Procurement |
| [Customer refund](docs/use-cases/refund-approval.md) | Support / Finance |
| [CRM pipeline](docs/use-cases/crm-pipeline.md) | Revenue ops |
| [Finance audit](docs/use-cases/finance-audit.md) | Finance / Audit |
| [IT access request](docs/use-cases/it-access-request.md) | IT / Security |
| [Data quality](docs/use-cases/data-quality.md) | Operations / Data |

Each demo follows the same safety loop and produces signed plans with full audit trails.

---

## Pricing

Free locally. Free cloud sandbox. Prepaid cloud runtime for production.

| Plan | Price | DFU / month |
|---|---:|---:|
| **Local Free** | Free, no account | Not metered |
| **Cloud Sandbox** | Free, no card | 10K (hard cap) |
| **Cloud Runtime** | Prepaid DFU packs | Budget-capped |
| **+ Governance** | Per workspace/mo | — |
| **Enterprise** | Contract | Custom |

Cloud Sandbox is hard-capped. No overages. No surprise bills. See [Billing and limits](docs/billing-and-limits.md) for DFU details and tier comparison.

---

## What Ontologie is NOT

- Not a workflow engine — use `workflow_handoff` to delegate orchestration
- Not a data warehouse — it governs operational state, not analytical queries
- Not a generic CRUD API — mutations go through bounded actions and signed plans
- Not self-hosted — CLI/SDK are open-source (MIT); the cloud runtime is managed

---

## Install

```bash
# CLI
npm install -g @dataforge/cli

# SDK
npm install @dataforge/sdk-client @dataforge/schema

# Mock server (local dev)
npm install --save-dev @dataforge/mock-server

# MCP adapter (Preview)
npm install @dataforge/mcp
```

---

## Read next

- [Quickstart](QUICKSTART.md) — first result in under 10 minutes
- [Use cases](docs/use-cases/index.md) — real-world agent scenarios with demo scripts
- [Concepts](docs/concepts.md) — primitives and mental model
- [CLI contract](docs/cli-contract.md) — JSON envelope, exit codes, flags
- [SDK guide](docs/sdk-guide.md) — TypeScript integration
- [Signed plans and safety](docs/signed-plans-and-safety.md) — the core safety mechanism
- [MCP guide](docs/mcp-guide.md) — adapter configuration for Claude Code, Codex

Full reference: [Schema DSL](docs/schema-dsl-reference.md) · [Query](docs/query-reference.md) · [Errors](docs/errors.md) · [Auth](docs/auth-and-scopes.md) · [RBAC](docs/rbac-and-roles.md) · [Policy](docs/policy-reference.md) · [Import/Export](docs/import-export-reference.md) · [Audit](docs/audit.md) · [Billing](docs/billing-and-limits.md) · [Stability](docs/stability-and-versioning.md) · [Roadmap](docs/roadmap.md) · [FAQ](docs/faq.md)

---

## About Growthsystemes

Ontologie is developed and operated by [Growthsystemes](https://www.growthsystemes.com/), the team behind the Ontologie platform for operational AI systems.

**Authors:** Quentin Gavila & Benoit Ferrere

---

## License

MIT for public SDK and CLI packages. Ontologie Cloud is a managed commercial service.
