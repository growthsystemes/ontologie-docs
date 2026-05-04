# Changelog

All notable changes to the Ontologie public contract are documented here.

This changelog covers the **public developer surface** (CLI, SDK, MCP, API contract). Internal implementation changes are not listed.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Initial public developer contract documentation
- Schema DSL with `enumType`, `objectType`, `action`, `link`, `role`
- CLI contract `dataforge.cli.v1` with 13 exit codes and JSON envelope
- Signed plan lifecycle: dry-run, inspect, verify, apply
- Execution modes: `descriptive`, `plan_only`, `twin_apply`, `human_handoff`, `workflow_handoff`, `external_commit`
- DataForge Units (DFU) billing with budget controls
- Agent integration: `agent init`, `agent doctor`, context packs, capabilities manifest
- MCP adapter (Preview) with read/dry-run/write permission levels
- Local mock server for offline development
- Cloud Sandbox tier (free, 10K DFU/month hard cap)

### Stability
- CLI core commands: **Stable**
- SDK client (`@dataforge/sdk-client`): **Stable**
- MCP adapter (`@dataforge/mcp`): **Preview**
- Execution mode enforcement (`human_handoff`, `workflow_handoff`, `external_commit`): **Declared, V1.1 enforcement**

---

## Versioning policy

- **Stable** commands and SDK methods: SemVer, 12-month deprecation notice before removal.
- **Preview** features: may change in minor versions, documented as Preview.
- **V1.1** features: declared and visible but not yet runtime-enforced.

See [Stability and versioning](docs/stability-and-versioning.md) for the full policy.
