# IAM Login Integration Standard

- Version: 1.0
- Scope: fast IAM login/session integration, sdkwork-appbase auth modules, generated app SDK wiring, route guards, logout behavior, Rust AppContext validation, Tauri/local/private runtime boundaries
- Related: `IAM_SPEC.md`, `API_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, `SDK_SPEC.md`, `FRONTEND_SPEC.md`, `APP_PC_REACT_UI_SPEC.md`, `DESKTOP_APP_ARCHITECTURE_SPEC.md`, `SECURITY_SPEC.md`, `DEPLOYMENT_SPEC.md`, `TEST_SPEC.md`

This standard defines how SDKWork applications integrate IAM login and session validation without reimplementing auth flows in product apps.

`sdkwork-appbase` owns reusable login, registration, token refresh, current session, logout, OAuth, QR login, password reset, IAM runtime metadata, and IAM runtime bootstrap through `@sdkwork/appbase-app-sdk` generated from `sdkwork-appbase-app-api`. Verification-code delivery and verification are owned by `sdkwork-messaging` and must be consumed through the generated messaging app SDK surface when IAM flows need them. Product applications compose these capabilities through appbase UI/runtime packages, the generated appbase app SDK client, and an injected messaging app SDK client for verification-code operations.

Cross-architecture SDK composition and global token-manager wiring follow `APP_SDK_INTEGRATION_SPEC.md`. This file owns the IAM-specific login/session behavior and security invariants.

## 1. Integration Position

Standard login architecture:

```text
app shell
  -> AuthGate / route guard
  -> sdkwork-appbase auth UI/runtime
  -> app auth service facade
  -> @sdkwork/appbase-app-sdk appbaseApp client
  -> global tokenManager shared by app-api SDK clients and explicit backend-admin backend-api SDK clients
  -> /app/v3/api/auth/* and /app/v3/api/iam/*
  -> protected product app-api SDK clients and explicit backend-admin backend-api SDK clients
  -> Rust/Java business APIs validate dual tokens and AppContext
```

Rules:

- Product apps `MUST` integrate IAM login through `sdkwork-appbase` packages or approved wrappers.
- Product apps `MUST` perform login, registration, current-session validation, refresh, logout, OAuth, QR auth, password reset, runtime metadata, and current-user self-service through `@sdkwork/appbase-app-sdk`; verification-code delivery and verification `MUST` go through the generated messaging app SDK surface or an appbase wrapper that delegates to an injected messaging client. Product apps must not inject unrelated business SDK clients as login clients.
- Product apps `MUST` provide one global token manager per authenticated session context and pass the same instance to `@sdkwork/appbase-app-sdk`, every product/dependency app SDK, explicit `backend-admin` `@sdkwork/appbase-backend-sdk`, explicit `backend-admin` product/dependency backend SDKs, and approved composed wrappers backed by those SDKs.
- Product apps `MUST` use the approved high-level appbase auth runtime/factory for the selected architecture when available, for example `@sdkwork/auth-runtime-pc-react` `createSdkworkAppbasePcAuthRuntime(...)` for PC React. Product code supplies app identity, runtime config, SDK inventory clients, the global token manager, and session bridge hooks; appbase owns the low-level IAM adapter wiring.
- Product apps `MUST NOT` import `@sdkwork/iam-sdk-adapter`, call `createIamAppSdkAdapter(...)`, call `createIamBackendSdkAdapter(...)`, or call `createIamRuntime(...)` directly for appbase login integration when a high-level appbase runtime/factory exists. Those calls belong in `sdkwork-appbase` packages or approved compatibility wrappers only.
- Product apps `MUST NOT` create local `/auth/login`, `/auth/refresh`, `/auth/me`, `/app/v3/api/auth/*`, or user-center session endpoints when the capability is already owned by `sdkwork-appbase`, `sdkwork-appbase-app-api`, or `sdkwork-appbase-app-sdk`.
- Login/session APIs `MUST` live in app-api only. Open-api domains such as Craw Chat IM (`/im/v3/api`), backend-api, Tauri commands, and product-local Rust routes may validate credentials or session projections when their contract requires it, but must not own user-facing login creation.
- Auth services, controllers, reusable local adapters, canonical authority bridges, and runtime user-center bridges `MUST NOT` synthesize an authenticated SDKWork session from a user/profile object, user id, email, username, legacy user-center `sessionId`, cached user, QR key, bridge hint, or test helper. Every login, registration, OAuth, verification-code login, QR completion, session-bridge, refresh, current-session update, and bootstrap success path `MUST` receive and validate a real appbase IAM `SdkworkAuthSession` with non-empty `authToken` and `accessToken` before reporting authenticated state, writing session storage, or updating the global TokenManager. Unsupported modes, incomplete sessions, and user-only results `MUST` fail closed.
- Current-session bootstrap `MUST` call `@sdkwork/appbase-app-sdk` `auth.sessions.current.retrieve()` when that SDK resource is available. If current-session validation fails, the runtime `MUST` clear centralized session storage, context storage, token manager state, and sensitive session bridges, then report anonymous state; it `MUST NOT` fall back to cached user/profile data or locally stored tokens.
- Registration and password-reset services `MUST` preserve literal password values, `MUST NOT` synthesize a missing confirmation by copying the password into `confirmPassword`, and `MUST` reject an explicitly provided password confirmation that differs from the password before calling SDK resources. UI confirmation checks do not replace this service/runtime boundary check, and backend handlers must enforce the same rule.
- Development verification-code configuration may prefill UI input fields only. It `MUST NOT` skip `messaging.verificationCodes.create`, `messaging.verificationCodes.verify`, password-reset request creation, registration creation, or session creation, and new configuration names should use `prefill` instead of `bypass`.
- Product open-api SDKs that declare API key security `MUST` receive credentials through an API key credential provider or approved compatibility provider, not through the app login token manager.
- UI components `MUST NOT` call raw HTTP, manually assemble `Authorization` or `Access-Token`, parse JWTs for authorization, or store duplicate token DTOs.
- Product/dependency app SDKs and explicit `backend-admin` backend SDKs `MUST NOT` own login, parse tokens, refresh tokens independently, or persist second session state; they only consume the global token manager for request authentication.
- Protected business services `MUST` consume a verified session projection through typed context, not through body/query tenant or user fields.

## 2. Standard Packages

Use the smallest package set needed for the target UI architecture.

| Concern | Standard package or layer | Responsibility |
| --- | --- | --- |
| Appbase shell primitives | `@sdkwork/appbase-pc-react` or architecture equivalent | capability manifest, appbase layout/runtime utilities |
| PC auth UI | `@sdkwork/auth-pc-react` | login/register/forgot-password/OAuth/QR auth routes and forms |
| IAM runtime | `@sdkwork/iam-runtime` | `createIamRuntime`, token/context stores, `getAuthHeaders`, appbase SDK validation, global token-manager binding |
| Architecture auth runtime | `@sdkwork/auth-runtime-pc-react` or architecture equivalent | approved high-level appbase runtime factory that product apps call instead of wiring low-level IAM SDK adapters |
| PC IAM provider | `@sdkwork/iam-react` | `IamRuntimeProvider`, `IamProvider`, `useIamRuntime`, `useIamService` |
| PC IAM core export | `@sdkwork/iam-core-pc-react` | PC React re-export boundary for IAM runtime, stores, adapters, ports, contracts, and services |
| IAM contracts | `@sdkwork/iam-contracts` | token header names, IAM route constants, context contracts |
| IAM SDK ports | `@sdkwork/iam-sdk-ports` | generated SDK client shapes without app-specific constructors |
| IAM SDK adapter | `@sdkwork/iam-sdk-adapter` | strict envelope/call-shape adapter over standard appbase app/backend SDK resources |
| Product core package | `packages/<product>-pc-core` or equivalent | SDK bootstrap, session store, auth service facade, IAM runtime bridge |
| Appbase app SDK | `@sdkwork/appbase-app-sdk` | canonical login, session, runtime metadata, OAuth, QR auth, password reset, and current-user transport |
| Messaging app SDK | generated `sdkwork-messaging-app-sdk` surface | verification-code delivery and verification through `messaging.verificationCodes.*` |
| Appbase backend SDK | `@sdkwork/appbase-backend-sdk` | canonical `backend-admin` IAM management transport |
| Product app/backend SDKs | generated app-api SDKs and explicit `backend-admin` backend-api SDKs | protected business operations that receive the global token manager only |
| Dependency app/backend SDKs | generated dependency app-api SDKs and explicit `backend-admin` backend-api SDKs | dependency-owned protected operations such as Drive, Messaging, IM, or other reusable app SDK capabilities that receive the same global token manager only |
| Product open-api SDKs | generated open-api SDKs | protected public/domain operations that receive API key credentials when their contract declares API key mode |
| Rust AppContext crate | product-independent context helper crate | dual-token and SDKWork AppContext extraction/validation |

Rules:

- Appbase packages own reusable IAM UI and auth flow behavior.
- Product core packages may adapt generated `@sdkwork/appbase-app-sdk` constructors, generated `@sdkwork/appbase-backend-sdk` constructors, token storage, and runtime config, but must not fork appbase auth UI, generated SDK output, or appbase login method names.
- IAM SDK adapters `MUST` be strict adapters over the standard appbase SDK resource surface. They may unwrap SDK envelopes and normalize generated path-parameter call shapes, but they `MUST NOT` map legacy or product-local methods such as `auth.login`, `auth.refreshToken`, `auth.register`, `auth.getOauthUrl`, `auth.createSendSmsCode`, `user.getUserProfile`, or app-local user-center methods into appbase login/session ports. Product application packages do not depend on these adapters directly when an appbase high-level auth runtime/factory exists.
- Generated SDK output `MUST NOT` be edited by app or desktop packages.
- If an IAM SDK method is missing, fix `sdkwork-appbase-app-api` or `sdkwork-appbase-backend-api`, OpenAPI, and generator inputs before adding product integration.

## 3. Fast App Integration

Minimum app-side steps:

1. Add appbase and IAM package aliases or workspace dependencies.
2. Create one global token manager for the authenticated session context.
3. Create one session module that reads, writes, normalizes, and clears `authToken`, `accessToken`, `refreshToken`, `sessionId`, `user`, and `context`.
4. Create `@sdkwork/appbase-app-sdk` as `appbaseApp` in bootstrap/core code. Create `@sdkwork/appbase-backend-sdk` as `appbaseBackend` only when the runtime is an explicit `backend-admin` surface.
5. Build an SDK inventory, then pass every authenticated product/dependency app-api SDK and every explicit `backend-admin` backend-api SDK through `clients.sdkClients` or the local equivalent so the same global token manager is injected.
6. Pass protected open-api SDK clients through a separate API key credential provider when their contract declares API key mode.
7. Use appbase auth UI/runtime packages or an approved high-level appbase auth integration wrapper for login, registration, refresh, OAuth, QR auth, password reset, runtime metadata, and current-user self-service.
8. Create only the product-specific runtime bridge needed for bootstrap/logout/current-session handoff, when appbase UI/runtime cannot consume those ports directly.
9. Wrap product routes with an `AuthGate`.
10. Verify logout clears local session state, the global token manager, realtime clients, sensitive caches, and redirects to login.

Standard PC React shape:

```text
apps/<product>-pc/
  src/
    App.tsx
    AuthGate.tsx
  packages/
    <product>-pc-core/
      src/sdk/session.ts
      src/sdk/appSdkClient.ts
      src/sdk/appAuthService.ts
      src/sdk/appAuthRuntime.ts
```

Rules:

- `App.tsx` owns router composition only.
- `AuthGate.tsx` owns route protection and rendering appbase auth routes.
- `session.ts` owns persisted session normalization and clearing.
- `appSdkClient.ts` owns SDK inventory classification, `@sdkwork/appbase-app-sdk`, optional `backend-admin` `@sdkwork/appbase-backend-sdk`, product/dependency SDK construction, and global TokenManager injection.
- `appAuthService.ts` may expose only product-specific auth bridges such as current-session bootstrap and logout when needed. It `MUST NOT` re-map or reimplement appbase-owned login, registration, refresh, verification-code, OAuth, QR auth, password reset, runtime metadata, or current-user self-service operations.
- `appAuthRuntime.ts` consumes an approved appbase high-level auth runtime/factory when available. Product code provides app identity, runtime config, injected SDK clients, the global TokenManager, and session bridge hooks instead of implementing appbase IAM adapter behavior locally.

Standard TypeScript runtime shape implemented by appbase packages and high-level wrappers:

```ts
const tokenManager = createTokenManager();
const isBackendAdminRuntime = classifyRuntimeSurface(config) === "backend-admin";

const runtime = createIamRuntime({
  clients: {
    appbaseApp,
    appbaseBackend: isBackendAdminRuntime ? appbaseBackend : undefined,
    sdkClients: [
      productAppSdk,
      dependencyAppSdk,
      ...(isBackendAdminRuntime ? [productBackendSdk, dependencyBackendSdk] : []),
    ],
  },
  config,
  tokenManager,
  tokenStore,
  contextStore,
});
```

Rules:

- `createIamRuntime(...)` `MUST` create or receive the global `AuthTokenManager`.
- `clients.appbaseApp` is required. `clients.appbaseBackend` is optional and only used when `backend-admin` IAM management is part of the runtime.
- `clients.sdkClients` contains downstream authenticated product/dependency app-api SDK clients, explicit `backend-admin` backend-api SDK clients, plus approved composed wrappers backed by those SDKs. It does not contain protected open-api SDKs that use API key mode.
- The runtime `MUST` bind the same token manager to every client with `setTokenManager(manager)`.
- The runtime `MUST` hydrate the token manager from `tokenStore` when in-memory tokens are empty.
- `contextStore` `MUST` persist returned `AppContext` and derive or expose `ShardingContext` when the platform provides that helper.

## 4. AuthGate Rules

An AuthGate is the application entry boundary between anonymous auth routes and protected product routes.

Required behavior:

```text
bootstrap persisted session
  -> retrieve current session when possible
  -> if protected route and no valid session, redirect to /auth/login?redirect=<target>
  -> if auth route and valid session, redirect to requested target or home
  -> render product routes only after authenticated session is confirmed
  -> render appbase IAM auth routes for anonymous auth paths
```

Rules:

- AuthGate `MUST` re-read persisted session state after route changes, logout, refresh failure, tenant switch, organization switch, and account switch.
- AuthGate `MUST` treat in-memory state and persisted session state as a pair. A stale in-memory session is not enough after logout.
- Auth routes `SHOULD` use a stable base path such as `/auth`.
- Redirect targets `MUST` be normalized to prevent loops back into auth routes.
- Loading state must not reveal protected data.
- Appbase auth routes receive runtime, runtime config, locale, appearance, base path, and home path from product bootstrap, not from feature packages.

## 5. Session And Token Rules

SDKWork protected app-api and backend-api operations use a dual-token model. Protected open-api operations use API key mode when their API contract declares it, and do not participate in app login/session creation.

| Token | Transport | Purpose |
| --- | --- | --- |
| `authToken` | `Authorization: Bearer <auth_token>` | principal identity, session identity, tenant, organization, login scope, auth strength, expiry |
| `accessToken` | `Access-Token: <access_token>` | principal identity, session identity, tenant, organization, login scope, app, environment, deployment mode, data scope, permission scope |
| `refreshToken` | app-auth refresh operation only | refresh/rotation; never used for normal business APIs |

Rules:

- Session storage `MUST` be centralized in a core/session module.
- Applications `MUST` create exactly one global token manager per authenticated session context.
- Login/session-creation requests `MUST NOT` send existing `Authorization`, `Access-Token`, `X-Sdkwork-Tenant-Id`, `X-Sdkwork-Organization-Id`, or `X-Sdkwork-User-Id` headers to select tenant or organization. Login starts anonymous and receives tenant/organization context only from the appbase login response.
- `authToken` and `accessToken` returned by appbase login/session APIs `MUST` both carry `tenant_id`, `organization_id`, `login_scope`, `user_id`, and `session_id` claims. Client-side code may decode token claims for diagnostics only; authorization and routing decisions `MUST` rely on appbase session validation and returned `AppContext`.
- Runtime session normalization `MUST` reject complete-looking sessions whose `authToken`, `accessToken`, and returned `AppContext` disagree on tenant, organization, user, session, app, environment, deployment mode, or login scope.
- `@sdkwork/appbase-app-sdk`, product/dependency app SDKs, explicit `backend-admin` `@sdkwork/appbase-backend-sdk`, explicit `backend-admin` product/dependency backend SDKs, and approved composed wrappers backed by those SDKs `MUST` receive the same global token manager through generated SDK config, `setTokenManager`, credential provider, constructor injection, or approved adapter.
- In the TypeScript appbase IAM runtime, the standard downstream client list is `clients.sdkClients`. Older or app-local names such as `appBackendSdkClients` may exist only as compatibility aliases that are normalized into `clients.sdkClients` before calling `createIamRuntime`.
- Login, registration, OAuth session creation, current-session retrieval/update, refresh, and session restoration `MUST` update the global token manager, centralized session store, and AppContext/context store together before the API call is reported as completed to UI/runtime code.
- Session side effects `MUST` be ordered: first validate the appbase session payload, then persist normalized tokens in the centralized session store, then write the returned AppContext to the context store or clear stale AppContext when the session has no context, and only then sync the global token manager. A failed token persistence step `MUST NOT` leave a new in-memory token manager state behind. A failed context propagation step after token persistence `MUST` clear the token store, context store, and global token manager before the API call rejects.
- New session flows such as login, registration, and OAuth session creation `MUST` replace the stored token set and `MUST NOT` inherit an old `refreshToken` when appbase does not return one. Current-session retrieval/update and refresh continuation may preserve the current stored `refreshToken` only when appbase returns rotated `authToken`/`accessToken` without a new `refreshToken`.
- Current-session retrieval is a validation flow, not a local cache restoration shortcut. When `auth.sessions.current.retrieve()` is available, the authenticated state is valid only after that SDK call returns a complete dual-token appbase session; failure or incomplete payload clears local session state and remains anonymous.
- Reusable auth UI and service packages `MUST` expose a `commitSession(session, options?)` hook, not `persistSession`. The session passed to `commitSession` `MUST` be the normalized committed session after continuation refresh-token rules have been applied.
- `commitSession(session)` is allowed only for new session flows. `commitSession(session, { preserveRefreshToken: true })` is allowed only for current-session bootstrap, current-session update, refresh continuation, and equivalent session restoration flows.
- `commitSession` `MUST` be awaited before auth service, runtime, route guard, or UI controller APIs resolve. If a custom committer returns a committed session, the runtime reports that normalized return value. If it returns `void`, the runtime reports the standard committed session it computed before invoking the committer.
- Logout clearing is a two-level `finally` rule: the service/runtime clears persisted tokens, global token manager, context store, realtime/session bridges, and sensitive caches even when remote session deletion fails; the UI/controller clears in-memory authenticated state even when service logout rejects after local cleanup.
- The global token manager is the app-api SDK and explicit `backend-admin` backend-api SDK login-retention standard. Product/dependency app SDKs and explicit `backend-admin` backend SDKs `MUST NOT` maintain independent token stores, independent TokenManagers, or refresh flows. Product open-api SDKs that use API key mode manage API key credentials through their declared SDK credential provider and `MUST NOT` treat API keys as app login sessions.
- Frontend code outside SDK/bootstrap `MUST NOT` set `Authorization`, `Access-Token`, `X-Sdkwork-*`, or equivalent auth headers manually.
- `authToken`, `accessToken`, and `refreshToken` `MUST NOT` be logged, copied into URLs, exposed in UI, or saved in product feature state.
- Token refresh failure `MUST` clear the global token manager, session store, context store, realtime/session bridges, sensitive caches, and route to login through a single runtime clearing path.
- Logout `MUST` call `@sdkwork/appbase-app-sdk` `client.auth.sessions.current.delete()` when possible, then clear local state in a `finally` path even when the remote delete fails.

Standard logout effects:

```text
appbaseAppClient.auth.sessions.current.delete()
  -> clear in-memory auth controller/session state in finally
  -> clear persisted session
  -> clear the global token manager
  -> close/reconnect realtime clients as anonymous
  -> clear sensitive query/cache state
  -> clear native secure session state when used
  -> navigate to /auth/login or configured login entry
```

### 5.1 Login Organization Selection Protocol

The standard login endpoint may complete immediately or return a continuation state when the verified user belongs to multiple organizations in the resolved tenant.

Flow:

```text
anonymous login request
  -> appbase validates credentials
  -> appbase resolves real user_id and tenant_id from IAM data
  -> appbase reads active iam_organization_membership rows
  -> zero organizations: return TENANT-scoped dual-token session
  -> one organization: return ORGANIZATION-scoped dual-token session
  -> multiple organizations: return organization-selection challenge
  -> app UI shows organization selection modal
  -> user selects organization
  -> appbase validates membership and returns final dual-token session
```

Rules:

- Product apps `MUST` treat an organization-selection challenge as an authenticated-login continuation, not as a normal authenticated session. They `MUST NOT` update the global token manager, protected SDK clients, or route guard as authenticated until appbase returns the final dual-token session.
- The organization-selection UI may be a modal, route, or equivalent focused surface, but it `MUST` display only the safe organization choices returned by appbase and `MUST` submit the selected organization through the generated appbase app SDK continuation method.
- Organization-selection continuation credentials `MUST NOT` be used as `authToken` or `accessToken` for product/dependency APIs. They are short-lived, single-purpose credentials for the continuation endpoint only.
- Product apps `MUST NOT` choose the first organization client-side, cache an organization choice across users, or derive organization id from route/query/local storage without appbase validation.
- Switching organization after login is a session update flow. It `MUST` use appbase session/current-session resources or an approved appbase organization-switch resource, then replace token/context state atomically.

## 6. Rust Protected API Standard

Rust services that expose protected business APIs normally validate IAM sessions; they do not own login.

Standard Rust HTTP guard:

```text
request
  -> allow explicitly public routes only
  -> require Authorization: Bearer <auth_token>
  -> require Access-Token: <access_token>
  -> verify tokens directly or accept a signed AppContext projection from a trusted gateway
  -> insert typed AppContext into request extensions
  -> handlers consume AppContext, not raw headers
```

Rules:

- Rust business routes `MUST` reject authorization-only requests that lack SDKWork AppContext or valid token-derived context.
- Public routes `MUST` be explicitly listed, for example health, readiness, OpenAPI, static public metadata, or documented public bootstrap routes.
- Rust handlers `MUST` consume a typed `AppContext` extractor or extension.
- Rust handlers `MUST NOT` parse tokens, tenant IDs, user IDs, or permission scopes directly.
- Request body, path, and query values `MUST NOT` override verified AppContext tenant, organization, user, actor, permission, or data scope.
- Error responses `MUST` use the standard problem-detail shape and stable auth/context error codes.

Recommended Rust modules:

```text
crates/<domain>-app-context/
  src/lib.rs
  tests/app_context_test.rs

services/<service>/
  src/auth_guard.rs
  src/context.rs
  src/routes.rs
  tests/auth_guard_test.rs
```

## 7. AppContext Projection

When a Rust service receives a trusted context projection, the canonical SDKWork headers are:

| Header | Required | Meaning |
| --- | --- | --- |
| `x-sdkwork-tenant-id` | yes | tenant isolation |
| `x-sdkwork-user-id` | yes | authenticated user |
| `x-sdkwork-organization-id` | no | organization scope |
| `x-sdkwork-session-id` | no | IAM session identity |
| `x-sdkwork-app-id` | no | application identity |
| `x-sdkwork-environment` | no | environment name |
| `x-sdkwork-deployment-mode` | no | `saas`, `private`, `local`, `desktop`, or equivalent |
| `x-sdkwork-auth-level` | no | password, MFA, OAuth, passkey, device, or service level |
| `x-sdkwork-data-scope` | no | data isolation scope list |
| `x-sdkwork-permission-scope` | no | permission scope list |
| `x-sdkwork-actor-id` | no | acting principal; defaults to user |
| `x-sdkwork-actor-kind` | no | actor kind; defaults to `user` |
| `x-sdkwork-device-id` | no | device identity |
| `x-sdkwork-context-signature` | required when using forwarded projection in untrusted networks | HMAC or equivalent signature over context headers |

Rules:

- A public Rust service `MUST` either verify `authToken` and `accessToken` itself or require a signed AppContext projection from a trusted gateway.
- Unsigned AppContext projection is allowed only in local tests, trusted in-process adapters, or explicitly documented development profiles.
- The context signature `MUST` cover every context header that influences tenant, user, session, actor, scope, device, environment, or deployment mode.
- Permission checks use `x-sdkwork-permission-scope` or server-side permission lookup. Legacy headers such as `x-scope` or `x-scopes` `MUST NOT` grant permissions.
- Context projection headers are transport metadata, not public API request fields.

## 8. Rust Local/Private IAM Authority

Only an IAM authority implementation may expose app-api login/session routes in Rust.

Allowed Rust IAM authority responsibilities:

- expose `/app/v3/api/auth/sessions`, `/app/v3/api/auth/sessions/current`, refresh, logout, verification, OAuth, QR auth, password reset, and current user routes when the deployment intentionally runs local/private IAM;
- use the same OpenAPI paths, operationIds, schemas, response envelopes, error codes, and security declarations as Java app-api;
- issue, hash, store, rotate, revoke, and verify tokens with the same logical IAM semantics;
- produce AppContext and ShardingContext compatible with Java SaaS mode;
- pass appbase UI/runtime contract tests without app-specific forks.

Forbidden for product Rust services:

- adding product-local login or refresh routes;
- exposing `/backend/v3/api/auth/*`;
- using IM/device runtime session routes as IAM login sessions;
- creating a separate user-center login namespace;
- bypassing generated app SDK/appbase because an auth method is missing.

## 9. Current User Self-Service

Current user profile and self-service operations are appbase app-api resources, not product-local user clients.

Rules:

- Current user reads `MUST` use `@sdkwork/appbase-app-sdk` `appbaseApp.iam.users.current.retrieve()`.
- Current user updates and password changes `MUST` be defined as semantic appbase app-api current-user resources before use, for example `appbaseApp.iam.users.current.update(...)` and `appbaseApp.iam.users.current.password.update(...)`.
- Product apps and UI packages `MUST NOT` inject clients exposing legacy `user.getUserProfile`, `user.updateUserProfile`, `user.changePassword`, or equivalent app-local user-center methods.
- Missing current-user app SDK methods `MUST` be closed by updating `sdkwork-appbase-app-api`, OpenAPI, generator inputs, and all generated language SDKs. They `MUST NOT` be hidden by raw HTTP, fallback DTOs, or product-local SDK forks.
- User-center UI `MUST` expose edit/password capabilities only when the generated appbase app SDK resource exists. Default current-user profile UI is read-only until `iam.users.current.update` and password update resources are present.

## 10. Tauri And Desktop Rules

Desktop shells host the web app; they do not own business authentication.

Rules:

- Tauri commands `MUST NOT` perform login, token refresh, permission evaluation, or business authorization.
- Tauri may provide secure token storage, deep link/OAuth callback bridging, QR scan device capability, window control, and local runtime process lifecycle through typed host adapters.
- Renderer code `MUST` still use appbase IAM runtime and generated app SDK clients for login/session flows.
- Desktop logout `MUST` clear both renderer session state and native secure storage when native storage is used.
- Local/private desktop modes `MUST` use runtime config to choose app-api base URLs. Release builds must not hard-code development endpoints.

## 11. Verification

Required checks for IAM login integration:

| Verification | Evidence |
| --- | --- |
| Appbase boundary | Static scan shows login/register/session UI comes from appbase packages or approved wrappers, and product bootstrap uses the approved high-level appbase auth runtime/factory instead of low-level IAM SDK adapters. |
| SDK boundary | Static scan shows no raw HTTP/manual auth headers in UI or feature services. |
| Route guard | Tests or smoke checks prove protected routes redirect to login and authenticated auth routes redirect home/target. |
| Logout | Tests or smoke checks prove persisted session, global token manager, AppContext, realtime clients, caches, and native storage are cleared even when remote logout fails. |
| Session persistence | Tests prove login/refresh/current-session calls do not resolve before `commitSession` finishes, token persistence failure does not update the global token manager, new sessions do not inherit old refresh tokens, refresh/current-session continuation passes the already-merged committed session to `commitSession`, context propagation failure rolls back token/context stores, and sessions without AppContext clear stale AppContext. |
| Login protocol | Tests prove login requests do not send or trust inbound auth/context headers, appbase returns tenant/organization/login-scope context in both tokens, and multi-organization login returns a continuation challenge instead of a normal session. |
| Organization selection | Tests prove organization-selection continuation credentials cannot authenticate product APIs, client code does not auto-select the first organization, and final token issuance validates membership before committing session state. |
| API boundary | Contract scan proves product IM/backend/Rust services do not expose appbase-owned `/app/v3/api/auth/*` routes. |
| Current user boundary | Static scan shows current-user profile/self-service calls use `appbaseApp.iam.users.current.*` and do not inject legacy `user.*` clients. |
| Rust guard | Tests prove protected Rust routes require dual tokens plus valid AppContext or signed context projection. |
| Context safety | Tests prove body/query/path tenant or user fields cannot override AppContext. |
| Error shape | Unauthorized/context failures return problem-detail errors with stable codes. |

Suggested command categories:

```text
pnpm --dir apps/<product>-pc test
pnpm --dir apps/sdkwork-appbase test:iam-standard-contracts
cargo test -p <rust-service> --test <auth_or_context_test>
rg -n "fetch\\(|axios\\.|Authorization|Access-Token" apps/<product>-pc/packages
rg -n "/app/v3/api/auth|/api/.*/auth|user-center/session" services crates
```

## 12. Acceptance Checklist

- [ ] App login/register/session UI is provided by `sdkwork-appbase` or approved wrappers.
- [ ] Product auth runtime integration uses the approved high-level appbase auth runtime/factory and does not directly depend on `@sdkwork/iam-sdk-adapter` or product-side `createIamRuntime(...)` wiring.
- [ ] Product app does not reimplement appbase-owned auth endpoints.
- [ ] AuthGate protects product routes and redirects anonymous users to the login entry.
- [ ] Session storage is centralized and normalizes `authToken`, `accessToken`, `refreshToken`, `sessionId`, user, and AppContext.
- [ ] Generated appbase app SDK or strict IAM adapter over the standard appbase SDK resource surface owns all auth/session transport.
- [ ] Logout clears local session, global token manager, AppContext, realtime connections, sensitive cache, and native storage when present, including remote logout failure cases.
- [ ] Login/refresh/current-session restoration waits for session persistence and context propagation before returning to UI/runtime code, replaces refresh tokens for new sessions, preserves current refresh tokens only for continuation flows, rolls back on context propagation failure, and clears stale AppContext when the committed session has no context.
- [ ] Login requests are anonymous; tenant and organization context are returned only by appbase after credential validation and real IAM tenant/organization membership lookup.
- [ ] Multi-organization login uses the appbase organization-selection continuation protocol and does not commit normal session state until final dual tokens are returned.
- [ ] Both tokens and persisted AppContext agree on tenant, organization, login scope, user, session, app, environment, and deployment mode.
- [ ] Reusable auth packages use `commitSession(session, options?)`, never `persistSession`, and controller logout clears local authenticated state in a `finally` path.
- [ ] Runtime/bootstrap builds an SDK inventory and passes every downstream authenticated product/dependency app-api/backend-api client and approved composed wrapper through `clients.sdkClients` or the language-equivalent token-manager-aware SDK list.
- [ ] Current user profile reads use `appbaseApp.iam.users.current.retrieve()` and missing self-service methods are fixed in appbase app-api/OpenAPI/generator inputs instead of product-local fallbacks.
- [ ] Rust protected APIs require dual tokens and typed AppContext or a signed trusted projection.
- [ ] Rust product services do not expose login/session creation routes unless they are the IAM authority implementation.
- [ ] Permission and tenant decisions come from verified AppContext, not request body/query/path hints.
- [ ] Tests cover route guard, logout, SDK boundary, Rust auth guard, and forbidden route namespace checks.
