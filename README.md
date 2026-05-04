# Ontologie

**The governed operational twin for AI agents.**

Ontologie lets AI agents safely understand, query and change business data without direct database access or generic CRUD APIs.

You define your business model as typed objects, links and bounded actions. Agents discover the model, query the live graph, dry-run mutations, inspect signed plans and apply only verified plans through a deterministic CLI and SDK.

Works with Claude Code, Codex, any MCP client, and regular CLI/CI workflows.

---

- [How Ontologie works](#how-ontologie-works)
- [Why Ontologie](#why-ontologie)
- [The safety loop](#the-safety-loop)
- [Example: contract approval](#example-contract-approval)
- [Quick demo](#quick-demo-local)
- [CLI and SDK](#cli-and-sdk)
- [Agent integrations](#agent-integrations)
- [Surfaces](#surfaces)
- [Architecture](#architecture)
- [Local vs Cloud](#local-vs-cloud)
- [Security model](#security-model)
- [Pricing](#pricing)
- [Templates](#templates)
- [Who is this for](#who-is-this-for)
- [What Ontologie is NOT](#what-ontologie-is-not)
- [Install](#install)
- [Read next](#read-next)

---

## How Ontologie works

| Piece | What it gives agents | Why it matters |
|---|---|---|
| **Operating model** | Objects, states, links, actions, policies, execution modes | Agents know what the business means |
| **Operational twin** | Live instances, versions, links, search and graph context | Agents know what is true now |
| **Signed plan runtime** | Dry-run, signed plan, inspect, verify, apply-plan and audit | Agents can propose changes safely |

The signed plan is the trust boundary between agent reasoning and governed execution.

Ontologie does not rely on prompt instructions for safety. Dry-runs, signed plans, policy checks, idempotency and audit are enforced by the runtime.

---

## Why Ontologie

AI agents are increasingly able to operate software systems, but most systems expose the wrong interface.

Raw database access lets agents bypass business rules. Generic APIs expose broad CRUD operations with no mutation guardrails. Prompt-only instructions are hard to audit and easy to ignore.

Ontologie gives agents a smaller and safer contract:

- **Typed business objects** instead of tables
- **Declared links** instead of implicit joins
- **Bounded actions** instead of arbitrary writes
- **Dry-runs** before mutation
- **Signed plans** before apply
- **Server-side policies** instead of prompt-only rules
- **Audit trails** for every business change

| Tool type | What it exposes | What Ontologie exposes |
|---|---|---|
| ORM | Tables and records | Business objects and links |
| CRUD API | Generic create/update/delete | Bounded business actions |
| Workflow engine | Long-running processes | Atomic, typed mutations |
| Prompt rules | Instructions | Server-enforced policies |
| MCP wrapper | Tool access | Verified plan-based mutation |

---

## The safety loop

Every mutation follows the same five-step loop. This is the core safety guarantee.

```
1. Discover the schema         dataforge schema describe --format json
2. Query the graph             dataforge query Contract --format json
3. Dry-run a business action   dataforge actions run Contract.approve con_001 --dry-run --format json
4. Inspect the signed plan     dataforge plan inspect <planId> --format markdown
5. Apply the verified plan     dataforge actions run Contract.approve con_001 --apply-plan <planId> --idempotency-key approve-001 --format json
```

At apply time, the server verifies: same actor, same workspace, same action, same inputs, same object versions, same schema version, same policy version, plan not expired, idempotency key present.

| Actor | Direct mutation | Plan required |
|---|---|---|
| Backend app (trusted) | Possible when allowed by policy | Optional or recommended |
| Human CLI | Possible with `--apply-plan` when allowed by policy | Recommended |
| Agent / MCP / automation | No | Required |

---

## Example: contract approval

### 1. Define the model

```typescript
// dataforge.schema.ts
import {
  objectType, string, number, date, enumType,
  link, action, role, now, compile,
} from '@dataforge/schema';

const Company = objectType('Company', {
  name: string().required().indexed(),
  industry: string().indexed(),
});

const ContractStatus = enumType('ContractStatus', [
  'draft', 'pending_review', 'approved', 'rejected',
]);

const Contract = objectType('Contract', {
  reference: string().required().indexed(),
  amount: number(),
  status: ContractStatus.default('draft')
    .mutableBy(['Contract.approve', 'Contract.reject']),
  company: link.toOne(() => Company),
  approvedAt: date().optional()
    .mutableBy(['Contract.approve']),
});

const approveContract = action('approve')
  .on(Contract)
  .executionMode('twin_apply')
  .input({ comment: string().optional() })
  .requires(role('manager'))
  .when(c => c.status.eq('pending_review'))
  .set({ status: 'approved', approvedAt: now() });

export const manifest = compile([Company, Contract], {
  actions: [approveContract],
});
```

Properties marked with `mutableBy` can only be changed through the listed actions. Direct CRUD patches are rejected by the server with `WRITE_POLICY_VIOLATION`.

### 2. Push and generate

```bash
dataforge schema push --dry-run --format json
dataforge schema push --apply-plan <planId> --idempotency-key schema-push-001 --format json
dataforge generate
```

### 3. Dry-run the action

```bash
dataforge actions run Contract.approve con_001 \
  --input-json '{"comment":"Reviewed by legal"}' \
  --dry-run \
  --format json
```

### 4. Inspect the signed plan

```markdown
# Action Plan

Action: Contract.approve
Target: Contract con_001
Risk level: medium
Expires: 2026-04-25T10:15:00Z

## Changes

| Object | Field | Before | After |
|---|---|---|---|
| Contract con_001 | status | pending_review | approved |
| Contract con_001 | approvedAt | null | $applyTime |

## Policy checks

| Check | Status |
|---|---|
| allowedActions | passed |
| maxObjectsTouched | passed |
| requireDryRunBeforeMutation | passed |

## Apply

    dataforge actions run Contract.approve con_001 \
      --apply-plan <planId> \
      --idempotency-key <key> \
      --format json
```

`$applyTime`: actions using `now()` capture a symbolic token in the plan. The real timestamp is resolved at apply time, not at dry-run time.

### 5. Apply the verified plan

```bash
dataforge actions run Contract.approve con_001 \
  --apply-plan <planId> \
  --idempotency-key approve-con-001-001 \
  --format json
```

---

## Quick demo (local)

```bash
npm install -g @dataforge/cli
dataforge init --template contract-review
cd contract-review
dataforge dev
# In another terminal:
dataforge schema describe --format json
dataforge query Contract --format json
dataforge actions run Contract.approve con_001 --dry-run --format json
```

## Quick demo (cloud)

```bash
dataforge login
dataforge schema push --dry-run --format json
dataforge schema push --apply-plan <planId> --idempotency-key schema-push-001 --format json
dataforge generate
dataforge import seed.json --type Contract --dry-run --format json
dataforge import seed.json --type Contract --apply-plan <planId> --idempotency-key import-001 --format json
dataforge actions run Contract.approve con_001 --dry-run --format json
dataforge actions run Contract.approve con_001 --apply-plan <planId> --idempotency-key approve-001 --format json
```

---

## CLI and SDK

The CLI is the canonical agent contract. SDK and MCP project the same capabilities with the same scopes and policies.

### Nine agent verbs

| Verb | CLI | SDK |
|---|---|---|
| **Discover** | `schema describe` | `client.schema.describe()` |
| **Understand** | `actions describe Contract.approve` | `client.actions.describe()` |
| **Query** | `query Contract --format json` | `client.ontology.Contract.where()` |
| **Search** | `search "Acme"` | `client.search()` |
| **Traverse** | `graph neighbors con_001` | `client.graph.neighbors()` |
| **Plan** | `--dry-run` | `.dryRun()` |
| **Apply** | `--apply-plan` | `.applyPlan()` |
| **Handoff** | `plan handoff` (V1.1) | `.createHandoff()` (V1.1) |
| **Measure** | `usage me` | `client.usage` |

### JSON contract

All `--format json` commands return a stable envelope (`dataforge.cli.v1`):

```json
{
  "ok": true,
  "data": [],
  "error": null,
  "page": { "limit": 20, "nextCursor": null, "hasMore": false },
  "meta": {
    "contractVersion": "dataforge.cli.v1",
    "command": "query.Contract",
    "requestId": "req_...",
    "workspaceId": "ws_...",
    "manifestVersion": "2026-04-25.1",
    "costUnits": 1,
    "quotaRemaining": 8234
  }
}
```

Exit codes: `0` success, `1` error, `2` validation, `3` auth, `4` authorization, `5` capability drift, `6` schema drift, `7` conflict, `8` rate limited, `9` network, `10` precondition, `11` quota, `12` configuration.

### SDK

```typescript
import { createClient } from '@dataforge/sdk-client';
import type { Ontology } from './src/generated/dataforge';

const client = createClient<Ontology>({
  apiKey: process.env.DATAFORGE_API_KEY!,
});

const pending = await client.ontology.Contract
  .where(c => c.status.eq('pending_review'))
  .orderBy(c => c.amount.desc())
  .fetchPage({ limit: 50 });
```

Run an action through plans:

```typescript
const plan = await client.actions
  .on("Contract")
  .action("approve")
  .target("con_001")
  .input({ comment: "Reviewed by legal" })
  .dryRun();

await client.plans.verify(plan.id);

await client.actions.applyPlan(plan.id, {
  idempotencyKey: "approve-con-001-001"
});
```

---

## Agent integrations

Ontologie is designed to be the business layer for coding agents. Claude Code and Codex connect through the CLI and MCP adapter. Any tool that can run shell commands or speak MCP can use the full safety loop.

### Context Pack

Generate a compact, agent-readable summary of the workspace:

```bash
dataforge context pack --format markdown
dataforge context pack \
  --objective "build a contract review dashboard" \
  --include schema,actions,limits,examples \
  --budget-tokens 4000 \
  --format markdown
```

The Context Pack uses three trust levels: `systemTrusted` (schema, policy, safety rules), `workspaceAuthored` (user descriptions, labels) and `untrustedRuntimeData` (instance samples, opt-in only).

### Agent instruction files

```bash
dataforge agent init --target all
```

Generates `AGENTS.md`, `CLAUDE.md`, `.claude/skills/dataforge/SKILL.md`, `.codex/config.toml.example` and `.llms/dataforge.md`. Drop these into your repo and Claude Code, Codex or any compatible agent immediately knows how to discover, query, plan and apply.

### Capabilities manifest

```bash
dataforge capabilities export --format json
```

A machine-readable contract that lets agents and MCP adapters discover available object types, actions, links, graph limits and policy constraints.

### Agent doctor

```bash
dataforge agent doctor --format json
```

Checks: CLI installed, AGENTS.md present, skill installed, MCP config available, API key not exposed in frontend, context pack generable, dry-run mutation works.

### MCP adapter (Preview)

The MCP adapter projects the CLI contract into MCP-native clients (Claude Code, Codex). It does not add mutation power and does not bypass signed plans, policy checks or audit.

```bash
npx @dataforge/mcp --allow-read --allow-dry-run --local
```

The MCP adapter never has more power than the CLI.

---

## Surfaces

| Surface | Stability | Use case |
|---------|-----------|----------|
| **CLI** (`@dataforge/cli`) | Stable | Scripts, CI/CD, agent toolchains, primary contract |
| **SDK** (`@dataforge/sdk-client`) | Stable | TypeScript/Node.js applications, server-side integrations |
| **MCP** (`@dataforge/mcp`) | Preview | MCP-native clients (Claude Code, Codex), zero-config tool discovery |

---

## Architecture

```
  Agents / Developers
  (Claude Code, Codex, scripts, CI)
          |
          v
  +--------------------------+     +---------------------------+
  |  Local (free)            |     |  Ontologie Cloud (metered)|
  |  @dataforge/cli          |---->|  Auth + permissions       |
  |  @dataforge/schema       |     |  Query + graph service    |
  |  @dataforge/sdk-client   |     |  Action + policy engine   |
  |  @dataforge/mock-server  |     |  Usage + quotas + audit   |
  |  @dataforge/mcp (preview)|     |  Plan verification        |
  |  Generated TS client     |     +---------------------------+
  +--------------------------+
```

The local tier handles schema authoring, code generation, mock data and agent instructions. The cloud tier adds real storage, policy enforcement, audit, quotas and team governance.

---

## Local vs Cloud

| | Local | Cloud |
|---|---|---|
| Model and design | Yes | Yes |
| Generate types | Yes | Yes |
| Mock runtime (dry-runs, queries) | Yes | -- |
| Test actions locally | Yes | -- |
| Live operational twin | -- | Yes |
| Signed plan runtime (Ed25519) | -- | Yes |
| Audit trail | -- | Yes |
| Billing and quotas | -- | Yes |

Local mode lets you model, generate types, run a mock runtime, test actions and inspect plans without an account. Local dry-runs return mock plan artifacts (unsigned, `algorithm: "mock"`). Production storage, audit, billing and governed cloud execution require Ontologie Cloud.

---

## Security model

Agent safety is enforced at the runtime layer, not through prompt instructions.

1. Agents do not receive raw database access. They discover a typed schema.
2. They can read within the limits of their scopes.
3. They can request a dry-run. The dry-run produces a signed plan.
4. The server verifies the plan at apply time: actor, workspace, schema version, policy version, object versions, action version, expiry, idempotency.
5. Every mutation is audited.
6. Policies are enforced server-side regardless of client instructions.

### Principal types

Every request is associated with an identified principal for audit:

| Principal | Example | Audit trail |
|---|---|---|
| `user` | User via OAuth | "Jane approved Contract con_001" |
| `service` | API key, server-to-server | "Backend service synced inventory" |
| `agent_on_behalf_of` | Agent acting for a human | "Agent claude-code on behalf of Jane approved con_001" |
| `ci` | CI/CD pipeline | "CI pipeline deployed schema v25" |

### API keys and OAuth

- API keys are for server-side, scripts and CI only. Never embed in frontend code.
- Browser apps use OAuth PKCE (`@dataforge/oauth`).
- Keys are scoped: `reads`, `writes`, `actions`, `schema`, `admin`.

---

## Pricing

> Free locally. Metered in the cloud. Governed when it matters.

| Plan | Price | Objects | DFU / month | Environments |
|---|---:|---:|---:|---|
| **Local Free** | Free, no account | Unlimited mock | Not metered | Local |
| **Cloud Sandbox** | Free, no card | 5,000 | 10K (hard cap) | dev |
| **Cloud Runtime** | Prepaid DFU packs | Unlimited | Budget-capped | dev + prod |
| **+ Governance** | Per workspace/mo | -- | -- | + staging, RBAC, approvals |
| **Enterprise** | Contract | Custom | Custom | Custom + dedicated |

Cloud Sandbox is hard-capped at 10,000 DFU/month. No overages. No surprise bills.

| What's free | What's paid |
|---|---|
| Local development, mock server, schema modeling, generated types | Cloud Runtime (prepaid DFU) |
| Cloud Sandbox (5K objects, 10K DFU/mo, keyword search, depth 1) | Production workspaces, higher DFU budgets, governed plans |
| Agent instruction files, context pack, doctor | Governance: RBAC, approval workflows, environments, audit retention |
| | Enterprise: SSO, remote MCP, data residency |

---

## Templates

Three official templates to start with:

| Template | Objects | Key actions |
|---|---|---|
| **contract-review** | Company, Contract, Reviewer, ApprovalTask | submitForReview, approve, reject |
| **customer-onboarding** | Customer, OnboardingStep, Document, Assignee | startOnboarding, completeStep, requestDocument |
| **vendor-risk** | Vendor, RiskAssessment, Contact, Contract | assessRisk, markRisky, clearVendor |

```bash
dataforge init --template contract-review
```

---

## Who is this for

Ontologie is for teams that want AI agents to operate business processes safely:

- **Legal / procurement**: contract approvals, vendor onboarding, compliance reviews.
- **Operations**: customer onboarding, risk assessments, internal process automation.
- **Platform engineering**: governed internal tools, typed dashboards, CI-driven business actions.
- **Agentic dev tools**: give Claude Code, Codex or any MCP client a safe business contract.

---

## What Ontologie is NOT

- **Not a workflow engine** -- use `workflow_handoff` to delegate orchestration
- **Not a data warehouse** -- it governs operational state, not analytical queries
- **Not a search engine for unstructured documents** -- search operates over typed instances
- **Not a replacement for your source systems** -- unless configured (`sourceOfTruth: ontologie_twin`)
- **Not self-hosted** -- CLI/SDK packages are open-source (MIT); the cloud runtime is proprietary

---

## Install

```bash
# CLI (primary surface)
npm install -g @dataforge/cli

# SDK (TypeScript applications)
npm install @dataforge/sdk-client @dataforge/schema

# Mock server (local development)
npm install --save-dev @dataforge/mock-server

# MCP adapter (Preview -- MCP-native clients)
npm install @dataforge/mcp
```

---

## Read next

- [Quickstart](QUICKSTART.md) -- first result in under 10 minutes
- [Concepts](docs/concepts.md) -- primitives and mental model
- [CLI contract](docs/cli-contract.md) -- stable JSON envelope, exit codes, flags
- [SDK guide](docs/sdk-guide.md) -- TypeScript integration
- [Safety guide](docs/signed-plans-and-safety.md) -- dry-run, signed plans, policy enforcement
- [MCP guide](docs/mcp-guide.md) -- MCP adapter configuration
- [Schema DSL reference](docs/schema-dsl-reference.md) -- full DSL API
- [Query reference](docs/query-reference.md) -- filters, pagination, examples
- [Billing and limits](docs/billing-and-limits.md) -- DFU, quotas, budget controls
- [Auth and scopes](docs/auth-and-scopes.md) -- API keys, OAuth, principal types
- [Stability and versioning](docs/stability-and-versioning.md) -- SemVer, tiers, deprecation policy
- [RBAC and roles](docs/rbac-and-roles.md) -- role assignment, agent delegation, governance
- [Policy reference](docs/policy-reference.md) -- workspace constraints, agent policy
- [Import/Export](docs/import-export-reference.md) -- CSV/JSON import, seed files, export
- [Audit](docs/audit.md) -- audit trail, retention, export
- [Errors](docs/errors.md) -- error codes, recovery rules
- [FAQ](docs/faq.md) -- common questions

---

## License

MIT for public SDK and CLI packages.

Ontologie Cloud is a managed commercial service.

---

Built by [Growthsystemes](https://www.growthsystemes.com/) -- Quentin Gavila & Benoit Ferrere.
