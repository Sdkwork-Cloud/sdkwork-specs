# App Client Architecture Alignment Standard

- Version: 1.0
- Scope: cross-client application architecture alignment for SDKWork PC, H5/mobile React, Flutter, mini program, native Android, native iOS, native HarmonyOS, backend/admin UI, and future client roots
- Related: `APPLICATION_SPEC.md`, `NAMING_SPEC.md`, `APP_MANIFEST_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, `APP_PC_ARCHITECTURE_SPEC.md`, `H5_APP_MOBILE_ARCHITECTURE_SPEC.md`, `FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC.md`, `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md`, `ANDROID_APP_MOBILE_ARCHITECTURE_SPEC.md`, `IOS_APP_MOBILE_ARCHITECTURE_SPEC.md`, `HARMONY_APP_MOBILE_ARCHITECTURE_SPEC.md`, `MODULE_SPEC.md`, `COMPONENT_SPEC.md`, `FRONTEND_SPEC.md`, `UI_ARCHITECTURE_SPEC.md`, `APP_PC_REACT_UI_SPEC.md`, `APP_MOBILE_REACT_UI_SPEC.md`, `APP_FLUTTER_UI_SPEC.md`, `APP_MINI_PROGRAM_UI_SPEC.md`, `APP_ANDROID_NATIVE_UI_SPEC.md`, `APP_IOS_NATIVE_UI_SPEC.md`, `APP_HARMONY_NATIVE_UI_SPEC.md`, `BACKEND_UI_SPEC.md`, `CONFIG_SPEC.md`, `ENVIRONMENT_SPEC.md`, `I18N_SPEC.md`, `SECURITY_SPEC.md`, `TEST_SPEC.md`

This standard defines the common client architecture contract that keeps SDKWork application roots readable, composable, and aligned across PC, H5/Capacitor, Flutter, mini program, native Android, native iOS, native HarmonyOS, and future client surfaces.

Architecture-specific standards own technology details. This file owns the shared structure: package taxonomy, dependency direction, route identity, component boundaries, SDK/IAM/runtime composition, and verification rules. Client applications should feel like different implementations of one system, not unrelated projects with different vocabulary.

## 1. Core Model

All SDKWork client application roots are composition roots.

```text
client application root
  -> thin app entry and bootstrap
  -> aligned package families under packages/
  -> generated SDK clients and appbase IAM runtime from bootstrap/core
  -> route contributions from capability packages
  -> UI/service/state/i18n/host boundaries inside capability packages
  -> platform host adapters for native or platform-only capabilities
```

Rules:

- Client roots `MUST` keep app entry code thin: bootstrap, providers, route assembly, shell registration, AuthGate wiring, environment selection, SDK client construction, IAM runtime wiring, and host adapter registration.
- Business screens, pages, widgets, services, route contributions, i18n, state, and workflow-specific components `MUST` live in capability packages.
- Every client architecture `MUST` use a package family that separates `core`, `commons`, `shell`, capability packages, optional `console`, optional `admin`, and `host`.
- Cross-architecture reuse `MUST` happen through generated SDKs, contracts, service ports, route metadata, i18n keys, design tokens, host adapter contracts, and test fixtures.
- Client packages from different UI technologies `MUST NOT` import each other's UI implementations, routes, host implementations, platform generated code, or private `src/` internals.
- App-api/backend-api/open-api SDK construction and credential wiring belong in bootstrap/core. Feature packages receive SDK clients, service ports, providers, or adapters by injection.
- Appbase IAM login/session behavior and the global TokenManager follow `APP_SDK_INTEGRATION_SPEC.md` and `IAM_LOGIN_INTEGRATION_SPEC.md`.

## 2. Aligned Root Families

SDKWork client roots use stable architecture identifiers.

| Client architecture | Application root | Package segment | Root standard |
| --- | --- | --- | --- |
| PC browser/desktop/large-screen tablet | `apps/<product>-pc` | `pc` | `APP_PC_ARCHITECTURE_SPEC.md` |
| H5 mobile plus Capacitor iOS/Android | `apps/<product>-h5-mobile` | `h5-mobile` | `H5_APP_MOBILE_ARCHITECTURE_SPEC.md` |
| Flutter mobile app | `apps/<product>-flutter-mobile` | `flutter-mobile` root segment; `flutter_mobile` Dart package segment | `FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC.md` |
| Mini program | `apps/<product>-mini-program` | `mp` unless a platform-specific profile is approved | `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` |
| Native Android mobile app | `apps/<product>-android-mobile` | `android-mobile` | `ANDROID_APP_MOBILE_ARCHITECTURE_SPEC.md` |
| Native iOS mobile app | `apps/<product>-ios-mobile` | `ios-mobile` | `IOS_APP_MOBILE_ARCHITECTURE_SPEC.md` |
| Native HarmonyOS mobile app | `apps/<product>-harmony-mobile` | `harmony-mobile` | `HARMONY_APP_MOBILE_ARCHITECTURE_SPEC.md` |

Rules:

- New application roots `MUST` use the root naming in this table unless `GOVERNANCE_SPEC.md` records an exception.
- The package segment `MUST` appear in every app-root package name owned by that architecture.
- Architecture standards may define language-specific package naming, such as lower snake case for Dart packages.
- A product may support multiple client roots, but each client root must keep its own bootstrap, shell, package family, host adapters, config templates, and verification.

## 3. Standard Client Root Shape

Every client root should align to this logical structure. Architecture standards may rename entry files to match the language, but responsibilities must remain equivalent.

```text
apps/<product>-<client-arch>/
  AGENTS.md
  sdkwork.app.config.json
  .sdkwork/
    README.md
    skills/
      README.md
    plugins/
      README.md
  config/
    browser/ or app/
    host/
    server/
    container/
  docs/
  public/
  scripts/
  sdks/
  specs/
  src/ or lib/
    main.*
    App.* or app.*
    AuthGate.* or auth_gate.*
    bootstrap/
      environment.*
      runtime.*
      sdkClients.* or sdk_clients.*
      iamRuntime.* or iam_runtime.*
      hostAdapters.* or host_adapters.*
      routes.*
    providers/
    shell/
    routes/
  packages/
    sdkwork-<product>-<arch>-core/
    sdkwork-<product>-<arch>-commons/
    sdkwork-<product>-<arch>-shell/
    sdkwork-<product>-<arch>-<capability>/
    sdkwork-<product>-<arch>-console-core/
    sdkwork-<product>-<arch>-console-shell/
    sdkwork-<product>-<arch>-console-<capability>/
    sdkwork-<product>-<arch>-admin-core/
    sdkwork-<product>-<arch>-admin-shell/
    sdkwork-<product>-<arch>-admin-<capability>/
    sdkwork-<product>-<arch>-host/
  tests/ or test/
```

Rules:

- `config/browser/` owns browser-visible public runtime config. H5 mobile roots use this because H5 is a browser runtime.
- `config/app/` is allowed for non-browser app runtime public templates where the architecture standard defines it, such as Flutter, native Android, native iOS, and native HarmonyOS.
- `config/host/` owns native, platform, or container-host packaging metadata and permission references. It is not a business runtime config store.
- `src/bootstrap/` or `lib/bootstrap/` is the concrete composition boundary.
- `packages/` owns reusable runtime, shell, surface, capability, and host packages.
- Flutter roots use the same logical package roles, but their physical Dart package names use lower snake case such as `sdkwork_<product>_flutter_mobile_core`.
- Native Android, iOS, and HarmonyOS roots use the same logical package roles with kebab-case SDKWork package directories. Language/toolchain module identifiers may use Kotlin dotted namespaces, Swift PascalCase modules, or ArkTS/ohpm aliases only when they preserve the SDKWork package identity.
- `tests/` or `test/` owns application-level architecture, config, route, package-boundary, and release verification.

## 4. Package Taxonomy

All client roots use the same package roles.

| Package role | Owns | Must not own |
| --- | --- | --- |
| `core` | runtime config types, SDK client factories, TokenManager binding, appbase IAM runtime, session/context stores, route registry, service registry, host adapter contracts | screens, pages, widgets, business workflows, concrete feature state |
| `commons` | domain-neutral UI primitives, design-system adapters, layout helpers, formatters, empty/error/retry primitives, i18n helpers | domain screens, domain services, SDK construction |
| `shell` | app surface shell, navigation container, AuthGate integration, route contribution assembly, app layout, tab/stack/sidebar ownership | business SDK orchestration, reusable business workflows |
| `<capability>` | one domain capability: screens/pages/widgets/components, hooks/controllers, services, state, i18n, routes/navigation metadata, local view models | concrete SDK construction, unrelated capability behavior, backend/admin-only workflows |
| `console-core` | user-facing console runtime helpers, console SDK providers, permission hints, console context | app shell, internal admin SDK resources |
| `console-shell` | user-facing console navigation and route composition | internal admin navigation, backend-only operation center behavior |
| `console-<capability>` | tenant/customer/app-owner management workflows through app-api or approved console-facing app SDK surfaces | company-internal admin behavior |
| `admin-core` | internal operator runtime helpers, backend SDK providers, audit/permission helpers | user login UI, app-api session creation |
| `admin-shell` | internal operator navigation and route composition | app or console navigation |
| `admin-<capability>` | internal staff/operator workflows through backend-api | app user workflows, app SDK login/session creation |
| `host` | typed platform/native adapters and platform config integration | remote business authorization, SDK transport, generated SDK edits |

Rules:

- Capability packages `MUST` have one primary domain and one capability.
- Small features may keep UI, services, state, routes, and i18n in one package, but the internal folders and public exports must keep the boundaries visible.
- Capability package i18n resources `MUST` follow `I18N_SPEC.md`: split by locale, domain, capability, and route/screen/state fragment; package or app-level aggregators are thin exports or generated bundles only.
- Shared business behavior across capabilities should use a new explicit domain/capability package or a service/contract package, not a catch-all `commons` package.
- `core`, `commons`, and `shell` package names are reserved for infrastructure and must not own business pages or business services.
- Console and admin package families are optional. They should be created only when the product has that surface.
- Mobile admin packages require explicit product approval and `backend-admin` surface classification because they expose internal operator behavior on portable devices.

## 5. Dependency Direction

Allowed dependency direction:

```text
core, commons
  -> shell, console-core, admin-core
  -> console-shell, admin-shell
  -> capability, console-capability, admin-capability packages
  -> root bootstrap/composition
  -> host package implementations
```

Rules:

- `core` and `commons` `MUST NOT` depend on capability packages.
- Capability packages may depend on `core` public contracts, `commons`, generated SDK ports, appbase wrappers, approved shared contracts, and local host adapter contracts.
- Shell packages compose route contributions and layout. They `MUST NOT` own business services.
- Services call injected SDK clients or SDK ports. UI calls services, hooks, controllers, or view models.
- Host packages implement platform capabilities behind interfaces. They `MUST NOT` call app-api/backend-api for business workflows.
- Cross-package imports `MUST` use package root exports, not private source paths.
- Cyclic dependencies are forbidden.

## 6. Component And Module Contract

Every authored package is a component governed by `COMPONENT_SPEC.md` and a module governed by `MODULE_SPEC.md`.

Recommended public exports for a capability package:

```text
create<Capability>Services
<capability>RouteContributions
<Capability>FeatureProvider or architecture equivalent
<capability>I18nMessages
<Capability>Service
<Capability>Runtime
<Capability>RouteParams
<Capability>ViewModel
```

Rules:

- Package root exports should expose integration contracts and composition helpers, not internal page/widget files.
- UI components/widgets/pages stay private unless the package intentionally exposes a reusable visual primitive.
- Services receive explicit runtime inputs: SDK ports, config, host adapters, feature flags, and shared services.
- View models are package-local unless they are declared as public integration contracts.
- App-specific visual identity may be passed through design tokens or theme adapters. Shared packages must not import product app shells.

## 7. Route Identity And Navigation Alignment

SDKWork client routes are aligned by route identity, not by identical physical paths.

Canonical route id format:

```text
<surface>.<domain>.<capability>.<screen>
```

Examples:

```text
app.iam.login.index
app.commerce.orders.list
app.commerce.orders.detail
console.system.settings.index
admin.audit.events.list
```

Standard route contribution shape:

```ts
export interface SdkworkUiRouteContribution {
  id: string;
  surface: "app" | "console" | "admin";
  domain: string;
  capability: string;
  screen: string;
  path?: string;
  titleKey: string;
  auth: "public" | "required";
  permissionHint?: string;
  params?: Array<{ name: string; required: boolean }>;
  presentation?: {
    pc?: "page" | "drawer" | "dialog";
    h5Mobile?: "stack" | "tab" | "modal" | "sheet";
    flutterMobile?: "route" | "tab" | "bottomSheet";
    miniProgram?: "page" | "subpackagePage";
    androidNative?: "route" | "tab" | "dialog" | "bottomSheet";
    iosNative?: "route" | "tab" | "sheet" | "fullScreenCover";
    harmonyNative?: "page" | "tab" | "dialog" | "sheet";
  };
}
```

Rules:

- Route `id`, `surface`, `domain`, `capability`, `screen`, `titleKey`, and `permissionHint` should be consistent across PC, H5, Flutter, mini program, Android, iOS, and Harmony implementations of the same product workflow.
- Physical paths may differ by platform. For example, PC may use `/app/orders/:orderId`, H5 may use `/orders/:orderId`, Flutter may use a named route, mini program may use a subpackage page path, Android may use a navigation destination, iOS may use a navigation route, and Harmony may use a page path.
- Route metadata `MUST NOT` declare HTTP API paths, SDK methods, raw URL constants, or transport details.
- Route guards are shell/runtime responsibilities. Capability packages declare auth and permission hints only.
- Deep links should resolve to route ids first, then platform-specific navigation adapters map the route id to a physical path or route object.
- Mini program platform `pages` and `subpackages` should be generated or assembled from route contributions where tooling exists.

## 8. SDK, IAM, And Runtime Composition

Client roots share the SDK composition model from `APP_SDK_INTEGRATION_SPEC.md`.

Rules:

- Runtime/bootstrap constructs concrete SDK clients after typed runtime config is resolved.
- Authenticated app-api SDK clients and explicit `backend-admin` backend-api SDK clients share one global TokenManager or language-equivalent token manager per authenticated session context.
- Protected open-api SDK clients use declared API key credential providers and must not be added to app/backend token-manager lists unless the API contract explicitly declares that mode.
- Appbase IAM owns login, registration, current session, refresh, logout, OAuth, QR auth, password reset, runtime metadata, current-user self-service, and token propagation.
- Feature packages must not implement raw HTTP fallbacks for missing SDK methods. Missing methods are fixed in the owning API contract, generator input, and generated SDK family.
- Logout, refresh failure, tenant switch, and account switch must clear token/context stores, sensitive state, realtime/session bridges, and platform secure storage when present.

## 9. Host Adapter Boundary

Host adapters are local or platform capability boundaries.

Standard host adapter categories:

```text
windowOrNavigationHost
deepLinks
secureStorage
camera
qrScanner
pushNotifications
biometric
shareSheet
networkStatus
appLifecycle
clipboard
filePicker
filesystemSandbox
geolocation
deviceInfo
haptics
```

Rules:

- Host adapters expose typed methods and stable errors such as `unsupported`, `permission-denied`, `unavailable`, `cancelled`, and `invalid-state`.
- Feature packages depend on host adapter interfaces or injected services, not platform globals.
- Browser-only and platform-native modes must provide fallback adapters for unsupported capabilities.
- Host adapters may obtain platform facts such as push tokens or selected files, but business registration, upload, and binding workflows must call generated SDKs through services.
- Host adapters must not own login, token refresh, permission evaluation, business authorization, direct database access, or raw business API transport.

## 10. Config Alignment

All client roots separate lifecycle environment, profile alias, build mode, deployment mode, and runtime target.

Rules:

- Browser-visible public runtime config belongs in `config/browser/` or an architecture-approved equivalent and may contain only non-secret values.
- Host/platform config belongs in `config/host/` or the host package's platform config directory. It owns bundle ids, package ids, app ids, schemes, permissions, capabilities, associated domains/app links, signing references, and store profile references.
- Host/platform config `MUST NOT` contain signing private keys, auth tokens, refresh tokens, database credentials, API keys, SDK package ownership, or business route constants.
- Server/container config remains separate from client public runtime config.
- Release preflight must fail when production client config contains localhost endpoints, development secrets, test databases, writable developer paths, unresolved placeholders, or source-controlled secret files.

## 11. Verification

Required cross-client architecture checks:

| Verification | Evidence |
| --- | --- |
| Root layout | Static check proves the client root has `.sdkwork/`, config, bootstrap, packages, sdks, specs, scripts, and tests according to the architecture standard. |
| Package taxonomy | Static check proves package names use the architecture segment and reserved package roles correctly. |
| Dependency direction | Static scan proves core/commons do not depend on capability packages, capability packages do not deep import each other, and host packages do not own business API transport. |
| Route identity | Tests or static checks prove route ids follow `<surface>.<domain>.<capability>.<screen>` and route metadata avoids API paths. |
| Cross-architecture alignment | When multiple client roots implement the same workflow, route ids, title keys, permission hints, SDK surfaces, and i18n keys align. |
| SDK boundary | Static scan proves no raw HTTP, manual auth/API key headers, generated SDK edits, or architecture SDK mismatches were introduced. |
| IAM boundary | Tests prove appbase IAM runtime, global token manager, token/context persistence, logout clearing, refresh failure, tenant switch, and account switch behavior. |
| Host boundary | Static scan proves feature packages use host adapter contracts, not platform globals. |
| Config boundary | Tests prove public/private/secret config separation and target-specific profile validation. |
| Package build | Changed packages pass typecheck/analyze/build and focused tests for the selected architecture. |

Acceptance checklist:

- [ ] Client root selected one architecture standard and followed this alignment standard.
- [ ] Root entry code remains thin.
- [ ] Package names include the correct architecture segment.
- [ ] Packages are split into core, commons, shell, capability, optional console/admin, and host roles.
- [ ] Components and services are integrated through public exports, service ports, SDK clients, route contributions, i18n keys, and design tokens.
- [ ] Route identity is stable across client architectures where the same workflow exists.
- [ ] SDK/IAM/runtime/bootstrap boundaries follow `APP_SDK_INTEGRATION_SPEC.md`.
- [ ] Host adapters are typed and local-only.
- [ ] Config and release metadata do not leak secrets.
- [ ] Verification evidence is recorded before completion.
