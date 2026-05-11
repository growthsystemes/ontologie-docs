# Roadmap

Public roadmap for Ontologie developer surfaces. This page covers planned capabilities visible to external developers. Internal implementation details are not included.

---

## Current: V1 (Stable)

The core agent safety loop is complete and stable:

- Schema DSL with typed ObjectTypes, LinkTypes, Enums, Actions
- CLI contract `dataforge.cli.v1` with structured JSON, 13 exit codes
- SDK client for TypeScript/Node.js
- Signed plan lifecycle: dry-run, inspect, verify, apply, revoke
- Server-side policy enforcement (workspace, write policies, agent policies)
- Idempotency, OCC versioning, audit trail
- Graph queries (neighbors, bounded traversal)
- Keyword search
- Import/Export (CSV/JSON/JSONL)
- Agent integration (init, doctor, context pack, capabilities manifest)
- Local mock server for offline development
- DataForge Units (DFU) billing with budget controls
- 5 pricing tiers (Local Free through Enterprise)

Commercialisation status:

| Gate | Status |
|------|--------|
| BaaS signed-plan loop | Stable commercial offer when staging public use-case, edge, proof, and daily golden-path gates are green |
| Self-serve billing | Self-serve billing is staging-ready, not Stable for production until live Stripe prices, webhook secret, and operator approval are complete |
| API cloud complete | Separate track; broad API endpoint coverage is not the stable BaaS contract |
| MCP adapter | Preview; MCP never has more mutation power than CLI/API |

---

## Next: V1.1

Extending the safety contract with runtime enforcement for all execution modes:

| Feature | Description |
|---------|-------------|
| Execution mode enforcement | Runtime handlers for `human_handoff` and `workflow_handoff` |
| Handoff commands | `dataforge plan handoff <planId>` for human and workflow handoff |
| Source-of-truth validation | Runtime enforcement of `sourceOfTruth` metadata |
| Governance add-on | RBAC, approval routing, configurable audit retention |
| Delegated apply | Admin can apply an agent's plan (post-`same_effective_actor`) |

Note: `external_commit` handler is planned for post-V1.1 with explicit policy opt-in and connector configuration.

V1.1 items are declared and visible in V1 (schema, plans, audit). Runtime enforcement is the V1.1 addition.

---

## Preview (available, may change)

| Feature | Status |
|---------|--------|
| MCP adapter (`@ontologie/mcp`) | Available, Preview stability |
| Semantic search | Available on Cloud Runtime+ |
| Deep graph traversal (depth > 1) | Available |
| Aggregate queries | Available |
| Batch/bulk operations | Available |
| Subscriptions (real-time) | Preview; not required by the public quickstart/KPI |

Preview features are documented and supported best-effort. They may change in minor versions.

---

## Planned

| Feature | Description |
|---------|-------------|
| MCP Stable | Promote MCP adapter to Stable with full compatibility guarantee |
| Production self-serve billing | Promote prepaid DFU pack purchase and plan management after Stripe live go/no-go |
| SOC 2 certification | Formal compliance certification |
| Multi-agent safety | Extending the safety model to multi-agent scenarios |

Roadmap items are directional and may change. They are not contractual commitments unless explicitly included in an enterprise agreement.

---

## Not planned for the public surface

These capabilities exist internally but are not part of the external developer contract:

- Workflow orchestration engine
- Agent Studio (OODA loop, tool registry)
- Knowledge Library (RAG pipeline)
- Live Data connectors
- Simulation engine
- Internal MCP tools (admin, orchestration)

---

## Versioning

- V1 capabilities are Stable with SemVer and 12-month deprecation.
- V1.1 capabilities are declared and visible, with enforcement pending.
- Preview features may change in minor versions.
- The roadmap is updated quarterly or on significant milestones.

See [Stability and versioning](stability-and-versioning.md) for the full policy.
