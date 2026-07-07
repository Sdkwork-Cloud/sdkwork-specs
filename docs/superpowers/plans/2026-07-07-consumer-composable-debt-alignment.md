# Consumer Composable Debt Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align SDKWork consumer repositories with the new composable architecture validators until workspace checks stop reporting known technical debt.

**Architecture:** Use existing global `sdkwork-specs` validators as RED/GREEN evidence. Fix consumer repositories in small batches by issue class, starting with machine-readable component contract shape because downstream composition, permission, frontend, Rust, and route checks depend on valid component specs.

**Tech Stack:** Markdown/JSON component specs, Node.js standards validators, TypeScript package manifests/source, Cargo manifests, OpenAPI/route manifests.

---

### Task 1: Component Port Binding Shape Debt

**Files:**
- Modify: `../sdkwork-clawrouter/specs/component.spec.json`
- Modify: `../sdkwork-clawrouter/apps/sdkwork-clawrouter-pc/specs/component.spec.json`
- Modify: `../sdkwork-clawrouter/apps/sdkwork-clawrouter-pc/packages/sdkwork-clawroutes-pc-commons/specs/component.spec.json`
- Modify: `../sdkwork-notary/apps/sdkwork-notary-pc/packages/sdkwork-notary-pc-notary/specs/component.spec.json`
- Modify: `../sdkwork-notary/apps/sdkwork-notary-pc/packages/sdkwork-notary-pc-shell/specs/component.spec.json`

- [ ] Reproduce with `node tools/check-component-port-bindings.mjs --workspace ..`.
- [ ] Inspect each component spec and preserve existing semantics.
- [ ] Convert malformed `contracts.dependencyApiSurfaces` values to arrays of objects or empty arrays.
- [ ] Run `node tools/check-component-port-bindings.mjs --workspace ..` and confirm the issue count for this class reaches zero.

### Task 2: Frontend Composition Debt

**Files:** Touched per failing repository/package from `check-frontend-composition.mjs --workspace ..`.

- [ ] Process one repository at a time, starting with packages that directly import generated SDK packages.
- [ ] Move SDK imports into the correct core/composed facade boundary or existing core public export.
- [ ] Remove core/commons dependencies on capability packages by introducing explicit ports or moving shared types into contract/core packages.
- [ ] Run repository-level frontend composition checks after each repository.

### Task 3: Rust Backend Composition Debt

**Files:** Root and member `Cargo.toml` files in repositories reported by `check-rust-backend-composition.mjs --workspace ..`.

- [ ] For each repository, move sibling SDKWork path dependencies to root `[workspace.dependencies]`.
- [ ] Change member dependencies to `{ workspace = true }`.
- [ ] Preserve feature flags and optional dependency semantics.
- [ ] Run repository-level Rust backend composition checks after each repository.

### Task 4: Permission Composition Debt

**Files:** Core `specs/component.spec.json` files reported by `check-permission-composition.mjs --workspace ..`.

- [ ] Add `contracts.permissionComposition` for HTTP `sdkDependencies`.
- [ ] Reference inherited permission manifests instead of duplicating permission catalogs.
- [ ] Run permission composition checks after each repository.

### Task 5: Route Collision Debt

**Files:** Authored OpenAPI, route manifests, and materialization inputs in repositories reported by `check-route-path-collisions.mjs --workspace ..`.

- [ ] Separate stale generated/source projections from true owner collisions.
- [ ] Move business health/readiness routes off reserved `/system/health` and `/system/ready` paths.
- [ ] Preserve API response envelope and operation pattern standards.
- [ ] Run route collision, API operation, and API envelope checks after each repository.

### Task 6: Final Workspace Verification

- [ ] Run all composable architecture workspace checks.
- [ ] Run standards repository `verify-repo`.
- [ ] Report remaining failures only when they are outside the edited scope or require product/security owner decisions.
