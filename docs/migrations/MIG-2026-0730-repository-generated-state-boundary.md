# MIG-2026-0730 Repository Generated-State Boundary

Status: completed
Requirement: REQ-2026-0730
Decision: ADR-20260730-repository-generated-state-boundary
Owner: SDKWork platform
Type: runtime, build, test, release, security

```yaml
id: MIG-2026-0730
owner: sdkwork-platform
status: completed
requirement: REQ-2026-0730
type: contract
scope:
  producers:
    - sdkwork-specs
    - sdkwork-app-topology
  consumers:
    - sdkwork-im
strategy: direct-cutover
rollback:
  supported: true
  steps:
    - restore the prior application/framework commit without deleting user-private data
    - stop managed development processes before changing runtime-state paths
    - use topology ownership reconstruction when no session registry is available
```

## Migration Sequence

1. Align all normative standards and record the accepted directory decision.
2. Add the shared OS runtime-state resolver to `sdkwork-app-topology` and migrate the development session registry.
3. Move `sdkwork-im` Cargo isolation to `target/sdkwork/`; retain the Windows executable-lock test.
4. Move Node tests, generated tsconfig, Flutter define files, fallback sites, and release inputs to private OS/CI temporary paths.
5. Move decoded Android signing material outside the checkout and cover success/failure cleanup.
6. Remove `.runtime` source/config exclusions, scripts, tests, and active documentation dependencies; retain defensive `.gitignore` rules.
7. Stop managed processes, delete the obsolete generated directories, and enable strict workspace layout validation.
8. Run targeted repository checks and a final source/worktree scan.

## Exit Criteria

- No producer writes `.runtime/` in any in-scope repository or application root.
- No in-scope tsconfig, active doc, test, or command depends on repository `.runtime/`; `.gitignore` retains defensive root/nested rules.
- `sdkwork-app-topology` and `sdkwork-im` tests pass with state outside the source checkout.
- `check-workspace-layout.mjs` and aggregate repository verification pass.
- The migration, requirement, and Canon architecture status reflect the completed implementation.

## Completion Evidence

- `sdkwork-app-topology` owns canonical repository hashing, private OS/CI runtime-state resolution,
  atomic JSON writes, and exact cleanup through `@sdkwork/app-topology/runtime-state`.
- `sdkwork-im` uses `target/sdkwork/` for isolated Cargo output and private OS/CI state for lifecycle
  sessions, dev-site fallback, generated tsconfig, Flutter configuration, tests, and decoded signing
  material.
- Defensive `.gitignore` rules remain in producer and consumer repositories while physical runtime
  directories fail `check-workspace-layout.mjs`.
- Targeted Node/Rust tests, app-topology lifecycle tests, pnpm script validation, workspace layout
  validation, repository verification, and `git diff --check` form the completion gate.
