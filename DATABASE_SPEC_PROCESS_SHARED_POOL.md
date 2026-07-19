# SDKWork Process-Shared Database Pool Standard

<!-- SDKWORK-SPEC-ADDENDUM: process-shared-pool v3 -->

- Version: 3.0
- Status: active
- Scope: database pool ownership, identity, injection, capacity, and verification for SDKWork runtime processes
- Related: `DATABASE_SPEC.md`, `DATABASE_FRAMEWORK_SPEC.md`, `CONFIG_SPEC.md`, `ENVIRONMENT_SPEC.md`, `OBSERVABILITY_SPEC.md`, `TEST_SPEC.md`

This standard extends `DATABASE_SPEC.md` sections 32 and 33.4. It applies to every SDKWork HTTP gateway, RPC service, worker, CLI host, desktop-started server, standalone process, and cloud process that opens a database connection pool.

## 1. Cardinality Boundary

The normative unit is an OS process, not a repository, module, route surface, or deployment.

Rules:

- For one normalized database identity, an OS process `MUST` create exactly one process-local connection pool.
- A database identity is the tuple `(engine, driver, endpoint, database, schema, credential identity, TLS mode)` after configuration normalization.
- Every module embedded in that process and using the same database identity `MUST` receive or resolve a clone/handle of the process pool. It `MUST NOT` create a second pool.
- Separate OS processes cannot share an in-memory pool. Each process owns one process-local pool. Deployments that need cross-process physical connection multiplexing `MAY` place PgBouncer or an approved managed pooler in front of PostgreSQL.
- Different database identities `MAY` use separate pools only when an application contract and architecture decision explicitly require different databases, schemas, credentials, engines, or drivers. Convenience is not sufficient.

## 2. Integrated Application Rule

An application process that embeds IAM, Drive, Commerce, IM, or other dependency modules is an integrated process.

Rules:

1. The process entrypoint resolves one canonical database URL and schema before any module bootstrap.
2. The process entrypoint creates or enables exactly one canonical pool through `sdkwork-database` or the approved framework for its runtime.
3. Database lifecycle modules run sequentially against clones of that same pool handle.
4. Service hosts, repositories, readiness checks, schedulers, and route assemblies consume the injected/shared handle.
5. Embedded module composition `MUST NOT` call an independent low-level constructor or retain a private `*_from_env()` path that bypasses the installed process pool.
6. If a compatibility `*_from_env()` entry remains, it `MUST` resolve the installed process pool first, validate identity equality, and fail closed on mismatch.
7. A module configured for SQLite inside a PostgreSQL integrated process is non-compliant unless it is explicitly isolated as a different process and documented by an ADR.

## 3. Driver Rule

Pool sharing requires the same driver and pool type.

Rules:

- Rust async PostgreSQL processes `SHOULD` standardize on `sdkwork_database_sqlx::DatabasePool::Postgres` / `sqlx::PgPool`.
- `sqlx::AnyPool`, `sqlx::PgPool`, Diesel pools, SeaORM pools, and `r2d2` pools are different pool identities even when they use the same DSN.
- A process `MUST NOT` claim one shared pool while retaining multiple driver pools.
- Modules using an incompatible driver `MUST` migrate to the process driver or move behind a cross-process API/RPC boundary.
- A temporary multi-driver exception requires an accepted ADR, named owner, removal milestone, explicit combined connection budget, and validator-visible exception metadata.
- A Rust `sqlx::AnyPool` exception additionally requires `SDKWORK_DATABASE_TEMPORARY_ANY_POOL_EXCEPTION=true`. The framework then owns exactly one compatibility `AnyPool`, verifies its normalized identity against the already-installed canonical pool, and reuses it for all compatibility consumers. The flag is invalid without the application contract and ADR, and it does not make the process single-pool compliant.
- Every process with temporary driver exceptions `MUST` set `SDKWORK_DATABASE_TEMPORARY_DRIVER_POOL_COUNT` to the number of incompatible pools before the canonical pool is created. A single AnyPool-only exception may omit the count and use the framework default of `1`. Enabling or increasing exceptions after canonical pool creation fails closed because compatibility capacity was not reserved.
- When temporary driver exceptions are active, the configured process `max_connections` remains the combined limit. For `N` temporary pools, the framework divides that limit across `1 + N` pools, assigns the integer remainder to the canonical pool, and ignores module requests that would enlarge a temporary allocation. Example: process maximum `10` with two temporary pools allocates `4 + 3 + 3`.
- Test-only pools under `tests/`, `cfg(test)`, or isolated test support are excluded when they do not enter production process assembly.

## 4. Rust Bootstrap Contract

The canonical Rust sequence is:

```rust
sdkwork_database_sqlx::enable_process_shared_database_pool();
let host = bootstrap_application_database_from_env().await?;
let pool = host.pool().clone();

bootstrap_iam_database(pool.clone()).await?;
bootstrap_dependency_database(pool.clone()).await?;
let service = ServiceHost::from_database_pool(pool.clone()).await?;
```

Rules:

- `enable_process_shared_database_pool()` (or its approved successor) `MUST` execute before the first pool creation.
- Once enabled, the first successfully created pool becomes the process pool.
- Later `create_pool_from_config()` / `create_pool_from_env()` calls `MUST` return a clone of the installed pool when identity matches.
- Identity mismatch `MUST` fail startup with a redacted diagnostic naming the conflicting engine/database/schema/driver dimensions. Credentials `MUST NOT` be logged.
- The process owner `MUST` expose the shared pool to readiness and graceful shutdown.
- Business handlers and repositories `MUST NOT` install or replace the process pool.

## 5. Connection Budget

`MAX_CONNECTIONS` is a process budget, not a per-module multiplier.

Rules:

- An integrated process declares one owner key such as `SDKWORK_<APPLICATION_CODE>_DATABASE_MAX_CONNECTIONS`.
- Embedded module `SDKWORK_<MODULE>_DATABASE_MAX_CONNECTIONS` values `MUST NOT` create independent capacity when the module uses the process pool.
- `min_connections`, acquire timeout, idle timeout, max lifetime, statement timeout, and application name are owned by the process pool config.
- A temporary multi-driver exception `MUST NOT` multiply the process budget. Framework-owned budget allocation or an equivalent contract-tested allocator must ensure the sum of all temporary driver pool maxima is no greater than the declared process maximum.
- Alternate-driver adapters outside SQLx (for example IM r2d2) `MUST` consume the framework-reserved per-driver maximum rather than splitting or re-reading the process maximum independently.
- PostgreSQL capacity planning `MUST` satisfy:

```text
sum(process pool maxima) + migration/admin reserve + operator reserve <= PostgreSQL max_connections
```

- Development profiles `SHOULD` default to a small bounded pool and leave at least 20 percent of PostgreSQL capacity for administration and recovery.
- Retry loops `MUST` use bounded exponential backoff and `MUST NOT` create unbounded connection storms after PostgreSQL becomes unavailable.

## 6. Unified Database And Schema

Rules:

- Modules integrated into one process `MUST` resolve the same database name and schema unless an approved data-ownership contract requires isolation.
- PostgreSQL `search_path` `MUST` be materialized once in the canonical URL or connection options and reused by every consumer.
- Service-specific URL aliases may remain for compatibility only when they normalize to the canonical identity. A mismatch fails startup.
- Source-controlled profiles contain non-secret database/schema/tuning values; passwords and complete secret-bearing URLs remain in protected overlays or secret managers.
- Development workspace profiles that intentionally share one PostgreSQL database and schema `SHOULD` use the unified `SDKWORK_CLAW_DATABASE_*` fields until a successor workspace profile is approved.

## 7. IM Migration

IM currently exposes an sqlx lifecycle pool and an r2d2 synchronous adapter pool. Under this v3 standard they are two distinct pools, not one shared pool.

Rules:

- New IM adapters `MUST` consume the canonical sqlx process pool.
- Existing r2d2 adapters `MUST` migrate to the canonical driver or be isolated behind a separate process boundary.
- `ImProcessDatabasePools` remains migration infrastructure only; completion requires removal of the second in-process driver pool.
- Until migration completes, IM must declare the temporary exception, combined capacity, owner, and removal milestone in its architecture decision and process-pool contract.

## 8. Machine Contract And Verification

Every database-owning application process `MUST` maintain `specs/process-database-pool.spec.json` with:

- process id and entrypoint;
- canonical driver and pool owner;
- database URL, schema, and max-connection env authorities;
- embedded consumers and injection evidence;
- declared temporary driver exceptions, if any;
- verification commands.

Required verification:

```text
node <sdkwork-specs>/tools/check-process-shared-database-pool.mjs --root <application-root>
```

The validator must fail on:

- a database-owning gateway without a process-pool contract;
- pool enablement missing or ordered after database bootstrap;
- production process code constructing low-level pools outside the approved owner;
- embedded consumers declared with independent pool ownership;
- incompatible database/schema values in one integrated process;
- undeclared multi-driver pools;
- missing evidence paths or verification commands.

## 9. Acceptance Checklist

- [ ] Exactly one pool exists per process and normalized database identity.
- [ ] Process enablement happens before the first database bootstrap.
- [ ] Embedded modules reuse the installed pool handle.
- [ ] Database, schema, driver, credential identity, and TLS mode match.
- [ ] Connection capacity is budgeted once per process.
- [ ] Readiness observes the process pool.
- [ ] Incompatible drivers are migrated, process-isolated, or governed by a temporary ADR.
- [ ] `check-process-shared-database-pool.mjs` passes.
