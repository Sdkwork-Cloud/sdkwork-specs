# General API Definition Standard

- Version: 1.0
- Baseline: OpenAPI 3.1.2 stable contract profile, JSON Schema 2020-12, RFC 9457 Problem Details
- Forward-looking baseline: Track OpenAPI 3.2.0, but do not use 3.2-only features until the SDK generator, validators, Java tooling, Rust tooling, and generated TypeScript clients prove parity.
- Scope: Java Spring app-api, Java Spring backend-api, Rust local/private HTTP APIs, generated HTTP SDKs, frontend services, API tests, and contract governance
- Canonical location: `specs/API_SPEC.md`

This document defines the API contract standard for SDKWork applications. It is intentionally independent of Java, Rust, TypeScript, Tauri, React, mobile, cloud, or private deployment choices. API contracts must be stable enough to generate SDKs, switch between SaaS and local deployments, and compose shared application modules without duplicating business logic.

For data persistence and database naming rules, use `specs/DATABASE_SPEC.md`. For canonical domain names, use `specs/DOMAIN_SPEC.md`. For file storage, upload sessions, download grants, object-storage providers, Drive spaces/nodes, and SDKWork-owned file lifecycle, use `specs/DRIVE_SPEC.md`. For media representation, generated asset DTOs, and bare URL cleanup, use `specs/MEDIA_RESOURCE_SPEC.md`. For SDK naming semantics, generated client behavior, auth integration, and frontend service boundaries, use `specs/SDK_SPEC.md`, `specs/MODULE_SPEC.md`, and `specs/FRONTEND_SPEC.md`; for application-root `sdks/` workspace generation, OpenAPI authority/derived input placement, and generated artifact placement, use `specs/SDK_WORKSPACE_GENERATION_SPEC.md` as the subordinate detail standard under `SDK_SPEC.md`. For IAM login/session integration, appbase auth UI/runtime, logout clearing, and Rust AppContext validation, use `specs/IAM_LOGIN_INTEGRATION_SPEC.md`. For gRPC/protobuf contracts, use `specs/RPC_SPEC.md` and `specs/RUST_RPC_SPEC.md`. HTTP API contracts and RPC contracts must preserve shared operation semantics, but neither document replaces the other.

## 1. Normative Language

The words `MUST`, `MUST NOT`, `SHOULD`, `SHOULD NOT`, and `MAY` are used with RFC-style meaning.

| Term | Meaning |
| --- | --- |
| `MUST` | Required. A contract that violates this rule is not SDKWork-standard. |
| `MUST NOT` | Forbidden. Do not bypass this with local convention. |
| `SHOULD` | Strong recommendation. Deviation requires a documented reason. |
| `SHOULD NOT` | Strong negative recommendation. Deviation requires a documented reason. |
| `MAY` | Optional capability decided by product, compliance, or deployment needs. |

## 2. Standard Levels

| Level | Name | Minimum bar |
| --- | --- | --- |
| L0 | Legacy Compatible | Existing APIs with a migration map and documented risk. |
| L1 | Portable Core | OpenAPI 3.1.2-compatible contracts, stable paths, stable schemas, standard errors, generated SDK compatible. |
| L2 | Service Ready | Dual-token security, tenant isolation, idempotency, pagination, audit metadata, contract tests. |
| L3 | Enterprise Grade | Least privilege, ABAC conditions, audit events, rate limits, replay protection, version governance, formal deprecation windows. |

New core business APIs `MUST` target L2. IAM, tenant, organization, permission, billing, payment, entitlement, file, messaging, AI execution, admin, and security-sensitive APIs `SHOULD` target L3.

## 3. Source Of Truth

OpenAPI is the source of truth for HTTP contracts. Proto files are the source of truth for RPC contracts and follow `RPC_SPEC.md`.

Every API module `MUST` produce an OpenAPI document that can be validated and used by the SDK generator. Java annotations, Rust route declarations, TypeScript client wrappers, handwritten DTOs, Swagger UI output, and documentation snippets are implementation details unless they exactly match the OpenAPI contract.

Standard artifacts:

| Artifact | Requirement |
| --- | --- |
| OpenAPI document | `openapi: 3.1.2` when supported by the generator or another `3.1.x` patch level when tooling requires it, stable `info.version`, canonical `servers`, complete `paths`, `components.schemas`, and `components.securitySchemes`. |
| SDK generation manifest | Generator package `@sdkwork/sdk-generator`, CLI `sdkgen`, canonical generator path or resolved package location, generator version or commit, command, input spec path, output package, package name, version, SDK type, language, `apiPrefix`, and `standardProfile` when strict governance is enabled. |
| Contract tests | At least one generation or validation test that proves the spec can generate SDKs without warnings that hide contract drift. |
| API changelog | Breaking, additive, deprecated, and removed operations must be recorded. |
| Exception register | Any L0 or intentional standard exception must include owner, reason, risk, and removal plan. |

SDK family semantics, SDK package naming, client behavior, auth handling, and service integration follow `SDK_SPEC.md`. Application SDK workspace layout follows `SDK_WORKSPACE_GENERATION_SPEC.md`: authority OpenAPI documents live under `<application-root>/sdks/sdkwork-<domain>-sdk/openapi/`, `<application-root>/sdks/sdkwork-<domain>-app-sdk/openapi/`, or `<application-root>/sdks/sdkwork-<domain>-backend-sdk/openapi/`, derived `*.sdkgen.yaml` inputs are materialized deterministically, and generated transport output lives under `generated/server-openapi`.

## 4. API Surfaces

SDKWork uses three canonical API surfaces.

| Surface | Prefix | Audience | Login endpoints |
| --- | --- | --- | --- |
| IM API | `/im/v3/api` | Current instant messaging application standard open API system | Forbidden |
| App API | `/app/v3/api` | Instant messaging application app/client integration capabilities for mobile App, H5, PC applications, and other clients | Allowed and canonical |
| Backend API | `/backend/v3/api` | Admin consoles, internal operators, backend SDKs, control plane | Forbidden |

The runtime request framework classifies open-style public/domain surfaces such as `/open/v3/api` and `/im/v3/api` as `open-api` for context resolution. This runtime classification does not rename the IM SDK family or IM API authority; it defines that protected IM/open operations use API key style context resolution unless a specific app/backend contract says otherwise.

Rules:

- IM API, App API, and Backend API versions `MUST` stay aligned at `/im/v3/api`, `/app/v3/api`, and `/backend/v3/api`.
- IM API is the Craw Chat standard open API for instant messaging runtime capabilities such as conversations, messages, contacts, device sessions, realtime subscriptions, streams, and RTC signaling. It `MUST` be generated from the IM contract and consumed through the generated IM SDK.
- App API is the app/client integration surface for instant messaging applications across mobile App, H5, PC applications, desktop shells, and other clients. Shared appbase capabilities such as IAM login, registration, token refresh, verification, workspaces, app bootstrap, and reusable application modules `MUST` come from `sdkwork-appbase` / `spring-ai-plus-app-api`.
- Craw Chat `MUST NOT` reimplement, fork, or shadow `/app/v3/api` routes already owned by `sdkwork-appbase` or `spring-ai-plus-app-api`.
- Applications integrating those shared IAM flows `MUST` follow `IAM_LOGIN_INTEGRATION_SPEC.md` instead of creating product-local auth/session endpoints.
- Backend API is the management, admin, operator, and control-plane surface. It `MUST` be generated from backend contracts and consumed through backend SDKs or backend-admin integrations.
- Backend API OpenAPI authority documents `MUST` be declared as `sdkwork-<domain>-backend-api` and placed under the owning `sdks/sdkwork-<domain>-backend-sdk/openapi/` workspace when the application owns local SDK generation.
- Login, register, refresh, logout, current session, OAuth callback, verification code, password reset, and device authorization flows `MUST` live in app-api only.
- IM API and backend-api `MUST NOT` expose auth/session login endpoints. They may validate tokens and consume the validated AppContext projection.
- Backend-api `MUST NOT` expose auth/session login endpoints. It may validate tokens and manage resources.
- Backend-api `MUST NOT` expose an `auth` namespace for IAM login, session creation, verification code, password reset, OAuth session, MFA challenge, or device authorization APIs. These user-facing auth flows belong to app-api.
- SaaS Java deployment and Rust local/private deployment `MUST` expose identical paths, methods, operationIds, schemas, response envelopes, errors, and security declarations for shared modules.
- When a shared capability exposes both HTTP and RPC, the HTTP `operationId` and RPC method manifest `operationId` `MUST` describe the same domain operation.
- RPC services `MUST NOT` be used to hide missing or divergent HTTP/OpenAPI behavior for app/backend public APIs; divergence requires a documented compatibility decision.
- A frontend module `MUST` call API through `UI -> service -> injected SDK client`. UI components must not assemble raw HTTP requests or auth headers.
- New shared foundation APIs `MUST` use canonical domains from `DOMAIN_SPEC.md`.

### 4.1 Canonical Prefix Lock

The IM API, App API, and Backend API prefixes are locked. Runtime source, OpenAPI snapshots, generated SDK inputs, local Rust route tables, Java controller class-level mappings, frontend SDK bootstrap code, environment examples, and contract tests `MUST` use exactly these prefixes:

| Surface | Required prefix |
| --- | --- |
| IM API | `/im/v3/api` |
| App API | `/app/v3/api` |
| Backend API | `/backend/v3/api` |

Forbidden runtime prefixes:

- `/api/app/v1`, `/api/app/v2`, `/api/app/v3`, `/api/app/v3/api`
- `/api/backend/v1`, `/api/backend/v2`, `/api/backend/v3`, `/api/backend/v3/api`
- `/app/v1`, `/app/v2`
- `/backend/v1`, `/backend/v2`
- Bare backend resource prefixes such as `/v3/api/resources/*` when the API belongs to backend-api

Rules:

- Craw Chat IM routes `MUST` start with `/im/v3/api`.
- Java app-api controller class-level mappings `MUST` start with `/app/v3/api`.
- Java backend-api controller class-level mappings `MUST` start with `/backend/v3/api`.
- Method-level relative mappings may use subpaths such as `/list` or `/{id}` only when the owning class-level mapping is already canonical.
- Rust local/private APIs that implement shared app modules `MUST` expose the same `/app/v3/api` paths as app-api only when that module is not already owned by sdkwork-appbase. If the module exists in `sdkwork-appbase` or `spring-ai-plus-app-api`, the consuming application must integrate that module instead of duplicating it locally.
- Backend-api `MUST NOT` publish bare `/v3/api/*` resources. If a resource is part of backend-api, it must move under `/backend/v3/api/...`; if it is not part of backend-api, it must be documented as a non-SDK static/public resource outside the backend-api OpenAPI surface.
- Generated SDK manifests and OpenAPI source contracts `MUST` fail validation if any runtime path uses a forbidden prefix.
- Environment examples and app bootstrap defaults `MUST` use canonical prefixes. Historical or migration documents may mention old prefixes only when explicitly labeled `legacy`, `deprecated`, `noncanonical`, or `migration-only`.

## 5. URL And Path Standard

### 5.1 Path Format

URL paths use lowercase `lower_snake_case`.

Good:

```text
/app/v3/api/auth/sessions
/app/v3/api/auth/sessions/current
/app/v3/api/iam/organizations/{organizationId}/members
/backend/v3/api/iam/roles/{roleId}/permissions
```

Forbidden:

```text
/app/v3/api/auth/login
/app/v3/api/auth__login
/app/v3/api/userCenter/profile
/backend/v3/api/auth/sessions
/app/v3/api/iam/organizations/{organization_id}
```

Rules:

- Static path segments `MUST` be lowercase `lower_snake_case`.
- Path parameters `MUST` be `lowerCamelCase`.
- Paths `MUST` be resource-oriented, not RPC-oriented by default.
- Command-like action segments `MAY` be used only when the operation is not naturally represented by CRUD, for example `activate`, `deactivate`, `cancel`, `submit`, `verify`, `resend`, `revoke`, `restore`.
- Action segments `MUST` still use lowercase `lower_snake_case`.
- Do not use double underscores, colons, uppercase path segments, or mixed naming styles.

### 5.2 Resource Naming

Collections use plural nouns. Singletons use clear singleton names.

| Concept | Standard path |
| --- | --- |
| Sessions | `/auth/sessions` |
| Current session | `/auth/sessions/current` |
| Tenants | `/iam/tenants` |
| Organizations | `/iam/organizations` |
| Organization members | `/iam/organizations/{organizationId}/members` |
| Users | `/iam/users` |
| Roles | `/iam/roles` |
| Role permissions | `/iam/roles/{roleId}/permissions` |
| API keys | `/iam/api_keys` |
| Audit events | `/iam/audit_events` |

## 6. HTTP Method Standard

| Method | Meaning | Body |
| --- | --- | --- |
| `GET` | Retrieve a resource or list resources | No request body |
| `POST` | Create resource or execute non-idempotent command | Usually has body |
| `PUT` | Replace a resource | Has full body |
| `PATCH` | Partially update a resource | Has partial body |
| `DELETE` | Delete, revoke, or detach a resource | Body discouraged |

Rules:

- `GET` operations `MUST` be safe and not change server state.
- `PUT` and idempotent `POST` commands `SHOULD` support `Idempotency-Key` for retry safety.
- `DELETE` returning no content `SHOULD` use `204`.
- Bulk create/update/delete operations `MUST` define item-level result semantics and partial failure rules.
- Long-running operations `SHOULD` return `202` with an operation resource or job resource.

## 7. OperationId Standard

Operation IDs are SDK surface contracts. They are not arbitrary Swagger labels and they must be designed before implementation. The generated SDK method name is a public API for every app that consumes the module.

### 7.1 Grammar

`operationId` `MUST` follow this grammar:

```text
operationId = resourcePath "." action
resourcePath = lowerCamelResource *( "." lowerCamelResource )
action = lowerCamelAction
lowerCamelResource = lowercaseLetter *( letter / digit )
lowerCamelAction = lowercaseLetter *( letter / digit )
```

Valid examples:

```text
sessions.create
sessions.current.retrieve
verificationCodes.verify
tenants.members.list
organizations.members.create
roles.permissions.delete
apiKeys.revoke
securityEvents.list
```

Invalid examples:

```text
auth__login
auth.login
createSession
sessions_create
Sessions.create
sessions.Create
organizations/{organizationId}/members.create
iam.organizations.list
```

Rules:

- `operationId` `MUST` use lowerCamelCase dotted segments.
- `operationId` `MUST` contain at least one resource segment and one action segment.
- `operationId` `MUST NOT` contain `__`, `_`, `-`, `/`, `{`, `}`, spaces, colons, or uppercase first characters.
- `operationId` `MUST NOT` duplicate the tag name. With tag `iam`, use `organizations.list`, not `iam.organizations.list`.
- `operationId` `MUST` be globally unique in the OpenAPI document.
- Path parameter names `MUST NOT` appear in `operationId`. Resource identity belongs in method arguments, not in SDK method names.
- `operationId` `MUST` remain stable across Java SaaS and Rust local/private implementations.

### 7.2 Tag And OperationId Responsibilities

Tags define the top-level SDK module. Operation IDs define nested SDK resources and method names.

```text
tag: auth
operationId: sessions.create
SDK: client.auth.sessions.create(body)

tag: iam
operationId: organizations.members.create
SDK: client.iam.organizations.members.create(organizationId, body)
```

Rules:

- Each operation `MUST` have exactly one canonical tag.
- The tag `MUST` be lowerCamelCase.
- A tag `MUST` represent a bounded API domain such as `auth`, `iam`, `billing`, `content`, `communication`, `ai`, or `system`.
- Do not use Java controller names, Rust module names, page names, table names, or generated class names as tags.
- Do not repeat the tag inside `operationId`.

### 7.3 URL To OperationId Mapping

Static URL segments use `lower_snake_case`; operationId resource segments use `lowerCamelCase`.

| URL segment | operationId segment |
| --- | --- |
| `sessions` | `sessions` |
| `current` | `current` |
| `verification_codes` | `verificationCodes` |
| `password_reset_requests` | `passwordResetRequests` |
| `api_keys` | `apiKeys` |
| `security_events` | `securityEvents` |
| `audit_events` | `auditEvents` |

Mapping rules:

- Remove the API prefix `/app/v3/api` or `/backend/v3/api`.
- Use the tag as the top-level SDK module and do not include it again in operationId.
- Convert static resource path segments after the tag/domain segment from `lower_snake_case` to lowerCamelCase.
- Omit path parameters from operationId.
- Append one standard action segment as the last dotted segment.
- Singleton words such as `current`, `me`, or `default` may remain resource segments when they represent stable singleton resources.

Examples:

| Method | Path | Tag | operationId | SDK surface |
| --- | --- | --- | --- | --- |
| `POST` | `/app/v3/api/auth/sessions` | `auth` | `sessions.create` | `client.auth.sessions.create(body)` |
| `GET` | `/app/v3/api/auth/sessions/current` | `auth` | `sessions.current.retrieve` | `client.auth.sessions.current.retrieve()` |
| `DELETE` | `/app/v3/api/auth/sessions/current` | `auth` | `sessions.current.delete` | `client.auth.sessions.current.delete()` |
| `POST` | `/app/v3/api/auth/verification_codes` | `auth` | `verificationCodes.create` | `client.auth.verificationCodes.create(body)` |
| `POST` | `/app/v3/api/auth/verification_codes/verify` | `auth` | `verificationCodes.verify` | `client.auth.verificationCodes.verify(body)` |
| `GET` | `/backend/v3/api/iam/users` | `iam` | `users.list` | `client.iam.users.list(params)` |
| `GET` | `/backend/v3/api/iam/users/{userId}` | `iam` | `users.retrieve` | `client.iam.users.retrieve(userId)` |
| `PATCH` | `/backend/v3/api/iam/users/{userId}` | `iam` | `users.update` | `client.iam.users.update(userId, body)` |
| `GET` | `/backend/v3/api/iam/organizations/{organizationId}/members` | `iam` | `organizations.members.list` | `client.iam.organizations.members.list(organizationId, params)` |
| `POST` | `/backend/v3/api/iam/organizations/{organizationId}/members` | `iam` | `organizations.members.create` | `client.iam.organizations.members.create(organizationId, body)` |
| `DELETE` | `/backend/v3/api/iam/roles/{roleId}/permissions/{permissionId}` | `iam` | `roles.permissions.delete` | `client.iam.roles.permissions.delete(roleId, permissionId)` |

### 7.4 Standard Action Vocabulary

Use standard action names consistently.

| HTTP shape | Action | Example |
| --- | --- | --- |
| `GET /resources` | `list` | `users.list` |
| `POST /resources` | `create` | `users.create` |
| `GET /resources/{resourceId}` | `retrieve` | `users.retrieve` |
| `PUT /resources/{resourceId}` | `update` | `users.update` |
| `PATCH /resources/{resourceId}` | `update` | `users.update` |
| `DELETE /resources/{resourceId}` | `delete` | `users.delete` |
| `POST /resources/{resourceId}/restore` | `restore` | `users.restore` |
| `POST /resources/{resourceId}/activate` | `activate` | `users.activate` |
| `POST /resources/{resourceId}/deactivate` | `deactivate` | `users.deactivate` |
| `POST /resources/{resourceId}/revoke` | `revoke` | `apiKeys.revoke` |
| `POST /resources/{resourceId}/verify` | `verify` | `verificationCodes.verify` |
| `POST /resources/refresh` | `refresh` | `sessions.refresh` |
| `POST /resources/batch_create` | `batchCreate` | `users.batchCreate` |
| `POST /resources/batch_update` | `batchUpdate` | `users.batchUpdate` |
| `POST /resources/batch_delete` | `batchDelete` | `users.batchDelete` |

Rules:

- Do not use `get` for resource retrieval; use `retrieve`.
- Do not use `remove` for resource deletion; use `delete` unless the domain specifically distinguishes detach/remove from delete.
- Do not use `add` for collection creation; use `create`.
- Do not encode HTTP method names into operationIds, such as `postSession` or `getUsers`.
- Do not use vague actions such as `handle`, `process`, `do`, `execute`, or `operate`.
- If a business command needs a domain verb, the verb must match the final URL action segment and be stable, for example `submit`, `approve`, `reject`, `cancel`, `archive`, `publish`, or `unpublish`.

### 7.5 SDK Compatibility Rules

Rules:

- The generated TypeScript SDK for SDKWork v3 `SHOULD` expose nested resources, for example `client.auth.sessions.create()`.
- Flat legacy methods such as `client.auth.createSession()`, `client.auth.sessionsCreate()`, or `client.auth.authLogin()` `MUST NOT` be introduced for new SDKWork v3 APIs.
- App SDKs and backend SDKs may be different npm packages or generated clients, but the resource method shape `MUST` be the same for equivalent contracts.
- App-specific SDK client construction may differ, but once the client is injected into a service, the method surface must be stable.
- Changing operationId is a breaking SDK change and requires explicit version governance.
- SDK generators `MUST` synthesize nested resource clients directly from `tag + dotted operationId`. A generator that flattens `sessions.create` into `createSession` is not SDKWork v3 compliant.

### 7.6 Collision And Naming Review

Before accepting an OpenAPI document:

- Check that all operationIds are globally unique.
- Check that no two operations in the same tag produce the same SDK method path.
- Check that no operationId contains a tag prefix, controller prefix, or implementation detail.
- Check that action names are from the standard vocabulary or have a documented domain reason.
- Check that URL path, operationId, schema names, and response examples describe the same resource model.

## 8. Standard Tags And Domains

Tags are SDK modules, not arbitrary controller names.

| Tag | Domain |
| --- | --- |
| `auth` | Login, sessions, token refresh, verification, OAuth, password reset |
| `iam` | Tenants, organizations, users, roles, permissions, policies, API keys, security settings |
| `profile` | Current user's profile and preferences if separated from IAM admin resources |
| `billing` | Billing, settlement, wallet, payment, invoice, pricing |
| `content` | Documents, media, assets, drive, comments |
| `communication` | IM, contacts, channels, notifications |
| `ai` | Models, agents, tools, workflows, prompts, memory |
| `system` | App metadata, health, settings, support, feature flags |

Rules:

- Do not create tags named after Java controllers, Rust modules, pages, or database tables.
- A bounded context may define additional tags, but they `MUST` be registered in the module prefix/domain registry.
- IAM concepts `MUST` use `iam`, not vague `identity`, for API and database contracts. Existing package directories may keep architecture grouping names during migration, but the domain contract is `iam`.

## 9. OpenAPI Document Requirements

### 9.1 Required Top-Level Fields

```yaml
openapi: 3.1.0
info:
  title: SDKWork App API
  version: 3.0.0
servers:
  - url: https://api.example.com
paths: {}
components:
  schemas: {}
  securitySchemes: {}
```

Rules:

- OpenAPI version `SHOULD` be `3.1.2` for new standard contracts when the SDK generator supports it. A `3.1.x` patch level is acceptable when a toolchain has not yet adopted `3.1.2`.
- OpenAPI `3.2.x` features `MUST NOT` be used in source contracts until generator and runtime parity tests pass for TypeScript, Java SaaS, and Rust local/private targets.
- JSON Schema dialect `SHOULD` be compatible with 2020-12.
- `info.version` `MUST` be semantic and traceable to generated SDK versions.
- Each operation `MUST` include `summary`, `operationId`, `tags`, `responses`, and explicit `security`.
- Each request and response body `MUST` declare media type and schema.
- `application/json` is the default success body media type.
- Error responses `MUST` include `application/problem+json`.

### 9.2 Security Schemes

App and backend protected operations use dual-token security. Open API operations use API key security when they are not explicitly public.

```yaml
components:
  securitySchemes:
    AuthToken:
      type: http
      scheme: bearer
      bearerFormat: JWT
    AccessToken:
      type: apiKey
      in: header
      name: Access-Token
    ApiKey:
      type: apiKey
      in: header
      name: X-API-Key
```

Rules:

- Protected app-api and backend-api operations `MUST` require both `AuthToken` and `AccessToken`.
- Protected open-api operations `MUST` require `ApiKey`.
- Public operations `MUST` explicitly set `security: []`.
- `Authorization: Bearer <auth_token>` authenticates the principal/session.
- `Access-Token: <access_token>` carries access context such as tenant, organization, app, environment, and scope claims.
- `X-API-Key` carries an API key credential only. The server resolves tenant, organization, user, app, scope, and key identity from the validated API key object.
- `Access-Token` is the canonical SDKWork access isolation header for v3 contracts.
- Do not define duplicate security scheme names for the same token.
- API key mode and dual-token mode `MUST` be mutually exclusive for one request.

Protected app/backend operation example:

```yaml
security:
  - AuthToken: []
    AccessToken: []
```

Protected open-api operation example:

```yaml
security:
  - ApiKey: []
```

Public operation example:

```yaml
security: []
```

## 10. Token And Tenant Isolation Standard

The dual-token model separates authentication from access isolation.

| Token | Header | Purpose |
| --- | --- | --- |
| `auth_token` | `Authorization: Bearer` | Principal identity, session identity, authentication strength, token expiry |
| `access_token` | `Access-Token` | Tenant, organization, app, environment, data scope, permission scope, deployment mode |

Rules:

- Tenant isolation data `MUST` be resolvable from verified token claims or a server-side token lookup.
- Business requests `MUST NOT` trust tenant, organization, role, or user IDs supplied only by body/query parameters when they conflict with token context.
- If a request path contains `tenantId` or `organizationId`, the server `MUST` verify it matches or is authorized by token claims.
- A token claim that affects authorization `MUST` be signed or server-validated.
- Auth/session endpoints in app-api may be public but must return standard token objects and context metadata.
- Local Rust deployment `MUST` enforce the same logical token and tenant checks even if tokens are issued locally.

Recommended token claims:

```json
{
  "sub": "user_01",
  "sid": "session_01",
  "tenant_id": "10001",
  "organization_id": "20001",
  "app_id": "sdkwork_router",
  "environment": "prod",
  "scope": ["iam.users.read", "iam.roles.write"],
  "auth_level": "password_mfa",
  "iat": 1760000000,
  "exp": 1760003600
}
```

### 10.1 Appbase Request Context Framework

All SDKWork appbase HTTP implementations `MUST` expose a unified request context before protected business handlers run. The standard Rust implementation is `sdkwork_http_context` in `sdkwork-appbase`; Java and other runtimes must preserve the same behavior and vocabulary.

Required context object:

```text
AppRequestContext =
  request_id
  api_surface
  auth_mode
  principal
  path
  method
  credential_presence

AppRequestPrincipal =
  tenant_id
  organization_id
  user_id
  session_id
  app_id
  environment
  deployment_mode
  auth_level
  data_scope
  permission_scope
  api_key_id
  subject_type
```

API surface and resolver standard:

| Surface | Prefixes | Auth mode | Resolver standard |
| --- | --- | --- | --- |
| `open-api` | `/open/v3/api`, `/im/v3/api` | API key | `ApiKeyParser` normalizes the credential, then `ApiKeyLookupService` resolves the API key record and produces `AppRequestPrincipal`. |
| `app-api` | `/app/v3/api` | Dual token | `AuthTokenParser` plus `AccessTokenParser` resolve and validate one principal context. |
| `backend-api` | `/backend/v3/api` | Dual token | `AuthTokenParser` plus `AccessTokenParser` resolve and validate one principal context. |

Rules:

- `AppRequestContext` `MUST` be resolved once at the framework boundary and injected as a typed request extension or equivalent runtime context.
- Business handlers `MUST` consume the typed context. They `MUST NOT` reparse auth tokens, access tokens, API keys, or tenant/user fields from raw headers.
- `AuthTokenParser`, `AccessTokenParser`, `ApiKeyParser`, `ApiKeyLookupService`, and `AppRequestContextResolver` are standard extension points.
- The default parser may support local/private development claim formats, but production parsers `MUST` validate signature, expiry, issuer, audience, revocation, tenant binding, organization binding, app binding, and permission scope.
- API key lookup `MUST` be abstracted behind a service/interface. Implementations may use `iam_api_key`, tenant-local API key tables, encrypted secret stores, caches, or remote IAM services.
- API key records `MUST` provide the principal user id, tenant id, organization id when applicable, app id, data scope, permission scope, key id, and revocation/expiry state.
- Dual-token resolution `MUST` reject conflicting tenant, organization, user, session, or app claims when both tokens carry the same field.
- Context values from request body, query, path, or frontend state `MUST NOT` override the resolved context.

### 10.2 API Call Chain And Interceptor Standard

All SDKWork appbase HTTP routers `MUST` run protected requests through an ordered API call chain. The chain is the standard place for cross-cutting policy, security, observability, and context injection.

Standard order:

1. Request identity
2. Surface classification
3. CORS
4. Method guard
5. Cross-site request guard
6. SQL injection request guard
7. Request size limit
8. Rate limit
9. Idempotency
10. Request context resolution
11. Authentication
12. Authorization
13. Tenant isolation
14. Context injection
15. Logging
16. Audit
17. Header security
18. Response identity

Rules:

- Frameworks `MUST` expose an interceptor interface equivalent to `ApiCallInterceptor` with `before` and `after` phases.
- The standard chain `MUST` be extensible without bypassing context resolution or security guards.
- Request identity, surface classification, request context resolution, authentication, context injection, response identity, and secure response headers are mandatory for protected appbase routers.
- Authorization, tenant isolation, rate limit, idempotency, logging, and audit may be implemented by product-specific interceptors, but their hook positions and semantics `MUST` remain standard.
- CORS, method guard, cross-site request protection, request size limits, and SQL injection request guards `SHOULD` run before credential parsing to reduce attack surface.
- The SQL injection guard is a request-layer heuristic only. All database access `MUST` still use bind parameters, typed repositories, input validation, and server-side authorization.
- Error responses produced by the chain `MUST` use `application/problem+json` and include the server-owned request id when available.

## 11. Standard IAM API

IAM is the common base module for every app.

### 11.1 Auth Sessions

| Method | Path | operationId | Security |
| --- | --- | --- | --- |
| `POST` | `/app/v3/api/auth/sessions` | `sessions.create` | Public |
| `GET` | `/app/v3/api/auth/sessions/current` | `sessions.current.retrieve` | Dual token |
| `PATCH` | `/app/v3/api/auth/sessions/current` | `sessions.current.update` | Dual token |
| `DELETE` | `/app/v3/api/auth/sessions/current` | `sessions.current.delete` | Dual token |
| `POST` | `/app/v3/api/auth/sessions/refresh` | `sessions.refresh` | Public or refresh-token proof |

### 11.2 Verification And Recovery

| Method | Path | operationId |
| --- | --- | --- |
| `POST` | `/app/v3/api/auth/verification_codes` | `verificationCodes.create` |
| `POST` | `/app/v3/api/auth/verification_codes/verify` | `verificationCodes.verify` |
| `GET` | `/app/v3/api/auth/verification_policy` | `verificationPolicy.retrieve` |
| `POST` | `/app/v3/api/auth/password_reset_requests` | `passwordResetRequests.create` |
| `POST` | `/app/v3/api/auth/password_resets` | `passwordResets.create` |
| `GET` | `/app/v3/api/auth/oauth_authorization_urls` | `oauthAuthorizationUrls.retrieve` |
| `POST` | `/app/v3/api/auth/oauth_sessions` | `oauthSessions.create` |

### 11.3 IAM Resource Management

These paths belong to app-api for user-facing self-service and to backend-api for administrative management when needed. The path, schema, and operationId must remain consistent.

| Resource | Standard path |
| --- | --- |
| Tenants | `/iam/tenants` |
| Tenant memberships | `/iam/tenants/{tenantId}/members` |
| Organizations | `/iam/organizations` |
| Organization tree | `/iam/organizations/tree` |
| Organization members | `/iam/organizations/{organizationId}/members` |
| Users | `/iam/users` |
| Current user | `/iam/users/current` |
| Roles | `/iam/roles` |
| Permissions | `/iam/permissions` |
| Role permissions | `/iam/roles/{roleId}/permissions` |
| User roles | `/iam/users/{userId}/roles` |
| Policies | `/iam/policies` |
| API keys | `/iam/api_keys` |
| Security events | `/iam/security_events` |
| Audit events | `/iam/audit_events` |

## 12. Schema Naming Standard

Schema names use `PascalCase`.

| Category | Pattern | Example |
| --- | --- | --- |
| Resource | `<Domain><Resource>` or clear resource name | `IamUser`, `Tenant`, `Organization` |
| Create request | `Create<Resource>Request` | `CreateSessionRequest` |
| Update request | `Update<Resource>Request` | `UpdateOrganizationRequest` |
| Patch request | `Patch<Resource>Request` | `PatchUserRequest` |
| List params | `List<Resource>Params` | `ListUsersParams` |
| Page response | `<Resource>Page` | `UserPage` |
| Command response | `<Action><Resource>Response` | `VerifyCodeResponse` |
| Error | `ProblemDetail` | `ProblemDetail` |

Rules:

- Request schemas `MUST NOT` reuse entity schemas directly when writable fields differ from readable fields.
- Response schemas `MUST` avoid leaking password hashes, token secrets, internal IDs not intended for clients, deleted data, or private security metadata.
- Enum schemas `SHOULD` use string values for API stability unless numeric values are legally required.
- `additionalProperties` `MUST` be explicit.

## 13. Field Naming And Type Mapping

JSON field names use `lowerCamelCase`.

Database fields use `lower_snake_case`, but API fields use `lowerCamelCase`.

| Database | API |
| --- | --- |
| `tenant_id` | `tenantId` |
| `organization_id` | `organizationId` |
| `created_at` | `createdAt` |
| `updated_at` | `updatedAt` |
| `auth_token` | `authToken` |
| `access_token` | `accessToken` |

Cross-language-safe type mapping:

| Logical type | OpenAPI schema | JSON representation |
| --- | --- | --- |
| `int64` | `type: string`, `format: int64`, `pattern: "^-?[0-9]+$"` plus `x-sdkwork-int64-string: true` | String |
| `decimal` | `type: string`, decimal pattern | String |
| `instant` | `type: string`, `format: date-time` | ISO 8601 UTC |
| `date` | `type: string`, `format: date` | ISO date |
| `uuid` | `type: string`, `format: uuid` when true UUID | String |
| `json` | Explicit object schema or `additionalProperties` | Object |
| `enum` | `type: string`, `enum` | String |

Rules:

- API `int64` values `MUST` be strings to avoid JavaScript precision loss.
- The string rule applies only at the HTTP JSON/browser/generated-TypeScript boundary. Rust, Java, Go, C#, database schemas, and internal domain models `MUST` keep their native numeric representations such as Rust `i64`, Java `long`, Go `int64`, C# `long`, and SQL `BIGINT`.
- OpenAPI schemas for browser-facing `int64` fields and parameters `MUST NOT` use `type: integer, format: int64`. They `MUST` use `type: string`, `format: int64`, a digit pattern such as `^-?[0-9]+$`, `^[0-9]+$`, or `^[1-9][0-9]*$`, `x-sdkwork-int64-string: true`, and a native implementation hint such as `x-sdkwork-rust-type: i64` when the Rust side owns the endpoint.
- Frontend code and generated TypeScript SDKs `MUST` receive, store, compare, and submit `int64` values as strings. They `MUST NOT` parse `int64` IDs, snowflake IDs, versions, sequence numbers, byte counters, or monetary minor-unit values into JavaScript `number`.
- Server HTTP adapters `MUST` parse inbound `int64` strings at the request boundary, validate sign/range/domain constraints, and pass native numeric values into Rust/domain/database code. Business logic and SQL bindings must not be rewritten to string IDs merely because the browser JSON contract is string-based.
- Monetary and high-precision decimals `MUST` be strings.
- Timestamps `MUST` be ISO 8601 UTC unless a domain explicitly requires a local date.
- Use `nullable` semantics through JSON Schema union types, for example `type: ["string", "null"]`.
- Images, videos, audio, voice, documents, archives, generated media, product media, upload results, and object-storage backed files `MUST` use `MediaResource` or `MediaResource[]` from `MEDIA_RESOURCE_SPEC.md` in new SDKWork-owned business contracts.
- SDKWork-owned file upload, download, provider, bucket/object, upload-session, and object-storage lifecycle APIs `MUST` be Drive APIs governed by `DRIVE_SPEC.md`. Product, IM, commerce, profile, app manifest, and AI business APIs consume Drive references and `MediaResource`; they must not define parallel storage lifecycle APIs.
- Bare media URL fields such as `avatarUrl`, `coverImage`, `thumbnailUrl`, `videoUrl`, `audioUrl`, `fileUrl`, `assetUrl`, and `imageUrl` `MUST NOT` appear in SDKWork-owned business DTOs for new applications. They must be replaced by natural business-role fields such as `avatar`, `cover`, `thumbnail`, `poster`, `video`, `audio`, `file`, `document`, `asset`, `mainImage`, `galleryImage`, `detailImage`, or `skuImage` whose schema type is `MediaResource`.
- Bare URL fields are allowed only when the field is explicitly a non-media link, endpoint, callback, payment, or provider-adapter wire field. Provider-adapter wire fields must be normalized to `MediaResource` before entering SDKWork-owned business contracts.
- Request body schemas used for list/search/filter input `MUST` use `q` for generic free-text search. They `MUST NOT` expose duplicate aliases such as `keyword`, `search`, `searchQuery`, or `search_query` for the same meaning.
- Response schemas and domain history objects may use explicit domain fields such as `keyword` when the field is stored or returned data, not a client-side generic search input.
- OpenAI-compatible `/v1` schemas may keep OpenAI wire names such as `search_query`; do not rename OpenAI compatibility fields to `q`.
- Do not rely on OpenAPI `format` alone for validation; important constraints `SHOULD` include `pattern`, `minimum`, `maximum`, `minLength`, `maxLength`, or `enum`.

### 13.1 MediaResource Schema Standard

`MediaResource` is the canonical HTTP API representation for usable SDKWork media resources. Drive is the storage lifecycle authority for SDKWork-owned object-storage-backed files.

Rules:

- API surfaces `SHOULD` define reusable `MediaResource`, `MediaKind`, `MediaSource`, `MediaAccess`, `MediaChecksum`, and `MediaAiProvenance` components following `MEDIA_RESOURCE_SPEC.md`.
- Persisted media resources `MUST` include stable identity such as `id`, Drive `uri`, Drive `objectBlobId`, or a provider `uri`; `url` alone is not a stable persisted identity.
- `url` inside `MediaResource` is a delivery hint and may be signed or temporary. APIs must not require clients to parse storage identity out of it.
- Drive upload APIs may return presigned URLs or upload sessions, but the completion result `SHOULD` return a Drive resource and a `MediaResource` or enough stable fields to construct one.
- SDKWork-owned business APIs `MUST NOT` expose `bucketId`, `objectKey`, provider endpoints, or presigned URLs as normal business DTO identity. Those fields are allowed only in Drive backend/admin or internal provider-adapter APIs.
- AI provider adapter DTOs may preserve provider-native names such as `image_url`, `audio_url`, `video_url`, `uri`, or `url`. SDKWork business DTOs must normalize them to `MediaResource` before storing or publishing domain state.
- Recursive `MediaResource` fields for `poster`, `thumbnails`, and `variants` may be replaced with non-recursive `MediaVariant`/`MediaRendition` helper schemas only when a generator cannot safely emit recursive SDK types.

## 14. Request Body Standard

Rules:

- Request body schemas `MUST` define required fields explicitly.
- `POST`, `PUT`, and `PATCH` `SHOULD` use JSON object bodies unless file upload or form semantics are required.
- Partial update `PATCH` schemas `MUST` distinguish omitted fields from explicit `null`.
- Sensitive fields such as password, verification code, token, and private key `MUST` be `writeOnly: true`.
- Server-managed fields such as `id`, `tenantId`, `createdAt`, `updatedAt`, `version`, and audit fields `MUST NOT` be client-writable unless explicitly documented.

Example:

```yaml
CreateSessionRequest:
  type: object
  additionalProperties: false
  required: [loginName, password]
  properties:
    loginName:
      type: string
      minLength: 1
      maxLength: 320
    password:
      type: string
      minLength: 8
      maxLength: 256
      writeOnly: true
    tenantHint:
      type: [string, "null"]
      maxLength: 128
```

## 15. Response Standard

### 15.1 Success Responses

Rules:

- `200` for successful retrieve/update/action with body.
- `201` for creation when a resource is created and returned.
- `202` for accepted asynchronous work.
- `204` for successful delete/logout/no-body operations.
- Response schemas `MUST` be explicit.
- List responses `MUST` use the standard page shape unless the list is guaranteed small and bounded.

### 15.2 Error Responses

All error responses `MUST` use `application/problem+json` and the standard `ProblemDetail` schema.

```yaml
ProblemDetail:
  type: object
  additionalProperties: true
  required: [type, title, status]
  properties:
    type:
      type: string
      format: uri-reference
    title:
      type: string
    status:
      type: integer
      minimum: 100
      maximum: 599
    detail:
      type: string
    instance:
      type: string
    code:
      type: string
    traceId:
      type: string
    errors:
      type: array
      items:
        $ref: "#/components/schemas/FieldError"
```

Common status codes:

| Status | Meaning |
| --- | --- |
| `400` | Invalid request syntax or domain validation failure |
| `401` | Missing, invalid, or expired authentication |
| `403` | Authenticated but not authorized |
| `404` | Resource not found or intentionally hidden |
| `409` | Conflict, version mismatch, duplicate unique key |
| `412` | Precondition failed |
| `422` | Semantically invalid command where `400` is too broad |
| `429` | Rate limit exceeded |
| `500` | Internal server error |
| `503` | Service unavailable |

Rules:

- Do not return stack traces, SQL, credentials, token internals, or internal hostnames.
- Validation errors `SHOULD` include field-level `errors`.
- `traceId` `SHOULD` be present on every error.
- Security-sensitive `404` may hide unauthorized resource existence, but this must be consistent for the operation.

## 16. Pagination, Filtering, Sorting

Standard page query parameters:

| Parameter | Type | Meaning |
| --- | --- | --- |
| `page` | integer, default `1` | One-based page index |
| `page_size` | integer, default `20`, max `200` | Page size |
| `cursor` | string | Cursor for cursor pagination |
| `sort` | string | Comma-separated sort fields, `-createdAt` for descending |
| `q` | string | Search keyword |

Query parameter names in the OpenAPI contract are wire names. Generated SDKs,
service methods, or controller variables may expose language-idiomatic aliases,
but those aliases `MUST NOT` feed back into the OpenAPI parameter name.

Standard page response:

```yaml
UserPage:
  type: object
  additionalProperties: false
  required: [items, pageInfo]
  properties:
    items:
      type: array
      items:
        $ref: "#/components/schemas/IamUser"
    pageInfo:
      $ref: "#/components/schemas/PageInfo"
```

Rules:

- List APIs `MUST` be paginated unless the collection is bounded by design.
- Sort fields `MUST` use API field names, not database column names.
- Query parameter names `MUST` use lowercase URL names because they are part of the URL contract.
- Multi-word query parameter names `MUST` use `lower_snake_case`, such as `page_size`, `created_after`, and `organization_id`.
- Single-word query parameter names `MUST` stay lowercase without an underscore, such as `q`, `page`, `sort`, `cursor`, `limit`, and `status`.
- The standard free-text search parameter is `q`. OpenAPI URL query parameters and generated SDK query parameters `MUST NOT` use `keyword`, `search`, `searchQuery`, or `search_query` for generic search.
- A list operation `MUST NOT` expose multiple names such as `q`, `keyword`, `search`, `searchQuery`, or `search_query` for the same free-text search meaning. Use `q` for generic keyword search; reserve explicit multi-word filters for distinct domain concepts. SDK or implementation variables may use language-idiomatic names such as `searchQuery`, but those names must map to the wire parameter `q`.
- Filtering parameters `SHOULD` be explicit instead of a free-form SQL-like expression.
- Cursor pagination `SHOULD` be used for high-volume or unstable lists.

## 17. Idempotency And Concurrency

Rules:

- Retriable create and payment-like commands `MUST` support `Idempotency-Key`.
- `Idempotency-Key` values are scoped by tenant, principal, method, and path.
- `requestId` is server-owned request identity, not an idempotency key and not a browser/client-generated field.
- App and backend API servers MUST generate a canonical UUID requestId for each request that records request correlation.
- App and backend OpenAPI contracts MUST NOT declare `X-Request-Id`, and generated app/backend SDKs MUST NOT expose `xRequestId` parameters.
- Browser, frontend, app SDK, and backend-admin SDK consumers `MUST NOT` send `X-Request-Id`.
- If an edge gateway or trusted upstream component needs to preserve its own correlation id, it must use a domain-specific upstream correlation field and must not override the SDKWork server requestId.
- Request body schemas for new create/update/command operations `MUST NOT` require a client-filled `requestId` for SDKWork request correlation.
- Success and error responses SHOULD expose the server requestId when the API contract exposes request correlation, including problem details, audit records, runtime records, usage logs, and asynchronous command responses.
- Resource updates `SHOULD` support optimistic concurrency with `version`, `If-Match`, or equivalent domain versioning.
- Duplicate idempotency keys with different payloads `MUST` return `409`.
- Idempotency records `SHOULD` follow database rules in `specs/DATABASE_SPEC.md`.

## 18. Multi-Tenant And Authorization Semantics

Rules:

- Tenant and organization context `MUST` come from token context or validated route context.
- Authorization `MUST` be checked in service/business logic, not only in UI.
- Frontend permission checks are user experience hints, not security boundaries.
- RBAC is the baseline: users, roles, permissions, role-permissions, user-roles.
- ABAC conditions `SHOULD` be supported for tenant, organization, owner, data scope, environment, resource state, and time-based restrictions.
- Permission codes `MUST` be stable strings, for example `iam.users.read`, `iam.roles.write`, `billing.invoices.read`.
- APIs `MUST` define the required permission or public status using OpenAPI extensions.

Recommended extensions:

```yaml
x-sdkwork-permission: iam.users.read
x-sdkwork-tenant-scope: tenant
x-sdkwork-data-scope: organization
x-sdkwork-audit-event: iam.user.read
```

## 19. Standard OpenAPI Extensions

SDKWork governance tools may read these extensions.

| Extension | Meaning |
| --- | --- |
| `x-sdkwork-domain` | Bounded context such as `iam`, `billing`, `ai` |
| `x-sdkwork-resource` | Canonical resource name |
| `x-sdkwork-permission` | Required permission code |
| `x-sdkwork-public` | Explicit public operation marker |
| `x-sdkwork-tenant-scope` | `platform`, `tenant`, `organization`, `user`, `owner` |
| `x-sdkwork-data-scope` | Data visibility scope |
| `x-sdkwork-audit-event` | Audit event type |
| `x-sdkwork-idempotent` | Whether idempotency is required |
| `x-sdkwork-sdk-resource` | SDK nested resource override if path inference is insufficient |
| `x-sdkwork-deployment` | `saas`, `private`, `local`, or `all` |

Rules:

- Extensions `MUST NOT` contradict security requirements.
- Extensions are governance metadata; behavior still needs server enforcement.

## 20. SDK Generation Standard

Rules:

- Generated SDKs are the only approved API transport for frontend business modules.
- HTTP SDKs `MUST` be generated by the canonical SDKWork generator at `D:\javasource\spring-ai-plus\sdk\sdkwork-sdk-generator` (`@sdkwork/sdk-generator` / `sdkgen`). Do not use `sdkwork-code-generator`, copied generator code, local stubs, generic OpenAPI generators, or product-local generator aliases for committed SDK output unless the alias is a documented wrapper that invokes the canonical generator.
- SDK family semantics, SDK package naming, generated client behavior, auth integration, and frontend service boundaries `MUST` follow `SDK_SPEC.md`.
- Application-root `sdks/` workspace layout, authority OpenAPI files, derived `sdkgen` files, backend OpenAPI SDK generation, and generated-output placement `MUST` follow `SDK_WORKSPACE_GENERATION_SPEC.md`.
- Do not use raw `fetch`, `axios`, manual auth headers, local SDK forks, or handwritten DTO shims to bypass missing SDK capabilities.
- If a capability is missing, update OpenAPI and regenerate SDKs.
- TypeScript SDKs for new SDKWork v3 app, backend, and IM contracts `MUST` use `--standard-profile sdkwork-v3`.
- Resource-style operationIds `MUST` produce nested SDK resources.
- App-specific SDK clients may differ by package and constructor, but method shape `MUST` remain consistent.

### 20.1 SDK Resource Synthesis Rules

The OpenAPI contract `MUST` be shaped so that the generated SDK is predictable and modular.

| OpenAPI element | SDK effect |
| --- | --- |
| `tag` | Top-level SDK namespace such as `client.auth`, `client.iam` |
| Dotted `operationId` resource segments | Nested SDK resource objects such as `client.auth.sessions` or `client.iam.organizations.members` |
| Final `operationId` action segment | Method name such as `create`, `retrieve`, `update`, `delete`, `list`, `verify`, `refresh`, `revoke` |
| Path parameters | Required method arguments in order of appearance, before body and query objects when possible |
| Request body schema | Typed `body` or domain-specific body argument |
| Query parameters | Typed `params` object or explicit scalar arguments when the SDK generator needs stronger ergonomics |
| Security scheme requirements | Client auth header injection and request preflight behavior |
| `application/problem+json` errors | Error class mapping and typed rejection behavior |
| Pagination schema | SDK list helper return types and page cursor helpers |

Rules:

- Resource segments in `operationId` `SHOULD` map to nested SDK classes or nested service namespaces.
- Action segments in `operationId` `MUST` map to verbs with stable ergonomic meaning.
- A collection resource `MUST` produce a collection SDK object; a singleton resource `MUST` produce a singleton SDK object.
- If the URL is deeper than the SDK surface should expose, the SDK may flatten only when a documented generator rule explicitly says so. The default is nested resources.
- The SDK surface `SHOULD` read like a business capability tree, not a transport layer.
- Generated SDK examples in docs and tests `MUST` use the same method shape that the contract intends for production use.

### 20.2 SDK Construction And Injection

Rules:

- SDK clients `MUST` be injectable into frontend services and runtime adapters.
- Client construction differences between SaaS, local, and test environments `MUST` be isolated in bootstrap code.
- A single app may use different app SDK and backend SDK constructors, but the service layer `MUST` hide that difference from UI components.
- All package-level facades and adapters `SHOULD` expose stable domain services such as `auth`, `iam`, `billing`, or `content` instead of exposing raw generated client internals.

Example:

```ts
const service = createIamService({
  appClient,
  backendClient,
});

await service.auth.sessions.create(body);
await service.iam.organizations.members.create(organizationId, body);
```

## 21. Frontend Integration Standard

Frontend shared modules use three layers.

| Layer | Responsibility | Forbidden |
| --- | --- | --- |
| UI | Render, forms, interaction, accessibility, local state | Raw HTTP, token parsing, tenant decisions |
| Service | Business orchestration, validation mapping, SDK client injection, cache boundary | Manual request URLs, manual auth headers |
| SDK | Generated API methods, typed DTOs, transport | App-specific UI logic |

Rules:

- Shared modules `MUST` accept SDK clients through initialization or provider composition.
- App-specific SDK constructor differences `MUST` be isolated in bootstrap code.
- Services `SHOULD` depend on interfaces that match generated SDK resource surfaces.
- UI packages `MUST` not import generated SDK internals directly when a service package exists.
- Environment switching is handled by SDK client initialization: development, test, staging, production, SaaS, private, local.

## 22. SaaS And Local Deployment Parity

Rules:

- Java SaaS and Rust local/private backends `MUST` share the same API contract for common modules.
- Differences in storage, token issuer, or process boundary `MUST NOT` change API paths or schemas.
- Local-only native features may have local APIs, but common IAM, tenant, organization, user, role, permission, session, and security APIs must remain contract-compatible.
- SDK tests `SHOULD` be run against both SaaS mock/server and local Rust implementation.

## 23. Versioning And Deprecation

Rules:

- API version is carried in the path prefix: `/app/v3/api` and `/backend/v3/api`.
- Additive fields are allowed when clients can ignore unknown fields.
- Removing fields, changing field types, changing operationId, changing security, changing path, or changing response status semantics is breaking.
- Breaking changes require a new version or explicit no-compatibility approval for pre-launch systems.
- Deprecated operations `SHOULD` include OpenAPI `deprecated: true` and `x-sdkwork-deprecation`.
- Do not introduce `/app/v1` or `/backend/v1` for new work in this repository.

## 24. Contract Validation Checklist

An API is standard only when this checklist passes:

- [ ] OpenAPI version is `3.1.2` or a documented `3.1.x` toolchain fallback.
- [ ] Domain name follows `DOMAIN_SPEC.md`.
- [ ] SDK API paths start with `/open/v3/api`, `/im/v3/api`, `/app/v3/api`, or `/backend/v3/api` according to their API surface.
- [ ] Runtime source, OpenAPI snapshots, generated SDK inputs, route tables, frontend SDK bootstrap code, and environment examples contain no forbidden legacy API prefix.
- [ ] Java app-api class-level mappings start with `/app/v3/api`, and Java backend-api class-level mappings start with `/backend/v3/api`.
- [ ] Backend-api publishes no bare `/v3/api/*` resource path.
- [ ] `apps` Java implementations, app/backend Java SDK generation inputs, and generated app/backend Java SDK path helpers pass `cd apps && node scripts/api-spec-java-standard.test.mjs`.
- [ ] Path static segments are lowercase `lower_snake_case`.
- [ ] Path parameters are `lowerCamelCase`.
- [ ] Each operation has one lowerCamelCase tag.
- [ ] Each operationId uses lowerCamelCase dotted resource style.
- [ ] No operationId contains `__`.
- [ ] Public operations explicitly set `security: []`.
- [ ] Protected app-api and backend-api operations require both `AuthToken` and `AccessToken`.
- [ ] Protected open-api operations require `ApiKey`.
- [ ] Runtime routers resolve `AppRequestContext` through the standard parser/resolver framework before protected handlers run.
- [ ] Runtime routers run the standard API call chain or a stricter documented superset.
- [ ] Backend API has no login/session creation/refresh/logout endpoint.
- [ ] Error responses include `application/problem+json`.
- [ ] `int64` and `decimal` API fields are strings.
- [ ] Request and response schemas use `additionalProperties` intentionally.
- [ ] List APIs are paginated or explicitly bounded.
- [ ] Retriable create/command APIs define idempotency behavior.
- [ ] Required permission, tenant scope, and audit metadata are documented.
- [ ] Generated SDK compiles and exposes resource-style methods.
- [ ] SDK generation uses `@sdkwork/sdk-generator` / `sdkgen` from `D:\javasource\spring-ai-plus\sdk\sdkwork-sdk-generator`, and the generation manifest records the generator package, canonical path or resolved package location, version or commit, command, input, output, language, SDK type, and standard profile.
- [ ] SDK family naming, generated package metadata, generated client behavior, auth integration, and service integration follow `SDK_SPEC.md`.
- [ ] OpenAPI authority location, derived generator inputs, application-root `sdks/` layout, and generated output placement follow `SDK_WORKSPACE_GENERATION_SPEC.md`.

## 25. References

This standard aligns with:

- OpenAPI Specification 3.1.2 stable profile: https://spec.openapis.org/oas/v3.1.2.html
- OpenAPI Specification 3.2.0 forward-looking profile: https://spec.openapis.org/oas/v3.2.0.html
- JSON Schema Draft 2020-12: https://json-schema.org/draft/2020-12
- RFC 9457 Problem Details for HTTP APIs: https://www.rfc-editor.org/rfc/rfc9457
- OWASP REST Security Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html
