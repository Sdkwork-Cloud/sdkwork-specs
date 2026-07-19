# ADR-20260719 Process-Shared Database Pool

Status: accepted
Requirement: REQ-2026-0719
Owner: SDKWork platform
Date: 2026-07-19

## Context

SDKWork aggregation gateways embed IAM and multiple business modules. Several assemblies called module `*_from_env()` constructors, multiplying a nominal ten-connection setting into many independent pools. Mixed `PgPool`, `AnyPool`, and r2d2 drivers also made pool ownership ambiguous and contributed to PostgreSQL connection storms during recovery.

## Decision

Each OS process owns exactly one process-local pool for a normalized database identity. The process entrypoint enables and creates the pool before module bootstrap. Embedded lifecycle modules, service hosts, repositories, readiness checks, and routes reuse cloned handles. Identity mismatch fails startup. Cross-process multiplexing belongs to PgBouncer or an approved managed pooler.

The canonical Rust async PostgreSQL driver is `sdkwork_database_sqlx::DatabasePool::Postgres`. Incompatible in-process drivers must migrate or move behind an API/RPC process boundary. Temporary exceptions are explicit, capacity-bounded, validator-visible, and time-limited.

## Alternatives

- Increasing PostgreSQL `max_connections`: rejected because it preserves multiplicative pool ownership and reconnect storms.
- One pool per embedded module: rejected because module count silently multiplies process capacity.
- A global pool shared across OS processes: impossible as an in-memory runtime abstraction; external pooling is the correct boundary.

## Consequences

- Application entrypoints and component contracts must expose pool ownership and injection evidence.
- Compatibility `*_from_env()` constructors must resolve the installed process pool first.
- Driver migrations are required for Drive `AnyPool` and IM r2d2 code before those processes can claim strict single-pool compliance.
- Pool capacity becomes observable and reviewable per process.

## Verification

- `check-process-shared-database-pool.mjs` validates contracts and entrypoint ordering.
- Repository contract tests reject independent embedded pool construction.
- Live PostgreSQL checks compare process readiness with `pg_stat_activity` connection counts.
