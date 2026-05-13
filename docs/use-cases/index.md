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

## Start here

**[Contract approval](./contract-approval.md)** is the canonical use case. It includes an executable demo you can run locally in under 5 minutes, the full model, agent task card, expected plan output, failure cases, and validation primitives.

Read it first. The reference cards below show how the same pattern applies to other domains.

---

## Reference cards

| Use case | Domain | Actions | Template | Distinguishing feature |
|----------|--------|---------|----------|----------------------|
| [Vendor onboarding](./vendor-onboarding.md) | Procurement | 5 | `vendor-risk` | Document checks, linked risk assessments |
| [Customer refund](./refund-approval.md) | Support / Finance | 3 | -- | Amount policies, linked orders |
| [CRM pipeline](./crm-pipeline.md) | Revenue ops | 5 | -- | Multi-object (`maxObjectsTouched: 20`), bulk awareness |
| [Finance audit](./finance-audit.md) | Finance / Audit | 7 | -- | `plan_only` mode (proposals without mutation) |
| [IT access request](./it-access-request.md) | IT / Security | 3 | -- | Expiry rules, risk tier routing |
| [Data quality](./data-quality.md) | Operations / Data | 5 | -- | Two-step: correct then resolve |
| [Customer file 360](./customer-file-360.md) | Customer ops | 11 | -- | PII, GDPR, multi-step erasure workflow |

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
dataforge actions run <key> <id> \
  --input-file input.json --dry-run              # Create a signed plan
dataforge plan inspect <planId> --plan-format markdown # Inspect the plan
dataforge actions run <key> <id> \
  --apply-plan <planId> \
  --plan-hash <hash> \
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

---

## Protocol notes

### Idempotency

All POST mutations require an `Idempotency-Key` header when using API key auth.
The CLI and SDK generate this automatically. Direct API consumers must provide it:

```
Idempotency-Key: approve-contract-<contractId>-001
```

### Apply protocol

When applying a plan via `POST /api/v1/actions/{actionKey}/invoke`, the body must contain **only** the plan reference:

```json
{ "planId": "...", "planHash": "..." }
```

Do not include `targetId`, `input`, or other fields — the backend rejects them with `APPLY_PLAN_INPUT_NOT_ALLOWED`. All inputs were already signed during the dry-run.

### Verify protocol

The verify step (`POST /api/v1/plans/{planId}/verify`) requires explicit confirmation:

```json
{ "riskAcknowledged": true, "confirmed": true }
```

Without these flags, the response may return `canApply: false`.

If verify returns `PLAN_CONTEXT_MISMATCH` with
`PLAN_SCHEMA_VERSION_MISMATCH`, the manifest changed after dry-run. Rerun the
dry-run command, inspect the new plan, then verify and apply that new plan.

### Action input on Windows

For copied runbook commands, prefer `--input-file input.json`. It avoids native
PowerShell quoting differences for inline JSON. For simple scalar inputs,
`--input comment="Budget verified"` is also safe. Use `--input-json` only when
the shell is known to pass JSON quotes unchanged.
