# PLAN-20260629 Step 4 — Foundation Repos Evidence

- Date: 2026-06-29
- Step: 4 — Foundation repository alignment
- Status: **Completed**

## Scope

Foundation batch (plan section 2):

- `sdkwork-iam`
- `sdkwork-appbase`
- `sdkwork-core`
- `sdkwork-ui`
- `sdkwork-utils`
- `sdkwork-sdk-commons`

## Actions

### sdkwork-iam (primary migration)

1. Ran `node sdkwork-specs/tools/align-app-composition.mjs --root sdkwork-iam` — **18 changes**:
   - Deleted 4× `dependency.composition.json` (pc, h5, flutter-mobile, common)
   - Stripped `contracts.dependencyComposition` from 7× `component.spec.json`
   - Rewrote 3× `dependency-manifest.ts` + admin-core composition `index.ts`
   - Updated pc `README.md` / `AGENTS.md` canonical spec references
2. Added `contracts.sdkDependencies` to core packages:
   - `@sdkwork/iam-pc-core` → `@sdkwork/iam-app-sdk` (app-api)
   - `@sdkwork/iam-pc-admin-core` → `@sdkwork/iam-backend-sdk` (backend-api)
   - `@sdkwork/iam-h5-core` → iam-app-sdk
   - `@sdkwork/iam_flutter_mobile_core` → iam-app-sdk
3. Updated `tests/static/governance/iam-apps-layout-standard.test.mjs`:
   - Removed requirement for `specs/dependency.composition.json`
   - Asserts `contracts.dependencyComposition` must not exist

### Other foundation repos

No parallel composition manifests were present. Verification-only pass.

### sdkwork-specs tooling

- Added `workspace/consumers/sdkwork-iam.json` for IAM SDK OpenAPI workspace paths
- Documented `align-app-composition.mjs` in `sdkwork-specs/AGENTS.md`
- Enhanced `align-app-composition.mjs` with SDK inventory migration from composition manifests (for downstream waves)

## Verification

```text
node sdkwork-specs/tools/verify-repo.mjs --root sdkwork-iam          → pass
node sdkwork-specs/tools/verify-repo.mjs --root sdkwork-appbase       → pass
node sdkwork-specs/tools/verify-repo.mjs --root sdkwork-core          → pass
node sdkwork-specs/tools/verify-repo.mjs --root sdkwork-ui            → pass
node sdkwork-specs/tools/verify-repo.mjs --root sdkwork-utils         → pass
node sdkwork-specs/tools/verify-repo.mjs --root sdkwork-sdk-commons   → pass
```

```text
rg dependency\.composition sdkwork-iam  → 0 hits (except governance prohibition assertion)
```

Governance node tests (`pnpm run test:governance-node` in sdkwork-iam): **122/123 pass**. Single pre-existing failure unrelated to composition (`user-center-command-matrix.test.mjs` — missing `@sdkwork/user-center-core-pc-react` package resolution).

## Gate checklist

- [x] All six foundation repos pass `verify-repo.mjs`
- [x] `sdkwork-iam` composition artifacts removed
- [x] Core packages declare `contracts.sdkDependencies`
- [x] IAM consumer overlay registered in `workspace/consumers/`
- [x] Governance test updated for native composition model
- [ ] Wire `verify-repo.mjs` into sdkwork-iam `pnpm verify` (deferred — same pattern as sdkwork-im pilot)

## Residual / follow-up

- Add `verify-repo.mjs` to sdkwork-iam standards verification script (mirror sdkwork-im)
- Fix unrelated user-center command matrix package resolution failure before full `pnpm verify` green
