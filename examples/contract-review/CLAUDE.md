# Contract Review Workspace

This project uses Ontologie to model a contract approval process.

## Quick reference

```bash
# Discover the model
dataforge schema describe --format json

# Query pending contracts
dataforge query Contract --filter-json '{"status":{"eq":"pending_review"}}' --format json

# Check what approve does
dataforge actions describe Contract.approve --format json

# Safety loop: dry-run then apply
dataforge actions run Contract.approve <id> --input-json '{"comment":"..."}' --dry-run --format json
dataforge actions run Contract.approve <id> --apply-plan <planId> --idempotency-key <key> --format json
```

## Key constraints

- `status` field is governed by `mutableBy` -- can only change through submit/approve/reject actions
- `approve` and `reject` require role `manager`
- All actions use `twin_apply` execution mode (updates the operational twin only)
- Plans expire after 15 minutes (medium risk)

## Agent flags

Always use: `--format json --no-color --quiet`
