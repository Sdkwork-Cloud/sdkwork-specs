# SDKWork Standards

This directory is the canonical standards entrypoint for SDKWork application and backend development.

All applications, API modules, SDK generator inputs, Java services, Rust local services, frontend shared packages, and agent instructions must reference these files instead of maintaining divergent local standards.

## 1. Spec Layers

| Layer | Spec files | Responsibility |
| --- | --- | --- |
| Foundation contracts | `DOMAIN_SPEC.md`, `API_SPEC.md`, `RPC_SPEC.md`, `RUST_RPC_SPEC.md`, `DATABASE_SPEC.md`, `DRIVE_SPEC.md`, `MEDIA_RESOURCE_SPEC.md`, `SDK_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md` | Domain boundaries, HTTP contracts, RPC/gRPC contracts, Rust RPC implementation profile, persistence contracts, Drive file/storage lifecycle, media resource contracts, primary SDK semantics, and SDK workspace generation details |
| Reusable app modules | `APPLICATION_SPEC.md`, `MODULE_SPEC.md`, `COMPONENT_SPEC.md`, `FRONTEND_SPEC.md`, `UI_ARCHITECTURE_SPEC.md`, `APP_PC_REACT_UI_SPEC.md`, `DESKTOP_APP_ARCHITECTURE_SPEC.md`, `APP_MOBILE_REACT_UI_SPEC.md`, `APP_FLUTTER_UI_SPEC.md`, `BACKEND_UI_SPEC.md`, `CONFIG_SPEC.md`, `ENVIRONMENT_SPEC.md`, `I18N_SPEC.md` | App shell, reusable building blocks, local component specs, common UI-service-SDK layering, UI architecture selection, architecture-specific UI package rules, desktop/Tauri host architecture, runtime config, environment variables, user-facing and operator-facing language |
| Core platform capabilities | `IAM_SPEC.md`, `IAM_LOGIN_INTEGRATION_SPEC.md`, `APP_MANIFEST_SPEC.md`, `SECURITY_SPEC.md`, `PRIVACY_SPEC.md` | Tenants, organizations, users, auth, appbase IAM login integration, app registration, security and data protection |
| Runtime and integration | `RUNTIME_DIRECTORY_SPEC.md`, `DEPLOYMENT_SPEC.md`, `NGINX_SPEC.md`, `INTEGRATION_SPEC.md`, `EVENT_SPEC.md` | Runtime filesystem layout, database/Redis host config, SaaS/private/local parity, public reverse proxy deployment, external providers, events, async contracts |
| Production readiness | `CACHE_SPEC.md`, `OBSERVABILITY_SPEC.md`, `PERFORMANCE_SPEC.md`, `TEST_SPEC.md` | Cache runtime, logs, metrics, traces, performance budgets, verification |
| Governance and knowledge | `GOVERNANCE_SPEC.md`, `DOCUMENTATION_SPEC.md` | Spec ownership, exceptions, changelogs, module docs, runbooks |

## 2. Required Standards

| File | Purpose | Required when |
| --- | --- | --- |
| `DOMAIN_SPEC.md` | Bounded contexts, canonical domain names, ownership, dependency direction | Naming or splitting any shared capability |
| `APPLICATION_SPEC.md` | Application modularization, app shell boundaries, module composition | Building or integrating any app |
| `MODULE_SPEC.md` | Reusable building-block package contract, dependency rules, extension points | Creating appbase/shared packages |
| `COMPONENT_SPEC.md` | Component-local `specs/` directory, `component.spec.json`, discovery, authority chain, integration contract | Creating or maintaining any authored app/package/crate/service/SDK family under `apps/` |
| `FRONTEND_SPEC.md` | architecture-neutral UI-service-SDK layering, state, error, accessibility | Building frontend UI or frontend business logic |
| `UI_ARCHITECTURE_SPEC.md` | Required UI architecture selection, package-family ownership, app/backend SDK boundary, cross-architecture ban | Starting any app PC React, mobile React, Flutter, or backend/admin React UI work |
| `APP_PC_REACT_UI_SPEC.md` | App/user-facing PC React package split, app SDK boundary, desktop interaction and auth UI rules | Building app-side PC React packages or pages |
| `DESKTOP_APP_ARCHITECTURE_SPEC.md` | Desktop app shell, Tauri host boundary, native capability adapters, desktop packaging, session/config/release rules | Building PC desktop apps, adding Tauri/native host capability, changing desktop packaging, or creating a desktop app shell |
| `APP_MOBILE_REACT_UI_SPEC.md` | App/user-facing mobile React package split, app SDK boundary, host adapters, mobile interaction rules | Building mobile React packages or screens |
| `APP_FLUTTER_UI_SPEC.md` | App/user-facing Flutter package split, generated Dart/Flutter app SDK boundary, platform adapters | Building Flutter app packages or screens |
| `BACKEND_UI_SPEC.md` | Backend/admin UI package split, backend SDK boundary, operator console route/menu and business-domain package rules | Building backend/admin React UI packages or pages |
| `CONFIG_SPEC.md` | Environment config, SDK client initialization, feature flags, secrets | Switching dev/test/prod/SaaS/private/local |
| `RUNTIME_DIRECTORY_SPEC.md` | Runtime directory layout, SDKWork app directory namespace, user private files, database and Redis host config, secrets, logs, cache, temp paths | Defining or changing service install paths, desktop/user private paths, `/etc/sdkwork`, `/var/lib/sdkwork`, `/var/log/sdkwork`, `~/.sdkwork`, database config files, Redis config files, or release directory permissions |
| `ENVIRONMENT_SPEC.md` | Env variable naming, runtime config files, database defaults, public runtime env, SDK base URL variables, runtime directory discovery | Defining or changing process env, `.env` files, release env, desktop/server/container config, or SDK base URL settings |
| `I18N_SPEC.md` | UI message catalogs, auth/login/register/session copy, locale fallback, safe localized errors | Building user-facing reusable UI or appbase packages |
| `APP_MANIFEST_SPEC.md` | `sdkwork.app.config.json`, app registration, release/install/media metadata | Registering or distributing an app |
| `API_SPEC.md` | HTTP API, OpenAPI 3.1.2 stable profile, schema, security declarations, operationId, SDK-friendly contract rules | Adding or changing any HTTP API |
| `RPC_SPEC.md` | gRPC/protobuf contract standard, package/service/method naming, metadata, errors, compatibility, cross-language RPC SDK generation, standard RPC service catalog | Adding or changing any RPC service, proto schema, generated RPC client, service-to-service interface, or cross-language direct-call surface |
| `RUST_RPC_SPEC.md` | Rust `tonic`/`prost` implementation standard, RPC crate split, interceptors, server/client bootstrap, Rust service modules, verification | Implementing SDKWork RPC services or clients in Rust |
| `DATABASE_SPEC.md` | Database contract, table naming, logical types, tenant isolation, indexes, schema evolution | Adding or changing persistence |
| `DRIVE_SPEC.md` | SDKWork Drive spaces, nodes, upload sessions, storage providers, object metadata, download grants, Drive SDK usage, and file-storage ownership boundaries | Adding or changing file storage, upload, download, object-storage, provider, bucket, Drive-backed file/media, knowledge-base file, AI-generated asset storage, or app-upload behavior |
| `MEDIA_RESOURCE_SPEC.md` | Canonical `MediaResource` contract, Drive-backed media representation, AI media provenance, bare URL exceptions | Adding or changing image, video, audio, voice, document, generated media, product media, or media DTO contracts |
| `SDK_SPEC.md` | Primary SDK standard: SDK system model, canonical SDK/API naming vocabulary, canonical `sdk/sdkwork-sdk-generator` generator requirement, package naming, client construction, generated-client integration, service facade rules, generated package quality | Generating, consuming, integrating, or standardizing SDKs |
| `SDK_WORKSPACE_GENERATION_SPEC.md` | Detail standard under `SDK_SPEC.md`: application-root `sdks/` workspace layout, SDK family directory placement, OpenAPI authority/derived inputs, canonical `@sdkwork/sdk-generator` / `sdkgen` execution, generated-output placement, backend OpenAPI SDK generation workflow | Creating an application SDK workspace, adding an SDK family directory, materializing OpenAPI 3.x generator inputs, or standardizing backend/app/domain SDK generation artifacts |
| `IAM_SPEC.md` | Tenants, organizations, users, sessions, roles, permissions, policy model, audit/security events | Building user/auth/permission features |
| `IAM_LOGIN_INTEGRATION_SPEC.md` | Fast IAM login/session integration through sdkwork-appbase, generated app SDK wiring, AuthGate/logout behavior, Rust AppContext validation, Tauri/local/private boundaries | Integrating login validation into an app, wiring appbase auth UI/runtime, adding route guards, validating Rust protected APIs, or fixing logout/session behavior |
| `SECURITY_SPEC.md` | Token model, authn/authz, secrets, rate limits, CORS, input validation, secure logging | Any protected API or sensitive UI flow |
| `PRIVACY_SPEC.md` | Data classification, minimization, retention, export/delete, residency | Handling tenant, personal, sensitive, or regulated data |
| `DEPLOYMENT_SPEC.md` | SaaS/private/local deployment parity, Java/Rust switching, runtime bootstrap | Supporting multiple runtime modes |
| `NGINX_SPEC.md` | nginx reverse proxy path convention, generated site configs, TLS certificate paths, release proxy handoff | Publishing an app through nginx or changing public proxy config |
| `INTEGRATION_SPEC.md` | External providers, connectors, OAuth links, webhooks, retries, provider IDs | Integrating third-party systems |
| `EVENT_SPEC.md` | Async APIs, domain events, outbox, webhooks, message envelopes, event versioning | Publishing or consuming events |
| `CACHE_SPEC.md` | Cache runtime abstraction, local/Redis deployment rules, namespace policy, admin cache management | Adding or changing cache behavior, temporary auth state, cache invalidation, Redis/local cache wiring |
| `OBSERVABILITY_SPEC.md` | Logs, metrics, traces, audit correlation, operational diagnostics | Adding production behavior |
| `PERFORMANCE_SPEC.md` | Latency budgets, pagination, scalability, frontend and SDK performance | Adding high-traffic or interactive behavior |
| `TEST_SPEC.md` | Contract tests, SDK generation tests, module tests, security tests, parity tests | Closing any feature or standard change |
| `DOCUMENTATION_SPEC.md` | Module README, API examples, ADRs, changelogs, runbooks | Making a capability reusable by other apps |
| `GOVERNANCE_SPEC.md` | Spec ownership, exception register, compatibility, migration and review process | Changing standards or making exceptions |

## 3. Development Entry Matrix

Use this table before starting new application work.

| Task | Read first | Then read |
| --- | --- | --- |
| Create a new application | `APP_MANIFEST_SPEC.md` | `APPLICATION_SPEC.md`, `CONFIG_SPEC.md`, `DEPLOYMENT_SPEC.md`, `DOCUMENTATION_SPEC.md` |
| Create a desktop/Tauri application | `DESKTOP_APP_ARCHITECTURE_SPEC.md` | `APP_MANIFEST_SPEC.md`, `APPLICATION_SPEC.md`, `UI_ARCHITECTURE_SPEC.md`, `APP_PC_REACT_UI_SPEC.md`, `CONFIG_SPEC.md`, `ENVIRONMENT_SPEC.md`, `RUNTIME_DIRECTORY_SPEC.md`, `DEPLOYMENT_SPEC.md`, `SECURITY_SPEC.md`, `TEST_SPEC.md` |
| Create a reusable appbase module | `MODULE_SPEC.md` | `DOMAIN_SPEC.md`, `FRONTEND_SPEC.md`, `SDK_SPEC.md`, `TEST_SPEC.md` |
| Create or onboard a component package | `COMPONENT_SPEC.md` | `MODULE_SPEC.md`, `DOCUMENTATION_SPEC.md`, `TEST_SPEC.md`, and the language/domain specs referenced by `component.spec.json` |
| Build app PC React UI | `UI_ARCHITECTURE_SPEC.md` | `APP_PC_REACT_UI_SPEC.md`, `FRONTEND_SPEC.md`, `MODULE_SPEC.md`, `SDK_SPEC.md`, `I18N_SPEC.md`, `SECURITY_SPEC.md` |
| Build mobile React UI | `UI_ARCHITECTURE_SPEC.md` | `APP_MOBILE_REACT_UI_SPEC.md`, `FRONTEND_SPEC.md`, `MODULE_SPEC.md`, `SDK_SPEC.md`, `CONFIG_SPEC.md`, `SECURITY_SPEC.md` |
| Build Flutter UI | `UI_ARCHITECTURE_SPEC.md` | `APP_FLUTTER_UI_SPEC.md`, `FRONTEND_SPEC.md`, `MODULE_SPEC.md`, `SDK_SPEC.md`, `CONFIG_SPEC.md`, `SECURITY_SPEC.md` |
| Build backend/admin UI | `UI_ARCHITECTURE_SPEC.md` | `BACKEND_UI_SPEC.md`, `FRONTEND_SPEC.md`, `MODULE_SPEC.md`, `SDK_SPEC.md`, `API_SPEC.md`, `SECURITY_SPEC.md` |
| Integrate appbase IAM login/session validation | `IAM_LOGIN_INTEGRATION_SPEC.md` | `IAM_SPEC.md`, `API_SPEC.md`, `SDK_SPEC.md`, `FRONTEND_SPEC.md`, `UI_ARCHITECTURE_SPEC.md`, `APP_PC_REACT_UI_SPEC.md`, `DESKTOP_APP_ARCHITECTURE_SPEC.md`, `SECURITY_SPEC.md`, `DEPLOYMENT_SPEC.md`, `TEST_SPEC.md` |
| Add login/session/user/tenant/org/permission | `IAM_SPEC.md` | `API_SPEC.md`, `DATABASE_SPEC.md`, `SECURITY_SPEC.md`, `PRIVACY_SPEC.md` |
| Add or change HTTP API | `API_SPEC.md` | `DOMAIN_SPEC.md`, `SDK_SPEC.md`, `SECURITY_SPEC.md`, `TEST_SPEC.md` |
| Add or change RPC/gRPC API | `RPC_SPEC.md` | `DOMAIN_SPEC.md`, `SDK_SPEC.md`, `SECURITY_SPEC.md`, `OBSERVABILITY_SPEC.md`, `TEST_SPEC.md` |
| Implement Rust RPC server/client | `RUST_RPC_SPEC.md` | `RPC_SPEC.md`, `DEPLOYMENT_SPEC.md`, `ENVIRONMENT_SPEC.md`, `SECURITY_SPEC.md`, `OBSERVABILITY_SPEC.md`, `TEST_SPEC.md` |
| Add or change database schema | `DATABASE_SPEC.md` | `DOMAIN_SPEC.md`, `API_SPEC.md`, `PRIVACY_SPEC.md`, `TEST_SPEC.md` |
| Add or change file storage, upload, download, object-storage provider, bucket/object lifecycle, app-upload, knowledge-base file, or AI-generated asset storage | `DRIVE_SPEC.md` | `API_SPEC.md`, `DATABASE_SPEC.md`, `MEDIA_RESOURCE_SPEC.md`, `RPC_SPEC.md`, `FRONTEND_SPEC.md`, `SDK_SPEC.md`, `SECURITY_SPEC.md`, `PRIVACY_SPEC.md` |
| Add or change media representation, image, video, audio, voice, document, product-media, generated-media DTO, or business media attachment contracts | `MEDIA_RESOURCE_SPEC.md` | `DRIVE_SPEC.md`, `API_SPEC.md`, `DATABASE_SPEC.md`, `RPC_SPEC.md`, `FRONTEND_SPEC.md`, `SDK_SPEC.md`, `SECURITY_SPEC.md`, `PRIVACY_SPEC.md` |
| Create or standardize an application SDK workspace | `SDK_SPEC.md` | `SDK_WORKSPACE_GENERATION_SPEC.md`, `API_SPEC.md`, `COMPONENT_SPEC.md`, `CONFIG_SPEC.md`, `TEST_SPEC.md` |
| Generate or consume an SDK | `SDK_SPEC.md` | `SDK_WORKSPACE_GENERATION_SPEC.md` for `sdks/` layout and generator artifacts, then `API_SPEC.md`, `CONFIG_SPEC.md`, `FRONTEND_SPEC.md` |
| Build frontend UI/business logic | `FRONTEND_SPEC.md` | `MODULE_SPEC.md`, `SDK_SPEC.md`, `SECURITY_SPEC.md` |
| Add or change user-facing copy/i18n | `I18N_SPEC.md` | `FRONTEND_SPEC.md`, `IAM_SPEC.md`, `SECURITY_SPEC.md` for auth/security copy |
| Switch SaaS/private/local mode | `DEPLOYMENT_SPEC.md` | `CONFIG_SPEC.md`, `RUNTIME_DIRECTORY_SPEC.md`, `ENVIRONMENT_SPEC.md`, `API_SPEC.md`, `DATABASE_SPEC.md`, `TEST_SPEC.md` |
| Publish through nginx | `NGINX_SPEC.md` | `DEPLOYMENT_SPEC.md`, `SECURITY_SPEC.md`, `OBSERVABILITY_SPEC.md` |
| Add or change runtime directories, service install paths, desktop private paths, database config, Redis config, logs, cache, or secret files | `RUNTIME_DIRECTORY_SPEC.md` | `CONFIG_SPEC.md`, `ENVIRONMENT_SPEC.md`, `DEPLOYMENT_SPEC.md`, `DATABASE_SPEC.md`, `CACHE_SPEC.md`, `SECURITY_SPEC.md`, `OBSERVABILITY_SPEC.md`, `TEST_SPEC.md` |
| Add or change env variables, `.env` files, runtime config files, or SDK base URL config | `ENVIRONMENT_SPEC.md` | `CONFIG_SPEC.md`, `RUNTIME_DIRECTORY_SPEC.md`, `DEPLOYMENT_SPEC.md`, `SECURITY_SPEC.md`, `TEST_SPEC.md` |
| Add or change cache runtime, Redis/local cache, cache invalidation, QR/login temporary cache, or admin cache management | `CACHE_SPEC.md` | `CONFIG_SPEC.md`, `ENVIRONMENT_SPEC.md`, `DEPLOYMENT_SPEC.md`, `SECURITY_SPEC.md`, `OBSERVABILITY_SPEC.md`, `TEST_SPEC.md` |
| Integrate external providers/webhooks | `INTEGRATION_SPEC.md` | `SECURITY_SPEC.md`, `EVENT_SPEC.md`, `OBSERVABILITY_SPEC.md` |
| Publish events or async flows | `EVENT_SPEC.md` | `API_SPEC.md`, `DATABASE_SPEC.md`, `OBSERVABILITY_SPEC.md` |
| Prepare production readiness | `OBSERVABILITY_SPEC.md` | `PERFORMANCE_SPEC.md`, `SECURITY_SPEC.md`, `TEST_SPEC.md` |
| Update a standard or approve deviation | `GOVERNANCE_SPEC.md` | affected spec files and `DOCUMENTATION_SPEC.md` |

## 4. Minimum Rules

- Domain naming starts from `DOMAIN_SPEC.md`; do not invent `identity` when the standard domain is `iam`.
- API work starts from `API_SPEC.md`.
- RPC/gRPC work starts from `RPC_SPEC.md`.
- Rust RPC implementation work starts from `RUST_RPC_SPEC.md`.
- Database/schema work starts from `DATABASE_SPEC.md`.
- File storage, upload, download, object-storage provider, app-upload, knowledge-base file, and AI-generated asset storage work starts from `DRIVE_SPEC.md`.
- App module work starts from `APPLICATION_SPEC.md` and `MODULE_SPEC.md`.
- Desktop/Tauri app shell, native host capability, desktop packaging, and desktop session/config behavior start from `DESKTOP_APP_ARCHITECTURE_SPEC.md`.
- Component-local specs start from `COMPONENT_SPEC.md`.
- Frontend work starts from `FRONTEND_SPEC.md`, then `UI_ARCHITECTURE_SPEC.md`, then exactly one architecture-specific UI spec: `APP_PC_REACT_UI_SPEC.md`, `APP_MOBILE_REACT_UI_SPEC.md`, `APP_FLUTTER_UI_SPEC.md`, or `BACKEND_UI_SPEC.md`.
- Backend/admin UI must be split by `@sdkwork/react-backend-<domain>` package and follow `BACKEND_UI_SPEC.md`; it must not be placed into one catch-all backend package.
- App-side PC React, mobile React, and Flutter UI must stay in app-side package families and follow their corresponding UI architecture specs.
- User-facing language and login/register/session copy start from `I18N_SPEC.md`.
- SDK generation, SDK consumption, SDK package naming, and service integration work starts from `SDK_SPEC.md`.
- SDK workspace layout, OpenAPI authority/derived inputs, and generated artifact placement then use `SDK_WORKSPACE_GENERATION_SPEC.md` as the subordinate detail standard.
- Appbase IAM login/session integration, AuthGate behavior, logout clearing, SDK token wiring, and Rust AppContext validation start from `IAM_LOGIN_INTEGRATION_SPEC.md`.
- Media representation and business media DTO work starts from `MEDIA_RESOURCE_SPEC.md`; Drive remains the storage lifecycle authority.
- Runtime config and environment switching start from `CONFIG_SPEC.md`.
- Runtime directory layout, SDKWork path namespace, user-private files, database config files, Redis config files, logs, cache, temp files, and secret file placement start from `RUNTIME_DIRECTORY_SPEC.md`.
- Environment variables, release env files, runtime config discovery, and deployment-mode database defaults start from `ENVIRONMENT_SPEC.md`.
- User, tenant, organization, auth, role, or permission work starts from `IAM_SPEC.md` and `SECURITY_SPEC.md`.
- SaaS/local/private switching starts from `DEPLOYMENT_SPEC.md`.
- Public nginx reverse proxy deployment starts from `NGINX_SPEC.md`.
- Cache runtime, cache invalidation, Redis/local cache switching, QR/login temporary cache, and admin cache management start from `CACHE_SPEC.md`.
- Event-driven work starts from `EVENT_SPEC.md`.
- External provider work starts from `INTEGRATION_SPEC.md`.
- Production readiness starts from `OBSERVABILITY_SPEC.md`, `PERFORMANCE_SPEC.md`, and `TEST_SPEC.md`.
- Standard changes and exceptions start from `GOVERNANCE_SPEC.md`.

If an app keeps a local copy for convenience, the root `specs/` version remains authoritative.

## 5. New App Checklist

- [ ] Create or validate `sdkwork.app.config.json` using `APP_MANIFEST_SPEC.md`.
- [ ] Choose canonical domains with `DOMAIN_SPEC.md`.
- [ ] Design reusable modules with `APPLICATION_SPEC.md` and `MODULE_SPEC.md`.
- [ ] Create component-local `specs/README.md` and `specs/component.spec.json` using `COMPONENT_SPEC.md`.
- [ ] Select exactly one UI architecture through `UI_ARCHITECTURE_SPEC.md` before creating UI packages: PC React, mobile React, Flutter, or backend/admin React.
- [ ] If the app targets PC desktop or Tauri, apply `DESKTOP_APP_ARCHITECTURE_SPEC.md` before adding native host code or packaging scripts.
- [ ] Define APIs with `API_SPEC.md` before SDK generation.
- [ ] Define RPC services with `RPC_SPEC.md` before proto/client generation when cross-language direct calls are required.
- [ ] Implement Rust RPC services with `RUST_RPC_SPEC.md` and keep RPC adapters behind runtime/service boundaries.
- [ ] Define tables with `DATABASE_SPEC.md` before migrations/entities.
- [ ] Define file storage, upload, download, app-upload, knowledge-base file, and generated asset storage with `DRIVE_SPEC.md` before API/schema/SDK work.
- [ ] Define media, image, video, voice, document, and generated media representation with `MEDIA_RESOURCE_SPEC.md`, backed by Drive for SDKWork-owned storage.
- [ ] Design SDK naming, package semantics, generated client surface, and service integration with `SDK_SPEC.md`.
- [ ] Create or validate application-root `sdks/` workspace, SDK family directories, OpenAPI authority/derived inputs, and generated artifact placement with `SDK_WORKSPACE_GENERATION_SPEC.md`.
- [ ] Wire frontend services through `FRONTEND_SPEC.md`.
- [ ] Wire localized user-facing copy through `I18N_SPEC.md`.
- [ ] Integrate login/session through `IAM_LOGIN_INTEGRATION_SPEC.md` before adding local auth routes, route guards, logout logic, or Rust protected API validation.
- [ ] Keep environment and SDK client creation in bootstrap using `CONFIG_SPEC.md` and `ENVIRONMENT_SPEC.md`.
- [ ] Use `RUNTIME_DIRECTORY_SPEC.md` for service directories, user private directories, database/Redis config files, logs, cache, temp files, and secret file placement.
- [ ] Use `CACHE_SPEC.md` for runtime cache, Redis/local mode selection, and admin cache management.
- [ ] Apply `IAM_SPEC.md`, `SECURITY_SPEC.md`, and `PRIVACY_SPEC.md` for protected tenant/user behavior.
- [ ] Verify SaaS/private/local parity with `DEPLOYMENT_SPEC.md` and `TEST_SPEC.md`.
- [ ] Add module README, examples, changelog, and runbook using `DOCUMENTATION_SPEC.md`.

## 6. External Baselines

The standards align with current open specifications where they fit SDKWork:

- OpenAPI Specification 3.1.2 stable profile: https://spec.openapis.org/oas/v3.1.2.html
- OpenAPI Specification 3.2.0 forward-looking profile: https://spec.openapis.org/oas/v3.2.0.html
- JSON Schema Draft 2020-12: https://json-schema.org/draft/2020-12
- RFC 9457 Problem Details: https://www.rfc-editor.org/rfc/rfc9457
- OWASP API Security Top 10: https://owasp.org/API-Security/
- OWASP REST Security Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html
- OWASP Application Security Verification Standard: https://owasp.org/www-project-application-security-verification-standard/
- AsyncAPI: https://www.asyncapi.com/
- CloudEvents: https://cloudevents.io/
- OpenTelemetry: https://opentelemetry.io/docs/specs/
- gRPC: https://grpc.io/docs/
- Protocol Buffers: https://protobuf.dev/
- Buf lint and breaking-change tooling: https://buf.build/docs/
