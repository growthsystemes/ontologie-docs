# Import and Export Reference

---

## Import modes

### Typed import (single ObjectType)

Import instances of a specific type from a CSV, JSON array, or JSONL file:

```bash
dataforge import contracts.csv --type Contract --dry-run --format json
dataforge import contracts.csv --type Contract --apply-plan <planId> --plan-hash <hash> --idempotency-key import-001 --format json
```

The `--type` flag is required. It tells the importer which ObjectType schema to validate against.

### Multi-type seed file

Seed files (like `seed.json`) contain multiple object types. Import each type separately:

```bash
# seed.json contains { "Client": [...], "Contract": [...], "links": [...] }

dataforge import seed.json --type Client --dry-run --format json
dataforge import seed.json --type Client --apply-plan <planId> --plan-hash <hash> --idempotency-key import-clients-001 --format json

dataforge import seed.json --type Contract --dry-run --format json
dataforge import seed.json --type Contract --apply-plan <planId> --plan-hash <hash> --idempotency-key import-contracts-001 --format json
```

The importer reads the section matching the type name from the seed file.

---

## Supported formats

| Format | Extension | Structure |
|--------|-----------|-----------|
| CSV | `.csv` | Header row + data rows |
| JSON array | `.json` | `[{...}, {...}]` or `{ "TypeName": [{...}] }` |
| JSONL | `.jsonl` | One JSON object per line |

---

## Dry-run and apply

Import follows the same plan lifecycle as actions:

1. **Dry-run** -- validates the file, returns a plan with row-level results
2. **Inspect** -- review which rows will be imported and any validation errors
3. **Apply** -- execute the import with an idempotency key

```bash
# Dry-run: validate and get plan
dataforge import data.csv --type Contract --dry-run --format json

# Apply: execute the import
dataforge import data.csv --type Contract --apply-plan <planId> --plan-hash <hash> --idempotency-key import-001 --format json
```

Every apply requires an idempotency key. Replaying the same key returns the original result.

---

## SDK

```typescript
// Dry-run import
const preview = await client.import.dryRun('Contract', './contracts.csv');
console.log(preview.validRows, preview.errors);

// Apply import with idempotency key
const result = await client.import.apply('Contract', './contracts.csv', {
  planId: preview.planId,
  planHash: preview.planHash,
  idempotencyKey: 'import-contracts-001',
});
```

---

## Export

```bash
dataforge export Contract --format jsonl > contracts.jsonl
dataforge export Contract --filter-json '{"status":{"eq":"approved"}}' --format jsonl
```

Export produces JSONL (one JSON object per line) for streaming-friendly consumption.

---

## Limits

| Limit | Value |
|-------|-------|
| Max rows per import | 10,000 |
| Max file size | 50 MB |
| Max export rows | 100,000 |
| Export timeout | 120s |

---

## Errors

| Code | Meaning |
|------|---------|
| `IMPORT_TOO_LARGE` | File exceeds size or row limit |
| `INVALID_INPUT` | Row fails schema validation |
| `TYPE_MISMATCH` | Column type does not match property type |
| `BUDGET_EXCEEDED` | Import would exceed DFU budget |

Row-level errors are reported in the dry-run response. Rows that fail validation are skipped; valid rows proceed.
