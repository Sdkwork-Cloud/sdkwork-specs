# PLAN-20260629 Step 8 — Legacy / Non-standard Repos Evidence

- Date: 2026-06-29
- Step: 8 — Legacy repository decisions
- Status: **Completed**

## Decisions

| Repository | Decision | Rationale |
| --- | --- | --- |
| `magic-studio` | **Isolate** | Legacy monolith; not on `apps/sdkwork-*-{pc,h5,...}` taxonomy |
| `magic-studio-v2` | **Isolate** | Same as magic-studio |
| `claw-studio` | **Isolate** | Product fork using `packages/sdkwork-claw-*`; outside SDKWork app registry |
| `sdkwork-notes` | **Adopted (hybrid)** | `sdkwork-notes-pc-react/` verified via native composition; optional future move to `apps/sdkwork-notes-pc/` |

## Registry documentation

Isolated repos documented in `sdkwork-specs/workspace/consumers/README.md` § Isolated repositories.

## Gate checklist

- [x] Every type E repo has written Restructure \| Isolate \| Adopted decision
- [x] Isolated repos excluded from workspace-wide zero-composition gate (no parallel manifests present)
- [x] No isolated repo blocks client wave completion
- [x] `sdkwork-notes` passes `verify-repo.mjs` with hybrid `-pc-react` root

## Follow-up (post-launch)

- Optional restructure `sdkwork-notes` to `apps/sdkwork-notes-pc/` for standard taxonomy layout
- Evaluate magic-studio / claw-studio merge or retirement separately from composition rollout
