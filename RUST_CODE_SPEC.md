# Rust Code Standard

- Version: 1.0
- Scope: Rust crates, workspaces, route crates, Tauri/native Rust, Rust services, Rust SDK facades, and Rust tests
- Related: `CODE_STYLE_SPEC.md`, `NAMING_SPEC.md`, `API_SPEC.md`, `WEB_BACKEND_SPEC.md`, `RUST_RPC_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md`, `TEST_SPEC.md`

This standard applies only when Rust source, Cargo manifests, Rust route crates, Tauri Rust code, or Rust RPC code is touched.

## 1. Crate And Module Shape

Rules:

- `src/lib.rs` is a public module assembly file. It should contain `pub mod`, private `mod`, re-exports, crate-level documentation, and small compile-time wiring only.
- `src/lib.rs` `MUST NOT` contain handlers, repositories, SQL queries, provider clients, long business services, large DTO definitions, test fixtures, or generated data tables.
- If `lib.rs` exceeds roughly 150 lines or contains more than exports and module declarations, split it before adding new behavior.
- `src/main.rs` or `bin/*` owns process startup only. Runtime business logic belongs in library modules.

Recommended crate layout:

```text
src/
  lib.rs
  config.rs
  error.rs
  models.rs
  ports.rs
  service.rs
  repository.rs
  adapters/
    mod.rs
  routes/
    mod.rs
    handlers.rs
    manifest.rs
    paths.rs
  tests/
    mod.rs
```

Larger crates should use folders:

```text
src/
  domain/
  application/
  infrastructure/
  routes/
  rpc/
  config/
```

## 2. Route Crates

Rust HTTP route crates follow `API_SPEC.md`, `WEB_BACKEND_SPEC.md`, and `SDK_WORKSPACE_GENERATION_SPEC.md`.

Required route crate shape:

```text
packages/native-rust/routes/<surface>/sdkwork-routes-<capability>-<surface>/
  Cargo.toml
  src/
    lib.rs
    paths.rs
    routes.rs
    handlers.rs
    manifest.rs
    error.rs
```

Rules:

- `paths.rs` owns path constants.
- `routes.rs` owns framework router composition.
- `handlers.rs` owns HTTP decoding/response mapping and delegates business logic.
- `manifest.rs` owns deterministic route manifest projection.
- Business rules live in services, not handlers.
- Route crates must not depend on generated SDKs for the same API authority.

## 3. Naming And Visibility

Rules:

- Cargo package names use lowercase kebab-case, for example `sdkwork-routes-product-app-api`.
- Rust import names use snake_case, for example `sdkwork_routes_product_app_api`.
- Modules use snake_case.
- Types and traits use PascalCase.
- Constants use SCREAMING_SNAKE_CASE only for true constants.
- Keep items private by default. Export only stable integration surfaces.

## 4. Errors And Results

Rules:

- Libraries expose typed errors where callers can take meaningful action.
- `anyhow` is allowed at binary, CLI, test, and one-off tooling boundaries.
- Service/domain crates should prefer typed errors or error enums.
- HTTP boundary code maps domain errors to Problem Details according to `API_SPEC.md`.

## 5. Async, State, And Persistence

Rules:

- Do not hold locks across `.await`.
- Shared mutable state must be explicit in state structs or service ports.
- SQLx queries belong in repository modules, not handlers or route manifests.
- Tenant, organization, user, request id, trace, and permission context must come from typed request context, not raw headers.
- Provider SDK calls belong in adapters behind traits or service ports.

## 6. Formatting And Verification

Rules:

- Run `cargo fmt` or the repository wrapper before completion.
- Run `cargo clippy` when the repository requires it or when shared Rust code changes.
- Run the narrowest `cargo test -p <crate>` first, then `cargo test --workspace` when shared contracts are touched.
- Route crates must pass route manifest, prefix, authority, and SDK family checks from `TEST_SPEC.md`.

## 7. Anti-Patterns

Forbidden:

- One giant `lib.rs` containing exports, handlers, SQL, DTOs, services, and tests.
- Route handlers that perform persistence or provider calls directly.
- Framework-specific types leaking into domain/service contracts.
- Generated SDK clients imported by route crates implementing the same authority.
- App-local upload/provider logic that bypasses Drive Uploader.

## 8. Acceptance Checklist

- [ ] `lib.rs` is limited to module declarations, re-exports, and lightweight docs/wiring.
- [ ] Business logic is in focused modules.
- [ ] Route crates use `paths.rs`, `routes.rs`, `handlers.rs`, and `manifest.rs` when they own HTTP routes.
- [ ] Errors are typed or mapped at the boundary.
- [ ] `cargo fmt` and relevant tests/checks are documented.

