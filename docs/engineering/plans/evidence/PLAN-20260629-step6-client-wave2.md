# PLAN-20260629 Step 6 — Client Wave 2 Evidence

- Date: 2026-06-29
- Step: 6 — Remaining client repositories
- Status: **Completed**

## Scope

All remaining `sdkwork-*` repositories with `apps/` client surfaces (~33 repos in this batch after wave 1).

## Actions

1. Ran `align-app-composition.mjs` across wave 2 repos (skills, commerce, media, community, mail, rtc, games, etc.)
2. Enhanced align tool:
   - `alignCoreSdkDependencySurfaces` — admin-core `sdkDependencies` without `surface` get `backend-api`
   - Removes nested `apps/**/pnpm-workspace.yaml` when repo-root workspace exists
3. Lifted nested workspaces to repo root for repos that lacked root `pnpm-workspace.yaml`:
   - `sdkwork-clawrouter`, `sdkwork-video`, `sdkwork-github`, `sdkwork-notary`, `sdkwork-local-router`, `sdkwork-generations`, `sdkwork-appstore`, `sdkwork-aiot`
   - Removed nested `sdkwork-news-pc` workspace (root already existed)
4. Re-aligned `sdkwork-agents` after composition manifests reappeared (materialize script previously still emitted them; now fixed)

## Verification

Full sweep of all `sdkwork-*` repos with `apps/`:

```text
verify-repo PASS=77 FAIL=0
```

Additional checks:

```text
dependency.composition.json workspace-wide → 0 files
apps/**/pnpm-workspace.yaml workspace-wide → 0 files
node --test sdkwork-specs/tools/verify-composition.test.mjs → 5/5 pass
```

## Gate checklist

- [x] Zero `dependency.composition.json` workspace-wide
- [x] Zero nested `apps/**/pnpm-workspace.yaml`
- [x] All 77 client repos with `apps/` pass `verify-repo.mjs`
- [ ] Wire `verify-repo.mjs` into each repo `pnpm verify` (Step 9 / follow-up)
- [ ] Backend wave + legacy repos (Steps 7–8)
