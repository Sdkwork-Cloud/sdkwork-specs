# PLAN-20260629 Step 2 Tools Evidence

- Step: 2 — Tooling Foundation
- Date: 2026-06-29

## Deliverables

| Artifact | Path |
| --- | --- |
| Workspace catalog | `workspace/catalog.base.json` |
| Consumer overlay registry | `workspace/consumers/*.json`, `workspace/consumers/README.md` |
| Foundation package list | `tools/lib/workspace-registry.mjs#FOUNDATION_PNPM_PACKAGES` |
| Sync tool | `tools/sync-workspace.mjs` |
| Verify orchestrator | `tools/verify-repo.mjs` |
| Composition validators | `tools/lib/app-composition.mjs` |
| Unit tests | `tools/verify-composition.test.mjs` |

## Verification Commands

```bash
cd sdkwork-specs
node --test tools/verify-composition.test.mjs
node tools/verify-repo.mjs --root . --specs-only
node tools/sync-workspace.mjs --repo sdkwork-im --root ../sdkwork-im --dry-run
```

## Pilot dry-run note

`sync-workspace.mjs --dry-run` emits merged `pnpm-workspace.yaml` for `sdkwork-im` preserving local globs and injecting foundation + consumer sibling paths.

## Removed legacy tools

- `tools/align-dependency-composition.mjs`
- `tools/check-dependency-composition.mjs`
- `tools/check-dependency-composition.test.mjs`
- `tools/lib/dependency-composition.mjs`
