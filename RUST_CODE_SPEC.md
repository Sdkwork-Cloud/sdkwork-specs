# Rust Code Standard

- Version: 1.0
- Scope: Rust crates, workspaces, route crates, Tauri/native Rust, Rust services, Rust SDK facades, and Rust tests
- Related: `CODE_STYLE_SPEC.md`, `NAMING_SPEC.md`, `API_SPEC.md`, `WEB_BACKEND_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, `COMPONENT_SPEC.md`, `RUST_RPC_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md`, `TEST_SPEC.md`

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
packages/sdkwork-router-<capability>-<surface>/
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

## 3. Surface Integration Entrypoints

Rust components that are intended to be mounted by another application must expose stable,
surface-specific integration entrypoints. A consumer should be able to integrate the component from
the package root and component spec without reading private source files.

Rules:

- Runtime components that expose SDKWork HTTP surfaces `SHOULD` provide public modules or files for
  each served surface, such as `sdkwork_<component>_open_api`, `sdkwork_<component>_app_api`, and
  `sdkwork_<component>_backend_api`.
- Each mounted surface `SHOULD` expose a public executable builder such as
  `build_sdkwork_<component>_<surface>_router`, `build_sdkwork_<component>_<surface>_controller`, or
  an equivalent service builder.
- `src/lib.rs` may re-export those builders, but the builder implementation, handlers, state wiring,
  service construction, and coverage helpers belong in focused modules.
- Route manifests, path constants, OpenAPI documents, and metadata functions are not executable
  integration entrypoints. A same-process dependency mount requires a dependency-owned executable
  router/controller/handler adapter or approved service export according to
  `APP_SDK_INTEGRATION_SPEC.md`.
- A component that exposes only route contracts or manifests and no executable builder must be
  treated as an external dependency API surface by consuming runtimes.
- Public surface entrypoints must be declared in `specs/component.spec.json` through
  `contracts.publicExports`, `contracts.runtimeEntrypoints`, and `contracts.dependencyApiSurfaces`
  when they participate in same-origin dependency composition.

## 4. Naming And Visibility

Rules:

- Cargo package names use lowercase kebab-case, for example `sdkwork-router-product-app-api`.
- Rust import names use snake_case, for example `sdkwork_routes_product_app_api`.
- Modules use snake_case.
- Types and traits use PascalCase.
- Constants use SCREAMING_SNAKE_CASE only for true constants.
- Keep items private by default. Export only stable integration surfaces.

## 5. Errors And Results

Rules:

- Libraries expose typed errors where callers can take meaningful action.
- `anyhow` is allowed at binary, CLI, test, and one-off tooling boundaries.
- Service/domain crates should prefer typed errors or error enums.
- HTTP boundary code maps domain errors to Problem Details according to `API_SPEC.md`.

## 6. Async, State, And Persistence

Rules:

- Do not hold locks across `.await`.
- Shared mutable state must be explicit in state structs or service ports.
- SQLx queries belong in repository modules, not handlers or route manifests.
- Tenant, organization, user, request id, trace, and permission context must come from typed request context, not raw headers.
- Provider SDK calls belong in adapters behind traits or service ports.

## 7. Formatting And Verification

Rules:

- Run `cargo fmt` or the repository wrapper before completion.
- Run `cargo clippy` when the repository requires it or when shared Rust code changes.
- Run the narrowest `cargo test -p <crate>` first, then `cargo test --workspace` when shared contracts are touched.
- Route crates must pass route manifest, prefix, authority, and SDK family checks from `TEST_SPEC.md`.
- Same-origin dependency surface crates must pass executable mount coverage checks from
  `APP_SDK_INTEGRATION_SPEC.md`, `COMPONENT_SPEC.md`, and `TEST_SPEC.md`.

## 8. Anti-Patterns

Forbidden:

- One giant `lib.rs` containing exports, handlers, SQL, DTOs, services, and tests.
- Route handlers that perform persistence or provider calls directly.
- Framework-specific types leaking into domain/service contracts.
- Generated SDK clients imported by route crates implementing the same authority.
- App-local upload/provider logic that bypasses Drive Uploader.
- Treating a route manifest, path constant, or OpenAPI document as proof that a dependency API is
  mounted in the current Rust runtime.
- Deep-importing private dependency source files instead of using the dependency's package-root
  surface integration entrypoint.

## 9. Acceptance Checklist

- [ ] `lib.rs` is limited to module declarations, re-exports, and lightweight docs/wiring.
- [ ] Business logic is in focused modules.
- [ ] Route crates use `paths.rs`, `routes.rs`, `handlers.rs`, and `manifest.rs` when they own HTTP routes.
- [ ] Mountable dependency surfaces expose stable public router/controller/service builders and
  declare them in component specs.
- [ ] Errors are typed or mapped at the boundary.
- [ ] `cargo fmt` and relevant tests/checks are documented.
