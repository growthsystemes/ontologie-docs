# CLI Contract

Contract version: `dataforge.cli.v1`

The CLI is the stable agent contract. Every command outputs structured JSON, uses deterministic exit codes, and separates machine output (stdout) from human messages (stderr).

---

## JSON envelope

Every CLI command with `--format json` outputs a single JSON object:

```json
{
  "ok": true,
  "data": { ... },
  "error": null,
  "page": { "limit": 50, "offset": 0, "total": 142, "hasMore": true },
  "meta": {
    "requestId": "req_abc123",
    "durationMs": 45,
    "costUnits": 2,
    "manifestVersion": 17,
    "policyVersion": 3
  }
}
```

| Field | Type | When present |
|-------|------|-------------|
| `ok` | boolean | Always |
| `data` | object/array/null | On success |
| `error` | object/null | On failure |
| `page` | object/null | On paginated responses |
| `meta` | object | Always |

### Error envelope

```json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "PLAN_EXPIRED",
    "message": "Plan ttl exceeded (300s)",
    "retryable": true,
    "remediation": {
      "summary": "Create a new dry-run to get a fresh plan.",
      "command": "dataforge actions run Contract.approve con_001 --dry-run --format json"
    },
    "details": { "planId": "plan_xyz", "expiredAt": "2026-05-04T10:05:00Z" }
  },
  "page": null,
  "meta": { "requestId": "req_def456" }
}
```

---

## Exit codes

| Code | Name | Meaning |
|------|------|---------|
| 0 | Success | Command completed successfully |
| 1 | Error | General error |
| 2 | Validation | Invalid usage, missing argument, malformed input |
| 3 | Authentication | Auth failed (invalid key, expired token) |
| 4 | Authorization | Permission denied (scope, write policy) |
| 5 | Capability drift | Schema, policy, or action version mismatch |
| 6 | Schema drift | Generated types out of sync with deployed schema |
| 7 | Conflict | OCC conflict, plan already applied, expired, or revoked |
| 8 | Rate limited | Too many requests |
| 9 | Network | Network error or timeout |
| 10 | Precondition | Precondition failed, confirmation required |
| 11 | Quota | Budget or quota exceeded |
| 12 | Configuration | Missing or invalid configuration |

Exit codes are stable. New codes may be added; existing codes will not change meaning.

---

## Command grammar

```
dataforge <domain> <verb> [target] [flags]
```

Examples:
```bash
dataforge schema describe --format json
dataforge query Contract --filter-json '{"status":{"eq":"pending_review"}}' --limit 20 --format json
dataforge actions run Contract.approve con_001 --dry-run --format json
dataforge actions run Contract.approve con_001 --apply-plan plan_xyz --plan-hash <hash> --idempotency-key key_001 --format json
dataforge plan inspect plan_xyz --format markdown
dataforge graph neighbors con_001 --format json
dataforge search "Acme" --format json
dataforge import data.csv --type Contract --dry-run --format json
dataforge capabilities export --format json
dataforge context pack --budget-tokens 4000 --format markdown
dataforge agent init --target all
dataforge agent doctor --format json
dataforge usage me --format json
```

---

## Core commands

### Schema

| Command | Purpose |
|---------|---------|
| `schema describe` | List all object types, link types, enums |
| `schema diff` | Show pending changes vs deployed |
| `schema push --dry-run` | Preview schema change as a plan |
| `schema push --yes` | Apply schema change after `schema push --dry-run` |

### Query

| Command | Purpose |
|---------|---------|
| `query <Type>` | List instances with filters |
| `query <Type> --filter-json '{...}'` | Filtered query |
| `search "<term>"` | Hybrid keyword/semantic search |
| `graph neighbors <id>` | 1-hop graph traversal |

### Actions

| Command | Purpose |
|---------|---------|
| `actions describe <key>` | Show action definition, preconditions, inputs |
| `actions run <key> <id> --dry-run` | Create a signed plan |
| `actions run <key> <id> --apply-plan <planId> --plan-hash <hash> --idempotency-key <key>` | Apply the plan |

### Plans

| Command | Purpose |
|---------|---------|
| `plan inspect <planId>` | View plan details |
| `plan verify <planId>` | Verify plan is still valid |
| `plan revoke <planId>` | Cancel a pending plan |

### Agent

| Command | Purpose |
|---------|---------|
| `agent init --target all` | Generate AGENTS.md, CLAUDE.md, skill |
| `agent doctor` | Verify agent environment |
| `context pack` | Generate agent-readable workspace summary |
| `capabilities export` | Machine-readable capabilities manifest |

### Utility

| Command | Purpose |
|---------|---------|
| `usage me` | Current DFU usage and quotas |
| `check` | Validate schema consistency |
| `generate` | Generate typed SDK client |
| `import <file> --type <Type>` | Import data (CSV/JSON/JSONL) |
| `export <type>` | Export data (JSONL) |

---

## Global flags

| Flag | Effect |
|------|--------|
| `--format json` | JSON envelope to stdout |
| `--format markdown` | Human-readable markdown |
| `--format jsonl` | JSONL streaming (long operations) |
| `--quiet` | Suppress human messages on stderr |
| `--no-color` | Disable ANSI colors |
| `--limit <n>` | Pagination limit |
| `--offset <n>` | Pagination offset |
| `--dry-run` | Preview without mutation |
| `--apply-plan <id>` | Apply a signed plan; use with `--plan-hash` and `--idempotency-key` |
| `--plan-hash <hash>` | Verify the dry-run/inspect plan hash at apply time |
| `--idempotency-key <key>` | Unique key for apply |
| `--workspace <id>` | Target workspace |
| `--profile <name>` | Named configuration profile |

---

## Agent flags

For automation, always use:

```bash
dataforge <command> --format json --no-color --quiet
```

This ensures:
- Machine-parseable output on stdout
- No ANSI escape codes
- No interactive prompts
- Structured errors with `retryable` and `remediation`

---

## JSONL streaming

Long-running operations (import, export, batch) stream progress as JSONL:

```jsonl
{"type":"progress","current":50,"total":500,"message":"Importing..."}
{"type":"progress","current":100,"total":500,"message":"Importing..."}
{"type":"result","ok":true,"data":{"imported":500,"errors":0}}
```

---

## Pagination

Paginated responses include:

```json
{
  "page": {
    "limit": 50,
    "offset": 0,
    "total": 142,
    "hasMore": true,
    "nextCursor": "cursor_abc"
  }
}
```

Use `--limit` and `--offset` for offset-based pagination. Cursor-based pagination is available via `--cursor` for large result sets.

---

## Stability

- Commands listed here are **Stable** (SemVer, 12-month deprecation).
- New optional fields may be added to `data` and `meta` in minor versions.
- Existing fields are never removed in minor versions.
- Error codes are stable; new codes may be added.
- Exit codes are stable; new codes may be added.

Preview commands are documented separately and may change.
