# Security

## Reporting vulnerabilities

If you discover a security vulnerability in Ontologie (CLI, SDK, MCP adapter, or Cloud), please report it responsibly:

**Email:** security@ontologie-growthsystemes.com

Do not open a public GitHub issue for security vulnerabilities.

We will acknowledge receipt within 48 hours and provide an initial assessment within 5 business days.

---

## Security model summary

Ontologie enforces safety at the runtime layer, not through prompt instructions.

| Layer | Mechanism |
|-------|-----------|
| Authentication | API keys (bearer secrets; server stores HMAC-SHA256 digest only) + OAuth PKCE (browser) |
| Authorization | Scoped API keys, workspace isolation, per-field `mutableBy` policies |
| Plan integrity | Ed25519 signed plan artifacts, 27-step PlanGuard verification |
| Isolation | Row-Level Security (RLS), workspace-scoped cache, tenant isolation at every layer |
| Audit | Append-only audit trail with principal type, action, plan reference, outcome |
| Rate limiting | Per-key rate limits (1000/hr, burst 10/s), budget caps |
| Encryption | TLS 1.3 in transit, AES-256-GCM at rest for sensitive data |

---

## API key rules

- API keys are **server-side only**. Never embed them in frontend code.
- Browser applications use **OAuth PKCE** via `@dataforge/oauth`.
- Keys are scoped: `reads`, `writes`, `actions`, `schema`, `admin`.
- Keys are rotatable, auditable, and support IP allowlists (CIDR).
- Plaintext is never stored. Only HMAC-SHA256 hashes are persisted.

---

## Agent safety boundary

- Agents interact through CLI/SDK/MCP only. No direct database access.
- All mutations require a signed plan (dry-run + apply-plan).
- The plan hash covers: actor, workspace, schema version, policy version, action version, inputs, target object versions.
- If anything changes between dry-run and apply, the plan is rejected.
- `mutableBy` prevents agents from bypassing governed fields with raw writes.
- Context packs include trust levels (`systemTrusted`, `workspaceAuthored`, `untrustedRuntimeData`).

---

## What Ontologie does NOT do

- **Not a WAF.** Does not filter raw HTTP traffic.
- **Not a network firewall.** Does not manage TLS termination or IP segmentation.
- **Not a general-purpose secrets manager.** Ontologie issues and rotates Ontologie API keys, but does not store, rotate, or manage your third-party application secrets.
- **Not currently SOC 2 certified.** GDPR-related controls, data processing terms, retention, and subprocessors are documented separately when applicable. Formal SOC 2 certification is on the roadmap.

---

## Supported versions

| Version | Security updates |
|---------|-----------------|
| Latest stable | Yes |
| Previous minor | 6 months |
| Preview | Best effort |

---

## Disclosure policy

We follow coordinated disclosure. After a fix is released, we will publish a security advisory with:
- Affected versions
- Impact assessment
- Remediation steps
- CVE identifier (if applicable)
