# Application Module Standard

- Version: 1.0
- Scope: all SDKWork SaaS, private, local, desktop, web, and mobile applications
- Related: `SDKWORK_WORKSPACE_SPEC.md`, `DOMAIN_SPEC.md`, `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, `APP_PC_ARCHITECTURE_SPEC.md`, `H5_APP_MOBILE_ARCHITECTURE_SPEC.md`, `FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC.md`, `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md`, `ANDROID_APP_MOBILE_ARCHITECTURE_SPEC.md`, `IOS_APP_MOBILE_ARCHITECTURE_SPEC.md`, `HARMONY_APP_MOBILE_ARCHITECTURE_SPEC.md`, `MODULE_SPEC.md`, `FRONTEND_SPEC.md`, `UI_ARCHITECTURE_SPEC.md`, `APP_PC_REACT_UI_SPEC.md`, `APP_MOBILE_REACT_UI_SPEC.md`, `APP_FLUTTER_UI_SPEC.md`, `APP_MINI_PROGRAM_UI_SPEC.md`, `APP_ANDROID_NATIVE_UI_SPEC.md`, `APP_IOS_NATIVE_UI_SPEC.md`, `APP_HARMONY_NATIVE_UI_SPEC.md`, `BACKEND_UI_SPEC.md`, `CONFIG_SPEC.md`, `APP_MANIFEST_SPEC.md`, `API_SPEC.md`, `WEB_BACKEND_SPEC.md`, `SDK_SPEC.md`, `IAM_SPEC.md`, `DEPLOYMENT_SPEC.md`, `TEST_SPEC.md`

This standard defines how applications are assembled from reusable modules. The goal is to make product apps thin composition layers and keep shared capabilities reusable across SaaS Java backends, Rust local/private backends, and different frontend architectures.

Use `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md` for cross-client package taxonomy, route identity, component boundaries, dependency direction, host adapter boundaries, and SDK/IAM/runtime alignment. Use `APP_SDK_INTEGRATION_SPEC.md` for cross-architecture generated SDK wiring, dependency SDK composition, appbase IAM runtime, global TokenManager, and Rust backend composition. Use `APP_PC_ARCHITECTURE_SPEC.md` for PC browser/desktop application roots, `H5_APP_MOBILE_ARCHITECTURE_SPEC.md` for H5/Capacitor mobile roots, `FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC.md` for Flutter mobile roots, `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` for mini program roots, `ANDROID_APP_MOBILE_ARCHITECTURE_SPEC.md` for native Android roots, `IOS_APP_MOBILE_ARCHITECTURE_SPEC.md` for native iOS roots, and `HARMONY_APP_MOBILE_ARCHITECTURE_SPEC.md` for native HarmonyOS roots. Use the matching UI/package standard for detailed UI package rules, including `APP_ANDROID_NATIVE_UI_SPEC.md`, `APP_IOS_NATIVE_UI_SPEC.md`, `APP_HARMONY_NATIVE_UI_SPEC.md`, and `APP_MINI_PROGRAM_UI_SPEC.md` for their package-local UI rules. Use `MODULE_SPEC.md` for reusable package contracts, `FRONTEND_SPEC.md` for architecture-neutral UI-service-SDK rules, `WEB_BACKEND_SPEC.md` for Java/Rust web backend implementation boundaries, `CONFIG_SPEC.md` for environment and SDK client bootstrap, and `APP_MANIFEST_SPEC.md` for `sdkwork.app.config.json`.

Every application root `MUST` contain the source-controlled `.sdkwork/` workspace required by `SDKWORK_WORKSPACE_SPEC.md`, including `.sdkwork/skills/` and `.sdkwork/plugins/`. This directory stores local development knowledge and repository/application extensions; it is separate from generated SDK output `.sdkwork/` control-plane files and user-private runtime `~/.sdkwork/<app>` directories.

Application UI work must also pass the `UI_ARCHITECTURE_SPEC.md` selection gate before files are created. PC browser/desktop applications first apply `APP_PC_ARCHITECTURE_SPEC.md`, then select the detailed UI package standard for app, console, or admin packages:

| UI architecture | Required standard | Package family |
| --- | --- | --- |
| PC browser/desktop app root | `APP_PC_ARCHITECTURE_SPEC.md` | `apps/<product>-pc/packages/sdkwork-<product>-pc-*`, `sdkwork-<product>-pc-console-*`, `sdkwork-<product>-pc-admin-*` |
| App PC React packages | `APP_PC_REACT_UI_SPEC.md` | `packages/pc-react/<domain>/sdkwork-<capability>-pc-react` or the normalized app-root packages defined by `APP_PC_ARCHITECTURE_SPEC.md` |
| PC user console React | `APP_PC_ARCHITECTURE_SPEC.md` and `APP_PC_REACT_UI_SPEC.md` | `apps/<product>-pc/packages/sdkwork-<product>-pc-console-<capability>` |
| H5 app mobile React root | `H5_APP_MOBILE_ARCHITECTURE_SPEC.md` and `APP_MOBILE_REACT_UI_SPEC.md` | `apps/<product>-h5-mobile/packages/sdkwork-<product>-h5-mobile-*` |
| Shared app mobile React packages | `APP_MOBILE_REACT_UI_SPEC.md` | `packages/mobile-react/<domain>/sdkwork-<capability>-mobile-react` |
| Flutter mobile app root | `FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC.md` and `APP_FLUTTER_UI_SPEC.md` | `apps/<product>-flutter-mobile/packages/sdkwork_<product>_flutter_mobile_*` |
| Shared app Flutter packages | `APP_FLUTTER_UI_SPEC.md` | `packages/mobile-flutter/<domain>/sdkwork_<capability>_flutter` |
| Mini program app root | `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` and `APP_MINI_PROGRAM_UI_SPEC.md` | `apps/<product>-mini-program/packages/sdkwork-<product>-mp-*` |
| Shared app mini program packages | `APP_MINI_PROGRAM_UI_SPEC.md` | `packages/mini-program/<domain>/sdkwork-<capability>-mini-program` |
| Android native mobile app root | `ANDROID_APP_MOBILE_ARCHITECTURE_SPEC.md` and `APP_ANDROID_NATIVE_UI_SPEC.md` | `apps/<product>-android-mobile/packages/sdkwork-<product>-android-mobile-*` |
| Shared app Android native packages | `APP_ANDROID_NATIVE_UI_SPEC.md` | `packages/android-native/<domain>/sdkwork-<capability>-android-native` |
| iOS native mobile app root | `IOS_APP_MOBILE_ARCHITECTURE_SPEC.md` and `APP_IOS_NATIVE_UI_SPEC.md` | `apps/<product>-ios-mobile/packages/sdkwork-<product>-ios-mobile-*` |
| Shared app iOS native packages | `APP_IOS_NATIVE_UI_SPEC.md` | `packages/ios-native/<domain>/sdkwork-<capability>-ios-native` |
| Harmony native mobile app root | `HARMONY_APP_MOBILE_ARCHITECTURE_SPEC.md` and `APP_HARMONY_NATIVE_UI_SPEC.md` | `apps/<product>-harmony-mobile/packages/sdkwork-<product>-harmony-mobile-*` |
| Shared app Harmony native packages | `APP_HARMONY_NATIVE_UI_SPEC.md` | `packages/harmony-native/<domain>/sdkwork-<capability>-harmony-native` |
| PC internal admin React | `APP_PC_ARCHITECTURE_SPEC.md` and `BACKEND_UI_SPEC.md` | `apps/<product>-pc/packages/sdkwork-<product>-pc-admin-<capability>` |
| Standalone backend/admin React | `BACKEND_UI_SPEC.md` | `apps/sdkwork-backend-react-web/packages/sdkwork-react-backend-<domain>` |

Rules:

- App/user-facing packages consume app-api through app SDKs or approved appbase wrappers.
- Backend/admin packages consume backend-api through backend SDKs or approved backend wrappers.
- Every SDKWork application root `MUST` have `.sdkwork/README.md`, `.sdkwork/skills/README.md`, and `.sdkwork/plugins/README.md`.
- Independent application repositories under `apps/` that include Rust local/private services, Tauri hosts, or native Rust runtime crates `MUST` declare `sdkwork-appbase` as a foundation dependency.
- Those Rust-enabled independent apps `MUST` integrate the relevant appbase Rust crates and generated appbase SDK families, including appbase app SDKs for user-facing app-api capabilities and appbase backend SDKs for backend/admin capabilities when those surfaces are used.
- Product applications `MUST NOT` copy, fork, or regenerate appbase-owned IAM, session, workspace, bootstrap, tenant, organization, user, verification, or backend management APIs into the product application repository. They consume appbase through dependencies and approved composed wrappers.
- UI packages from different architecture families must not import each other's pages, components, routes, host adapters, or runtime globals.
- PC application roots `MUST` follow `APP_PC_ARCHITECTURE_SPEC.md`. Packages without `pc-console` or `pc-admin` are app/user modules by default; `pc-console` modules are user-facing management console modules; `pc-admin` modules are company-internal admin modules.
- H5/Capacitor mobile roots `MUST` follow `H5_APP_MOBILE_ARCHITECTURE_SPEC.md`. H5 mobile packages use `sdkwork-<product>-h5-mobile-*`, and Capacitor host behavior belongs in `sdkwork-<product>-h5-mobile-capacitor`.
- Flutter mobile roots `MUST` follow `FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC.md`. Flutter mobile packages use lower snake case names such as `sdkwork_<product>_flutter_mobile_<capability>`.
- Mini program roots `MUST` follow `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md`, then `APP_MINI_PROGRAM_UI_SPEC.md` for package-local UI/service/state/route rules. SDKWork packages define source/dependency boundaries; platform `pages` and `subpackages` are runtime projections.
- Native Android mobile roots `MUST` follow `ANDROID_APP_MOBILE_ARCHITECTURE_SPEC.md`, then `APP_ANDROID_NATIVE_UI_SPEC.md` for package-local UI/service/state/route rules. Android packages use `sdkwork-<product>-android-mobile-*`; Kotlin namespaces must preserve the SDKWork package identity through legal Android identifiers.
- Native iOS mobile roots `MUST` follow `IOS_APP_MOBILE_ARCHITECTURE_SPEC.md`, then `APP_IOS_NATIVE_UI_SPEC.md` for package-local UI/service/state/route rules. iOS packages use `sdkwork-<product>-ios-mobile-*`; Swift targets/modules must preserve the SDKWork package identity through legal Swift identifiers.
- Native HarmonyOS mobile roots `MUST` follow `HARMONY_APP_MOBILE_ARCHITECTURE_SPEC.md`, then `APP_HARMONY_NATIVE_UI_SPEC.md` for package-local UI/service/state/route rules. Harmony packages use `sdkwork-<product>-harmony-mobile-*`; ohpm/ArkTS module identifiers must preserve the SDKWork package identity.
- Backend/admin UI must be split by business domain and permission prefix. It must not be placed into one catch-all backend package.
- Shared cross-architecture logic must be extracted into contract, service, i18n, token, or generated SDK packages that have no UI runtime dependency.

## 1. Architecture Principle

Applications are assembled from stable capability modules.

```text
app shell
  -> route/layout/bootstrap
  -> feature UI package
  -> service/facade package
  -> generated SDK client
  -> appbase IAM runtime and dependency SDKs
  -> app-api/backend-api/open-api/local-api
```

Rules:

- App shells `MUST` stay thin: routing, layout, providers, bootstrap, native host binding, environment selection.
- PC app shells `MUST` follow `APP_PC_ARCHITECTURE_SPEC.md` for root layout, `packages/` taxonomy, app/console/admin route ownership, and browser/desktop renderer reuse.
- H5 mobile, Flutter mobile, mini program, native Android, native iOS, and native HarmonyOS app shells `MUST` follow `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md` and their root architecture standards for package taxonomy, route identity, host adapters, and renderer/platform packaging boundaries.
- Rust-enabled independent app shells `MUST` compose `sdkwork-appbase` Rust runtime crates and appbase generated SDK clients before product-owned domain modules so login/session/context/bootstrap behavior stays shared.
- App shells `MUST` follow `APP_SDK_INTEGRATION_SPEC.md` when wiring generated SDK clients, dependency SDKs, appbase IAM runtime, API key providers, host adapters, and global token/session state.
- Product apps `MUST` compose other applications and reusable capabilities through generated SDK packages, declared `sdkDependencies`, component specs, package root exports, service ports, or approved composed facades.
- Product apps `MUST NOT` copy another app's private `src` files, generated SDK output, DTO shims, route constants, auth UI, token stores, or appbase-owned API routes.
- Web backend application shells `MUST` compose Rust route crates, Java controllers, authority OpenAPI materialization, and generated SDK families through `API_SPEC.md`, `WEB_BACKEND_SPEC.md`, and the SDK standards. They `MUST NOT` let UI packages or service facades depend directly on route crate internals.
- Shared business behavior `MUST` live in reusable packages, not app-local pages.
- UI packages `MUST NOT` build raw HTTP requests or auth headers.
- Services `MUST` receive SDK clients by dependency injection.
- SDK clients may differ by app, package, or environment, but service method shape must stay stable.
- Login, registration, current session, refresh, logout, verification, OAuth, QR auth, password reset, runtime metadata, current-user self-service, and appbase IAM management `MUST` use `sdkwork-appbase` packages and generated appbase SDKs according to `APP_SDK_INTEGRATION_SPEC.md` and `IAM_LOGIN_INTEGRATION_SPEC.md`.
- Reusable module contracts `MUST` follow `MODULE_SPEC.md`.
- Frontend implementation `MUST` follow `FRONTEND_SPEC.md`.
- Runtime config and SDK client construction `MUST` follow `CONFIG_SPEC.md`.

### 1.0 App SDK Composition

Different app architectures share capabilities through SDKs and service ports, not through UI/runtime imports.

| Runtime or architecture | Generated SDK family | IAM/session dependency |
| --- | --- | --- |
| PC React app | TypeScript app SDKs and appbase PC wrappers | appbase IAM runtime and one global TokenManager |
| Mobile React app | TypeScript app SDKs and mobile host adapters | appbase IAM runtime or approved mobile IAM adapter with one global TokenManager |
| Flutter app | Dart/Flutter app SDKs and platform adapters | generated Dart/Flutter appbase SDK or approved appbase Flutter wrapper |
| Mini program app | TypeScript app SDKs adapted for mini program runtime and mini program host adapters | appbase mini program wrapper or approved appbase IAM runtime adapter with one global TokenManager equivalent |
| Android native app | Kotlin/Java app SDKs and Android host adapters | generated Kotlin/Java appbase SDK or approved appbase Android wrapper with one global token-manager equivalent |
| iOS native app | Swift app SDKs and iOS host adapters | generated Swift appbase SDK or approved appbase iOS wrapper with one global token-manager equivalent |
| Harmony native app | ArkTS/TypeScript app SDKs adapted for Harmony runtime and HarmonyOS host adapters | appbase Harmony wrapper or approved appbase ArkTS adapter with one global token-manager equivalent |
| Desktop/Tauri renderer | TypeScript app SDKs injected by renderer bootstrap | appbase IAM runtime; native storage only through host adapters |
| Rust local/private backend | Rust SDKs, route crates, service traits | appbase Rust context/auth/bootstrap crates and generated appbase SDKs when calling appbase APIs |
| Backend/admin React | TypeScript backend SDKs | appbase backend SDK for IAM administration, no app login session creation |

Rules:

- Architecture-specific UI packages `MUST` use the generated SDK language that matches the architecture.
- A React package `MUST NOT` import Flutter, Android, iOS, or Harmony SDK/UI implementations; Flutter packages `MUST NOT` import TypeScript React wrappers; native Android/iOS/Harmony packages `MUST NOT` import another client architecture's UI/runtime wrappers.
- Rust services `MUST NOT` embed frontend SDK wrappers. Rust code that calls HTTP APIs directly uses Rust SDKs or approved Rust service clients.
- App-api/backend-api SDK clients `MUST` share the authenticated TokenManager created by the application runtime. Protected open-api SDK clients use their declared API key provider unless the contract explicitly declares a different mode.
- Independent `apps/` repositories with Rust, Tauri, native runtime, or local/private backend capability `MUST` declare `sdkwork-appbase` before publishing product-owned SDK families.

### 1.1 Web Backend API Composition

Web backend development uses a three-layer API model:

```text
Rust route crate or Java controller module
  -> aggregated API authority OpenAPI
  -> generated SDK family
  -> service facade and UI/backend-admin integration
```

Rust route crate examples:

```text
sdkwork-routes-product-app-api
sdkwork-routes-cart-app-api
sdkwork-routes-order-backend-api
```

Aggregated authority and SDK examples:

```text
sdkwork-routes-product-app-api
sdkwork-routes-cart-app-api
sdkwork-routes-order-app-api
  -> sdkwork-commerce-app-api
  -> sdkwork-commerce-app-sdk
```

Rules:

- Rust route crates that define SDKWork HTTP routes `MUST` follow `API_SPEC.md` and be named `sdkwork-routes-<capability>-open-api`, `sdkwork-routes-<capability>-app-api`, or `sdkwork-routes-<capability>-backend-api`.
- Web backend implementation layers, including controller/router, handler, service/use-case, repository, provider adapter, request context, and route materialization boundaries, `MUST` follow `WEB_BACKEND_SPEC.md`.
- Route crates own route/path configuration for one capability and one API surface. They do not own SDK package names, generated SDK output, frontend service ports, or final OpenAPI authority names.
- The application or backend shell owns route aggregation. It combines same-surface, same-owner route manifests into the project/domain authority such as `sdkwork-commerce-app-api` or `sdkwork-commerce-backend-api`.
- Product applications consume generated SDK families such as `sdkwork-commerce-app-sdk` and `sdkwork-commerce-backend-sdk`. UI and service modules `MUST NOT` import route crates or build requests from route constants.
- App-api is for application development and user-facing app clients through app SDKs. Backend-api is for backend/admin and operator clients through backend SDKs. Open-api is for external/public integration through open-api/domain SDKs.
- Route aggregation `MUST` subtract dependency-owned routes before SDK generation. Appbase, Drive, provider, and other dependency-owned routes remain dependency SDKs or approved composed wrappers.
- Route crate capability names should be small business units such as product, cart, order, payment, catalog, shipment, wallet, tenant, report, or audit. Aggregated authorities use the broader project/domain such as commerce.

## 2. Module Taxonomy

| Layer | Responsibility | Example |
| --- | --- | --- |
| `foundation` | Shell, router, command palette, search, workspace primitives | `sdkwork-router-pc-react` |
| `host` | Tauri/browser/mobile/native host boundaries | `sdkwork-host-tauri-pc-react` |
| `iam` | Tenant, organization, user, auth, permissions, security settings | `sdkwork-iam-core-pc-react` |
| `system` | Settings, notifications, docs, dashboard, support | `sdkwork-settings-pc-react` |
| `communication` | IM, contacts, channels, social, notifications | `sdkwork-im-pc-react` |
| `intelligence` | AI models, agents, prompts, tools, workflows | `sdkwork-agent-pc-react` |
| `drive` | Drive spaces, nodes, upload/download, file picker, storage-backed resource selection | `sdkwork-drive-pc-react` |
| `content` | Documents, assets, media publishing, editor workflows built on Drive-backed files | `sdkwork-content-pc-react` |
| `commerce` | Billing, wallet, payment, subscription, entitlement | `sdkwork-billing-pc-react` |
| `device` | Install, distribution, device bridge, local runtime | `sdkwork-device-pc-react` |
| `ecosystem` | Plugin, marketplace, app store | `sdkwork-plugin-pc-react` |

Rules:

- API and database domain names `MUST` use canonical domain names such as `iam`, not vague names such as `identity`.
- Canonical domain ownership and naming `MUST` follow `DOMAIN_SPEC.md`.
- Existing package grouping names may remain during migration, but new standard contracts must use canonical domains.
- Each package `MUST` have one clear capability and one public root export.
- Cross-package imports `MUST` use package root exports, not package-internal `src` paths.
- Shared modules `SHOULD` be framework-specific only where UI/runtime requires it; pure contracts should be framework-neutral when practical.

## 3. Package Shape

Recommended frontend package structure:

```text
packages/<architecture>/<domain>/<package>/
  package.json
  README.md
  src/
    index.ts
    services/
    types/
    components/
    pages/
    hooks/
  tests/
```

Rules:

- `src/index.ts` `MUST` be the public API.
- Business services `SHOULD` be in `src/services`.
- DTOs should come from generated SDKs or shared contract packages, not local copies.
- Package README `MUST` document capability, dependencies, integration inputs, and verification command.
- Host/native code `MUST` stay in host packages or native subdirectories.

## 4. Composition Inputs

Reusable modules `MUST` accept explicit inputs.

```ts
export interface AppModuleRuntime<TAppClient, TBackendClient> {
  appClient: TAppClient;
  backendClient?: TBackendClient;
  environment: "development" | "test" | "staging" | "production";
  deploymentMode: "saas" | "private" | "local";
}
```

Rules:

- No shared module may hard-code a SaaS base URL, local port, tenant ID, token, or generated SDK package.
- Environment differences belong in bootstrap/config.
- Runtime inputs `SHOULD` be serializable where they cross host/native boundaries.
- Feature flags `SHOULD` be capability-scoped.

## 5. Frontend Boundaries

| Boundary | Allowed | Forbidden |
| --- | --- | --- |
| UI | render, form state, accessibility, local view state | direct SDK transport, token parsing |
| Service | SDK calls, validation mapping, cache invalidation, orchestration | raw HTTP, hidden global client |
| SDK | typed API transport | product UI decisions |
| Host | native filesystem/process/window/device access | business authorization |

Rules:

- UI modules may call services, not raw SDK clients, when reusable business behavior exists.
- Services may expose domain-friendly methods but should preserve generated SDK semantics.
- Host adapters must not become business service layers.

## 6. Acceptance Checklist

- [ ] Module has one domain and one capability.
- [ ] Application root has `.sdkwork/skills/` and `.sdkwork/plugins/` according to `SDKWORK_WORKSPACE_SPEC.md`.
- [ ] Domain name is registered or accepted by `DOMAIN_SPEC.md`.
- [ ] Public exports are stable and documented.
- [ ] Reusable module contract follows `MODULE_SPEC.md`.
- [ ] The correct architecture-specific UI standard is selected when the module has UI.
- [ ] UI-service-SDK layering is respected.
- [ ] SDK clients are injected at initialization.
- [ ] Runtime config and SDK construction follow `CONFIG_SPEC.md`.
- [ ] No raw HTTP or manual auth headers in business UI modules.
- [ ] SaaS/private/local differences are isolated in bootstrap.
- [ ] Tests cover service contract and module integration.
