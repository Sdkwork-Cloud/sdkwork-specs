# PLAN-20260629 Step 5 — Client Wave 1 Evidence

- Date: 2026-06-29
- Step: 5 — Client wave 1 alignment
- Status: **Completed**

## Scope

Plan section 2 client wave 1:

- `sdkwork-mall`
- `sdkwork-mcp`
- `sdkwork-clawrouter`
- `sdkwork-agents`
- `sdkwork-terminal`
- `sdkwork-birdcoder`

## Actions

### Tooling

- Enhanced `align-app-composition.mjs`:
  - Migrates `sdkClients` from `dependency.composition.json` into core `contracts.sdkDependencies`
  - Rewrites composition source imports away from deleted manifests
  - Removes nested `apps/**/pnpm-workspace.yaml` when repo-root workspace exists

### Per-repo migrations

| Repo | Changes |
| --- | --- |
| sdkwork-mall | Removed composition manifest; stripped `dependencyComposition`; fixed admin-core `sdkDependencies` surfaces |
| sdkwork-mcp | Removed 3× composition manifests; aligned core/admin/h5 specs; removed nested h5 workspace |
| sdkwork-clawrouter | Removed composition manifest; created **repo-root** `pnpm-workspace.yaml` (lifted from app-level); added `permissionComposition` + core `sdkDependencies`; simplified composition runtime; updated test + `check:dependency-composition` → `verify-repo` |
| sdkwork-agents | Removed 4× composition manifests; removed 3× nested workspaces; rewrote materialize + align scripts |
| sdkwork-terminal | Removed 2× composition manifests + nested workspaces |
| sdkwork-birdcoder | Removed 3× composition manifests; added admin/console core `component.spec.json`; removed nested pc/h5 workspaces |

## Verification

```text
node sdkwork-specs/tools/verify-repo.mjs --root sdkwork-mall        → pass
node sdkwork-specs/tools/verify-repo.mjs --root sdkwork-mcp         → pass
node sdkwork-specs/tools/verify-repo.mjs --root sdkwork-clawrouter  → pass
node sdkwork-specs/tools/verify-repo.mjs --root sdkwork-agents      → pass
node sdkwork-specs/tools/verify-repo.mjs --root sdkwork-terminal    → pass
node sdkwork-specs/tools/verify-repo.mjs --root sdkwork-birdcoder   → pass
```

## Gate checklist

- [x] Zero `dependency.composition.json` in wave 1 repos
- [x] Zero nested `apps/**/pnpm-workspace.yaml` in wave 1 repos (clawrouter now uses repo-root workspace)
- [x] Core packages declare typed `contracts.sdkDependencies` where inventory exists
- [x] Clawrouter `permissionComposition` on app-surface `component.spec.json`
- [x] All six repos pass `verify-repo.mjs`
- [ ] Wire `verify-repo.mjs` into each repo `pnpm verify` (follow-up, mirror sdkwork-im)

## Residual / follow-up

- Client wave 2 (~50+ remaining repos with composition manifests)
- `sdkwork-knowledgebase` custom `check_dependency_composition_standard.mjs` replacement
- Full `pnpm verify` green per repo (orthogonal governance failures may remain)
