# Plan Proof Guide

A plan proof is a portable, shareable bundle that proves what an agent did, when, with what authorization, and verified by what checks.

---

## What is a plan proof?

Every mutation in Ontologie goes through a signed plan. After a plan is applied, you can export a **proof** that combines:

1. **Inspect** -- the plan artifact (action, effects, versions, dependencies)
2. **Verify** -- cryptographic and authorization verification (signature, body hash, checks)
3. **Audit** -- the apply state (who applied, when, idempotency key, request ID)

---

## Generate a proof

### CLI

```bash
# JSON (default)
dataforge plan proof <planId> --format json

# Markdown
dataforge plan proof <planId> --plan-format markdown

# GitHub PR snippet
dataforge plan proof <planId> --plan-format json --format json
# Then use the SDK for format conversion:
```

### SDK

```typescript
// JSON
const proof = await client.plans.proof(planId);

// Markdown
const md = await client.plans.proof(planId, { format: 'markdown' });

// GitHub PR snippet
const github = await client.plans.proof(planId, { format: 'github' });

// Linear issue comment
const linear = await client.plans.proof(planId, { format: 'linear' });

// Slack Block Kit
const slack = await client.plans.proof(planId, { format: 'slack' });

// With sensitive data redacted
const redacted = await client.plans.proof(planId, { redact: true });
```

### API

```
GET /api/v1/plans/:planId/proof?format=json
GET /api/v1/plans/:planId/proof?format=markdown
GET /api/v1/plans/:planId/proof?format=github
GET /api/v1/plans/:planId/proof?format=linear
GET /api/v1/plans/:planId/proof?format=slack
GET /api/v1/plans/:planId/proof?format=json&redact=true
```

---

## Proof structure

```json
{
  "proofVersion": "dataforge.plan-proof.v1",
  "sources": ["inspect", "verify", "audit"],
  "planId": "plan_01J7K2X...",
  "planHash": "sha256:a1b2c3d4...",
  "status": "applied",
  "applied": {
    "isApplied": true,
    "appliedAt": "2026-05-12T10:32:00Z",
    "appliedBy": "user_mgr_01"
  },
  "actor": { ... },
  "operation": { "kind": "action", "actionKey": "Contract.approve" },
  "signature": { "algorithm": "Ed25519", "trustLevel": "server_signed" },
  "effects": [ ... ],
  "risk": { "level": "low" },
  "verification": { "passed": true, "checks": [ ... ] }
}
```

See the [sample proof JSON](../../06-public/samples/plan-proof-contract-approve.json) and [GitHub PR snippet](../../06-public/samples/plan-proof-github-pr.md) for full examples.

---

## Export formats

| Format | Content-Type | Use case |
|--------|-------------|----------|
| `json` | application/json | Programmatic consumption, storage |
| `markdown` | text/markdown | Human review, documentation |
| `github` | text/markdown | GitHub PR comments, issue references |
| `linear` | text/markdown | Linear issue comments |
| `slack` | application/json | Slack Block Kit messages |

---

## Redaction

Pass `?redact=true` to hide sensitive data (principal IDs, signature values). Useful for sharing proofs externally while preserving the verification structure.

---

## Mock server

The mock server (`@ontologie/mock-server`) supports the proof endpoint for local development:

```bash
dataforge dev
# In another terminal:
dataforge plan proof <planId> --format json
```

Mock proofs use `algorithm: "mock"` and `trustLevel: "local_mock"`. Cloud proofs use Ed25519 with `trustLevel: "server_signed"`.
