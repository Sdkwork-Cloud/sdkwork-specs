# ADR-20260724 PostgreSQL Authority And SQLite Client-Local Storage

Status: proposed
Requirement: REQ-2026-0724
Owner: SDKWork platform
Date: 2026-07-24
Specs: `DATABASE_SPEC.md`, `DATABASE_FRAMEWORK_SPEC.md`, `MIGRATION_SPEC.md`, `TEST_SPEC.md`

## Context

SDKWork must support rich server-side relational behavior and useful desktop/mobile local data. Treating PostgreSQL and SQLite as interchangeable physical targets creates a lowest-common-denominator architecture: PostgreSQL-native integrity and operational capabilities are avoided, migrations are duplicated or text-converted, service tests run only on SQLite, and client-local data can accidentally become a second system of record.

## Decision

PostgreSQL is the sole authoritative relational engine for SDKWork services, servers, containers, cloud workloads, shared workers/gateways, and system-of-record data. SQLite is the embedded database for declared client-local modules only.

Every database contract declares exactly one role:

- `authoritative-server` with exactly PostgreSQL.
- `client-local` with exactly SQLite.

Logical contracts may share identity, serialization, and business semantics, but PostgreSQL and SQLite own separate physical contracts, assets, migrations, histories, tests, and operational policies. PostgreSQL-native constraints, types, transactions, locks, indexes, RLS, JSONB, plans, roles, backup/restore, and observability are first-class. SQLite local storage is isolated by environment/profile/origin/account, treats server-derived data as a projection, and requires explicit offline synchronization when local mutations exist.

Production migrations are forward-first. Down migrations are optional and exist only for bounded, tested, data-preserving reversal; lossy changes use compatible application rollback, forward-fix, or restore/cutover.

## Alternatives

- Keep PostgreSQL and SQLite as peer service engines: rejected because it weakens the authoritative design and produces misleading compatibility evidence.
- Use SQLite for standalone or desktop-started backend services: rejected because runtime packaging does not change server data authority, concurrency, recovery, or operational requirements.
- Ban SQLite entirely: rejected because embedded local caches, drafts, offline projections, local search, and device-local data are legitimate client concerns.
- Maintain one physical schema and mechanically translate SQL: rejected because PostgreSQL and SQLite differ in types, constraints, DDL locks, transactions, concurrency, indexes, JSON, collations, and operational behavior.
- Require a down migration for every change: rejected because destructive reversal can be less safe than forward repair or restore/cutover and often gives false rollback confidence.

## Consequences

- Server repositories gain a clear PostgreSQL feature and quality baseline.
- Client-local SQLite becomes optional and explicitly owned instead of an implicit compatibility target.
- Existing SQLite-only server and mixed-engine modules require classification and migration.
- Database manifest schema version 2 is a compatibility boundary and needs coordinated framework/consumer adoption.
- CI cost increases because authoritative integration tests require real PostgreSQL and representative data for critical plans.
- Managed PostgreSQL-compatible services need provider-specific qualification evidence.
- Human review is required before accepting this root-standard and cross-repository migration direction.

## Verification

- The database validator rejects mixed or role-inconsistent manifests and layouts.
- Server tests use real PostgreSQL; client-local tests use SQLite only for their role.
- Terminology scans find no active standard that authorizes server SQLite or mandatory PostgreSQL/SQLite parity.
- Consumer migration follows `MIG-2026-0724-postgresql-first-database-roles.md`.

## Supersedes / Superseded By

Supersedes the implicit peer-engine lifecycle policy in database framework manifest schema version 1. No prior ADR is removed.
