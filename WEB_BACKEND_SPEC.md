# Web Backend Development Standard

- Version: 1.0
- Scope: Java Spring HTTP backends, Rust HTTP route crates, Rust local/private backends, SaaS/private/local web backend implementations, and backend API implementation boundaries
- Related: `API_SPEC.md`, `APPLICATION_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, `DOMAIN_SPEC.md`, `SDK_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md`, `COMPONENT_SPEC.md`, `IAM_SPEC.md`, `IAM_LOGIN_INTEGRATION_SPEC.md`, `SECURITY_SPEC.md`, `DATABASE_SPEC.md`, `CACHE_SPEC.md`, `EVENT_SPEC.md`, `OBSERVABILITY_SPEC.md`, `PERFORMANCE_SPEC.md`, `DEPLOYMENT_SPEC.md`, `TEST_SPEC.md`

This standard defines how SDKWork web backends are implemented after the HTTP contract has been designed. `API_SPEC.md` remains the contract source of truth. This file owns implementation layering, naming, handler/service/repository boundaries, route path placement, request context usage, and backend verification expectations.

Use this file when adding or changing Java controllers, Rust route crates, HTTP handlers, backend services, repositories, transactions, context extraction, or runtime API composition.

## 1. Backend Layer Model

SDKWork web backends use contract-first implementation.

```text
domain model and use case
  -> API authority OpenAPI
  -> Java controller or Rust route crate manifest
  -> HTTP handler/controller method
  -> service/use-case layer
  -> repository/provider/event/cache adapters

API authority OpenAPI
  -> owner-only derived SDK input
  -> generated SDK family for consumers
```

Rules:

- OpenAPI authority documents remain the SDK generation source of truth.
- Java controller mappings and Rust route manifests are implementation inputs that must match the authority OpenAPI.
- Runtime route definitions `MUST NOT` be the only place where path, method, operationId, auth, owner, or SDK family semantics are declared.
- Backend code `MUST` preserve the same operationId, path, schema, security, problem-detail error, tenant, and authorization semantics across Java SaaS, Rust local/private, and other supported runtime modes.
- UI packages, frontend services, `backend-admin` UI packages, and generated SDK consumers `MUST NOT` import route crates, controller classes, path constants, or handler internals.

## 2. Implementation Layers

| Layer | Responsibility | Must not do |
| --- | --- | --- |
| Router/controller registration | Mount HTTP method, path, middleware/interceptor chain, and handler binding | Own business logic, build SDK responses ad hoc, bypass standard context |
| Handler/controller method | Decode request, consume typed context, call service, map result/error to API contract | Reparse credentials, run SQL directly, assemble raw auth/API key headers, own transactions by habit |
| Service/use-case | Business rules, authorization decisions, transaction orchestration, idempotency, event/cache coordination | Depend on HTTP framework types, parse raw headers, return framework response objects |
| Repository | Persistence query/command implementation, schema mapping, optimistic concurrency support | Own business policy, tenant inference, permission checks, HTTP concerns |
| Provider/client adapter | External provider or internal SDK/RPC integration through approved SDK/client boundary | Hide raw HTTP fallbacks, leak provider DTOs into API schemas |
| Materialization/generation tooling | Convert route/controller manifests to authority OpenAPI and derived SDK input | Invent operations, change semantics, or include dependency-owned routes |

Rules:

- HTTP handlers and controller methods should be thin adapters. They may validate transport shape, call the service, and map service results to the response contract.
- Business decisions `MUST` live in service/use-case code that can be tested without an HTTP server.
- Repositories `MUST` receive tenant, organization, user, and data-scope decisions from service/context inputs. They must not infer authorization by reparsing headers or global request state.
- External calls `MUST` use generated SDKs, generated RPC clients, or approved provider adapters. Raw HTTP is allowed only inside an explicitly owned low-level provider adapter with tests and security review.
- A backend implementation `MUST NOT` copy appbase-owned IAM/session/workspace/bootstrap routes. It must consume appbase Rust crates and generated appbase SDKs where those capabilities are dependency-owned.

## 3. Route Path Ownership

HTTP route path definitions have one implementation owner per surface/capability.

Rust route crate path ownership:

```text
packages/native-rust/routes/<surface>/sdkwork-routes-<capability>-<surface>/
  src/paths.rs
  src/routes.rs
  src/handlers.rs
  src/manifest.rs
```

Java controller path ownership:

```text
src/main/java/<package>/<domain>/<capability>/controller/
  <Capability><Surface>Controller.java
```

Rules:

- Rust route crates `MUST` be named `sdkwork-routes-<capability>-open-api`, `sdkwork-routes-<capability>-app-api`, or `sdkwork-routes-<capability>-backend-api`.
- Rust route manifests `MUST` follow `API_SPEC.md` and materialize through `SDK_WORKSPACE_GENERATION_SPEC.md`.
- Java app-api controller class-level mappings `MUST` start with `/app/v3/api`.
- Java backend-api controller class-level mappings `MUST` start with `/backend/v3/api`.
- Java open-api controllers `MUST` use the approved versioned non-app/non-backend domain prefix, for example `/im/v3/api`.
- Method-level route mappings may be relative only when the class/module-level prefix is canonical.
- Path constants may exist for local implementation reuse, but they `MUST` be generated from or verified against the route manifest/OpenAPI authority. They are not public consumer contracts.
- A route path `MUST NOT` be duplicated across Java and Rust implementations unless the duplicate is an intentional SaaS/local parity implementation for the same operationId and authority.

## 4. Naming Standard

Backends use names that expose domain intent without leaking transport details into business code.

| Concept | Standard name shape | Example |
| --- | --- | --- |
| Rust route crate | `sdkwork-routes-<capability>-<surface>` | `sdkwork-routes-product-app-api` |
| Java controller | `<Capability><Surface>Controller` | `ProductAppApiController` |
| Handler function | `<verb>_<resource>` or `<action>_<resource>` | `list_products`, `submit_order` |
| Service/use-case | `<Capability>Service` or `<UseCase>Service` | `ProductService`, `SubmitOrderService` |
| Repository | `<Aggregate>Repository` | `ProductRepository` |
| Provider adapter | `<Provider><Capability>Adapter` | `StripePaymentAdapter` |
| Route manifest | `<packageName>.route-manifest.json` | `sdkwork-routes-product-app-api.route-manifest.json` |
| API authority | `sdkwork-<domain>-<surface>` | `sdkwork-commerce-app-api` |
| SDK family | `sdkwork-<domain>-sdk`, `sdkwork-<domain>-app-sdk`, `sdkwork-<domain>-backend-sdk` | `sdkwork-commerce-app-sdk` |

Rules:

- Use canonical domain names from `DOMAIN_SPEC.md`.
- Capability names should be small business units such as product, cart, order, payment, catalog, shipment, tenant, report, audit, conversation, or file.
- Controller and handler names `MUST NOT` drive OpenAPI tags or operationIds. Tags and operationIds follow `API_SPEC.md`.
- Avoid generic backend names such as `CommonController`, `BaseApiController`, `BizService`, `Manager`, or `Handler` unless they are framework-level abstractions with no business authority.
- Do not encode transport in service names unless the service truly owns a transport adapter. Prefer `ProductService` over `ProductHttpService`.

## 4.1 Java Spring Backend Profile

Java Spring backends follow the same contract-first model as Rust route crates. Spring annotations are implementation metadata, not the API authority.

Recommended package shape:

```text
src/main/java/<base_package>/<domain>/<capability>/
  controller/
    <Capability>AppApiController.java
    <Capability>BackendApiController.java
    <Capability>OpenApiController.java
  service/
    <Capability>Service.java
    <UseCase>Service.java
  repository/
    <Aggregate>Repository.java
  mapper/
    <Capability>Mapper.java
  config/
    <Capability>BackendConfig.java
```

Rules:

- Controller classes `MUST` be named by capability and surface, for example `ProductAppApiController`, `OrderBackendApiController`, or `ConversationOpenApiController`.
- Controller class-level mappings `MUST` carry the canonical surface prefix. Method-level mappings should be relative resource paths.
- Controller methods `MUST` be thin: validate/decode request, consume the typed request context, call a service/use-case, and map the result to the OpenAPI response.
- Controller methods `MUST NOT` call repositories directly for business operations.
- Transaction boundaries `MUST` live in service/use-case methods, not controller methods, unless the method is an infrastructure-only health or diagnostics endpoint with no business write.
- Spring validation annotations may be used only when they match or tighten the OpenAPI schema in documented ways. They must not silently narrow an SDK contract.
- Problem-detail mapping `MUST` be centralized through framework exception handling or a shared response mapper. Controllers must not hand-build incompatible error envelopes.
- `ResponseEntity<Map<String, Object>>`, raw maps, and untyped JSON nodes are forbidden for SDK-generated operations unless the OpenAPI schema explicitly declares a flexible object.
- OpenAPI tags and operationIds `MUST NOT` be inferred from controller class names. They follow `API_SPEC.md`.
- Java packages `SHOULD` use canonical domain and capability names. Legacy packages may remain during migration, but materialized OpenAPI ownership must be explicit.

## 4.2 Rust HTTP Backend Profile

Rust HTTP backends separate route/path crates from service/runtime crates. Route crates describe HTTP shape; service crates own business behavior.

Recommended package shape:

```text
packages/native-rust/
  routes/<surface>/sdkwork-routes-<capability>-<surface>/
    Cargo.toml
    src/lib.rs
    src/paths.rs
    src/routes.rs
    src/handlers.rs
    src/manifest.rs
  services/<domain>/<capability>/
    Cargo.toml
    src/lib.rs
    src/service.rs
    src/repository.rs
    src/errors.rs
```

Rules:

- Route crates own `paths.rs`, `routes.rs`, `handlers.rs`, and `manifest.rs` for one capability and one surface.
- Route crates `MUST` emit or feed `kind: sdkwork.route.manifest` and must be materialized through `SDK_WORKSPACE_GENERATION_SPEC.md`.
- Handler functions `MUST` use snake_case names and consume typed extractors/extensions for request context, request body, path parameters, query parameters, and app state.
- Handler functions `MUST NOT` parse raw headers for credentials, tenant context, user context, organization context, permission scopes, or request identity.
- Handler functions `MUST` call service traits or service structs. They must not run SQL directly except in explicitly infrastructure-only diagnostics routes.
- Service crates may depend on repository traits, provider adapter traits, generated dependency SDKs, and appbase runtime context crates. They `MUST NOT` depend on generated SDKs for the same authority they implement.
- Rust errors should map through a shared problem-detail conversion boundary. Handlers must not leak `Debug` output from database, provider, or framework errors.
- Route crates `SHOULD` expose only package-root modules needed for router composition and manifest extraction. Generated SDK consumers and UI packages must not import them.
- Local/private Rust implementations of appbase-owned behavior `MUST` reuse appbase Rust runtime crates. They must not fork appbase IAM/session/context behavior into product route crates.

## 4.3 Backend Anti-Patterns

The following patterns are standards failures:

- A controller or handler owns business rules that cannot be tested without an HTTP server.
- A handler reparses `Authorization`, `Access-Token`, `X-API-Key`, tenant, organization, user, permission, or request id headers after framework context resolution.
- A route crate, controller, or backend service depends on the generated SDK for the same API authority it implements.
- A product backend copies appbase IAM/session/workspace/bootstrap routes into its own authority.
- A repository applies tenant isolation by reading global HTTP request state.
- An SDK-generated operation returns an untyped map or local DTO that does not match OpenAPI.
- A backend/admin UI or frontend service imports route constants instead of using generated SDK clients.
- A materializer includes dependency-owned routes in a product-owned SDK generation input.

## 5. Request Context And Security

Protected backends consume a typed request context produced by the standard framework chain.

Rules:

- Surface classification, request identity, credential parsing, context resolution, authentication, context injection, and secure response headers `MUST` run before protected handlers.
- Protected app-api and backend-api handlers `MUST` consume the standard dual-token context.
- Protected open-api handlers `MUST` consume the standard API key context unless a documented compatibility contract declares another mode.
- Handlers and services `MUST NOT` parse `Authorization`, `Access-Token`, `X-API-Key`, tenant IDs, organization IDs, user IDs, permission scopes, or request IDs from raw headers.
- The typed request context for authenticated user flows `MUST` carry tenant id, organization id, login scope, user id, session id, app id, environment, deployment mode, auth level, data scope, and permission scope resolved from verified tokens or server-side session lookup.
- Backend implementations `MUST NOT` fill authenticated request context with demo tenants, hard-coded tenants, mock users, email-normalized user ids, default organization ids, or request payload/header values when token/session context is missing.
- When request path/body/query tenant or organization values are present, service/use-case code `MUST` compare them with typed context or explicit cross-tenant authorization before repository access.
- Business authorization `MUST` be enforced in the service/use-case layer or a shared policy service, not only in router middleware and not only in UI.
- Tenant and data-scope filters `MUST` be applied before repository queries return data.
- Server-owned request identity follows `API_SPEC.md` and `OBSERVABILITY_SPEC.md`; clients do not supply request correlation IDs for app/backend SDK calls.

## 6. Validation, Errors, And Responses

Rules:

- Request validation `MUST` match the OpenAPI schema. Runtime-only validation may be stricter only when the contract documents it.
- All API errors `MUST` map to the SDKWork problem-detail standard from `API_SPEC.md`.
- Handlers `MUST NOT` leak stack traces, SQL, tokens, API keys, internal hostnames, provider secrets, or raw provider errors.
- Service errors should use domain-level error types that can be mapped consistently to problem-detail responses.
- Create/update/delete commands that are retriable or externally visible `MUST` follow the idempotency rules in `API_SPEC.md`.
- List/search endpoints `MUST` be paginated or explicitly bounded.
- Browser-facing `int64` and decimal fields `MUST` use string-safe API schemas as defined by `API_SPEC.md`.

## 7. Transactions, Persistence, And Events

Rules:

- Service/use-case code owns transaction boundaries for commands that modify persistent state.
- Repository methods should be small, named by aggregate intent, and use canonical database naming from `DATABASE_SPEC.md`.
- Tenant isolation and data-scope predicates `MUST` be present in repository queries for tenant-owned data unless the service proves a platform-scope operation.
- Idempotent command state, event publication, cache invalidation, and audit writes should be coordinated in the same use-case boundary.
- Domain events follow `EVENT_SPEC.md`; outbox or equivalent durable publication is required for cross-service effects that must survive process failure.
- Cache usage follows `CACHE_SPEC.md`; cache keys must include tenant/scope where required and must not replace authorization checks.

## 8. SDK And Dependency Boundaries

Rules:

- Backend implementations `MUST` generate SDKs only from owner-only API authorities.
- Dependency-owned APIs such as appbase, Drive, provider, or shared platform modules `MUST` remain dependency SDKs or approved composed wrappers.
- Dependency-owned APIs are not exported from a product backend SDK by default. Any product backend
  facade that intentionally exposes dependency capability must declare `dependencyApiExports` and
  implement the export in authored composition code outside generated transport ownership.
- Generated SDKs call the API. Route crates and controllers implement the API. A route crate/controller `MUST NOT` depend on the generated SDK for the same authority.
- Service facades for UI/backend-admin consumers use generated SDK clients according to `SDK_SPEC.md` and `FRONTEND_SPEC.md`; they do not use route constants.
- Backend-to-backend integration may use generated backend SDKs, generated RPC clients, or explicit provider adapters. It must not use hidden raw HTTP to bypass a missing contract.

## 9. Runtime Composition

Rules:

- Application shells compose routers/controllers, middleware/interceptors, request context, dependency SDK clients, repositories, provider adapters, and service instances.
- Rust-enabled application shells that participate in app composition `MUST` follow `APP_SDK_INTEGRATION_SPEC.md`: compose Rust route crates, appbase Rust context/auth/bootstrap crates, dependency SDK clients, product service crates, and generated product SDK families without copying dependency-owned API routes.
- Dependency route metadata is not handler coverage. A Rust route manifest, path list, OpenAPI
  authority, or route contract crate can describe expected routes, but the runtime may treat a
  dependency API as same-origin mounted only when an executable router, controller, or handler
  adapter is imported through a public dependency export and covered by tests.
- Executable dependency handler coverage must be backed by real runtime state: production tables,
  repositories, service ports, or configured upstream services. Demo/sample routers, mock stores,
  fixture-only data, hard-coded IAM tenants/users/organizations/API keys, or synthetic success
  responses must not be mounted as the implementation for application development, test, staging, or
  production runtimes.
- Application shells that compose dependency APIs in-process `MUST` declare the result in
  `dependencyApiSurfaces`, including dependency workspace, surface, prefix, Rust route contract
  source, executable router export, mount mode, and coverage evidence. A backend runtime that lacks
  this declaration must be treated as not serving the dependency API for SDK base URL defaults.
- Split/server runtimes `MUST` declare dependency surfaces as `external-service` and provide
  dependency-specific upstream/base URL configuration. An upstream id such as
  `sdkwork-appbase-app-api` is valid only when it resolves before the proxy/router starts.
- Embedded or same-process runtimes `MUST` import the dependency-owned executable router,
  controller, handler adapter, or service builder through a public component export. Starting the
  product server, Tauri dev command, or local workspace command does not prove dependency API
  availability unless that executable dependency export is mounted and covered.
- Backend startup or preflight checks `MUST` fail before serving traffic when a configured
  dependency API export requires a same-origin dependency surface but the executable mount or
  external dependency base URL is missing. User requests must not be used as the first detector of
  missing dependency runtime composition.
- If the dependency exports route metadata but no executable router export, the consuming backend
  must configure that dependency SDK as an external service or add an approved handler adapter before
  same-origin dependency SDK calls are allowed.
- A backend runtime that serves admin UI modules using `@sdkwork/appbase-backend-sdk` for appbase
  backend IAM `MUST` either mount a production-capable appbase backend router/controller/service
  adapter for `/backend/v3/api/iam/*` and declare verified `dependencyApiSurfaces` evidence, or
  route those SDK calls to an explicit appbase backend service/gateway. Mounting only appbase
  app-api routes, importing appbase route metadata, or mounting a local/demo IAM router is not
  sufficient handler coverage.
- Runtime composition `MUST` be environment-aware through `CONFIG_SPEC.md` and `ENVIRONMENT_SPEC.md`, not hard-coded per handler.
- SaaS/private/local parity follows `DEPLOYMENT_SPEC.md`: shared APIs preserve paths, operationIds, schemas, auth semantics, and problem-detail behavior across runtime modes.
- Rust local/private implementations that expose or validate appbase capabilities `MUST` use appbase Rust runtime crates for context, auth, bootstrap, and protected route behavior, plus generated appbase SDKs when Rust code calls appbase HTTP APIs directly.
- Tauri/native commands are host adapters. They may call backend services through approved boundaries, but they must not become a parallel hidden HTTP API surface.

## 10. Verification

Every web backend change should verify the relevant subset:

- Route/controller paths match `API_SPEC.md` prefixes and surface rules.
- Rust route manifests pass `API_SPEC.md` and `SDK_WORKSPACE_GENERATION_SPEC.md` validation when Rust routes are touched.
- Authority OpenAPI materializes deterministically and contains only owner operations before SDK generation.
- Generated SDKs compile and expose the expected resource-style methods.
- Handler/controller tests cover request decoding, typed context consumption, problem-detail mapping, and forbidden raw header parsing.
- Service tests cover business rules, authorization decisions, tenant/data-scope behavior, idempotency, and transaction behavior without starting an HTTP server.
- Repository tests cover tenant predicates, indexes/query shape where relevant, optimistic concurrency, and migration compatibility.
- Security tests cover missing/invalid credentials, insufficient permission, wrong tenant, and absence of app login token fallback for protected open-api.
- Static scans fail on UI/service imports of route crates, generated SDK output edits, raw HTTP fallback, manual auth/API key headers, and handler-level credential reparsing.
- Dependency API surface tests compare `sdkDependencies` with `dependencyApiSurfaces`, fail when a
  same-origin dependency has no verified executable router/controller coverage, and fail when an
  external dependency SDK can silently fall back to product-owned app/backend base URLs.
- Dependency API surface tests fail when verified same-origin coverage is backed by demo/mock/fake
  rows, hard-coded IAM tenants/users/organizations/API keys, fixture stores, or synthetic command
  success instead of real stores/services/upstreams.
- Dependency API export tests compare `dependencyApiExports` with public backend/component exports
  and fail when a backend facade re-exports dependency capability without an approved composed
  wrapper, service port, or dependency SDK injection path.
- Startup/preflight tests fail when a dependency route would return a proxy configuration error,
  `502`, or `404` because the dependency upstream is missing, the executable router/controller is
  not mounted, or coverage is only route metadata.
- Observability tests or smoke checks verify request id propagation, structured logs, metrics, traces, and audit events for protected or high-risk operations.

## 11. Acceptance Checklist

- [ ] API contract exists or is updated before implementation.
- [ ] Java controller or Rust route crate path definitions match the approved surface prefix.
- [ ] Rust route crates follow `sdkwork-routes-<capability>-<surface>` and emit or feed `sdkwork.route.manifest`.
- [ ] Route/controller changes materialize into the owner-only API authority and derived SDK input.
- [ ] SDK generation uses the canonical SDKWork generator and generated output remains untouched.
- [ ] Handlers consume typed request context and do not parse raw credentials, request IDs, tenant IDs, or user IDs.
- [ ] Authenticated typed context includes tenant, organization, login scope, user, session, app, environment, deployment mode, auth level, data scope, and permission scope from verified token/session context, with no demo/default/mock fallback.
- [ ] Services own business rules, authorization, transaction boundaries, idempotency, events, and cache invalidation.
- [ ] Repositories are tenant/data-scope safe for tenant-owned data.
- [ ] Dependency-owned appbase, Drive, provider, or shared-module routes are consumed through dependencies, not copied into the product authority.
- [ ] Dependency API exports are explicit in `dependencyApiExports`; generated product SDKs remain
  owner-only.
- [ ] Same-origin dependency API routes are backed by executable dependency router/controller/service
  exports with verified coverage; split/server dependency routes have explicit upstream/base URL
  config.
- [ ] Errors map to problem-detail responses and do not leak sensitive internals.
- [ ] Tests cover contract generation, security, service behavior, repository isolation, and static boundary scans.
