# Signed Plans and Safety

Ontologie does not rely on prompt instructions for safety. Every guardrail is enforced by the server, not by the agent.

---

## The safety loop

Every mutation passes through five steps. No step can be skipped.

| Step | What happens | Who controls it |
|------|-------------|-----------------|
| **Discover** | Agent reads schema, actions, and workspace policy | Server sends context pack with current policy version |
| **Query** | Agent queries data (read-only) | Server enforces read-only at the API layer |
| **Dry-run** | Agent submits mutation with `--dry-run`. Server returns the structural diff (with deferred tokens for dynamic values), cost, and policy checks. Nothing is written. | Server generates preview; agent cannot bypass |
| **Inspect** | Agent or human reviews the plan: effects, policy checks, cost | Dry-run response includes full verification details |
| **Apply** | Agent submits signed plan + idempotency key. Server re-validates before executing. | Server rejects stale, tampered, or policy-mismatched plans |

```bash
# Full safety loop
dataforge schema describe --format json
dataforge query Contract --filter-json '{"status":{"eq":"pending_review"}}' --format json
dataforge actions describe Contract.approve --format json
dataforge actions run Contract.approve con_001 --input-json '{"comment":"OK"}' --dry-run --format json
dataforge plan inspect <planId> --plan-format markdown
dataforge actions run Contract.approve con_001 --apply-plan <planId> --plan-hash <hash> --idempotency-key approve-001 --format json
```

---

## Signed plan artifact

When a dry-run completes, the server produces a plan artifact containing:

| Field | Purpose |
|-------|---------|
| Plan body | Exact diff (before/after for every affected object). Dynamic values like `now()` appear as token references (`$applyTime`) resolved at apply time. |
| Policy version | Active policy at dry-run time |
| Manifest version | Schema version |
| Action version | Action definition hash |
| Actor binding | Same actor must apply |
| Normalized inputs | Captured and canonicalized |
| Canonical hash | SHA-256 of the plan body |
| Ed25519 signature | Server-side key, tamper-evident |

The plan is single-use, time-limited, and immutable once created.

---

## PlanGuard verification (27 checks)

At apply time, the server runs a multi-step verification:

1. Authenticate the actor
2. Load the plan from store
3. Verify hash and Ed25519 signature
4. Check idempotency key (replay or new)
5. Verify plan not revoked or expired
6. Verify plan not already applied (unless replay)
7. Verify actor, workspace, action, target and input bindings
8. Load current manifest, policy and action definitions
9. Compare manifest version, policy version, action version, definition hash
10. Load target objects with OCC version check
11. Re-evaluate preconditions against current state
12. Enforce agent policy
13. Enforce `mutableBy` write policy
14. Verify quotas and budget
15-23. Verify RBAC scopes, trust level, RLS, workspace isolation
24. Verify execution mode is present
25. Verify execution mode is valid
26. Verify execution mode matches action's current mode
27. Verify execution mode supports apply

After all checks pass: apply all effects atomically, write audit, mark plan as applied, persist idempotency result, commit. If any step fails, the entire transaction rolls back.

---

## Plan lifecycle

| State | Meaning | Can apply? |
|-------|---------|------------|
| `pending` | Created by dry-run, waiting | Yes (if not expired) |
| `applied` | Successfully applied, terminal | No |
| `revoked` | Explicitly cancelled | No |
| `expired` | TTL exceeded | No |

A plan is single-use:
- Same plan + same idempotency key = replay original result (safe)
- Same plan + different key = `PLAN_ALREADY_APPLIED`
- Different plan + same key = `PLAN_IDEMPOTENCY_CONFLICT`

---

## Plan TTL by risk level

| Risk level | Default TTL | Max TTL |
|------------|-------------|---------|
| `low` | 60 min | 60 min |
| `medium` | 15 min | 30 min |
| `high` | 5 min | 15 min |

Plans cannot be extended. An expired plan requires a new dry-run.

---

## Server-side policy

Each workspace has a policy document. The policy is a hard gate, not advisory.

| Policy rule | Effect |
|-------------|--------|
| `defaultMode` | read-only, dry-run, or live |
| `requireDryRunBeforeMutation` | Block direct apply without prior dry-run |
| `requireIdempotencyKey` | Every apply must carry a unique key |
| `forbidDelete` | No delete operations accepted |
| `allowedActions` | Whitelist of permitted action types |
| `maxObjectsTouched` | Max objects a single command can modify |
| `maxCostUnitsPerCommand` | DFU cap per command |

---

## Write policies (mutableBy)

Properties marked `mutableBy` can only be changed through declared actions:

```typescript
status: ContractStatus.default('draft')
  .mutableBy(['Contract.approve', 'Contract.reject']),
```

Direct writes to governed fields are rejected with `WRITE_POLICY_VIOLATION`.

---

## Actor binding

A plan can only be applied by the same effective actor who created it. If agent A on behalf of user Jane created the dry-run, only agent A on behalf of Jane can apply it.

---

## Idempotency

Every apply requires a unique idempotency key. This guarantees:
- No double-execution (network retry safety)
- Replay semantics (same key returns the original result)
- Conflict detection (different plan with same key = error)

```bash
dataforge actions run Contract.approve con_001 \
  --apply-plan <planId> \
  --plan-hash <hash> \
  --idempotency-key approve-con-001-$(date +%s) \
  --format json
```

---

## API protocol reference

When using the REST API directly (instead of the CLI), these exact request shapes apply.

### Idempotency-Key header

All POST endpoints require an `Idempotency-Key` header when authenticated with an API key. Without it, the server returns `POLICY_IDEMPOTENCY_REQUIRED` (HTTP 400).

```
POST /api/v1/actions/Contract.approve/dry-run
X-API-Key: df_...
X-Workspace-Id: <workspace-id>
Idempotency-Key: dryrun-contract-001-1715500000

{"targetId": "<instance-id>", "input": {"comment": "Approved"}}
```

### Dry-run request

```
POST /api/v1/actions/{actionKey}/dry-run
Content-Type: application/json
Idempotency-Key: <unique-key>

{"targetId": "<instance-id>", "input": {<action-specific fields>}}
```

Response includes `planId` and `planHash`.

### Verify request

After dry-run, verify the plan before applying. Both fields are required for `canApply: true`.

```
POST /api/v1/plans/{planId}/verify
Content-Type: application/json
Idempotency-Key: <unique-key>

{"riskAcknowledged": true, "confirmed": true}
```

### Apply (invoke) request

The apply body must contain **only** `planId` and `planHash`. Extra fields (such as `targetId` or `input`) are rejected with `APPLY_PLAN_INPUT_NOT_ALLOWED`.

```
POST /api/v1/actions/{actionKey}/invoke
Content-Type: application/json
Idempotency-Key: <unique-key>

{"planId": "<plan-id>", "planHash": "<sha256-hash>"}
```

---

## When apply fails

Every error includes `retryable` (boolean) and `remediation.summary`.

| Error | Exit code | Agent recovery |
|-------|-----------|----------------|
| `PLAN_EXPIRED` | 7 | Create a new dry-run |
| `PLAN_TARGET_VERSION_CONFLICT` | 7 | Re-query target, new dry-run |
| `PLAN_POLICY_MISMATCH` | 5 | Do not retry. Policy was updated. Re-authorize with workspace owner. |
| `PLAN_SCHEMA_MISMATCH` | 5 | Re-discover schema, new dry-run |
| `PLAN_ACTOR_MISMATCH` | 4 | Same effective actor must apply |
| `PLAN_ALREADY_APPLIED` | 7 | Plan consumed. New dry-run needed. |
| `WRITE_POLICY_VIOLATION` | 4 | Use the correct action |
| `ACTION_PRECONDITION_FAILED` | 10 | Re-query, check allowed actions |
| `QUOTA_EXCEEDED` | 11 | Stop. Surface to user. |
| `RATE_LIMITED` | 8 | Wait `retryAfterSeconds` |

---

## Threat model (design-level)

| Threat | Mitigation |
|--------|-----------|
| Agent invents API routes | CLI/SDK/capabilities manifest are the contract |
| Agent tries direct DB access | No credentials exposed. CLI/SDK only. |
| Agent mutates protected field | `mutableBy` rejects direct writes |
| Agent skips dry-run | Agent principals require signed plan |
| Agent replays old plan | TTL + versions + idempotency key |
| Data changed since dry-run | OCC version check at step 10 |
| Policy changed after dry-run | `PLAN_POLICY_MISMATCH` at step 9 |
| Prompt injection in data | Trust levels in context pack |
| API key leaked | Scoped, rotatable, audited, never in frontend |
| MCP extra power | Same scopes, same policies as CLI |
