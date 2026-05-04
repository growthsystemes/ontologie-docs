# MCP Guide

**Stability: Preview**

The MCP adapter (`@dataforge/mcp`) projects the CLI contract into MCP-compatible clients. The CLI remains the stable agent contract; MCP is a convenience surface for toolchains that speak MCP natively.

---

## What MCP is

MCP (Model Context Protocol) lets AI agents discover and invoke tools without explicit CLI subprocess management. The Ontologie MCP adapter exposes the same operations as the CLI -- same scopes, same policies, same plan verification -- as MCP tools.

---

## Install

```bash
npm install @dataforge/mcp
```

---

## Configuration

### Claude Code / claude_desktop_config.json

```json
{
  "mcpServers": {
    "ontologie": {
      "command": "npx",
      "args": ["@dataforge/mcp", "--allow-read", "--allow-dry-run"],
      "env": {
        "DATAFORGE_API_KEY": "dfk_...",
        "DATAFORGE_WORKSPACE_ID": "ws_..."
      }
    }
  }
}
```

### Permission levels

| Flag | What it enables |
|------|----------------|
| `--allow-read` | Schema describe, queries, search, graph, context pack, capabilities |
| `--allow-dry-run` | Action dry-runs, import dry-runs, plan inspect/verify |
| `--allow-write` | Apply plans, schema push, import apply (requires explicit opt-in) |

Write operations are **disabled by default**. The MCP adapter never has more power than the CLI.

---

## Available tools

When connected, the MCP adapter exposes tools matching CLI commands:

| Tool | Equivalent CLI | Permission |
|------|---------------|------------|
| `ontology_schema_describe` | `schema describe` | read |
| `ontology_query` | `query <Type>` | read |
| `ontology_search` | `search "<term>"` | read |
| `ontology_graph_neighbors` | `graph neighbors <id>` | read |
| `ontology_actions_describe` | `actions describe <key>` | read |
| `ontology_context_pack` | `context pack` | read |
| `ontology_capabilities` | `capabilities export` | read |
| `ontology_actions_dry_run` | `actions run --dry-run` | dry-run |
| `ontology_plan_inspect` | `plan inspect` | dry-run |
| `ontology_plan_verify` | `plan verify` | dry-run |
| `ontology_actions_apply` | `actions run --apply-plan` | write |
| `ontology_schema_push` | `schema push` | write |
| `ontology_import` | `import` | write |

---

## Safety guarantees

The MCP adapter enforces identical safety rules as the CLI:

- Same API key scopes apply
- Same workspace policies are enforced server-side
- Plans require dry-run before apply
- Idempotency keys are required for write operations
- Budget caps and rate limits apply

If the CLI rejects an operation, MCP rejects it too. There is no "extra power" through MCP.

---

## Local mode

The MCP adapter can run against the local mock server:

```bash
dataforge dev &
npx @dataforge/mcp --allow-read --allow-dry-run --local
```

In local mode, queries and dry-runs work against the mock server. No cloud connection needed.

---

## When to use MCP vs CLI

| Use MCP when... | Use CLI when... |
|-----------------|-----------------|
| Your agent toolchain speaks MCP natively (Claude Code, Codex) | You control the invocation (scripts, CI/CD) |
| You want zero-config tool discovery | You need maximum control over flags and output |
| You want the agent to discover available operations automatically | You need JSONL streaming for long operations |
| The agent operates interactively | You need offline/local-only execution |

---

## MCP availability by tier

| Tier | MCP capabilities |
|------|-----------------|
| Local (mock server) | Read + dry-run against mock server |
| Cloud Sandbox | Read only |
| Cloud Runtime | Read + dry-run |
| + Governance | Read + dry-run + write (governed) |
| Enterprise | Configurable |

Write tools (`--allow-write`) require Cloud Runtime+ with the Governance add-on.

---

## Limitations (Preview)

- MCP is Preview stability. The tool names and parameters may change in minor versions.
- No compatibility guarantee until MCP reaches Stable.
- Write tools require explicit opt-in (`--allow-write`).
- The CLI is always the fallback and reference implementation.
- MCP does not support JSONL streaming (results are returned as single JSON).
- MCP tool names use `ontology_*` prefix.

---

## Profiles

Use `--profile` to switch between configurations:

```bash
npx @dataforge/mcp --profile staging --allow-read --allow-dry-run
npx @dataforge/mcp --profile production --allow-read
```

Profiles map to workspace + API key pairs in `~/.dataforge/config.json`.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| No tools appear | Missing `--allow-read` | Add permission flags |
| Write tools missing | Missing `--allow-write` | Add `--allow-write` (explicit opt-in) |
| Auth error | Invalid/expired API key | Rotate key, check env vars |
| Rate limited | Too many tool calls | Respect `retryAfterSeconds` in error |
| PLAN_EXPIRED | TTL exceeded between dry-run and apply | Create a new dry-run |
