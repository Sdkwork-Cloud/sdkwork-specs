# Unified Workspace Database And Schema Execution Plan

- Status: Completed
- Date: 2026-07-30
- Scope: SDKWork database identity, engine roles, migration governance, runtime configuration, and workspace validation
- Authorities: `DATABASE_SPEC.md`, `DATABASE_FRAMEWORK_SPEC.md`, `ENVIRONMENT_SPEC.md`, `NAMING_SPEC.md`, `MIGRATION_SPEC.md`, `TEST_SPEC.md`

## Problem

The previous standard allowed application- or module-scoped database variables and did not require every integrated module in one environment to resolve the same PostgreSQL database and schema. That produced independent schemas, inconsistent bootstrap histories, duplicated pool identities, and runtime failures when one module expected columns that another module's lifecycle had not applied.

The Cloud Router startup failure on `ai_model_pricing.supplier_code` demonstrated the operational impact: the application catalog writer reached a shared table whose historical schema did not match the current model contract.

## Required End State

All authoritative server modules in one environment share exactly one PostgreSQL database and a schema with the same name:

| Environment | Database | Schema |
| --- | --- | --- |
| development | `sdkwork_ai_dev` | `sdkwork_ai_dev` |
| test | `sdkwork_ai_test` or `sdkwork_ai_test_<run_id>` | same as database |
| staging | `sdkwork_ai_staging` | `sdkwork_ai_staging` |
| production | `sdkwork_ai_prod` | `sdkwork_ai_prod` |

Runtime configuration uses only `SDKWORK_DATABASE_*`. Application-prefixed families that insert an application scope before `DATABASE`, and module-specific database identity keys, are retired and rejected rather than dual-read.

Shared database/schema identity does not merge table ownership. Each module retains its registered table prefixes, contract, migrations, seeds, and lifecycle history inside the shared schema.

Authoritative services, gateways, workers, servers, and containers use PostgreSQL only. SQLite is permitted only for explicitly declared `client-local` modules and test fixtures. Authoritative manifests use schema version 2, `databaseRole: authoritative-server`, `engines: [postgres]`, `defaultEngine: postgres`, and `lifecycle.autoMigrate: false`.

## Execution

1. Strengthen `DATABASE_SPEC.md`, `ENVIRONMENT_SPEC.md`, and `NAMING_SPEC.md` so environment identity and `SDKWORK_DATABASE_*` naming are normative.
2. Align authoritative and client-local manifests, contracts, lifecycle directories, and table-prefix registries across the workspace.
3. Move server-side SQLite assets to explicit fixtures or genuine client-local owners.
4. Reject retired application/module database keys in runtime source and checked-in topology configuration.
5. Preserve migration checksums. Complete new migration headers before tracking; record missing historical operational metadata in `migrations/{engine}/metadata.json` without changing migration SQL bytes.
6. Add workspace audit, alignment, unified-profile, metadata, and process-pool regression tests.
7. Repair ownership conflicts for comments, promotion, web framework, and knowledgebase tables.
8. Verify Cloud Router dependency migrations run before catalog refresh and execute the installer against the shared development schema.

## Verification Evidence

- Database framework audit: 93 repositories scanned, 64 database owners, 64 compliant, 0 partial, 0 legacy-only.
- Unified PostgreSQL profile validator: passed.
- Migration metadata alignment dry-run: 0 pending assets.
- Cloud Router database framework and process-shared pool checks: passed.
- Cloud Router installer: `status=installed`, catalog refresh `succeeded`; the `ai_model_pricing.supplier_code` error no longer occurs.
- Governed IM documentation encoding check: strict UTF-8, no BOM, no replacement characters, and no known mojibake markers.

## Recovery

Do not create a fallback database/schema or rewrite lifecycle history when an upgrade fails. Restore immutable migration bytes, add a reviewed module-owned forward migration, preserve existing checksums, and rerun the explicit lifecycle command. Production and staging migration execution remains an operator-controlled job; runtime startup does not auto-migrate.

## Review

This is a cross-repository public naming and database governance migration. Human review is required before merge or production rollout.
