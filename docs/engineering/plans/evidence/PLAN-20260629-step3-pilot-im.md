# PLAN-20260629 Step 3 Pilot — sdkwork-im (updated)

- Step: 3 — Pilot `sdkwork-im`
- Date: 2026-06-29
- Status: **Composition migration complete**; repository standards substantially aligned

## Composition architecture (complete)

| Item | Status |
| --- | --- |
| Zero `dependency.composition.json` | Done |
| Zero nested `apps/**/pnpm-workspace.yaml` | Done |
| Zero `contracts.dependencyComposition` | Done |
| `verify-repo.mjs` integrated in `pnpm verify` | Done |
| Mail/community SDK shim packages removed | Done |
| Sibling generated SDK via workspace (`sdkwork-*-app-sdk-generated-typescript`) | Done |
| Core owns SDK imports; feature packages use `@sdkwork/im-pc-core/sdk/*` | Done |

## Verification

```bash
node ../sdkwork-specs/tools/verify-repo.mjs --root .
rg "dependency\.composition|dependencyComposition" .   # zero hits
node scripts/dev/sdkwork-im-h5-architecture-standard.test.mjs
node scripts/dev/sdkwork-im-flutter-mobile-architecture-standard.test.mjs
node scripts/sdkwork-workspace-structure-standard.test.mjs
pnpm verify   # passes through component-spec-consistency; may fail on workspace-wide postgres profile scan of sibling repos
```

## Additional debt cleared in this pass

- Web-framework / retention / deprecated-service tests aligned to `app.rs` + `registry.rs` authority
- `sdkwork-routes-im-realtime-open-api/src/routes.rs` added
- Root `pnpm-workspace.yaml` authority reflected across dev/verify scripts
- `server.env.example` documents app-context secrets
- `database-table-registry.json` RTC tables point to baseline DDL authority
- Missing module README files for call-signaling crates/services

## Deferred (Step 4+ / follow-up)

- Consolidate granular `@sdkwork/im-pc-core/sdk/*` subpath exports to standard `./sdk` barrel only
- Workspace-wide `check:unified-postgres-profile` alignment for sibling repositories
- `sync-workspace.mjs` non-dry-run apply after consumer overlay stabilizes

## Gate

| Check | Result |
| --- | --- |
| Native composition (`verify-repo`) | Pass |
| IM architecture tests (pc/h5/flutter) | Pass |
| `pnpm verify` through `test:component-spec-consistency` | Pass |
| Full `pnpm verify` (workspace postgres scan) | Partial — sibling repo env files remain |
