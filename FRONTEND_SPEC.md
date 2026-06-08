# Frontend and UI Service Standard

- Version: 1.0
- Scope: architecture-neutral UI-service-SDK layering, reusable UI modules, service facades, state, routing, accessibility, frontend tests
- Related: `APPLICATION_SPEC.md`, `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, `APP_PC_ARCHITECTURE_SPEC.md`, `APP_H5_ARCHITECTURE_SPEC.md`, `FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC.md`, `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md`, `ANDROID_APP_MOBILE_ARCHITECTURE_SPEC.md`, `IOS_APP_MOBILE_ARCHITECTURE_SPEC.md`, `HARMONY_APP_MOBILE_ARCHITECTURE_SPEC.md`, `MODULE_SPEC.md`, `UI_ARCHITECTURE_SPEC.md`, `APP_PC_REACT_UI_SPEC.md`, `APP_MOBILE_REACT_UI_SPEC.md`, `APP_FLUTTER_UI_SPEC.md`, `APP_MINI_PROGRAM_UI_SPEC.md`, `APP_ANDROID_NATIVE_UI_SPEC.md`, `APP_IOS_NATIVE_UI_SPEC.md`, `APP_HARMONY_NATIVE_UI_SPEC.md`, `BACKEND_UI_SPEC.md`, `SDK_SPEC.md`, `DRIVE_SPEC.md`, `MEDIA_RESOURCE_SPEC.md`, `IAM_LOGIN_INTEGRATION_SPEC.md`, `CONFIG_SPEC.md`, `SECURITY_SPEC.md`, `TEST_SPEC.md`

This standard defines the shared frontend rules for SDKWork modules. It is architecture-neutral and applies to app PC React, PC user console React, PC internal admin React, H5 mobile React, Flutter, mini program, native Android, native iOS, native HarmonyOS, and standalone backend/admin React packages. Platform-specific package placement, host adapters, tablet/desktop/mobile packaging, route projection, and interaction rules live in the architecture-specific standards. Client application roots follow `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md` plus their matching root architecture standard. Cross-architecture SDK composition, app dependency relationships, appbase IAM runtime, and global TokenManager wiring follow `APP_SDK_INTEGRATION_SPEC.md`.

`UI_ARCHITECTURE_SPEC.md` is the required selection gate. Architecture-specific UI standards extend this common standard:

| UI architecture | Required spec | API surface |
| --- | --- | --- |
| App PC React | `APP_PC_ARCHITECTURE_SPEC.md`, then `APP_PC_REACT_UI_SPEC.md` | `/app/v3/api` through generated app SDK; supports web, desktop, and large-screen tablet renderer targets |
| PC user console React | `APP_PC_ARCHITECTURE_SPEC.md`, then `APP_PC_REACT_UI_SPEC.md` | `/app/v3/api` or approved console-facing app SDK surface; supports web, desktop, and large-screen tablet renderer targets |
| PC internal admin React | `APP_PC_ARCHITECTURE_SPEC.md`, then `BACKEND_UI_SPEC.md` | `backend-admin` surface; `/backend/v3/api` through generated backend SDK; supports web, desktop, and large-screen tablet renderer targets when enabled |
| H5 mobile React | `APP_H5_ARCHITECTURE_SPEC.md`, then `APP_MOBILE_REACT_UI_SPEC.md` | `/app/v3/api` through generated app SDK and H5/Capacitor host adapters |
| App Flutter | `FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC.md`, then `APP_FLUTTER_UI_SPEC.md` | `/app/v3/api` through generated Dart/Flutter app SDK and platform adapters |
| Mini program app | `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md`, then `APP_MINI_PROGRAM_UI_SPEC.md` | `/app/v3/api` through generated TypeScript app SDK or approved mini program wrapper and host adapters |
| Android native app | `ANDROID_APP_MOBILE_ARCHITECTURE_SPEC.md`, then `APP_ANDROID_NATIVE_UI_SPEC.md` | `/app/v3/api` through generated Kotlin/Java app SDK or approved Android wrapper and host adapters |
| iOS native app | `IOS_APP_MOBILE_ARCHITECTURE_SPEC.md`, then `APP_IOS_NATIVE_UI_SPEC.md` | `/app/v3/api` through generated Swift app SDK or approved iOS wrapper and host adapters |
| Harmony native app | `HARMONY_APP_MOBILE_ARCHITECTURE_SPEC.md`, then `APP_HARMONY_NATIVE_UI_SPEC.md` | `/app/v3/api` through generated ArkTS/TypeScript app SDK adapted for Harmony runtime or approved Harmony wrapper and host adapters |
| Standalone backend/admin React | `BACKEND_UI_SPEC.md` | `backend-admin` surface; `/backend/v3/api` through generated backend SDK |

## 1. Layering

Standard frontend flow:

```text
App shell
  -> runtime providers
  -> appbase IAM runtime and global TokenManager
  -> feature routes/pages
  -> UI components
  -> services
  -> injected generated SDK clients
```

Rules:

- UI components `MUST` receive data, callbacks, and state through props, hooks, or providers.
- UI components `MUST NOT` call raw HTTP, manually set token or API key headers, parse JWTs for authorization, or choose tenant isolation rules.
- Services `MUST` call generated SDK clients or approved service interfaces.
- Runtime/bootstrap code `MUST` construct SDK clients, create the appbase IAM runtime, provide one global token manager for authenticated app-api SDK clients and explicit `backend-admin` backend-api SDK clients, provide token/context stores, and provide open-api API key credential providers when protected open-api SDKs are consumed.
- Runtime/bootstrap code `MUST` bind the same global token manager to `appbaseApp`, optional `backend-admin` `appbaseBackend`, every authenticated downstream app-api SDK client, and every explicit `backend-admin` backend-api SDK client through generated SDK credential APIs such as `setTokenManager`.
- IAM login/session bootstrap, AuthGate behavior, token refresh, logout clearing, and appbase auth UI/runtime integration `MUST` follow `IAM_LOGIN_INTEGRATION_SPEC.md`.
- App SDK and dependency composition `MUST` follow `APP_SDK_INTEGRATION_SPEC.md`; product UI packages consume dependency capabilities through generated SDKs, service ports, or approved composed wrappers.
- App shell code `MUST` stay thin: router, layout, providers, environment selection, host integration.
- Frontend work `MUST` select exactly one primary UI architecture through `UI_ARCHITECTURE_SPEC.md` before package placement.
- App/user-facing UI `MUST NOT` import `backend-admin` UI packages or call backend-api for user workflows.
- App/user-facing UI and PC user console UI `MUST` consume generated app SDK clients or approved appbase app wrappers for user-facing workflows, including contacts, address books, workspace navigation, and user-visible IAM directory read/list/tree resources. They `MUST NOT` import backend SDK packages, backend SDK wrapper functions, backend base URL resolvers, or appbase backend SDK clients.
- Every frontend package outside an explicit `backend-admin` boundary `MUST` use generated app SDK clients or approved app SDK wrappers for SDKWork remote capabilities. User-facing app packages, PC user console packages, shared frontend core packages, app auth runtime packages, and mobile/native/desktop renderer packages `MUST NOT` import, export, construct, proxy, or route through backend SDK clients.
- PC user console UI `MUST` stay in `sdkwork-<product>-pc-console-*` packages and must not import PC internal admin business internals.
- PC internal admin UI is `backend-admin`. It `MUST` stay in `sdkwork-<product>-pc-admin-*` packages and must follow backend-domain split rules from `BACKEND_UI_SPEC.md`.
- Standalone backend/admin UI `MUST NOT` be mixed into app UI packages and must follow business-domain backend package split rules from `BACKEND_UI_SPEC.md`.

## 1.1 UI Architecture Selection

Rules:

- PC React app UI uses `APP_PC_ARCHITECTURE_SPEC.md`, then `APP_PC_REACT_UI_SPEC.md`.
- PC user console UI uses `APP_PC_ARCHITECTURE_SPEC.md`, then `APP_PC_REACT_UI_SPEC.md`.
- PC internal admin UI uses `APP_PC_ARCHITECTURE_SPEC.md`, then `BACKEND_UI_SPEC.md`.
- H5 mobile React app UI uses `APP_H5_ARCHITECTURE_SPEC.md`, then `APP_MOBILE_REACT_UI_SPEC.md`.
- Flutter app UI uses `FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC.md`, then `APP_FLUTTER_UI_SPEC.md`.
- Mini program app UI uses `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md`, then `APP_MINI_PROGRAM_UI_SPEC.md`.
- Android native app UI uses `ANDROID_APP_MOBILE_ARCHITECTURE_SPEC.md`, then `APP_ANDROID_NATIVE_UI_SPEC.md`.
- iOS native app UI uses `IOS_APP_MOBILE_ARCHITECTURE_SPEC.md`, then `APP_IOS_NATIVE_UI_SPEC.md`.
- Harmony native app UI uses `HARMONY_APP_MOBILE_ARCHITECTURE_SPEC.md`, then `APP_HARMONY_NATIVE_UI_SPEC.md`.
- Standalone backend/admin React UI uses `BACKEND_UI_SPEC.md`.
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

PC application packages:
apps/<product>-pc/packages/sdkwork-<product>-pc-<capability>/
apps/<product>-pc/packages/sdkwork-<product>-pc-console-<capability>/
apps/<product>-pc/packages/sdkwork-<product>-pc-admin-<capability>/

Standalone backend/admin packages:
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

Architecture-specific standards may replace `package.json`, `src/`, and language folder names with Gradle/Kotlin, Swift Package, Dart, ArkTS, or mini program equivalents. The logical boundaries remain the same: public export, route/page/screen UI, services, state, host adapters, local view models, tests, and component specs.

Rules:

- `components/` contains reusable visual pieces.
- `pages/` contains route-level feature composition.
- `hooks/` contains React integration around services and state.
- `services/` contains SDK orchestration and domain methods.
- `state/` contains cache/view state only, not backend source-of-truth rules.
- `i18n/` contains package-local locale fragments and thin aggregation exports. It must not become an authored monolithic app or package catalog.
- `types/` contains local view models only. API DTOs come from generated SDKs or standard contracts.

The selected `architecture` must be one of:

- `pc-react`
- `pc-console-react`
- `pc-admin-react`
- `mobile-react`
- `mobile-flutter`
- `mini-program`
- `android-native`
- `ios-native`
- `harmony-native`
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
- Appbase login/session service ports `MUST` name the login authority `appbaseApp` or `appbaseAppClient`, not a generic `appClient`, so product SDK clients cannot be mistaken for the IAM authority.
- App-api service modules and explicit `backend-admin` backend-api service modules `MUST` receive token-manager-aware SDK clients from bootstrap. They must not create independent token stores, refresh flows, or login clients.
- Appbase current-user, login, registration, verification, OAuth, QR auth, password reset, refresh, current session, and logout calls `MUST` use appbase SDK resources or approved appbase wrappers.
- Services that consume protected open-api SDKs `MUST` receive injected SDK clients and an approved API key credential provider from runtime/bootstrap. They `MUST NOT` receive raw API key strings from UI components or construct `X-API-Key` headers manually.
- Frontend services MUST NOT generate requestId or xRequestId values, set `X-Request-Id`/`x-request-id`, or pass generated SDK `xRequestId` params. They may generate business `Idempotency-Key` values for retriable commands and must read returned `requestId` values from server responses when correlation is needed.
- File upload, download, import, and generated-asset storage services `MUST` use generated Drive SDK clients governed by `DRIVE_SPEC.md`. All client-side uploads must go through `sdkwork-drive-app-sdk client.uploader.*`; UI-local `File`, object URL previews, upload progress, local resumable state, and presigned URLs must remain transient view or service state.
- Media upload, picker, import, and generated-asset services `MUST` use `MediaResource` contracts from `MEDIA_RESOURCE_SPEC.md` once data crosses the business service boundary.
- Frontend DTO field names for media should use natural business roles such as `avatar`, `cover`, `thumbnail`, `poster`, `video`, `audio`, `file`, `document`, `asset`, `mainImage`, `galleryImage`, `detailImage`, or `skuImage`. Do not use redundant names such as `coverMedia` when the type is already `MediaResource`.

### 3.1 Drive Uploader Services

Frontend upload services are thin domain facades over Drive Uploader.

Standard service flow:

```text
UI file picker / platform asset
  -> feature upload service supplies attribution and profile
  -> injected Drive app SDK client.uploader.* uploads/resumes/completes
  -> service normalizes Drive result to Drive reference or MediaResource
  -> business SDK command stores the business relation
```

Rules:

- Runtime/bootstrap owns the concrete Drive app SDK client and injects it into upload services with the same global TokenManager used by authenticated app-api SDKs.
- Upload services `MUST` use high-level methods such as `client.uploader.upload`, `uploadByProfile`, `uploadImage`, `uploadVideo`, `uploadAudio`, `uploadDocument`, `uploadArchive`, `uploadText`, `uploadDataset`, `uploadAttachment`, `uploadAvatar`, or `uploadThumbnail`.
- Upload services `MUST` supply `tenantId`, optional `organizationId`, current `userId` or allowed `anonymousId`, `appId`, `appResourceType`, `appResourceId`, optional `scene`, optional `source`, `uploadProfileCode`, and retention from application context or feature configuration.
- UI components `MUST NOT` assemble Drive Uploader request metadata except user-selected file facts and explicit field-level intent such as media role. Components do not own `appId`, `appResourceType`, `appResourceId`, `scene`, `source`, object keys, upload session ids, or retention policy.
- Feature code `MUST NOT` call raw `fetch`, `axios`, generic request clients, or handwritten SDKs against `/app/v3/api/drive/uploader/*`, `/app/v3/api/drive/upload_sessions/*`, S3, OSS, MinIO, local file-store, or provider presign endpoints. The Drive SDK composed uploader may perform the raw byte upload to the short-lived provider URL returned by Drive.
- Business form payloads `MUST` contain only Drive references, Drive-backed `MediaResource` values, or business relation ids after upload completion. They must not submit `File`, object URL, presigned URL, provider URL, bucket, object key, upload part list, or local uploader state.
- Product-specific upload widgets may exist, but they are UI wrappers over an injected upload service. They are not alternate upload engines.

## 4. State And Cache

Rules:

- Server state `SHOULD` be fetched through services and cached with a predictable query key strategy.
- Query keys `SHOULD` include domain, resource, tenant/organization scope when safe, and stable parameters.
- Auth/session state `MUST` react to token refresh, logout, tenant switch, and permission changes.
- Auth/session state `MUST` clear according to `IAM_LOGIN_INTEGRATION_SPEC.md`: persisted session, app-api SDK token managers, explicit `backend-admin` backend-api SDK token managers, approved open-api credential provider state when present, realtime connections, sensitive caches, and native secure storage when present.
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
- [ ] Appbase IAM runtime and one global token manager are wired in runtime/bootstrap when authenticated app-api SDK clients or explicit `backend-admin` backend-api SDK clients are used.
- [ ] Architecture-specific SDK language and dependency SDK composition follow `APP_SDK_INTEGRATION_SPEC.md`.
- [ ] No raw HTTP, manual auth headers, or manual API key headers exist in shared business modules.
- [ ] Upload services use injected Drive app SDK `client.uploader.*`, supply required attribution/profile/retention metadata, and persist only Drive references or `MediaResource`.
- [ ] UI upload components keep files, previews, progress, retry state, and presigned URLs transient.
- [ ] Auth/session/tenant switch clears sensitive state.
- [ ] Permission-denied and validation-error states are covered.
- [ ] Keyboard and accessible labels are covered for interactive controls.
- [ ] Tests cover service behavior and representative UI integration.
