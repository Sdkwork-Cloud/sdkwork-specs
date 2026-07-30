# REQ-2026-0730 Repository Generated-State Boundary

Status: accepted
Owner: SDKWork platform
Date: 2026-07-30
Source: platform, security, reliability, governance

## Problem

SDKWork standards require `.runtime/sdkwork-app/` while the workspace directory dictionary does not
define `.runtime/` and the runtime directory standard assigns development data elsewhere. Consumer
repositories consequently use `.runtime/` for unrelated process state, build caches, tests, generated
config, logs, release inputs, and decoded signing material. The directory is broadly ignored by git
and validators, so ownership and cleanup failures remain hidden.

## Goals

- Remove repository/application `.runtime/` as an allowed generated-state location.
- Keep build output and caches in tool-native directories.
- Keep process coordination and disposable scratch state in private OS/CI runtime or temporary paths.
- Prevent signing material from entering any source checkout.
- Make the directory boundary executable through one workspace layout validator.
- Migrate SDKWork topology orchestration and `sdkwork-im` without compatibility writes or stale docs.

## Non-Goals

- Moving durable application/user data into temporary storage.
- Replacing native Cargo, Vite, Flutter, Gradle, or test-runner cache conventions.
- Introducing a new repository-level generated-state manifest or replacement catch-all directory.
- Changing application APIs, SDK wire contracts, or end-user behavior.

## Acceptance Criteria

- The runtime, workspace, topology, pnpm, TypeScript, test, migration, and supply-chain standards agree on one generated-state boundary.
- `sdkwork-app` uses an OS runtime path keyed by the canonical repository real-path hash.
- `sdkwork-im` has no source, script, active documentation, or generated-state dependency on `.runtime/`; defensive ignore rules remain.
- Cargo lock isolation remains supported under `target/sdkwork/` and Vite surfaces remain isolated below `node_modules/.vite/`.
- Tests and generated config use unique OS/CI temporary paths with cleanup.
- Decoded signing material uses a private external temporary path and is removed on success and failure.
- `check-workspace-layout.mjs` rejects repository/application/nested `.runtime/` directories and is included in repository verification.
- Targeted tests, cross-reference scans, Markdown checks, `git diff --check`, and affected repository checks pass.

## Non-Functional Requirements

Security: runtime state is user-private; process records are validated before termination; signing
material never enters source trees.

Performance: native build caches remain reusable and surface-qualified; runtime path resolution is
deterministic and does not recursively scan repositories.

Reliability: writes are atomic, stale state is removed, concurrent repositories cannot collide, and
topology-based stop fallback remains available when state is absent.

Maintainability: one shared topology runtime-state module owns path derivation; consumers compose it
instead of copying path/hash logic.

## Trace

Specs: `RUNTIME_DIRECTORY_SPEC.md`, `SDKWORK_WORKSPACE_SPEC.md`, `APP_RUNTIME_TOPOLOGY_SPEC.md`,
`PNPM_SCRIPT_SPEC.md`, `CODE_STYLE_SPEC.md`, `TYPESCRIPT_CODE_SPEC.md`, `SUPPLY_CHAIN_SECURITY_SPEC.md`,
`MIGRATION_SPEC.md`, `TEST_SPEC.md`

Decision: `ADR-20260730-repository-generated-state-boundary.md`

Migration: `MIG-2026-0730-repository-generated-state-boundary.md`

## Verification

```text
node tools/check-workspace-layout.mjs --root .
node --test tools/check-workspace-layout.test.mjs
node tools/verify-repo.mjs --root .
git diff --check
```
