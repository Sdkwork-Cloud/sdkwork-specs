# General Database Contract Standard

- Version: 2.0
- Scope: relational database contracts, schema registry inputs, table naming, logical data types, tenant and subject isolation, indexes, schema evolution, repository access, lifecycle orchestration, and database readiness for SDKWork-owned systems
- Related: `API_SPEC.md`, `PAGINATION_SPEC.md`, `SUBJECT_ID_SPEC.md`, `DATABASE_FRAMEWORK_SPEC.md`, `DATABASE_SPEC_PROCESS_SHARED_POOL.md`, `SCHEMA_REGISTRY_SPEC.md`, `MIGRATION_SPEC.md`, `SECURITY_SPEC.md`, `PRIVACY_SPEC.md`, `WEB_BACKEND_SPEC.md`, `RUST_CODE_SPEC.md`, `TEST_SPEC.md`
- Canonical location: `DATABASE_SPEC.md` in the `sdkwork-specs` standards root

This standard defines portable database contracts for SDKWork. It is intentionally independent of Java, Rust, TypeScript, Python, Go, PHP, C#, ORM choice, migration engine, and database product. Its purpose is to keep table semantics, identity, tenant isolation, query contracts, schema evolution, API/SDK serialization, and lifecycle evidence stable while applications move between standalone, cloud, unified-process, and split-service deployments.

This repository owns global standards only. Repository-specific table inventories, ORM scan results, migration evidence, and rename plans belong in the consuming repository `specs/`, migration plans, or generated audit evidence. They `MUST NOT` be embedded in this global standard.

## 1. Normative Language

The words `MUST`, `MUST NOT`, `SHOULD`, `SHOULD NOT`, and `MAY` are used with RFC-style meaning.

| Term | Meaning |
| --- | --- |
| `MUST` | Required. A contract that violates this rule is not SDKWork-standard. |
| `MUST NOT` | Forbidden. Do not bypass this with local convention. |
| `SHOULD` | Strong recommendation. Deviation requires a documented reason, risk, and exit path. |
| `SHOULD NOT` | Strong negative recommendation. Deviation requires documented justification. |
| `MAY` | Optional capability decided by product, compliance, or deployment needs. |

Standard levels:

| Level | Name | Minimum bar |
| --- | --- | --- |
| L0 | Legacy Compatible | Existing shipped systems with an owner, mapping, risk register, compatibility window, and migration or retirement plan. |
| L1 | Portable Core | Standard names, identity, audit fields, logical types, required constraints, and basic indexes. |
| L2 | Service Ready | Tenant/subject isolation, idempotency, API/SDK serialization, bounded pagination, schema evolution, and contract tests. |
| L3 | Enterprise Grade | Least privilege, privacy classification, audit and ledger evidence, retention, disaster recovery, drift controls, and formal release gates. |

New business tables `MUST` target L1 or higher. Tenant, IAM, permission, account, payment, billing, entitlement, file, message, AI execution, and cross-service write tables `MUST` target L2 or higher. Money, credentials, privacy-sensitive data, legal hold, and critical audit records `SHOULD` target L3.

## 2. Scope

This standard applies to:

- relational tables, schema registry fragments, DDL, migrations, seeds, drift reports, and database review evidence;
- SQL-backed services in Rust, Java/Kotlin, TypeScript/Node.js, Python, Go, PHP, C#, Ruby, and other SDKWork-owned runtimes;
- generated DTOs, OpenAPI schemas, SDK serialization, and repository contracts derived from database fields;
- database-backed read models, projections, indexes, search mirrors, data warehouse exports, and CDC/event materialization;
- database lifecycle bootstrap, migration, seed, health, readiness, and drift orchestration.

This standard does not require one ORM, one language, one schema migration tool, one database engine, or database foreign keys on every table. It does require a portable contract that those tools can validate.

## 3. Core Principles

1. Data contract first: field names, logical types, constraints, and semantics are more stable than ORM annotations or language class names.
2. Explicit ownership: every core table has a business domain, bounded context, system of record, and write owner.
3. Explicit subject scope: tenant, organization, user, owner, and data-scope predicates must be stored and indexed when they affect access control.
4. API/SDK-safe serialization: `int64`, decimal, timestamps, enum values, and JSON must have a cross-language representation.
5. Bounded query cost: list/search contracts define filters, sort, pagination, and indexes before implementation.
6. Evolution by expand and contract: breaking database changes require compatibility, backfill, validation, cutover, and cleanup.
7. Tool-checkable rules: schema linters, repository tests, OpenAPI generation, SDK generation, CI, and drift checks should validate the standard.
8. Legacy is migration-only: L0 compatibility is not an alternate standard for new or pre-launch applications.

## 4. Portable Data Contract

A database table contract `MUST` describe the table independently of any one ORM or database dialect.

| Contract element | Requirement |
| --- | --- |
| `table_name` | Standard physical table name, business domain, and owner. |
| `table_profile` | Primary table profile from section 5. |
| `columns` | Column names, logical types, nullability, defaults, constraints, and serialization. |
| `constraints` | Primary key, unique keys, check constraints, foreign keys, or application-level integrity rules. |
| `indexes` | Query purpose, ordered columns, uniqueness, partial predicates, and lifecycle ownership. |
| `ownership` | Tenant, organization, user, owner, shared-platform, or public-data scope. |
| `security` | Sensitivity, encryption, masking, retention, export, and access rules. |
| `evolution` | Contract version, compatibility window, migration state, rollback or forward-fix plan. |
| `lineage` | Upstream source, downstream consumers, CDC/topic/search/cache/export flows. |
| `quality` | Completeness, uniqueness, validity, consistency, freshness, and drift checks. |

Rules:

- `apis/`, OpenAPI, SDK DTOs, ORM entities, generated repositories, and migrations `SHOULD` be generated from or validated against the contract.
- A core business table `SHOULD` have a single write owner. Multi-writer tables require a command gateway, transactional boundary, or documented concurrency control.
- Shared tables `MUST` declare a system of record and downstream notification mechanism.
- Read models, search indexes, cache tables, and warehouse tables `MUST` declare source tables and rebuild strategy.
- Services `MUST NOT` write another service's owned table only because they can connect to the database.

## 5. Table Profiles

Each authored table `MUST` choose one primary profile and may add secondary profiles.

| Profile | Applies to | Required semantics |
| --- | --- | --- |
| `core_entity` | Stable business object | `id`, `uuid`, audit fields, lifecycle state, version. |
| `tenant_entity` | Tenant-scoped object | `tenant_id`, tenant-leading indexes, audit fields. |
| `user_entity` | User-owned object | `tenant_id`, `user_id`, subject-scope indexes. |
| `owner_entity` | Object owned by variable subject type | `owner_type`, `owner_id`, owner indexes. |
| `relation_entity` | Many-to-many or assignment table | source/target ids, uniqueness, optional audit fields. |
| `tree_entity` | Hierarchy | `parent_id`, path or closure strategy, depth/cycle constraints. |
| `ledger_event` | Financial or immutable ledger fact | append-only semantics, amount/currency, reversal/adjustment model. |
| `audit_event` | Audit or compliance record | actor, action, target, timestamp, trace id, retention. |
| `outbox_event` | Reliable event publication | idempotency, event version, payload hash, dispatch state. |
| `read_model` | Projection or list view | source lineage, rebuild strategy, freshness, query contract. |
| `search_index` | Search mirror | source lineage, analyzer/version, rebuild strategy. |
| `reference_data` | Seed, lookup, or stable dictionary | stable code, semantic version, idempotent seed. |
| `localized_reference_data` | Localized seed, lookup, label, template, or display dictionary | stable base code plus locale-specific translation rows. |
| `operational_state` | Runtime state, locks, jobs, cursors | owner, TTL, concurrency, cleanup. |

## 6. Standard Field Dictionary

### 6.1 `id`

Rules:

- Runtime business tables `MUST` use a stable `int64` logical primary identifier named `id` unless a documented external standard requires another shape.
- Runtime business table DDL `MUST` use `BIGINT NOT NULL PRIMARY KEY` or the database-equivalent non-auto-allocated `int64` primary key.
- The value of `id` `MUST` be generated by an approved SDKWork ID provider before insert. SQL fragments, repositories, mappers, jobs, event consumers, and migrations `MUST NOT` allocate ad hoc ids.
- SDKWork Rust implementations `MUST` reuse the approved SDKWork platform ID service when available instead of creating local snowflake variants.
- Runtime inserts `MUST` explicitly list and bind the `id` column. `RETURNING id` may return the already-bound id; it must not prove that the database allocated the id.
- Runtime business tables `MUST NOT` rely on `BIGSERIAL`, `SERIAL`, `AUTOINCREMENT`, `GENERATED ... AS IDENTITY`, `DEFAULT nextval(...)`, `last_insert_rowid()`, `MAX(id)+1`, random hashes, or database rowid allocation for primary key assignment.
- Snowflake or time-ordered id profiles `MUST` define node id source, clock rollback behavior, sequence overflow behavior, restart behavior, capacity, and monitoring.

### 6.2 `uuid`

Rules:

- Core business tables `SHOULD` expose a stable `uuid` or equivalent public identifier when resources are referenced outside one database boundary.
- `uuid` `SHOULD` be unique within the table and should not reveal creation volume or sequence.
- Public APIs `SHOULD` expose `uuid`, ULID, KSUID, slug, or domain number instead of exposing sequential internal `id` unless the API has an explicit reason.

### 6.3 SQL Primary Key And Insert Binding

Rules:

- Standard runtime tables `MUST` have a primary key.
- SQLite runtime business tables `MUST NOT` use `INTEGER PRIMARY KEY` for SDKWork business ids because that has rowid auto-allocation semantics.
- PostgreSQL, MySQL/MariaDB, SQL Server, Oracle, and SQLite DDL examples `MUST` preserve explicit id binding semantics.
- Generated repositories `MUST` accept already-generated ids or inject the approved ID provider before insert.
- Bulk imports and backfills `MUST` preserve existing stable ids or use a documented deterministic remap table.

### 6.4 Reserved Seed IDs And Stable References

Rules:

- Official installation seeds, built-in directories, platform roles, standard configuration, and records referenced by stable `target_id` values `MUST` use reserved stable ids or stable UUIDs.
- Seed ids `MUST` be deterministic across installations, upgrades, and retries.
- Runtime snowflake ids `MUST NOT` replace reserved ids for built-in records when that would break upgrade idempotency or reference repair.

### 6.4.1 Localized Seed And Translation Tables

Persisted localized data `MUST` keep stable machine fields separate from translated display values.

Recommended shape:

```text
<module>_<resource>
  id
  code
  tenant_id / app_id when scoped
  status
  machine fields

<module>_<resource>_translation
  id
  resource_id or resource_code
  locale
  message_key or field_name
  value
  version
  created_at / updated_at
```

Rules:

- Base tables `MUST` store stable ids, codes, tenant/app scope, status, ordering, and other non-localized machine fields.
- Translation tables `SHOULD` store locale-specific display names, descriptions, labels, templates, and help text.
- Translation tables `MUST` use normalized BCP 47 locale tags according to `I18N_SPEC.md`.
- Translation table uniqueness `MUST` prevent duplicate effective translations, normally `(resource_id, locale, message_key)` or `(resource_code, locale, field_name)`.
- Locale seed scripts `MUST` upsert translations idempotently and record locale/version/checksum through `DATABASE_FRAMEWORK_SPEC.md` seed history.
- Business logic, permission checks, and API machine fields `MUST NOT` depend on localized values. Use stable ids, codes, enums, or translation keys.
- Adding a locale `SHOULD` add translation rows or locale seed files, not schema columns such as `name_en`, `name_zh`, `description_de`, or equivalent per-language column sprawl, unless an approved analytics or legacy compatibility exception exists.

### 6.5 Audit Fields

Standard audit fields:

| Field | Type | Rule |
| --- | --- | --- |
| `created_at` | `instant` | Required on L1+ business tables. |
| `updated_at` | `instant` | Required on mutable L1+ business tables. |
| `created_by` | `int64` | Required when actor audit is needed. |
| `updated_by` | `int64` | Required when mutable actor audit is needed. |
| `trace_id` | `string` | Server-owned request correlation id when persisted. |

Audit times `MUST` be UTC instants. Business code `MUST NOT` write local-time ambiguous values.

### 6.6 Lifecycle Fields

Common lifecycle fields:

| Field | Type | Rule |
| --- | --- | --- |
| `status` | enum/int/string | Required for stateful business resources. |
| `version` | `int64` | Required when optimistic concurrency is used. |
| `deleted_at` | `instant` | Soft delete timestamp. |
| `deleted_by` | `int64` | Soft delete actor. |
| `archived_at` | `instant` | Archive timestamp. |
| `retention_until` | `instant` | Legal, privacy, or lifecycle retention boundary. |

Soft-delete tables `MUST` define how uniqueness behaves for deleted rows.

### 6.7 Ownership Fields

`owner_type` and `owner_id` represent variable ownership across users, organizations, tenants, apps, projects, devices, or service accounts.

Rules:

- `owner_type` values `MUST` come from a documented enum.
- `owner_id` `MUST` be an `int64` subject id when the owner is an SDKWork subject.
- Owner-based access control `MUST` have supporting indexes.

### 6.8 Idempotency And External Event Fields

Common fields:

| Field | Rule |
| --- | --- |
| `idempotency_key` | Client or integration retry key scoped by tenant, actor, method, and resource. |
| `external_provider` | External source system id. |
| `external_id` | External id unique within provider and domain. |
| `external_event_id` | External event unique id for webhook/event dedupe. |
| `payload_hash` | Canonical hash used to detect conflicting duplicate retries. |

Rules:

- Retriable create/command/payment/webhook flows `MUST` have a uniqueness boundary that prevents duplicate side effects.
- Third-party ids `MUST` use provider plus external id boundaries; a bare `external_id` unique across all providers is not sufficient unless the provider is single-valued by contract.

### 6.9 Data Scope Fields

`data_scope` may encode standard visibility or ABAC scope, but it `MUST` be documented and indexed when used for access checks.

ABAC/RLS fields used in policies `MUST` be first-class columns. They `MUST NOT` live only inside JSON.

### 6.10 Tenant, User, And Organization Subject Scope

Runtime business tables follow `SUBJECT_ID_SPEC.md` for subject id semantics.

Rules:

- `tenant_id`, `organization_id`, `user_id`, `created_by`, `updated_by`, `deleted_by`, `owner_id`, and equivalent SDKWork subject references `MUST` be SQL `BIGINT` / logical `int64` when they reference SDKWork IAM, tenant, organization, app, or user subjects.
- These fields `MUST` store resolved numeric subject ids from the trusted request context, not client-provided opaque strings.
- Tenant-scoped tables `MUST` include `tenant_id` and tenant-leading indexes for list/search paths.
- Organization-scoped tables `SHOULD` include `organization_id` when organization isolation affects authorization, listing, or audit.
- User-owned tables `SHOULD` include `user_id` when user ownership affects authorization, listing, or audit.
- Cross-tenant platform tables `MUST` document why `tenant_id` is absent or nullable and how access is authorized.

## 7. Naming Standard

Rules:

- Table and column names `MUST` use lowercase `snake_case`.
- New business table names `MUST` follow `<module_prefix>_<entity_name>`.
- `<module_prefix>` `MUST` be a registered business module or bounded-context prefix, not a product name, company name, deployment name, programming language, framework, or legacy project prefix.
- Entity names `SHOULD` use singular nouns. Collection semantics should be represented by relation tables or child entities.
- Standard suffixes include `_history`, `_event`, `_snapshot`, `_detail`, `_item`, `_relation`, `_binding`, `_assignment`, `_outbox`, `_inbox`, `_read_model`, and `_audit`.
- Foreign key-like fields `SHOULD` use `<entity>_id` or a domain-specific subject field name such as `tenant_id` and `organization_id`.
- Index names `SHOULD` follow `idx_<table>_<purpose_or_columns>`, unique constraints `uk_<table>_<columns>`, and foreign keys `fk_<table>_<target>`.
- Existing project-level prefixes may be registered only as L0 migration facts. New/pre-launch tables `MUST NOT` keep them.

## 8. Logical Types

### 8.1 Type Mapping

| Logical type | SQL shape | API/SDK shape |
| --- | --- | --- |
| `int64` | `BIGINT` | string in JSON HTTP contracts when precision matters. |
| `decimal` | `DECIMAL(p,s)` / `NUMERIC(p,s)` | string or structured `{ units, nanos }`; never float/double for money. |
| `instant` | timestamp with UTC semantics or approved text profile | ISO 8601 UTC string. |
| `date` | date | ISO date string. |
| `boolean` | boolean or constrained integer | boolean. |
| `enum` | integer or short string with dictionary | typed enum, tolerant reader for unknown values. |
| `json` | JSON/JSONB/TEXT with schema | typed object or documented extension map. |
| `binary` | bytea/blob | base64 or object-storage reference. |

Rules:

- `int64` and decimal wire behavior must align with `API_SPEC.md` and SDK generation.
- Money, tax, exchange rate, balance, quota, credit, points, and usage-billing values `MUST NOT` use float/double.
- Enums `MUST` document values, meanings, lifecycle, compatibility behavior, and unknown-value handling.

### 8.1.1 TEXT-Stored `instant` Compatibility

Some L0/L1 SQLite or legacy tables store logical `instant` values as TEXT. This is allowed only when the format is canonical ISO 8601 UTC and lexical ordering matches chronological ordering.

Rules:

- TEXT-stored instants `MUST` use a single normalized UTC format.
- PostgreSQL queries comparing TEXT-stored logical instants `MUST` use explicit casts such as `expires_at::timestamptz > $1::timestamptz` when the physical column type is text.
- Rust sqlx queries `MUST NOT` bind `chrono::DateTime<Utc>` directly against TEXT instant columns without the required cast or adapter.
- New L2+ PostgreSQL tables `SHOULD` use timestamp types with UTC semantics instead of TEXT for instants.

## 9. Standard DDL Templates

A standard table DDL `SHOULD` include:

- explicit `id BIGINT NOT NULL PRIMARY KEY`;
- `uuid` when externally referenced;
- tenant/subject fields required by the profile;
- audit and lifecycle fields;
- unique constraints and supporting indexes;
- comments or schema registry metadata for non-obvious semantics;
- migration identity and contract version evidence.

DDL `MUST NOT` hide required columns behind ORM-only defaults that are absent from the actual database contract.

## 10. Index Standard

Rules:

- Every index `MUST` serve a named query, uniqueness, integrity, lifecycle, or migration purpose.
- Tenant-scoped list indexes `MUST` lead with `tenant_id` unless a documented query plan proves a different order is required.
- Stable list ordering `SHOULD` include a unique tie-breaker such as `id`.
- Large-table indexes `SHOULD` document online creation, backfill, lock impact, rollback/forward-fix, and monitoring.
- Duplicate, unused, or queryless indexes `SHOULD` enter cleanup review.

## 11. Constraints And Referential Integrity

Rules:

- Business uniqueness `MUST` be enforced by a database unique constraint, partial unique constraint, or documented serializing write boundary.
- Foreign key columns `SHOULD` be indexed.
- Database foreign keys are recommended when they match ownership and lifecycle boundaries; cross-service ownership may use application-level integrity with audit and repair jobs.
- Case-insensitive unique fields such as email or domain names `MUST` define normalization, collation, and uniqueness strategy.

## 12. Enum Standard

Rules:

- Enums `MUST` document code, label, meaning, lifecycle, default, unknown-value handling, and compatibility behavior.
- Persisted enum values `SHOULD` avoid reusing retired values for new meanings.
- API and SDK enum representations `MUST` stay compatible with persisted values.

## 13. JSON And Semi-Structured Data

Rules:

- JSON fields `MAY` store extensions, provider payloads, sparse metadata, or low-frequency attributes.
- JSON fields `MUST` have a schema, version, validation strategy, and migration policy when used by production code.
- JSON `MUST NOT` be the only storage for tenant, owner, permission, amount, status, idempotency, lifecycle, or high-frequency filter/sort fields.
- Generated DTOs and OpenAPI schemas `SHOULD` represent stable JSON shapes.

## 14. Money, Measurement, And Precision

Rules:

- Money fields `MUST` store amount and currency. Currency `SHOULD` follow ISO 4217 unless a domain-specific unit is documented.
- Decimal precision, scale, rounding mode, tax basis, discount basis, and exchange-rate source `MUST` be documented for financial tables.
- Usage, quota, token, point, and unit balances `MUST` document unit, precision, reset or settlement semantics, and overflow behavior.

## 15. Time Standard

Rules:

- Runtime timestamps `MUST` use UTC semantics.
- API/SDK timestamp values `MUST` serialize as ISO 8601 UTC strings unless a specific external protocol says otherwise.
- Timezone-specific business dates `MUST` store both the date and the timezone or business calendar when required.
- Expiration, TTL, and legal-retention logic `MUST` define clock source, grace period, and cleanup ownership.

## 16. Multi-Tenant And Permission Filtering

Rules:

- Access-control predicates `MUST` be derived from trusted request context, not client-writable table fields or request bodies.
- Query paths that list tenant, organization, user, owner, or scoped data `MUST` apply the corresponding predicate before repository results are returned.
- Platform-level cross-tenant queries `MUST` require explicit admin/service authorization and audit evidence.
- Permission, role, and ABAC condition fields used by policies `MUST` be first-class indexed columns when they affect online access.
- Tests `MUST` cover cross-tenant and cross-user denial cases for security-sensitive repositories.

## 17. Idempotency And Consistency

Rules:

- Retriable create, payment, webhook, message delivery, outbox, and command operations `MUST` define idempotency behavior.
- A duplicate idempotency key with the same request fingerprint `SHOULD` return the original result or current operation state.
- A duplicate idempotency key with a different fingerprint `MUST` be rejected as a conflict.
- Outbox/inbox tables `SHOULD` include event version, aggregate id, payload hash, dispatch state, retry count, and next retry time.
- Cross-aggregate writes `SHOULD` use events, sagas, or explicit transaction boundaries with retry behavior.

## 18. Logs, Audit, And Ledger

Rules:

- Audit events `MUST` include actor, action, target, timestamp, trace id, and outcome when used for compliance or security.
- Ledger facts `MUST` be append-only or must use explicit reversal/adjustment records.
- Sensitive values such as passwords, tokens, private keys, verification codes, OAuth codes, and raw credentials `MUST NOT` be stored in logs, audit text, error messages, or unrestricted JSON blobs.
- Audit and ledger retention `MUST` align with privacy, legal hold, and regional requirements.

## 19. Security And Compliance

Rules:

- Sensitive columns `MUST` declare sensitivity, encryption, masking, retention, export, and access rules.
- High-sensitivity fields `SHOULD` use envelope encryption, tokenization, or an approved secret store when raw storage is not required.
- Data export paths `SHOULD` log actor, target, scope, reason, expiration, and destination.
- Data residency and cross-border synchronization `MUST` be reviewed for regulated data.
- Privacy deletion and retention workflows `MUST` document hard delete, anonymization, archive, and legal hold behavior.

## 20. API And SDK Contract

### 20.1 Field Naming

Database fields use `snake_case`. API/SDK fields follow `API_SPEC.md` and language-specific SDK conventions. Mapping must be deterministic and documented when names differ.

### 20.2 Serialization Rules

Rules:

- `int64` values that may exceed JavaScript safe integer range `MUST` serialize as strings in JSON HTTP APIs.
- Decimal values `MUST` serialize as strings or an approved structured decimal representation.
- Instants `MUST` serialize as ISO 8601 UTC strings.
- Enums `MUST` preserve unknown-value compatibility in generated SDKs.

### 20.3 Version And Concurrency

Rules:

- Mutable tables `SHOULD` use `version`, ETag, or equivalent revision fields when concurrent updates are possible.
- Failed optimistic concurrency checks `MUST` map to standard API precondition/conflict errors.

### 20.4 OpenAPI, GraphQL, gRPC

Rules:

- OpenAPI schemas `MUST` preserve database logical type semantics.
- gRPC/protobuf schemas `SHOULD` use `int64`, string decimal, and `google.protobuf.Timestamp` or equivalent safe representations.
- Generated SDKs `MUST` not hide precision, nullability, or enum compatibility problems.

### 20.5 Query, Sort, And Pagination Contract

Indexes must serve an explicit query contract before implementation.

Each list/search contract `MUST` declare:

| Field | Requirement |
| --- | --- |
| Filters | Allowed `WHERE` fields and their tenant/subject predicates. |
| Sort | Allowed sort fields, default sort, and unique tie-breaker. |
| Pagination | `cursor`/keyset or bounded `offset`. |
| Max page size | Public APIs `MUST` cap `page_size`; default `20`, max `200` unless a documented exception exists. |
| Scope | Tenant, organization, user, owner, or data-scope predicate. |
| Consistency | Primary/read-replica and freshness expectation. |

Rules:

- Large or fast-growing lists `MUST` use keyset/seek pagination on an indexed stable sort with a unique tie-breaker, for example `(updated_at, id)`.
- Offset pagination is allowed only for small tables, low-frequency admin lists, or capped page ranges.
- Persisted table lists `MUST` paginate in SQL with `LIMIT` or keyset predicates.
- Repository `find_all` followed by service `skip`/`take`/`slice` is forbidden.
- Projection/read-model lists `MUST` use incrementally maintained sorted indexes; rebuilding an unbounded collection per request and slicing it is forbidden.
- Query-shape changes require schema/index review because they affect API, SDK, and runtime cost.
- Cross-layer pagination authority is `PAGINATION_SPEC.md`.

## 21. Multi-Language Implementation Contract

Rules:

- Language models, ORM entities, SQL mappers, generated repositories, DTOs, and SDK schemas `MUST` preserve the portable contract.
- A language-specific default value or annotation `MUST NOT` replace a database constraint when the constraint is required for integrity.
- Rust sqlx, Java JPA, TypeScript query builders, Python ORMs, Go database access, and C# data layers `MUST` use parameter binding.
- Generated code `SHOULD` be regenerated from the contract rather than hand-edited.
- Language-specific packages `MUST` not fork ID generation, tenant filtering, pagination, or lifecycle behavior when a standard SDKWork utility exists.

## 22. Structure Evolution Standard

Rules:

- Schema changes `MUST` be versioned and reviewable.
- Breaking changes `MUST` use expand/backfill/compatible-read/cutover/contract flow.
- Field deletion `MUST` verify API, SDK, warehouse, search, cache, event, and consumer usage has migrated.
- Backfills `MUST` be resumable, observable, bounded, and safe to retry.
- Rollback or forward-fix strategy `MUST` be documented before release.
- Schema drift checks `SHOULD` compare contracts, migrations, live schema, ORM entities, and generated SDK/OpenAPI outputs.
- L0 compatibility windows `MUST` have owner, risk, and removal milestone.

## 23. Data Lifecycle

Rules:

- Stateful resources `MUST` document state machine, valid transitions, terminal states, and audit behavior.
- Archive, TTL, purge, legal hold, anonymization, and export flows `MUST` document ownership and scheduling.
- Cold/hot separation `MUST` define query entry points so applications do not assume the hot table contains full history.
- Backups and recovery objectives `SHOULD` be documented for L2 and `MUST` be documented for L3.

## 24. Derived Data And Read Models

Rules:

- Derived tables `MUST` declare source tables/events, transform version, rebuild procedure, freshness expectation, and drift detection.
- Read models `MUST` be rebuildable or have a documented recovery strategy.
- Search and cache mirrors `MUST` preserve permission and tenant filtering semantics.
- Data lineage `SHOULD` cover warehouse, lakehouse, CDC, topics, search indexes, caches, and reports.

## 25. Non-Relational Database Adaptation

Rules:

- Document stores, search engines, column stores, object stores, and event streams `MUST` preserve identity, tenant scope, lifecycle, security, and lineage semantics from this standard.
- Non-relational systems `MUST` define the equivalent of primary identity, uniqueness, query shape, pagination, retention, and rebuild strategy.
- A non-relational optimization `MUST NOT` become the sole source of truth for fields whose authoritative contract is relational unless explicitly approved.

## 26. Automated Check Rules

CI, schema linters, migration tools, or repository audits `SHOULD` implement these rule identifiers.

| Rule | Level | Requirement |
| --- | --- | --- |
| DB001 | MUST | Table and column names use lowercase `snake_case`. |
| DB002 | MUST | Persistent business tables have primary keys. |
| DB003 | MUST | L1+ business tables have `id`, `created_at`, and `updated_at` where mutable. |
| DB004 | SHOULD | Core business tables have unique `uuid` or equivalent external id. |
| DB005 | MUST | Tenant-scoped tables have `tenant_id`. |
| DB006 | MUST | Tenant-scoped list indexes lead with `tenant_id` unless justified. |
| DB007 | MUST | Money and precise numeric fields do not use float/double. |
| DB008 | MUST | `int64` API serialization strategy is declared. |
| DB009 | SHOULD | Status fields have enum documentation or dictionary. |
| DB010 | MUST | Idempotent flows have a unique dedupe boundary. |
| DB011 | SHOULD | JSON fields have schema or typed DTO. |
| DB012 | MUST | Sensitive fields have classification and storage strategy. |
| DB013 | MUST | Breaking schema changes have expand/contract plan. |
| DB014 | SHOULD | Foreign-key-like columns have supporting indexes. |
| DB015 | SHOULD | Large-table index changes document online strategy. |
| DB016 | MUST | Time fields use UTC/ISO 8601 strategy. |
| DB017 | SHOULD | Soft-delete tables define uniqueness behavior. |
| DB018 | MUST | L3 tables have audit, retention, recovery, and validation plan. |
| DB019 | SHOULD | Derived tables declare source object and sync version. |
| DB020 | MUST | Platform cross-tenant queries are explicitly authorized. |
| DB021 | MUST | Shared tables have system of record and write owner. |
| DB022 | SHOULD | Contracts have version and compatibility window. |
| DB023 | MUST | Case-insensitive unique fields define normalization strategy. |
| DB024 | SHOULD | Large tables document partitioning, sharding, or growth plan. |
| DB025 | MUST | Critical concurrent writes have locks, versions, conditional updates, or unique constraints. |
| DB026 | SHOULD | List queries have sort and pagination contracts. |
| DB027 | MUST | Public APIs cap maximum `page_size`. |
| DB027A | MUST | Persistent lists paginate in SQL/keyset or maintained indexes; in-process full-load slicing is forbidden. |
| DB028 | SHOULD | L3 tables have RPO/RTO and recovery exercise evidence. |
| DB029 | SHOULD | CDC downstream compatibility is included in schema evolution. |
| DB030 | MUST | Field deletion verifies SDK, warehouse, search, cache, and consumers have migrated. |
| DB031 | SHOULD | Data quality covers completeness, uniqueness, validity, and consistency. |
| DB032 | SHOULD | Critical tables expose slow-query, lock-wait, CDC-delay, and data-quality metrics. |
| DB033 | MUST | Passwords, tokens, private keys, and verification codes never appear in logs/audit/error text. |
| DB034 | SHOULD | Object-storage resources have metadata table or manifest. |
| DB035 | MUST | Event schema has version and unknown-field compatibility policy. |
| DB036 | SHOULD | Text unique fields declare charset, collation, and normalization. |
| DB037 | MUST | Core tables declare business domain and write owner. |
| DB038 | SHOULD | Shared semantics declare bounded context. |
| DB039 | SHOULD | Snapshot and denormalized fields declare source and schema version. |
| DB040 | MUST | EAV/JSON does not carry amount, status, tenant, permission, idempotency, or lifecycle core fields. |
| DB041 | SHOULD | L2/L3 tables have capacity model and index forecast. |
| DB042 | SHOULD | Duplicate or queryless indexes enter cleanup review. |
| DB043 | MUST | High-sensitivity fields declare sensitivity and masking rule. |
| DB044 | SHOULD | Data export paths have audit and expiration strategy. |
| DB045 | SHOULD | Warehouse, search, cache, and topic fields have lineage. |
| DB046 | SHOULD | L3 critical fields declare freshness SLO. |
| DB047 | MUST | ABAC/RLS policy fields are not JSON-only. |
| DB048 | SHOULD | Policy-as-code has version, tests, and rollback plan. |
| DB049 | MUST | ID generation declares clock rollback, node conflict, and failure behavior. |
| DB050 | SHOULD | Public ids do not expose sequential internal ids by default. |
| DB051 | MUST | Third-party ids use provider plus external id uniqueness boundary. |
| DB052 | MUST | Money fields declare currency, precision, and rounding mode. |
| DB053 | SHOULD | Tax, discount, and exchange-rate fields declare calculation basis and source. |
| DB054 | MUST | L3 tables declare read consistency and replica-delay strategy. |
| DB055 | MUST | Data residency and cross-border sync enter security review. |
| DB056 | SHOULD | Reference/seed/lookup data is managed by idempotent scripts or controlled release. |
| DB057 | MUST | Published reference codes are not reused with new meanings. |
| DB058 | SHOULD | CI or scheduled audits execute schema drift checks. |
| DB059 | MUST | ORM, DDL, schema registry, API, and SDK contract changes stay synchronized. |
| DB060 | SHOULD | L3 tables have operational runbook and exercise record. |
| DB061 | MUST | New business table first segment is a registered business module prefix. |
| DB062 | MUST | Table prefixes do not use product, project, company, or technology names as default business prefix. |
| DB063 | SHOULD | Product/deployment namespace lives at schema/catalog/database layer, not table-name prefix. |
| DB064 | MUST | Module prefix registers owner, bounded context, and example tables. |
| DB065 | MUST | Cross-module shared tables use the source-of-record module prefix. |
| DB066 | SHOULD | Legacy project-level prefixes have target module prefix mapping and cleanup plan. |
| DB067 | MUST | Multiple entity contracts mapped to one physical table have shared-semantics proof or conflict remediation. |
| DB068 | MUST | Legacy table-prefix gaps are classified by priority and risk. |
| DB069 | MUST | Owner-review tables confirm system-of-record owner before target name approval. |
| DB070 | SHOULD | External channel, connector, and provider account tables use `integration_` or a more specific approved prefix. |
| DB071 | SHOULD | Workspace, project, application, and template design-time assets use `studio_` or a more specific approved prefix. |
| DB072 | SHOULD | Entity annotations, DDL, migrations, audit files, and schema linter rules share the same prefix registry. |

## 27. Design Review Checklist

New table review:

- [ ] Business domain, bounded context, and write owner are declared.
- [ ] Table profile and standard fields are selected.
- [ ] Tenant, organization, user, owner, and data-scope semantics are correct.
- [ ] ID generation, UUID/public id, and seed id behavior are documented.
- [ ] Localized persisted values, when present, are modeled with stable base rows plus translation rows and deterministic locale seed history.
- [ ] Query shapes, indexes, sort, pagination, and page-size limits are documented.
- [ ] API/SDK serialization for `int64`, decimal, instant, enum, and JSON is safe.
- [ ] Sensitive fields, retention, export, deletion, and audit behavior are documented.
- [ ] Migration, backfill, rollback/forward-fix, and drift checks are ready.
- [ ] Repository tests cover isolation, pagination, conflicts, and idempotency where relevant.

## 28. Anti-Patterns

Forbidden or migration-only patterns:

- New runtime tables using database auto-increment ids for SDKWork business identity.
- Project-level table prefixes for new business tables.
- Catch-all `common`, `system`, `data`, or `misc` tables without bounded context.
- JSON/EAV as the only storage for core query, permission, amount, status, lifecycle, or idempotency fields.
- Unbounded repository `find_all` followed by service/client pagination.
- Direct pool construction in handlers, services, repositories, or background jobs.
- Raw SQL string concatenation with user input.
- Manual production schema edits without reconciliation into migrations and schema registry.

## 29. Adoption Route

New systems:

- Define the schema contract before DDL, ORM entities, repositories, and SDKs.
- Register module prefixes and ownership before creating tables.
- Wire schema validation, migration tests, repository tests, and API/SDK generation into CI.

Existing systems:

- Register L0 compatibility facts in the owning repository.
- Map legacy names, ids, timestamps, tenant fields, and table prefixes to the standard.
- Classify gaps by risk and prioritize P0 conflict fixes before renames.
- Migrate through expand/backfill/validate/cutover/contract; do not rename physical tables without a separate plan.

## 30. Legacy Compatibility And Migration Boundaries

Legacy compatibility exists only to migrate already-launched systems. It is not an alternate design path for new or pre-launch applications.

Rules:

- New applications and new modules `MUST` implement this standard directly.
- Legacy Java/JPA base classes, historical table prefixes, ORM filters, and old migration scripts `MAY` be mapped to this standard only as registered L0 compatibility inputs.
- An L0 database exception `MUST` record owner, affected tables, compatibility window, risk, target standard name, migration or retirement plan, and validation evidence.
- Global standard files `MUST NOT` hard-code consumer repository paths, one-off scan counts, physical table inventories, or consumer-specific rename backlogs.
- Physical table rename work `MUST` be handled by a separate migration plan with expand/backfill/validate/cutover/contract steps, rollback or forward-fix strategy, and release evidence.

Generic compatibility mapping examples:

| Legacy concept | Standard target |
| --- | --- |
| historical base entity with tenant fields | `tenant_entity` plus audit and lifecycle fields. |
| historical base entity without tenant fields | `core_entity` plus audit and lifecycle fields. |
| historical user-owned entity | `user_entity` with `tenant_id`, `user_id`, and subject-scope indexes. |
| historical tree entity | `tree_entity` with parent id, path, level, sort order, and cycle/depth constraints. |
| historical owner fields | `owner_scope` with `owner_type`, `owner_id`, and indexed ownership predicates. |
| historical short version field | `version` with optimistic concurrency semantics. |
| historical creation/update time fields | `created_at`, `updated_at` with UTC serialization. |
| ORM tenant filters | standard tenant, organization, user, owner, and data-scope predicates enforced before repository access. |

## 31. Minimum Compliance Example

An L2 multi-tenant business table `MUST` declare stable identity, tenant scope, audit fields, lifecycle fields, optimistic concurrency, and query-serving indexes.

```sql
CREATE TABLE content_document (
    id BIGINT NOT NULL,
    uuid VARCHAR(64) NOT NULL,
    tenant_id BIGINT NOT NULL,
    organization_id BIGINT NOT NULL DEFAULT 0,
    user_id BIGINT NOT NULL,
    data_scope INTEGER NOT NULL DEFAULT 1,
    title VARCHAR(200) NOT NULL,
    status INTEGER NOT NULL,
    metadata JSON,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    deleted_at TIMESTAMP,
    deleted_by BIGINT,
    PRIMARY KEY (id),
    CONSTRAINT uk_content_document_uuid UNIQUE (uuid)
);

CREATE INDEX idx_content_document_tenant_user_status_updated
    ON content_document (tenant_id, organization_id, user_id, status, updated_at, id);
```

The table contract `MUST` state the ID provider, external id policy, subject scope source, status enum, JSON schema, HTTP/SDK serialization, delete/archive policy, optimistic concurrency field, and list/search contract.

## 32. Database Connection Pool Standard

SDKWork-owned runtime services `MUST` create database pools through `sdkwork-database`, the approved database framework, or an approved adapter with equivalent configuration, telemetry, and lifecycle behavior.

Rules:

- Production runtime code `MUST NOT` call low-level pool constructors such as `SqlitePoolOptions::new()`, `PgPoolOptions::new()`, or equivalent constructors directly from handlers, services, repositories, background jobs, or migrations.
- Pool construction `MUST` be centralized in the database lifecycle layer, application bootstrap, or `sdkwork-database` adapter.
- Pool configuration `MUST` be environment/profile driven and must not hard-code credentials, hostnames, pool sizes, or table prefixes in business code.
- Every production pool `MUST` expose health, readiness, latency, acquire timeout, active/idle connection, and migration/drift status metrics.
- Tests `MAY` use simplified in-memory or temporary database helpers, but those helpers must stay under test code.

## 33. Database Lifecycle Framework Integration

### 33.1 Overview

Database bootstrap, migration, seed data, drift observation, lifecycle SPI, and standard `db:*` commands follow `DATABASE_FRAMEWORK_SPEC.md` and `PNPM_SCRIPT_SPEC.md`.

### 33.2 Configuration

Database-owning applications `SHOULD` provide service-scoped keys such as:

```text
SDKWORK_<SERVICE>_DATABASE_URL
SDKWORK_<SERVICE>_DATABASE_ENGINE
SDKWORK_<SERVICE>_DATABASE_PROFILE
SDKWORK_<SERVICE>_DATABASE_MAX_CONNECTIONS
SDKWORK_<SERVICE>_DATABASE_MIN_CONNECTIONS
SDKWORK_<SERVICE>_DATABASE_ACQUIRE_TIMEOUT
SDKWORK_<SERVICE>_DATABASE_IDLE_TIMEOUT
SDKWORK_<SERVICE>_DATABASE_MAX_LIFETIME
```

The concrete manifest shape, directory layout, and lifecycle hooks are owned by `DATABASE_FRAMEWORK_SPEC.md`.

### 33.3 SQLite And PostgreSQL Profiles

Rules:

- SQLite profiles `SHOULD` apply WAL mode, busy timeout, foreign key enforcement, and safe synchronous mode through the approved adapter.
- SQLite runtime business IDs `MUST` still be generated by the SDKWork ID provider.
- PostgreSQL profiles `SHOULD` configure `application_name`, SSL mode, statement timeout, acquire timeout, idle timeout, and pool bounds explicitly.
- Shared-process and IM process pool budgets follow `DATABASE_SPEC_PROCESS_SHARED_POOL.md` where applicable.

### 33.4 Deployment Profiles

Rules:

- `standalone` profile: each service owns its configured database or schema and must still follow this table contract.
- `cloud` profile: database configuration comes from managed deployment configuration and must expose lifecycle/drift health.
- `unified-process` profile: embedded modules must share the approved process-level lifecycle pools and must not open independent pools against the same DSN.
- `split-services` profile: each service owns its lifecycle bootstrap and must not assume local process sharing.
- `test` profile: temporary or in-memory databases may be used only through test helpers or approved lifecycle adapters.

## 34. Repository Standard

Repositories are the persistence boundary. They translate domain query contracts into bounded database operations and must not become business-service or API-controller substitutes.

Rules:

- Repository interfaces `SHOULD` be named by aggregate/domain intent, not by generic table CRUD alone.
- Repository methods `MUST` accept typed filters, typed sort options, pagination input, request scope, and transaction context where relevant.
- Repository methods `MUST` enforce tenant, organization, user, owner, and data-scope predicates before returning business data.
- Repository methods `MUST NOT` load unbounded rows and rely on service-layer `skip`/`take`/`slice` pagination.
- `find_all`, `list_all`, or equivalent helpers `MUST NOT` be used on P0/P1 interactive or public API paths unless the data set is statically bounded and documented.
- Entity/record structs `MUST` remain persistence data shapes; business workflows, authorization decisions, and API response assembly belong in service or handler layers.
- Raw SQL is allowed only when the query shape, indexes, pagination, tenant predicates, parameters, and result mapping remain explicit and reviewed.
- Repository code `MUST` use parameter binding and must not concatenate user input into SQL.

Repository tests `SHOULD` cover tenant and ownership isolation, sorting, pagination boundaries, optimistic concurrency conflicts, idempotency behavior, and L0 registered table compatibility.

## 35. Database Health, Migration, And Lifecycle

Database health checks and lifecycle operations are part of production readiness, not optional documentation.

Rules:

- Every database-owning service `SHOULD` expose database health and readiness signals through the standard application health surface.
- Readiness `MUST` fail when required migrations are missing, the pool cannot acquire a connection within the configured timeout, or the schema drift state blocks writes.
- Health signals `SHOULD` include latency, acquire timeout, pool size, active connections, idle connections, migration version, and drift status.
- Schema changes `MUST` use managed migrations or an approved lifecycle framework; ad hoc manual SQL is allowed only as a documented incident action with post-incident reconciliation.
- Application roots with relational databases `MUST` provide the standard `database/` asset structure required by `DATABASE_FRAMEWORK_SPEC.md`.
- Lifecycle orchestration `MUST` use `sdkwork-database` or an approved compatible adapter; applications must not maintain a competing lifecycle engine.
- The executable L1 framework profile is defined by `../sdkwork-database/specs/DATABASE_FRAMEWORK_STANDARD.md`.

## 36. Summary

This standard is about portable data semantics, not a single programming language, ORM, or database product.

A compliant SDKWork database design keeps these contracts stable:

- `id` and `uuid` define internal identity, external references, and cross-store synchronization.
- `created_at`, `updated_at`, and `version` define audit and concurrency semantics.
- `tenant_id`, `organization_id`, `user_id`, `owner_type`, `owner_id`, and `data_scope` define isolation and ownership.
- `status`, `deleted_at`, `archived_at`, and `retention_until` define lifecycle state.
- `idempotency_key`, `external_event_id`, and `payload_hash` define retry and event consistency.
- Query contracts, indexes, and pagination prevent unbounded runtime scans.
- Structure evolution, schema registry, drift checks, and review evidence keep the standard enforceable over time.
