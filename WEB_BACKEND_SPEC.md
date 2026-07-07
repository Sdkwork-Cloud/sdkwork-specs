# Web Backend Development Standard

- Version: 1.0
- Scope: Java Spring HTTP backends, Rust HTTP route crates, standalone/cloud web backend implementations, and backend API implementation boundaries
- Related: `APPLICATION_LAYERED_ARCHITECTURE_SPEC.md`, `COMPOSABLE_ARCHITECTURE_SPEC.md`, `API_SPEC.md`, `PAGINATION_SPEC.md`, `WEB_FRAMEWORK_SPEC.md`, `I18N_SPEC.md`, `APPLICATION_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, `DOMAIN_SPEC.md`, `RUST_CODE_SPEC.md`, `SDK_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md`, `COMPONENT_SPEC.md`, `IAM_SPEC.md`, `IAM_LOGIN_INTEGRATION_SPEC.md`, `SECURITY_SPEC.md`, `DATABASE_SPEC.md`, `CACHE_SPEC.md`, `EVENT_SPEC.md`, `OBSERVABILITY_SPEC.md`, `PERFORMANCE_SPEC.md`, `DEPLOYMENT_SPEC.md`, `TEST_SPEC.md`

This standard defines how SDKWork web backends are implemented after the HTTP contract has been designed. `API_SPEC.md` remains the contract source of truth. `I18N_SPEC.md` owns backend message and locale semantics. `APPLICATION_LAYERED_ARCHITECTURE_SPEC.md` owns the application-wide L0-L6 layer profile. This file owns web-backend naming, handler/service/repository boundaries, route path placement, request context usage, and backend verification expectations. Cross-stack layer roles and composition closure follow `COMPOSABLE_ARCHITECTURE_SPEC.md`.

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
- Backend code `MUST` preserve the same operationId, path, schema, security,
  problem-detail error, tenant, and authorization semantics across Java/Rust
  implementations, standalone/cloud profiles, and supported runtime targets.
- UI packages, frontend services, `backend-admin` UI packages, and generated SDK consumers `MUST NOT` import route crates, controller classes, path constants, or handler internals.

## 2. Implementation Layers

| Layer | Responsibility | Must not do |
| --- | --- | --- |
| Router/controller registration | Mount HTTP method, path, middleware/interceptor chain, and handler binding | Own business logic, build SDK responses ad hoc, bypass standard context |
| Handler/controller method | Decode request, consume typed context, call service, map result/error to API contract | Reparse credentials or locale headers, run SQL directly, assemble raw auth/API key/locale headers, own transactions by habit |
| Service/use-case | Business rules, authorization decisions, transaction orchestration, idempotency, event/cache coordination, translation-key selection when needed | Depend on HTTP framework types, parse raw headers, return framework response objects, branch on localized strings |
| Repository | Persistence query/command implementation, schema mapping, optimistic concurrency support | Own business policy, tenant inference, permission checks, HTTP concerns |
| Provider/client adapter | External provider or internal SDK/RPC integration through approved SDK/client boundary | Hide raw HTTP fallbacks, leak provider DTOs into API schemas |
| Materialization/generation tooling | Convert route/controller manifests to authority OpenAPI and derived SDK input | Invent operations, change semantics, or include dependency-owned routes |

Rules:

- SDKWork backend layers map to the composable architecture profile:
  L0 API authority, L1 route/controller adapter, L2 service/use-case, L3 domain/ports,
  L4 infrastructure adapter, L5 runtime composition, and L6 runtime operations.
- The L0-L6 dependency direction and cross-language static scan are defined by
  `APPLICATION_LAYERED_ARCHITECTURE_SPEC.md`; web-backend implementations `MUST` run
  `check-application-layering.mjs` when controller/service/repository boundaries are touched.
- HTTP handlers and controller methods should be thin adapters. They may validate transport shape, call the service, and map service results to the response contract.
- Business decisions `MUST` live in service/use-case code that can be tested without an HTTP server.
- Repositories `MUST` receive tenant, organization, user, and data-scope decisions from service/context inputs. They must not infer authorization by reparsing headers or global request state.
- External calls `MUST` use generated SDKs, generated RPC clients, or approved provider adapters. Raw HTTP is allowed only inside an explicitly owned low-level provider adapter with tests and security review.
- A backend implementation `MUST NOT` copy appbase-owned IAM/session/workspace/bootstrap routes. It must consume appbase Rust crates and generated appbase SDKs where those capabilities are dependency-owned.
- User-facing and operator-facing backend messages `MUST` use stable translation keys or framework message resolution per `I18N_SPEC.md`. Authored backend message resources `MUST` follow the Rust or Java/Spring layouts in `I18N_SPEC.md` section 6.1. Handlers, services, and repositories `MUST NOT` branch on localized strings.

## 3. Route Path Ownership

HTTP route path definitions have one implementation owner per surface/capability.

Rust route crate path ownership:

```text
crates/sdkwork-routes-<capability>-<surface>/
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
- A route path `MUST NOT` be duplicated across Java and Rust implementations
  unless the duplicate is an intentional standalone/cloud parity implementation
  for the same operationId and authority.
- Implementations `MUST` pass route registry collision validation before release. The normalized collision key is `(surface, method, path)` with `{id}`, `:id`, and `<id>` treated as the same parameter segment.
- Standard health/readiness paths such as `/app/v3/api/system/health`,
  `/app/v3/api/system/ready`, `/backend/v3/api/system/health`, and
  `/backend/v3/api/system/ready` are reserved for the standard health route owner. Business route
  crates and controllers must use capability-specific paths.
- Consumer backends `MUST NOT` copy dependency-owned route paths into local controllers or route crates; they must mount the dependency route crate through gateway assembly or use an external dependency SDK/upstream declared by composition.

## 4. Naming Standard

Backends use names that expose domain intent without leaking transport details into business code.

| Concept | Standard name shape | Example |
| --- | --- | --- |
| Rust route crate | `sdkwork-routes-<capability>-<surface>` | `sdkwork-routes-merchandise-app-api` |
| Java controller | `<Capability><Surface>Controller` | `ProductAppApiController` |
| Handler function | `<verb>_<resource>` or `<action>_<resource>` | `list_products`, `submit_order` |
| Service/use-case | `<Capability>Service` or `<UseCase>Service` | `ProductService`, `SubmitOrderService` |
| Repository | `<Aggregate>Repository` | `ProductRepository` |
| Provider adapter | `<Provider><Capability>Adapter` | `StripePaymentAdapter` |
| Route manifest | `<packageName>.route-manifest.json` | `sdkwork-routes-merchandise-app-api.route-manifest.json` |
| API authority | `sdkwork-<domain>-<surface>` | `sdkwork-commerce (deleted)-app-api` |
| SDK family | `sdkwork-<domain>-sdk`, `sdkwork-<domain>-app-sdk`, `sdkwork-<domain>-backend-sdk` | `sdkwork-commerce (deleted)-app-sdk` |

Rules:

- Use canonical domain names from `DOMAIN_SPEC.md`.
- Capability names should be small business units such as merchandise, cart, order, payment, catalog, shipment, tenant, report, audit, conversation, or file.
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
- Problem-detail mapping `MUST` be centralized through framework exception handling or a shared response mapper. Controllers must not hand-build incompatible error envelopes or legacy success envelopes such as `PlusApiResult`, `AppbaseApiResult`, or `StoreApiResult`.
- Locale and message resolution `MUST` be centralized through `WEB_FRAMEWORK_SPEC.md` locale context and message mapping. Controllers must not parse locale headers, cookies, query parameters, or user-agent language values.
- Success responses `MUST` map service results to `SdkWorkApiResponse` per `API_SPEC.md` section 15 for SDKWork-owned business operations on `app-api`, `backend-api`, and business `open-api`. Vendor compatibility `open-api` adapter handlers declared with `x-sdkwork-wire-protocol: external` per section 4.5.2 `MAY` return upstream wire instead. Route handlers and controllers `MUST NOT` return bare domain DTOs at the HTTP JSON root or wire field `requestId` for business operations.
- Protected open-api handlers `MUST` consume framework-resolved API key, OAuth bearer, or flexible open-api context according to the route manifest. They `MUST NOT` parse credential headers directly unless the route is a vendor compatibility API declared under `API_SPEC.md` section 4.5.2.
- `ResponseEntity<Map<String, Object>>`, raw maps, and untyped JSON nodes are forbidden for SDK-generated operations unless the OpenAPI schema explicitly declares a flexible object.
- OpenAPI tags and operationIds `MUST NOT` be inferred from controller class names. They follow `API_SPEC.md`.
- Java packages `SHOULD` use canonical domain and capability names. Legacy packages may remain during migration, but materialized OpenAPI ownership must be explicit.

## 4.2 Rust HTTP Backend Profile

Rust HTTP backends separate HTTP route adaptation, business services, database access, and runnable
process composition into distinct crate responsibilities. `RUST_CODE_SPEC.md` owns the complete Rust
crate taxonomy and directory layouts; this section defines the web-backend boundary.

Required crate families for Rust HTTP backends:

| Responsibility | Crate family | Web backend role |
| --- | --- | --- |
| HTTP route/API adapter | `sdkwork-routes-<capability>-<surface>` | paths, routes, handlers, manifest, request/response mapping |
| Business service/use case | `sdkwork-<domain>-<capability>-service` | business rules, authorization, transactions, idempotency, repository/provider ports |
| SQL repository implementation | `sdkwork-<domain>-<capability>-repository-sqlx` | SQLx row mapping, SQL queries, tenant/data-scope-safe repository implementation |
| Migration-only HTTP API server process | `sdkwork-<application-code>-api-server` | retired listener role; allowed only while migrating to standalone/cloud gateway |
| In-process service host | `sdkwork-<application-code>-service-host` | service container for standalone/native usage, no HTTP route mounting |
| Standalone gateway/proxy | `sdkwork-<application-code>-standalone-gateway` | standalone application ingress, upstream routing, route precedence, dependency API surface proxying |
| Cloud gateway/proxy | `sdkwork-<application-code>-cloud-gateway` | cloud application ingress, upstream routing, route precedence, dependency API surface proxying |
| Platform gateway | `sdkwork-api-cloud-gateway` | shared `platform.api-gateway` ingress |

Required route crate shape:

```text
crates/sdkwork-routes-<capability>-<surface>/
  Cargo.toml
  src/lib.rs
  src/paths.rs
  src/routes.rs
  src/handlers.rs
  src/manifest.rs
  src/error.rs
  src/mapper/mod.rs
```

Required service crate shape:

```text
crates/sdkwork-<domain>-<capability>-service/
  Cargo.toml
  src/lib.rs
  src/domain/
  src/ports/
  src/service/
  src/error.rs
```

Required SQL repository implementation crate shape:

```text
crates/sdkwork-<domain>-<capability>-repository-sqlx/
  Cargo.toml
  src/lib.rs
  src/db/
  src/mapper/
  src/repository/
  src/error.rs
```

Migration-only API server process crate shape:

```text
crates/sdkwork-<application-code>-api-server/
  Cargo.toml
  src/main.rs
  src/bootstrap/
  src/server/
  src/preflight/
  src/health.rs
```

`src/health.rs` `MUST` assemble `sdkwork_web_bootstrap::ReadinessCheck` implementations for the process. It `MUST NOT` define local `/healthz`, `/readyz`, `/livez`, or `/metrics` route handlers; those `MUST` be mounted through `sdkwork-web-bootstrap::service_router` per `HEALTH_CHECK_SPEC.md`.

Rules:

- Route crates own `paths.rs`, `routes.rs`, `handlers.rs`, and `manifest.rs` for one capability and one surface.
- Route crates `MUST` emit or feed `kind: sdkwork.route.manifest` and must be materialized through `SDK_WORKSPACE_GENERATION_SPEC.md`.
- Handler functions `MUST` use snake_case names and consume typed extractors/extensions for request context, request body, path parameters, query parameters, and app state.
- Handler functions `MUST NOT` parse raw headers for credentials, tenant context, user context, organization context, permission scopes, request identity, locale, or language.
- Handler functions `MUST` call service traits or service structs. They must not run SQL directly except in explicitly infrastructure-only diagnostics routes.
- Service crates define and depend on repository/provider/cache/event ports. They `MUST NOT`
  depend on concrete SQLx repository crates or generated SDKs for the same authority they
  implement.
- SQL repository implementation crates implement service-defined repository ports and own SQLx
  mapping. They `MUST NOT` own business policy or HTTP context parsing.
- Migration-only API server process crates construct DB pools, repositories, services, adapters, and route crates only until default public ingress moves to a standalone/cloud gateway. They `MUST NOT` own business rules, SQL query bodies, or OpenAPI authority.
- Rust errors should map through a shared problem-detail conversion boundary. Handlers must not leak `Debug` output from database, provider, or framework errors.
- Route crates `SHOULD` expose only package-root modules needed for router composition and manifest extraction. Generated SDK consumers and UI packages must not import them.
- Local/private Rust implementations of appbase-owned behavior `MUST` reuse appbase Rust runtime
  crates. They must not fork appbase IAM/session/context behavior into application route crates.
- Rust crates `MUST NOT` use generic `product`, `runtime`, `backend`, `core`, `common`, or
  `manager` suffixes for application entrypoints, service aggregation, or backend implementation.
  Use `service-host`, `native-host`, `tauri-host`, `worker`, `standalone-gateway`,
  `cloud-gateway`, or platform `sdkwork-api-cloud-gateway` according to
  `RUST_CODE_SPEC.md`; `api-server` is migration-only.

### 4.2.1 Gateway Mount Exports (Normative)

Every Rust HTTP route crate that participates in application gateway assembly `MUST` expose two package-root symbols:

| Export | Shape | Responsibility |
| --- | --- | --- |
| `gateway_mount_business` | `fn gateway_mount_business(...) -> Router` or `async fn gateway_mount_business(...) -> Router` | Return the surface **business** router with web-framework wrapping; `MUST NOT` mount `/healthz`, `/livez`, `/readyz`, or `/metrics` |
| `gateway_mount` | `fn gateway_mount(...) -> Router` or `async fn gateway_mount(...) -> Router` | Construct and return the surface router for single-surface tests or migration-only listeners; `MAY` include infrastructure routes when the surface runs as the sole HTTP plane in the process |
| `gateway_route_manifest` | `fn gateway_route_manifest() -> ...` or `const GATEWAY_ROUTE_MANIFEST: ...` | Expose `kind: sdkwork.route.manifest` metadata for mount ordering and validation |

Rules:

- `gateway_mount_business` `MUST` wrap existing `build_*_public_app` helpers through `sdkwork-web-framework` bootstrap helpers; it `MUST NOT` fork credential or request-context parsing.
- `gateway_mount` `MUST` delegate to `gateway_mount_business` plus listener infrastructure when the route crate mounts probes locally, or delegate directly to `gateway_mount_business` when infrastructure is owned by the listener entrypoint.
- Gateway assembly (`sdkwork-<application-code>-gateway-assembly`) `MUST` merge `gateway_mount_business` (not full `gateway_mount`) when two or more surfaces are composed, then mount infrastructure **once** through `sdkwork-web-bootstrap::assemble_multi_surface_router`, `mount_infra_routes`, or an approved domain wrapper such as `mount_<application-code>_infra_routes`.
- Legacy `build_*` exports `MAY` remain for `*-service-bin` and tests during migration, but gateway assembly `MUST` call `gateway_mount_business` (or `gateway_mount` when the surface is the only HTTP plane in the process) once the export exists.
- `gateway_route_manifest` `SHOULD` delegate to the crate's `manifest.rs` authority (`open_route_manifest`, `app_route_manifest`, `backend_route_manifest`, or equivalent).
- Route crates `MUST NOT` require gateway crates to import private modules, service internals, or handler modules directly.
- Application gateway assembly (`sdkwork-<application-code>-gateway-assembly`) is the only place that merges multiple `gateway_mount` routers for a deployment profile. Standalone/cloud gateway crates `MUST NOT` merge sibling route crates directly.

## 4.3 Backend Anti-Patterns

The following patterns are standards failures:

- A controller or handler owns business rules that cannot be tested without an HTTP server.
- A handler reparses `Authorization`, `Access-Token`, `X-API-Key`, tenant, organization, user, permission, request id, locale, or language headers after framework context resolution.
- A route crate, controller, or backend service depends on the generated SDK for the same API authority it implements.
- An application backend copies appbase IAM/session/workspace/bootstrap routes into its own authority.
- A repository applies tenant isolation by reading global HTTP request state.
- An SDK-generated operation returns an untyped map or local DTO that does not match OpenAPI.
- A backend/admin UI or frontend service imports route constants instead of using generated SDK clients.
- A materializer includes dependency-owned routes in an application-owned SDK generation input.

## 4.4 Framework Integration

Any SDKWork web backend, application repository, application module, route crate, migration-only API server, gateway, or controller package that owns, serves, develops, proxies, or composes an HTTP `*-api` surface `MUST` follow `WEB_FRAMEWORK_SPEC.md`. Rust HTTP backends `MUST` integrate `sdkwork-web-framework`. Java Spring backends `MUST` preserve equivalent `WebRequestContext` vocabulary, interceptor semantics, route metadata, and problem-detail behavior.

Rules:

- Route crates `MUST` mount routers through framework helpers such as `with_web_request_context` and `MUST` declare `WebRequestContext` on every handler.
- Gateway and migration-only API server crates `MUST` assemble the standard 18-stage chain through `sdkwork-web-bootstrap` or an equivalent documented framework bootstrap API.
- Infrastructure liveness, readiness, and metrics probes `MUST` follow `HEALTH_CHECK_SPEC.md` and `MUST` be mounted through `sdkwork-web-bootstrap::service_router` or `WebFrameworkBuilder`.
- Route crates, migration-only API servers, gateways, and controller packages `MUST NOT` assemble ad hoc Axum/Tower security stacks, custom credential parsers, local Spring filter frameworks, or parallel request-context types that bypass the framework profile.
- Business adapters such as appbase IAM `MUST` implement framework extension traits (`WebRequestContextResolver`, `ApiKeyLookupService`, `OAuthTokenLookupService`, `OpenApiCredentialSchemeDetector`, `LocaleResolver`, `MessageBundleProvider`, `AuthorizationPolicy`, `TenantIsolationPolicy`, `DomainContextInjector`) instead of exposing a separate HTTP context framework.
- Handlers `MUST NOT` parse `Authorization`, `Access-Token`, `X-API-Key`, tenant IDs, organization IDs, user IDs, permission scopes, request IDs, locale, or language from raw headers after framework context resolution.
- Services `MUST` accept `&WebRequestContext` or `TenantAppContext`. Repositories `MUST` receive tenant and data-scope decisions from service/context inputs.
- Route manifests `MUST` declare `requestContext: WebRequestContext` and `apiSurface` on every route entry. They `SHOULD` use framework contract types such as `HttpRoute` and `RouteAuth` when projecting OpenAPI materialization input.
- L1 crate APIs, pipeline stage names, extension trait signatures, and capability matrix: `../sdkwork-web-framework/specs/WEB_FRAMEWORK_STANDARD.md`.

## 5. Request Context And Security

Protected backends consume a typed request context produced by the standard framework chain.

Rules:

- Surface classification, request identity, credential parsing, context resolution, authentication, context injection, and secure response headers `MUST` run before protected handlers.
- Locale resolution `MUST` run through the framework request context path before handlers use user-facing or operator-facing messages.
- Protected app-api and backend-api handlers `MUST` consume the standard dual-token context.
- Protected open-api handlers `MUST` consume framework-resolved API key, OAuth bearer, or flexible open-api context according to the route manifest. They `MUST NOT` parse credential headers directly unless the route is a vendor compatibility API declared under `API_SPEC.md` section 4.5.2.
- Handlers and services `MUST NOT` parse `Authorization`, `Access-Token`, `X-API-Key`, tenant IDs, organization IDs, user IDs, permission scopes, request IDs, locale, or language from raw headers.
- The typed request context for authenticated user flows `MUST` carry tenant
  id, organization id, login scope, user id, session id, app id, environment,
  deployment profile, runtime target, auth level, data scope, and permission
  scope resolved from verified tokens or server-side session lookup.
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

### 7.1 Operation Implementation Semantics

Backend implementation `MUST` preserve the API operation pattern declared in `API_SPEC.md` section 15.4.

| Operation | Handler responsibility | Service/use-case responsibility | Repository/adapter responsibility |
| --- | --- | --- | --- |
| Retrieve | Decode path id and context | Authorize resource visibility and choose 403/404 hiding behavior | Query by id with tenant/data-scope predicates |
| List/search | Decode standard query/body before service call | Validate filters, sort, page bounds, and scope | Execute SQL/keyset or maintained-index window per `PAGINATION_SPEC.md` |
| Create | Decode typed body and idempotency key | Validate invariants, enforce dedupe/idempotency, create audit/event records | Insert with unique constraints and tenant scope |
| Update | Decode path id, body, and precondition | Enforce optimistic concurrency and business rules in one transaction | Update by id + version/etag predicate; return affected-row conflict signals |
| Delete | Decode path id only | Decide soft delete, hard delete, archive, cascade, audit, and event semantics | Delete/update tombstone with scoped predicates |
| Command | Decode action body and idempotency key | Own state transition, idempotency, transaction, audit, events, cache invalidation | Persist transition and side-effect records through explicit ports |
| Async command | Decode command body and return accept result | Enqueue durable operation and expose status resource | Persist operation record, outbox/job row, or queue cursor |
| Bulk command | Decode bounded item array | Enforce all-or-nothing or item-partial semantics and item-level results | Use bounded batch SQL/ports; never unbounded collect or per-item hidden HTTP loops |

Rules:

- Controllers and handlers `MUST NOT` implement create/update/delete/command business rules inline. They call a service/use-case and map its typed result through framework response helpers.
- Create/update/delete/command services `MUST` define transaction boundaries explicitly. Side effects that must survive process failure use outbox, durable jobs, or provider-adapter records, not best-effort after-response callbacks.
- Idempotency lookup and write `MUST` happen before irreversible side effects and in the same use-case boundary as the business mutation when the operation declares `Idempotency-Key`.
- Optimistic concurrency failures from affected-row count, ETag mismatch, or version mismatch `MUST` map to `41201 PRECONDITION_FAILED` or `40901 CONFLICT` according to `API_SPEC.md` section 17.
- Delete handlers `MUST NOT` accept JSON bodies. If user-provided reason or policy is required, expose a command route instead of overloading `DELETE`.
- Bulk implementations `MUST` bound item count before repository access and `MUST` return typed item results when partial success is allowed.

## 8. SDK And Dependency Boundaries

Rules:

- Backend implementations `MUST` generate SDKs only from owner-only API authorities.
- Dependency-owned APIs such as appbase, Drive, provider, or shared platform modules `MUST` remain dependency SDKs or approved composed wrappers.
- Dependency-owned APIs are not exported from an application-owned backend SDK by default. Any
  application backend facade that intentionally exposes dependency capability must declare
  `dependencyApiExports` and implement the export in authored composition code outside generated
  transport ownership.
- Generated SDKs call the API. Route crates and controllers implement the API. A route crate/controller `MUST NOT` depend on the generated SDK for the same authority.
- Service facades for UI/backend-admin consumers use generated SDK clients according to `SDK_SPEC.md` and `FRONTEND_SPEC.md`; they do not use route constants.
- Backend-to-backend integration may use generated backend SDKs, generated RPC clients, or explicit provider adapters. It must not use hidden raw HTTP to bypass a missing contract.

## 9. Runtime Composition

Rules:

- Application shells compose routers/controllers, middleware/interceptors, request context, dependency SDK clients, repositories, provider adapters, and service instances.
- Rust-enabled application shells that participate in app composition `MUST` follow `APP_SDK_INTEGRATION_SPEC.md` and `WEB_FRAMEWORK_SPEC.md`: compose Rust route crates through `sdkwork-web-framework`, appbase/product framework adapters, dependency SDK clients, application service crates, and generated application-owned SDK families without copying dependency-owned API routes.
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
  `sdkwork-iam-app-api` is valid only when it resolves before the proxy/router starts.
- Embedded or same-process runtimes `MUST` import the dependency-owned executable router,
  controller, handler adapter, or service builder through a public component export. Starting the
  application gateway, migration-only API server, Tauri dev command, or local workspace command does not prove dependency API
  availability unless that executable dependency export is mounted and covered.
- Backend startup or preflight checks `MUST` fail before serving traffic when a configured
  dependency API export requires a same-origin dependency surface but the executable mount or
  external dependency base URL is missing. User requests must not be used as the first detector of
  missing dependency runtime composition.
- If the dependency exports route metadata but no executable router export, the consuming backend
  must configure that dependency SDK as an external service or add an approved handler adapter before
  same-origin dependency SDK calls are allowed.
- A backend runtime that serves admin UI modules using `@sdkwork/iam-backend-sdk` for appbase
  backend IAM `MUST` either mount a production-capable appbase backend router/controller/service
  adapter for `/backend/v3/api/iam/*` and declare verified `dependencyApiSurfaces` evidence, or
  route those SDK calls to an explicit appbase backend service/gateway. Mounting only appbase
  app-api routes, importing appbase route metadata, or mounting a local/demo IAM router is not
  sufficient handler coverage.
- Runtime composition `MUST` be environment-aware through `CONFIG_SPEC.md` and `ENVIRONMENT_SPEC.md`, not hard-coded per handler.
- Standalone/cloud parity follows `DEPLOYMENT_SPEC.md`: shared APIs preserve
  paths, operationIds, schemas, auth semantics, and problem-detail behavior
  across deployment profiles and runtime targets.
- Rust standalone/cloud implementations that expose or validate appbase
  capabilities `MUST` use appbase Rust runtime crates for context, auth,
  bootstrap, and protected route behavior, plus generated appbase SDKs when
  Rust code calls appbase HTTP APIs directly.
- Tauri/native commands are host adapters. They may call backend services through approved boundaries, but they must not become a parallel hidden HTTP API surface.
- `*-service-bin`, `sdkwork-<application-code>-app-api`, `sdkwork-<application-code>-backend-api`, and `sdkwork-<application-code>-open-api` binaries are **service host packages** for cloud scale-out, packaging matrices, and CI smoke. They `MUST NOT` be the default standalone dev HTTP listeners and `MUST NOT` be started as parallel loopback HTTP sidecars when a standalone or cloud application gateway already owns `application.public-ingress`. Route crates and `*-service` libraries remain the in-process composition units consumed by gateway crates per `APPLICATION_GATEWAY_SPEC.md` §5.6.

## 10. Verification

Every web backend change should verify the relevant subset:

- Route/controller paths match `API_SPEC.md` prefixes and surface rules.
- Rust route manifests pass `API_SPEC.md` and `SDK_WORKSPACE_GENERATION_SPEC.md` validation when Rust routes are touched.
- `node ../sdkwork-specs/tools/check-rust-backend-composition.mjs --root .` passes when Rust service, repository, route, runtime, or gateway Cargo dependencies are touched.
- `node ../sdkwork-specs/tools/check-component-port-bindings.mjs --root .` passes when backend components expose runtime entrypoints or dependency API surfaces.
- `node ../sdkwork-specs/tools/check-route-path-collisions.mjs --root .` passes when route manifests or OpenAPI authorities are present.
- Authority OpenAPI materializes deterministically and contains only owner operations before SDK generation.
- Generated SDKs compile and expose the expected resource-style methods.
- Handler/controller tests cover request decoding, typed context consumption, problem-detail mapping, and forbidden raw header parsing.
- Service tests cover business rules, authorization decisions, tenant/data-scope behavior, idempotency, and transaction behavior without starting an HTTP server.
- Repository tests cover tenant predicates, indexes/query shape where relevant, optimistic concurrency, and migration compatibility.
- Security tests cover missing/invalid credentials, insufficient permission, wrong tenant, and absence of app login token fallback for protected open-api across `api-key`, `oauth`, and `open-api-flexible` modes.
- Static scans fail on UI/service imports of route crates, generated SDK output edits, raw HTTP fallback, manual auth/API key/locale headers, and handler-level credential or locale reparsing.
- Static i18n scans fail when Rust backend message resources are authored outside `resources/i18n/<locale>/<domain>/<capability>/`, Java/Spring backend message resources are authored outside `src/main/resources/i18n/<locale>/<domain>/<capability>/`, or framework message bundles become backend-wide monoliths.
- Dependency API surface tests compare `sdkDependencies` with `dependencyApiSurfaces`, fail when a
  same-origin dependency has no verified executable router/controller coverage, and fail when an
  external dependency SDK can silently fall back to application-owned app/backend base URLs.
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
- [ ] Every HTTP `*-api` runtime or module follows `WEB_FRAMEWORK_SPEC.md`; Rust HTTP runtimes integrate `sdkwork-web-framework`.
- [ ] Route manifests declare `requestContext: WebRequestContext` and `apiSurface` for every operation, and materialized OpenAPI preserves the corresponding extensions.
- [ ] Handlers consume typed `WebRequestContext` and do not parse raw credentials, request IDs, tenant IDs, user IDs, locale, or language.
- [ ] User-facing and operator-facing backend messages use `I18N_SPEC.md` translation keys or framework message resolution, not handler-local hard-coded display text.
- [ ] Authenticated typed context includes tenant, organization, login scope,
  user, session, app, environment, deployment profile, runtime target, auth
  level, data scope, and permission scope from verified token/session context,
  with no demo/default/mock fallback.
- [ ] Services own business rules, authorization, transaction boundaries, idempotency, events, and cache invalidation.
- [ ] Repositories are tenant/data-scope safe for tenant-owned data.
- [ ] Dependency-owned appbase, Drive, provider, or shared-module routes are consumed through dependencies, not copied into the application-owned API authority.
- [ ] Dependency API exports are explicit in `dependencyApiExports`; generated application-owned SDKs remain
  owner-only.
- [ ] Same-origin dependency API routes are backed by executable dependency router/controller/service
  exports with verified coverage; split/server dependency routes have explicit upstream/base URL
  config.
- [ ] Errors map to problem-detail responses and do not leak sensitive internals.
- [ ] List/search endpoints implement store-level or index-level pagination per `PAGINATION_SPEC.md`; no in-process full collect + slice.
- [ ] Tests cover contract generation, security, service behavior, repository isolation, and static boundary scans.

## 12. Pagination Implementation

List/search handlers, services, and repositories `MUST` follow `PAGINATION_SPEC.md` in addition to `API_SPEC.md` §14.1 and §16.

Rules:

- handlers `MUST` translate `page`/`page_size` or `cursor`/`page_size` into repository or maintained-index window parameters before any unbounded read;
- handlers and shared query parsers `MUST NOT` accept `pageSize`, `limit`, `page_no`, `pageNo`, `per_page`, `size`, or equivalent compatibility aliases for SDKWork-owned list/search APIs. New and pre-launch applications `MUST` reject those aliases with `40003 INVALID_PARAMETER`;
- handlers `MUST` reject requests that combine `page` and `cursor` before service or repository code runs;
- repositories `MUST` use SQL `LIMIT`/keyset predicates or incrementally maintained sorted indexes for projection stores;
- services `MUST NOT` call unbounded `find_all`/`list_all` helpers and then `skip`/`take`/`slice` results in process memory;
- Rust services `SHOULD` reuse `sdkwork-utils-rust::http_api` offset/cursor helpers only on already index-backed iterators, not as a substitute for SQL pagination on persisted tables;
- list endpoint tests `MUST` prove page boundaries without materializing the full tenant collection in memory.
