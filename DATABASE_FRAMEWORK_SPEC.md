# SDKWork Database Framework Standard

- Version: 1.0
- Status: active
- Scope: application database lifecycle, standardized `database/` asset layout, migration and seed governance, schema drift observation, lifecycle SPI hosted in `sdkwork-database`, bootstrap and upgrade orchestration, locale-aware initialization data
- Related: `DATABASE_SPEC.md`, `SCHEMA_REGISTRY_SPEC.md`, `SDKWORK_WORKSPACE_SPEC.md`, `MIGRATION_SPEC.md`, `CONFIG_SPEC.md`, `ENVIRONMENT_SPEC.md`, `PNPM_SCRIPT_SPEC.md`, `WEB_BACKEND_SPEC.md`, `API_SPEC.md`, `SECURITY_SPEC.md`, `OBSERVABILITY_SPEC.md`, `I18N_SPEC.md`, `TEST_SPEC.md`, `QUALITY_GATE_SPEC.md`, `RELEASE_SPEC.md`, `GOVERNANCE_SPEC.md`, `DOCUMENTATION_SPEC.md`
- Detail implementation profile: `../sdkwork-database/specs/DATABASE_FRAMEWORK_STANDARD.md` (L1 framework repository authoritative for crate APIs, SPI trait signatures, CLI commands, and verification harnesses)

This standard defines how SDKWork applications **build, initialize, upgrade, observe, and govern** relational databases. `DATABASE_SPEC.md` owns table semantics, logical types, naming, indexes, tenant isolation, connection pools, and repository boundaries. This file owns **database lifecycle orchestration** and the **application asset dictionary** that lifecycle consumes.

## 1. System Model

```text
sdkwork-specs (L0)
  DATABASE_SPEC.md            -> table/field/index semantics, pool rules
  DATABASE_FRAMEWORK_SPEC.md  -> lifecycle, directory, SPI, drift, seed locale
       -> narrows
sdkwork-database/specs/DATABASE_FRAMEWORK_STANDARD.md (L1 executable profile)
       -> enforced by
sdkwork-database crates (L2 runtime)
  sdkwork-database-spi          -> normative SPI traits and registry contracts
  sdkwork-database-history      -> ops history tables, checksum queries, migration/seed recording
  sdkwork-database-lifecycle    -> bootstrap / migrate / seed orchestration
  sdkwork-database-contract     -> contract parsing and expected schema model
  sdkwork-database-drift        -> expected-vs-actual diff engine
  sdkwork-database-ops          -> ops status/migrations/seeds read models
  sdkwork-database-ops-http       -> axum routes for /backend/v3/ops/database/*
  sdkwork-database-config       -> existing config types
  sdkwork-database-sqlx         -> existing pool implementation
  sdkwork-database-repository   -> existing repository layer (legacy migration manager deprecated)
  sdkwork-database-cli          -> validate / plan / init / migrate / seed / drift CLI
       -> extended by
application database modules (L3)
  database/ assets + optional SPI hooks
```

Rules:

- Every SDKWork application or backend service repository that owns a relational database `MUST` follow this standard for lifecycle assets and bootstrap behavior.
- Table and column semantics `MUST` still follow `DATABASE_SPEC.md`. Lifecycle assets `MUST NOT` redefine naming or logical-type rules.
- All connection pools `MUST` still be created through `sdkwork-database` as defined in `DATABASE_SPEC.md` section 32.
- Unified-process application ingress `MUST` install one IM sqlx lifecycle pool and one shared r2d2 PostgreSQL pool per process via `bootstrap_im_process_database_pools_from_env()` (or `bootstrap_im_service_database_from_env()`); embedded modules `MUST NOT` open independent pools against the same DSN. Applies to standalone, cloud, unified-process, and split-service IM processes. See `DATABASE_SPEC.md` section 33.4 and `DATABASE_SPEC_PROCESS_SHARED_POOL.md`.
- Application-specific lifecycle behavior `MUST` extend the framework through SPI traits defined in `sdkwork-database-spi`. Applications `MUST NOT` fork lifecycle orchestration into ad-hoc installers unless an approved exception exists.
- The canonical database framework repository is `sdkwork-database`. Business repositories `MAY` ship `database/` assets and SPI implementations; they `MUST NOT` ship competing lifecycle engines.
- Java and other non-Rust runtimes `SHOULD` consume the same `database/` asset dictionary and manifest contracts. Their first-party reference implementation is Rust in `sdkwork-database`; parity tests `MUST` validate asset compatibility even when runtime orchestration differs.

## 2. Design Goals

| Goal | Requirement |
| --- | --- |
| Contract-first | Expected schema comes from `database/contract/` before migrations or ORM code |
| Engine-portable | The same lifecycle model works for PostgreSQL and SQLite at minimum |
| Upgrade-safe | Forward migrations are idempotent, tracked, checksum-verified, and release-gated |
| Initialization-safe | Seed data is locale-aware, profile-aware, idempotent, and auditable |
| Observable | Running services expose drift status through backend ops APIs |
| Extensible | Applications plug in through SPI instead of copying framework code |
| Standard-reducing | Default assets + default SPI adapters minimize custom code; extensions are explicit and bounded |
| Industry-aligned | Migration history, checksum, ordering, and drift semantics align with Flyway/Liquibase/Atlas practice without binding to one vendor tool |

## 3. Normative Levels

This document uses RFC-style terms:

| Term | Meaning |
| --- | --- |
| MUST | Mandatory. Non-compliance fails validation. |
| MUST NOT | Forbidden. |
| SHOULD | Strong recommendation. Deviations require documented rationale and exception when enforced by gates. |
| MAY | Optional capability. |

Compliance tiers:

| Tier | Name | Minimum requirement |
| --- | --- | --- |
| L1 | Lifecycle Ready | Standard `database/` layout, manifest, migrations, bootstrap via framework |
| L2 | Contract Governed | `contract/schema.yaml`, registry files, CI validate + migrate + seed smoke |
| L3 | Drift Observable | Drift engine, ops API, release drift gate, seed locale governance |

New application database work `MUST` reach L2 before production release. Platform, IAM, commerce, billing, and multi-tenant shared databases `SHOULD` reach L3.

## 4. Lifecycle Model

### 4.1 Phases

| Phase | Purpose | Primary inputs | Primary outputs |
| --- | --- | --- | --- |
| `design` | Define portable schema contract | domain requirements, `DATABASE_SPEC.md` | `contract/schema.yaml`, registries |
| `materialize` | Produce or validate DDL | contract, engine profile | `ddl/generated/`, CI diff |
| `bootstrap` | Create empty database state | baseline or first migration | empty schema at target version |
| `migrate` | Apply versioned schema changes | `migrations/{engine}/` | updated schema, history row |
| `seed` | Load initialization/reference data | `seeds/common`, `seeds/locales/{locale}` | seeded rows, seed history |
| `operate` | Serve application traffic | `sdkwork-database` pool | runtime queries |
| `observe` | Compare expected vs actual schema | contract + applied migrations + introspection | drift report |
| `govern` | Gate release and upgrades | drift/migration/seed evidence | pass/fail, audit trail |

### 4.2 Lifecycle State Machine

Applications `MUST` treat database state as explicit, not implicit:

```text
UNINITIALIZED
  -> BOOTSTRAPPED        (database reachable, no app schema)
  -> SCHEMA_CURRENT      (all required migrations applied)
  -> SEEDED              (required seed sets applied for selected locale/profile)
  -> OPERATIONAL         (service accepting traffic)
  -> DRIFT_DETECTED      (observed schema differs from expected)
  -> MIGRATING           (migration in progress)
  -> SEEDING             (seed in progress)
  -> FAILED              (migration/seed/bootstrap failed; service must not silently continue in prod)
```

Rules:

- Production services `MUST NOT` enter `OPERATIONAL` when lifecycle state is `FAILED`.
- `AUTO_MIGRATE=true` `MAY` be used in development and controlled staging. Production `SHOULD` use explicit migrate commands or installer orchestration with evidence.
- Seed execution `MUST` be separate from migration execution. Migrations define structure; seeds define initialization data.
- Drift detection `MUST NOT` mutate schema. Repair is a separate governed operation.

### 4.3 Startup Sequence

Default service bootstrap order:

1. Resolve database config from env/TOML per `DATABASE_SPEC.md` section 33.2.
2. Create connection pool through `sdkwork-database-sqlx`.
3. Discover registered `DatabaseModule` SPI providers for the service.
4. Resolve lifecycle policy from `database/database.manifest.json` and runtime env.
5. If enabled, run pending migrations through lifecycle orchestrator.
6. If enabled and not yet seeded for target locale/profile, run seed pipeline.
7. Refresh drift snapshot or schedule background refresh.
8. Expose health and ops endpoints.

Applications with multiple bounded database modules `MAY` register multiple SPI modules. The orchestrator `MUST` execute them in manifest-declared order.

## 5. Application Directory Dictionary

### 5.1 Required Top-Level Layout

Every SDKWork application root or standalone backend service root that owns a database `MUST` include:

```text
database/
  README.md
  database.manifest.json
  contract/
    schema.yaml
    prefix-registry.json
    table-registry.json
  ddl/
    baseline/
      postgres/
      sqlite/
    generated/
  migrations/
    postgres/
    sqlite/
  seeds/
    seed.manifest.json
    common/
    locales/
      zh-CN/
      en-US/
      ja-JP/
      de-DE/
      fr-FR/
      ru-RU/
      ko-KR/
  drift/
    policy.yaml
  fixtures/
tests/
  contract/
    database-framework.contract.test.*
```

Rules:

- `database/` is the only authoritative source for lifecycle assets. Crate-local `migrations/` directories `MUST` migrate into `database/migrations/` or be referenced through SPI asset locators during a compatibility window.
- `database/README.md` `MUST` document owner, engine support, bootstrap commands, verification commands, and related specs.
- `fixtures/` is test-only. Production bootstrap `MUST NOT` read from `fixtures/`.
- Generated artifacts under `ddl/generated/` `MUST NOT` be hand-edited.

### 5.2 Optional Extensions

Applications `MAY` add bounded extensions when declared in `database.manifest.json`:

| Path | Use |
| --- | --- |
| `database/modules/{module-id}/` | Additional bounded database modules within one application root |
| `database/backfill/` | Resumable data backfill scripts separate from schema migrations |
| `database/reports/` | Generated drift or migration reports for CI artifacts |
| `database/tools/` | Thin wrappers only; reusable tooling belongs in repository `tools/` |

Extensions `MUST NOT` replace the core directories in section 5.1.

### 5.3 Workspace Integration

`SDKWORK_WORKSPACE_SPEC.md` `MUST` treat `database/` as a standard application-root directory alongside `apis/`, `sdks/`, `configs/`, and `deployments/`.

Repository verification `SHOULD` include a shared validator:

```bash
pnpm run db:validate
```

## 6. Manifest Contracts

### 6.1 `database.manifest.json`

Required manifest for lifecycle discovery:

```json
{
  "schemaVersion": 1,
  "kind": "sdkwork.database.module",
  "moduleId": "forum",
  "serviceCode": "FORUM",
  "displayName": "Forum Database",
  "owner": "forum-platform",
  "engines": ["postgres", "sqlite"],
  "defaultEngine": "postgres",
  "tablePrefix": "forum_",
  "contractVersion": "1.4.0",
  "baselineStrategy": "migrations-only",
  "modules": [],
  "lifecycle": {
    "autoMigrate": false,
    "seedOnBoot": false,
    "defaultSeedLocale": "zh-CN",
    "defaultSeedProfile": "standard",
    "supportedSeedLocales": ["zh-CN", "en-US", "ja-JP", "de-DE", "fr-FR", "ru-RU", "ko-KR"],
    "activeSeedLocales": ["zh-CN"],
    "driftCheckIntervalSec": 60
  },
  "paths": {
    "contract": "contract/schema.yaml",
    "migrations": "migrations",
    "seeds": "seeds",
    "driftPolicy": "drift/policy.yaml"
  },
  "spi": {
    "provider": "default",
    "hooks": []
  }
}
```

Rules:

- `moduleId` `MUST` be stable, lowercase, kebab-case or snake_case, and unique within the application root.
- `serviceCode` `MUST` map to `SDKWORK_{SERVICE}_DATABASE_*` env prefix per `DATABASE_SPEC.md` section 33.2.
- `contractVersion` `MUST` follow semantic versioning aligned with `DATABASE_SPEC.md` section 22.
- `activeSeedLocales` controls which locale directories are eligible for execution. Directories for inactive locales `MUST` still exist once declared in `supportedSeedLocales`.
- `baselineStrategy` `MUST` be one of: `migrations-only`, `baseline-plus-migrations`, `baseline-only-dev`.

### 6.2 `contract/schema.yaml`

The portable schema contract `MUST` declare:

```yaml
schema_version: 1
kind: sdkwork.database.schema
module_id: forum
contract_version: 1.4.0
owner_team: forum-platform
compliance_level: L2
engines:
  - postgres
  - sqlite
table_prefix: forum_
tables: []
```

Rules:

- `kind` and `schema_version` are required framework metadata.
- Table definitions `MUST` follow `DATABASE_SPEC.md` sections 4–21.
- Contract is the semantic source of truth. Migrations `MUST` implement contract evolution.

### 6.3 Registry Files

`prefix-registry.json` and `table-registry.json` `MUST` list owned prefixes/tables, owner team, compliance level, and lifecycle status (`active`, `deprecated`, `legacy-compat`).

### 6.4 `seeds/seed.manifest.json`

```json
{
  "schemaVersion": 1,
  "kind": "sdkwork.database.seed",
  "i18nVersion": "1.0.0",
  "defaultLocale": "zh-CN",
  "fallbackLocale": "zh-CN",
  "supportedLocales": ["zh-CN", "en-US", "ja-JP", "de-DE", "fr-FR", "ru-RU", "ko-KR"],
  "activeLocales": ["zh-CN"],
  "localeSets": {
    "zh-CN": {
      "version": "1.0.0",
      "required": true,
      "checksum": "sha256:<checksum>",
      "files": ["locales/zh-CN/001_roles.sql", "locales/zh-CN/002_menus.sql"]
    }
  },
  "profiles": {
    "minimal": {
      "common": ["001_system_parameters.sql"],
      "locales": {
        "zh-CN": ["001_roles.sql", "002_menus.sql"]
      }
    },
    "standard": {
      "common": ["001_system_parameters.sql", "002_reference_codes.sql"],
      "locales": {
        "zh-CN": ["001_roles.sql", "002_menus.sql", "003_dictionary.sql"]
      }
    }
  }
}
```

Rules:

- Seed order is explicit in manifest arrays. Directory lexical order alone `MUST NOT` define execution order.
- Locale-specific content `MUST` live under `seeds/locales/{locale}/`.
- Language-neutral reference data `MUST` live under `seeds/common/`.
- A seed file `MUST NOT` mix multiple locales.
- Seed manifests that contain locale-specific data `MUST` declare `i18nVersion`, `defaultLocale`, `fallbackLocale`, `supportedLocales`, `activeLocales`, and `localeSets`.
- `activeLocales` `MUST` be a subset of `supportedLocales`; `defaultLocale` and `fallbackLocale` `MUST` be members of `supportedLocales`.
- `localeSets.{locale}.version` and `checksum` `MUST` change when the locale seed content changes.
- Locale set files `MUST` reference files under `seeds/locales/{locale}/` for the same locale only.

## 7. Migration Standard

### 7.1 File Naming

Migration files `MUST` use sortable names:

```text
migrations/postgres/0001_create_forum_space.up.sql
migrations/postgres/0001_create_forum_space.down.sql
migrations/sqlite/0001_create_forum_space.up.sql
migrations/sqlite/0001_create_forum_space.down.sql
```

Rules:

- Version prefix `MUST` be zero-padded numeric or ISO-like sortable token.
- Every numbered migration `MUST` provide a paired `.down.sql` file; layout validation enforces this pairing.
- Engine-specific syntax differences `MUST` be expressed as separate files under `migrations/{engine}/`, not runtime branching inside one file, except through approved SQL abstraction macros documented in the framework profile.

### 7.2 Migration Metadata Header

Each migration `SHOULD` begin with a structured comment block:

```sql
-- sdkwork:migration
-- id: 0001_create_forum_space
-- engine: postgres
-- module: forum
-- purpose: Create forum_space foundation table
-- reversible: true
-- transactional: true
-- lock: lightweight
-- contract_version: 1.1.0
```

### 7.3 History Tables

The framework `MUST` maintain:

| Table | Purpose |
| --- | --- |
| `ops_schema_migration_history` | Applied migration version, checksum, engine, module, applied_at, applied_by, execution_ms |
| `ops_seed_history` | Applied seed id, locale, profile, i18n version, checksum, applied_at, applied_by |
| `ops_database_installation_state` | Overall module install state, schema version, seed locale/profile, i18n version, environment, status |

Rules:

- Applications `MUST NOT` invent competing history tables without an exception record.
- Migration checksum `MUST` be recorded. Changed migration content after apply `MUST` fail validation in CI and drift ops.

### 7.4 Migration Governance

Rules aligned with `MIGRATION_SPEC.md` and `DATABASE_SPEC.md` section 22:

- Destructive migrations `MUST` use expand/backfill/verify/contract/shrink flow.
- Backfills `MUST` be idempotent and resumable.
- Tenant-sensitive backfills `MUST` include isolation tests.
- Migration plans `MUST` be linked in release evidence for MAJOR contract changes.

## 8. Seed And Locale Standard

### 8.1 Locale Matrix

| Locale directory | Language | Initial execution |
| --- | --- | --- |
| `zh-CN` | Chinese (Simplified) | **Yes — default** |
| `en-US` | English | Reserved |
| `ja-JP` | Japanese | Reserved |
| `de-DE` | German | Reserved |
| `fr-FR` | French | Reserved |
| `ru-RU` | Russian | Reserved |
| `ko-KR` | Korean | Reserved |

Rules:

- Default deployment `MUST` initialize `common` plus `zh-CN` only unless runtime config explicitly selects another active locale.
- Reserved locales `MUST` keep directory placeholders and manifest entries so future activation does not require structural migration.
- Runtime/frontend i18n rules in `I18N_SPEC.md` are separate from database seed locale rules. Seed locale governs persisted initialization data, not frontend message catalogs, SDK locale providers, or request locale negotiation.
- Production deployments `MUST` fail seed planning when the selected seed locale is not declared in `activeLocales`.
- Additional locales `SHOULD` be activated by updating the seed manifest and running `db:seed` for that locale/profile; activation should not require schema migration when translation tables already exist.

### 8.2 Seed Categories

| Category | Location | Examples |
| --- | --- | --- |
| Language-neutral reference | `seeds/common/` | country codes, currency codes, permission codes, config keys |
| Locale-specific display/init data | `seeds/locales/{locale}/` | role names, menu labels, dictionary labels, default templates |
| Environment-only | `database/fixtures/` or test harness | demo users, synthetic load data |

### 8.3 Seed Idempotency

Every seed script `MUST` be safe to re-run:

- Prefer upsert semantics.
- Use deterministic primary keys for bootstrap rows where possible.
- Record execution in `ops_seed_history`.
- Record locale, profile, `i18nVersion`, locale set version, and checksum for locale-specific seed execution.
- Partial failure `MUST` roll back the seed transaction when transactional engine support exists.

### 8.4 Runtime Configuration

Environment variables `MUST` follow:

```bash
SDKWORK_{SERVICE}_DATABASE_SEED_LOCALE=zh-CN
SDKWORK_{SERVICE}_DATABASE_SEED_PROFILE=standard
SDKWORK_{SERVICE}_DATABASE_SEED_I18N_VERSION=1.0.0
SDKWORK_{SERVICE}_DATABASE_SEED_ON_BOOT=false
SDKWORK_{SERVICE}_DATABASE_AUTO_MIGRATE=false
SDKWORK_{SERVICE}_DATABASE_DRIFT_INTERVAL_SEC=60
SDKWORK_{SERVICE}_DATABASE_MODULE_ID=forum
```

Rules:

- Config resolution `MUST` be documented in `ENVIRONMENT_SPEC.md` and surfaced through typed runtime config in `CONFIG_SPEC.md`.
- `DATABASE_SEED_LOCALE` and `DATABASE_SEED_I18N_VERSION` configure database initialization only. They `MUST NOT` be treated as frontend runtime locale or API request locale.
- Secrets, credentials, and tenant-private seed values `MUST NOT` be committed in seed SQL.

## 9. Drift Observation Standard

### 9.1 Purpose

Drift observation compares **expected schema** with **actual live schema** without applying changes.

Expected schema sources, in order:

1. `database/contract/schema.yaml`
2. Applied entries in `ops_schema_migration_history`
3. Optional module-specific SPI contract overlays

Actual schema source:

- Engine introspection (`information_schema`, `pg_catalog`, `sqlite_master`, index/constraint catalogs)

### 9.2 Diff Taxonomy

| Diff code | Severity default | Meaning |
| --- | --- | --- |
| `missing_table` | error | Expected table absent in database |
| `extra_table` | warn | Database table not declared in expected model |
| `missing_column` | error | Expected column absent |
| `extra_column` | warn | Unexpected column present |
| `type_mismatch` | error | Column type/nullability/default mismatch |
| `missing_index` | warn | Expected index absent |
| `extra_index` | info | Unexpected index present |
| `missing_constraint` | error | Expected PK/UK/check/FK absent |
| `migration_pending` | error | Files pending apply |
| `migration_unknown` | error | Database history contains unknown version |
| `checksum_mismatch` | error | Applied migration content changed after apply |

Severity may be overridden in `drift/policy.yaml`.

### 9.3 Drift Report Shape

```json
{
  "schemaVersion": 1,
  "kind": "sdkwork.database.drift-report",
  "checkedAt": "2026-06-20T12:00:00Z",
  "moduleId": "forum",
  "serviceCode": "FORUM",
  "engine": "postgres",
  "status": "drift_detected",
  "summary": {
    "error": 2,
    "warn": 1,
    "info": 0
  },
  "pendingMigrations": [],
  "diffs": []
}
```

### 9.4 Ops API Exposure

Backend services `SHOULD` expose read-only ops endpoints through `backend-api`:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/backend/v3/ops/database/status` | Pool, lifecycle state, migration version, seed locale/profile |
| `GET` | `/backend/v3/ops/database/drift` | Latest drift report; `?refresh=true` forces introspection |
| `GET` | `/backend/v3/ops/database/migrations` | Applied and pending migrations |
| `GET` | `/backend/v3/ops/database/seeds` | Applied and pending seed sets |

Rules:

- Endpoints `MUST` require backend/admin authorization per `SECURITY_SPEC.md`.
- Reference implementation: `DatabaseOpsAuth` in `sdkwork-database-ops-http`; private bootstrap bearer via unified `SDKWORK_ACCESS_TOKEN` (never app-scoped or browser-visible env names).
- Responses `MUST NOT` expose connection secrets, raw credentials, or business row data.
- Production exposure `SHOULD` be internal or gateway-restricted.
- Drift refresh `SHOULD` be rate-limited to protect database metadata queries.

## 10. SPI Architecture

All lifecycle SPI traits live in `sdkwork-database-spi`. Applications implement or configure SPI providers; the framework orchestrates execution.

### 10.1 Design Principles

| Principle | Rule |
| --- | --- |
| Assets over code | Default behavior reads `database/` manifests and SQL files. SPI is for boundaries, hooks, and exceptional engines |
| Compose, don't fork | Multiple modules compose through registry order |
| Stable trait surface | SPI version increments follow semver; breaking SPI changes require migration notes |
| Zero custom by default | Applications with only standard assets `MAY` use built-in `DefaultDatabaseModule` without custom Rust code |
| Explicit extension | Any non-default behavior `MUST` be declared in manifest `spi` section |

### 10.2 Core SPI Traits

Normative Rust trait names below are authoritative for the reference implementation. Other languages `SHOULD` mirror the same responsibilities.

#### `DatabaseModuleDescriptor`

Static module identity.

```rust
pub trait DatabaseModuleDescriptor {
    fn module_id(&self) -> &str;
    fn service_code(&self) -> &str;
    fn table_prefix(&self) -> &str;
    fn supported_engines(&self) -> &[DatabaseEngine];
}
```

#### `DatabaseAssetProvider`

Resolves lifecycle asset locations.

```rust
pub trait DatabaseAssetProvider {
    fn manifest_path(&self) -> PathBuf;
    fn contract_path(&self) -> PathBuf;
    fn migrations_dir(&self, engine: DatabaseEngine) -> PathBuf;
    fn seeds_dir(&self) -> PathBuf;
    fn drift_policy_path(&self) -> PathBuf;
}
```

Default implementation: load paths from `database.manifest.json`.

#### `DatabaseContractProvider`

Loads expected schema contract.

```rust
pub trait DatabaseContractProvider {
    fn load_contract(&self) -> Result<DatabaseContract, ContractError>;
    fn contract_version(&self) -> Result<Version, ContractError>;
}
```

Default implementation: parse `contract/schema.yaml`.

#### `MigrationProvider`

Supplies migration sets and optional custom execution hooks.

```rust
pub trait MigrationProvider {
    fn list_migrations(&self, engine: DatabaseEngine) -> Result<Vec<MigrationSpec>, MigrationError>;
    fn before_migration(&self, ctx: &MigrationContext) -> Result<(), MigrationError> { Ok(()) }
    fn after_migration(&self, ctx: &MigrationContext) -> Result<(), MigrationError> { Ok(()) }
}
```

Default implementation: scan `migrations/{engine}/*.up.sql`.

#### `SeedProvider`

Supplies seed plans by locale/profile.

```rust
pub trait SeedProvider {
    fn resolve_seed_plan(
        &self,
        locale: &LocaleTag,
        profile: &SeedProfile,
    ) -> Result<SeedPlan, SeedError>;
    fn before_seed(&self, ctx: &SeedContext) -> Result<(), SeedError> { Ok(()) }
    fn after_seed(&self, ctx: &SeedContext) -> Result<(), SeedError> { Ok(()) }
}
```

Default implementation: read `seeds/seed.manifest.json`.

#### `DriftPolicyProvider`

Supplies drift policy overlays.

```rust
pub trait DriftPolicyProvider {
    fn load_policy(&self) -> Result<DriftPolicy, DriftError>;
}
```

#### `SchemaIntrospector`

Optional override for engine-specific introspection.

```rust
pub trait SchemaIntrospector {
    fn introspect(&self, pool: &DatabasePoolHandle) -> Result<LiveSchema, DriftError>;
}
```

Default implementation: built-in PostgreSQL/SQLite introspection in `sdkwork-database-drift`.

#### `DatabaseLifecycleListener`

Cross-cutting hooks.

```rust
pub trait DatabaseLifecycleListener {
    fn on_state_change(&self, event: LifecycleStateEvent) -> Result<(), LifecycleError> { Ok(()) }
    fn on_failure(&self, event: LifecycleFailureEvent) -> Result<(), LifecycleError> { Ok(()) }
}
```

Use for metrics, audit logs, admin notifications, and app-specific pre/post checks.

#### `DatabaseModule`

Composite registration unit exposed to applications.

```rust
pub trait DatabaseModule:
    DatabaseModuleDescriptor
    + DatabaseAssetProvider
    + DatabaseContractProvider
    + MigrationProvider
    + SeedProvider
    + DriftPolicyProvider
{
    fn listeners(&self) -> Vec<Box<dyn DatabaseLifecycleListener>> { Vec::new() }
}
```

Built-in type:

```rust
pub struct DefaultDatabaseModule {
    /* manifest-driven */
}
```

Applications `MAY` register:

- one `DefaultDatabaseModule` when standard assets are sufficient
- one custom `DatabaseModule` implementation
- multiple module instances when using `database/modules/{module-id}/`

### 10.3 SPI Registry

Applications bootstrap lifecycle with a module and orchestrator:

```rust
use std::sync::Arc;

use sdkwork_database_lifecycle::LifecycleOrchestrator;
use sdkwork_database_spi::{DefaultDatabaseModule, LocaleTag, SeedProfile};

let module = Arc::new(DefaultDatabaseModule::from_app_root(".")?);
let orchestrator = LifecycleOrchestrator::new(pool, module);
orchestrator.bootstrap(&LocaleTag::zh_cn(), &SeedProfile::standard()).await?;
```

Multi-module registry orchestration is reserved for database lifecycle SPI; v1 applications use a single `DefaultDatabaseModule` per app root `database/` directory. Cross-module **schema registry** composition is governed by `SCHEMA_REGISTRY_SPEC.md` and implemented in `sdkwork-web-framework` (`sdkwork-web-schema-registry`, `tools/schema_registry/`). Application `database.manifest.json#modules[]` `SHOULD` align with schema registry dependency order.

```rust
let registry = DatabaseModuleRegistry::builder()
    .register(DefaultDatabaseModule::from_manifest(".", "database/database.manifest.json")?)?
    .build();
// registry-wide orchestrator: planned
```

Rules:

- Registry order `MUST` be deterministic and manifest-declared.
- A module `MUST NOT` mutate another module's tables inside hooks unless explicitly documented and tested.
- Custom modules `MUST` still store assets under standard `database/` layout unless an approved exception allows external asset paths via `DatabaseAssetProvider`.

### 10.4 Standard Reduction Path

To minimize application custom code:

| Need | Preferred approach |
| --- | --- |
| Standard single-module app | `DefaultDatabaseModule` only |
| Multiple bounded modules | `database/modules/*` + default providers |
| Custom seed selection | manifest profiles/locales, not code |
| Ignore legacy drift tables | `drift/policy.yaml` |
| Special pre-migrate check | `DatabaseLifecycleListener` |
| Nonstandard engine | new `SchemaIntrospector` SPI impl in framework or app adapter crate |

Applications `SHOULD NOT` implement custom migration runners, custom history tables, or custom drift engines.

## 11. Framework Crate Responsibilities

| Crate | Responsibility |
| --- | --- |
| `sdkwork-database-spi` | Traits, registry, manifest/seed parsing, `DefaultDatabaseModule`, seed plan resolution |
| `sdkwork-database-history` | Ops history DDL, applied migration/seed queries, checksum helpers |
| `sdkwork-database-contract` | Contract parsing, registry validation, expected table names |
| `sdkwork-database-lifecycle` | `LifecycleOrchestrator`, migrate/seed/bootstrap, `LifecycleOptions::from_env` |
| `sdkwork-database-drift` | Introspection, diff engine, report serialization |
| `sdkwork-database-ops` | Ops status/migrations/seeds/drift read models for backend handlers |
| `sdkwork-database-ops-http` | Reference Axum router for `/backend/v3/ops/database/*` |
| `sdkwork-database-config` | Existing env/TOML config; extended with seed/drift/lifecycle options |
| `sdkwork-database-sqlx` | Existing pool creation |
| `sdkwork-database-repository` | Repository layer; legacy inline migration macro only — use lifecycle |
| `sdkwork-database-cli` | Reference CLI (`sdkwork-db`) for validate/plan/init/migrate/seed/drift |

## 12. Command Surface

Application roots `MUST` expose standard commands per `PNPM_SCRIPT_SPEC.md`:

| Command | Purpose |
| --- | --- |
| `db:validate` | Validate manifests, contracts, directories, naming, and registry consistency |
| `db:plan` | Show pending migrations, seed plans, and drift summary without applying changes |
| `db:init` | Bootstrap an empty database through baseline or first migration |
| `db:migrate` | Apply pending migrations |
| `db:seed` | Apply seed plan for selected locale/profile |
| `db:status` | Print lifecycle/installation state |
| `db:drift` | Print drift report |
| `db:drift:check` | Exit non-zero on error-level drift or pending migrations |
| `db:materialize:contract` | Materialize L2 contract registries and manifest fields from baseline DDL |
| `db:bootstrap` | `db:migrate` then `db:seed` for development/bootstrap flows |

Desktop or Tauri hosts that keep an embedded SQLite driver `MAY` mirror the framework baseline into the package runtime and record `database.manifest.json` metadata at startup. CI and shared environments `MUST` still use `sdkwork-database-cli` against `SDKWORK_{SERVICE}_DATABASE_URL`.

CLI backing implementation `MUST` live in `sdkwork-database-cli` or repository `tools/database/` thin wrappers.

## 13. Verification And Quality Gates

### 13.1 Required Tests

| Test | Purpose |
| --- | --- |
| `database-framework.contract.test.*` | Directory/manifest/SPI registration contract |
| migration smoke | Empty DB -> latest schema on both supported engines |
| seed smoke | `common` + default locale/profile idempotency |
| drift clean | Fresh bootstrap yields zero error-level drift |
| checksum immutability | Changed applied migration fails CI |

### 13.2 Gate Matrix

| Gate | Requirement |
| --- | --- |
| Merge | `db:validate` passes for touched database assets |
| Staging deploy | `db:migrate`, `db:seed`, `db:drift:check` |
| Release | Drift report archived; MAJOR contract changes linked to migration plan |
| Production | No error-level drift; no pending migrations |

### 13.3 Documentation

`database/README.md` and service runbooks `MUST` follow `DOCUMENTATION_SPEC.md` and link to this standard.

## 14. Security And Operations

Rules:

- Ops endpoints `MUST` follow `SECURITY_SPEC.md` and `WEB_BACKEND_SPEC.md`.
- Drift and migration status `MAY` expose schema metadata but `MUST NOT` expose secrets or row-level production data.
- Seed scripts `MUST NOT` embed production credentials.
- Migration failures in production `MUST` emit structured logs and metrics per `OBSERVABILITY_SPEC.md`.
- Backup/restore expectations for destructive migrations `MUST` follow `MIGRATION_SPEC.md`.

## 15. Legacy Adoption

Existing repositories with crate-local migrations, bespoke installers, or application-specific bootstrap code `MUST` converge on this standard through a migration plan:

1. Move assets into `database/`.
2. Add manifests and contract files.
3. Register `DefaultDatabaseModule` or adapter module.
4. Replace bespoke installer entrypoints with lifecycle orchestrator calls.
5. Add contract tests and drift gate.
6. Remove legacy bootstrap paths after compatibility window.

Known legacy patterns to converge:

- crate-local `migrations/`
- application-local `DatabaseInstaller`
- TypeScript/Rust ad-hoc schema bootstrap without history tables
- seed data embedded in application code instead of `seeds/`

## 16. Extension And Future Evolution

Future extensions `SHOULD` be added through:

- new manifest fields with `schemaVersion` bump
- new SPI traits rather than changing orchestrator internals
- new diff codes documented in framework profile
- new seed profiles/locales declared in manifests

Potential future capabilities (non-normative roadmap):

- auto-repair plans for selected warn-level drift
- Java lifecycle orchestrator parity crate
- contract-to-migration generator
- admin UI drift dashboard
- multi-database module federation in integrated mode

Extensions `MUST NOT` weaken L1 requirements without governance approval.

## 17. Compliance Checklist

Application database lifecycle is compliant when:

- [ ] `database/` directory matches section 5
- [ ] `database.manifest.json` and `seeds/seed.manifest.json` exist and validate
- [ ] `contract/schema.yaml` and registries exist for L2+
- [ ] Migrations are engine-separated, ordered, checksum-tracked, and history-backed
- [ ] Seeds split `common` vs locale directories; default seed locale is `zh-CN`
- [ ] Locale seed manifests declare `i18nVersion`, fallback/default/supported/active locales, locale set versions, and checksums.
- [ ] Connection pool uses `sdkwork-database`
- [ ] Lifecycle bootstrap uses `sdkwork-database` orchestrator and SPI registry
- [ ] Drift ops endpoints or CLI are available for L3
- [ ] Standard `db:*` commands exist at application root
- [ ] Contract tests and release gates are wired in CI

## 18. Summary

SDKWork database lifecycle is contract-first, migration-governed, seed-locale-aware, and drift-observable. Applications ship standardized `database/` assets, register module SPI providers from `sdkwork-database-spi`, and let the framework orchestrate bootstrap and upgrades. Table semantics remain in `DATABASE_SPEC.md`; lifecycle behavior lives here and in the `sdkwork-database` framework profile.
