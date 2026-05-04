# Templates

Ontologie provides project templates for common use cases. Templates include a schema definition, seed data, agent files, and a working configuration.

## Available templates

| Template | Use case | Includes |
|----------|----------|----------|
| `contract-review` | Legal/procurement contract approval | Contract + Client types, approve/reject actions, 3 sample contracts |
| `customer-onboarding` | Customer intake and verification | Customer type, KYC actions, status workflow |
| `vendor-management` | Vendor qualification and monitoring | Vendor + Assessment types, qualify/disqualify actions |
| `risk-assessment` | Risk scoring and mitigation | Risk type, scoring actions, severity enum |
| `blank` | Empty project | Minimal schema, no seed data |

## Usage

```bash
# Create from template
dataforge init --template contract-review

# Or blank
dataforge init
```

## Template structure

Every template produces:

```
my-project/
  dataforge.schema.ts    # Business model definition
  dataforge.config.ts    # Project configuration
  seed.json              # Sample data (optional)
  AGENTS.md              # Agent safety rules
  .gitignore
```

After `dataforge agent init --target all`, the project also includes:

```
  CLAUDE.md              # Claude Code project memory
  .claude/skills/dataforge/SKILL.md  # Full agent procedure
```

## Creating custom templates

Templates are schema files bundled with seed data and configuration. Any valid `dataforge.schema.ts` + `seed.json` pair can serve as a starting point.

The `dataforge check` command validates template integrity:

```bash
dataforge check --score
# Returns a 0-100 score based on schema completeness
```
