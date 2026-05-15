# Use Case Improvement Report - 2026-05-12

## Scope

Objective: rerun the public BaaS use-case checks against staging, identify
false positives, and make the checks more reproducible.

Environment:

- Namespace: `dataforge-staging`
- Backend image: `registry.gitlab.com/quentin_gs-group/dataforge/backend:staging-a4e6960b22a7`
- Workspace: `3d522dc8-e603-4a3e-b311-0b111331a988`
- Backend pod used: `dataforge-backend-648d45795f-2gzl2`

## Results

| Check | Result |
|---|---|
| Baseline public use cases | `PASS=203 FAIL=0 GAP=0` |
| Extended use cases before fix | `PASS=256 FAIL=0 GAP=1` |
| V1.1 edge/proof suite | `PASS=36 FAIL=0 GAP=0` |
| Plan-proof smoke | `pass=14 fail=0` |
| Extended use cases after fix | `PASS=257 FAIL=0 GAP=0` |
| Contract approval doc runbook after fix | `PASS=13 FAIL=0 GAP=0` |
| Local CLI package tests after unblock | `26 files / 424 tests passed` |
| Local CLI contract-approval runbook | `applied, final status=approved` |

## Finding Resolved

### GAP: `verb/graph-neighbors/refund`

The extended script looked for an existing `refund_request` instance with an
edge in `projections.graph_edges`. On 2026-05-12 staging had no such residual
fixture, so the script reported:

```text
GAP verb/graph-neighbors/refund -- no refund_request instance with edges found
```

The V1.1 edge suite passed immediately after, so the runtime graph path was not
broken. The issue was the test relying on pre-existing staging data.

Fix: `tests/scripts/public-usecases-extended-check.js` now creates a
`refund_request` instance, a linked contract fixture, and a `graph_edges` row
inside the run before calling `GET /api/v1/graph/neighbors/:id`.

Validated result:

```text
PASS verb/graph-neighbors/refund -- HTTP 200, neighbors=1
PASS=257 FAIL=0 GAP=0
```

### GAP: `contract-approval` final state check

The documented final verification used:

```bash
dataforge query contract --filter-json '{"id":{"eq":"<contractId>"}}' --format json
```

Runtime validation showed this returns `count=0` for the approved instance,
because the query filter targets object data fields, not the instance id.

Fix: `contract-approval.md` now verifies the final object with:

```bash
dataforge instance get <contractId> --format json
```

The runbook was also aligned with the CLI plan contract:

- `plan inspect` uses `--plan-format markdown`.
- `plan verify` includes `--risk-acknowledged --confirmed`.

Validated result:

```text
PASS doc step 9: final state by instance get -- status=approved
PASS regression guard: id filter is not instance lookup -- HTTP 200 count=0
PASS=13 FAIL=0 GAP=0
```

### Cross-doc CLI flag drift

The public examples reused `dataforge plan inspect <planId> --format markdown`.
The CLI exposes `--plan-format <fmt>` for plan rendering; global `--format`
controls the output envelope. Public runbooks and examples now use:

```bash
dataforge plan inspect <planId> --plan-format markdown
```

### Local CLI execution unblock

The local CLI initially failed before any HTTP request because
`sdk/packages/cli/node_modules/commander` pointed to an empty pnpm package
target. A full `pnpm install` from `sdk/` is currently blocked by stale
workspace aliases: several packages still depend on `@dataforge/sdk-client` or
`@dataforge/sdk-types` with `workspace:*`, while the local packages are now
named `@ontologie/sdk-client` and `@ontologie/sdk-types`.

Fix for the public-doc iteration loop:

- Restored `sdk/packages/cli/node_modules` with `npm install --workspaces=false`
  in the CLI package.
- Rebuilt the CLI from the current source, where `registerAllCommands` avoids
  reconfiguring Commander after global options have already been registered.
- Verified from the repository root:
  `node sdk/packages/cli/dist/cli.js --help`.
- Verified from TypeScript source:
  `npx tsx sdk/packages/cli/src/cli.ts --help`.
- Ran the CLI package test suite:
  `26` files, `424` tests passed.

The local CLI then executed the `contract-approval` runbook against staging:

```text
whoami status=ok
context pack HTTP OK
schema describe OK
actions run Contract.approve --dry-run OK
plan inspect --plan-format markdown OK
plan verify --risk-acknowledged --confirmed OK after one dry-run retry
actions run Contract.approve --apply-plan OK
instance get status=approved version=2
```

Open follow-up from the CLI run:

- Windows PowerShell strips inline JSON quotes for `--input-json`; docs or CLI
  parsing need a Windows-safe path.
- `--input "comment=..."` avoids the quoting error, but the dry-run artifact
  still showed `body.inputs: {}` for `Contract.approve`.

## Commands Executed

```bash
node --check tests/scripts/public-usecases-staging-check.js
node --check tests/scripts/public-usecases-extended-check.js
node --check tests/scripts/v11-usecase-edges-staging-check.js
node --check tests/scripts/v11-plan-proof-staging-smoke.js

kubectl cp tests/scripts/public-usecases-staging-check.js dataforge-staging/dataforge-backend-648d45795f-2gzl2:/tmp/public-usecases-staging-check.js -c backend
kubectl cp tests/scripts/public-usecases-extended-check.js dataforge-staging/dataforge-backend-648d45795f-2gzl2:/tmp/public-usecases-extended-check.js -c backend
kubectl cp tests/scripts/v11-usecase-edges-staging-check.js dataforge-staging/dataforge-backend-648d45795f-2gzl2:/tmp/v11-usecase-edges-staging-check.js -c backend
kubectl cp tests/scripts/v11-plan-proof-staging-smoke.js dataforge-staging/dataforge-backend-648d45795f-2gzl2:/tmp/v11-plan-proof-staging-smoke.js -c backend

kubectl exec dataforge-backend-648d45795f-2gzl2 -n dataforge-staging -c backend -- env NODE_PATH=/app/node_modules node /tmp/public-usecases-staging-check.js
kubectl exec dataforge-backend-648d45795f-2gzl2 -n dataforge-staging -c backend -- env NODE_PATH=/app/node_modules node /tmp/public-usecases-extended-check.js
kubectl exec dataforge-backend-648d45795f-2gzl2 -n dataforge-staging -c backend -- env NODE_PATH=/app/node_modules node /tmp/v11-usecase-edges-staging-check.js
kubectl exec dataforge-backend-648d45795f-2gzl2 -n dataforge-staging -c backend -- env NODE_PATH=/app/node_modules node /tmp/v11-plan-proof-staging-smoke.js

node --check tests/scripts/public-doc-contract-approval-check.js
kubectl cp tests/scripts/public-doc-contract-approval-check.js dataforge-staging/dataforge-backend-57c5db9b4-7m9mh:/tmp/public-doc-contract-approval-check.js
kubectl exec dataforge-backend-57c5db9b4-7m9mh -n dataforge-staging -- env NODE_PATH=/app/node_modules node /tmp/public-doc-contract-approval-check.js
```

## Side Observation

`npm run baas:commercialisation:static` currently returns `VERDICT NO_GO STATIC`
because the static gate still expects production `STRIPE_ENABLED: "false"`
unless `BILLING_PROD_STRIPE_ENABLE_APPROVED=true` is set. The repository now
contains commit `cf7d87627` (`ops(billing): enable Stripe in production`) and
the production ConfigMap has `STRIPE_ENABLED: "true"`.

This is separate from the public use-case runtime checks, which are green.
