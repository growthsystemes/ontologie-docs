# Use Case Improvement Report — 2026-05-11

## Final Results

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Baseline (primary actions) | PASS=153 FAIL=0 GAP=0 | PASS=203 FAIL=0 GAP=0 | +50 checks |
| Extended (secondary + verbs + edges) | PASS=164 FAIL=2 GAP=14 | PASS=258 FAIL=0 GAP=0 | +94 PASS, -2 FAIL, -14 GAP |
| **Total** | **317** | **461** | **+144 checks** |
| Date | 2026-05-11 | 2026-05-11 | — |
| Workspace | `3d522dc8-e603-4a3e-b311-0b111331a988` | — | — |

## Scorecard

| Use Case | Primary | Secondary Actions | Verbs | Edge Cases | Score |
|----------|---------|-------------------|-------|------------|-------|
| Contract Approval | 3/3 | reject OK, submitForReview OK | 9/9 | precondition OK, hash OK | GREEN |
| Vendor Onboarding | 2/2 | reject OK, requestDocuments OK, requestHumanReview OK, submitForReview OK, updateRiskAssessment OK | — | — | GREEN |
| Refund Approval | 2/2 | reject OK, requestHumanReview OK | — | — | GREEN |
| CRM Pipeline | 2/2 | assignOwner OK, markStale OK, Lead.qualify OK, Lead.disqualify OK | — | graph GAP | GREEN |
| Finance Audit | 2/2 | clearAnomaly OK, EvidencePack.approve OK, EvidencePack.reject OK, Control.markReviewed OK, Control.markFailed OK, JournalEntry.proposeCorrection OK (plan_only) | — | — | GREEN |
| IT Access Request | 2/2 | deny OK, requestHumanReview OK | — | — | GREEN |
| Data Quality | 3/3 | markDuplicate OK, proposeFix OK, markResolved OK | — | — | GREEN |
| Customer File 360 | 11/11 | (all 11 GDPR actions tested in baseline) | — | — | GREEN |

**All 8 use cases: GREEN**

## Findings (resolved)

### FAIL-1: Opportunity.assignOwner — RESOLVED

**Root cause**: Action effect sets `ownerEmail` but property not in ObjectType schema.
**Fix applied**: Added `ownerEmail`, `stageReason`, `stageChangedAt`, `lossReason` properties to opportunity ObjectType.

### FAIL-2: Opportunity.markStale — RESOLVED

**Root cause**: `stageReason` not a defined property.
**Fix applied**: Same as FAIL-1.

### GAP-SEED-1: Missing actions — RESOLVED

All 5 missing actions seeded: `Vendor.submitForReview`, `Vendor.updateRiskAssessment`, `Lead.disqualify`, `Control.markReviewed`, `JournalEntry.proposeCorrection`.

### GAP-NAMING-1: Naming mismatches — RESOLVED

Renamed via DELETE + recreate: `RefundRequest.deny`->`reject`, `RefundRequest.escalate`->`requestHumanReview`, `lead.qualify`->`Lead.qualify`. Added `Vendor.requestHumanReview` alongside `Vendor.requestDocuments`.

### GAP-GRAPH-1: Graph neighbors — RESOLVED

**Root cause**: `PostgresGraphService.traverseGraph()` CTE only queried `ontology.nodes` (ObjectType definitions), but `projections.graph_edges` source/target IDs reference `ontology.object_instances` (runtime instances). The CTE base case returned 0 rows when given an instance ID.

**Fix applied**: Replaced single-table CTE with unified `all_entities` CTE that unions both `ontology.nodes` and `ontology.object_instances`. Applied same pattern to `getNeighbors()`, `getEntity()`, and `findShortestPath()`. Type mismatch `nodes.espace_id::uuid` vs `object_instances.espace_id::varchar` resolved with `::text` cast.

**Commit**: `e6d6a273c` — deployed to staging, verified via API test (2 neighbors returned for refund_request instance).

### FAIL-3: DataIssue.markResolved — KNOWN FLAKY (timing)

**Root cause**: Async manifest version bump via outbox worker races with plan verify. The dry-run captures manifest version `'2026-05-05.2'` (persisted from seed), but by verify time (~2s later), the outbox worker has processed events from earlier actions and bumped the manifest to a new hash `'c1adac5400106212'`. This produces `PLAN_SCHEMA_VERSION_MISMATCH`.

**Not a code bug**: timing-dependent race between outbox worker and plan verify. Previous runs passed when the outbox was faster. Remediation: retry dry-run on `PLAN_SCHEMA_VERSION_MISMATCH` (matches `remediation: 'REFRESH_CONTEXT_PACK'`).

## Seed Fixes Applied (11 total)

| # | Type | Action | File |
|---|------|--------|------|
| 1 | FIX | Added `ownerEmail`, `stageReason`, `stageChangedAt`, `lossReason` properties to opportunity ObjectType | `scripts/setup/seed-use-cases.js` |
| 2 | FIX | Renamed `RefundRequest.deny` -> `RefundRequest.reject` (DELETE + recreate) | `scripts/setup/seed-use-cases.js` |
| 3 | FIX | Renamed `RefundRequest.escalate` -> `RefundRequest.requestHumanReview` (DELETE + recreate) | `scripts/setup/seed-use-cases.js` |
| 4 | FIX | Renamed `lead.qualify` -> `Lead.qualify` (DELETE + recreate) | `scripts/setup/seed-use-cases.js` |
| 5 | ADD | Seeded `Vendor.requestHumanReview` alongside existing `Vendor.requestDocuments` | `scripts/setup/seed-use-cases.js` |
| 6 | ADD | Seeded `Vendor.submitForReview` | `scripts/setup/seed-use-cases.js` |
| 7 | ADD | Seeded `Vendor.updateRiskAssessment` | `scripts/setup/seed-use-cases.js` |
| 8 | ADD | Seeded `Lead.disqualify` | `scripts/setup/seed-use-cases.js` |
| 9 | ADD | Seeded `Control.markReviewed` | `scripts/setup/seed-use-cases.js` |
| 10 | ADD | Seeded `Control.markFailed` | `scripts/setup/seed-use-cases.js` |
| 11 | ADD | Seeded `JournalEntry.proposeCorrection` (execution_mode=plan_only) | `scripts/setup/seed-use-cases.js` |

## Protocol Discoveries

1. **Idempotency-Key required**: All POST endpoints require `Idempotency-Key` header with API key auth. Without it: `POLICY_IDEMPOTENCY_REQUIRED`.
2. **Apply protocol**: Body must be `{planId, planHash}` only. Extra fields trigger `APPLY_PLAN_INPUT_NOT_ALLOWED`.
3. **Verify protocol**: Needs `{riskAcknowledged: true, confirmed: true}` for `canApply: true`.

## Phase 4: Doc/API Alignment Audit

Cross-referenced all 8 use case doc files against the seed script and staging API.

### Doc action tables vs seed alignment

| Doc File | Doc Actions | Seed Actions | Match? |
|----------|------------|--------------|--------|
| contract-approval.md | approve, reject, submitForReview | approve, reject, submitForReview | MATCH |
| vendor-onboarding.md | approve, reject, requestHumanReview, submitForReview, updateRiskAssessment | same + requestDocuments | MATCH (+1 extra) |
| refund-approval.md | approve, reject, requestHumanReview | approve, reject, requestHumanReview | MATCH |
| crm-pipeline.md | moveStage, assignOwner, markStale, Lead.qualify, Lead.disqualify | same | MATCH |
| finance-audit.md | flagAnomaly, clearAnomaly, Control.markReviewed, Control.markFailed, JournalEntry.proposeCorrection | same + EvidencePack.approve/reject | MATCH (+2 extra) |
| it-access-request.md | approve, deny, requestHumanReview | approve, deny, requestHumanReview | MATCH |
| data-quality.md | proposeFix, markResolved, Contact.updateEmail, Contact.markDuplicate, **Account.updateSegment** | same minus Account.updateSegment | **PARTIAL** |
| customer-file-360.md | 11 GDPR actions | 11 GDPR actions | MATCH |

**Score: 7/8 MATCH, 1 PARTIAL**

### Doc references actions in mutableBy not yet available

| Action | Doc File | Location | Status |
|--------|----------|----------|--------|
| `Invoice.approve` | finance-audit.md:53 | mutableBy annotation | Forward ref — not in action table |
| `Control.markInReview` | finance-audit.md:61 | mutableBy annotation | Forward ref — distinct from markReviewed |
| `DataIssue.rejectFix` | data-quality.md:69 | mutableBy annotation | Forward ref — not in action table |
| `Account.updateSegment` | data-quality.md:93 | **Action table** | **Gap — should be seeded** |

### Seeded but not documented

| Action | In Seed | In Doc Action Table |
|--------|---------|---------------------|
| `EvidencePack.approve` | Yes | No — consider adding to finance-audit.md |
| `EvidencePack.reject` | Yes | No — consider adding to finance-audit.md |

## Remaining Actions

| # | Type | Action | File |
|---|------|--------|------|
| 1 | ~~SEED~~ | ~~Seed `Account.updateSegment`~~ | ~~DONE~~ — seeded in this session |
| 2 | ~~DOC~~ | ~~Add `EvidencePack.approve/reject` to finance-audit action table~~ | ~~DONE~~ — already present (lines 82-83) |
| 3 | ~~DOC~~ | ~~Add idempotency-key requirement~~ | ~~DONE~~ — added to `signed-plans-and-safety.md` §API protocol reference |
| 4 | ~~DOC~~ | ~~Document apply protocol (planId+planHash only)~~ | ~~DONE~~ — added to `signed-plans-and-safety.md` §API protocol reference |
| 5 | ~~DOC~~ | ~~Verify protocol (riskAcknowledged+confirmed)~~ | ~~DONE~~ — added to `signed-plans-and-safety.md` §API protocol reference |
| 6 | ~~TEST~~ | ~~Fix graph neighbors to query instances~~ | ~~DONE~~ — `PostgresGraphService` unified CTE (commit `e6d6a273c`) |
| 7 | ~~TEST~~ | ~~Dry-run retry on `PLAN_SCHEMA_VERSION_MISMATCH`~~ | ~~DONE~~ — retry logic in extended check, PASS=258 FAIL=0 GAP=0 |

## Files Modified

| File | Changes |
|------|---------|
| `scripts/setup/seed-use-cases.js` | All 8 UC functions updated: full property schemas, 11 new/renamed actions, legacy cleanup, Account.updateSegment added |
| `tests/scripts/public-usecases-extended-check.js` | 16 new secondary action tests, plan_only handling, naming checks, edge case tests |
| `backend/src/services/PostgresGraphService.ts` | Unified `all_entities` CTE querying both `ontology.nodes` + `ontology.object_instances` for graph traversal |
| `produit/publique/docs/use-cases/IMPROVEMENT-REPORT-2026-05-11.md` | This report |
| `produit/publique/docs/use-cases/VALIDATION.md` | Updated date, summary, action table (18 -> 42 actions), graph fix noted |
