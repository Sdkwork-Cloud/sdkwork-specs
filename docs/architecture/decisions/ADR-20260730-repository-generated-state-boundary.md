# ADR-20260730 Repository Generated-State Boundary

Status: accepted
Requirement: REQ-2026-0730
Owner: SDKWork platform
Date: 2026-07-30
Specs: `RUNTIME_DIRECTORY_SPEC.md`, `SDKWORK_WORKSPACE_SPEC.md`, `APP_RUNTIME_TOPOLOGY_SPEC.md`, `SUPPLY_CHAIN_SECURITY_SPEC.md`

## Context

`.runtime/` became a repository-local catch-all through independent decisions in lifecycle,
development, testing, and release scripts. It mixed state with different owners, durability,
security, and cleanup rules while being omitted from the authored directory dictionary and skipped
by validators. In `sdkwork-im` it held multi-gigabyte Cargo output, Vite cache, tests, logs,
generated config, and a release keystore path.

## Decision

Repository roots, application roots, and nested source modules do not own `.runtime/`.

- Build output and caches use the active tool's native ignored directory.
- Required Cargo isolation stays inside `target/sdkwork/<purpose>/`.
- Shared Vite caches use `node_modules/.vite/<surface-id>/`.
- Development PID/heartbeat/lock state uses the private OS user/runner runtime root at
  `sdkwork/<owner>/<repository-hash>/`, keyed by the canonical repository real path.
- Tests and one-process generated config use unique OS/CI temporary directories with structured cleanup.
- Signing material uses protected external temporary storage and never enters a source checkout.
- One workspace layout validator rejects `.runtime/` existence directly, including ignored paths.
- Root and nested `.runtime/` ignore rules remain as defense against accidental commits; ignoring a
  path does not make its physical presence conformant.

Pre-launch consumers cut over atomically and receive no compatibility write or alias.

## Alternatives

- Standardize repository `.runtime/`: rejected because one directory cannot express the mixed
  ownership, security, persistence, and cleanup contracts and adds a non-native cache root.
- Use `.sdkwork/tmp/`: rejected because `.sdkwork/` is source workspace metadata, not process state.
- Use `target/dev/` for all state: rejected because it imposes Cargo vocabulary on Node, Flutter,
  mobile, and non-Rust repositories.
- Store lifecycle state in `.git/`: rejected because application roots may not be independent git
  roots and lifecycle tools must not mutate source-control internals.

## Consequences

- Source trees remain structurally minimal and generated state has a single natural owner.
- `sdkwork-app stop` derives a deterministic external state path and retains topology reconstruction
  when the state file is missing.
- Tool caches remain performant and independently cleanable.
- Existing `.runtime/` producers and physical directories must be removed before strict validation passes.
- OS temporary cleanup may remove session files; this is safe because process ownership can be
  reconstructed from topology and stale runtime state is never authoritative.

## Verification

- Runtime-state unit tests cover deterministic hashing, source-tree exclusion, permissions, atomic
  replacement, stale cleanup, and repository isolation.
- Workspace layout tests create forbidden root and nested `.runtime/` directories and require failure.
- Consumer scans find no `.runtime` writer, ignore entry, or active documentation reference.
- Supply-chain tests prove decoded signing material remains outside the checkout and is cleaned.

## Supersedes / Superseded By

Supersedes the repository-scoped `.runtime/sdkwork-app/` rule formerly stated by
`APP_RUNTIME_TOPOLOGY_SPEC.md` and the `.runtime/*` clean examples formerly stated by
`PNPM_SCRIPT_SPEC.md`.
