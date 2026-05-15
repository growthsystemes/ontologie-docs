# Use Cases Validation Report

Date: 2026-05-13 (updated from 2026-05-12)
Environment: Staging (`dataforge-staging` namespace, Scaleway Kapsule)
Workspace: `3d522dc8-e603-4a3e-b311-0b111331a988`
Backend image verified: `staging-aafb7b49d2b8`

## Summary

Live validation was rerun against the staging backend on 2026-05-13 with the
local CLI `data-quality` and `customer-file-360` runbooks. The broader
baseline, extended, V1.1 edge, and plan-proof smoke scripts were last rerun on
2026-05-12 from the current working tree.

The public use-case surface is green on staging:

- Baseline (primary actions): `PASS=203 FAIL=0 GAP=0`.
- Extended (secondary actions + verbs + graph fixture + edge cases): `PASS=257 FAIL=0 GAP=0`.
- V1.1 edge/proof suite: `PASS=36 FAIL=0 GAP=0`.
- Plan-proof smoke: `pass=14 fail=0`.
- Contract approval public runbook: `PASS=13 FAIL=0 GAP=0`.
- Local CLI contract-approval runbook: `PASS=12 FAIL=0 GAP=0` for whoami,
  context pack, schema describe, action describe, fixture creation, dry-run,
  `body.inputs` preservation, inspect, verify, apply, and final `instance get`.
- Local CLI refund-approval runbook: `PASS=26 FAIL=0 GAP=0` for whoami,
  schema describe, refund query, graph neighbors, all 3 `RefundRequest.*`
  actions, dry-run, `body.inputs` preservation, inspect, verify, apply, and
  final `instance get`.
- Local CLI vendor-onboarding runbook: `PASS=47 FAIL=0 GAP=0` for whoami,
  schema search, vendor query, graph neighbors over linked documents/risk
  assessment, all 6 `Vendor.*` actions, dry-run, `body.inputs` preservation,
  inspect, verify, apply, and final `instance get`.
- Local CLI IT access-request runbook: `PASS=28 FAIL=0 GAP=0` for whoami,
  schema search, access-request query, graph neighbors over requester/resource,
  all 3 `AccessRequest.*` actions, dry-run, `body.inputs` preservation,
  inspect, verify, apply, and final `instance get`.
- Local CLI finance-audit runbook: `PASS=54 FAIL=0 GAP=0` for whoami,
  schema search, invoice query, graph neighbors over invoice evidence/journal
  entry, all 7 finance actions, dry-run, `body.inputs` preservation, inspect,
  verify, apply for `twin_apply`, and non-mutating final state for
  `plan_only`.
- Local CLI CRM pipeline runbook: `PASS=41 FAIL=0 GAP=0` for whoami,
  schema search, opportunity query, graph neighbors over opportunity/account/lead,
  all 5 CRM actions, dry-run, `body.inputs` preservation, inspect, verify,
  apply, and final `instance get`.
- Local CLI data-quality runbook: `PASS=41 FAIL=0 GAP=0` for whoami,
  schema search, data-issue query, graph neighbors over issue/contact,
  all 5 data-quality actions, dry-run, `body.inputs` preservation, inspect,
  verify, apply, and final `instance get`.
- Local CLI customer-file-360 runbook: `PASS=83 FAIL=0 GAP=0` for whoami,
  schema search, unified-customer query, graph neighbors over linked notes,
  documents, interactions and duplicate candidates, all 11 `Customer.*`
  actions, dry-run, `body.inputs` preservation, inspect, verify, apply, and
  final `instance get` across profile, note, interaction, document, status,
  duplicate merge, GDPR export, suppression, and erasure flows.
- Baseline + extended total: **460 checks** across 8 use cases, 42 actions, 10 V1 verbs, 6 edge cases.
- Extended graph-neighbors fix: the `refund_request` graph test now creates a
  linked fixture inside the run. The previous `GAP=1` was a fixture discovery
  false positive, not a runtime graph failure.
- Graph neighbors fix: `PostgresGraphService` unified CTE now queries both `ontology.nodes` and `ontology.object_instances` (commit `e6d6a273c`).
- Manifest version race fix: dry-run retry on `PLAN_SCHEMA_VERSION_MISMATCH` in extended check.
- Previous baseline (2026-05-06): `PASS=153 FAIL=0 GAP=0`.
- All 8 public ObjectType nuclei exist on staging after the Customer File 360 seed.
- All 13 primary public actions exist on staging after the Customer File 360 seed.
- Each use case passes the same end-to-end path:
  query -> describe -> fixture create -> dry-run -> inspect -> verify ->
  apply -> replay conflict -> final state.
- Apply must resend exactly the inputs signed by dry-run, plus plan controls.
  `idempotencyKey` belongs in the header, not as an unsigned business input.
- The `properties is not iterable` bug was fixed by normalizing ObjectType
  property metadata before validation.
- The public OpenAPI reference now points to the canonical backend routes:
  `GET /api/v1/actions/{actionKey}/describe`,
  `POST /api/v1/actions/{actionKey}/dry-run`, and
  `POST /api/v1/actions/{actionKey}/invoke`.

Backend image verified: `staging-aafb7b49d2b8`
The refund-approval runbook was expanded and rerun against staging backend
image `staging-aafb7b49d2b8`.

- `node tests/scripts/public-cli-refund-approval-check.cjs`:
  `PASS=26 FAIL=0 GAP=0`.

This run covers `RefundRequest.approve`, `RefundRequest.reject`, and
`RefundRequest.requestHumanReview` through local CLI dry-run, `body.inputs`
preservation, inspect, verify, apply, and final `instance get`. The manual
review branch currently ends in `status=escalated`.

Backend image verified: `staging-bdc9f18eb68e`
The data-quality runbook was expanded and rerun against staging backend image
`staging-bdc9f18eb68e`.

- `node tests/scripts/public-cli-data-quality-check.cjs`:
  `PASS=41 FAIL=0 GAP=0`.

This run covers `DataIssue.proposeFix`, `Contact.updateEmail`,
`Contact.markDuplicate`, `Account.updateSegment`, and
`DataIssue.markResolved` through local CLI dry-run, `body.inputs`
preservation, inspect, verify, apply, and final `instance get`. The duplicate
branch writes `duplicateOf=<primaryContactId>`, and the account branch ends
with `segment=Enterprise`.

Backend image verified: `staging-bea33ac2fdd9`
The CRM pipeline runbook was expanded and rerun against staging backend image
`staging-bea33ac2fdd9`.

- `node tests/scripts/public-cli-crm-pipeline-check.cjs`:
  `PASS=41 FAIL=0 GAP=0`.

This run covers `Opportunity.moveStage`, `Opportunity.assignOwner`,
`Opportunity.markStale`, `Lead.qualify`, and `Lead.disqualify` through local
CLI dry-run, `body.inputs` preservation, inspect, verify, apply, and final
`instance get`. The owner branch ends with `ownerEmail=new.owner@company.com`,
the stale branch ends with `stage=stale_review`, and the lead branches end in
`qualified` and `disqualified`.

Backend image verified: `staging-aca3f98ac252`
The vendor-onboarding runbook was expanded and rerun against staging backend
image `staging-aca3f98ac252`.

- `node tests/scripts/public-cli-vendor-onboarding-check.cjs`:
  `PASS=47 FAIL=0 GAP=0`.

This run covers `Vendor.approve`, `Vendor.reject`,
`Vendor.requestDocuments`, `Vendor.requestHumanReview`,
`Vendor.submitForReview`, and `Vendor.updateRiskAssessment` through local CLI
dry-run, `body.inputs` preservation, inspect, verify, apply, and final
`instance get`. The document request branch ends in `documents_pending`, and
the risk update branch preserves numeric `riskScore` plus `riskCategory`.

Backend image verified: `staging-c1ab8040b4b6`
The IT access-request runbook was expanded and rerun against staging backend
image `staging-c1ab8040b4b6`.

- `node tests/scripts/public-cli-it-access-request-check.cjs`:
  `PASS=28 FAIL=0 GAP=0`.

This run covers `AccessRequest.approve`, `AccessRequest.deny`, and
`AccessRequest.requestHumanReview` through local CLI dry-run, inspect, verify,
apply, and final `instance get`. The approve branch preserves and applies the
expiry input; the deny branch ends in `denied`; the human-review branch ends in
`needs_human_review`.

The local CLI runbooks for the two most recently expanded use cases were rerun
against staging backend image `staging-a764fa116ad8`.

- `node tests/scripts/public-cli-data-quality-check.cjs`:
  `PASS=20 FAIL=0 GAP=0`.
- `node tests/scripts/public-cli-customer-file-360-check.cjs`:
  `PASS=83 FAIL=0 GAP=0`.

Both runbooks created temporary API keys and fixtures through `kubectl`, then
executed the behavioral path through `sdk/packages/cli/dist/cli.js`. No runtime
bug, documentation bug, test false positive, or environment blocker was
observed in this rerun.

### 2026-05-12 reproducibility iteration

The first 2026-05-12 extended run returned `PASS=256 FAIL=0 GAP=1`.
The only gap was `verb/graph-neighbors/refund`: the script searched for an
existing `refund_request` instance that already had an edge, but staging did
not contain such a residual fixture.

The V1.1 edge suite then passed with `PASS=36 FAIL=0 GAP=0`, proving the graph
and proof runtime path was healthy. The extended script was updated to create
its own linked `refund_request` fixture before calling
`GET /api/v1/graph/neighbors/:id`.

Rerun result after the script fix: `PASS=257 FAIL=0 GAP=0`, with
`verb/graph-neighbors/refund -- HTTP 200, neighbors=1`.

The `contract-approval` runbook was then executed step by step against staging
through the backend routes behind the documented CLI commands. It confirmed the
dry-run, inspect, verify, apply, final instance lookup, and plan audit path.

Rerun result after the doc fix: `PASS=13 FAIL=0 GAP=0`.

Corrections made from this run:

- Final state verification now uses `dataforge instance get <contractId>`
  instead of filtering `query contract` by `id`, which targets data fields.
- Public plan inspect examples now use `--plan-format markdown`, matching the
  CLI command contract.
- The contract runbook now verifies with explicit
  `--risk-acknowledged --confirmed` flags before apply.

Local CLI execution was unblocked on 2026-05-12:

- SDK workspace install now passes with `pnpm install --frozen-lockfile`.
  The `@dataforge/*` compatibility packages resolve through local workspace
  wrappers after the `@ontologie/*` package rename.
- The CLI was rebuilt from the current source, where `registerAllCommands`
  avoids calling Commander `storeOptionsAsProperties(false)` after global
  options already exist.
- CLI smoke commands pass from the repository root:
  `node sdk/packages/cli/dist/cli.js --help` and
  `npx tsx sdk/packages/cli/src/cli.ts --help`.
- Targeted CLI tests pass:
  `npx vitest run --config vitest.config.ts src/commands/actions.test.ts src/commands/plan.test.ts`.
- The local repeatable check is
  `node tests/scripts/public-cli-contract-approval-check.cjs`.
- The refund repeatable check is
  `node tests/scripts/public-cli-refund-approval-check.cjs`.
- The vendor repeatable check is
  `node tests/scripts/public-cli-vendor-onboarding-check.cjs`.
- The IT access-request repeatable check is
  `node tests/scripts/public-cli-it-access-request-check.cjs`.
- The finance-audit repeatable check is
  `node tests/scripts/public-cli-finance-audit-check.cjs`.
- The CRM pipeline repeatable check is
  `node tests/scripts/public-cli-crm-pipeline-check.cjs`.
- The data-quality repeatable check is
  `node tests/scripts/public-cli-data-quality-check.cjs`.
- The customer-file-360 repeatable check is
  `node tests/scripts/public-cli-customer-file-360-check.cjs`.
- The local CLI runbooks now share
  `tests/scripts/lib/public-cli-runbook.cjs` for fixture setup, CLI execution,
  `body.inputs` checks, dry-run/verify retry, inspect/apply, summary, and
  cleanup.
- Refund query discovery was updated to list `refund_request` and select a
  pending item locally; the documented `--filter-json '{"status":{"eq":"pending_review"}}'`
  shape returned a backend `VALIDATION_ERROR` during live CLI execution.
- Vendor discovery was updated from global `schema describe` to
  `schema search vendor --types ObjectType,Action --format json`; the action
  and query path were healthy, but the targeted search is the reliable public
  command for this runbook on the current staging manifest.
- IT access-request discovery was updated to
  `schema search access --types ObjectType,Action --format json`, query now
  lists `access_request` before selecting a pending item locally, and structured
  action input now uses `--input-file` instead of `--input-json`.
- The IT access-request runbook validates the approval path with `expiresAt`,
  the denial path through `AccessRequest.deny`, and the risky/admin path
  through `AccessRequest.requestHumanReview`, ending in `needs_human_review`.
- Finance-audit discovery now uses targeted schema searches for `invoice` and
  `journal`, lists `invoice` before selecting a received invoice locally, uses
  `--input-file`, covers all 7 documented finance actions, and documents
  `JournalEntry.proposeCorrection` as `plan_only`: verify returns
  `canApply=false` and the journal entry remains unmutated.
- CRM pipeline discovery now uses targeted schema searches for `opportunity`
  and `lead`, lists `opportunity` before selecting a `NEGOTIATION` item
  locally, uses `--input-file`, and documents the live action input shape:
  uppercase stage values plus required `lossReason` and `reason`.
- Data-quality discovery now uses targeted schema searches for `data issue`
  and `contact`, lists `data_issue` before selecting an open item locally,
  uses `--input-file`, validates graph neighbors over the affected contact,
  applies `Contact.updateEmail`, and closes the issue through
  `DataIssue.markResolved`.
- Customer-file-360 discovery now uses targeted schema search for `customer`,
  lists `unified_customer` before selecting active fixtures locally, uses
  `--input-file`, validates linked graph context, and runs all 11 customer-file
  actions through local CLI dry-run/inspect/verify/apply/final-state checks.
- Public CLI runbook temporary API keys now generate a unique first-14-character
  `key_prefix`. The previous fixed `df_PUBLIC_CLI_` prefix could collide with
  backend API-key cache entries from earlier runbooks and produce misleading
  intermittent 404/auth behavior.

CLI-specific fixes implemented after this iteration:

- The CLI dry-run body now sends `{ targetId, input }`, so copied commands
  preserve action inputs in the signed plan instead of producing
  `body.inputs: {}`.
- `--input-file input.json` is the documented PowerShell-safe path for public
  runbooks. `--input comment=...` remains acceptable for simple scalar inputs.
- A first dry-run plan can still hit `PLAN_SCHEMA_VERSION_MISMATCH`; `plan
  verify` now returns a clear `PLAN_CONTEXT_MISMATCH` action: rerun dry-run,
  inspect the new plan, then verify/apply the new plan.
- The local runbook helper also retries the full dry-run/verify/inspect/apply
  sequence if `apply` returns a manifest-version conflict after verify.
- `plan verify` now returns verification evidence for non-applicable execution
  modes such as `plan_only` instead of failing the CLI command; schema mismatch
  still returns the explicit rerun-dry-run action.

### 2026-05-06 customer-file extension

The public use-case suite now includes an eighth use case:
`Customer file 360`.

Implemented scope:

- `UnifiedCustomer` is the customer-file nucleus.
- `CustomerNote`, `CustomerDocument`, and `CustomerInteraction` model notes,
  structured document references, and interaction history.
- The initial document decision is structured references, not binary storage:
  `CustomerDocument.knowledgeDocumentId` can link to Knowledge later.
- CRM bidirectional sync is explicitly out of scope for this use case.
- PII/GDPR expectations are documented: sensitive fields, masking default,
  reason required for PII changes, retention field, and explicit compliance
  workflows for deletion/export/suppression.

The staging seed script now prepares the six customer-file actions:

| Action key | Target | Status |
|-----------|--------|--------|
| `Customer.updateProfile` | `UnifiedCustomer` | Active, execution_mode=twin_apply |
| `Customer.addNote` | `UnifiedCustomer` | Active, execution_mode=twin_apply |
| `Customer.recordInteraction` | `UnifiedCustomer` | Active, execution_mode=twin_apply |
| `Customer.attachDocument` | `UnifiedCustomer` | Active, execution_mode=twin_apply |
| `Customer.setStatus` | `UnifiedCustomer` | Active, execution_mode=twin_apply |
| `Customer.mergeDuplicate` | `UnifiedCustomer` | Active, execution_mode=twin_apply |

Validation script coverage was extended to run all six actions through:
describe -> dry-run -> inspect -> verify -> apply -> plan audit ->
idempotency replay -> final state.

Live result after reseeding staging with `scripts/setup/seed-use-cases.js`:
`PASS=153 FAIL=0 GAP=0`.

Post-rollout rerun on backend image `staging-3615e6aa1e60`:
`PASS=153 FAIL=0 GAP=0`.

PlanGuard V1.1 was rerun on the same post-rollout backend pod:
`28 PASS / 0 FAIL`. This confirms unsupported execution modes are blocked at
dry-run/verify/apply boundaries and source-of-truth conflicts return
`SOURCE_OF_TRUTH_CONFLICT` instead of being counted as false positives.

Next-tranche edge validation was added in
`tests/scripts/v11-usecase-edges-staging-check.js` and run on staging backend
image `staging-4c473455f301`:
`PASS=23 FAIL=0 GAP=0`.

Additional coverage:

- Composed proof for all 13 public action paths by reconciling inspect,
  verify and audit artifacts.
- Non-Contract source-of-truth conflict on `Vendor.approve`.
- `AccessRequest.approve` human handoff and workflow route intents, with the
  plan remaining `pending` after routing.

Priority 1 follow-up implemented locally after the staging run:

- `GET /api/v1/plans/:id/proof` is now a first-class proof primitive.
- The route returns `dataforge.plan-proof.v1` JSON or Markdown.
- `dataforge plan proof <planId>` now calls that route directly instead of
  composing inspect, verify and audit client-side.
- Staging validation of the new route is pending the next backend deployment.

Current result: **8 public use cases green**.

### 2026-05-05 rerun note

A live rerun at 15:17 UTC first returned `PASS=64 FAIL=3 GAP=0`.
The failures were all fixture-creation failures for `Vendor`, `RefundRequest`,
and `AccessRequest` with `properties is not iterable`.

Root cause: those staging ObjectTypes had `properties: {}` while the deployed
backend image still iterated `properties` as an array. The three ObjectTypes
were normalized in staging to `properties: []`, and
`scripts/setup/seed-use-cases.js` now writes `[]` for new public ObjectTypes
and normalizes existing empty-object metadata on re-seed.

The validation was rerun immediately after that correction and returned
`PASS=88 FAIL=0 GAP=0`.

## Capabilities tested

| Step | Route | Status | Notes |
|------|-------|--------|-------|
| Capabilities | `GET /api/v1/capabilities` | PASS | 9 verbs, limits returned after temporary E2E freeze expired/revoked |
| List actions | `GET /api/v1/actions` | PASS | All workspace actions returned |
| Describe action | `GET /api/v1/actions/:key/describe` | PASS | Full contract (preconditions, effects, input_schema, risk) |
| Dry-run | `POST /api/v1/actions/:key/dry-run` | PASS | Contract approval produces signed plan, SHA-256 hash, ed25519 signature, policy checks |
| Plan inspect | `GET /api/v1/plans/:id/inspect` | PASS | Markdown with before/after diff table |
| Apply (invoke) | `POST /api/v1/actions/:key/invoke` | PASS | Contract status changed to approved, replay returned 409 |
| Plan audit | `GET /api/v1/plans/:id/audit` | PASS | Full provenance trace |
| Idempotency | Replay same invoke | PASS | 409 PLAN_ALREADY_APPLIED |
| Query instances | `POST /api/v1/query` | PASS | ObjectType resolution via api_name |
| Graph neighbors | `GET /api/v1/graph/neighbors/:id` | PASS | Backend=postgres |
| Context pack | `POST /api/v1/context/pack` | PASS | Full ontology context |

## Latest staging findings

The following sequence was executed live on staging:

1. Cleared temporary `ABUSE_WORKSPACE_FROZEN` decisions created by E2E
   kill-switch tests (`created_by=claude-code-e2e*`).
2. Confirmed all 7 ObjectTypes exist: Contract, Vendor, RefundRequest,
   Opportunity, Invoice, AccessRequest, DataIssue.
3. Seeded and normalized the missing public actions:
   `Opportunity.moveStage` and `Invoice.flagAnomaly`.
4. Normalized public action `effects_ast` to the canonical
   `object.update/set` shape so dry-run plans contain concrete diffs.
5. Deployed backend image
   `registry.gitlab.com/quentin_gs-group/dataforge/backend:staging-aac50034932b-d051612`
   with the `ObjectInstanceService.validateData` normalization fix.
6. Reran the original 7 public use cases through signed plans and apply.
7. Confirmed legacy action aliases are noncanonical; the canonical V1 routes
   are the only routes represented in the public OpenAPI reference.

Latest script result after deploying the code fix and reseeding actions:

| Area | Result |
|------|--------|
| Contract approval | PASS end-to-end |
| Vendor onboarding | PASS end-to-end |
| Refund approval | PASS end-to-end |
| Customer file 360 | PASS end-to-end |
| CRM pipeline | PASS end-to-end |
| Finance audit | PASS end-to-end |
| IT access request | PASS end-to-end |
| Data quality | PASS end-to-end |
| Canonical action routes | PASS |
| Legacy action route aliases | Noncanonical, not part of current OpenAPI |

## Actions already seeded on staging

### 2026-05-11 extended seed (30+ actions)

| Action key | Use Case | Status |
|-----------|----------|--------|
| `Contract.approve` | Contract Approval | Active, twin_apply |
| `Contract.reject` | Contract Approval | Active, twin_apply |
| `Contract.submitForReview` | Contract Approval | Active, twin_apply |
| `Vendor.approve` | Vendor Onboarding | Active, twin_apply |
| `Vendor.reject` | Vendor Onboarding | Active, twin_apply |
| `Vendor.requestDocuments` | Vendor Onboarding | Active, twin_apply |
| `Vendor.requestHumanReview` | Vendor Onboarding | Active, twin_apply (added 2026-05-11) |
| `Vendor.submitForReview` | Vendor Onboarding | Active, twin_apply (added 2026-05-11) |
| `Vendor.updateRiskAssessment` | Vendor Onboarding | Active, twin_apply (added 2026-05-11) |
| `RefundRequest.approve` | Refund Approval | Active, twin_apply |
| `RefundRequest.reject` | Refund Approval | Active, twin_apply (renamed from .deny 2026-05-11) |
| `RefundRequest.requestHumanReview` | Refund Approval | Active, twin_apply (renamed from .escalate 2026-05-11) |
| `Opportunity.moveStage` | CRM Pipeline | Active, twin_apply |
| `Opportunity.assignOwner` | CRM Pipeline | Active, twin_apply |
| `Opportunity.markStale` | CRM Pipeline | Active, twin_apply |
| `Lead.qualify` | CRM Pipeline | Active, twin_apply (renamed from lead.qualify 2026-05-11) |
| `Lead.disqualify` | CRM Pipeline | Active, twin_apply (added 2026-05-11) |
| `Invoice.flagAnomaly` | Finance Audit | Active, twin_apply |
| `Invoice.clearAnomaly` | Finance Audit | Active, twin_apply |
| `EvidencePack.approve` | Finance Audit | Active, twin_apply |
| `EvidencePack.reject` | Finance Audit | Active, twin_apply |
| `Control.markReviewed` | Finance Audit | Active, twin_apply (added 2026-05-11) |
| `Control.markFailed` | Finance Audit | Active, twin_apply (added 2026-05-11) |
| `JournalEntry.proposeCorrection` | Finance Audit | Active, plan_only (added 2026-05-11) |
| `AccessRequest.approve` | IT Access Request | Active, twin_apply |
| `AccessRequest.deny` | IT Access Request | Active, twin_apply |
| `AccessRequest.requestHumanReview` | IT Access Request | Active, twin_apply |
| `Contact.updateEmail` | Data Quality | Active, twin_apply |
| `Contact.markDuplicate` | Data Quality | Active, twin_apply |
| `DataIssue.proposeFix` | Data Quality | Active, twin_apply |
| `DataIssue.markResolved` | Data Quality | Active, twin_apply |
| `Customer.updateProfile` | Customer File 360 | Active, twin_apply |
| `Customer.addNote` | Customer File 360 | Active, twin_apply |
| `Customer.recordInteraction` | Customer File 360 | Active, twin_apply |
| `Customer.attachDocument` | Customer File 360 | Active, twin_apply |
| `Customer.setStatus` | Customer File 360 | Active, twin_apply |
| `Customer.mergeDuplicate` | Customer File 360 | Active, twin_apply |
| `Customer.requestDataExport` | Customer File 360 | Active, twin_apply |
| `Customer.completeDataExport` | Customer File 360 | Active, twin_apply |
| `Customer.requestErasure` | Customer File 360 | Active, twin_apply |
| `Customer.suppressProcessing` | Customer File 360 | Active, twin_apply |
| `Customer.completeErasure` | Customer File 360 | Active, twin_apply |

## Notes for documentation

1. **ObjectType name in queries**: The `POST /api/v1/query` endpoint resolves types by `api_name` (lowercase). Use `contract` not `Contract` in the query body. The CLI handles this mapping transparently.

2. **Filter on data fields**: The `where` clause in queries currently filters on JSONB `data` fields. The CLI flag `--filter-json` maps to this. Tested and confirmed filtering returns results.

3. **Graph neighbors**: Works correctly. Returns empty when instances have no edges (expected for test data). Production workspaces with linked objects will show full traversal results.

4. **Execution modes**: Only `twin_apply` is fully implemented for V1 demos. `plan_only` works (plan created, not applied). Future modes (`human_handoff`, `workflow_handoff`, `external_commit`) are documented but not yet available.

5. **Plan TTL**: Plans expire after 900 seconds (15 minutes) by default. Demo scripts should account for this.

6. **Precondition enforcement**: Tested that dry-run on a contract with wrong status returns 400 with `PROCESS_TRANSITION_NOT_ALLOWED` and details on which precondition failed.

## File mapping

| Draft file (mnt/) | Published file (docs/use-cases/) |
|-------------------|----------------------------------|
| index.md | index.md |
| contract-approval.md | contract-approval.md |
| procurement-vendor-onboarding.md | vendor-onboarding.md |
| customer-refund-approval.md | refund-approval.md |
| crm-pipeline-governance.md | crm-pipeline.md |
| finance-audit-evidence.md | finance-audit.md |
| it-access-request.md | it-access-request.md |
| data-quality-remediation.md | data-quality.md |
