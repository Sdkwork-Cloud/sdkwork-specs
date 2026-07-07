# DATABASE_SPEC — Process Shared Pool Addendum

<!-- SDKWORK-SPEC-ADDENDUM: process-shared-pool v2 -->

This addendum extends `DATABASE_SPEC.md` section 32 and section 33.4 for **every IM deployment profile**
(`standalone`, `cloud`, `unified-process`, `split-services`).

## Scope

Each IM OS process that talks to PostgreSQL MUST expose **one process-level connection budget**
for the IM DSN, regardless of deployment topology.

## Required pool layout (per IM process)

| Layer | Count per process | Bootstrap entry | Consumers |
| --- | --- | --- | --- |
| sqlx lifecycle pool | **1** | `sdkwork-im-database-pool::bootstrap_im_process_database_pools_from_env` or `try_bootstrap_im_process_database_pools_from_env` | migrations/lifecycle, `/readyz`, async services |
| r2d2 synchronous pool | **1** | same (`ImSharedPostgresR2d2Pool`) | journal, realtime, projection, social, space, audit, rtc-state adapters |

## Rules

1. Every IM HTTP/RPC ingress or `*-service-bin` process MUST call `bootstrap_im_service_database_from_env()` (from `sdkwork-im-service-readiness`) or `try_bootstrap_im_process_database_pools_from_env()` once at startup when PostgreSQL is configured.
2. PostgreSQL adapters MUST reuse the shared r2d2 pool via `ensure_im_process_postgres_r2d2_pool()` / `clone_shared_im_postgres_r2d2_pool()`. They MUST NOT construct independent r2d2 pools in non-test code.
3. Adapter `connect_pool()` / `build_*_pool()` MUST fail closed when shared pools are not installed instead of silently opening a second pool.
4. Pool capacity MUST come from `DatabaseConfig` (`SDKWORK_{SERVICE}_DATABASE_MAX_CONNECTIONS` / `MIN_CONNECTIONS`) through `from_database_config` / `from_pool_config`.
5. IAM and sibling platform dependencies (Drive, Mail, Commerce, etc.) keep their own `SDKWORK_{SERVICE}_DATABASE_*` lifecycle pools and MUST NOT borrow the IM shared pool.
6. Integration tests MAY construct local pools under `cfg(test)` only.

## Applies to

| Profile | Entry processes |
| --- | --- |
| `standalone.unified-process.*` | `sdkwork-im-standalone-gateway` |
| `cloud.*` | `sdkwork-im-cloud-gateway` |
| `split-services.*` | `session-gateway`, `session-gateway-rpc`, `sdkwork-comms-conversation-service`, `sdkwork-comms-conversation-rpc`, `sdkwork-comms-conversation-internal-rpc`, `projection-service`, `ops-service`, `audit-service`, `comms-social-service`, `space-service`, and other IM `*-service-bin` processes |

## Reference implementation

- `sdkwork-im/crates/sdkwork-im-database-pool/src/shared_postgres.rs`
- `sdkwork-im/crates/sdkwork-im-service-readiness/src/lib.rs` (`bootstrap_im_service_database_from_env`)

## Deprecated naming

`bootstrap_im_unified_process_pools_from_env` and `ImUnifiedProcessPools` remain as compatibility aliases only. New code MUST use `bootstrap_im_process_database_pools_from_env` / `ImProcessDatabasePools`.
