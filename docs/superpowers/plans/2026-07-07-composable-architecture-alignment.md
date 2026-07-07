# Composable Architecture Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make SDKWork standards and validators enforce a composable frontend/Rust backend architecture with explicit module contracts, dependency boundaries, route uniqueness, and permission/runtime composition.

**Architecture:** Keep native build tools as dependency authority and keep `specs/component.spec.json` as the machine-readable integration contract. Add thin cross-stack standards and focused validators instead of introducing a parallel dependency manifest.

**Tech Stack:** Markdown standards, Node.js ESM validators, `node:test`, JSON/TOML manifest scanning, existing `tools/lib/*` helpers.

---

### Task 1: Component Port And Runtime Contract Validator

**Files:**
- Create: `tools/lib/component-port-bindings.mjs`
- Create: `tools/check-component-port-bindings.mjs`
- Create: `tools/check-component-port-bindings.test.mjs`
- Modify: `tools/verify-repo.mjs`
- Modify: `COMPONENT_SPEC.md`, `MODULE_SPEC.md`, `TEST_SPEC.md`, `README.md`

- [ ] Write failing tests for missing `contracts.layerRole`, frontend required/provided port declarations, Rust runtime entrypoint declarations, and no-op compatibility when fields are absent in legacy manifests.
- [ ] Run `node --test tools/check-component-port-bindings.test.mjs` and confirm failure for missing implementation.
- [ ] Implement focused manifest discovery and validation.
- [ ] Wire validator into CLI and `verify-repo.mjs`.
- [ ] Run the test and related `verify-repo` checks.

### Task 2: Frontend Composition Validator

**Files:**
- Create: `tools/lib/frontend-composition.mjs`
- Create: `tools/check-frontend-composition.mjs`
- Create: `tools/check-frontend-composition.test.mjs`
- Modify: `tools/verify-repo.mjs`
- Modify: `FRONTEND_SPEC.md`, `APP_COMPOSITION_SPEC.md`, `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md`, `TEST_SPEC.md`, `README.md`

- [ ] Write failing tests for feature packages importing generated SDK packages directly, core packages missing required exports, and package roles with invalid dependency direction.
- [ ] Run the frontend composition test and confirm red.
- [ ] Implement package/component discovery using existing app composition helpers where possible.
- [ ] Wire into `verify-repo.mjs`.
- [ ] Run targeted tests and `node tools/check-frontend-composition.mjs --root <fixture>`.

### Task 3: Rust Backend Composition Validator

**Files:**
- Create: `tools/lib/rust-backend-composition.mjs`
- Create: `tools/check-rust-backend-composition.mjs`
- Create: `tools/check-rust-backend-composition.test.mjs`
- Modify: `tools/verify-repo.mjs`
- Modify: `RUST_CODE_SPEC.md`, `WEB_BACKEND_SPEC.md`, `DEPENDENCY_MANAGEMENT_SPEC.md`, `TEST_SPEC.md`, `README.md`

- [ ] Write failing tests for service crates depending on concrete SQLx repository crates, route crates depending on same-authority generated SDK crates, repository crates depending on HTTP/framework crates, and member Cargo direct sibling path dependencies.
- [ ] Run the Rust backend composition test and confirm red.
- [ ] Implement lightweight Cargo.toml parsing and role-based dependency checks.
- [ ] Wire into `verify-repo.mjs`.
- [ ] Run targeted tests and `node tools/check-rust-backend-composition.mjs --root <fixture>`.

### Task 4: Cross-Stack Composition Resolver Output

**Files:**
- Modify: `tools/lib/composition-resolver.mjs`
- Modify: `tools/check-composition-resolver.test.mjs`
- Modify: `APP_COMPOSITION_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, `COMPONENT_SPEC.md`, `TEST_SPEC.md`

- [ ] Write failing resolver tests asserting `composition.resolved.json` includes component contract summaries, frontend packages, Rust crates, route manifests, permission inheritance, and runtime dependency surfaces.
- [ ] Run resolver tests and confirm red.
- [ ] Extend resolver output without changing native dependency authority.
- [ ] Keep schema backward compatible with existing fields.
- [ ] Run resolver tests and `node tools/check-composition-resolver.mjs --root .`.

### Task 5: Route Registry Ownership And Legacy Source De-Duplication

**Files:**
- Modify: `tools/lib/route-registry.mjs`
- Modify: `tools/check-route-path-collisions.test.mjs`
- Modify: `API_SPEC.md`, `WEB_BACKEND_SPEC.md`, `APP_COMPOSITION_SPEC.md`, `TEST_SPEC.md`

- [ ] Write failing tests for duplicate generated/derived sources with the same operation lineage and for reserved `/system/health` or `/system/ready` ownership conflicts.
- [ ] Run route collision tests and confirm red.
- [ ] Add source lineage classification so generated OpenAPI, SDK OpenAPI, and route manifest duplicates for the same owner can be reported as stale-source debt separately from true owner collision.
- [ ] Add reserved path ownership checks.
- [ ] Run targeted route tests and root/workspace collision checks.

### Task 6: Standards Documentation Sweep

**Files:**
- Create or modify: `COMPOSABLE_ARCHITECTURE_SPEC.md`
- Modify: `README.md`, `APPLICATION_SPEC.md`, `APP_COMPOSITION_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, `FRONTEND_SPEC.md`, `RUST_CODE_SPEC.md`, `WEB_BACKEND_SPEC.md`, `DEPENDENCY_MANAGEMENT_SPEC.md`, `COMPONENT_SPEC.md`, `TEST_SPEC.md`, `tools/README.md`

- [ ] Add the composable architecture profile and golden paths.
- [ ] Remove or update obsolete language that implies optional composition, parallel manifests, duplicated route catalogs, or hidden runtime wiring.
- [ ] Link new validator commands from README, TEST, and tools docs.
- [ ] Run repository doc and standards checks.

### Task 7: Verification And Debt Audit

**Files:**
- Modify only if checks reveal standard/tool gaps.

- [ ] Run all new tests.
- [ ] Run existing composition, permission, route, API operation, API envelope, docs, and repo verification checks.
- [ ] Run workspace audits for permission composition and route collisions, record remaining consumer-repo debt separately from standards-repo completion.
- [ ] Fix standards-repo failures until local standards verification passes.
