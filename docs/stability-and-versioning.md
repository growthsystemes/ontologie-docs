# Stability and Versioning

Ontologie uses a tiered stability system with explicit contracts per tier. Every feature is classified, and the classification determines what guarantees you get.

---

## Stability tiers

| Tier | Contract | What it means |
|------|----------|---------------|
| **Stable** | SemVer, 12-month deprecation | Will not break in minor/patch releases. Removal requires 12-month notice. |
| **Platform** | SemVer | Shipped and supported, but outside the agent safety loop. |
| **Preview** | Documented, best-effort | May change in minor versions. Documented as Preview. |
| **V1.1** | Declared, not yet enforced | Visible in schema and plans, runtime enforcement coming. |
| **Internal** | No public contract | Not exposed in CLI/SDK/MCP. May change without notice. |

---

## What is Stable

The agent safety loop and its supporting primitives:

| Category | Stable capabilities |
|----------|-------------------|
| CLI core | All commands in the CLI contract (`dataforge.cli.v1`) |
| Schema DSL | `objectType`, `enumType`, `link`, `action`, `role`, `string`, `number`, `date`, `boolean` |
| Queries | ObjectSet, filters, pagination, cursor |
| Graph | `neighbors` (depth 1) |
| Actions | `describe`, `dry-run`, `apply-plan` |
| Signed plans | Full lifecycle: create, inspect, verify, apply, revoke |
| Search | Keyword search |
| Agent integration | `agent init`, `agent doctor`, `context pack`, `capabilities export` |
| Mock server | `@ontologie/mock-server` |
| SDK client | `@ontologie/sdk-client` core API |
| Auth | API keys (server-side), OAuth PKCE (browser) |
| Import/Export | CSV/JSON/JSONL import with dry-run, JSONL export |

---

## What is Platform

Shipped and maintained, but not part of the core agent safety contract:

- React hooks (`@ontologie/react`)
- OAuth PKCE client (`@ontologie/oauth`)
- Usage/quota APIs
- Billing headers (`X-Cost-Units`, `X-Budget-Remaining`)

---

## What is Preview

May change. Documented. Best-effort support.

- MCP adapter (`@ontologie/mcp`)
- Semantic search
- Deep graph traversal (depth > 1)
- Aggregate queries
- Batch/bulk operations
- Subscriptions (real-time updates; Preview)

---

## What is V1.1

Declared in the schema, visible in dry-run output, signed in plan artifacts, but runtime enforcement is not yet active:

- Execution mode handlers for `human_handoff` and `workflow_handoff`
- `external_commit` connector-based apply (post-V1.1, requires explicit policy opt-in)
- Handoff CLI commands (`plan handoff`)
- Source-of-truth runtime validation
- Governance add-on (RBAC, approval routing, configurable audit retention) -- available as add-on, runtime enforcement V1.1

---

## What is Internal

Not exposed. Not documented for external developers. May change without notice.

- Workflow orchestration engine
- Agent Studio (OODA orchestration)
- Knowledge Library (RAG pipeline)
- MCP internal tools (admin and orchestration)
- Event store and CQRS internals
- Projection cache
- Live Data connectors
- Simulation engine

---

## SemVer rules

| Change type | Version bump | Examples |
|-------------|-------------|---------|
| New optional field in response | Minor | New key in `meta` |
| New CLI command | Minor | `dataforge export` |
| New enum value | Minor | Adding a status value |
| New error code | Minor | New `error.code` value |
| Remove field from response | Major | Removing `page.total` |
| Remove CLI command | Major (+ 12-month notice) | Removing `dataforge legacy` |
| Change error code meaning | Major | Changing what `PLAN_EXPIRED` means |
| Change exit code meaning | Major | Never done |

---

## Deprecation policy

When a Stable feature is scheduled for removal:

1. **Announcement** -- deprecation notice in CHANGELOG and CLI output (warning on stderr)
2. **12-month window** -- feature continues to work with deprecation warning
3. **Migration guide** -- published documentation showing the replacement
4. **Removal** -- feature removed in the next major version

Preview features may be removed or changed in minor versions without a deprecation period.

---

## Compatibility guarantees

| Surface | Guarantee |
|---------|-----------|
| CLI `dataforge.cli.v1` | Stable commands never remove fields in minor versions |
| SDK `@ontologie/sdk-client` | SemVer with 12-month deprecation |
| MCP `@ontologie/mcp` | Preview. May change. No guarantee until Stable. |
| JSON envelope | `ok`, `data`, `error`, `page`, `meta` are stable fields |
| Enum values | May be extended. Never removed in minor versions. |
| Exit codes | Stable. New codes may be added. |
| Error codes | Stable. New codes may be added. |
| Node.js | Minimum: Node 18 LTS |

---

## Schema evolution

When your business model changes:

- Adding optional properties is non-breaking
- Adding enum values is non-breaking
- Removing properties or enum values is breaking (requires migration)
- Changing `mutableBy` is non-breaking (immediate effect)
- Changing action preconditions invalidates pending plans

The `dataforge schema diff` command shows exactly what will change. Every schema push goes through dry-run and apply-plan -- no silent migrations.

See the full schema evolution rules in the [CLI contract](cli-contract.md).
