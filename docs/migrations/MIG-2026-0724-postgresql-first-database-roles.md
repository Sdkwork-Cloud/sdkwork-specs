# MIG-2026-0724 PostgreSQL-First Database Roles

Status: proposed
Requirement: REQ-2026-0724
Decision: ADR-20260724-postgresql-authority-sqlite-client-local
Owner: SDKWork platform
Type: database, config, runtime, test

```yaml
id: MIG-2026-0724
owner: sdkwork-platform
status: proposed
requirement: REQ-2026-0724
type: mixed
scope:
  producers:
    - sdkwork-specs
    - sdkwork-database
  consumers:
    - SDKWork repositories with relational database assets or drivers
compatibility_window:
  starts_at: 2026-07-24
  ends_at: 2026-10-31
strategy: expand-contract
rollback:
  supported: true
  steps:
    - keep the previous application reader compatible during PostgreSQL cutover
    - stop new writes before any storage-boundary rollback
    - reconcile captured writes into PostgreSQL or restore/cut over PostgreSQL
    - never return authority to a stale SQLite file
```

## Classification Gate

Each database root and runtime process must be classified before mutation:

| Current state | Target |
| --- | --- |
| PostgreSQL service root | `authoritative-server`, manifest schema v2, PostgreSQL-only assets |
| SQLite native/client root | `client-local`, manifest schema v2, SQLite-only assets and local-data policy |
| SQLite service/server root | PostgreSQL authoritative migration; SQLite may remain only as a separately owned client-local module |
| Mixed PostgreSQL/SQLite parity root | Split authoritative and client-local contracts, assets, histories, tests, and owners |
| Rebuildable client cache | Recreate from PostgreSQL/API authority rather than migrate as truth |
| Offline/local-only client writes | Preserve through explicit identity, sync, conflict, rejection, and reconciliation plan |

Ambiguous roots stop at classification and require an owner-approved ADR. Registry engine names or existing directories are evidence, not proof of authority.

## Migration Sequence

1. Inventory manifests, DDL, migrations, repositories, drivers, data volumes, writers/readers, runtime targets, backup paths, and test engines.
2. Declare the current and target database role, data owner, PostgreSQL version/extensions, client-local mode, and compatibility window.
3. Upgrade framework/runtime parsing for manifest schema version 2 before enforcing it in consumer CI.
4. For PostgreSQL server roots, remove SQLite from authoritative `engines`, stop generating/copying SQLite baselines, and make PostgreSQL migration/repository tests blocking.
5. For SQLite server roots, design the PostgreSQL physical schema from the logical contract; validate types, time/decimal/JSON encodings, constraints, collation, identity, indexes, transactions, and query plans.
6. Provision PostgreSQL with least-privilege owner/migrator/runtime/backup roles, fixed `search_path`, extensions, TLS, pool budget, metrics, backups, and restore rehearsal.
7. Move data with an idempotent resumable loader, CDC/dual-write, or a bounded maintenance window. Validate counts, keys, constraints, aggregates, checksums, tenant isolation, and rejected rows.
8. Run shadow reads or parallel verification where risk requires it, then stop old writers and cut authoritative traffic to PostgreSQL.
9. Split legitimate SQLite client-local assets into the owning native/client module. Add local-data policy, separate migrations, security/purge/recovery tests, and sync mapping.
10. Remove server SQLite commands, driver selection, fallbacks, parity tests, and mechanically converted migrations after the compatibility window.
11. Enable strict validators and close the migration only when no authoritative writer or server release path targets SQLite.

## PostgreSQL Cutover Evidence

- Empty bootstrap and supported-version upgrade migration pass on real PostgreSQL.
- Data validation covers counts, uniqueness, foreign/check constraints, nullability, decimal/time/JSON normalization, tenant scope, and sampled business aggregates.
- Repository tests cover tenant denial, idempotency, optimistic concurrency, SQLSTATE mapping, serialization/deadlock retry, and read-after-write semantics.
- P0/P1 query plans use representative cardinality and record scans, buffers, timing class, and spill behavior.
- Migration evidence covers locks, timeouts, rewrites, WAL/replica impact, backfill rate/progress, cancellation, and recovery.
- Roles, TLS, search path, pool budget, monitoring, backups, restore/PITR, RPO, and RTO are verified.

## Client-Local Evidence

- SQLite is owned by a client/native module and never opened by a backend service.
- Files and keys are isolated by environment/profile/origin/account and use platform-private paths.
- PRAGMAs, writer coordination, WAL checkpoints, busy retry, disk-full, corruption, upgrade interruption, and rebuild are tested.
- Encryption, secure key storage, backup/export, background/lock behavior, logout/account-switch purge, and uninstall behavior are documented and tested.
- Offline writes have identity mapping, idempotency, ordering, tombstones, conflicts, retries, rejection quarantine, reconciliation, and user recovery.
- Server APIs ignore local authority claims and reapply authentication, authorization, pricing, quota, entitlement, ledger, and audit invariants.

## Rollback And Forward Fix

- Before cutover, rollback may stop the migration and keep the old writer while PostgreSQL is rebuilt.
- During dual-write, rollback requires reconciliation evidence and a single declared authority at every point.
- After PostgreSQL cutover, application rollback must remain PostgreSQL-compatible. Data rollback uses PostgreSQL restore/PITR, captured-write replay, or forward-fix.
- SQLite must never regain server authority after it has fallen behind PostgreSQL.

## Exit Criteria

- All server/shared relational manifests are schema v2 `authoritative-server` with PostgreSQL only.
- All SQLite manifests are schema v2 `client-local` and owned by client/native modules.
- No server startup, development, test, or release path falls back to SQLite.
- No active tool copies or blindly transliterates PostgreSQL DDL into SQLite DDL.
- PostgreSQL and client-local quality gates pass independently.
- Human governance review accepts the ADR and migration completion evidence.
