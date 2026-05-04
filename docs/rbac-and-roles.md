# RBAC and Roles

---

## Overview

Roles control which actions an agent or user can execute. They are separate from API key scopes and workspace policies.

| Concept | What it controls |
|---------|-----------------|
| **API key scope** | Which API surfaces are accessible (reads, writes, actions, schema, admin) |
| **Workspace policy** | Global workspace constraints (forbidDelete, maxObjectsTouched, etc.) |
| **Role** | Which actions require which role (per-action access control) |
| **mutableBy** | Which actions can modify specific fields (per-field write control) |

---

## How roles work

Actions can declare a required role:

```typescript
const approveContract = action('approve')
  .on(Contract)
  .requires(role('manager'))
  // ...
```

At apply time, the server verifies that the authenticated principal has the required role. If not, the request is rejected with `RBAC_DENIED` (HTTP 403, exit code 4).

---

## Role assignment

Roles are assigned per workspace member. Configuration is managed through the Ontologie Cloud console or admin API.

```bash
# List available roles (CLI)
dataforge roles list --format json

# Assign a role (admin scope required)
dataforge roles assign user_jane manager --format json
```

---

## Agent delegation and roles

When using `agent_on_behalf_of` principal type, the agent inherits the roles of the user it acts on behalf of. The agent cannot escalate beyond that user's permissions.

```
Agent (API key: reads, actions) + on_behalf_of: user_jane (role: manager)
→ Agent can execute actions requiring role 'manager'

Agent (API key: reads, actions) + on_behalf_of: user_bob (role: viewer)
→ Agent cannot execute actions requiring role 'manager'
```

---

## Local mock behavior

The local mock server (`dataforge dev`) assigns all configured roles to the mock principal by default. Template projects (like `contract-review`) configure the mock principal with the roles needed for all example actions.

This means `approve` (which requires `manager`) works locally without additional configuration.

---

## Roles vs Governance add-on

| Feature | Available in | Notes |
|---------|-------------|-------|
| Basic roles (action-level) | All cloud workspaces | Declare roles in schema, assign in console |
| Advanced RBAC | Governance add-on | Custom role hierarchies, approval routing, delegated admin |
| Role auditing | Governance add-on | Who changed which roles, when |

---

## Errors

| Code | HTTP | Meaning |
|------|------|---------|
| `RBAC_DENIED` | 403 | Principal lacks the required role |
| `SCOPE_DENIED` | 403 | API key lacks the required scope |
| `WRITE_POLICY_VIOLATION` | 403 | Field protected by mutableBy |
