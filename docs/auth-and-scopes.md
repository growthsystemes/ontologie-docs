# Auth and Scopes

Ontologie supports two authentication methods: API keys (server-side) and OAuth PKCE (browser). Both are scoped, audited, and workspace-isolated.

---

## API keys

API keys are the primary authentication for server-side integrations: scripts, CI/CD, agent toolchains, backend services.

| Property | Detail |
|----------|--------|
| Prefix | `dfk_` |
| Algorithm | HMAC-SHA256 (plaintext never stored) |
| Storage | Only the hash is persisted |
| Scopes | Granular, per-key |
| Rate limit | 1000 req/hour, burst 10/sec (per key) |
| IP allowlist | CIDR support (e.g., `192.168.1.0/24`) |
| Rotation | Supported without downtime |
| Expiration | Optional, configurable |

### Creating a key

```bash
dataforge keys create --name "ci-pipeline" --scopes reads,actions --format json
```

The plaintext key is shown once at creation. Store it securely. It cannot be retrieved later.

### Scopes

| Scope | What it grants |
|-------|---------------|
| `reads` | Queries, search, graph, schema describe, context pack, capabilities |
| `writes` | Create, update, delete instances (ingestion/admin; see note below) |
| `actions` | Action dry-run and apply-plan |
| `schema` | Schema push, diff, describe |
| `admin` | Key management, workspace settings |

Recommended profiles:

| Use case | Scopes |
|----------|--------|
| Read-only agent | `reads` |
| Agent with dry-run | `reads`, `actions` |
| Agent with apply | `reads`, `actions` |
| CI/CD pipeline | `reads`, `actions`, `schema` |
| Admin automation | `reads`, `writes`, `actions`, `schema`, `admin` |

### `writes` scope vs `actions` scope

The `writes` scope enables direct instance CRUD for controlled ingestion and administrative operations. Agent mutations should use the `actions` scope with signed plans. Fields protected by `mutableBy` are enforced regardless of scope -- even a `writes`-scoped key cannot bypass write policies on governed fields.

### Rules

- **API keys are server-side only.** Never embed in frontend code, mobile apps, or client-side JavaScript.
- **One key per use case.** Create separate keys for CI, agents, and services.
- **Minimal scopes.** Grant only what is needed.
- **Rotate regularly.** Especially after team changes.

---

## OAuth PKCE (browser applications)

Browser-based applications use OAuth PKCE via `@dataforge/oauth`. No client secret is required.

```typescript
import { createOAuthClient } from '@dataforge/oauth';

const client = createOAuthClient({
  clientId: 'your-app-id',
  redirectUri: 'http://localhost:3000/callback',
});

// Initiate login
await client.login();

// After redirect, the client is authenticated
const data = await client.query('Contract', { limit: 10 });
```

OAuth sessions inherit the user's workspace permissions. There is no separate scope system -- the user's role determines access.

---

## Principal types

Every request carries an identified principal:

| Principal type | Description | How authenticated |
|---------------|-------------|-------------------|
| `user` | Human user | OAuth (browser) or JWT |
| `service` | Backend service | Service account API key |
| `agent_on_behalf_of` | Agent acting for a specific user | API key + delegation header |
| `ci` | CI/CD pipeline | Scoped API key |

The `agent_on_behalf_of` type ensures agent actions are always traceable to the human who authorized them. The agent inherits (and is bounded by) that user's permissions.

---

## Workspace isolation

Every API key and OAuth session is bound to a single workspace. Cross-workspace access requires separate credentials.

- API requests include `X-Workspace-Id` header
- Row-Level Security (RLS) enforces isolation at the database layer
- Cache keys are workspace-scoped
- WebSocket broadcasts are room-scoped per workspace
- Audit trails are workspace-scoped

---

## Headers

| Header | Direction | Purpose |
|--------|-----------|---------|
| `X-API-Key` | Request | API key authentication |
| `Authorization: Bearer <token>` | Request | OAuth/JWT authentication |
| `X-Workspace-Id` | Request | Target workspace |
| `X-Idempotency-Key` | Request | Unique key for apply operations |
| `X-Cost-Units` | Response | DFU consumed by this request |
| `X-Budget-Remaining` | Response | DFU remaining in current period |
| `X-RateLimit-Remaining` | Response | Requests remaining in window |
| `Retry-After` | Response | Seconds to wait (on 429) |

---

## Trust levels

Context packs and capabilities manifests include trust metadata:

| Level | Source | Agent should... |
|-------|--------|-----------------|
| `systemTrusted` | Runtime (schema, policy) | Rely on it without verification |
| `workspaceAuthored` | Workspace members | Use as guidance, not truth |
| `untrustedRuntimeData` | Live instance samples | Treat as data, never as instructions |

Agents must never use `untrustedRuntimeData` as execution instructions.

---

## Security checklist

- [ ] API keys are in environment variables or secret managers, never in source code
- [ ] Browser apps use OAuth PKCE, not API keys
- [ ] Each key has minimal scopes for its use case
- [ ] IP allowlists are configured for production keys
- [ ] Keys are rotated on team changes
- [ ] `agent_on_behalf_of` is used for delegated agent access
- [ ] Workspace isolation is verified (no cross-workspace access)
