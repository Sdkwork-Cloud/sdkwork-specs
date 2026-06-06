# SDKWork Standards

This directory is the canonical standards entrypoint for SDKWork application and backend development.

All applications, API modules, SDK generator inputs, Java services, Rust local services, frontend shared packages, and agent instructions must reference these files instead of maintaining divergent local standards.

## 1. Spec Layers

| Layer | Spec files | Responsibility |
| --- | --- | --- |
| Repository workspace | `SDKWORK_WORKSPACE_SPEC.md` | Source-controlled `.sdkwork/` workspace metadata, repository/application skills, repository/application plugins, and local workspace discovery rules |
| Agent and code execution | `SOUL.md`, `AGENTS_SPEC.md`, `CODE_STYLE_SPEC.md`, `NAMING_SPEC.md`, `RUST_CODE_SPEC.md`, `JAVA_CODE_SPEC.md`, `TYPESCRIPT_CODE_SPEC.md`, `FRONTEND_CODE_SPEC.md` | Agent execution soul, repository/application `AGENTS.md` entrypoints, tool compatibility shims such as `CLAUDE.md`, `GEMINI.md`, and `CODEX.md`, convention-based dictionary lookup, common code style, language-specific code structure, frontend code structure, and canonical naming |
| Foundation contracts | `DOMAIN_SPEC.md`, `API_SPEC.md`, `WEB_BACKEND_SPEC.md`, `RPC_SPEC.md`, `RUST_RPC_SPEC.md`, `DATABASE_SPEC.md`, `DRIVE_SPEC.md`, `MEDIA_RESOURCE_SPEC.md`, `SDK_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md` | Domain boundaries, HTTP contracts, web backend implementation boundaries, RPC/gRPC contracts, Rust RPC implementation profile, persistence contracts, Drive file/storage lifecycle, media resource contracts, primary SDK semantics, and SDK workspace generation details |
| Reusable app modules | `APPLICATION_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, `APP_PC_ARCHITECTURE_SPEC.md`, `MODULE_SPEC.md`, `COMPONENT_SPEC.md`, `FRONTEND_SPEC.md`, `UI_ARCHITECTURE_SPEC.md`, `APP_PC_REACT_UI_SPEC.md`, `DESKTOP_APP_ARCHITECTURE_SPEC.md`, `APP_MOBILE_REACT_UI_SPEC.md`, `APP_FLUTTER_UI_SPEC.md`, `BACKEND_UI_SPEC.md`, `CONFIG_SPEC.md`, `ENVIRONMENT_SPEC.md`, `I18N_SPEC.md` | App shell, compositional SDK/appbase integration, PC browser/desktop/tablet application root architecture, reusable building blocks, local component specs, common UI-service-SDK layering, UI architecture selection, architecture-specific UI package rules, desktop/tablet Tauri host architecture, dev/test/staging/prod runtime config, desktop/server/container/browser environment variables, user-facing and operator-facing language |
| Core platform capabilities | `IAM_SPEC.md`, `IAM_LOGIN_INTEGRATION_SPEC.md`, `APP_MANIFEST_SPEC.md`, `SECURITY_SPEC.md`, `PRIVACY_SPEC.md` | Tenants, organizations, users, auth, appbase IAM login integration, app registration, security and data protection |
| Runtime and integration | `RUNTIME_DIRECTORY_SPEC.md`, `DEPLOYMENT_SPEC.md`, `NGINX_SPEC.md`, `INTEGRATION_SPEC.md`, `EVENT_SPEC.md` | Runtime filesystem layout, database/Redis host config, SaaS/private/local parity, public reverse proxy deployment, external providers, events, async contracts |
| GitHub packaging workflows | `GITHUB_WORKFLOW_SPEC.md` | Standard reusable GitHub Actions packaging, release, artifact publication, dependency checkout, deployment environment, and supply-chain policy integration |
| Production readiness | `CACHE_SPEC.md`, `OBSERVABILITY_SPEC.md`, `PERFORMANCE_SPEC.md`, `TEST_SPEC.md` | Cache runtime, logs, metrics, traces, performance budgets, verification |
| Governance and knowledge | `GOVERNANCE_SPEC.md`, `DOCUMENTATION_SPEC.md` | Spec ownership, exceptions, changelogs, module docs, runbooks |

## 2. Required Standards

| File | Purpose | Required when |
| --- | --- | --- |
| `SDKWORK_WORKSPACE_SPEC.md` | Repository/application `.sdkwork/` workspace, checked-in skills/plugins, local agent/plugin extension rules, and distinction from generated SDK/runtime `.sdkwork` paths | Creating, onboarding, validating, or maintaining any git repository root or SDKWork application root |
| `SOUL.md` | Shared SDKWork agent execution soul: specs before memory, dictionary before context, evidence before completion, stop on ambiguity, and long-running recovery behavior | Any agent, automation, or AI-assisted workflow operating on SDKWork repositories |
| `AGENTS_SPEC.md` | Required `AGENTS.md` structure, tool compatibility shims such as `CLAUDE.md`, `GEMINI.md`, and `CODEX.md`, relative `sdkwork-specs` paths, local dictionary resolution order, and task-to-spec loading rules | Creating or maintaining repository/application/component agent entrypoints |
| `CODE_STYLE_SPEC.md` | Cross-language code organization, focused file boundaries, public exports, generated code handling, error boundaries, and tests | Any authored code change |
| `NAMING_SPEC.md` | Canonical domain, capability, package, component, SDK family, API authority, route crate, database, and agent entrypoint naming | Naming or renaming any public or discoverable SDKWork artifact |
| `RUST_CODE_SPEC.md` | Rust crate/module layout, `lib.rs` limits, route crate structure, errors, async, persistence, and Rust verification | Touching Rust source, Cargo manifests, Tauri Rust, Rust route crates, or Rust RPC code |
| `JAVA_CODE_SPEC.md` | Java 21/Spring/Maven package structure, controller/service/repository boundaries, DTO alignment, transactions, and Java tests | Touching Java, Spring backend, Maven modules, or Java SDK code |
| `TYPESCRIPT_CODE_SPEC.md` | TypeScript package structure, public exports, typed SDK ports, generated SDK facades, Node scripts, and TypeScript verification | Touching TypeScript, JavaScript, Node tooling, package exports, or TypeScript SDK facades |
| `FRONTEND_CODE_SPEC.md` | Frontend UI-service-SDK flow, React/Flutter/UI package organization, state, i18n, accessibility, and UI verification | Touching React, Flutter, PC/mobile/desktop renderer, or backend/admin UI code |
| `DOMAIN_SPEC.md` | Bounded contexts, canonical domain names, ownership, dependency direction | Naming or splitting any shared capability |
| `APPLICATION_SPEC.md` | Application modularization, app shell boundaries, module composition | Building or integrating any app |
| `APP_SDK_INTEGRATION_SPEC.md` | Cross-architecture app SDK integration, application dependency composition, generated language SDK boundaries, Rust backend composition, appbase IAM runtime, and global TokenManager wiring | Wiring generated SDKs into PC React, mobile React, Flutter, desktop/native, Rust-enabled apps, appbase IAM/login/session, or dependency SDK composition |
| `APP_PC_ARCHITECTURE_SPEC.md` | PC browser/desktop/tablet application root architecture, `sdkwork-<product>-pc-*` package taxonomy, app/console/admin separation, shared renderer, desktop/tablet host placement, SDK/IAM boundary | Creating or maintaining PC application roots, PC browser apps, desktop/Tauri apps, iPadOS/Android tablet native packages, PC user modules, PC user-facing console modules, or PC internal admin modules |
| `MODULE_SPEC.md` | Reusable building-block package contract, dependency rules, extension points | Creating appbase/shared packages |
| `COMPONENT_SPEC.md` | Component-local `specs/` directory, `component.spec.json`, discovery, authority chain, integration contract | Creating or maintaining any authored app/package/crate/service/SDK family under `apps/` |
| `FRONTEND_SPEC.md` | architecture-neutral UI-service-SDK layering, state, error, accessibility | Building frontend UI or frontend business logic |
| `UI_ARCHITECTURE_SPEC.md` | Required UI architecture selection, package-family ownership, app/backend SDK boundary, cross-architecture ban | Starting any app PC React, mobile React, Flutter, or backend/admin React UI work |
| `APP_PC_REACT_UI_SPEC.md` | App/user-facing and PC user-console React package split, app SDK boundary, desktop interaction and auth UI rules under the PC root standard | Building app-side PC React packages, user-facing PC console packages, or pages after `APP_PC_ARCHITECTURE_SPEC.md` |
| `DESKTOP_APP_ARCHITECTURE_SPEC.md` | Desktop/tablet native app shell, Tauri host boundary, native capability adapters, desktop/iPadOS/Android tablet packaging, session/config/release rules under the PC root standard | Building PC desktop apps, adding iPadOS/Android tablet native packaging, adding Tauri/native host capability, changing native packaging, or creating a native host shell after `APP_PC_ARCHITECTURE_SPEC.md` |
| `APP_MOBILE_REACT_UI_SPEC.md` | App/user-facing mobile React package split, app SDK boundary, host adapters, mobile interaction rules | Building mobile React packages or screens |
| `APP_FLUTTER_UI_SPEC.md` | App/user-facing Flutter package split, generated Dart/Flutter app SDK boundary, platform adapters | Building Flutter app packages or screens |
| `BACKEND_UI_SPEC.md` | Backend/admin UI package split, backend SDK boundary, internal operator route/menu and business-domain package rules, including PC `pc-admin` modules | Building standalone backend/admin React UI packages or PC internal admin packages/pages |
| `CONFIG_SPEC.md` | Typed runtime config, SDK client initialization, per-surface SDK base URLs, TokenManager behavior, feature flags, secrets, lifecycle environment, deployment mode, runtime target, dev/test/staging/prod config file families | Switching dev/test/prod/SaaS/private/local, wiring SDK clients, configuring open/app/backend/dependency SDK base URLs, or separating browser/desktop/server/container config |
| `RUNTIME_DIRECTORY_SPEC.md` | Runtime directory layout, SDKWork app directory namespace, user private files, database and Redis host config, secrets, logs, cache, temp paths | Defining or changing service install paths, desktop/user private paths, `/etc/sdkwork`, `/var/lib/sdkwork`, `/var/log/sdkwork`, `~/.sdkwork`, database config files, Redis config files, or release directory permissions |
| `ENVIRONMENT_SPEC.md` | Env variable naming, runtime config files, profile aliases, public runtime env, private/public/Vite SDK base URL variables, Access-Token env prohibition, TokenManager behavior variables, desktop/server/container/browser config profiles, runtime directory discovery | Defining or changing process env, `.env` files, release env, dev/test/staging/prod templates, desktop/server/container config, browser runtime env, SDK base URL settings, or credential config rules |
| `I18N_SPEC.md` | UI message catalogs, auth/login/register/session copy, locale fallback, safe localized errors | Building user-facing reusable UI or appbase packages |
| `APP_MANIFEST_SPEC.md` | `sdkwork.app.config.json`, app registration, release/install/media metadata | Registering or distributing an app |
| `API_SPEC.md` | HTTP API, OpenAPI 3.1.2 stable profile, schema, security declarations, operationId, SDK-friendly contract rules | Adding or changing any HTTP API |
| `WEB_BACKEND_SPEC.md` | Web backend implementation standard: controller/router, handler, service, repository, request context, route manifest, materialization, and SDK boundary rules | Implementing Java Spring HTTP backends, Rust HTTP route crates, backend services, handlers, repositories, or runtime API composition |
| `RPC_SPEC.md` | gRPC/protobuf contract standard, package/service/method naming, metadata, errors, compatibility, cross-language RPC SDK generation, standard RPC service catalog | Adding or changing any RPC service, proto schema, generated RPC client, service-to-service interface, or cross-language direct-call surface |
| `RUST_RPC_SPEC.md` | Rust `tonic`/`prost` implementation standard, RPC crate split, interceptors, server/client bootstrap, Rust service modules, verification | Implementing SDKWork RPC services or clients in Rust |
| `DATABASE_SPEC.md` | Database contract, table naming, logical types, tenant isolation, indexes, schema evolution | Adding or changing persistence |
| `DRIVE_SPEC.md` | SDKWork Drive spaces, nodes, Drive Uploader, client upload through `sdkwork-drive-app-sdk`, server-side Rust upload through Drive product components, upload sessions, storage providers, object metadata, download grants, uploader attribution/statistics, and file-storage ownership boundaries | Adding or changing file storage, upload, download, object-storage, provider, bucket, Drive-backed file/media, knowledge-base file, AI-generated asset storage, app-upload behavior, tenant/user upload statistics, or Rust server-side upload behavior |
| `MEDIA_RESOURCE_SPEC.md` | Canonical `MediaResource` contract, Drive-backed media representation, AI media provenance, bare URL exceptions | Adding or changing image, video, audio, voice, document, generated media, product media, or media DTO contracts |
| `SDK_SPEC.md` | Primary SDK standard: SDK system model, canonical SDK/API naming vocabulary, canonical `sdk/sdkwork-sdk-generator` generator requirement, package naming, client construction, generated-client integration, service facade rules, generated package quality | Generating, consuming, integrating, or standardizing SDKs |
| `SDK_WORKSPACE_GENERATION_SPEC.md` | Detail standard under `SDK_SPEC.md`: application-root `sdks/` workspace layout, SDK family directory placement, OpenAPI authority/derived inputs, canonical `@sdkwork/sdk-generator` / `sdkgen` execution, generated-output placement, backend OpenAPI SDK generation workflow | Creating an application SDK workspace, adding an SDK family directory, materializing OpenAPI 3.x generator inputs, or standardizing backend/app/domain SDK generation artifacts |
| `IAM_SPEC.md` | Tenants, organizations, users, sessions, roles, permissions, policy model, audit/security events | Building user/auth/permission features |
| `IAM_LOGIN_INTEGRATION_SPEC.md` | Fast IAM login/session integration through sdkwork-appbase, generated app SDK wiring, AuthGate/logout behavior, Rust AppContext validation, Tauri/local/private boundaries | Integrating login validation into an app, wiring appbase auth UI/runtime, adding route guards, validating Rust protected APIs, or fixing logout/session behavior |
| `SECURITY_SPEC.md` | Token model, authn/authz, secrets, rate limits, CORS, input validation, secure logging | Any protected API or sensitive UI flow |
| `PRIVACY_SPEC.md` | Data classification, minimization, retention, export/delete, residency | Handling tenant, personal, sensitive, or regulated data |
| `DEPLOYMENT_SPEC.md` | SaaS/private/local deployment parity, Java/Rust switching, runtime bootstrap | Supporting multiple runtime modes |
| `GITHUB_WORKFLOW_SPEC.md` | SDKWork GitHub Actions packaging and deployment workflow standard: `sdkwork.workflow.json`, thin application workflow entrypoint, reusable `sdkwork-github-workflow`, matrix planning, dependency checkout, lifecycle execution, artifact publication, Release upload, attestations, and deployment environments | Creating, standardizing, or maintaining application packaging/release/deployment GitHub workflows or the `sdkwork-github-workflow` framework |
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
| Execute any agentic repository task | `SOUL.md` | nearest `AGENTS.md`, then `AGENTS_SPEC.md`, `SDKWORK_WORKSPACE_SPEC.md`, and the task-specific specs |
| Create or maintain a git repository root or application root | `SDKWORK_WORKSPACE_SPEC.md` | `AGENTS_SPEC.md`, `DOCUMENTATION_SPEC.md`, `GOVERNANCE_SPEC.md`, and the root specs for the repository/application capabilities |
| Create or maintain `AGENTS.md` or compatibility shims such as `CLAUDE.md`, `GEMINI.md`, and `CODEX.md` | `AGENTS_SPEC.md` | `SOUL.md`, `SDKWORK_WORKSPACE_SPEC.md`, `DOCUMENTATION_SPEC.md`, `TEST_SPEC.md` |
| Make any authored code change | `CODE_STYLE_SPEC.md` | `NAMING_SPEC.md`, then only the language/framework spec for touched files |
| Touch Rust source, Cargo manifests, Rust route crates, Tauri Rust, or Rust RPC code | `RUST_CODE_SPEC.md` | `CODE_STYLE_SPEC.md`, `NAMING_SPEC.md`, and `RUST_RPC_SPEC.md` only when RPC is touched |
| Touch Java, Spring backend, Maven modules, or Java SDK code | `JAVA_CODE_SPEC.md` | `CODE_STYLE_SPEC.md`, `NAMING_SPEC.md`, `WEB_BACKEND_SPEC.md` when HTTP backend code is touched |
| Touch TypeScript, JavaScript, Node scripts, package exports, or TypeScript SDK facades | `TYPESCRIPT_CODE_SPEC.md` | `CODE_STYLE_SPEC.md`, `NAMING_SPEC.md`, `SDK_SPEC.md` when SDK surfaces are touched |
| Touch React, Flutter, renderer, mobile, PC, or backend/admin UI code | `FRONTEND_CODE_SPEC.md` | `FRONTEND_SPEC.md`, `UI_ARCHITECTURE_SPEC.md`, and exactly one architecture-specific UI spec |
| Create a new application | `SDKWORK_WORKSPACE_SPEC.md` | `APP_MANIFEST_SPEC.md`, `APPLICATION_SPEC.md`, `CONFIG_SPEC.md`, `DEPLOYMENT_SPEC.md`, `DOCUMENTATION_SPEC.md` |
| Create or maintain a PC browser/desktop/tablet application | `APP_PC_ARCHITECTURE_SPEC.md` | `APPLICATION_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, `UI_ARCHITECTURE_SPEC.md`, `APP_PC_REACT_UI_SPEC.md`, `DESKTOP_APP_ARCHITECTURE_SPEC.md` when desktop/Tauri/tablet native targets exist, `CONFIG_SPEC.md`, `ENVIRONMENT_SPEC.md`, `RUNTIME_DIRECTORY_SPEC.md`, `SECURITY_SPEC.md`, `TEST_SPEC.md` |
| Create a desktop/Tauri/tablet native application | `APP_PC_ARCHITECTURE_SPEC.md` | `DESKTOP_APP_ARCHITECTURE_SPEC.md`, `APP_MANIFEST_SPEC.md`, `APPLICATION_SPEC.md`, `UI_ARCHITECTURE_SPEC.md`, `APP_PC_REACT_UI_SPEC.md`, `CONFIG_SPEC.md`, `ENVIRONMENT_SPEC.md`, `RUNTIME_DIRECTORY_SPEC.md`, `DEPLOYMENT_SPEC.md`, `SECURITY_SPEC.md`, `TEST_SPEC.md` |
| Define PC app environment profiles and config files | `ENVIRONMENT_SPEC.md` | `CONFIG_SPEC.md`, `APP_PC_ARCHITECTURE_SPEC.md`, `DESKTOP_APP_ARCHITECTURE_SPEC.md`, `RUNTIME_DIRECTORY_SPEC.md`, `DEPLOYMENT_SPEC.md`, `SECURITY_SPEC.md`, `TEST_SPEC.md` |
| Create or maintain an independent Rust app under `apps/` | `APPLICATION_SPEC.md` | `APP_SDK_INTEGRATION_SPEC.md`, `SDK_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md`, `IAM_LOGIN_INTEGRATION_SPEC.md`, `DEPLOYMENT_SPEC.md`, `SECURITY_SPEC.md`, `TEST_SPEC.md`; also `APP_PC_ARCHITECTURE_SPEC.md` and `DESKTOP_APP_ARCHITECTURE_SPEC.md` when the app has a PC/Tauri/native desktop or tablet host |
| Integrate generated SDKs into an app architecture | `APP_SDK_INTEGRATION_SPEC.md` | `SDK_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md`, `APPLICATION_SPEC.md`, `FRONTEND_SPEC.md`, `UI_ARCHITECTURE_SPEC.md`, `IAM_LOGIN_INTEGRATION_SPEC.md`, `CONFIG_SPEC.md`, `TEST_SPEC.md` |
| Build Rust HTTP route crates or web backend API routes | `API_SPEC.md` | `WEB_BACKEND_SPEC.md`, `APPLICATION_SPEC.md`, `SDK_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md`, `DOMAIN_SPEC.md`, `SECURITY_SPEC.md`, `TEST_SPEC.md` |
| Create a reusable appbase module | `MODULE_SPEC.md` | `DOMAIN_SPEC.md`, `FRONTEND_SPEC.md`, `SDK_SPEC.md`, `TEST_SPEC.md` |
| Create or onboard a component package | `COMPONENT_SPEC.md` | `MODULE_SPEC.md`, `DOCUMENTATION_SPEC.md`, `TEST_SPEC.md`, and the language/domain specs referenced by `component.spec.json` |
| Build app PC React UI | `APP_PC_ARCHITECTURE_SPEC.md` | `UI_ARCHITECTURE_SPEC.md`, `APP_PC_REACT_UI_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, `FRONTEND_SPEC.md`, `MODULE_SPEC.md`, `SDK_SPEC.md`, `I18N_SPEC.md`, `SECURITY_SPEC.md` |
| Build PC user-facing console modules | `APP_PC_ARCHITECTURE_SPEC.md` | `UI_ARCHITECTURE_SPEC.md`, `APP_PC_REACT_UI_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, `FRONTEND_SPEC.md`, `MODULE_SPEC.md`, `SDK_SPEC.md`, `I18N_SPEC.md`, `SECURITY_SPEC.md` |
| Build PC internal admin modules | `APP_PC_ARCHITECTURE_SPEC.md` | `UI_ARCHITECTURE_SPEC.md`, `BACKEND_UI_SPEC.md`, `FRONTEND_SPEC.md`, `MODULE_SPEC.md`, `SDK_SPEC.md`, `API_SPEC.md`, `SECURITY_SPEC.md`, `TEST_SPEC.md` |
| Build mobile React UI | `UI_ARCHITECTURE_SPEC.md` | `APP_MOBILE_REACT_UI_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, `FRONTEND_SPEC.md`, `MODULE_SPEC.md`, `SDK_SPEC.md`, `CONFIG_SPEC.md`, `SECURITY_SPEC.md` |
| Build Flutter UI | `UI_ARCHITECTURE_SPEC.md` | `APP_FLUTTER_UI_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, `FRONTEND_SPEC.md`, `MODULE_SPEC.md`, `SDK_SPEC.md`, `CONFIG_SPEC.md`, `SECURITY_SPEC.md` |
| Build standalone backend/admin UI | `UI_ARCHITECTURE_SPEC.md` | `BACKEND_UI_SPEC.md`, `FRONTEND_SPEC.md`, `MODULE_SPEC.md`, `SDK_SPEC.md`, `API_SPEC.md`, `SECURITY_SPEC.md` |
| Integrate appbase IAM login/session validation | `IAM_LOGIN_INTEGRATION_SPEC.md` | `APP_SDK_INTEGRATION_SPEC.md`, `IAM_SPEC.md`, `API_SPEC.md`, `SDK_SPEC.md`, `FRONTEND_SPEC.md`, `UI_ARCHITECTURE_SPEC.md`, `APP_PC_ARCHITECTURE_SPEC.md` for PC roots, `APP_PC_REACT_UI_SPEC.md`, `DESKTOP_APP_ARCHITECTURE_SPEC.md`, `SECURITY_SPEC.md`, `DEPLOYMENT_SPEC.md`, `TEST_SPEC.md` |
| Add login/session/user/tenant/org/permission | `IAM_SPEC.md` | `API_SPEC.md`, `DATABASE_SPEC.md`, `SECURITY_SPEC.md`, `PRIVACY_SPEC.md` |
| Add or change HTTP API | `API_SPEC.md` | `WEB_BACKEND_SPEC.md` when implementation changes, then `DOMAIN_SPEC.md`, `SDK_SPEC.md`, `SECURITY_SPEC.md`, `TEST_SPEC.md` |
| Add or change RPC/gRPC API | `RPC_SPEC.md` | `DOMAIN_SPEC.md`, `SDK_SPEC.md`, `SECURITY_SPEC.md`, `OBSERVABILITY_SPEC.md`, `TEST_SPEC.md` |
| Implement Rust RPC server/client | `RUST_RPC_SPEC.md` | `RPC_SPEC.md`, `DEPLOYMENT_SPEC.md`, `ENVIRONMENT_SPEC.md`, `SECURITY_SPEC.md`, `OBSERVABILITY_SPEC.md`, `TEST_SPEC.md` |
| Add or change database schema | `DATABASE_SPEC.md` | `DOMAIN_SPEC.md`, `API_SPEC.md`, `PRIVACY_SPEC.md`, `TEST_SPEC.md` |
| Add or change file storage, upload, download, object-storage provider, bucket/object lifecycle, app-upload, knowledge-base file, AI-generated asset storage, Drive Uploader, client upload, server-side Rust upload, or upload statistics | `DRIVE_SPEC.md` | `APP_SDK_INTEGRATION_SPEC.md`, `FRONTEND_SPEC.md`, `API_SPEC.md`, `DATABASE_SPEC.md`, `MEDIA_RESOURCE_SPEC.md`, `RPC_SPEC.md`, `SDK_SPEC.md`, `SECURITY_SPEC.md`, `PRIVACY_SPEC.md`, `TEST_SPEC.md` |
| Add or change media representation, image, video, audio, voice, document, product-media, generated-media DTO, or business media attachment contracts | `MEDIA_RESOURCE_SPEC.md` | `DRIVE_SPEC.md`, `API_SPEC.md`, `DATABASE_SPEC.md`, `RPC_SPEC.md`, `FRONTEND_SPEC.md`, `SDK_SPEC.md`, `SECURITY_SPEC.md`, `PRIVACY_SPEC.md` |
| Create or standardize an application SDK workspace | `SDK_SPEC.md` | `SDK_WORKSPACE_GENERATION_SPEC.md`, `API_SPEC.md`, `COMPONENT_SPEC.md`, `CONFIG_SPEC.md`, `TEST_SPEC.md` |
| Generate or consume an SDK | `SDK_SPEC.md` | `SDK_WORKSPACE_GENERATION_SPEC.md` for `sdks/` layout and generator artifacts, then `API_SPEC.md`, `CONFIG_SPEC.md`, `FRONTEND_SPEC.md` |
| Build frontend UI/business logic | `FRONTEND_SPEC.md` | `MODULE_SPEC.md`, `SDK_SPEC.md`, `SECURITY_SPEC.md` |
| Add or change user-facing copy/i18n | `I18N_SPEC.md` | `FRONTEND_SPEC.md`, `IAM_SPEC.md`, `SECURITY_SPEC.md` for auth/security copy |
| Switch SaaS/private/local mode | `DEPLOYMENT_SPEC.md` | `CONFIG_SPEC.md`, `RUNTIME_DIRECTORY_SPEC.md`, `ENVIRONMENT_SPEC.md`, `API_SPEC.md`, `DATABASE_SPEC.md`, `TEST_SPEC.md` |
| Create or maintain GitHub packaging, release, artifact, or deployment workflows | `GITHUB_WORKFLOW_SPEC.md` | `DEPLOYMENT_SPEC.md`, `SECURITY_SPEC.md`, `DOCUMENTATION_SPEC.md`, `TEST_SPEC.md`, and `TYPESCRIPT_CODE_SPEC.md` when changing the framework planner or Node tooling |
| Publish through nginx | `NGINX_SPEC.md` | `DEPLOYMENT_SPEC.md`, `SECURITY_SPEC.md`, `OBSERVABILITY_SPEC.md` |
| Add or change runtime directories, service install paths, desktop private paths, database config, Redis config, logs, cache, or secret files | `RUNTIME_DIRECTORY_SPEC.md` | `CONFIG_SPEC.md`, `ENVIRONMENT_SPEC.md`, `DEPLOYMENT_SPEC.md`, `DATABASE_SPEC.md`, `CACHE_SPEC.md`, `SECURITY_SPEC.md`, `OBSERVABILITY_SPEC.md`, `TEST_SPEC.md` |
| Add or change env variables, `.env` files, runtime config files, or SDK base URL config | `ENVIRONMENT_SPEC.md` | `CONFIG_SPEC.md`, `RUNTIME_DIRECTORY_SPEC.md`, `DEPLOYMENT_SPEC.md`, `SECURITY_SPEC.md`, `TEST_SPEC.md` |
| Add or change cache runtime, Redis/local cache, cache invalidation, QR/login temporary cache, or admin cache management | `CACHE_SPEC.md` | `CONFIG_SPEC.md`, `ENVIRONMENT_SPEC.md`, `DEPLOYMENT_SPEC.md`, `SECURITY_SPEC.md`, `OBSERVABILITY_SPEC.md`, `TEST_SPEC.md` |
| Integrate external providers/webhooks | `INTEGRATION_SPEC.md` | `SECURITY_SPEC.md`, `EVENT_SPEC.md`, `OBSERVABILITY_SPEC.md` |
| Publish events or async flows | `EVENT_SPEC.md` | `API_SPEC.md`, `DATABASE_SPEC.md`, `OBSERVABILITY_SPEC.md` |
| Prepare production readiness | `OBSERVABILITY_SPEC.md` | `PERFORMANCE_SPEC.md`, `SECURITY_SPEC.md`, `TEST_SPEC.md` |
| Update a standard or approve deviation | `GOVERNANCE_SPEC.md` | affected spec files and `DOCUMENTATION_SPEC.md` |

## 4. Minimum Rules

- Agent execution starts from `SOUL.md` and the nearest `AGENTS.md`; agents must not rely on remembered SDKWork rules when a relevant spec exists.
- Every git repository root and every SDKWork application root must have `AGENTS.md` according to `AGENTS_SPEC.md`, with relative links to root `sdkwork-specs`. Tool-compatible roots use files such as `CLAUDE.md`, `GEMINI.md`, and `CODEX.md` only as shims to `AGENTS.md`.
- Code changes start from `CODE_STYLE_SPEC.md` and `NAMING_SPEC.md`; language-specific specs are loaded only when that language or framework is touched.
- Rust `src/lib.rs` is a module assembly and re-export boundary. It must not become a catch-all file for handlers, repositories, SQL, DTOs, services, provider clients, and tests.
- Domain naming starts from `DOMAIN_SPEC.md`; do not invent `identity` when the standard domain is `iam`.
- Every git repository root and every SDKWork application root must have a source-controlled `.sdkwork/` workspace with `.sdkwork/skills/` and `.sdkwork/plugins/` according to `SDKWORK_WORKSPACE_SPEC.md`.
- API work starts from `API_SPEC.md`.
- Web backend implementation work then follows `WEB_BACKEND_SPEC.md`; controller/router, handler, service, repository, request context, and materialization boundaries must not be inferred from local convention alone.
- Rust HTTP route crates and web backend route/path configuration must use `sdkwork-routes-<capability>-open-api`, `sdkwork-routes-<capability>-app-api`, or `sdkwork-routes-<capability>-backend-api`; route crates aggregate into `sdkwork-<domain>-open-api`, `sdkwork-<domain>-app-api`, or `sdkwork-<domain>-backend-api`, then generate `sdkwork-<domain>-sdk`, `sdkwork-<domain>-app-sdk`, or `sdkwork-<domain>-backend-sdk`.
- RPC/gRPC work starts from `RPC_SPEC.md`.
- Rust RPC implementation work starts from `RUST_RPC_SPEC.md`.
- Database/schema work starts from `DATABASE_SPEC.md`.
- File storage, upload, download, object-storage provider, app-upload, knowledge-base file, AI-generated asset storage, client upload, server-side Rust upload, and upload statistics work starts from `DRIVE_SPEC.md`.
- All SDKWork application uploads must use Drive Uploader. Client applications use `sdkwork-drive-app-sdk client.uploader.*`; server-side Rust services use `DriveUploaderService`, `PrepareUploaderUploadCommand`, or an approved `sdkwork_drive_product::uploader` facade. Product apps must not create app-local upload sessions, presign services, object-key builders, provider SDK upload flows, upload statistic source tables, or duplicate `/upload` APIs for SDKWork-owned files.
- App module work starts from `APPLICATION_SPEC.md` and `MODULE_SPEC.md`.
- PC browser/desktop/tablet application roots start from `APP_PC_ARCHITECTURE_SPEC.md`. New PC packages must use `sdkwork-<product>-pc-<capability>` for user app modules, `sdkwork-<product>-pc-console-<capability>` for user-facing management console modules, and `sdkwork-<product>-pc-admin-<capability>` for company-internal admin modules.
- Independent `apps/` repositories that include Rust local/private, Tauri, or native runtime code must depend on `sdkwork-appbase`; this includes the relevant appbase Rust crates and generated appbase app/backend SDK families, not product-local copies of appbase APIs.
- Desktop/Tauri app shell, iPadOS/Android tablet native packaging, native host capability, desktop/tablet packaging, and native session/config behavior start from `APP_PC_ARCHITECTURE_SPEC.md`, then `DESKTOP_APP_ARCHITECTURE_SPEC.md`.
- Component-local specs start from `COMPONENT_SPEC.md`.
- Frontend work starts from `FRONTEND_SPEC.md`, then `UI_ARCHITECTURE_SPEC.md`; PC application roots also apply `APP_PC_ARCHITECTURE_SPEC.md`, then exactly one architecture-specific UI spec: `APP_PC_REACT_UI_SPEC.md`, `APP_MOBILE_REACT_UI_SPEC.md`, `APP_FLUTTER_UI_SPEC.md`, or `BACKEND_UI_SPEC.md`.
- App SDK integration across PC React, mobile React, Flutter, desktop/native, Rust-enabled apps, and cross-application dependencies starts from `APP_SDK_INTEGRATION_SPEC.md`.
- Standalone backend/admin UI must be split by `@sdkwork/react-backend-<domain>` package and follow `BACKEND_UI_SPEC.md`; PC internal admin UI must be split by `sdkwork-<product>-pc-admin-<capability>` and follow both `APP_PC_ARCHITECTURE_SPEC.md` and `BACKEND_UI_SPEC.md`.
- App-side PC React, mobile React, and Flutter UI must stay in app-side package families and follow their corresponding UI architecture specs.
- User-facing language and login/register/session copy start from `I18N_SPEC.md`.
- SDK generation, SDK consumption, SDK package naming, and service integration work starts from `SDK_SPEC.md`.
- SDK workspace layout, OpenAPI authority/derived inputs, and generated artifact placement then use `SDK_WORKSPACE_GENERATION_SPEC.md` as the subordinate detail standard.
- Appbase IAM login/session integration, AuthGate behavior, logout clearing, SDK token wiring, and Rust AppContext validation start from `IAM_LOGIN_INTEGRATION_SPEC.md`.
- Apps must maintain one global TokenManager per authenticated session context. `sdkwork-appbase` IAM runtime owns login, registration, refresh, current session, logout, runtime metadata, current-user self-service, and shared token propagation to every authenticated app-api/backend-api SDK client.
- SDK base URLs must be configured per surface: open-api, app-api, backend-api, and dependency SDK surfaces each get explicit private/public/Vite config names when consumed. Do not collapse them into one ambiguous API URL when they can deploy independently.
- `Access-Token` is runtime session state, not env config. Apps must not define live `AUTH_TOKEN`, `ACCESS_TOKEN`, `REFRESH_TOKEN`, `VITE_*_TOKEN`, or `PORTAL_PUBLIC_*_TOKEN` variables outside explicit test fixtures.
- Media representation and business media DTO work starts from `MEDIA_RESOURCE_SPEC.md`; Drive remains the storage lifecycle authority.
- Runtime config and environment switching start from `CONFIG_SPEC.md`.
- Lifecycle environment, profile alias, deployment mode, build mode, and runtime target must be separated. Do not use Vite mode, Spring profile, Tauri target, `NODE_ENV`, or a file name as the full runtime decision model.
- Dev/test/staging/prod config templates must be safe checked-in examples. Host-local files such as `.env.local`, `.env.<profile>.local`, `.env.postgres`, `.env.release.local`, and `config/*.local.toml` must be ignored.
- PC applications must separate browser public runtime config, desktop user runtime config, desktop-started server config, container runtime config, and Tauri platform config.
- Runtime directory layout, SDKWork path namespace, user-private files, database config files, Redis config files, logs, cache, temp files, and secret file placement start from `RUNTIME_DIRECTORY_SPEC.md`.
- Environment variables, release env files, runtime config discovery, and deployment-mode database defaults start from `ENVIRONMENT_SPEC.md`.
- User, tenant, organization, auth, role, or permission work starts from `IAM_SPEC.md` and `SECURITY_SPEC.md`.
- SaaS/local/private switching starts from `DEPLOYMENT_SPEC.md`.
- GitHub packaging, release, artifact publication, dependency checkout, deployment environment, and reusable workflow integration start from `GITHUB_WORKFLOW_SPEC.md`. Application repositories must use `sdkwork.workflow.json` plus a thin `.github/workflows/package.yml` reusable workflow call instead of copying framework release YAML.
- Public nginx reverse proxy deployment starts from `NGINX_SPEC.md`.
- Cache runtime, cache invalidation, Redis/local cache switching, QR/login temporary cache, and admin cache management start from `CACHE_SPEC.md`.
- Event-driven work starts from `EVENT_SPEC.md`.
- External provider work starts from `INTEGRATION_SPEC.md`.
- Production readiness starts from `OBSERVABILITY_SPEC.md`, `PERFORMANCE_SPEC.md`, and `TEST_SPEC.md`.
- Standard changes and exceptions start from `GOVERNANCE_SPEC.md`.

If an app keeps a local copy for convenience, the root `specs/` version remains authoritative.

## 5. New App Checklist

- [ ] Create `AGENTS.md` using `AGENTS_SPEC.md`, with a valid relative path to `sdkwork-specs/README.md` and `SOUL.md`.
- [ ] Create tool compatibility shims such as `CLAUDE.md`, `GEMINI.md`, and `CODEX.md` as needed; each must point to `AGENTS.md`.
- [ ] Create or validate `sdkwork.app.config.json` using `APP_MANIFEST_SPEC.md`.
- [ ] Create `sdkwork.workflow.json` and a thin `.github/workflows/package.yml` reusable workflow call using `GITHUB_WORKFLOW_SPEC.md` when the application is packaged, released, or deployed through GitHub Actions.
- [ ] Create or validate `.sdkwork/README.md`, `.sdkwork/skills/README.md`, and `.sdkwork/plugins/README.md` using `SDKWORK_WORKSPACE_SPEC.md`.
- [ ] Choose canonical domains with `DOMAIN_SPEC.md`.
- [ ] Design reusable modules with `APPLICATION_SPEC.md` and `MODULE_SPEC.md`.
- [ ] If the app is a PC browser/desktop/tablet application, apply `APP_PC_ARCHITECTURE_SPEC.md` and name packages as `sdkwork-<product>-pc-*`, `sdkwork-<product>-pc-console-*`, and `sdkwork-<product>-pc-admin-*` according to their surface.
- [ ] Create component-local `specs/README.md` and `specs/component.spec.json` using `COMPONENT_SPEC.md`.
- [ ] Select exactly one UI architecture through `UI_ARCHITECTURE_SPEC.md` before creating UI packages: app PC React, PC user console React, PC internal admin React, mobile React, Flutter, or standalone backend/admin React.
- [ ] If the app targets PC desktop, iPadOS, Android tablet, or Tauri, apply `APP_PC_ARCHITECTURE_SPEC.md` and then `DESKTOP_APP_ARCHITECTURE_SPEC.md` before adding native host code or packaging scripts.
- [ ] If the app is an independent `apps/` repository with Rust local/private, Tauri, or native runtime code, declare `sdkwork-appbase`, the required appbase Rust crates, and the appbase generated SDK dependencies before generating product-owned SDKs.
- [ ] Define APIs with `API_SPEC.md` before SDK generation.
- [ ] Implement web backend controller/router, handler, service, repository, request context, and materialization boundaries with `WEB_BACKEND_SPEC.md`.
- [ ] If the app defines Rust HTTP API routes, name route crates as `sdkwork-routes-<capability>-<surface>`, aggregate route manifests into `sdkwork-<domain>-<surface>`, and generate SDK families from the aggregated authority only.
- [ ] Define RPC services with `RPC_SPEC.md` before proto/client generation when cross-language direct calls are required.
- [ ] Implement Rust RPC services with `RUST_RPC_SPEC.md` and keep RPC adapters behind runtime/service boundaries.
- [ ] Define tables with `DATABASE_SPEC.md` before migrations/entities.
- [ ] Define file storage, Drive Uploader, client upload, server-side Rust upload, download, app-upload, knowledge-base file, generated asset storage, and upload statistics with `DRIVE_SPEC.md` before API/schema/SDK work.
- [ ] For every upload feature, declare `sdkwork-drive-app-sdk` as the client upload dependency and, when Rust server-side uploads exist, declare the Drive product Rust uploader component. Define stable `appId`, `appResourceType`, `appResourceId`, `scene`, `source`, allowed upload profiles, and retention policy before implementation.
- [ ] Define media, image, video, voice, document, and generated media representation with `MEDIA_RESOURCE_SPEC.md`, backed by Drive for SDKWork-owned storage.
- [ ] Design SDK naming, package semantics, generated client surface, and service integration with `SDK_SPEC.md`.
- [ ] Wire architecture-specific generated SDKs, dependency SDKs, appbase IAM runtime, and one global TokenManager using `APP_SDK_INTEGRATION_SPEC.md`.
- [ ] Create or validate application-root `sdks/` workspace, SDK family directories, OpenAPI authority/derived inputs, and generated artifact placement with `SDK_WORKSPACE_GENERATION_SPEC.md`.
- [ ] Wire frontend services through `FRONTEND_SPEC.md`.
- [ ] Wire localized user-facing copy through `I18N_SPEC.md`.
- [ ] Integrate login/session through `IAM_LOGIN_INTEGRATION_SPEC.md` before adding local auth routes, route guards, logout logic, or Rust protected API validation.
- [ ] Keep environment and SDK client creation in bootstrap using `CONFIG_SPEC.md` and `ENVIRONMENT_SPEC.md`.
- [ ] Define dev/test/staging/prod config templates and local override ignore rules. For PC/desktop roots, separate `config/browser`, `config/desktop`, `config/server`, `config/container`, and Tauri platform config.
- [ ] Use `RUNTIME_DIRECTORY_SPEC.md` for service directories, user private directories, database/Redis config files, logs, cache, temp files, and secret file placement.
- [ ] Use `CACHE_SPEC.md` for runtime cache, Redis/local mode selection, and admin cache management.
- [ ] Apply `IAM_SPEC.md`, `SECURITY_SPEC.md`, and `PRIVACY_SPEC.md` for protected tenant/user behavior.
- [ ] Verify SaaS/private/local parity with `DEPLOYMENT_SPEC.md` and `TEST_SPEC.md`.
- [ ] Add module README, examples, changelog, and runbook using `DOCUMENTATION_SPEC.md`.

## 6. Future Standards Roadmap

The current standards cover repository/application workspace, agent entrypoints, code structure, contracts, SDKs, runtime, security, tests, and documentation. A higher-availability AI software factory should later add these specs when executable rules are ready:

| Future spec | Purpose |
| --- | --- |
| `WORKFLOW_SPEC.md` | Standard Plan -> Execute -> Verify -> Fix -> Retry workflows, checkpoints, resumable tasks, and human review gates |
| `EVALUATION_SPEC.md` | Agent/code/content success metrics, evaluation datasets, pass/fail scoring, regression tracking, and feedback loops |
| `RELIABILITY_SPEC.md` | High-availability service rules, retry budgets, failover, degradation, idempotency at platform level, and recovery drills |
| `RELEASE_SPEC.md` | Release trains, semantic versioning, artifacts, signatures, rollback, staged rollout, and release evidence |
| `MIGRATION_SPEC.md` | API, database, SDK, config, and package migration planning with compatibility windows and rollback plans |
| `AGENT_RUNTIME_SPEC.md` | Long-running agent state, snapshots, event sourcing, task resumption, tool permissions, and audit trails |
| `CONVENTION_DICTIONARY_SPEC.md` | Optional executable discovery rules for the existing convention dictionary without creating a separate dictionary service |

Do not create these as empty policy files. Add them when a repository or platform workflow needs executable rules, validation, and ownership.

## 7. External Baselines

The standards align with current open specifications where they fit SDKWork:

- Twelve-Factor App config principle: https://12factor.net/config
- Vite Env Variables and Modes: https://vite.dev/guide/env-and-mode
- Tauri v2 configuration files and platform-specific config merging: https://v2.tauri.app/develop/configuration-files/
- Spring Boot externalized configuration and profile-specific files: https://docs.spring.io/spring-boot/reference/features/external-config.html
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
