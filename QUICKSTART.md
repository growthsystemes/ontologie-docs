# Quickstart

Get from zero to a working agent-ready business model in under 10 minutes.

---

## Prerequisites

- Node.js 18+ LTS
- npm or pnpm

---

## 1. Install the CLI

```bash
npm install -g @dataforge/cli
```

Verify:

```bash
dataforge --version
```

---

## 2. Create a project

```bash
dataforge init --template contract-review
cd contract-review
```

This creates:
- `dataforge.schema.ts` -- your business model definition
- `seed.json` -- sample data
- `AGENTS.md` -- agent safety rules
- `dataforge.config.ts` -- project configuration

---

## 3. Define your model (already done by template)

```typescript
// dataforge.schema.ts
import { objectType, string, number, date, enumType, action, role, now, compile } from '@dataforge/schema';

const ContractStatus = enumType('ContractStatus', [
  'draft', 'pending_review', 'approved', 'rejected',
]);

const Contract = objectType('Contract', {
  reference: string().required().indexed(),
  amount: number(),
  status: ContractStatus.default('draft')
    .mutableBy(['Contract.approve', 'Contract.reject']),
  approvedAt: date().optional()
    .mutableBy(['Contract.approve']),
});

const approveContract = action('approve')
  .on(Contract)
  .executionMode('twin_apply')
  .input({ comment: string().optional() })
  .requires(role('manager'))
  .when(c => c.status.eq('pending_review'))
  .set({ status: 'approved', approvedAt: now() });

export const manifest = compile([Contract], {
  actions: [approveContract],
});
```

---

## 4. Local mode -- model and test without an account

```bash
# Start the local mock server
dataforge dev

# In another terminal:
dataforge schema describe --format json
dataforge query Contract --format json
dataforge actions describe Contract.approve --format json
dataforge actions run Contract.approve con_001 --dry-run --format json
```

The mock server gives you a local runtime for modeling and testing. No network, no account, no billing. Local dry-runs return unsigned mock plans (`algorithm: "mock"`). Cloud dry-runs return cryptographically signed Ed25519 plan artifacts.

The `contract-review` template configures the local mock principal with the `manager` role, so the `approve` and `reject` examples work locally without additional role configuration.

---

## 5. Push to Ontologie Cloud (free sandbox)

```bash
# Login (creates a free Cloud Sandbox workspace)
dataforge login

# Push the schema
dataforge schema push --dry-run --format json
dataforge schema push --apply-plan <planId> --idempotency-key schema-push-001 --format json

# Generate typed SDK client
dataforge generate
```

Cloud Sandbox: free, no card required, 10,000 DFU/month hard cap.

---

## 6. Import sample data

The seed file contains multiple types. Import each type separately:

```bash
# Import clients
dataforge import seed.json --type Client --dry-run --format json
dataforge import seed.json --type Client --apply-plan <planId> --idempotency-key import-clients-001 --format json

# Import contracts
dataforge import seed.json --type Contract --dry-run --format json
dataforge import seed.json --type Contract --apply-plan <planId> --idempotency-key import-contracts-001 --format json
```

The `--type` flag tells the importer which section of the seed file to read. Each import is an independent plan with its own idempotency key.

---

## 7. Run the full agent safety loop

```bash
# 1. Discover
dataforge schema describe --format json

# 2. Query
dataforge query Contract --filter-json '{"status":{"eq":"pending_review"}}' --format json

# 3. Check available actions
dataforge actions describe Contract.approve --format json

# 4. Dry-run
dataforge actions run Contract.approve con_001 \
  --input-json '{"comment":"Reviewed by legal"}' \
  --dry-run --format json

# 5. Inspect
dataforge plan inspect <planId> --format markdown

# 6. Apply
dataforge actions run Contract.approve con_001 \
  --apply-plan <planId> \
  --idempotency-key approve-con-001-001 \
  --format json
```

---

## 8. Set up agent integration

```bash
# Generate agent files
dataforge agent init --target all

# Verify the environment
dataforge agent doctor --format json
```

This produces `AGENTS.md`, `CLAUDE.md`, and `.claude/skills/dataforge/SKILL.md` -- ready for Claude Code, Codex, or any MCP client.

---

## Next steps

- [Concepts](docs/concepts.md) -- understand ObjectTypes, Actions, Processes
- [CLI contract](docs/cli-contract.md) -- full command reference
- [SDK guide](docs/sdk-guide.md) -- build applications with the TypeScript SDK
- [Safety guide](docs/signed-plans-and-safety.md) -- understand dry-run, signed plans, policies
- [Billing and limits](docs/billing-and-limits.md) -- DFU costs, budget controls
