# Android App Mobile Architecture Standard

- Version: 1.0
- Scope: SDKWork native Android mobile application roots, Kotlin/Gradle package taxonomy, generated Kotlin/Java app SDK integration, Android host adapters, Play/private distribution metadata, and cross-client route alignment
- Related: `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md`, `APPLICATION_SPEC.md`, `NAMING_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, `APP_ANDROID_NATIVE_UI_SPEC.md`, `FRONTEND_SPEC.md`, `UI_ARCHITECTURE_SPEC.md`, `MODULE_SPEC.md`, `COMPONENT_SPEC.md`, `SDK_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md`, `IAM_LOGIN_INTEGRATION_SPEC.md`, `CONFIG_SPEC.md`, `ENVIRONMENT_SPEC.md`, `APP_MANIFEST_SPEC.md`, `SECURITY_SPEC.md`, `PRIVACY_SPEC.md`, `TEST_SPEC.md`

This standard defines the application-root architecture for SDKWork native Android mobile apps. Android roots follow the same client architecture alignment model as PC, H5, Flutter, mini program, native iOS, and native HarmonyOS roots, but use Kotlin, Gradle/Android Gradle Plugin, Android app/library modules, generated Kotlin/Java SDK clients, Android host adapters, and Android build/release tooling.

Use `APP_ANDROID_NATIVE_UI_SPEC.md` for detailed Android UI package rules. This file owns the Android application root, package taxonomy, config, host/platform boundary, commands, release, and architecture verification.

## 1. Core Model

```text
Android native mobile root
  -> thin Android application module
  -> Gradle package families under packages/
  -> generated Kotlin/Java app SDKs
  -> appbase Android wrapper or generated appbase Kotlin/Java app SDK
  -> one global token-manager equivalent
  -> typed Android host adapters
  -> route contributions aligned by route id
```

Rules:

- An Android native mobile root `MUST` use Kotlin-first Android app and library modules for reusable runtime, shell, capability, and host boundaries.
- New Android UI should be Jetpack Compose-first. Android Views/XML are allowed for migration, system interoperability, or embedded platform widgets, but they must stay package-local and behind the same UI/service/host boundaries.
- The root Android `app/` module `MUST` stay thin: application class, main activity, bootstrap, provider assembly, route registry, SDK client construction, IAM runtime wiring, and host adapter registration.
- Business screens, composables/views, controllers/view models, services, repositories, state, i18n/resources, and navigation metadata `MUST` live in packages.
- Android packages `MUST` consume generated Kotlin/Java app SDK clients or approved Android appbase wrappers. They must not import TypeScript, React, Flutter, Swift, or ArkTS wrappers.
- Android framework APIs and Jetpack/Google Play Services capability calls `MUST` stay behind typed host adapters.
- Cross-client route identity follows `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md`.

## 2. Standard Root Layout

```text
apps/<product>-android-mobile/
  AGENTS.md
  sdkwork.app.config.json
  .sdkwork/
    README.md
    skills/
      README.md
    plugins/
      README.md
  config/
    app/
      runtime-env.development.example.json
      runtime-env.test.example.json
      runtime-env.staging.example.json
      runtime-env.production.example.json
    host/
      android.development.example.json
      android.test.example.json
      android.staging.example.json
      android.production.example.json
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
  scripts/
  sdks/
  specs/
  app/
    build.gradle.kts
    src/
      main/
        AndroidManifest.xml
        kotlin/
          com/sdkwork/<product>/android/mobile/
            MainApplication.kt
            MainActivity.kt
            bootstrap/
              Environment.kt
              Runtime.kt
              SdkClients.kt
              IamRuntime.kt
              HostAdapters.kt
              Routes.kt
            providers/
            shell/
            routes/
      androidTest/
      test/
  packages/
    sdkwork-<product>-android-mobile-core/
    sdkwork-<product>-android-mobile-commons/
    sdkwork-<product>-android-mobile-shell/
    sdkwork-<product>-android-mobile-<capability>/
    sdkwork-<product>-android-mobile-console-core/
    sdkwork-<product>-android-mobile-console-shell/
    sdkwork-<product>-android-mobile-console-<capability>/
    sdkwork-<product>-android-mobile-admin-core/
    sdkwork-<product>-android-mobile-admin-shell/
    sdkwork-<product>-android-mobile-admin-<capability>/
    sdkwork-<product>-android-mobile-host/
  tests/
  build.gradle.kts
  settings.gradle.kts
  gradle/
    libs.versions.toml
  gradlew
  gradlew.bat
```

Rules:

- The root name `apps/<product>-android-mobile` and package segment `android-mobile` are canonical for native Android phone roots.
- Package directories use SDKWork kebab-case names such as `sdkwork-<product>-android-mobile-orders`; Gradle module paths should preserve the package directory identity.
- Android namespaces and Kotlin packages cannot contain hyphens. They should use an approved lowercase dotted namespace such as `com.sdkwork.<product>.android.mobile.<capability>`, with `<product>` and `<capability>` normalized to legal identifiers.
- `config/app/` owns non-secret runtime templates consumed by Android bootstrap.
- `config/host/` owns Android package id, min/target SDK references, permission references, app links, push profile references, signing reference names, store profile references, and release metadata. It must not contain signing private keys or secrets.
- The root `app/` module is the installable Android application and composition module. It must not own product business workflows.
- `packages/` owns Android library modules for runtime, shell, surface, capability, and host packages.
- `sdks/` follows `SDK_WORKSPACE_GENERATION_SPEC.md` and must not contain hand-edited generated output.
- Android roots that publish app manifests use `runtime.family = "mobile"` and `runtime.framework = "android-native"`.

## 3. Package Taxonomy

| Package family | Owns | Must not own |
| --- | --- | --- |
| `sdkwork-<product>-android-mobile-core` | runtime config, SDK factories, token-manager equivalent, appbase IAM runtime/wrapper, session/context stores, route registry, host adapter contracts | screens, composables, business workflows |
| `sdkwork-<product>-android-mobile-commons` | domain-neutral Compose components/views, theme adapters, design tokens, form/list/error primitives, i18n/resource helpers | business screens, SDK construction |
| `sdkwork-<product>-android-mobile-shell` | app shell, navigation graph assembly, AuthGate integration, app route composition | business services |
| `sdkwork-<product>-android-mobile-<capability>` | screens, composables/views, view models/controllers, services, repositories, state, resources/i18n, route contributions, view models | concrete SDK construction, unrelated capabilities |
| `sdkwork-<product>-android-mobile-console-*` | approved user-facing mobile console workflows through app-api | internal operator workflows |
| `sdkwork-<product>-android-mobile-admin-*` | approved internal operator workflows through backend-api | app user login/session creation |
| `sdkwork-<product>-android-mobile-host` | Android platform adapters for camera, QR, secure storage, push, deep links, files, lifecycle, device features | business API transport, business authorization |

Rules:

- New Android packages `MUST` be split by domain/capability and must not become catch-all mobile business modules.
- Console and admin package families are optional. Mobile admin packages require explicit product approval, `backend-admin` surface classification, and backend SDK boundary verification.
- Shared UI primitives remain domain-neutral unless they live inside the owning capability package.
- Android packages may share route ids, i18n keys, design tokens, SDK port contracts, and service contracts with other client roots, but must not import another architecture's UI/runtime implementation.

## 4. Package Internal Shape

```text
packages/sdkwork-<product>-android-mobile-<capability>/
  build.gradle.kts
  README.md
  src/
    main/
      AndroidManifest.xml
      kotlin/
        com/sdkwork/<product>/android/mobile/<capability>/
          PublicApi.kt
          ui/
            screens/
            components/
          presentation/
            viewmodels/
            controllers/
          services/
          repositories/
          state/
          i18n/
          routes/
          navigation/
          host/
          models/
      res/
    test/
    androidTest/
  specs/
```

Rules:

- `PublicApi.kt` or an equivalent package root export file is the public integration boundary.
- `ui/screens/` owns route-level UI. `ui/components/` owns reusable or domain-specific UI components.
- `presentation/` owns view models, controllers, intents, effects, and UI state mapping.
- `services/` owns use-case orchestration and calls injected generated SDK clients, repositories, or service ports.
- `repositories/` may own thin generated SDK adapter calls when repository naming is used. It must not become a local persistence layer unless a local offline contract is explicitly approved.
- `i18n/` and Android resource files own package-local locale fragments. Platform monolithic resources must be generated or assembled from fragments and must not be hand-authored whole-root catalogs; follow `I18N_SPEC.md`.
- `models/` owns view models, screen models, and route params. API DTOs come from generated Kotlin/Java SDKs.
- `host/` owns host adapter interfaces used by the package, not Android framework implementations.

## 5. Dependency Direction

Allowed flow:

```text
android-mobile-core, android-mobile-commons
  -> android-mobile-shell, android-mobile-console-core, android-mobile-admin-core
  -> android-mobile-console-shell, android-mobile-admin-shell
  -> app/console/admin capability packages
  -> root app composition module
  -> android-mobile-host
```

Rules:

- Android UI must not construct SDK clients or read runtime env directly.
- View models/controllers call services. Services call injected generated SDK clients, repositories, or service ports.
- Android platform implementations live in the host package or root bootstrap, not in feature UI.
- Cross-package imports use public package/module exports, not another package's private source paths.
- Cyclic Gradle dependencies are forbidden.

## 6. SDK And IAM Integration

Rules:

- Android app packages `MUST` consume `/app/v3/api` through generated Kotlin/Java app SDK clients or approved Android appbase wrappers.
- Android admin packages, when approved as `backend-admin` surfaces, `MUST` consume `/backend/v3/api` through generated Kotlin/Java backend SDK clients or approved backend wrappers.
- Runtime/bootstrap `MUST` construct generated Kotlin/Java SDK clients, appbase SDK clients or wrappers, a global token-manager equivalent, token/context stores, and Android host adapters before feature services are initialized.
- The global token-manager equivalent must be shared by appbase app SDK, every authenticated product/dependency app-api SDK client, and explicit `backend-admin` appbase backend/product backend/dependency backend SDK clients.
- Missing Kotlin/Java SDK methods must be fixed in OpenAPI/generator inputs and regenerated. Android packages must not fill gaps with raw OkHttp/Retrofit calls, manual headers, copied TypeScript/Flutter wrappers, or local DTO forks.
- Logout and refresh failure must clear secure platform storage, token manager, context store, sensitive Android state, and realtime/session bridges.

## 7. Android Host Adapter Boundary

Standard Android host adapter categories:

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
permissions
intentBridge
```

Rules:

- Feature packages depend on host adapter interfaces, not Android framework APIs, Activity result launchers, Play Services clients, or SDK singleton globals.
- Host adapters must expose stable user-safe errors such as `unsupported`, `permission-denied`, `unavailable`, `cancelled`, and `invalid-state`.
- Deep-link callbacks must validate scheme, host, path, state, nonce, and expiry before completing sensitive flows.
- Push token registration is an app-api workflow. Host adapters only obtain platform token facts and permission state.
- File/media upload uses Drive app SDK or approved Drive uploader facades. Host adapters may pick files or capture media but do not own Drive/storage lifecycle.

## 8. Route Alignment

Rules:

- Android navigation routes `MUST` map to SDKWork route ids when the same workflow exists in PC, H5, Flutter, mini program, native iOS, or native HarmonyOS roots.
- Route contributions must declare `id`, `surface`, `domain`, `capability`, `screen`, `titleKey`, auth mode, and permission hints.
- Android physical navigation destinations may differ from other platforms, but route ids and i18n keys should align.
- Deep links should resolve to route ids before being converted into Android navigation actions.
- Route metadata must not contain API URLs, SDK methods, access tokens, app secrets, signing secrets, or Android private keys.

## 9. Config, Build, And Release

Rules:

- Android root config separates lifecycle environment, build mode, deployment mode, and runtime target according to `CONFIG_SPEC.md`.
- `config/app/` and `config/host/` examples must be safe checked-in templates only.
- Android application id, package name, min/target SDK, ABI targets, permissions, app links, push environment, signing reference names, and store profile references belong to host config or Gradle/manifest templates.
- Host config must not contain signing private keys, auth tokens, refresh tokens, API keys, database credentials, private service endpoints, SDK ownership, or business route constants.
- `sdkwork.app.config.json` must include Google Play/private distribution metadata, icons, screenshots, package ids, checksums where applicable, signing metadata references, SBOM/provenance, and release notes.
- Publish platform should be `APP_ANDROID` for Android-only native roots. Generic `APP` or `APP_PLUS` may be listed only when the product actually supports a broader mobile app family.

## 10. Standard Commands

Android native roots should provide equivalents for:

```text
./gradlew assembleDebug
./gradlew test
./gradlew connectedAndroidTest
./gradlew lint
./gradlew bundleRelease
./gradlew assembleRelease
```

Application roots may expose stable aliases when pnpm or repository tooling orchestrates Android:

```text
pnpm install
pnpm android:sync
pnpm android:lint
pnpm android:test
pnpm android:test:instrumented
pnpm android:build:debug
pnpm android:build:release
pnpm android:bundle:release
pnpm test
pnpm test:config
```

Rules:

- Production build commands must run config, SDK boundary, manifest, media, signing-reference, and secret preflight before packaging.
- Android builds require Android SDK, JDK, Gradle tooling, and a documented signing/release profile.
- Package-level commands should allow focused unit tests and Android lint for changed modules.

## 11. Verification

Required verification for Android native architecture changes:

| Verification | Evidence |
| --- | --- |
| Root layout | Static check proves `.sdkwork/`, `config/app`, `config/host`, root `app` bootstrap, `packages/`, `sdks/`, `scripts/`, Gradle files, and tests exist. |
| Package naming | Static check proves Android packages use `sdkwork-<product>-android-mobile-*` and reserved console/admin/host forms. |
| Root thinness | Static scan proves root `app/` owns bootstrap/composition only and business features live in packages. |
| SDK boundary | Static scan proves generated Kotlin/Java SDK clients are injected and no raw HTTP, manual auth headers, TypeScript/Flutter/Swift/ArkTS wrapper imports, or generated SDK edits were introduced. |
| IAM clearing | Tests prove token manager, context store, secure storage, sensitive state, and realtime/session bridges clear on logout and refresh failure. |
| Host boundary | Static scan proves feature packages do not call Android framework/platform APIs directly for host capabilities. |
| Route alignment | Tests or static checks prove Android route ids align with cross-client route identity. |
| UI states | UI tests cover loading, success, empty, validation-error, permission-denied, offline/unavailable, and unknown-error states for representative screens. |
| Release preflight | Checks validate Android package metadata, icons, screenshots, signing references, checksums/SBOM/provenance, Play/private distribution metadata, and secret absence. |

Acceptance checklist:

- [ ] Android root follows `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md`.
- [ ] Root `app/` remains thin.
- [ ] Packages are split by core, commons, shell, capability, optional console/admin, and host roles.
- [ ] Generated Kotlin/Java SDKs and appbase Android IAM runtime/wrapper are injected from bootstrap/core.
- [ ] Android platform behavior uses typed host adapters.
- [ ] Route ids align with other client architectures where workflows match.
- [ ] Config, manifest, and release metadata are separated and secret-free.
- [ ] Android lint/test/build or package equivalents pass for touched packages.
