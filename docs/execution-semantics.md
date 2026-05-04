# Execution Semantics

Every action declares an **execution mode**. The mode determines exactly what happens -- and what does not happen -- when a plan is applied.

---

## The six execution modes

| Mode | What changes | What does NOT change | V1 status |
|------|-------------|---------------------|-----------|
| `descriptive` | Nothing | Everything | Enforced (blocks plan creation) |
| `plan_only` | Nothing | Everything | Enforced (blocks apply) |
| `twin_apply` | Ontologie operational twin | External systems | Enforced |
| `human_handoff` | Creates a decision request | Twin + external systems | Declared (V1.1 enforcement) |
| `workflow_handoff` | Routes plan to workflow engine | Twin until workflow completes | Declared (V1.1 enforcement) |
| `external_commit` | Source system via connector | Nothing until confirmed | Declared (V1.1 enforcement) |

---

## descriptive

The action exists in the schema for documentation. An agent can read its definition to understand the process. No mutation is possible. Useful for modeling states that are observed rather than controlled.

---

## plan_only

The agent builds a complete plan (with inputs, preconditions, and hash), but the plan is never applied. Designed for review workflows where a human inspects the proposal before any state change.

---

## twin_apply

The default execution mode. The agent mutates the operational twin: instances, versions, links, computed fields. No external system is touched. This is the safe default.

```bash
dataforge actions run Contract.approve con_001 --dry-run --format json
# Response includes: executionMode: "twin_apply"
# Apply updates the twin only
```

---

## human_handoff

The agent assembles a decision package (context, recommendation, evidence) and creates a decision request. The twin and all external systems remain unchanged until a human acts.

This mode bridges autonomous agent reasoning and human judgment.

---

## workflow_handoff

The plan is routed to an existing workflow engine (Temporal, n8n, or any webhook-reachable system). The twin is not updated until the workflow completes and reports back.

---

## external_commit

The agent writes to a real external system through a configured connector. The twin is updated afterward to reflect the change. Requires explicit policy opt-in -- never the default, never implicit.

---

## How modes interact with safety

The plan lifecycle enforces modes at two points:

1. **Dry-run**: the response includes the execution mode. The agent sees what will happen.
2. **Apply**: PlanGuard enforces the mode. A `twin_apply` action cannot touch external systems. A `plan_only` action cannot mutate the twin.

The plan hash locks the mode. If the mode changes between dry-run and apply, the hash fails and apply is rejected (`PLAN_EXECUTION_MODE_MISMATCH`).

```
actions describe  --> mode is visible
dry-run           --> plan hash locks the mode
inspect           --> reviewer sees the mode
apply-plan        --> runtime enforces the mode
audit             --> proof records which mode was used
```

---

## V1 enforcement status

| Mode | Plan creation | Apply | Notes |
|------|--------------|-------|-------|
| `descriptive` | Blocked | N/A | Cannot produce a plan |
| `plan_only` | Allowed | Blocked | Plan exists for review only |
| `twin_apply` | Allowed | **Allowed** | The only mode where apply succeeds in V1 |
| `human_handoff` | Allowed | Blocked | Handler deferred to V1.1 |
| `workflow_handoff` | Allowed | Blocked | Handler deferred to V1.1 |
| `external_commit` | Allowed | Blocked | Handler deferred to post-V1.1 (requires explicit policy opt-in) |

All modes produce valid plans (for inspection, review, audit) except `descriptive`. Only `twin_apply` plans can be applied. All other modes are explicitly rejected by PlanGuard.

---

## Process is not a workflow engine

| Ontologie Process | Workflow Engine |
|-------------------|----------------|
| Declares states and transitions | Executes steps in sequence/parallel |
| Declares inputs and preconditions | Manages retries, timeouts, branching |
| Declares execution mode per action | Routes work to queues |
| Produces signed plans | Manages long-running orchestration |
| Static (changes via schema push) | Dynamic (instances are running) |

A Process tells the agent: "these are the valid moves." Orchestration lives outside the process definition. Use `workflow_handoff` to delegate.

---

## Choosing a mode

| Scenario | Mode |
|----------|------|
| Agent updates internal state | `twin_apply` |
| Agent creates a proposal for human review | `plan_only` or `human_handoff` |
| Agent triggers an external workflow | `workflow_handoff` |
| Agent writes to the real business system | `external_commit` |
| Action is documentation-only | `descriptive` |
| Default for new actions | `twin_apply` |
