# REQ-2026-0719 Process-Shared Database Pools

Status: accepted
Owner: SDKWork platform
Date: 2026-07-19

## Goal

Prevent PostgreSQL connection exhaustion and inconsistent schema selection by making every SDKWork runtime process own exactly one pool for each normalized database identity and inject that pool into all embedded modules.

## Non-Goals

- Sharing an in-memory Rust pool across different OS processes.
- Hiding intentionally separate databases or schemas behind one ambiguous URL.
- Preserving incompatible driver pools indefinitely.

## Acceptance Criteria

- `DATABASE_SPEC_PROCESS_SHARED_POOL.md` defines process, identity, driver, schema, and capacity boundaries.
- A canonical validator checks application process-pool contracts and production entrypoints.
- Manager, IM, Birdcoder, Clawrouter, and API Cloud Gateway publish process-pool contracts and pass the validator.
- Integrated modules resolve one database/schema identity and do not independently multiply pool capacity.
- Live verification records PostgreSQL connection counts before startup, after readiness, and after shutdown.

## Reliability

- Pool acquisition fails fast with redacted identity diagnostics.
- Retry loops are bounded and cannot create an unbounded reconnect storm.
- At least 20 percent of PostgreSQL development capacity remains available for recovery and administration.

## Verification

```text
node tools/check-process-shared-database-pool.mjs --root <application-root>
node --test tools/check-process-shared-database-pool.test.mjs
```
