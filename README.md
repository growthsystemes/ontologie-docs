# Ontologie

The governed operational twin for AI agents.

## Why

Agents should not modify business state through raw databases, generic CRUD APIs, or prompt-only rules. When AI acts on your business processes, you need typed contracts, bounded mutations, verifiable plans, and immutable audit trails -- enforced by the runtime, not by the prompt.

## What Ontologie gives you

- **Typed business objects** -- define your domain as ObjectTypes, LinkTypes, and bounded Actions in a schema DSL.
- **Bounded actions** -- every mutation is declared, preconditioned, and scoped. Agents cannot invent operations.
- **Dry-runs** -- preview the exact structural diff (including deferred dynamic tokens like `$applyTime`), cost, and policy checks before anything changes.
- **Signed plans** -- the server produces a hashed, Ed25519-signed plan artifact. Signed plans are tamper-evident.
- **Policy checks** -- workspace-level and per-field write policies enforced server-side.
- **Idempotency** -- every apply carries a unique key. Replay is safe. Idempotency prevents duplicate execution within the governed apply path.
- **Audit** -- every request is logged with principal type, action, outcome, and plan reference.
- **Usage metering** -- DataForge Units (DFU) with budget caps, per-command limits, and cost headers.

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

## Surfaces

| Surface | Stability | Use case |
|---------|-----------|----------|
| **CLI** (`@dataforge/cli`) | Stable | Scripts, CI/CD, agent toolchains, primary contract |
| **SDK** (`@dataforge/sdk-client`) | Stable | TypeScript/Node.js applications, server-side integrations |
| **MCP** (`@dataforge/mcp`) | Preview | MCP-native clients (Claude Code, Codex), zero-config tool discovery |

The CLI is the canonical agent contract. SDK and MCP project the same capabilities with the same scopes and policies.

## Local vs Cloud

| | Local | Cloud |
|---|---|---|
| Model and design | Yes | Yes |
| Generate types | Yes | Yes |
| Mock runtime (dry-runs, queries) | Yes | -- |
| Test actions locally | Yes | -- |
| Live operational twin | -- | Yes |
| Signed plan runtime | -- | Yes |
| Audit trail | -- | Yes |
| Billing and quotas | -- | Yes |

Local mode lets you model, generate types, run a mock runtime, test actions and inspect plans without an account. Production storage, audit, billing and governed cloud execution require Ontologie Cloud.

## Install

```bash
# CLI (primary surface)
npm install -g @dataforge/cli

# SDK (TypeScript applications)
npm install @dataforge/sdk-client @dataforge/schema

# MCP adapter (Preview -- MCP-native clients)
npm install @dataforge/mcp
```

## Read next

- [Quickstart](QUICKSTART.md) -- first result in under 10 minutes
- [Concepts](docs/concepts.md) -- primitives and mental model
- [CLI contract](docs/cli-contract.md) -- stable JSON envelope, exit codes, flags
- [SDK guide](docs/sdk-guide.md) -- TypeScript integration
- [Safety guide](docs/signed-plans-and-safety.md) -- dry-run, signed plans, policy enforcement
- [MCP guide](docs/mcp-guide.md) -- MCP adapter configuration
- [Billing and limits](docs/billing-and-limits.md) -- DFU, quotas, budget controls
- [Auth and scopes](docs/auth-and-scopes.md) -- API keys, OAuth, principal types
- [Stability and versioning](docs/stability-and-versioning.md) -- SemVer, tiers, deprecation policy
- [RBAC and roles](docs/rbac-and-roles.md) -- role assignment, agent delegation, governance
- [Policy reference](docs/policy-reference.md) -- workspace constraints, agent policy
- [Import/Export](docs/import-export-reference.md) -- CSV/JSON import, seed files, export
- [Audit](docs/audit.md) -- audit trail, retention, export
