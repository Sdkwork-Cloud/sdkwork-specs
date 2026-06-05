# App PC React UI Standard

- Version: 1.0
- Scope: app/user-facing PC React packages, desktop/web React apps, appbase PC modules, service-to-app-SDK integration
- Related: `API_SPEC.md`, `APPLICATION_SPEC.md`, `COMPONENT_SPEC.md`, `DESKTOP_APP_ARCHITECTURE_SPEC.md`, `DOMAIN_SPEC.md`, `FRONTEND_SPEC.md`, `UI_ARCHITECTURE_SPEC.md`, `IAM_LOGIN_INTEGRATION_SPEC.md`, `I18N_SPEC.md`, `MODULE_SPEC.md`, `SDK_SPEC.md`, `SECURITY_SPEC.md`, `TEST_SPEC.md`

This standard defines how SDKWork app-side PC React UI is packaged and integrated. PC React app UI is user-facing product UI. It must be independent from backend/admin UI packages and must consume app API capabilities through the generated app SDK or approved appbase wrappers.

This standard is selected through `UI_ARCHITECTURE_SPEC.md` and applies only to app/user-facing PC React packages.

Use `DESKTOP_APP_ARCHITECTURE_SPEC.md` for desktop shell, Tauri host, native capability adapter, session/bootstrap, desktop packaging, and release boundaries. This file owns PC React UI packages and app-facing interaction rules.

Use `IAM_LOGIN_INTEGRATION_SPEC.md` for appbase IAM login/session integration, AuthGate behavior, generated app SDK token wiring, logout clearing, and Rust protected API validation. This file owns PC React package placement and user-facing UI rules.

Canonical app PC React package shape:

```text
apps/sdkwork-appbase/
  packages/
    pc-react/
      iam/
        sdkwork-auth-pc-react/
        sdkwork-user-pc-react/
      foundation/
        sdkwork-appbase-pc-react/
        sdkwork-router-pc-react/
      commerce/
      communication/
      content/
      intelligence/
      system/
```

## 1. Surface Boundary

| Surface | Package family | API surface | SDK source | Typical users |
| --- | --- | --- | --- | --- |
| App PC React UI | `sdkwork-<capability>-pc-react` | `/app/v3/api` | `spring-ai-plus-app-api` generated SDK | end users and app users |
| Backend UI | `@sdkwork/react-backend-*` | `/backend/v3/api` | `spring-ai-plus-backend-api` generated SDK | admins and operators |

Rules:

- App PC React UI `MUST` live in app-side packages such as `sdkwork-<capability>-pc-react`.
- App PC React UI `MUST NOT` be placed in `@sdkwork/react-backend-*` packages.
- App PC React services `MUST` consume `/app/v3/api` through generated app SDK clients or approved appbase service wrappers.
- App PC React UI `MUST NOT` call backend-api or backend SDK for user-facing workflows.
- Login, registration, sessions, OAuth, verification codes, password reset, QR login, and current user flows belong to app UI and app-api.
- Operator-only resource management, tenant administration, platform settings, and audit consoles belong to backend UI.

## 2. Package Split

App PC React packages are split by user-facing capability and domain.

| Package type | Naming | Owns | Must not own |
| --- | --- | --- | --- |
| app shell/runtime | app-specific `src/` or runtime package | providers, router, SDK bootstrap, token store, deployment mode, host integration | reusable domain pages and services |
| appbase foundation | `sdkwork-<foundation>-pc-react` | reusable shell, router, workspace, command, search, appbase utilities | business-domain API shortcuts |
| domain feature package | `sdkwork-<capability>-pc-react` | user-facing pages, components, services, hooks, i18n, route metadata | concrete SDK construction, backend admin logic |
| contracts/service package | common IAM or domain service packages | typed SDK ports, domain orchestration, API DTO adaptation | React rendering and app shell state |

Rules:

- Every package `MUST` declare one primary capability.
- New IAM/user/auth work `MUST` use `iam` naming, not `identity`.
- Business UI `MUST` be placed under the closest domain family such as `iam`, `commerce`, `communication`, `content`, `intelligence`, `system`, `device`, or `ecosystem`.
- App PC React packages `MUST` not become catch-all app modules. Split independent domains into separate packages.
- A shared UI primitive package may exist only for domain-neutral PC React primitives. It must not include business workflows.

## 3. Internal Shape

Recommended package structure:

```text
packages/pc-react/<domain>/<package>/
  package.json
  src/
    index.ts
    pages/
    components/
    hooks/
    services/
    state/
    i18n/
    types/
    routes/
  tests/
  specs/
```

Rules:

- `src/index.ts` is the public export boundary.
- `pages/` owns route-level feature composition.
- `components/` owns reusable or domain-specific UI pieces.
- `services/` owns SDK orchestration through injected app SDK ports.
- `hooks/` owns React integration around services and state.
- `state/` owns view/cache state only, not backend invariants.
- `i18n/` owns user-facing copy and locale fallback.
- `types/` owns local view models only. API DTOs come from generated app SDKs or shared contracts.
- `routes/` owns route metadata when the package contributes routes to an app shell.
- `specs/` follows `COMPONENT_SPEC.md` when the package is an authored app/component package.

## 4. SDK Integration

Rules:

- Services `MUST` accept app SDK clients or narrow SDK port interfaces.
- UI components `MUST NOT` construct SDK clients, call raw HTTP, manually attach tokens, or parse JWTs for authorization.
- Missing app SDK methods `MUST` be fixed in `spring-ai-plus-app-api`, OpenAPI, and generator inputs before integration.
- App PC React packages `MUST NOT` import generated SDK internals just to bypass an appbase wrapper gap.
- Tests `SHOULD` use fake clients implementing the same generated app SDK resource surface.

Example surface:

```ts
export interface AuthAppClientPort {
  auth: {
    sessions: {
      create(body: unknown): Promise<unknown>;
      refresh(body: unknown): Promise<unknown>;
    };
    verificationCodes: {
      create(body: unknown): Promise<unknown>;
      verify(body: unknown): Promise<unknown>;
    };
  };
}
```

## 5. PC Interaction And Design

Rules:

- PC React UI should prioritize keyboard, pointer, large-screen density, route persistence, and multitasking.
- Complex workflows `SHOULD` use tabs, drawers, side panels, step flows, and table/filter patterns that fit desktop use.
- Feature pages `MUST` provide loading, empty, validation-error, permission-denied, unavailable, and unknown-error states.
- Text must fit responsive PC and tablet widths without overlap.
- Icon-only controls `MUST` have accessible names and tooltips when the icon is not universally obvious.
- App PC UI `MUST` use the app design system and tokens instead of redefining global themes per package.

## 6. Auth And Security

Rules:

- App PC auth state must clear sensitive state on logout, token refresh failure, tenant switch, and account switch.
- PC React app shells that require login `MUST` provide an AuthGate or equivalent route guard using appbase IAM auth routes and the session rules in `IAM_LOGIN_INTEGRATION_SPEC.md`.
- Frontend permission checks are hints only. App-api authorization remains mandatory.
- Verification codes, refresh tokens, access tokens, OAuth codes, QR keys, and password reset tokens `MUST NOT` be logged or displayed.
- OAuth and QR login UI must show only user-safe state and must not expose provider secrets or raw callback payloads.

## 7. Testing

Required coverage for new App PC React capabilities:

- service test with a fake generated app SDK client;
- UI/page test for the main success and failure states;
- route contribution test when adding app shell routes;
- i18n fallback test for user-facing text when new copy is added;
- typecheck for the changed package.

Acceptance checklist:

- [ ] Package belongs to the correct app-side domain/capability.
- [ ] UI calls services, services call injected app SDK clients.
- [ ] No backend-api, backend SDK, raw HTTP, manual auth headers, or generated SDK edits were introduced.
- [ ] Auth/session/token-sensitive state is handled safely.
- [ ] Appbase IAM login/session integration follows `IAM_LOGIN_INTEGRATION_SPEC.md` when protected app routes are present.
- [ ] Tests cover SDK orchestration and representative UI states.
