# Rust Code Standard

- Version: 1.0
- Scope: Rust crates, workspaces, route crates, Tauri/native Rust, Rust services, Rust SDK facades, and Rust tests
- Related: `CODE_STYLE_SPEC.md`, `NAMING_SPEC.md`, `APPLICATION_GATEWAY_SPEC.md`, `API_SPEC.md`, `WEB_FRAMEWORK_SPEC.md`, `WEB_BACKEND_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, `COMPONENT_SPEC.md`, `RUST_RPC_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md`, `TEST_SPEC.md`

This standard applies only when Rust source, Cargo manifests, Rust route crates, Tauri Rust code, or Rust RPC code is touched.

## 1. Crate And Module Shape

Rules:

- `src/lib.rs` is a public module assembly file. It should contain `pub mod`, private `mod`, re-exports, crate-level documentation, and small compile-time wiring only.
- `src/lib.rs` `MUST NOT` contain handlers, repositories, SQL queries, provider clients, long business services, large DTO definitions, test fixtures, or generated data tables.
- If `lib.rs` exceeds roughly 150 lines or contains more than exports and module declarations, split it before adding new behavior.
- `src/main.rs` or `bin/*` owns process startup only. Runtime business logic belongs in library modules.

Rust crates `MUST` be named and structured by responsibility. A crate name must tell a reader
whether it owns business rules, database access, HTTP route adaptation, process startup, native host
integration, background jobs, or gateway/proxy behavior.

Allowed authored Rust crate families:

| Responsibility | Standard crate name | Primary owner |
| --- | --- | --- |
| Business service/use case | `sdkwork-<domain>-<capability>-service` | domain models, commands, results, business rules, service ports |
| SQLx repository implementation | `sdkwork-<domain>-<capability>-repository-sqlx` | database schema constants, row mapping, SQLx queries, repository trait implementation |
| HTTP route/API adapter | `sdkwork-routes-<capability>-<surface>` | paths, routes, handlers, route manifest, API/service mapping |
| HTTP API server process | `sdkwork-<application-code>-api-server` | config loading, dependency construction, route mounting, HTTP listener, preflight |
| In-process service host | `sdkwork-<application-code>-service-host` | standalone/native service container, no HTTP route mounting |
| Native/Tauri host | `sdkwork-<application-code>-native-host` or `sdkwork-<application-code>-tauri-host` | native commands, host state, platform adapters |
| Background job process | `sdkwork-<domain>-<capability>-worker` | jobs, scheduling, queues, retries, cursors, locks |
| API gateway/proxy (standalone deployment) | `sdkwork-<application-code>-standalone-gateway` | standalone application ingress, upstream routing, route precedence, dependency API surface proxying, optional embedded platform adapter |
| API gateway/proxy (cloud deployment) | `sdkwork-<application-code>-cloud-gateway` | cloud application ingress, upstream routing, route precedence, dependency API surface proxying |
| Platform API gateway | `sdkwork-api-cloud-gateway` | shared `platform.api-gateway` ingress for SDKWork platform APIs |

Forbidden Rust crate suffixes for new and existing SDKWork Rust crates:

- `sdkwork-<application-code>-gateway` (bare application gateway without `standalone` or `cloud` qualifier)
- `sdkwork-<application-code>-product`
- `sdkwork-<application-code>-runtime`
- `sdkwork-<domain>-<capability>-runtime`
- `sdkwork-<application-code>-backend`
- `sdkwork-<application-code>-core`
- `sdkwork-<application-code>-common`
- `sdkwork-<application-code>-manager`
- `sdkwork-<application-code>-server-runtime`

These names are not legacy-compatible exceptions. Repositories containing them are not compliant
until the crates are renamed to responsibility-specific names and public references are updated. Do
not preserve an old forbidden crate name through a wrapper crate, package alias, feature alias, or
public re-export alias. Breaking package renames still follow `MIGRATION_SPEC.md`, but the final
state must not keep the forbidden name.

Standard business service crate layout:

```text
crates/sdkwork-<domain>-<capability>-service/
  Cargo.toml
  README.md
  specs/
    component.spec.json
  src/
    lib.rs
    config.rs
    context.rs
    error.rs
    domain/
      mod.rs
      models.rs
      value_objects.rs
      commands.rs
      results.rs
      events.rs
    ports/
      mod.rs
      repository.rs
      provider.rs
      cache.rs
      events.rs
    service/
      mod.rs
      <capability>_service.rs
      <use_case>.rs
    test_support/
      mod.rs
      fixtures.rs
      fakes.rs
  tests/
    service_smoke.rs
    authorization_smoke.rs
    transaction_smoke.rs
    idempotency_smoke.rs
```

Rules:

- Service crates own business rules, authorization decisions, transaction orchestration,
  idempotency, domain events, and cache/event/provider coordination.
- Service crates define repository and provider ports as traits. They `MUST NOT` depend on concrete
  SQLx repository crates.
- Service crates `MUST NOT` depend on HTTP framework request/response types.
- Service crates `MUST NOT` depend on generated SDKs for the API authority they implement.

Standard SQLx repository crate layout:

```text
crates/sdkwork-<domain>-<capability>-repository-sqlx/
  Cargo.toml
  README.md
  src/
    lib.rs
    error.rs
    db/
      mod.rs
      schema.rs
      rows.rs
      columns.rs
      indexes.rs
    mapper/
      mod.rs
      row_mapper.rs
    repository/
      mod.rs
      queries.rs
      <aggregate>_repository.rs
    test_support/
      mod.rs
      fixtures.rs
  tests/
    repository_smoke.rs
    tenant_scope_smoke.rs
    schema_mapping_smoke.rs
    optimistic_lock_smoke.rs
```

Rules:

- Repository implementation crates implement repository traits declared by the service crate.
- `db/schema.rs`, `db/columns.rs`, and `db/indexes.rs` own table, column, and index constants or
  logical schema descriptors.
- `db/rows.rs` owns database row types. API DTOs and domain models must not be aliases for row
  types.
- `repository/queries.rs` owns SQL text, query fragments, or query-builder helpers.
- Repository implementations `MUST` receive tenant, organization, user, and data-scope inputs from
  service/context parameters. They `MUST NOT` infer authorization by parsing HTTP headers or global
  request state.
- Repository implementations `MUST NOT` own business policy, permission checks, HTTP concerns, or
  provider calls.

Standard HTTP API server process crate layout:

```text
crates/sdkwork-<application-code>-api-server/
  Cargo.toml
  README.md
  src/
    main.rs
    lib.rs
    bootstrap/
      mod.rs
      config.rs
      state.rs
      database.rs
      repositories.rs
      services.rs
      adapters.rs
      routers.rs
    server/
      mod.rs
      listen.rs
      shutdown.rs
      middleware.rs
    preflight/
      mod.rs
      config.rs
      database.rs
      dependency_surfaces.rs
    health.rs
  tests/
    bootstrap_smoke.rs
    route_mount_smoke.rs
    dependency_surface_smoke.rs
    preflight_smoke.rs
```

Rules:

- API server crates are runnable HTTP processes. They mount route crates, construct services,
  inject repository/adapters, run preflight checks, and start the listener.
- API server crates `MUST` assemble the HTTP runtime through `sdkwork-web-bootstrap` or an equivalent documented bootstrap API from `sdkwork-web-framework` according to `WEB_FRAMEWORK_SPEC.md`.
- API server crates `MUST NOT` define core business rules, SQL queries, OpenAPI authority, or
  generated SDK ownership.
- API server crates may depend on route crates, service crates, repository implementation crates,
  provider/cache/event adapters, and config/runtime support crates.

Standard in-process service host crate layout:

```text
crates/sdkwork-<application-code>-service-host/
  Cargo.toml
  README.md
  src/
    lib.rs
    bootstrap/
      mod.rs
      config.rs
      state.rs
      database.rs
      repositories.rs
      services.rs
      adapters.rs
    host/
      mod.rs
      service_container.rs
    preflight/
      mod.rs
      config.rs
      database.rs
  tests/
    service_host_smoke.rs
    dependency_wiring_smoke.rs
    preflight_smoke.rs
```

Rules:

- Service host crates provide a Rust in-process service container for
  standalone/native use.
- Service host crates `MUST NOT` mount HTTP routes or start an HTTP listener.
- Service host crates `MUST NOT` replace service crates as the owner of business rules.

Standard native/Tauri host crate layout:

```text
crates/sdkwork-<application-code>-native-host/
  Cargo.toml
  README.md
  src/
    lib.rs
    commands/
      mod.rs
      <capability>_commands.rs
    host/
      mod.rs
      state.rs
      permissions.rs
    adapters/
      mod.rs
      filesystem.rs
      keychain.rs
      notifications.rs
    bootstrap/
      mod.rs
      services.rs
  tests/
    command_smoke.rs
    host_permission_smoke.rs
    adapter_smoke.rs
```

Rules:

- Native host crates own native/Tauri command boundaries and platform adapters.
- Native host crates may call service hosts or service crates through typed boundaries.
- Native host crates `MUST NOT` run SQL directly, define OpenAPI authority, or replace HTTP route
  crates.

Standard worker crate layout:

```text
crates/sdkwork-<domain>-<capability>-worker/
  Cargo.toml
  README.md
  src/
    main.rs
    lib.rs
    jobs/
      mod.rs
      <job_name>.rs
    scheduler/
      mod.rs
      cron.rs
    bootstrap/
      mod.rs
      config.rs
      repositories.rs
      services.rs
      adapters.rs
    preflight.rs
  tests/
    job_smoke.rs
    idempotency_smoke.rs
    retry_smoke.rs
```

Rules:

- Worker crates own background job execution, queues, schedules, cursors, locks, retries, and
  maintenance loops.
- Worker crates should call service use cases instead of bypassing service rules with direct table
  writes.
- Worker crates `MUST NOT` expose HTTP route authority unless they are split into an `api-server`
  crate.

Standard standalone application gateway crate layout:

```text
crates/sdkwork-<application-code>-standalone-gateway/
  Cargo.toml
  README.md
  specs/
    component.spec.json
  src/
    main.rs
    lib.rs
    routing/
      mod.rs
      table.rs
      precedence.rs
      upstreams.rs
    proxy/
      mod.rs
      request.rs
      response.rs
    auth/
      mod.rs
      context_forwarding.rs
    preflight/
      mod.rs
      upstreams.rs
    health.rs
  tests/
    route_precedence_smoke.rs
    upstream_config_smoke.rs
    dependency_surface_smoke.rs
    fail_closed_smoke.rs
```

Standard cloud application gateway crate layout:

```text
crates/sdkwork-<application-code>-cloud-gateway/
  Cargo.toml
  README.md
  specs/
    component.spec.json
  src/
    main.rs
    lib.rs
    routing/
      mod.rs
      table.rs
      precedence.rs
      upstreams.rs
    proxy/
      mod.rs
      request.rs
      response.rs
    auth/
      mod.rs
      context_forwarding.rs
    preflight/
      mod.rs
      upstreams.rs
    health.rs
  tests/
    route_precedence_smoke.rs
    upstream_config_smoke.rs
    dependency_surface_smoke.rs
    fail_closed_smoke.rs
```

Rules:

- Standalone and cloud application gateway crates own upstream routing, route precedence,
  proxying, dependency API surface routing, and fail-closed upstream validation for their
  declared deployment profile.
- Application gateway crates `MUST NOT` use a bare `-gateway` suffix without `standalone` or
  `cloud`.
- Gateway crates `MUST NOT` own business service rules, business repositories, or
  application-owned SDK generation authority.

## 2. Route Crates

Rust HTTP route crates follow `API_SPEC.md`, `WEB_FRAMEWORK_SPEC.md`, `WEB_BACKEND_SPEC.md`, and `SDK_WORKSPACE_GENERATION_SPEC.md`.

Required route crate shape:

```text
crates/sdkwork-routes-<capability>-<surface>/
  Cargo.toml
  src/
    lib.rs
    paths.rs
    routes.rs
    handlers.rs
    manifest.rs
    error.rs
    mapper/
      mod.rs
      request.rs
      response.rs
      problem.rs
```

Rules:

- `paths.rs` owns path constants.
- `routes.rs` owns framework router composition through `sdkwork-web-framework` helpers.
- `handlers.rs` owns HTTP decoding/response mapping, declares `WebRequestContext` on every handler, and delegates business logic.
- `manifest.rs` owns deterministic route manifest projection, including `requestContext: WebRequestContext` and route-level `apiSurface` for every route.
- `mapper/` owns request DTO to service command mapping, service result to response DTO mapping,
  and problem-detail mapping.
- Business rules live in services, not handlers.
- Route crates must call service traits or service structs and must not depend on concrete SQLx
  repository implementation crates.
- Route crates must not depend on generated SDKs for the same API authority.
- Route crates `MUST NOT` parse raw credential or tenant headers in handlers; context comes from `WebRequestContext` injected by the framework.

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

- Cargo package names use lowercase kebab-case, for example `sdkwork-routes-merchandise-app-api`.
- Rust import names use snake_case, for example `sdkwork_routes_merchandise_app_api`.
- Runnable crate names must use a specific suffix such as `api-server`, `service-host`,
  `native-host`, `worker`, or `gateway`; generic `product` and `runtime` suffixes are forbidden.
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
- IAM session/token lookup for open-api `MUST` live in `sdkwork-iam-web-adapter` or application-line adapters implementing framework traits; route handlers `MUST NOT` duplicate credential resolution SQL.
- Queries comparing logical `instant` columns physically stored as TEXT `MUST` use explicit PostgreSQL casts such as `expires_at::timestamptz > $1::timestamptz` per `DATABASE_SPEC.md` section 8.1.1. `MUST NOT` bind `chrono::DateTime<Utc>` directly against TEXT `instant` columns without cast.
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
- A crate named with a generic `product`, `runtime`, `backend`, `core`, `common`, or `manager`
  suffix instead of a responsibility-specific suffix.
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
- [ ] Rust crate names use an allowed responsibility-specific family and avoid forbidden generic
      suffixes.
- [ ] Business logic is in focused modules.
- [ ] Business service, repository implementation, route adapter, API server, service host,
      native host, worker, and gateway responsibilities are split into their standard directories
      when those capabilities exist.
- [ ] Route crates use `paths.rs`, `routes.rs`, `handlers.rs`, and `manifest.rs` when they own HTTP routes.
- [ ] Mountable dependency surfaces expose stable public router/controller/service builders and
  declare them in component specs.
- [ ] Errors are typed or mapped at the boundary.
- [ ] `cargo fmt` and relevant tests/checks are documented.
