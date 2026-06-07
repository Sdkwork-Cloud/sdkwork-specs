# App Harmony Native UI Standard

- Version: 1.0
- Scope: app/user-facing HarmonyOS native packages, ArkTS/ArkUI UI, generated ArkTS/TypeScript app SDK integration, HarmonyOS host adapters, mobile interaction, and package-local state
- Related: `API_SPEC.md`, `APPLICATION_SPEC.md`, `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md`, `HARMONY_APP_MOBILE_ARCHITECTURE_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, `COMPONENT_SPEC.md`, `CONFIG_SPEC.md`, `DOMAIN_SPEC.md`, `FRONTEND_SPEC.md`, `UI_ARCHITECTURE_SPEC.md`, `IAM_LOGIN_INTEGRATION_SPEC.md`, `I18N_SPEC.md`, `MODULE_SPEC.md`, `NAMING_SPEC.md`, `SDK_SPEC.md`, `SECURITY_SPEC.md`, `TEST_SPEC.md`

This standard defines how SDKWork app-side Harmony native UI is packaged and integrated. In application roots it is applied after `HARMONY_APP_MOBILE_ARCHITECTURE_SPEC.md`; in shared package families it remains the detailed Harmony native package standard. Harmony UI packages are app/user-facing and consume app-api through generated ArkTS/TypeScript app SDK clients adapted for Harmony runtime or approved appbase Harmony wrappers. They must not consume backend/admin UI packages or backend SDKs for user-facing workflows.

This standard is selected through `UI_ARCHITECTURE_SPEC.md` and applies only to app/user-facing Harmony native packages.

Canonical app-root Harmony package shape:

```text
apps/<product>-harmony-mobile/
  packages/
    sdkwork-<product>-harmony-mobile-core/
    sdkwork-<product>-harmony-mobile-commons/
    sdkwork-<product>-harmony-mobile-shell/
    sdkwork-<product>-harmony-mobile-<capability>/
```

Optional shared Harmony package shape:

```text
packages/harmony-native/
  iam/
  foundation/
  commerce/
  communication/
  content/
  intelligence/
  system/
```

## 1. Surface Boundary

Rules:

- Harmony app UI `MUST` live in normalized Harmony application packages such as `apps/<product>-harmony-mobile/packages/sdkwork-<product>-harmony-mobile-<capability>` or approved shared Harmony package families such as `packages/harmony-native/<domain>/<package>`.
- Harmony app UI `MUST` consume `/app/v3/api` through generated ArkTS/TypeScript app SDK clients adapted for Harmony runtime or approved wrappers.
- Harmony app UI `MUST NOT` consume `/backend/v3/api`, backend SDK packages, backend React packages, Flutter packages, Android packages, or iOS packages for user-facing workflows.
- Operator/admin screens require a separately approved Harmony admin package family and must follow backend-api and backend SDK rules.
- HarmonyOS system APIs such as camera, biometric, secure storage, push, want/deep-link handling, files, and lifecycle `MUST` go through typed host adapters.

## 2. Package Split

| Package type | Naming | Owns | Must not own |
| --- | --- | --- | --- |
| Harmony app shell | `sdkwork-<product>-harmony-mobile-shell` or app-specific Harmony shell | navigation/page stack composition, providers, AuthGate, route composition | reusable domain features |
| Harmony foundation package | `sdkwork-<product>-harmony-mobile-commons` or `sdkwork-<foundation>-harmony-native` | domain-neutral ArkUI primitives, theme adapters, form/list/error primitives, i18n helpers | business-domain shortcuts |
| Harmony domain package | `sdkwork-<product>-harmony-mobile-<capability>` or `sdkwork-<capability>-harmony-native` | pages, components, view models/controllers, services, repositories, state, i18n/resources, route metadata | concrete SDK construction, backend admin logic |
| Harmony host package | `sdkwork-<product>-harmony-mobile-host` or `sdkwork-<host>-harmony-native` when needed | HarmonyOS platform API adapters, permissions, lifecycle, secure storage, camera/QR/share/push/deep links | API business logic |

Rules:

- Harmony packages `MUST` be split by domain/capability.
- A single Harmony package `MUST NOT` accumulate unrelated backend-like business modules.
- Shared UI primitives remain domain-neutral unless they live inside the owning domain package.
- Harmony packages may share app SDK port contracts conceptually with other client packages, but must not depend on their UI/runtime code.

## 3. Internal Shape

Recommended app-root package structure:

```text
apps/<product>-harmony-mobile/packages/sdkwork-<product>-harmony-mobile-<capability>/
  oh-package.json5
  src/
    main/
      module.json5
      ets/
        Index.ets
        pages/
        components/
        presentation/
          viewModels/
          controllers/
        services/
        repositories/
        state/
        i18n/
        routes/
        navigation/
        host/
        models/
    ohosTest/
  tests/
  specs/
```

Recommended shared package structure:

```text
packages/harmony-native/<domain>/<package>/
  oh-package.json5
  src/
    main/
      ets/
  tests/
  specs/
```

Rules:

- The package public API file exports integration contracts and composition helpers.
- `pages/` owns route-level UI.
- `components/` owns reusable or domain-specific components.
- `presentation/` owns view models/controllers and UI state mapping.
- `services/` owns use-case orchestration.
- `repositories/` owns thin generated app SDK calls where repository naming is used.
- `i18n/` and Harmony resource files own package-local locale fragments. Platform resource aggregates must be generated or assembled from fragments and must not be hand-authored whole-app catalogs; follow `I18N_SPEC.md`.
- `models/` owns view models only. API DTOs come from generated ArkTS/TypeScript app SDKs.
- `host/` owns adapter interfaces for platform capabilities.

## 4. SDK And Host Integration

Rules:

- Harmony services/repositories `MUST` receive generated app SDK clients or narrow app SDK ports through dependency injection.
- Harmony runtime/bootstrap `MUST` construct generated ArkTS/TypeScript app SDK clients, appbase SDK clients or approved appbase Harmony wrappers, one global token-manager equivalent, token/context storage, and host adapters.
- Harmony IAM integration `MUST` use generated appbase app SDK resources or an approved appbase Harmony wrapper for login, registration, current session, refresh, logout, verification, OAuth, QR auth, password reset, runtime metadata, and current-user self-service.
- If an appbase Harmony wrapper is missing a required resource, the missing capability `MUST` be added to appbase app-api/OpenAPI/generator inputs and regenerated. Harmony packages `MUST NOT` fill the gap with raw request calls, manual headers, or copied TypeScript browser/Flutter logic.
- UI and view models `MUST NOT` construct SDK clients, attach auth/API key headers, parse JWTs for authorization, or call raw request APIs for business transport.
- Platform capabilities must be behind interfaces so tests can use fake adapters.
- Generated SDK output `MUST NOT` be hand-edited.

## 5. Harmony Interaction And Design

Rules:

- Harmony UI must be phone-first, touch-first, safe-area-aware, and usable across common phone and foldable layouts when the app supports them.
- New UI should use ArkUI state and navigation patterns or an approved root state pattern; platform bridge code must not bypass service and host adapter boundaries.
- Screens must handle loading, empty, validation-error, permission-denied, offline/unavailable, and unknown-error states.
- Forms must support keyboard avoidance, autofill hints where appropriate, accessible labels, and duplicate-submit protection.
- QR scan, OAuth redirect, verification-code, push permission, and password reset flows must handle foreground/background transitions.
- Theme usage must come from the app design system or package-injected theme adapters. Domain packages must not redefine global themes.

## 6. Security

Rules:

- Tokens should be stored through approved HarmonyOS secure storage adapters where available.
- Secure storage may persist centralized token/context state, but it `MUST NOT` own login, token refresh, permission checks, or business authorization.
- Logout, refresh failure, tenant switch, and account switch `MUST` clear secure storage, global token-manager equivalent, context store, sensitive Harmony state, and realtime/session bridges.
- Verification codes, OAuth codes, password reset tokens, QR keys, access tokens, refresh tokens, and push tokens `MUST NOT` be logged or placed in crash/analytics breadcrumbs.
- Deep links and wants must validate expected scheme/host/path, state, nonce, and expiry before completing sensitive flows.
- Frontend permission checks are hints only. App-api authorization remains mandatory.

## 7. Testing

Required coverage for new Harmony capabilities:

| Test | Requirement |
| --- | --- |
| Package boundary | Static scan proves packages follow `sdkwork-<product>-harmony-mobile-*` or approved shared Harmony package names and do not deep-import another package's private source. |
| SDK boundary | Static scan proves generated SDK clients or approved wrappers are used and no raw request APIs, manual auth headers, or generated SDK edits were introduced. |
| Service/view model | Unit tests use fake generated app SDK clients and fake host adapters. |
| UI states | ArkUI tests or documented fixtures cover loading, empty, validation-error, permission-denied, unavailable, and unknown-error states. |
| IAM clearing | Tests prove secure storage, token manager, context store, caches, and sensitive state clear on logout, refresh failure, tenant switch, and account switch. |
| Host boundary | Static scan proves feature UI does not call HarmonyOS platform APIs directly for host capabilities. |

Acceptance checklist:

- [ ] Harmony UI package placement follows `HARMONY_APP_MOBILE_ARCHITECTURE_SPEC.md`.
- [ ] Packages are split by domain/capability and expose only public integration contracts.
- [ ] Route ids and i18n keys align with other client architectures where workflows match.
- [ ] Services use generated app SDK clients or approved wrappers through injection.
- [ ] HarmonyOS platform APIs are behind typed host adapters.
- [ ] UI covers mobile interaction states and lifecycle constraints.
- [ ] Security-sensitive platform facts and tokens are not logged or persisted insecurely.
- [ ] Verification evidence is recorded before completion.
