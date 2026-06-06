# IAM Domain Standard

- Version: 1.1
- Scope: tenant, organization, user, authentication, authorization, sessions, devices, MFA, API keys, security events, audit events
- Related: `API_SPEC.md`, `IAM_LOGIN_INTEGRATION_SPEC.md`, `DATABASE_SPEC.md`, `SECURITY_SPEC.md`, `SDK_SPEC.md`, `MODULE_SPEC.md`, `DEPLOYMENT_SPEC.md`, `PRIVACY_SPEC.md`

IAM is the foundational domain for every SDKWork application. It owns the reusable user system, login/session system, tenant and organization isolation model, authorization model, security posture, and the token-derived context that lets SaaS Java and local/private Rust deployments expose the same application behavior.

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
| Rust core | `sdkwork_iam_core` | Local/private Rust IAM context and token parity contracts |
| Rust HTTP | `sdkwork_iam_http` | Local/private Rust route contract parity with Java app/backend APIs |
| Rust storage | `sdkwork_iam_storage_sqlx` | Local/private Rust SQL migration and persistence contract |
| Rust Tauri | `sdkwork_iam_tauri` | Tauri host adapter boundary for local/private IAM |

Rules:

- UI components call IAM through `UI -> service -> injected generated SDK client`.
- Service packages receive `appClient` and optional `backendClient` as ports.
- Runtime/bootstrap creates the concrete SDK clients for dev/test/prod/SaaS/private/local.
- App SDK constructors may differ by application, but injected method surfaces `MUST` remain resource-oriented and stable.
- Reusable UI IAM capability work belongs in `pc-react/iam` and common IAM packages; do not introduce compatibility package roots outside the canonical IAM boundary.

## 3. Core Model

| Entity | Table | API resource |
| --- | --- | --- |
| Tenant | `iam_tenant` | `/iam/tenants` |
| Organization | `iam_organization` | `/iam/organizations` |
| Organization member | `iam_organization_member` | `/iam/organizations/{organizationId}/members` |
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
| User role | `iam_user_role` | `/iam/users/{userId}/roles` |
| API key | `iam_api_key` | `/iam/api_keys` |
| Security event | `iam_security_event` | `/iam/security_events` |
| Audit event | `iam_audit_event` | `/iam/audit_events` |

Minimum shared IAM persistence contract:

```text
iam_tenant
iam_organization
iam_organization_member
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
iam_user_role
iam_api_key
iam_security_event
iam_audit_event
```

Rules:

- All IAM tables `MUST` use the `iam_` prefix and follow `DATABASE_SPEC.md`.
- Java SaaS schema and Rust local/private schema `MUST` preserve the same logical table names, IDs, isolation fields, token hash fields, status semantics, and audit fields.
- Rust may choose SQLite/PostgreSQL-compatible column types, but API-visible semantics and migration intent `MUST` match Java.
- `iam_session` `MUST` store token hashes, context fields, sharding fields, data scope, permission scope, expiry, revocation, and audit timestamps.

## 4. AppContext And ShardingContext

Protected IAM and tenant-owned business operations run with two derived contexts:

```text
AppContext = tenant + organization + user + session + app + environment + deployment mode + auth level + data scope + permission scope
ShardingContext = sharding key + sharding strategy + optional database/schema/table partition
```

Rules:

- Java SaaS `MUST` populate `AppContext` and `ShardingContext` from verified token claims or server-side token/session lookup before business logic runs.
- Rust local/private deployment `MUST` expose the same logical contexts and enforce the same tenant/user/permission checks.
- Appbase HTTP routers `MUST` resolve `AppRequestContext` at the framework boundary and project it to IAM `AppContext` for business handlers.
- `AppRequestPrincipal` is the standard HTTP projection of IAM identity and must carry tenant, organization, user, session, app, environment, deployment mode, auth level, data scope, permission scope, optional API key id, and subject type.
- Context values from request body, query, or mutable frontend state are hints only and `MUST NOT` override verified token context.
- If path/body/query tenant or organization values conflict with token context, the server `MUST` reject the request unless an explicit platform permission authorizes cross-tenant action.
- `ShardingContext` default selection order is tenant, organization, user, then single/app scope.
- Business code should consume context through typed context providers, not by reparsing tokens in controllers or handlers.

## 5. Dual Token Authentication

IAM uses two tokens for protected operations:

| Token | Transport | Owns |
| --- | --- | --- |
| `auth_token` | `Authorization: Bearer <auth_token>` | Principal identity, session identity, auth strength, token expiry |
| `access_token` | `Access-Token: <access_token>` | Tenant, organization, app, environment, deployment mode, data scope, permission scope, sharding context |

Rules:

- Protected APIs `MUST` require both tokens unless a documented machine/API-key mode is explicitly selected.
- `Access-Token` is the canonical SDKWork access isolation header for v3 contracts.
- `auth_token` parsers `MUST` validate principal identity, session identity, auth strength, expiry, issuer, and revocation.
- `access_token` parsers `MUST` validate tenant, organization, app, environment, deployment mode, data scope, permission scope, expiry, issuer, audience, and revocation.
- If both tokens include the same tenant, organization, user, session, or app claim, the values `MUST` match.
- App API session creation returns `authToken`, `accessToken`, optional `refreshToken`, session metadata, user summary, and AppContext.
- Refresh token handling `MUST` be server-controlled, revocable, rotated where possible, and unavailable to normal business operation handlers.
- Passwords, verification codes, recovery secrets, private tokens, API key raw values, and MFA secrets `MUST` be write-only and never appear in response schemas.
- MFA, OAuth, SSO, passkeys, and device authorization extend sessions; they are not separate unrelated domains.

## 5.1 API Key Context Resolution

Open-api and machine-to-machine flows use API keys only when the API contract declares API key mode. API key mode is a context-resolution mode, not a bypass around IAM.

Rules:

- API key mode `MUST` resolve an API key record before protected business logic runs.
- The API key record `MUST` supply `api_key_id`, `tenant_id`, `organization_id` when applicable, `user_id` or service-account subject, `app_id`, environment/deployment constraints, data scope, permission scope, status, expiry, and revocation state.
- Raw API key values `MUST` be stored hashed or encrypted according to the deployment security profile. Logs and audit records must use key id and safe key prefix only.
- `ApiKeyParser` and `ApiKeyLookupService` or equivalent interfaces are required extension points. They allow different products to keep API keys in different IAM tables, tenant-local tables, encrypted secret stores, caches, or remote IAM services.
- API key lookup `MUST` validate tenant binding, organization binding, app audience, permission scope, expiry, revocation, and allowed source before returning `AppRequestPrincipal`.
- API key mode and dual-token mode `MUST` be mutually exclusive for a single request.

## 6. API Surface

IAM uses the standard API prefixes:

- App API: `/app/v3/api`
- Backend API: `/backend/v3/api`

Rules:

- Login, register, refresh, logout, current session, OAuth callback, password reset, MFA challenge, device authorization, and verification-code delivery flows `MUST` live in app-api only.
- Backend-api `MUST NOT` expose an `auth` namespace or login/session creation APIs. It manages IAM resources after token validation.
- App and backend API versions `MUST` stay aligned.
- Java SaaS and Rust local/private implementations `MUST` expose identical paths, methods, operationIds, schemas, response envelopes, error semantics, and security declarations for shared IAM modules.
- URL static segments use `lower_snake_case`; path parameters use `lowerCamelCase`.
- OperationIds use dotted lowerCamelCase resource style and generate nested SDK resources, for example `client.auth.sessions.create(body)`.

Minimum app-api resources:

| Resource | Operation examples |
| --- | --- |
| `auth.sessions` | `sessions.create`, `sessions.current.retrieve`, `sessions.current.update`, `sessions.current.delete`, `sessions.refresh` |
| `messaging.verificationCodes` | `messaging.verificationCodes.create`, `messaging.verificationCodes.verify` |
| `auth.passwordResetRequests` | `passwordResetRequests.create` |
| `auth.passwordResets` | `passwordResets.create` |
| `auth.oauthAuthorizationUrls` | `oauthAuthorizationUrls.retrieve` |
| `auth.oauthSessions` | `oauthSessions.create` |
| `iam.users.current` | `users.current.retrieve` |

Minimum backend-api resources:

| Resource | Operation examples |
| --- | --- |
| `iam.tenants` | `tenants.list` |
| `iam.tenants.members` | `tenants.members.list` |
| `iam.organizations` | `organizations.list` |
| `iam.organizations.members` | `organizations.members.list`, `organizations.members.create` |
| `iam.users` | `users.list`, `users.retrieve` |
| `iam.users.roles` | `users.roles.list`, `users.roles.create`, `users.roles.delete` |
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
user -> iam_user_role -> role -> iam_role_permission -> permission
policy -> condition -> resource/data scope
```

Rules:

- Permission codes `MUST` use stable dotted strings, such as `iam.users.read`.
- Roles are assignable bundles; permissions are stable capabilities; policies add conditions and data scopes.
- UI authorization checks are hints only. Server-side authorization is mandatory.
- ABAC conditions `SHOULD` cover tenant, organization, owner, resource type, resource state, environment, device trust, auth level, and time.
- Policy evaluation `SHOULD` be deterministic, testable, and auditable.
- Sensitive authorization changes `MUST` emit audit events and, when security-relevant, security events.

## 8. SaaS And Local/Private Parity

Rules:

- Java SaaS mode and Rust local/private mode `MUST` implement the same IAM behavior for shared modules.
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
- [ ] API key operations resolve a server-side API key record and never trust raw key claims alone in production.
- [ ] AppContext and ShardingContext are derived from verified token context.
- [ ] Appbase HTTP handlers consume typed `AppRequestContext`/`AppContext` and do not reparse credentials.
- [ ] Tenant and organization isolation is enforced in Java and Rust.
- [ ] Permissions use stable dotted codes.
- [ ] Audit/security events are emitted for sensitive actions.
- [ ] React UI depends on IAM service/runtime contracts, not concrete SDK constructors or raw HTTP.
