# Frontend and UI Service Standard

- Version: 1.0
- Scope: architecture-neutral UI-service-SDK layering, reusable UI modules, service facades, state, routing, accessibility, frontend tests
- Related: `APPLICATION_SPEC.md`, `MODULE_SPEC.md`, `UI_ARCHITECTURE_SPEC.md`, `APP_PC_REACT_UI_SPEC.md`, `APP_MOBILE_REACT_UI_SPEC.md`, `APP_FLUTTER_UI_SPEC.md`, `BACKEND_UI_SPEC.md`, `SDK_SPEC.md`, `DRIVE_SPEC.md`, `MEDIA_RESOURCE_SPEC.md`, `IAM_LOGIN_INTEGRATION_SPEC.md`, `CONFIG_SPEC.md`, `SECURITY_SPEC.md`, `TEST_SPEC.md`

This standard defines the shared frontend rules for SDKWork modules. It is architecture-neutral and applies to app PC React, mobile React, Flutter, and backend/admin React packages. Platform-specific package placement, host adapters, and interaction rules live in the architecture-specific UI standards.

`UI_ARCHITECTURE_SPEC.md` is the required selection gate. Architecture-specific UI standards extend this common standard:

| UI architecture | Required spec | API surface |
| --- | --- | --- |
| App PC React | `APP_PC_REACT_UI_SPEC.md` | `/app/v3/api` through generated app SDK |
| App mobile React | `APP_MOBILE_REACT_UI_SPEC.md` | `/app/v3/api` through generated app SDK and host adapters |
| App Flutter | `APP_FLUTTER_UI_SPEC.md` | `/app/v3/api` through generated Dart/Flutter app SDK and platform adapters |
| Backend/admin React | `BACKEND_UI_SPEC.md` | `/backend/v3/api` through generated backend SDK |

## 1. Layering

Standard frontend flow:

```text
App shell
  -> runtime providers
  -> feature routes/pages
  -> UI components
  -> services
  -> injected generated SDK clients
```

Rules:

- UI components `MUST` receive data, callbacks, and state through props, hooks, or providers.
- UI components `MUST NOT` call raw HTTP, manually set token headers, parse JWTs for authorization, or choose tenant isolation rules.
- Services `MUST` call generated SDK clients or approved service interfaces.
- Runtime/bootstrap code `MUST` construct SDK clients and provide token storage adapters.
- IAM login/session bootstrap, AuthGate behavior, token refresh, logout clearing, and appbase auth UI/runtime integration `MUST` follow `IAM_LOGIN_INTEGRATION_SPEC.md`.
- App shell code `MUST` stay thin: router, layout, providers, environment selection, host integration.
- Frontend work `MUST` select exactly one primary UI architecture through `UI_ARCHITECTURE_SPEC.md` before package placement.
- App/user-facing UI `MUST NOT` import backend/admin UI packages or call backend-api for user workflows.
- Backend/admin UI `MUST NOT` be mixed into app UI packages and must follow business-domain backend package split rules from `BACKEND_UI_SPEC.md`.

## 1.1 UI Architecture Selection

Rules:

- PC React app UI uses `APP_PC_REACT_UI_SPEC.md`.
- Mobile React app UI uses `APP_MOBILE_REACT_UI_SPEC.md`.
- Flutter app UI uses `APP_FLUTTER_UI_SPEC.md`.
- Backend/admin React UI uses `BACKEND_UI_SPEC.md`.
- A package cannot implement more than one of these architecture families. Shared logic belongs in non-UI contracts or services.
- Shared common rules remain in this file; package naming, route ownership, host/platform adapters, and SDK surface selection come from the architecture-specific spec.

## 2. Architecture-Neutral Package Shape

Recommended package structure:

```text
App-side packages:
packages/<architecture>/<domain>/<package>/
  package.json
  README.md
  src/
    index.ts
    components/
    hooks/
    pages/
    services/
    state/
    styles/
    types/
  tests/

Backend/admin packages:
apps/sdkwork-backend-react-web/packages/sdkwork-react-backend-<domain>/
  package.json
  README.md
  src/
    index.ts
    components/
    hooks/
    pages/
    services/
    repository/
    routes/
    i18n/
    types/
  tests/
```

Rules:

- `components/` contains reusable visual pieces.
- `pages/` contains route-level feature composition.
- `hooks/` contains React integration around services and state.
- `services/` contains SDK orchestration and domain methods.
- `state/` contains cache/view state only, not backend source-of-truth rules.
- `types/` contains local view models only. API DTOs come from generated SDKs or standard contracts.

The selected `architecture` must be one of:

- `pc-react`
- `mobile-react`
- `mobile-flutter`
- `backend-admin-react`

## 3. SDK Client Injection

Frontend services `MUST` accept SDK clients or a narrow client interface.

```ts
export interface IamAppClientSurface {
  auth: {
    sessions: {
      create(body: unknown): Promise<unknown>;
      refresh(body: unknown): Promise<unknown>;
      delete(): Promise<void>;
    };
  };
  iam: {
    users: {
      current: {
        retrieve(): Promise<unknown>;
      };
    };
  };
}
```

Rules:

- Service interfaces `SHOULD` mirror generated SDK resource surfaces.
- Tests `SHOULD` provide fake clients implementing the same resource surface.
- Application-specific generated SDK constructors belong in runtime/bootstrap, not shared modules.
- A module must not import a generated SDK package only to construct clients internally.
- Frontend services MUST NOT generate requestId or xRequestId values, set `X-Request-Id`/`x-request-id`, or pass generated SDK `xRequestId` params. They may generate business `Idempotency-Key` values for retriable commands and must read returned `requestId` values from server responses when correlation is needed.
- File upload, download, import, and generated-asset storage services `MUST` use generated Drive SDK clients governed by `DRIVE_SPEC.md`. UI-local `File`, object URL previews, upload progress, and presigned URLs must remain transient view state.
- Media upload, picker, import, and generated-asset services `MUST` use `MediaResource` contracts from `MEDIA_RESOURCE_SPEC.md` once data crosses the business service boundary.
- Frontend DTO field names for media should use natural business roles such as `avatar`, `cover`, `thumbnail`, `poster`, `video`, `audio`, `file`, `document`, `asset`, `mainImage`, `galleryImage`, `detailImage`, or `skuImage`. Do not use redundant names such as `coverMedia` when the type is already `MediaResource`.

## 4. State And Cache

Rules:

- Server state `SHOULD` be fetched through services and cached with a predictable query key strategy.
- Query keys `SHOULD` include domain, resource, tenant/organization scope when safe, and stable parameters.
- Auth/session state `MUST` react to token refresh, logout, tenant switch, and permission changes.
- Auth/session state `MUST` clear according to `IAM_LOGIN_INTEGRATION_SPEC.md`: persisted session, SDK token managers, realtime connections, sensitive caches, and native secure storage when present.
- UI-only state may be local component state.
- Sensitive state `MUST` be cleared on logout and tenant switch.
- Media preview object URLs, drag/drop files, upload queue progress, retry counters, and presigned upload URLs are UI-only or service-local state. They must not be cached as persisted server state or submitted as business media identity.
- Persisted media cache entries should key by stable Drive `driveUri`, `driveNodeId`, `MediaResource.id`, `objectBlobId`, provider `uri`, or the owning resource plus media role, not by signed delivery URL.
- Browser code `MUST NOT` construct provider object keys, call object storage provider SDKs directly, or store Drive presigned URLs as server state. Missing upload/download behavior must be added to Drive SDK contracts.

## 5. Errors And Empty States

Rules:

- SDK `application/problem+json` errors `MUST` be mapped to stable user-facing service errors.
- UI must handle loading, empty, permission-denied, validation-error, offline/unavailable, and unknown-error states for reusable flows.
- UI must not display stack traces, raw SQL, raw provider responses, tokens, or internal exception details.
- Retry UI `SHOULD` be used only for idempotent or safe operations.

## 6. Authorization UX

Rules:

- Frontend permission checks are hints for navigation and affordances only.
- Server-side authorization remains mandatory.
- Disabled or hidden UI actions `SHOULD` map to permission codes such as `iam.users.read`.
- Tenant and organization switchers `MUST` trigger service/cache invalidation.
- Cross-tenant or platform-admin UI must make scope visible to operators.

## 7. Accessibility, Internationalization, And Design

Rules:

- Interactive controls `MUST` be keyboard reachable.
- Forms `MUST` connect labels, validation messages, and field descriptions.
- Icon-only buttons `MUST` have accessible names and tooltips where helpful.
- Reusable modules `SHOULD` accept i18n text providers or message catalogs instead of hard-coded product copy.
- Text must fit responsive containers without overlap.
- Design tokens and component primitives should be imported from the app's design system rather than redefined locally.

## 8. Host And Platform Boundaries

Rules:

- Native host calls `MUST` go through host adapters.
- Host adapters `MUST NOT` enforce business authorization in place of backend checks.
- Secure storage for tokens `SHOULD` use host-provided secure storage where available.
- Local Rust backend client construction belongs in runtime/bootstrap.
- File, process, window, browser, mobile, and OS permissions must be explicit and reviewed.

## 9. Acceptance Checklist

- [ ] UI-service-SDK boundaries are respected.
- [ ] SDK clients are injected.
- [ ] No raw HTTP or manual auth headers exist in shared business modules.
- [ ] Auth/session/tenant switch clears sensitive state.
- [ ] Permission-denied and validation-error states are covered.
- [ ] Keyboard and accessible labels are covered for interactive controls.
- [ ] Tests cover service behavior and representative UI integration.
