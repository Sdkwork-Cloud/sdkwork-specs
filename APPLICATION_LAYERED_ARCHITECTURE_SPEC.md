# Application Layered Architecture Standard

- Version: 1.0
- Scope: application-wide API, service, domain, repository, adapter, runtime composition, frontend service, and operations layering across SDKWork application roots
- Related: `APPLICATION_SPEC.md`, `COMPOSABLE_ARCHITECTURE_SPEC.md`, `MODULE_SPEC.md`, `COMPONENT_SPEC.md`, `API_SPEC.md`, `WEB_FRAMEWORK_SPEC.md`, `WEB_BACKEND_SPEC.md`, `FRONTEND_SPEC.md`, `FRONTEND_CODE_SPEC.md`, `RUST_CODE_SPEC.md`, `JAVA_CODE_SPEC.md`, `TYPESCRIPT_CODE_SPEC.md`, `DATABASE_SPEC.md`, `SDK_SPEC.md`, `APP_COMPOSITION_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, `CONFIG_SPEC.md`, `I18N_SPEC.md`, `SECURITY_SPEC.md`, `TEST_SPEC.md`

This standard is the cross-language layered architecture entrypoint for SDKWork applications. It defines the stable L0-L6 layer model, dependency direction, package responsibilities, extension rules, and executable checks that make application modules composable like building blocks.

It does not replace the detailed standards for API contracts, web framework integration, Rust crates, Java packages, frontend packages, SDK generation, database lifecycle, i18n, or security. Those standards own language-specific syntax and runtime details. This file owns the application-wide separation of responsibilities.

## 1. Authority And Source Of Truth

Rules:

- The application layered architecture profile is authoritative for API/service/repository/domain/adapter/runtime dependency direction across SDKWork application roots.
- Contract authorities `MUST` be machine-readable and owned by the producing layer: OpenAPI authority documents, route manifests, SDK manifests, database migrations/schema registries, `specs/component.spec.json`, native package manifests, config schemas, and deployment topology specs.
- README files, local notes, examples, and runbooks may explain the layering model, but they `MUST NOT` replace the machine contracts above.
- A module is composable only when consumers can integrate it through public exports, declared ports, generated SDKs, route manifests, or runtime entrypoints without importing private source files.
- Application code placeholders `MUST` use `<application-code>`. Bare `<app>` placeholders are forbidden for SDKWork artifact names, package names, path examples, and environment key examples.

## 2. Standard L0-L6 Layers

SDKWork applications use this layer model:

| Layer | Name | Owns | Must not own |
| --- | --- | --- | --- |
| L0 | Contract authority | OpenAPI, route manifest, operationId, route owner, request/response schema, SDK generation input, database schema contract, component spec | Runtime-only route invention, README-only behavior |
| L1 | Interface/API adapter | HTTP controller, Rust route crate, handler binding, request/response mapping, locale/context projection, route registration | Business rules, transactions, direct SQL, provider business decisions |
| L2 | Application service/use case | Business orchestration, authorization decisions, transaction boundary, idempotency, domain events, cache orchestration, service DTO mapping | HTTP framework response objects, raw headers, SQL text, UI state |
| L3 | Domain and ports | Domain models, value objects, policies, repository/provider/cache/event ports, invariants | Infrastructure implementation, SDK transport, API route ownership |
| L4 | Infrastructure adapter | SQL repository implementation, provider SDK/RPC adapter, cache/event/storage adapter, row/provider DTO mapping | API DTO authority, user workflow policy, UI decisions |
| L5 | Runtime composition | Dependency construction, SDK client construction, service host, gateway, core package registries, bootstrap, preflight | Business rules, generated API ownership, hidden route copies |
| L6 | Operations | Config profiles, deployment profile, runtime target, observability, health, release and migration evidence | Feature behavior, domain policy, unversioned environment behavior |

Rules:

- New application behavior `MUST` identify its owning layer before implementation begins.
- A source package, crate, module, or class that owns more than one durable layer responsibility `MUST` be split before adding more behavior unless a local component spec documents a narrow, temporary migration exception.
- Layer ownership `MUST` be declared in `specs/component.spec.json` through `contracts.layerRole` for new composable modules.

## 3. Dependency Direction

Allowed direction:

```text
L1 interface adapter
  -> L2 application service/use case
  -> L3 domain model and ports

L4 infrastructure adapter
  -> L3 ports

L5 runtime composition
  -> constructs L1/L2/L4 dependencies and SDK clients

frontend UI
  -> package service
  -> injected SDK client or declared service port
  -> generated SDK transport created by runtime/core
```

Rules:

- L1 adapters `MUST` call L2 services or use-case ports. They `MUST NOT` call repositories, provider adapters, raw SQL, generated same-authority SDK clients, or business SDK facades for the API they implement.
- L2 services `MUST` depend on domain ports and stable provider interfaces, not concrete SQL repositories, HTTP framework types, UI packages, or app shell code.
- L3 domain code `MUST` stay independent of HTTP, database, SDK transport, UI, config profile, and deployment topology.
- L4 adapters `MUST` implement ports and may use database, provider, cache, event, or storage clients. They `MUST NOT` infer tenant/user/permission context from HTTP headers or global request state.
- L5 runtime composition is the only normal place to construct SDK clients, repository implementations, provider adapters, service containers, appbase IAM runtime, global TokenManager, and gateway route assembly.
- Frontend UI components `MUST` call package services, hooks, or injected callbacks. They `MUST NOT` call raw HTTP, construct SDK clients, manually assemble auth/API-key headers, or parse JWTs for authorization.
- Frontend services `MUST` receive generated SDK clients or approved service ports by injection. They `MUST NOT` create local SDK clients or hide raw HTTP fallbacks.

## 4. Backend Package Profiles

### 4.1 Rust

Rust backend applications `MUST` use responsibility-specific crate families from `RUST_CODE_SPEC.md`:

| Responsibility | Crate family | Layer |
| --- | --- | --- |
| HTTP route/API adapter | `sdkwork-routes-<capability>-<surface>` | L1 |
| Business service/use case | `sdkwork-<domain>-<capability>-service` | L2/L3 |
| SQL repository implementation | `sdkwork-<domain>-<capability>-repository-sqlx` | L4 |
| In-process service host | `sdkwork-<application-code>-service-host` | L5 |
| Native/Tauri host | `sdkwork-<application-code>-native-host` or `sdkwork-<application-code>-tauri-host` | L5 |
| Worker | `sdkwork-<domain>-<capability>-worker` | L2/L4/L5 by component contract |
| API assembly | `sdkwork-api-<application-code>-assembly` | L5/L6 composition |
| Standalone gateway | `sdkwork-api-<application-code>-standalone-gateway` | L5/L6 host |
| Platform gateway | `sdkwork-api-cloud-gateway` | L5/L6 platform ingress |

Rules:

- Route crates adapt HTTP and call services. They `MUST NOT` depend on concrete repository crates or generated SDKs for the same API authority.
- Service crates own business policy and ports. They `MUST NOT` depend on concrete `*-repository-sqlx` crates or HTTP framework request/response types.
- Repository crates implement ports and own SQL/row mapping. They `MUST NOT` depend on route crates, controllers, or HTTP framework crates.
- Gateway and service-host crates construct and mount dependencies. They `MUST NOT` become business service or repository owners.

### 4.2 Java/Spring

New Java/Spring backend modules `SHOULD` use this package shape:

```text
src/main/java/<base_package>/<domain>/<capability>/
  api/                         # L1 controllers and request/response mapping
  application/                 # L2 use cases and services
  domain/                      # L3 models, policies, value objects, ports
  infrastructure/
    persistence/               # L4 database repositories and row mapping
    provider/                  # L4 provider, SDK, RPC, cache, event adapters
  config/                      # L5 framework wiring
  error/                       # shared errors and problem-detail mapping
src/main/resources/i18n/<locale>/<domain>/<capability>/
```

Rules:

- Existing Java modules may keep a `repository/` package during migration, but controllers `MUST NOT` import it directly.
- Controller classes `MUST` stay thin: decode request, consume typed request context, call L2 service/use-case, and map the result through the standard response mapper.
- Transactions `MUST` live in L2 service/use-case boundaries, not controllers.
- Repository and persistence packages `MUST NOT` import HTTP framework types such as `ResponseEntity`, Spring Web, servlet APIs, or SDKWork web response types.
- Provider adapters may wrap external HTTP or SDK calls only when the adapter is the declared L4 owner and has tests plus security evidence.

## 5. Frontend Package Profiles

Frontend application roots and packages follow `FRONTEND_SPEC.md`, `FRONTEND_CODE_SPEC.md`, the selected root architecture standard, and the selected UI package standard.

Standard source responsibilities:

```text
src/
  index.ts          # public export and composition helpers
  pages/            # route/page composition
  components/       # render-only or controlled UI
  hooks/            # UI orchestration hooks
  services/         # SDK/service-port orchestration
  state/            # local or package state
  routes/           # route contribution metadata
  i18n/             # package-local i18n fragments and thin registry
```

Rules:

- Application-root package names `MUST` use `<application-code>` where an application identity appears, for example `apps/sdkwork-<application-code>-pc/packages/sdkwork-<application-code>-pc-<capability>`.
- Core packages own SDK registries, service registries, runtime metadata, host/session contracts, and composition helpers.
- Feature packages own one capability's pages, components, services, state, i18n fragments, and route contributions.
- Host packages own platform/native/browser bridges. They `MUST NOT` own business authorization, SDK orchestration, or domain service rules.
- Runtime/bootstrap/core creates SDK clients. Feature services receive clients or ports by injection.
- User-facing app packages use generated app SDKs. Explicit `backend-admin` packages use generated backend SDKs. Non-admin packages `MUST NOT` import backend SDKs or backend base URL resolvers.

## 6. Module And Component Contracts

Rules:

- Every authored application module `MUST` have `<module-root>/specs/component.spec.json` per `COMPONENT_SPEC.md`.
- New composable modules `MUST` declare `contracts.layerRole`, `contracts.publicExports`, `contracts.providedPorts`, `contracts.requiredPorts`, and applicable runtime/API/SDK/permission fields.
- Component `canonicalSpecs` `MUST` include this spec whenever the component owns application layer behavior beyond a pure generated artifact.
- Public integration uses package/crate root exports, generated SDK facades, declared ports, or runtime entrypoints. Cross-module imports of private `src/**` files are forbidden.
- A reusable module `MUST` have one primary domain and capability. Generic catch-all modules such as `common`, `manager`, `backend`, `runtime`, or `core` are allowed only for framework-level infrastructure with no business ownership and a clear component spec.

## 7. Open-Closed Extension Rules

New behavior `MUST` extend the system by adding or replacing layer-aligned building blocks, not by modifying unrelated layers.

Rules:

- A new API capability starts at L0: update the owning OpenAPI/route manifest and SDK generation contract before adding UI or service consumers.
- A new use case adds or changes an L2 service/use-case and its L3 ports. L1 controllers and frontend UI stay thin.
- A new database backend adds an L4 repository adapter implementing an existing L3 port. L2 service signatures should not change unless the business contract changes.
- A new provider integration adds an L4 provider adapter implementing an existing L3 provider port.
- A new frontend workflow adds or updates a feature package service and route contribution; SDK clients still come from runtime/core injection.
- A new runtime profile adds L5/L6 bootstrap, config, preflight, and deployment evidence without changing L2 business rules.
- A missing SDK method is fixed in the L0 API authority and generated SDK source. Consumers `MUST NOT` add raw HTTP fallbacks.

## 8. Route And URL Path Ownership

Rules:

- Every normalized `(surface, method, path)` `MUST` have exactly one owner.
- Route manifests and OpenAPI authority documents are the owner evidence for HTTP routes. Runtime-only path constants are not route authority.
- Path-template dialects `{id}`, `:id`, and `<id>` represent the same parameter segment for collision checks.
- Standard health/readiness paths such as `/app/v3/api/system/health`, `/app/v3/api/system/ready`, `/backend/v3/api/system/health`, and `/backend/v3/api/system/ready` are reserved for the standard health owner.
- Business modules `MUST` use capability-specific resource paths. They `MUST NOT` claim common system paths such as `/status`, `/health`, `/ready`, `/system/health`, or `/system/ready`.
- Dependency-owned routes stay dependency-owned. Consumers mount executable dependency entrypoints, proxy explicit external upstreams, or call dependency SDKs; they `MUST NOT` copy dependency paths into local authorities.

## 9. Forbidden Anti-Patterns

The following patterns are forbidden for new code and must be removed before production launch when found in pre-launch applications:

- Controller/router methods that execute SQL, call repositories directly for business operations, own transactions, or build non-standard response envelopes.
- Service/use-case code that imports HTTP framework types, frontend packages, concrete SQL repository crates/packages, or same-authority generated SDK clients.
- Repository code that imports HTTP framework types, parses request headers, makes permission decisions, or owns API DTO schemas.
- UI components that call `fetch`, `axios`, `ky`, `got`, `XMLHttpRequest`, generated SDK constructors, or manual auth/API-key headers.
- Frontend services that construct SDK clients locally instead of receiving injected clients.
- Runtime/core packages that hide business rules, copy dependency routes, or re-export private feature internals.
- Generic catch-all artifacts named only `common`, `core`, `manager`, `runtime`, `backend`, or `product` when they own business behavior.
- DTO, database row, API response, domain model, and UI view-model conflation in one type when the semantics differ.

## 10. Verification

Before claiming application layered architecture alignment, run the applicable checks:

```bash
node sdkwork-specs/tools/check-application-layering.mjs --root <repo>
node sdkwork-specs/tools/check-component-port-bindings.mjs --root <repo>
node sdkwork-specs/tools/check-frontend-composition.mjs --root <repo>
node sdkwork-specs/tools/check-rust-backend-composition.mjs --root <repo>
node sdkwork-specs/tools/check-route-path-collisions.mjs --root <repo>
node sdkwork-specs/tools/check-api-operation-patterns.mjs --root <repo>
node sdkwork-specs/tools/check-api-response-envelope.mjs --root <repo>
node sdkwork-specs/tools/verify-repo.mjs --root <repo>
```

Workspace audits:

```bash
node sdkwork-specs/tools/check-application-layering.mjs --workspace <workspace-root>
```

`check-application-layering.mjs` is the cross-language static scan for high-value common violations. Specialized validators remain authoritative for detailed Rust composition, frontend package composition, component ports, API response envelopes, route collisions, permission inheritance, SDK import boundaries, i18n, pagination, and database lifecycle.

## 11. Acceptance Checklist

- [ ] The owning layer is identified for every new behavior.
- [ ] L0 contracts exist before consumers depend on routes, SDK methods, database schema, or component ports.
- [ ] L1 adapters are thin and do not call repositories or own transactions.
- [ ] L2 services own business policy, authorization decisions, transaction boundaries, and idempotency.
- [ ] L3 domain and ports are independent of HTTP, database, SDK transport, UI, config, and deployment topology.
- [ ] L4 adapters implement declared ports and do not own business policy.
- [ ] L5 runtime/core/bootstrap constructs SDK clients, repositories, providers, service containers, and route mounts.
- [ ] Frontend UI calls package services, and services receive injected SDK clients or service ports.
- [ ] Every authored module has `specs/component.spec.json` with layer role, public exports, ports, and verification commands.
- [ ] Route and URL path ownership has no duplicate normalized `(surface, method, path)` registrations.
- [ ] Extension work adds or replaces layer-aligned modules instead of editing unrelated layers.
- [ ] `check-application-layering.mjs` and the applicable specialized validators pass.
