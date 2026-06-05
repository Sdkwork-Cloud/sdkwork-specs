# App Mobile React UI Standard

- Version: 1.0
- Scope: app/user-facing React mobile packages, mobile web, Capacitor/Tauri-mobile style shells, app SDK integration
- Related: `API_SPEC.md`, `APPLICATION_SPEC.md`, `COMPONENT_SPEC.md`, `CONFIG_SPEC.md`, `DOMAIN_SPEC.md`, `FRONTEND_SPEC.md`, `UI_ARCHITECTURE_SPEC.md`, `I18N_SPEC.md`, `MODULE_SPEC.md`, `SDK_SPEC.md`, `SECURITY_SPEC.md`, `TEST_SPEC.md`

This standard defines how SDKWork app-side mobile React UI is packaged and integrated. Mobile React UI is user-facing and must consume app-api through app SDK clients or approved appbase mobile wrappers. It must not depend on backend/admin UI packages.

This standard is selected through `UI_ARCHITECTURE_SPEC.md` and applies only to app/user-facing mobile React packages.

Canonical mobile React package shape:

```text
apps/sdkwork-appbase/
  packages/
    mobile-react/
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

- Mobile React app UI `MUST` live in `mobile-react/<domain>/<package>` package families.
- Mobile React app UI `MUST` consume `/app/v3/api` through the generated app SDK or approved appbase wrappers.
- Mobile React app UI `MUST NOT` consume `/backend/v3/api`, backend SDK packages, or `@sdkwork/react-backend-*` packages.
- Backend/admin UI and operator-only workflows are forbidden in mobile React app packages unless the product is explicitly an admin mobile app with its own approved package family.
- Native-only concerns such as camera, push token, deep link, biometric prompt, secure storage, and OS share sheet `MUST` go through host adapters.

## 2. Package Split

| Package type | Naming | Owns | Must not own |
| --- | --- | --- | --- |
| mobile shell/runtime | app-specific mobile shell | navigation container, safe-area provider, SDK bootstrap, token storage adapter, host adapters | reusable domain services and pages |
| mobile foundation | `sdkwork-<foundation>-mobile-react` | appbase, router, command, search, workspace primitives for mobile | business-domain shortcuts |
| mobile domain package | `sdkwork-<capability>-mobile-react` | screens, components, hooks, services, i18n, navigation metadata | concrete SDK construction, backend admin logic |
| host adapter package | `sdkwork-<host>-mobile-react` when needed | native bridge abstraction and permissions | API business logic |

Rules:

- Mobile packages `MUST` be split by domain/capability and must not become one large mobile business package.
- Shared visual primitives must remain domain-neutral.
- Domain packages may share contracts with PC React packages, but must not import PC-specific page or layout components.
- Mobile and PC packages may share SDK port interfaces through common contracts or services when the UI concerns remain separate.

## 3. Internal Shape

Recommended package structure:

```text
packages/mobile-react/<domain>/<package>/
  package.json
  src/
    index.ts
    screens/
    components/
    hooks/
    services/
    state/
    i18n/
    navigation/
    host/
    types/
  tests/
  specs/
```

Rules:

- `screens/` owns mobile route-level UI.
- `navigation/` owns route metadata, tab registration, stack registration, and deep-link mapping.
- `host/` owns injected host adapter contracts only, not native implementation details unless the package is a host package.
- `services/` owns app SDK orchestration through injected clients or shared service interfaces.
- `state/` owns mobile view/cache state and must clear sensitive state on logout and account/tenant switch.

## 4. SDK And Host Integration

Rules:

- Services `MUST` use app SDK clients or approved service wrappers.
- Native bridge calls `MUST` go through typed host adapters.
- UI components `MUST NOT` construct SDK clients, call raw HTTP, manually attach auth headers, or call native bridge globals directly.
- Push notification, QR scan, camera, location, biometric, secure storage, and deep-link handling must be represented as typed adapters with test doubles.
- Missing app SDK methods must be fixed in `spring-ai-plus-app-api` and generator inputs before the mobile package consumes them.

## 5. Mobile Interaction And Design

Rules:

- Mobile UI must be touch-first, safe-area-aware, and usable at common phone widths.
- Primary actions should be reachable without dense desktop tables or hover-only interactions.
- Lists must support loading, pull-to-refresh or explicit refresh when appropriate, pagination or infinite loading with bounds, empty state, retry, and offline/unavailable state.
- Forms must use mobile-friendly input types, validation messages, and keyboard avoidance.
- QR scan, OAuth redirect, password reset, and verification-code flows must survive app background/foreground transitions where the host supports it.
- Text must fit within compact mobile containers without overlap or viewport-scaled font hacks.

## 6. Security

Rules:

- Tokens should be stored through secure storage host adapters where available.
- Verification codes, OAuth codes, reset tokens, QR keys, and access tokens `MUST NOT` be logged, persisted in insecure view state, or placed in analytics attributes.
- Deep links must validate expected scheme, host, path, nonce/state, and expiry before completing sensitive flows.
- Frontend permission checks are hints only. App-api authorization remains mandatory.

## 7. Testing

Required coverage for new mobile React capabilities:

- service test with fake app SDK client;
- host adapter contract test for native-dependent behavior;
- screen/hook test for loading, empty, validation, permission-denied, and failure states;
- navigation/deep-link mapping test when adding routes;
- typecheck for changed packages.

Acceptance checklist:

- [ ] Package belongs to the correct mobile app domain/capability.
- [ ] UI -> services -> injected app SDK clients boundary is respected.
- [ ] Native concerns use host adapters.
- [ ] No backend SDK, backend UI dependency, raw HTTP, manual auth headers, or generated SDK edits were introduced.
- [ ] Mobile-specific state, offline, safe-area, and security behaviors are covered.
