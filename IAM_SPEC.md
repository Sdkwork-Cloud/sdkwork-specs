# IAM Domain Standard

- Version: 1.1
- Scope: tenant, organization, user, authentication, authorization, sessions, devices, MFA, API keys, security events, audit events
- Related: `API_SPEC.md`, `WEB_FRAMEWORK_SPEC.md`, `IAM_LOGIN_INTEGRATION_SPEC.md`, `DATABASE_SPEC.md`, `SECURITY_SPEC.md`, `SDK_SPEC.md`, `MODULE_SPEC.md`, `DEPLOYMENT_SPEC.md`, `PRIVACY_SPEC.md`

IAM is the foundational domain for every SDKWork application. It owns the reusable user system, login/session system, tenant and organization isolation model, authorization model, security posture, and the token-derived context that lets standalone and cloud deployments expose the same application behavior.

The canonical domain name is `iam`. New database tables, API tags, SDK namespaces, service facades, module names, events, permissions, and documentation `MUST NOT` use vague names such as `identity` for this domain.

For product-app integration of login, registration, AuthGate, logout clearing, generated app SDK token wiring, Tauri boundaries, and Rust AppContext validation, use `IAM_LOGIN_INTEGRATION_SPEC.md`. This file defines the IAM domain contract; `IAM_LOGIN_INTEGRATION_SPEC.md` defines the standard integration path.

## 1. Domain Boundary

IAM owns:

- Tenant lifecycle, tenant settings, tenant membership, and tenant-level isolation.
- Organization tree, organization membership, departments, and organization-scoped role assignment.
- User accounts, profiles, identities, credentials, preferences, status, and lifecycle.
- Auth sessions, refresh/logout, current session, device sessions, OAuth sessions, password reset, MFA, passkeys, and device authorization. Verification-code delivery and verification are consumed by IAM flows but owned by messaging.
- Roles, permissions, policies, assignments, data scopes, permission scopes, and authorization hints.
- API keys, service accounts, devices, security events, audit events, and sensitive IAM operational logs.
- AppContext and ShardingContext derivation from verified `auth_token` and `access_token`.

IAM does not own:

- Product-specific profile fields beyond generic metadata.
- Billing entitlement or subscription state.
- Content/resource ownership beyond generic owner references and authorization claims.
- Native host secret storage internals.
- Product-specific permission catalogs outside their registered permission codes.

## 2. Canonical Package Boundary

Reusable IAM modules use layered packages so each application can switch generated SDK clients without copying business logic.

| Layer | Canonical package | Responsibility |
| --- | --- | --- |
| Contracts | `@sdkwork/iam-contracts` | Standard constants, route contracts, table names, token headers, AppContext, ShardingContext |
| SDK ports | `@sdkwork/iam-sdk-ports` | Generated app/backend SDK client shapes without importing app-specific SDK packages |
| Service | `@sdkwork/iam-service` | Framework-independent IAM business facade over injected SDK clients |
| Runtime | `@sdkwork/iam-runtime` | Environment/deployment config, token store, context store, auth header provider |
| React | `@sdkwork/iam-react` | React provider and hooks over the IAM runtime |
| Rust IAM context | `sdkwork_iam_context_service` | Local/private Rust IAM context and token parity contracts |
| Rust app-api route | `sdkwork_router_iam_app_api` | Local/private Rust app-api route contract parity with Java app APIs |
| Rust backend-api route | `sdkwork_router_iam_backend_api` | Rust backend-api route contract parity with Java backend APIs across standalone/cloud profiles |
| Rust open-api route | `sdkwork_router_iam_open_api` | Rust open-api route contract parity when IAM exposes public integration APIs |
| Rust SQLx directory repository | `sdkwork_iam_directory_repository_sqlx` | Rust SQL migration and persistence contract |
| Rust Tauri host | `sdkwork_appbase_tauri_host` | Tauri host adapter boundary for standalone IAM |

Rules:

- UI components call IAM through `UI -> service -> injected generated SDK client`.
- Service packages receive `appClient` and optional `backendClient` as ports.
- Runtime/bootstrap creates the concrete SDK clients for each lifecycle
  environment, deployment profile, and runtime target.
- App SDK constructors may differ by application, but injected method surfaces `MUST` remain resource-oriented and stable.
- Reusable UI IAM capability work belongs in `pc-react/iam` and common IAM packages; do not introduce compatibility package roots outside the canonical IAM boundary.

## 3. Core Model

| Entity | Table | API resource |
| --- | --- | --- |
| Tenant | `iam_tenant` | `/iam/tenants` |
| Tenant member | `iam_tenant_member` | `/iam/tenants/current/members` |
| Tenant signing key | `iam_tenant_signing_key` | backend management only |
| Organization | `iam_organization` | `/iam/organizations` |
| Organization membership | `iam_organization_membership` | `/iam/organizations/{organizationId}/memberships` |
| User | `iam_user` | `/iam/users` |
| User identity | `iam_user_identity` | `/iam/users/{userId}/identities` |
| Credential | `iam_credential` | credential management only |
| Session | `iam_session` | `/auth/sessions` |
| MFA factor | `iam_mfa_factor` | `/iam/users/{userId}/mfa_factors` when exposed |
| Device | `iam_device` | `/iam/users/{userId}/devices` when exposed |
| Role | `iam_role` | `/iam/roles` |
| Permission | `iam_permission` | `/iam/permissions` |
| Policy | `iam_policy` | `/iam/policies` |
| Role permission | `iam_role_permission` | `/iam/roles/{roleId}/permissions` |
| Role binding | `iam_role_binding` | `/iam/role_bindings` |
| API key | `iam_api_key` | `/iam/api_keys` |
| Security event | `iam_security_event` | `/iam/security_events` |
| Audit event | `iam_audit_event` | `/iam/audit_events` |

Minimum shared IAM persistence contract:

```text
iam_tenant
iam_tenant_member
iam_tenant_signing_key
iam_organization
iam_organization_membership
iam_user
iam_user_identity
iam_credential
iam_session
iam_mfa_factor
iam_device
iam_role
iam_permission
iam_policy
iam_role_permission
iam_role_binding
iam_api_key
iam_security_event
iam_audit_event
```

Rules:

- All IAM tables `MUST` use the `iam_` prefix and follow `DATABASE_SPEC.md`.
- Java and Rust schemas across standalone/cloud profiles `MUST` preserve the
  same logical table names, IDs, isolation fields, token hash fields, status
  semantics, and audit fields.
- Rust may choose SQLite/PostgreSQL-compatible column types, but API-visible semantics and migration intent `MUST` match Java.
- `iam_user` or the canonical tenant membership relation `MUST` provide the user's tenant binding used by login. Login implementations `MUST NOT` invent tenant ids from usernames, emails, request bodies, headers, or local default values.
- `iam_organization_membership` `MUST` provide the organization memberships used by login organization selection and authorization. A missing organization membership means tenant-level login only; it does not authorize organization-scoped data.
- `iam_session` `MUST` store token hashes, context fields, sharding fields, data scope, permission scope, expiry, revocation, and audit timestamps.
- Tenant token signing material `MUST` be tenant-bound. Implementations may store encrypted HMAC secrets, tenant key references, or asymmetric key metadata in `iam_tenant_signing_key`, but every active signing key `MUST` resolve to exactly one tenant and key id (`kid`).

## 4. AppContext And ShardingContext

Protected IAM and tenant-owned business operations run with two derived contexts:

```text
AppContext = tenant + organization + user + session + app + environment + deployment profile + runtime target + auth level + data scope + permission scope
ShardingContext = sharding key + sharding strategy + optional database/schema/table partition
```

Rules:

- Java and Rust implementations `MUST` populate `AppContext` and
  `ShardingContext` from verified token claims or server-side token/session
  lookup before business logic runs.
- Standalone and cloud deployments `MUST` expose the same logical contexts and
  enforce the same tenant/user/permission checks.
- Appbase HTTP routers `MUST` resolve `WebRequestContext` at the `sdkwork-web-framework` boundary and project it to IAM `AppContext` for business handlers.
- `AppRequestPrincipal` is the standard HTTP projection of IAM identity and
  must carry tenant, organization, user, session, app, environment, deployment
  profile, runtime target, auth level, data scope, permission scope, optional
  API key id, and subject type.
- Context values from request body, query, or mutable frontend state are hints only and `MUST NOT` override verified token context.
- If path/body/query tenant or organization values conflict with token context, the server `MUST` reject the request unless an explicit platform permission authorizes cross-tenant action.
- `ShardingContext` default selection order is tenant, organization, user, then single/app scope.
- Business code should consume context through typed context providers, not by reparsing tokens in controllers or handlers.

## 5. Dual Token Authentication

IAM uses two tokens for protected operations:

| Token | Transport | Owns |
| --- | --- | --- |
| `auth_token` | `Authorization: Bearer <auth_token>` | Principal identity, session identity, auth strength, token expiry |
| `access_token` | `Access-Token: <access_token>` | Tenant, organization, app, environment, deployment profile, runtime target, data scope, permission scope, sharding context |

Rules:

- Protected APIs `MUST` require both tokens unless a documented machine/API-key mode is explicitly selected.
- `Access-Token` is the canonical SDKWork access isolation header for v3 contracts.
- `auth_token` parsers `MUST` validate principal identity, session identity, tenant identity, organization identity, login scope, auth strength, expiry, issuer, and revocation.
- `access_token` parsers `MUST` validate principal identity, session identity,
  tenant identity, organization identity, login scope, app, environment,
  deployment profile, runtime target, data scope, permission scope, expiry,
  issuer, audience, and revocation.
- If both tokens include the same tenant, organization, user, session, or app claim, the values `MUST` match.
- App API session creation returns `authToken`, `accessToken`, optional `refreshToken`, session metadata, user summary, and AppContext.
- Refresh token handling `MUST` be server-controlled, revocable, rotated where possible, and unavailable to normal business operation handlers.
- Passwords, verification codes, recovery secrets, private tokens, API key raw values, and MFA secrets `MUST` be write-only and never appear in response schemas.
- MFA, OAuth, SSO, passkeys, and device authorization extend sessions; they are not separate unrelated domains.

### 5.1 Login Context Resolution

User-facing login creates the first authenticated IAM session for an anonymous request. The login request itself is not a tenant-context authority.

Rules:

- Login/session-creation requests `MUST NOT` require or trust inbound credentials or SDKWork context-projection headers to choose tenant, organization, user, data scope, or permission scope. Implementations `SHOULD` reject credential/context headers on login creation endpoints unless an explicit reauthentication or continuation endpoint documents them.
- Login credential verification `MUST` resolve a real `iam_user` and a real active tenant binding before token issuance. The tenant id used for token claims comes from persisted IAM user/tenant data, not from the login request payload.
- If one credential can resolve to more than one active tenant, the login flow `MUST` return a tenant-selection challenge or fail closed. It `MUST NOT` silently choose a default tenant.
- After resolving `tenant_id` and `user_id`, login `MUST` query active `iam_organization_membership` rows for that tenant and user.
- If no active organization membership exists, login issues a tenant-level session with `organization_id = 0` or no organization claim and `login_scope = "TENANT"`.
- If exactly one active organization membership exists, login issues an organization-level session for that organization with `login_scope = "ORGANIZATION"`.
- If more than one active organization membership exists, login `MUST` return an organization-selection challenge containing safe organization choices and a short-lived continuation credential. It `MUST NOT` issue normal business `authToken`/`accessToken` until the user selects an organization.
- Organization-selection continuation credentials are not business API credentials. They may call only the documented organization-selection continuation endpoint, must expire quickly, and must bind to the verified user, tenant, login attempt, and allowed organization ids.
- The final organization-selection request `MUST` verify the selected organization belongs to the verified tenant/user membership set before issuing dual tokens.
- Login, registration, OAuth, QR, session-bridge, and refresh flows `MUST NOT` synthesize tenant, organization, user, chat id, display name, or relationship state from the submitted account string, email normalization, demo defaults, or mock profile objects.

### 5.2 Token Claims And Tenant Signing Keys

Both SDKWork tokens carry the current security context. The tokens have different purposes, but tenant isolation and session consistency are common to both.

Required common claims:

| Claim | Requirement |
| --- | --- |
| `token_type` | `auth` or `access`; parsers `MUST` reject the wrong token type for the header. |
| `sub` or `user_id` | Authenticated IAM user id. |
| `sid` or `session_id` | IAM session id. |
| `tenant_id` | Active tenant id resolved by login or validated session continuation. |
| `organization_id` | Active organization id, or `0`/absent for tenant-level sessions. |
| `login_scope` | `TENANT` when organization id is `0`/absent; `ORGANIZATION` when organization id is present and non-zero. |
| `app_id` | Application audience. |
| `environment`, `deployment_profile`, and `runtime_target` | Runtime audience and deployment context. |
| `iat`, `exp`, `iss`, `aud` | Standard issuance, expiry, issuer, and audience controls. |

Rules:

- `auth_token` and `access_token` `MUST` both include `tenant_id`, `organization_id`, `login_scope`, `user_id`/`sub`, and `session_id`/`sid`.
- `login_scope = "ORGANIZATION"` requires a non-zero `organization_id`. `login_scope = "TENANT"` requires `organization_id` to be absent or `0`. Contradictory claims `MUST` be rejected.
- `access_token` additionally owns access-specific claims such as `data_scope`, `permission_scope`, and sharding hints.
- Token signatures `MUST` use a tenant-bound signing key. A global shared signing secret for all tenants is forbidden for production and production-like profiles.
- Token headers `SHOULD` include a `kid` that maps to one tenant signing key. Validation `MUST` prove that the key used to verify the token belongs to the same `tenant_id` carried by the verified claims.
- Tenant signing keys `MUST` support rotation with overlapping validation windows. Revoked or expired keys `MUST NOT` sign new tokens.
- Signing material `MUST` be stored encrypted or in an approved secret manager/KMS. It `MUST NOT` be logged, returned by APIs, embedded in public runtime config, or stored in generated SDK output.

## 5.3 API Key Context Resolution (Open-api)

Open-api and machine-to-machine flows use API keys when the API contract declares `auth.mode: api-key` or when `open-api-flexible` selects the API key scheme. API key mode is a context-resolution mode, not a bypass around IAM.

Rules:

- API key mode `MUST` resolve an API key record before protected business logic runs.
- The API key record `MUST` supply `api_key_id`, `tenant_id`, `organization_id` when applicable, `user_id` or service-account subject, `app_id`, environment/deployment constraints, data scope, permission scope, status, expiry, and revocation state.
- Raw API key values `MUST` be stored hashed or encrypted according to the deployment security profile. Logs and audit records must use key id and safe key prefix only.
- `ApiKeyParser` and `ApiKeyLookupService` or equivalent interfaces are required extension points. They allow different products to keep API keys in different IAM tables, tenant-local tables, encrypted secret stores, caches, or remote IAM services.
- API key lookup `MUST` validate tenant binding, organization binding, app audience, permission scope, expiry, revocation, and allowed source before returning `AppRequestPrincipal`.
- API key mode and dual-token mode `MUST` be mutually exclusive for a single request.
- Standard IAM adapter lookup uses `iam_api_key.key_hash` through `IamApiKeyLookupService`. Production profiles `MUST NOT` trust inline claim strings in the raw API key value alone.

## 5.4 OAuth Bearer Context Resolution (Open-api)

Open-api routes may declare `auth.mode: oauth` or accept OAuth bearer credentials through `auth.mode: open-api-flexible`.

Rules:

- OAuth bearer mode `MUST` resolve a server-side token or session record before protected business logic runs.
- Resolution `MAY` use access-token hash lookup against `iam_session`, OAuth JWT verification with tenant-bound signing keys from `iam_tenant_signing_key`, or a product-specific token store behind `OAuthTokenLookupService`.
- Raw bearer token values `MUST` be stored hashed when persisted. Logs and audit records must use token/session ids and safe prefixes only.
- `OAuthBearerParser` and `OAuthTokenLookupService` are required framework extension points. Implementations `MAY` live in `sdkwork-iam-web-adapter` (`IamOAuthTokenLookupService`) or product-owned adapters.
- OAuth bearer lookup `MUST` validate tenant binding, app audience, permission scope, expiry, revocation, and signing-key tenant binding before returning `WebRequestPrincipal` / `AppContext`.
- OAuth bearer mode and dual-token mode `MUST` be mutually exclusive for a single request. Open-api OAuth bearer requests `MUST NOT` carry `Access-Token`.
- Production and production-like profiles `MUST NOT` trust inline OAuth claim strings in the bearer token value alone.

## 5.5 IAM Web Adapter For Open-api

Rules:

- `sdkwork-iam-web-adapter` `MUST` provide `IamOpenApiWebRequestContextResolver` (alias of `IamDatabaseWebRequestContextResolver`) for standard IAM open-api wiring.
- Open-api bootstrap `MUST` pass the route manifest to `build_iam_open_api_web_framework_layer(resolver, route_manifest)` so `RouteAuth::ApiKey`, `RouteAuth::OAuth`, and `RouteAuth::OpenApiFlexible` are enforced consistently.
- Session/token SQL against IAM foundation tables `MUST` follow `DATABASE_SPEC.md` section 8.1.1 for TEXT-stored `instant` comparisons.

## 6. API Surface

IAM uses the standard API prefixes:

- App API: `/app/v3/api`
- Backend API: `/backend/v3/api`

Rules:

- Login, register, refresh, logout, current session, OAuth callback, password reset, MFA challenge, device authorization, and verification-code delivery flows `MUST` live in app-api only.
- Backend-api `MUST NOT` expose an `auth` namespace or login/session creation APIs. It manages IAM resources after token validation.
- App and backend API versions `MUST` stay aligned.
- Standalone and cloud implementations `MUST` expose identical paths, methods,
  operationIds, schemas, response envelopes, error semantics, and security
  declarations for shared IAM modules.
- URL static segments use `lower_snake_case`; path parameters use `lowerCamelCase`.
- OperationIds use dotted lowerCamelCase resource style and generate nested SDK resources, for example `client.auth.sessions.create(body)`.

Minimum app-api resources:

| Resource | Operation examples |
| --- | --- |
| `auth.sessions` | `sessions.create`, `sessions.current.retrieve`, `sessions.current.update`, `sessions.current.delete`, `sessions.refresh` |
| `messaging.verificationCodes` | `messaging.verificationCodes.create`, `messaging.verificationCodes.verify` |
| `auth.passwordResetRequests` | `passwordResetRequests.create` |
| `auth.passwordResets` | `passwordResets.create` |
| `oauth.authorizationUrls` | `oauth.authorizationUrls.create` |
| `oauth.sessions` | `oauth.sessions.create` |
| `iam.users.current` | `users.current.retrieve` |

Minimum backend-api resources:

| Resource | Operation examples |
| --- | --- |
| `iam.tenants` | `tenants.list` |
| `iam.tenants.members` | `tenants.members.list` |
| `iam.tenants.signingKeys` | `tenants.signingKeys.list`, `tenants.signingKeys.rotate`, `tenants.signingKeys.revoke` |
| `iam.organizations` | `organizations.list` |
| `iam.organizations.memberships` | `organizations.memberships.list`, `organizations.memberships.create` |
| `iam.users` | `users.list`, `users.retrieve` |
| `iam.roleBindings` | `roleBindings.list`, `roleBindings.create`, `roleBindings.delete` |
| `iam.roles` | `roles.list` |
| `iam.roles.permissions` | `roles.permissions.list`, `roles.permissions.create`, `roles.permissions.delete` |
| `iam.permissions` | `permissions.list` |
| `iam.policies` | `policies.list` |
| `iam.apiKeys` | `apiKeys.list`, `apiKeys.revoke` |
| `iam.securityEvents` | `securityEvents.list` |
| `iam.auditEvents` | `auditEvents.list` |

## 7. Authorization

Baseline model:

```text
user/group/organization -> iam_role_binding -> role -> iam_role_permission -> permission
policy -> condition -> resource/data scope
```

Rules:

- Permission codes `MUST` use stable dotted strings, such as `iam.users.read`.
- Roles are assignable bundles; permissions are stable capabilities; policies add conditions and data scopes.
- UI authorization checks are hints only. Server-side authorization is mandatory.
- ABAC conditions `SHOULD` cover tenant, organization, owner, resource type, resource state, environment, device trust, auth level, and time.
- Policy evaluation `SHOULD` be deterministic, testable, and auditable.
- Sensitive authorization changes `MUST` emit audit events and, when security-relevant, security events.

## 8. Standalone And Cloud Parity

Rules:

- Standalone and cloud profiles `MUST` implement the same IAM behavior for shared modules.
- API parity includes path, method, operationId, schema, status code, envelope, error, security scheme, pagination, and idempotency semantics.
- Database parity includes logical table names, isolation keys, entity IDs, status values, token hash fields, and audit/security event facts.
- SDK parity means `@sdkwork/iam-service` and `@sdkwork/iam-runtime` can switch generated app/backend SDK clients without changing React UI code.
- Local/private Rust may issue tokens locally, but token validation, AppContext, ShardingContext, permission evaluation, and tenant isolation remain logically identical.

## 9. Acceptance Checklist

- [ ] Database tables use `iam_` prefix and include the complete shared table set.
- [ ] App API prefix is `/app/v3/api`; backend API prefix is `/backend/v3/api`.
- [ ] Login/session APIs exist only in app-api.
- [ ] Product app login/session integration follows `IAM_LOGIN_INTEGRATION_SPEC.md`.
- [ ] Backend SDK clients expose `iam.*` resources and no `auth.*` namespace.
- [ ] OperationIds are resource-style and SDK-friendly.
- [ ] Protected operations use `Authorization: Bearer <auth_token>` and `Access-Token: <access_token>`.
- [ ] Login/session creation does not trust inbound auth/context headers and derives tenant from real IAM user/tenant data.
- [ ] Multi-organization login returns an organization-selection challenge instead of choosing a default organization.
- [ ] Both `authToken` and `accessToken` include matching `tenant_id`, `organization_id`, `login_scope`, `user_id`, and `session_id` claims.
- [ ] Token signing and validation use tenant-bound signing keys with key id and tenant binding checks.
- [ ] API key operations resolve a server-side API key record and never trust raw key claims alone in production.
- [ ] OAuth bearer open-api operations resolve a server-side token/session record and never trust raw bearer claim strings alone in production.
- [ ] Open-api IAM ingress uses `IamOpenApiWebRequestContextResolver` with route-manifest auth modes instead of handler-local credential parsing.
- [ ] AppContext and ShardingContext are derived from verified token context.
- [ ] Appbase HTTP handlers consume typed `WebRequestContext`/`AppContext` and do not reparse credentials.
- [ ] Tenant and organization isolation is enforced in Java and Rust.
- [ ] Permissions use stable dotted codes.
- [ ] Audit/security events are emitted for sensitive actions.
- [ ] React UI depends on IAM service/runtime contracts, not concrete SDK constructors or raw HTTP.
