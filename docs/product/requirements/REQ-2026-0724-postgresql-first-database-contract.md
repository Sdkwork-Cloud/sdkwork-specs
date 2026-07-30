# REQ-2026-0724 PostgreSQL-First Database Contract

Status: ready
Owner: SDKWork platform
Date: 2026-07-24
Source: platform, reliability, governance

## Problem

SDKWork database standards describe portable logical contracts but historically treated PostgreSQL and SQLite as peer physical targets in lifecycle layouts, templates, and tests. That model drives server implementations toward the SQLite feature ceiling, permits SQLite-only evidence for server behavior, duplicates migrations mechanically, and leaves the authority of client-local data ambiguous.

## Goals

- Make PostgreSQL the mandatory authoritative relational implementation for every SDKWork service, server, container, cloud workload, shared worker/gateway, and system-of-record data owner.
- Make SQLite an explicitly client-local embedded implementation with isolated security, lifecycle, recovery, and synchronization contracts.
- Preserve logical contract portability without requiring physical DDL, migration, feature, or test parity.
- Raise database design gates to professional PostgreSQL standards for types, constraints, transactions, indexes, query plans, migrations, roles, observability, backup, restore, and recovery.
- Make tenant and organization isolation mandatory in schema and ordinary runtime SQL, with zero unresolved static violations and narrowly governed cross-organization operations.
- Make the role boundary executable through manifests, templates, validators, and tests.

## Non-Goals

- Migrating every consumer repository in one unreviewed bulk change.
- Requiring SQLite in clients that do not have a concrete local-data or offline requirement.
- Treating a PostgreSQL-compatible service as conformant without provider-specific evidence.
- Making client-local authorization, prices, quotas, permissions, entitlements, ledgers, or audit state authoritative on the server.
- Requiring unsafe down migrations for irreversible or lossy changes.

## Users

- Backend and platform engineers designing authoritative persistence.
- Desktop/mobile/native engineers implementing local and offline data.
- Database reliability, security, migration, and release reviewers.
- Agents and validators maintaining SDKWork database contracts.

## Acceptance Criteria

- `DATABASE_SPEC.md` declares `authoritative-server` PostgreSQL and `client-local` SQLite roles with no server fallback.
- `DATABASE_FRAMEWORK_SPEC.md` separates PostgreSQL server assets from SQLite client-local assets and uses manifest schema version 2 role declarations.
- The authoritative database template contains PostgreSQL assets only; a separate client-local SQLite template is available.
- The canonical validator rejects missing/ambiguous roles, mixed engines, server SQLite assets, client-local PostgreSQL assets, and unsafe migration pairing assumptions.
- `TEST_SPEC.md` requires real PostgreSQL server evidence and separate SQLite client-local tests.
- Organization-scoped tables include both `tenant_id` and `organization_id`; ordinary runtime SQL binds both scopes from trusted context.
- Cross-organization system operations are typed, independently authorized, fixed and bounded, audited, machine-inventoried, and rejected outside their exact approved SQL shape.
- Pre-launch and commercial gates reject every unresolved tenant/organization isolation violation without known-debt allowances.
- Runtime/config/deployment/desktop standards do not authorize SQLite for a backend service, including a desktop-started service.
- `MIGRATION_SPEC.md` and a migration record define how existing server SQLite and mixed roots reach the new boundary.
- Targeted validator tests, terminology scans, Markdown checks, and `git diff --check` pass.

## Non-Functional Requirements

Security: PostgreSQL roles and search paths are least-privilege; ordinary repositories fail closed on missing or mismatched tenant/organization scope; cross-organization operations are independently authorized and audited; client-local files, keys, identity boundaries, and purge behavior are explicit; server APIs never trust local authority claims.

Privacy: client-local data declares minimization, encryption, backup/export, retention, logout/account-switch purge, and deletion behavior.

Performance: PostgreSQL P0/P1 queries have representative plan/buffer evidence; indexes and pool capacity are query- and workload-driven; SQLite writer/WAL behavior is bounded.

Reliability: PostgreSQL migrations declare locks, timeouts, rewrites, backfills, recovery, backup/restore, RPO/RTO, and transaction retry semantics; SQLite declares migration interruption, disk-full, corruption, and rebuild behavior.

## Affected Surfaces

- database contracts and lifecycle framework
- configuration, environment, runtime directory, deployment, and desktop boundaries
- migration, testing, quality gate, and code review standards
- database templates, scaffolding, materialization, and validation tools

## Trace

Specs: `DATABASE_SPEC.md`, `DATABASE_FRAMEWORK_SPEC.md`, `DATABASE_SPEC_PROCESS_SHARED_POOL.md`, `MIGRATION_SPEC.md`, `TEST_SPEC.md`, `QUALITY_GATE_SPEC.md`, `CODE_REVIEW_SPEC.md`, `CONFIG_SPEC.md`, `ENVIRONMENT_SPEC.md`, `RUNTIME_DIRECTORY_SPEC.md`, `DEPLOYMENT_SPEC.md`, `DESKTOP_APP_ARCHITECTURE_SPEC.md`

Decision: `ADR-20260724-postgresql-authority-sqlite-client-local.md`

Migration: `MIG-2026-0724-postgresql-first-database-roles.md`

## Verification

```text
node tools/check-database-framework-standard.mjs --root <application-root>
node --test tools/check-database-framework-standard.test.mjs
node tools/check-repository-docs-standard.mjs --root .
git diff --check
```
