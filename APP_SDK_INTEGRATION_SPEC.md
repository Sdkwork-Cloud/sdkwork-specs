# App SDK Integration And Composition Standard

- Version: 1.0
- Scope: app SDK integration across PC React, H5 mobile React, Flutter, mini program, native Android, native iOS, native HarmonyOS, desktop/native, Rust-enabled apps, Drive Uploader, app dependency composition, appbase IAM runtime, and global token-manager wiring
- Related: `APPLICATION_SPEC.md`, `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md`, `MODULE_SPEC.md`, `COMPONENT_SPEC.md`, `FRONTEND_SPEC.md`, `UI_ARCHITECTURE_SPEC.md`, `APP_PC_REACT_UI_SPEC.md`, `APP_MOBILE_REACT_UI_SPEC.md`, `APP_FLUTTER_UI_SPEC.md`, `APP_MINI_PROGRAM_UI_SPEC.md`, `APP_ANDROID_NATIVE_UI_SPEC.md`, `APP_IOS_NATIVE_UI_SPEC.md`, `APP_HARMONY_NATIVE_UI_SPEC.md`, `H5_APP_MOBILE_ARCHITECTURE_SPEC.md`, `FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC.md`, `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md`, `ANDROID_APP_MOBILE_ARCHITECTURE_SPEC.md`, `IOS_APP_MOBILE_ARCHITECTURE_SPEC.md`, `HARMONY_APP_MOBILE_ARCHITECTURE_SPEC.md`, `DESKTOP_APP_ARCHITECTURE_SPEC.md`, `WEB_BACKEND_SPEC.md`, `API_SPEC.md`, `SDK_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md`, `DRIVE_SPEC.md`, `MEDIA_RESOURCE_SPEC.md`, `IAM_LOGIN_INTEGRATION_SPEC.md`, `CONFIG_SPEC.md`, `ENVIRONMENT_SPEC.md`, `SECURITY_SPEC.md`, `TEST_SPEC.md`

This standard defines how SDKWork applications integrate generated SDKs and reusable appbase capabilities without copying APIs, forking clients, or creating local auth behavior. Applications are composition roots. Product apps compose dependency SDKs, shared modules, appbase IAM runtime, Rust route/service crates, and architecture-specific UI packages through explicit boundaries. The application root owns one SDK credential topology for every runtime target; feature packages only receive injected clients, services, or ports.

The normative IAM reference is `sdkwork-appbase`:

- `packages/common/iam/sdkwork-iam-runtime/src/index.ts`
- `packages/common/iam/sdkwork-iam-runtime/tests/iam-runtime.standard.test.ts`
- `packages/common/iam/sdkwork-iam-sdk-adapter/src/index.ts`
- `packages/pc-react/iam/sdkwork-iam-react/src/index.tsx`
- `packages/pc-react/iam/sdkwork-auth-pc-react/src/auth-service.ts`

Those packages implement the standard runtime shape: `createIamRuntime(...)` creates or receives one `AuthTokenManager` from `@sdkwork/sdk-common/createTokenManager`, binds the same manager to `appbaseApp`, optional `appbaseBackend`, and every downstream `sdkClients` entry through `setTokenManager`, persists tokens in a `tokenStore`, persists `AppContext` in a `contextStore`, emits standard dual-token headers through `getAuthHeaders()`, and clears local token/context state even when remote logout fails.

Product applications normally consume a higher-level appbase auth runtime factory for their architecture, for example `@sdkwork/auth-runtime-pc-react` `createSdkworkAppbasePcAuthRuntime(...)` on PC React. The low-level `@sdkwork/iam-runtime` and `@sdkwork/iam-sdk-adapter` packages are appbase implementation details or approved wrapper internals. Product app bootstrap code provides app identity, runtime config, generated SDK clients, the global TokenManager, and session bridge hooks to the high-level factory; it must not reassemble appbase IAM adapters locally when an architecture-level appbase runtime factory exists.

Every SDKWork application uses this as the TokenManager closure rule: within one authenticated session context, every SDK client that sends SDKWork app-api or backend-api dual-token credentials `MUST` share the same `TokenManager` instance. This includes appbase SDKs, product app/backend SDKs, dependency app/backend SDKs such as Drive, Messaging, IM, and any approved composed wrapper backed by those SDKs. Public SDKs that need no credentials receive no token manager. Protected open-api SDKs that declare API key mode receive a separate API key credential provider and `MUST NOT` be added to the login TokenManager client list.

## 1. Composition Model

Standard app composition:

```text
application root
  -> app shell/bootstrap
  -> architecture-specific UI package
  -> service/facade package
  -> generated language SDK client or approved wrapper
  -> appbase IAM runtime and global TokenManager
  -> product app-api/backend-api/open-api SDKs
  -> Rust route/service crates or Java backend controllers
  -> dependency SDKs and reusable modules
```

Rules:

- An application root `MUST` be a composition layer, not a source-copy layer.
- App shells `MUST` own routing, providers, runtime config, SDK construction, token/session bootstrap, host adapters, and composition of feature packages.
- Feature packages `MUST` receive services, ports, generated SDK clients, host adapters, and runtime inputs through explicit injection.
- Product apps `MUST NOT` copy dependency routes, SDK generated output, appbase IAM packages, appbase DTOs, or dependency service internals into the product repo for convenience.
- Product apps `MUST NOT` regenerate dependency-owned APIs into product SDK families. Dependency capabilities are consumed through dependency SDK packages, approved composed wrappers, or runtime service interfaces.
- Cross-app reuse `MUST` happen through published modules, generated SDKs, component specs, `sdkDependencies`, or approved composed facades. It must not happen through imports of another app's private `src` paths.
- Shared pure contracts may be framework-neutral. UI components, host adapters, and platform-specific runtime code stay in their own architecture family.
- Services may compose multiple SDK calls into a domain use case, but they `MUST NOT` hide a missing backend capability with raw HTTP or local DTO forks.

## 2. Dependency Relationships

Applications depend on each other through stable artifacts.

| Dependency kind | Consume through | Forbidden |
| --- | --- | --- |
| Appbase IAM/session/workspace/bootstrap | `sdkwork-appbase` packages, generated appbase SDKs, appbase Rust crates | product-local login routes, copied auth UI, regenerated appbase APIs |
| Drive upload/download/storage | Client upload through `sdkwork-drive-app-sdk client.uploader.*`; server-side Rust upload through `DriveUploaderService` or approved `sdkwork_drive_product::uploader`; product SDKs accept Drive references or `MediaResource` | product-local upload endpoints, raw Drive HTTP, provider SDK calls, app-local upload tables/counters, regenerating Drive APIs into product SDKs |
| Product app API | generated `sdkwork-<domain>-app-sdk` for the target language | raw HTTP, backend SDK, route constants |
| Product backend API | generated `sdkwork-<domain>-backend-sdk` for admin/operator clients | app SDK for operator resources, raw HTTP |
| Product open/domain API | generated `sdkwork-<domain>-sdk` with declared open-api credential mode | app login token manager unless explicitly declared by contract |
| Rust route capability | route manifest, aggregated authority, generated SDK family | frontend import of Rust route crates or path constants |
| Reusable UI/service package | package root export and component spec | imports from private package internals |
| Host/native capability | typed host adapter | business API calls from native globals |

Rules:

- Each application or independent git repository that owns APIs owns its local `sdks/` workspace.
- The product SDK family generates only product-owned operations. Appbase, Drive, provider, and other reusable dependency operations stay in their own SDK families.
- File upload is a Drive dependency capability. Product app/backend SDKs should accept `driveUri`, `driveSpaceId`, `driveNodeId`, Drive references, or Drive-backed `MediaResource` values after upload; they must not add product-local upload-session, presign, part, or completion methods.
- `sdkDependencies` `MUST` declare dependency SDK families in SDK assembly metadata and component specs when a product SDK or composed facade depends on them.
- A consuming application may compose dependency SDKs in runtime/bootstrap, service facades, or approved composed packages outside generated transport ownership.
- Generated transport output `MUST NOT` import, vendor, re-export, or rewrite dependency SDK packages.
- Component specs `MUST` expose the dependency contract clearly enough that a consumer can tell whether it depends on a generated SDK, a composed wrapper, a service port, or a host adapter.

### 2.1 Drive Uploader Composition

Applications that upload files must compose Drive Uploader as a dependency, not as product-local infrastructure.

Rules:

- Client upload services `MUST` receive an injected Drive app SDK client or a narrow facade backed by `sdkwork-drive-app-sdk client.uploader.*`.
- Runtime/bootstrap `MUST` create the Drive app SDK client with its own Drive App API base URL and bind the same global TokenManager when the Drive App API surface is authenticated.
- Service facades may expose domain names such as `uploadAvatar`, `uploadAttachment`, or `uploadCatalogImage`, but their implementation must delegate to `client.uploader.uploadAvatar`, `client.uploader.uploadAttachment`, `client.uploader.uploadImage`, `client.uploader.uploadByProfile`, or another approved Drive uploader method.
- Product service facades must supply Drive Uploader attribution from application context: `tenantId`, optional `organizationId`, user or anonymous actor, `appId`, `appResourceType`, `appResourceId`, optional `scene`, optional `source`, `uploadProfileCode`, and retention.
- UI components may select files, preview files, display progress, retry, and remove local selections. They must not create upload task ids, provider object keys, Drive presign URLs, or statistic dimensions directly.
- Server-side Rust application services that upload generated/imported bytes `MUST` call `DriveUploaderService`, `PrepareUploaderUploadCommand`, or an approved Drive product uploader facade. They must not call Drive App API over HTTP from the same trusted backend just to reuse client routes.
- Product SDK generation `MUST NOT` include Drive uploader App API operations in the product authority. Drive uploader operations stay in the Drive SDK family and are declared as dependencies when composed.

## 3. Architecture-Specific SDK Families

Each application architecture uses the SDK family and IAM wrapper that match its language and runtime.

| Architecture | SDK language | Required SDK boundary | IAM/appbase boundary |
| --- | --- | --- | --- |
| App PC React | TypeScript | generated TypeScript app SDKs plus service ports | `@sdkwork/iam-runtime`, `@sdkwork/iam-react`, `@sdkwork/auth-pc-react`, `@sdkwork/appbase-app-sdk` |
| H5 app mobile React | TypeScript | generated TypeScript app SDKs plus typed H5/Capacitor host adapters | appbase mobile wrapper when available, otherwise the same generated appbase app SDK through an approved mobile runtime adapter |
| App Flutter | Dart/Flutter | generated Dart/Flutter app SDKs plus platform adapters | generated Dart/Flutter appbase app SDK or approved appbase Flutter wrapper |
| Mini program app | TypeScript | generated TypeScript app SDKs adapted for mini program runtime plus typed mini program host adapters | appbase mini program wrapper when available, otherwise the same generated appbase app SDK through an approved mini program runtime adapter |
| Android native app | Kotlin/Java | generated Kotlin/Java app SDKs plus typed Android host adapters | generated Kotlin/Java appbase app SDK or approved appbase Android wrapper |
| iOS native app | Swift | generated Swift app SDKs plus typed iOS host adapters | generated Swift appbase app SDK or approved appbase iOS wrapper |
| Harmony native app | ArkTS/TypeScript | generated ArkTS/TypeScript app SDKs adapted for Harmony runtime plus typed HarmonyOS host adapters | appbase Harmony wrapper when available, otherwise generated appbase app SDK through an approved Harmony runtime adapter |
| Desktop/Tauri renderer | TypeScript | generated TypeScript app SDKs injected by renderer bootstrap | appbase IAM runtime in renderer, native secure storage only through host adapter |
| Rust local/private backend | Rust | generated Rust dependency SDKs or Rust service traits for dependency calls | appbase Rust crates for context/auth/bootstrap and generated appbase SDKs when Rust calls appbase HTTP APIs |
| Backend/admin React | TypeScript | generated TypeScript backend SDKs | appbase backend SDK for IAM administration, no user-facing auth session creation |

Rules:

- App-side UI packages `MUST` consume app-api through the generated app SDK for their language or through an approved appbase wrapper built on that SDK.
- Backend/admin UI packages `MUST` consume backend-api through generated backend SDKs or approved backend wrappers.
- Flutter packages `MUST` use generated Dart/Flutter SDK clients. They must not call TypeScript wrappers or React packages.
- Android native packages `MUST` use generated Kotlin/Java SDK clients. They must not call TypeScript, Dart/Flutter, Swift, ArkTS, or React wrappers.
- iOS native packages `MUST` use generated Swift SDK clients. They must not call TypeScript, Dart/Flutter, Kotlin/Java, ArkTS, or React wrappers.
- Harmony native packages `MUST` use generated ArkTS/TypeScript SDK clients adapted for Harmony runtime or approved Harmony wrappers. They must not call React browser wrappers, Dart/Flutter wrappers, Kotlin/Java wrappers, or Swift wrappers.
- Rust service and native runtime code that calls HTTP APIs directly `MUST` use generated Rust SDKs or approved Rust service clients. It must not embed frontend TypeScript SDK behavior.
- Open-api SDKs use the credential mode declared by the open-api contract. Protected API-key open-api clients use API key providers, not the app login token manager.
- Architecture-specific wrappers may normalize storage, platform lifecycle, or host integration, but they `MUST` remain thin wrappers over generated SDK resources and appbase runtime behavior.
- Missing SDK methods `MUST` be fixed in the owning API contract, OpenAPI authority, generator inputs, and generated SDK family before the app integrates the capability.

## 4. Appbase IAM Runtime Standard

Login, registration, session, and IAM runtime behavior are appbase capabilities.

Standard low-level runtime shape implemented by appbase packages and approved architecture wrappers:

```ts
import { createTokenManager } from "@sdkwork/sdk-common";
import { createIamRuntime } from "@sdkwork/iam-runtime";

const tokenManager = createTokenManager();

const sdkBaseUrls = resolveSdkBaseUrls(runtimeConfig);

const productAppSdk = createProductAppSdk({
  baseUrl: sdkBaseUrls.appApiBaseUrl,
  tokenManager,
});

const productBackendSdk = sdkBaseUrls.backendApiBaseUrl
  ? createProductBackendSdk({
      baseUrl: sdkBaseUrls.backendApiBaseUrl,
      tokenManager,
    })
  : undefined;

const iamRuntime = createIamRuntime({
  clients: {
    appbaseApp,
    appbaseBackend,
    sdkClients: [
      productAppSdk,
      productBackendSdk,
    ],
  },
  config,
  tokenManager,
  tokenStore,
  contextStore,
});
```

Rules:

- Every authenticated application runtime `MUST` create exactly one global `TokenManager` or language-equivalent token manager per authenticated session context.
- Product application bootstrap `MUST` consume the approved high-level appbase auth runtime/factory for its architecture when one exists, for example `createSdkworkAppbasePcAuthRuntime(...)` for PC React.
- Product application bootstrap `MUST NOT` import `@sdkwork/iam-sdk-adapter`, call `createIamAppSdkAdapter(...)`, call `createIamBackendSdkAdapter(...)`, or locally wire appbase SDK resources into IAM ports when an appbase high-level runtime/factory can do that wiring.
- Product application bootstrap `MUST NOT` call `createIamRuntime(...)` directly except inside an approved appbase-owned wrapper package or a documented temporary compatibility wrapper that exposes the same high-level inputs and is tracked for removal.
- Runtime/bootstrap `MUST` resolve SDK base URLs from `CONFIG_SPEC.md` and `ENVIRONMENT_SPEC.md` before creating generated SDK clients.
- Product app SDK, product backend SDK, appbase app SDK, appbase backend SDK, Drive SDK, IM SDK, and other dependency SDK base URLs `MUST` be configured per SDK surface. They must not be hidden behind one ambiguous `API_BASE_URL` when the surfaces can deploy independently.
- Base URL config may come from private process env, public browser runtime env, or runtime TOML depending on target, but token values must never come from these config sources.
- Runtime/bootstrap `MUST` build an SDK inventory before constructing feature services. The inventory classifies each SDK as authenticated app-api, authenticated backend-api, protected open-api API-key, public open-api, local/native, or test fake.
- The same `TokenManager` instance `MUST` be passed to `@sdkwork/appbase-app-sdk`, optional `@sdkwork/appbase-backend-sdk`, every product app/backend SDK client, and every dependency app/backend SDK client that participates in authenticated dual-token calls.
- Generated SDK clients that support `setTokenManager(manager)` `MUST` receive the same instance during bootstrap. Generated SDK clients that accept `tokenManager` in a constructor `MUST` receive that same instance instead of a package-local manager.
- The appbase app SDK client `MUST` be named `appbaseApp` or `appbaseAppClient` in runtime code so it cannot be confused with product app SDK clients.
- Product and dependency app/backend SDK clients `MUST` be passed as downstream `sdkClients` or the local language equivalent. They must not own login, token refresh, independent token stores, independent `TokenManager` instances, or session restoration.
- Applications `MUST NOT` create per-domain, per-package, per-service, or per-SDK TokenManagers for the same authenticated session. Account switch, tenant switch, logout, refresh failure, or session replacement creates or clears the application session context as a whole, then rebinds every authenticated SDK through the single runtime path.
- Login, registration, OAuth, QR auth, password reset, current session, refresh, logout, runtime metadata, and current-user self-service `MUST` call appbase app SDK resources under `appbaseApp.auth.*`, `appbaseApp.openPlatform.qrAuth.*`, `appbaseApp.system.iam.*`, and `appbaseApp.iam.users.current.*`. Verification-code delivery and verification `MUST` call the generated messaging app SDK surface under `messagingApp.messaging.verificationCodes.*` or the approved appbase auth wrapper that delegates to that injected messaging client.
- Backend/admin IAM management `MUST` use `appbaseBackend.iam.*`. Backend SDK clients `MUST NOT` expose an `auth` namespace for user-facing session creation.
- Reusable auth services `MUST` expose `commitSession(session, options?)`, not `persistSession`.
- `commitSession` `MUST` validate and normalize the appbase session, persist `authToken`, `accessToken`, and optional `refreshToken`, write returned `AppContext` or clear stale context, then sync the global token manager.
- Token persistence failure `MUST NOT` update the in-memory token manager.
- Context propagation failure after token persistence `MUST` clear token store, context store, and token manager before rejecting.
- New session flows `MUST NOT` inherit an old `refreshToken` when appbase does not return one.
- Current-session bootstrap, current-session update, refresh continuation, and equivalent restoration flows may preserve the existing refresh token only through `commitSession(session, { preserveRefreshToken: true })`.
- `getAuthHeaders()` or the language-equivalent runtime helper may expose `Authorization: Bearer <authToken>`, `Access-Token: <accessToken>`, and optional locale headers for approved runtime bridges. UI and feature services must not manually assemble these headers.
- Applications `MUST NOT` define or consume env variables such as `AUTH_TOKEN`, `ACCESS_TOKEN`, `REFRESH_TOKEN`, `VITE_*_TOKEN`, or `PORTAL_PUBLIC_*_TOKEN` for live login/session credentials. Access token capability is provided by appbase IAM session flows and the global TokenManager.
- Logout and refresh failure `MUST` clear local token store, global token manager, context store, sensitive caches, realtime/session bridges, and native secure storage when present, even when remote session deletion fails.

## 5. Rust Backend Composition

Rust backends participate in composition through route crates, service crates, dependency SDKs, and appbase runtime crates.

```text
packages/native-rust/routes/app-api/sdkwork-routes-product-app-api
  -> route manifest
  -> sdkwork-commerce-app-api
  -> sdkwork-commerce-app-sdk
  -> frontend/service consumes generated SDK
```

Rules:

- Rust route crates `MUST` follow `sdkwork-routes-<capability>-open-api`, `sdkwork-routes-<capability>-app-api`, or `sdkwork-routes-<capability>-backend-api`.
- Rust route crates own route/path configuration, handler binding, and route manifests for one capability and one surface. They do not become frontend path libraries.
- Application shells aggregate route manifests into project/domain API authorities such as `sdkwork-commerce-app-api`, then generate owner-only SDK families.
- Rust local/private implementations that expose or validate appbase IAM/session/context behavior `MUST` depend on appbase Rust crates. Product Rust services must not fork appbase auth guards, context extraction, token validation, or bootstrap behavior.
- Protected Rust business routes `MUST` validate dual tokens plus typed `AppContext` or a signed trusted context projection according to `IAM_LOGIN_INTEGRATION_SPEC.md`.
- Rust services that call dependency-owned APIs directly `MUST` use generated dependency SDKs or approved service traits. They must not copy OpenAPI routes into the product authority.
- Tauri/native commands may start or bridge local Rust runtimes, but they `MUST NOT` own business authentication or become hidden app-api/backend-api surfaces.

### 5.1 Rust Backend Dependency API Composition

Dependency API composition distinguishes route contracts from mounted handlers.

Rules:

- Rust backend integration `MUST` import dependency crates through public package exports or
  approved service traits. It must not import private dependency `src` files, copy route constants,
  or duplicate dependency handlers in the product crate.
- A dependency route contract, route manifest, or metadata export can describe expected method/path
  coverage, but it is not an executable router. Same-process mounting requires a dependency-owned
  executable router, controller, handler adapter, or approved runtime service export.
- If a dependency crate exposes only route contract metadata, the consuming app `MUST` treat that
  surface as an external dependency service for SDK client base URL purposes until an executable
  router export and coverage test exist.
- Application roots that mount dependency APIs through the same origin `MUST` record the mount in
  `dependencyApiSurfaces` with `sameOriginAllowed: true`, an executable router export, and coverage
  evidence comparing dependency route contracts or OpenAPI paths against the runtime router.
- Application roots that do not mount the dependency executable router `MUST` configure dependency
  SDK clients with explicit dependency base URLs and fail fast when those base URLs are missing.
- Backend/admin appbase IAM management uses the appbase backend SDK and backend dependency base URL;
  it must not fall back to a product backend route prefix unless appbase backend IAM executable
  routes are mounted and verified in the product runtime.

## 6. Frontend Service And Component Rules

Frontend applications compose UI packages, services, SDK clients, IAM runtime, and host adapters.

Rules:

- Runtime/bootstrap constructs concrete SDK clients, the global token manager, appbase IAM runtime, API key providers, secure storage adapters, and host adapters.
- UI packages call hooks/services. Hooks/services call injected SDK clients or narrow service ports.
- UI components `MUST NOT` construct SDK clients, parse tokens, set `Authorization`, set `Access-Token`, set `X-API-Key`, or call raw `fetch`/`axios` for app business.
- Service facades should preserve generated SDK resource names unless they intentionally compose multiple SDK calls into a domain use case.
- Component packages `MUST` define their external dependencies through package root exports and component specs. Consumers should be able to wire the package without reading private implementation files.
- Shared cross-architecture state must be modeled as contracts or service ports. React state, Flutter blocs/controllers, Android view models, iOS view models, Harmony view models, and host lifecycle code do not cross architecture families.
- IAM user/session state is a runtime concern. Feature packages may observe authenticated user/context through injected services, but they `MUST NOT` persist their own copy of tokens or AppContext.

## 7. Verification

Required checks for app SDK composition:

| Verification | Evidence |
| --- | --- |
| Appbase IAM boundary | Static scan shows login/register/session/refresh/logout/current-user calls use appbase SDK resources or appbase wrappers, and product app bootstrap uses the approved high-level appbase auth runtime/factory instead of low-level IAM SDK adapters. |
| SDK inventory closure | Tests or deterministic static checks list every appbase, product, and dependency SDK consumed by the app and classify its credential mode before service construction. |
| Global TokenManager | Tests prove one `TokenManager` is bound to appbase app, optional appbase backend, product app/backend SDKs, dependency app/backend SDKs, and approved composed wrappers through `setTokenManager`, constructor injection, or the language equivalent. |
| Session commit order | Tests prove persistence failure does not update token manager, context propagation failure rolls back token/context state, stale context is cleared, and continuation flows preserve refresh token only when allowed. |
| Logout clearing | Tests prove local token/context state clears even when remote logout fails. |
| Architecture SDK boundary | Static scans prove PC React/H5 mobile React/Flutter/mini program/Android/iOS/Harmony/backend-admin packages use the correct generated SDK language and surface. |
| Drive Uploader dependency | Tests and static scans prove upload-capable apps use injected `sdkwork-drive-app-sdk client.uploader.*`, Rust server upload paths use `DriveUploaderService` or an approved Drive product facade, and product SDK authorities do not contain Drive uploader operations. |
| No transport bypass | Static scans prove no raw HTTP, manual auth headers, local DTO forks, generated SDK edits, product-local appbase auth routes, direct product-side `@sdkwork/iam-sdk-adapter` imports, or product-side `createIamRuntime(...)` wiring were introduced. |
| Rust composition | Route manifest tests prove route crate naming, authority aggregation, owner-only SDK generation, and no frontend imports of route crates. |
| Dependency ownership | SDK ownership checks prove dependency-owned appbase/Drive/provider routes are declared as dependencies and not regenerated into product SDKs. |
| Backend SDK auth namespace | Tests prove backend SDK IAM clients do not expose user-facing `auth.sessions.create` or equivalent login/session creation. |

Suggested scan categories:

```text
rg -n "fetch\\(|axios\\.|Authorization|Access-Token|X-API-Key" apps/<product>
rg -n "/drive/uploader|/drive/upload_sessions|client\\.uploader|DriveUploaderService|sdkwork_drive_product::uploader" apps/<product>
rg -n "auth\\.sessions|auth\\.registrations|iam\\.users\\.current|openPlatform\\.qrAuth" apps/<product>
rg -n "sdkwork-routes-.*-(app-api|backend-api|open-api)" apps/<product>/packages
rg -n "createSdkworkAppbase.*AuthRuntime|setTokenManager|tokenManager|createIamRuntime|createTokenManager|commitSession" apps/<product> apps/sdkwork-appbase
rg -n "@sdkwork/iam-sdk-adapter|createIamAppSdkAdapter|createIamBackendSdkAdapter" apps/<product>
rg -n "createTokenManager\\(|new .*TokenManager|setAuthToken|setAccessToken" apps/<product>
```

## 8. Acceptance Checklist

- [ ] Application root composes dependencies instead of copying source, routes, DTOs, or generated SDK output.
- [ ] Product SDK families generate only product-owned operations.
- [ ] Dependency SDK families are declared through `sdkDependencies`, component specs, or approved composed wrappers.
- [ ] Upload-capable apps declare Drive app SDK as a dependency, client upload services call `client.uploader.*`, Rust server upload services call the Drive product uploader component, and product SDKs accept only Drive references or `MediaResource`.
- [ ] The selected UI architecture uses the matching generated SDK language and surface.
- [ ] Runtime/bootstrap declares or derives an SDK inventory and classifies each SDK credential mode before services are constructed.
- [ ] Runtime/bootstrap uses the approved high-level appbase auth runtime/factory for the architecture and does not locally wire low-level IAM SDK adapters in product code.
- [ ] Runtime/bootstrap creates exactly one global `TokenManager` per authenticated session context.
- [ ] Appbase app SDK, optional appbase backend SDK, every product app/backend SDK, every dependency app/backend SDK, and every approved composed wrapper backed by those SDKs share that same `TokenManager`.
- [ ] Protected open-api SDKs that declare API key mode use a separate API key credential provider and are not placed in app/backend TokenManager client lists.
- [ ] Login, registration, session, refresh, logout, QR/OAuth, password reset, runtime metadata, and current-user self-service use appbase app SDK resources, while verification-code delivery uses the generated messaging app SDK surface.
- [ ] Backend/admin IAM management uses appbase backend SDK and does not expose user-facing auth session creation.
- [ ] Rust route crates and route aggregation follow the route crate -> API authority -> SDK family model.
- [ ] Frontend services use injected SDK clients and no raw HTTP/manual auth header fallback.
- [ ] Logout, refresh failure, token persistence failure, context rollback, stale context clearing, and refresh-token continuation behavior are tested.
