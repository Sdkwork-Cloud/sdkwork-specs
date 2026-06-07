# H5 App Mobile Architecture Standard

- Version: 1.0
- Scope: SDKWork phone-first H5 applications, mobile browser applications, WeChat-H5 style browser runtimes, and Capacitor iOS/Android apps that wrap the same H5 mobile renderer
- Related: `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md`, `APPLICATION_SPEC.md`, `NAMING_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, `APP_MOBILE_REACT_UI_SPEC.md`, `FRONTEND_SPEC.md`, `UI_ARCHITECTURE_SPEC.md`, `MODULE_SPEC.md`, `COMPONENT_SPEC.md`, `SDK_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md`, `IAM_LOGIN_INTEGRATION_SPEC.md`, `CONFIG_SPEC.md`, `ENVIRONMENT_SPEC.md`, `APP_MANIFEST_SPEC.md`, `SECURITY_SPEC.md`, `PRIVACY_SPEC.md`, `TEST_SPEC.md`

This standard defines the application-root architecture for SDKWork H5/App mobile roots. H5 is the baseline runtime. Capacitor is an optional native host and release shape for iOS and Android. Both modes reuse the same mobile renderer, route contributions, generated TypeScript app SDK clients, appbase IAM runtime, and package taxonomy.

Use `APP_MOBILE_REACT_UI_SPEC.md` for detailed mobile React UI package rules. This file owns the H5/Capacitor application root, package taxonomy, config, host boundary, commands, release, and architecture verification.

## 1. Core Model

```text
H5 app mobile root
  -> one mobile H5 renderer
  -> H5 browser runtime
  -> optional Capacitor iOS/Android host
  -> generated TypeScript app SDKs
  -> appbase IAM runtime and one global TokenManager
  -> typed host adapters
  -> app, optional console, optional admin mobile package families
```

Rules:

- An H5 app mobile root `MUST` support H5 browser mode.
- Capacitor iOS and Android targets `MUST` reuse the same H5 renderer, route contributions, SDK clients, appbase IAM runtime, and global TokenManager.
- The root `src/` `MUST` stay thin: bootstrap, providers, AuthGate, route assembly, shell registration, runtime config selection, SDK client construction, IAM runtime wiring, and host adapter registration.
- Business screens, components, hooks, services, state, i18n, and navigation metadata `MUST` live in packages.
- Capacitor host code `MUST NOT` own business authentication, business authorization, remote business API calls, SDK construction, generated SDK output, or business state machines.
- H5 mode `MUST` degrade gracefully when native host adapters are unavailable.
- Appbase IAM and generated app SDK integration follow `APP_SDK_INTEGRATION_SPEC.md` and `IAM_LOGIN_INTEGRATION_SPEC.md`.

## 2. Standard Root Layout

```text
apps/<product>-h5-mobile/
  AGENTS.md
  sdkwork.app.config.json
  .sdkwork/
    README.md
    skills/
      README.md
    plugins/
      README.md
  config/
    browser/
      runtime-env.development.example.json
      runtime-env.test.example.json
      runtime-env.staging.example.json
      runtime-env.production.example.json
    host/
      capacitor.development.example.json
      capacitor.test.example.json
      capacitor.staging.example.json
      capacitor.production.example.json
    server/
      <product>.development.toml.example
      <product>.test.toml.example
      <product>.staging.toml.example
      <product>.production.toml.example
    container/
      <product>.development.toml.example
      <product>.test.toml.example
      <product>.staging.toml.example
      <product>.production.toml.example
  docs/
  public/
  scripts/
  sdks/
  specs/
  src/
    main.tsx
    App.tsx
    AuthGate.tsx
    index.css
    bootstrap/
      environment.ts
      runtime.ts
      sdkClients.ts
      iamRuntime.ts
      hostAdapters.ts
      routes.ts
    providers/
    shell/
    routes/
  packages/
    sdkwork-<product>-h5-mobile-core/
    sdkwork-<product>-h5-mobile-commons/
    sdkwork-<product>-h5-mobile-shell/
    sdkwork-<product>-h5-mobile-<capability>/
    sdkwork-<product>-h5-mobile-console-core/
    sdkwork-<product>-h5-mobile-console-shell/
    sdkwork-<product>-h5-mobile-console-<capability>/
    sdkwork-<product>-h5-mobile-admin-core/
    sdkwork-<product>-h5-mobile-admin-shell/
    sdkwork-<product>-h5-mobile-admin-<capability>/
    sdkwork-<product>-h5-mobile-capacitor/
      capacitor.config.ts
      src/
        host/
      ios/
      android/
  tests/
  index.html
  package.json
  pnpm-lock.yaml
  pnpm-workspace.yaml
  tsconfig.json
  vite.config.ts
```

Rules:

- The root name `apps/<product>-h5-mobile` and package segment `h5-mobile` are canonical for H5/Capacitor mobile roots.
- `config/browser/` owns public browser runtime config for H5. It is named `browser` to align with PC and other browser renderers.
- `config/host/` owns Capacitor platform templates and permission/signing reference metadata. It must not contain secrets.
- `packages/sdkwork-<product>-h5-mobile-capacitor` is the only package that may own Capacitor configuration, plugin implementation, generated native project directories, and platform-specific host implementations.
- Generated Capacitor `ios/` and `android/` directories must not contain product business logic or app SDK transport.
- `sdks/` follows `SDK_WORKSPACE_GENERATION_SPEC.md` and must not contain hand-edited generated output.

## 3. Package Taxonomy

| Package family | Surface | Owns | Must not own |
| --- | --- | --- | --- |
| `sdkwork-<product>-h5-mobile-core` | shared mobile runtime | SDK factories, TokenManager binding, appbase IAM runtime, session/context stores, runtime config, route registry, host adapter contracts | screens, business workflows |
| `sdkwork-<product>-h5-mobile-commons` | shared mobile UI/runtime | mobile UI primitives, safe-area helpers, mobile form/list primitives, design-system adapters, domain-neutral hooks | business screens, SDK construction |
| `sdkwork-<product>-h5-mobile-shell` | app/user shell | mobile navigation container, tab/stack/sheet layout, AuthGate wiring, app route assembly | console/admin routes, business services |
| `sdkwork-<product>-h5-mobile-<capability>` | app/user capability | screens, components, hooks, services, state, i18n, route contributions, view models | console/admin workflows, concrete SDK construction |
| `sdkwork-<product>-h5-mobile-console-*` | user-facing mobile console | tenant/customer/app-owner management workflows through app-api | internal operator workflows |
| `sdkwork-<product>-h5-mobile-admin-*` | internal mobile admin, approved only | internal operator workflows through backend-api | app login/session flows, user app workflows |
| `sdkwork-<product>-h5-mobile-capacitor` | native host | Capacitor config, plugins, permissions, iOS/Android package metadata, typed host implementations | business API calls, business authorization, SDK generation |

Rules:

- H5 mobile capability packages follow `APP_MOBILE_REACT_UI_SPEC.md` for screens, components, hooks, services, state, i18n, navigation, and host contracts.
- Admin package families for mobile roots require explicit product approval, `backend-admin` surface classification, and backend SDK boundary verification.
- Shared UI primitives belong in `h5-mobile-commons`. Shared runtime/session/SDK behavior belongs in `h5-mobile-core`.
- Capability names `MUST` be lower kebab-case and align with canonical domains or approved business capabilities.

## 4. Package Internal Shape

```text
packages/sdkwork-<product>-h5-mobile-<capability>/
  package.json
  README.md
  src/
    index.ts
    screens/
    components/
    hooks/
    services/
    state/
    i18n/
    routes/
    navigation/
    host/
    types/
  tests/
  specs/
```

Rules:

- `src/index.ts` is the only public export boundary.
- `screens/` owns route-level mobile UI.
- `routes/` and `navigation/` own route contributions, tab/stack/modal metadata, and deep-link mapping inputs.
- `services/` owns app SDK orchestration through injected SDK clients or service ports.
- `state/` owns view/cache state only and must clear sensitive state on logout, refresh failure, tenant switch, and account switch.
- `i18n/` owns package-local mobile locale fragments and thin aggregation exports. Authored whole-root or whole-package locale monoliths are forbidden by `I18N_SPEC.md`.
- `host/` owns host adapter contracts used by the package, not Capacitor plugin implementations.
- API DTOs come from generated SDKs or shared contract packages. Local `types/` contains view models and route params only.

## 5. Dependency Direction

Allowed flow:

```text
h5-mobile-core, h5-mobile-commons
  -> h5-mobile-shell, h5-mobile-console-core, h5-mobile-admin-core
  -> h5-mobile-console-shell, h5-mobile-admin-shell
  -> app/console/admin capability packages
  -> root src composition
  -> h5-mobile-capacitor host
```

Rules:

- Capability packages must not import each other's private source paths.
- Cross-capability composition uses public exports, generated SDKs, service ports, route ids, or approved composed facades.
- The Capacitor package depends on host adapter contracts and renderer build outputs. It must not depend on capability package internals.
- UI components call hooks/services. Services call injected SDK clients or ports. Bootstrap constructs concrete SDK clients.

## 6. H5 And Capacitor Runtime Matrix

| Target | Deployment mode | Runtime target | Required behavior |
| --- | --- | --- | --- |
| H5 browser | `h5` | `browser` | Same mobile renderer, public runtime config, no native dependency |
| WeChat H5 | `h5-weixin` | `browser` | Same SDK/IAM boundary with WeChat browser bridge behind host adapters |
| iOS app | `capacitor-ios` | `capacitor-ios` | Same renderer, iOS bundle id, universal links, push, secure storage, IPA/TestFlight/App Store workflow |
| Android app | `capacitor-android` | `capacitor-android` | Same renderer, Android package id, app links, push, secure storage, APK/AAB/Google Play or private distribution workflow |

Rules:

- Capacitor builds must use the H5 mobile renderer build output.
- Capacitor targets must not introduce app-only business screens, app-only SDK wrappers, copied auth stores, or divergent route ownership.
- H5 public runtime config must load before SDK clients are constructed.
- H5 browser fallback adapters must represent unavailable native capability with stable errors.
- iOS builds require macOS and Apple tooling. Android builds require Android SDK/JDK/Gradle tooling. CI and release runbooks must document runner requirements.

## 7. SDK And IAM Integration

Rules:

- App and mobile console packages `MUST` use generated TypeScript app SDK clients or approved appbase wrappers for `/app/v3/api`.
- Mobile admin packages, when approved as `backend-admin` surfaces, `MUST` use generated TypeScript backend SDK clients or approved backend wrappers for `/backend/v3/api`.
- Runtime/bootstrap `MUST` create one global TokenManager per authenticated session context and bind it to appbase app SDK, product/dependency app SDKs, explicit `backend-admin` appbase backend/product backend/dependency backend SDKs, Drive app SDK, IM app SDK, and other authenticated dependency SDKs.
- H5 token storage should prefer server-managed httpOnly cookie architectures when available. If browser session/local storage is used, the security risk and clearing behavior must be documented.
- Capacitor token/context storage must use secure storage host adapters where available.
- Secure storage adapters may persist appbase token/context state for the central runtime. They must not own login, refresh, permission checks, or business authorization.
- Verification-code delivery must use the generated messaging app SDK surface or an approved appbase wrapper that delegates to an injected messaging client.
- UI and services must not assemble auth headers, parse JWTs for authorization, call raw HTTP, or construct SDK clients.

## 8. Host Adapter Catalog

The Capacitor package implements host adapter interfaces defined by core or capability packages.

Standard adapters:

```text
camera
qrScanner
pushNotifications
deepLinks
secureStorage
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

- Feature packages depend on adapter interfaces, not Capacitor globals or plugin imports.
- The H5 runtime must provide fallback adapters for unsupported native capabilities.
- Adapter errors must be stable and user-safe.
- Push token registration with the backend is an app-api workflow. The host adapter only obtains or refreshes the platform token.
- File upload and media storage use Drive app SDK or approved Drive uploader facades. Host adapters may select files or capture media but must not create upload sessions, presign URLs, object keys, or provider SDK flows.
- Deep links must validate expected scheme, host, path, state, nonce, and expiry before completing sensitive flows.

## 9. Mobile Interaction Rules

Rules:

- H5 mobile UI is phone-first, touch-first, safe-area-aware, and usable at common phone widths.
- Navigation should use mobile stack, tab, sheet, modal, and drawer patterns rather than dense desktop tables or hover-only workflows.
- Lists must cover loading, empty, error, retry, pagination or bounded infinite loading, and refresh behavior when appropriate.
- Forms must use mobile-friendly input types, validation messages, keyboard avoidance, and duplicate-submit protection.
- OAuth, QR login, password reset, verification-code, push permission, and deep-link flows must survive background/foreground transitions where the host supports them.
- Text must fit compact containers without viewport-scaled font hacks or overlap.
- Offline behavior is allowed for view/cache state by default. Mutating offline queues require explicit service design, conflict handling, and tests.

## 10. Config And Manifest

Rules:

- `runtime.family` in `sdkwork.app.config.json` should be `mobile` for H5/Capacitor mobile applications.
- `runtime.framework` should be `react-capacitor` when Capacitor targets exist and `react-h5` or a more specific value when H5-only.
- `publish.platforms` should include actual supported platforms such as `H5`, `H5_WEIXIN`, `APP_IOS`, and `APP_ANDROID`.
- `artifacts.installConfig.packages[]` must describe H5 URL packages, App Store/TestFlight or IPA entries, Google Play/private store or APK/AAB entries, and release package ids.
- `app.identifiers.bundleId` owns iOS bundle identity. `app.identifiers.packageName` owns Android application id.
- Production manifests must declare governed icons, screenshots, previews, checksums, signing metadata, SBOM/provenance references, and release notes according to `APP_MANIFEST_SPEC.md`.
- Store screenshots must show the actual mobile app, not desktop screenshots or marketing-only banners.

## 11. Standard Commands

Every H5 app mobile root should provide:

```text
pnpm install
pnpm dev
pnpm h5:dev
pnpm h5:build
pnpm h5:build:staging
pnpm h5:build:prod
pnpm h5:preview
pnpm build
pnpm build:staging
pnpm build:prod
pnpm typecheck
pnpm lint
pnpm test
pnpm test:config
```

Capacitor-enabled roots should also provide:

```text
pnpm cap:sync
pnpm cap:copy
pnpm cap:ios:dev
pnpm cap:ios:open
pnpm cap:ios:build
pnpm cap:ios:build:prod
pnpm cap:android:dev
pnpm cap:android:open
pnpm cap:android:build
pnpm cap:android:build:prod
```

Rules:

- `pnpm dev` starts the H5 mobile renderer by default.
- `cap:*` commands must run the required H5 build or sync preflight and use the same renderer output.
- `h5:build:prod`, `cap:ios:build:prod`, and `cap:android:build:prod` must run release preflight for public runtime config, Capacitor host config, manifest, media, signing references, package metadata, and secret absence.
- Package filters should be stable and use package root names.

## 12. Verification

Required verification for H5 app mobile architecture changes:

| Verification | Evidence |
| --- | --- |
| Root layout | Static check proves `.sdkwork/`, `config/browser`, `config/host`, `src/bootstrap`, `packages/`, `sdks/`, `scripts/`, and tests exist for application roots. |
| Package naming | Static check proves new packages use `sdkwork-<product>-h5-mobile-*`, including reserved console/admin/host forms. |
| Renderer sharing | Tests or static checks prove H5, iOS, and Android targets reuse the same renderer, route contributions, SDK clients, IAM runtime, and TokenManager. |
| SDK boundary | Static scan proves app/console packages use app SDKs, approved `backend-admin` packages use backend SDKs, and no raw HTTP/manual auth headers/generated SDK edits were introduced. |
| IAM clearing | Tests prove logout, refresh failure, tenant switch, and account switch clear browser storage, secure storage, token manager, context store, caches, realtime/session bridges, and sensitive state. |
| Host boundary | Static scan proves feature packages do not import Capacitor plugins or platform globals directly. |
| Deep link security | Tests prove scheme, host, path, state, nonce, expiry, and unsafe-link rejection behavior. |
| Push lifecycle | Tests cover permission denied, token registration, token refresh, logout unregister/clear, and foreground/background handling. |
| Config boundary | Tests prove browser public runtime config and host/platform config contain no secrets and load before SDK construction. |
| Release preflight | Checks validate H5 URL, IPA/App Store metadata, APK/AAB/Google Play metadata, icons, screenshots, checksums, SBOM/provenance, and signing references. |

Acceptance checklist:

- [ ] H5 is the baseline runtime and Capacitor is a host/release shape.
- [ ] H5 and Capacitor targets share one mobile renderer and one SDK/IAM runtime model.
- [ ] Root `src/` remains thin.
- [ ] Packages use the `h5-mobile` segment and split core, commons, shell, capability, optional console/admin, and Capacitor host responsibilities.
- [ ] Route ids align with `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md`.
- [ ] SDK clients and appbase IAM runtime are created in bootstrap/core and injected.
- [ ] Native capabilities use typed host adapters with H5 fallbacks.
- [ ] Config and manifest release metadata are separated and secret-free.
- [ ] Verification evidence is recorded before completion.
