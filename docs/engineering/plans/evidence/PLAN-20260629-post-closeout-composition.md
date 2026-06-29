# Post-closeout composition alignment (2026-06-29)

Follow-up after PLAN-20260629 Steps 0–9.

## Scope

| Item | Result |
| --- | --- |
| Hybrid `-pc-react` client roots | `listClientAppRoots()` discovers `sdkwork-notes-pc-react/` when core packages exist |
| Non-root workspace enforcement | `findNonRootPnpmWorkspaces()` flags nested workspaces; `.runtime/` and `external/` allowlisted |
| `sdkwork-notes` | Repo-root `pnpm-workspace.yaml`; core composition scaffold; `verify-repo` PASS |
| `sdkwork-kernel` | Repo-root `pnpm-workspace.yaml` (lifted from `sdkwork-kernel-ui/`); `verify-repo` PASS |
| `check:app-composition` wiring | All client repos: script present + wired into `check`/`verify` |
| `sdkwork-memory` | Added `sdkDependencies: []` on backend-only manifest |
| IAM governance | `user-center-command-matrix` PASS; workspace manifest walk skips `.runtime/` |
| Unified PostgreSQL profile | `birdcoder`, `drive`, `discovery`, `memory` `.env.postgres.example` aligned; memory `db:postgres:*` scripts added |

## Tooling

| Script | Purpose |
| --- | --- |
| `tools/sweep-verify-repo.mjs` | Full workspace `verify-repo` sweep |
| `tools/audit-app-composition.mjs` | Missing scripts, wiring, backend `sdkDependencies` |
| `tools/wire-verify-app-composition.mjs` | Batch wire `check:app-composition` into `check`/`verify` |

## Verification (2026-06-29)

```text
node sdkwork-specs/tools/sweep-verify-repo.mjs          # 85 PASS, 0 FAIL
node sdkwork-specs/tools/audit-app-composition.mjs        # 0 gaps
node sdkwork-specs/tools/verify-composition.test.mjs      # 6/6 PASS
sdkwork-notes: verify-notes-standard-architecture.test    # 29/29 PASS
sdkwork-iam: test:governance-node                         # 123/123 PASS
node sdkwork-specs/tools/check-unified-postgres-profile.mjs  # PASS
```

## Remaining (non-blocking)

- `sdkwork-notes` optional migration from hybrid `sdkwork-notes-pc-react/` to `apps/sdkwork-notes-pc/`
- Per-repo full `pnpm verify` green where long-running domain integration tests fail (orthogonal to composition/postgres profile)
