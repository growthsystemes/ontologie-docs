# Local vs Cloud

Ontologie separates modeling from execution. You can design, test, and iterate locally without an account. Production execution requires Ontologie Cloud.

---

## What works locally

| Capability | Local | How |
|-----------|-------|-----|
| Schema design | Yes | Edit `dataforge.schema.ts` |
| Type generation | Yes | `dataforge generate` |
| Schema validation | Yes | `dataforge check` |
| Schema diff | Yes | `dataforge schema diff` |
| Mock queries | Yes | `dataforge dev` starts a local mock server |
| Mock dry-runs | Yes | Actions return simulated plan artifacts |
| Mock actions | Yes | Test preconditions and effects locally |
| Agent file generation | Yes | `dataforge agent init --target all` |
| Context pack (local) | Yes | Generated from the schema definition |
| MCP adapter (local) | Yes | `npx @dataforge/mcp --allow-read --allow-dry-run --local` |
| Import dry-run (local) | Yes | Validate CSV/JSON structure |

Local mode is powered by `@dataforge/mock-server`. It is a development tool, not a production runtime.

---

## What requires Ontologie Cloud

| Capability | Why cloud | Plan required |
|-----------|-----------|---------------|
| Live operational twin | Persistent, versioned state | Cloud Sandbox (free) |
| Signed plans (Ed25519) | Server-side key management | Cloud Sandbox |
| Apply mutations | Durable state changes | Cloud Sandbox |
| Audit trail | Immutable, server-authoritative | Cloud Sandbox |
| Policy enforcement | Server-enforced, not client-side | Cloud Sandbox |
| Multi-user workspace | Collaboration, RBAC | Cloud Runtime |
| Usage metering (DFU) | Cost tracking, budget caps | Cloud Runtime |
| Graph queries (live) | Against real data | Cloud Sandbox |
| Import (live) | Persisted to operational twin | Cloud Sandbox |
| MCP write tools | Governed writes | Cloud Runtime |
| Governance add-on | RBAC, approvals, audit retention | + Governance |

---

## Local development runtime

The local runtime is a **mock server**, not the cloud backend running locally.

```bash
dataforge dev
# Mock server at http://localhost:4200
# Simulates: queries, dry-runs, schema describe, context pack
# Does NOT simulate: real persistence, real audit, real signed plans
```

The mock server:
- Returns realistic responses matching the schema definition
- Generates mock plan artifacts (unsigned, `algorithm: "mock"`, `trustLevel: "local_mock"`)
- Enforces preconditions and `mutableBy` rules locally
- Does not persist state across restarts
- Does not meter DFU

**Mock plans vs cloud plans:**

| | Local mock | Cloud |
|---|---|---|
| Signature | None (`algorithm: "mock"`) | Ed25519 (tamper-evident) |
| Trust level | `local_mock` | `cloud_signed` |
| Apply | Simulated (no durable state) | Real (atomic, audited) |
| PlanGuard | Skipped | Full 27-check verification |

Mock plans simulate the flow but do not provide tamper-evidence. They are for development and testing only.

---

## Formulation

> Local mode lets you model, generate types, run a mock runtime, test actions and inspect plans without an account. Production storage, audit, billing and governed cloud execution require Ontologie Cloud.

There is no self-hosted backend. The CLI/SDK packages are open-source (MIT). The cloud runtime is proprietary.

---

## Progressive adoption

| Stage | What you use | Cost |
|-------|-------------|------|
| **Explore** | `dataforge init` + `dataforge dev` | Free, no account |
| **Prototype** | Cloud Sandbox (10K DFU/month) | Free, no card |
| **Build** | Cloud Runtime (prepaid DFU) | Paid |
| **Govern** | + Governance add-on | Paid |
| **Scale** | Enterprise (contractual) | Custom |

You never need to leave local mode to evaluate whether Ontologie fits your model. Push to cloud only when you need persistence, audit, or real agent execution.
