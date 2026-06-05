# App Flutter UI Standard

- Version: 1.0
- Scope: app/user-facing Flutter packages, mobile/desktop Flutter shells, generated app SDK integration, platform adapters
- Related: `API_SPEC.md`, `APPLICATION_SPEC.md`, `COMPONENT_SPEC.md`, `CONFIG_SPEC.md`, `DOMAIN_SPEC.md`, `FRONTEND_SPEC.md`, `UI_ARCHITECTURE_SPEC.md`, `I18N_SPEC.md`, `MODULE_SPEC.md`, `SDK_SPEC.md`, `SECURITY_SPEC.md`, `TEST_SPEC.md`

This standard defines how SDKWork app-side Flutter UI is packaged and integrated. Flutter UI packages are app/user-facing and consume app-api through generated Flutter/Dart app SDK clients or approved appbase Flutter wrappers. They must not consume backend/admin UI packages or backend SDKs for user-facing workflows.

This standard is selected through `UI_ARCHITECTURE_SPEC.md` and applies only to app/user-facing Flutter packages.

Canonical Flutter package shape:

```text
apps/sdkwork-appbase/
  packages/
    mobile-flutter/
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

- Flutter app UI `MUST` live in Flutter app package families such as `mobile-flutter/<domain>/<package>`.
- Flutter app UI `MUST` consume `/app/v3/api` through generated Dart/Flutter app SDK clients or approved wrappers.
- Flutter app UI `MUST NOT` consume `/backend/v3/api`, backend SDKs, backend React packages, or backend UI service facades.
- App login, registration, OAuth, verification-code login, password reset, QR login, and current user flows belong to Flutter app UI when implemented in Flutter.
- Operator/admin screens require a separately approved admin Flutter package family and must follow backend-api and backend SDK rules.

## 2. Package Split

| Package type | Naming | Owns | Must not own |
| --- | --- | --- | --- |
| Flutter app shell | app-specific Flutter shell | `MaterialApp`/router, providers, SDK bootstrap, token store, platform adapters | reusable domain features |
| Flutter foundation package | `sdkwork_<foundation>_flutter` | appbase, router, workspace, command/search primitives | business-domain shortcuts |
| Flutter domain package | `sdkwork_<capability>_flutter` | screens, widgets, controllers/blocs, repositories, services, i18n | concrete SDK construction, backend admin logic |
| platform adapter package | `sdkwork_<host>_flutter` when needed | camera, QR scanner, secure storage, biometric, push, deep links | API business logic |

Rules:

- Flutter packages `MUST` be split by domain/capability.
- A single Flutter package `MUST NOT` accumulate unrelated backend-like business modules.
- Shared widgets must remain domain-neutral unless they live inside the domain package.
- Flutter packages may share app SDK port contracts with React packages conceptually, but must not depend on React code.

## 3. Internal Shape

Recommended package structure:

```text
packages/mobile-flutter/<domain>/<package>/
  pubspec.yaml
  lib/
    sdkwork_<capability>_flutter.dart
    src/
      screens/
      widgets/
      controllers/     # or blocs/, choose one pattern per package
      services/
      repositories/
      state/
      i18n/
      navigation/
      platform/
      models/
  test/
  specs/
```

Rules:

- The package root Dart file exports the public surface.
- `screens/` owns route-level UI.
- `widgets/` owns reusable or domain-specific widgets.
- `controllers/` or `blocs/` owns presentation logic. New packages should choose one pattern and stay consistent.
- `services/` owns use-case orchestration.
- `repositories/` owns thin generated app SDK calls where repository naming is used.
- `models/` owns view models only. API DTOs come from the generated Dart app SDK.
- `platform/` owns adapter interfaces for platform capabilities.

## 4. SDK And Platform Integration

Rules:

- Flutter services/repositories `MUST` receive generated app SDK clients or narrow app SDK ports through dependency injection.
- Widgets `MUST NOT` construct SDK clients, call raw HTTP, manually attach auth headers, or read secrets.
- Missing Flutter/Dart SDK methods `MUST` be fixed by updating app-api OpenAPI and generator inputs, then regenerating.
- Platform capabilities must be behind interfaces so tests can use fake adapters.
- Generated SDK output `MUST NOT` be hand-edited.

## 5. Flutter Interaction And Design

Rules:

- Flutter UI must be responsive across phone, tablet, foldable, and desktop windows when the app targets those surfaces.
- Touch targets must follow platform expectations and avoid hover-only behavior.
- Screens must handle loading, empty, validation-error, permission-denied, offline/unavailable, and unknown-error states.
- Forms must support keyboard avoidance, autofill hints where appropriate, and accessible labels.
- QR scan, OAuth redirect, verification-code, and password reset flows must handle app lifecycle transitions.
- Theme usage must come from the app design system or package-injected theme extensions. Domain packages must not redefine global themes.

## 6. Security

Rules:

- Tokens should be stored through secure platform storage where available.
- Verification codes, OAuth codes, password reset tokens, QR keys, access tokens, and refresh tokens `MUST NOT` be logged or placed in crash/analytics breadcrumbs.
- Deep link callbacks must validate expected scheme/host/path, state, nonce, and expiry before completing sensitive flows.
- Frontend permission checks are hints only. App-api authorization remains mandatory.

## 7. Testing

Required coverage for new Flutter capabilities:

- unit test for service/repository using a fake generated app SDK client;
- widget test for representative loading, success, empty, validation-error, and failure states;
- platform adapter contract test for camera, QR, secure storage, deep link, or push behavior when used;
- route/deep-link test when adding navigation;
- `flutter analyze` or package-equivalent static check.

Acceptance checklist:

- [ ] Package belongs to the correct Flutter app domain/capability.
- [ ] Widgets call controllers/services; services call injected app SDK clients.
- [ ] Platform behavior uses typed adapters.
- [ ] No backend SDK, backend UI dependency, raw HTTP, manual auth headers, or generated SDK edits were introduced.
- [ ] Tests cover SDK orchestration, platform adapters, and representative UI states.
