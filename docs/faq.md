# FAQ

---

**Is Ontologie a database?**

No. Ontologie is a governed state layer (an operational twin). It stores typed business state with OCC versioning, but it is not designed for analytical queries, joins, or ad-hoc SQL. Use it as the governed layer that agents and applications read from and write to through bounded actions.

---

**Is Ontologie a workflow engine?**

No. Ontologie declares states, transitions, and preconditions -- but does not orchestrate long-running processes. Use `workflow_handoff` to delegate execution to Temporal, n8n, or any webhook-reachable workflow engine.

---

**Can I self-host the backend?**

No. The CLI and SDK packages are open-source (MIT). The cloud runtime is proprietary. There is no self-hosted option. Local mode (`dataforge dev`) runs a mock server for development and testing.

---

**Do dry-runs cost anything?**

No. Dry-runs are free and return `meta.costUnits: 0`. They include a `costEstimate` field showing what the future apply will cost. Other cloud operations -- including queries, search, graph calls, context packs, and apply operations -- consume DFU.

---

**What happens when my budget runs out?**

Mutations stop. A limited read-only grace mode remains available for schema describe, usage queries, and billing operations. No partial charges occur. The CLI returns `BUDGET_EXCEEDED` (exit code 11). Budget resets at the period boundary, or you can purchase additional DFU.

---

**Can an agent bypass `mutableBy` with the `writes` scope?**

No. `mutableBy` is enforced regardless of scope. Even a `writes`-scoped API key cannot modify a governed field outside its declared actions. The server rejects the write with `WRITE_POLICY_VIOLATION`.

---

**What is the difference between local plans and cloud plans?**

Local dry-runs return unsigned mock plans (`algorithm: "mock"`, `trustLevel: "local_mock"`). Cloud dry-runs return Ed25519-signed plan artifacts that are tamper-evident and verified by 27 PlanGuard checks at apply time. Mock plans simulate the flow but provide no cryptographic guarantees.

---

**How does `now()` work in plan artifacts?**

`now()` is not frozen at dry-run time. The plan captures a token reference (`$applyTime`) that is resolved to the server timestamp at apply time. The plan hash covers the token reference, not a concrete value.

---

**Can I use Ontologie without AI agents?**

Yes. Ontologie is a typed business runtime. The CLI and SDK work for any server-side application, CI/CD pipeline, or integration script. The agent safety features (signed plans, trust levels, context packs) are available but not required for non-agent use cases.

---

**What is the relationship between CLI, SDK, and MCP?**

All three surfaces project the same capabilities with the same scopes and policies:
- **CLI** is the canonical contract (scripts, CI/CD, agent toolchains)
- **SDK** is the programmatic TypeScript API (applications, services)
- **MCP** is the tool discovery protocol for MCP-native AI clients (Preview)

The CLI is the reference. If something works in the CLI, it works in the SDK and MCP.
