# Audit

---

## Overview

Every cloud operation produces an audit event. The audit trail is append-only and workspace-scoped. It provides a complete record of who did what, when, and under which plan.

---

## Audit event fields

| Field | Type | Description |
|-------|------|-------------|
| `eventId` | string | Unique audit event identifier |
| `timestamp` | datetime | When the operation occurred (server time) |
| `workspace` | string | Workspace ID |
| `principalType` | string | `user`, `service`, `agent_on_behalf_of`, `ci` |
| `principalId` | string | Who performed the operation |
| `onBehalfOf` | string? | User ID if delegated agent action |
| `action` | string | Operation performed (e.g., `Contract.approve`) |
| `objectType` | string? | Target object type |
| `instanceId` | string? | Target instance ID |
| `planId` | string? | Associated plan (for apply operations) |
| `outcome` | string | `success`, `error`, `denied` |
| `errorCode` | string? | Error code if outcome is error/denied |
| `manifestVersion` | integer | Schema version at time of operation |
| `policyVersion` | integer | Policy version at time of operation |

---

## Querying audit events

```bash
# List audit events for an instance
dataforge audit list --object con_001 --format json

# Filter by time range
dataforge audit list --since 2026-05-01 --until 2026-05-04 --format json

# Filter by action
dataforge audit list --action Contract.approve --format json

# Export audit trail
dataforge audit export --since 2026-05-01 --format jsonl > audit.jsonl
```

---

## SDK

```typescript
const events = await client.audit.list({
  objectId: 'con_001',
  since: '2026-05-01T00:00:00Z',
  limit: 50,
});
```

---

## Retention by tier

| Tier | Retention |
|------|-----------|
| Cloud Sandbox | 7 days |
| Cloud Runtime | 30 days |
| + Governance | 30-365 days (configurable) |
| Enterprise | Custom (contractual) |

After retention expires, audit events are permanently deleted. Export before expiry if long-term retention is needed.

---

## What is audited

- All apply operations (action, schema push, import)
- Plan creation (dry-run)
- Plan revocation
- Authentication events (login, key creation, key rotation)
- Policy changes
- Role assignments (Governance tier)

Read operations (queries, search, graph) are metered for DFU but not individually audited.

---

## Availability

| Tier | Audit access |
|------|-------------|
| Cloud Sandbox | Console only |
| Cloud Runtime | CLI + SDK + Console |
| + Governance | CLI + SDK + Console + Export |
| Enterprise | CLI + SDK + Console + Export + Streaming |
