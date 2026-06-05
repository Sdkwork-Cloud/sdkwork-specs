# IAM Login Integration Standard

- Version: 1.0
- Scope: fast IAM login/session integration, sdkwork-appbase auth modules, generated app SDK wiring, route guards, logout behavior, Rust AppContext validation, Tauri/local/private runtime boundaries
- Related: `IAM_SPEC.md`, `API_SPEC.md`, `SDK_SPEC.md`, `FRONTEND_SPEC.md`, `APP_PC_REACT_UI_SPEC.md`, `DESKTOP_APP_ARCHITECTURE_SPEC.md`, `SECURITY_SPEC.md`, `DEPLOYMENT_SPEC.md`, `TEST_SPEC.md`

This standard defines how SDKWork applications integrate IAM login and session validation without reimplementing auth flows in product apps.

`sdkwork-appbase` and `spring-ai-plus-app-api` own reusable login, registration, token refresh, current session, logout, OAuth, QR login, verification code, password reset, and IAM runtime bootstrap. Product applications compose these capabilities through appbase UI/runtime packages and generated app SDK clients.

## 1. Integration Position

Standard login architecture:

```text
app shell
  -> AuthGate / route guard
  -> sdkwork-appbase auth UI/runtime
  -> app auth service facade
  -> generated app SDK or approved IAM adapter
  -> /app/v3/api/auth/* and /app/v3/api/iam/*
  -> protected product SDK clients
  -> Rust/Java business APIs validate dual tokens and AppContext
```

Rules:

- Product apps `MUST` integrate IAM login through `sdkwork-appbase` packages or approved wrappers.
- Product apps `MUST NOT` create local `/auth/login`, `/auth/refresh`, `/auth/me`, `/app/v3/api/auth/*`, or user-center session endpoints when the capability is already owned by `sdkwork-appbase` or `spring-ai-plus-app-api`.
- Login/session APIs `MUST` live in app-api only. IM API, backend-api, Tauri commands, and product-local Rust routes may validate sessions, but must not own user-facing login creation.
- UI components `MUST NOT` call raw HTTP, manually assemble `Authorization` or `Access-Token`, parse JWTs for authorization, or store duplicate token DTOs.
- Protected business services `MUST` consume a verified session projection through typed context, not through body/query tenant or user fields.

## 2. Standard Packages

Use the smallest package set needed for the target UI architecture.

| Concern | Standard package or layer | Responsibility |
| --- | --- | --- |
| Appbase shell primitives | `@sdkwork/appbase-pc-react` or architecture equivalent | capability manifest, appbase layout/runtime utilities |
| PC auth UI | `@sdkwork/auth-pc-react` | login/register/forgot-password/OAuth/QR auth routes and forms |
| IAM contracts | `@sdkwork/iam-contracts` | token header names, IAM route constants, context contracts |
| IAM SDK ports | `@sdkwork/iam-sdk-ports` | generated SDK client shapes without app-specific constructors |
| IAM SDK adapter | `@sdkwork/iam-sdk-adapter` | adapter over generated app SDK resources |
| Product core package | `packages/<product>-pc-core` or equivalent | SDK bootstrap, session store, auth service facade, IAM runtime bridge |
| Generated app SDK | `spring-ai-plus-app-api` generated SDK or approved app SDK | typed `/app/v3/api` transport |
| Rust AppContext crate | product-independent context helper crate | dual-token and SDKWork AppContext extraction/validation |

Rules:

- Appbase packages own reusable IAM UI and auth flow behavior.
- Product core packages may adapt generated app SDK constructors and runtime config, but must not fork appbase auth UI or generated SDK output.
- Generated SDK output `MUST NOT` be edited by app or desktop packages.
- If an IAM SDK method is missing, fix `spring-ai-plus-app-api`, OpenAPI, and generator inputs before adding product integration.

## 3. Fast App Integration

Minimum app-side steps:

1. Add appbase and IAM package aliases or workspace dependencies.
2. Create one session module that reads, writes, normalizes, and clears `authToken`, `accessToken`, `refreshToken`, `sessionId`, `user`, and `context`.
3. Create generated app SDK clients in bootstrap/core code with a token manager or auth provider.
4. Create an IAM auth service facade over the generated app SDK or IAM adapter.
5. Create an IAM runtime bridge consumed by appbase auth UI routes.
6. Wrap product routes with an `AuthGate`.
7. Verify logout clears local session state, SDK token managers, realtime clients, sensitive caches, and redirects to login.

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
- `appSdkClient.ts` owns generated app SDK construction and token injection.
- `appAuthService.ts` owns semantic auth operations such as `login`, `register`, `getCurrentSession`, `refreshToken`, `logout`, and QR/OAuth helpers.
- `appAuthRuntime.ts` adapts product auth service methods to the appbase IAM runtime expected by `@sdkwork/auth-pc-react`.

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

SDKWork protected APIs use a dual-token model:

| Token | Transport | Purpose |
| --- | --- | --- |
| `authToken` | `Authorization: Bearer <auth_token>` | principal identity, session identity, auth strength, expiry |
| `accessToken` | `Access-Token: <access_token>` | tenant, organization, app, environment, deployment mode, data scope, permission scope |
| `refreshToken` | app-auth refresh operation only | refresh/rotation; never used for normal business APIs |

Rules:

- Session storage `MUST` be centralized in a core/session module.
- SDK clients `MUST` receive tokens through generated SDK config, token manager, credential provider, or approved adapter.
- Frontend code outside SDK/bootstrap `MUST NOT` set `Authorization`, `Access-Token`, `X-Sdkwork-*`, or equivalent auth headers manually.
- `authToken`, `accessToken`, and `refreshToken` `MUST NOT` be logged, copied into URLs, exposed in UI, or saved in product feature state.
- Token refresh failure `MUST` clear session and route to login.
- Logout `MUST` call the app-api current-session delete operation when possible, then clear local state in a `finally` path.

Standard logout effects:

```text
client.auth.sessions.current.delete()
  -> clear persisted session
  -> clear SDK token managers
  -> close/reconnect realtime clients as anonymous
  -> clear sensitive query/cache state
  -> clear native secure session state when used
  -> navigate to /auth/login or configured login entry
```

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

## 9. Tauri And Desktop Rules

Desktop shells host the web app; they do not own business authentication.

Rules:

- Tauri commands `MUST NOT` perform login, token refresh, permission evaluation, or business authorization.
- Tauri may provide secure token storage, deep link/OAuth callback bridging, QR scan device capability, window control, and local runtime process lifecycle through typed host adapters.
- Renderer code `MUST` still use appbase IAM runtime and generated app SDK clients for login/session flows.
- Desktop logout `MUST` clear both renderer session state and native secure storage when native storage is used.
- Local/private desktop modes `MUST` use runtime config to choose app-api base URLs. Release builds must not hard-code development endpoints.

## 10. Verification

Required checks for IAM login integration:

| Verification | Evidence |
| --- | --- |
| Appbase boundary | Static scan shows login/register/session UI comes from appbase packages or approved wrappers. |
| SDK boundary | Static scan shows no raw HTTP/manual auth headers in UI or feature services. |
| Route guard | Tests or smoke checks prove protected routes redirect to login and authenticated auth routes redirect home/target. |
| Logout | Tests or smoke checks prove persisted session, SDK tokens, realtime clients, caches, and native storage are cleared. |
| API boundary | Contract scan proves product IM/backend/Rust services do not expose appbase-owned `/app/v3/api/auth/*` routes. |
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

## 11. Acceptance Checklist

- [ ] App login/register/session UI is provided by `sdkwork-appbase` or approved wrappers.
- [ ] Product app does not reimplement appbase-owned auth endpoints.
- [ ] AuthGate protects product routes and redirects anonymous users to the login entry.
- [ ] Session storage is centralized and normalizes `authToken`, `accessToken`, `refreshToken`, `sessionId`, user, and AppContext.
- [ ] Generated app SDK or IAM adapter owns all auth/session transport.
- [ ] Logout clears local session, SDK tokens, realtime connections, sensitive cache, and native storage when present.
- [ ] Rust protected APIs require dual tokens and typed AppContext or a signed trusted projection.
- [ ] Rust product services do not expose login/session creation routes unless they are the IAM authority implementation.
- [ ] Permission and tenant decisions come from verified AppContext, not request body/query/path hints.
- [ ] Tests cover route guard, logout, SDK boundary, Rust auth guard, and forbidden route namespace checks.
