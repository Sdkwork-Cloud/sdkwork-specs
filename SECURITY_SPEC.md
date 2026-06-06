# Security Standard

- Version: 1.0
- Scope: authentication, authorization, token use, API/RPC security, frontend handling, logging, secrets
- Related: `SDKWORK_WORKSPACE_SPEC.md`, `API_SPEC.md`, `WEB_BACKEND_SPEC.md`, `RPC_SPEC.md`, `DRIVE_SPEC.md`, `IAM_SPEC.md`, `IAM_LOGIN_INTEGRATION_SPEC.md`, `OBSERVABILITY_SPEC.md`, `TEST_SPEC.md`

Security is a cross-cutting requirement. It must be enforced by backend services and reflected in OpenAPI contracts, SDK behavior, frontend service boundaries, and tests.

## 1. Authentication And Tokens

Rules:

- Protected HTTP APIs `MUST` use the authentication mode declared by their API surface. Protected app-api and backend-api operations require both `AuthToken` and `AccessToken`; protected open-api operations require API key mode unless an explicitly documented compatibility contract defines a different scheme.
- Protected RPC methods `MUST` require the equivalent `authorization` and `access-token` metadata unless the method is explicitly public or internal mTLS-only.
- Product app login/session integration, AuthGate behavior, generated SDK token wiring, logout clearing, and Rust AppContext validation `MUST` follow `IAM_LOGIN_INTEGRATION_SPEC.md`.
- Public endpoints `MUST` explicitly declare `security: []`.
- Tokens `MUST` be signed or resolved through a trusted server-side session store.
- Token expiry, revocation, rotation, and audience checks are mandatory for production.
- Tokens and secrets `MUST NOT` be logged.
- Protected open-api requests `MUST` resolve API keys through a server-side API key lookup service. The API key record, not the raw submitted key alone, supplies tenant, organization, user, app, data scope, and permission scope.
- API key lookup implementations `MUST` support different storage backends through an interface or service boundary. The standard may use IAM tables, tenant-local API key tables, encrypted secret stores, caches, or remote IAM services.
- Web backend handlers, controller methods, services, repositories, and provider adapters `MUST` follow `WEB_BACKEND_SPEC.md`: they consume typed request context and must not reparse raw credential headers after framework context resolution.

## 2. Authorization

Rules:

- Server-side authorization `MUST` be enforced for every protected operation.
- Permission checks `MUST` include tenant and organization context.
- Object-level authorization `MUST` be checked before returning or mutating tenant data.
- Admin/backend APIs `MUST` use least privilege and audit sensitive operations.
- Service/use-case code `MUST` enforce business authorization before repository access returns tenant-owned data. Router middleware and UI permission hints are not sufficient.
- Repositories `MUST` receive tenant, organization, owner, and data-scope inputs from typed context or explicit service parameters; they `MUST NOT` infer authorization from global request state.

## 3. Input And Output Safety

Rules:

- OpenAPI schemas `MUST` declare required fields, lengths, enum values, and formats.
- Server validation `MUST` reject unknown dangerous inputs and invalid state transitions.
- Responses `MUST` exclude password hashes, token secrets, private keys, internal hostnames, SQL, stack traces, and internal implementation details.
- File upload APIs `MUST` be Drive-backed for SDKWork-owned storage and define size, type, scanning, retention, checksum, grant expiry, and access rules through `DRIVE_SPEC.md`.

## 4. Browser And Frontend Safety

Rules:

- Frontend modules `MUST NOT` manually assemble auth headers except in SDK/bootstrap infrastructure.
- Appbase IAM auth UI/runtime and generated app SDK bootstrap own browser login/session token flow; product UI must not duplicate it.
- Sensitive tokens `SHOULD` be stored in secure host storage where available.
- CORS `MUST` be explicit and environment-specific.
- CSRF protection is required for cookie-authenticated browser flows.
- UI permission checks do not replace backend authorization.

## 5. Abuse Protection

Rules:

- Login, verification, password reset, token refresh, and sensitive commands `MUST` be rate limited.
- Idempotency and replay protection `SHOULD` be applied to payment-like or retriable commands.
- Security events `MUST` be emitted for login failures, suspicious token use, permission changes, key creation, key revocation, and tenant changes.

## 5.1 Appbase API Security Interceptor Baseline

All appbase HTTP frameworks `MUST` provide the following interceptor positions in the standard request chain.

| Interceptor | Purpose | Baseline requirement |
| --- | --- | --- |
| Request identity | Generate server-owned request id. | Must overwrite client `X-Request-Id`. |
| Surface classification | Classify `open-api`, `app-api`, `backend-api`, or public path. | Must run before auth mode selection. |
| CORS | Enforce origin allowlist. | Must be explicit and environment-specific. |
| Method guard | Reject unsupported HTTP methods. | Should run before body parsing. |
| Cross-site request guard | Reject untrusted state-changing browser requests. | Required for browser-facing APIs. |
| SQL injection request guard | Block obvious injection probes in path/query/configured headers. | Defense-in-depth only; never replaces bind parameters. |
| Request size limit | Reject oversized requests before business logic. | Required for JSON APIs and stricter for upload/session endpoints. |
| Rate limit | Throttle abuse-sensitive operations. | Required for auth, key, verification, and mutation hot paths. |
| Idempotency | Enforce retry safety for commands. | Required for payment-like, purchase-like, and retryable mutation commands. |
| Request context resolution | Resolve `AppRequestContext`. | Required before protected handlers. |
| Authentication | Verify required credential mode is present and valid. | Required for protected surfaces. |
| Authorization | Enforce permission and policy decisions. | Required for every protected operation. |
| Tenant isolation | Enforce tenant, organization, owner, and data-scope boundaries. | Required before data access. |
| Context injection | Inject typed context for handlers/services. | Required; handlers must not reparse credentials. |
| Logging | Emit structured, redacted operational logs. | Must not log raw tokens, API keys, passwords, or payload secrets. |
| Audit | Emit business/security audit facts. | Required for IAM, key, tenant, billing, permission, and admin changes. |
| Header security | Apply secure response headers. | Must include `nosniff`, frame protection, referrer policy, and permissions policy where supported. |
| Response identity | Return server-owned request id. | Required for success and problem responses where possible. |

Rules:

- Security interceptors `MUST` be framework-owned or registered in the standard call chain. Business handlers `MUST NOT` implement ad hoc replacements for shared security policy.
- Business handlers and services `MUST NOT` parse `Authorization`, `Access-Token`, `X-API-Key`, request IDs, tenant IDs, organization IDs, user IDs, or permission scopes from raw headers. They consume the typed context injected by this chain.
- SQL injection guards are heuristic request filters. All database access `MUST` still use bind parameters or query builders that bind values, and raw SQL string concatenation with user input is forbidden.
- CORS and cross-site request protection are separate controls. Passing CORS does not replace authorization, CSRF protection for cookie flows, or tenant isolation.
- Rate-limit and idempotency implementations must use bounded keys that do not expose raw tokens, API keys, passwords, or PII.

## 6. Secure Logging

Rules:

- Logs `MUST` include correlation IDs and tenant context where safe.
- Logs `MUST NOT` contain secrets, passwords, raw tokens, verification codes, or full private payloads.
- Audit logs `MUST` be append-oriented and tamper-resistant for L3 domains.

## 6.1 Repository Workspace Safety

The source-controlled repository/application `.sdkwork/` workspace is governed by
`SDKWORK_WORKSPACE_SPEC.md` and is reviewed as source.

Rules:

- `.sdkwork/skills/`, `.sdkwork/plugins/`, approved manifests, and their README files may be
  committed when they contain reusable development knowledge only.
- `.sdkwork/local/`, `.sdkwork/tmp/`, `.sdkwork/cache/`, `.sdkwork/secrets/`, local install state,
  runtime databases, logs, generated transient outputs, and secret-bearing files `MUST` be ignored.
- `.sdkwork/` `MUST NOT` contain API keys, auth tokens, passwords, private certificates, private
  keys, provider credentials, local user data, runtime database files, generated SDK transport
  output, or copied `~/.sdkwork/<app>` runtime state.
- Generated SDK output `.sdkwork/sdkwork-generator-*.json` files are valid only below generated SDK
  output and are not repository workspace secrets or skills.

## 7. Acceptance Checklist

- [ ] OpenAPI security declarations are explicit.
- [ ] RPC metadata auth declarations are explicit for every service method.
- [ ] Dual-token validation is enforced server-side.
- [ ] API key open-api validation resolves a server-side API key record before context injection.
- [ ] Protected appbase routers run the standard interceptor chain or a stricter documented superset.
- [ ] Web backend handlers/services consume typed request context and do not reparse raw credential, tenant, user, permission, or request-id headers.
- [ ] Tenant/object authorization is tested.
- [ ] Drive upload/download grants are short-lived, authorized, and do not leak provider credentials or signed URL material into logs.
- [ ] Sensitive fields are write-only or omitted.
- [ ] Rate limits exist for auth-sensitive paths.
- [ ] CORS, cross-site request protection, request size, method guard, SQL injection guard, secure response headers, audit, and logging are configured through framework interceptors.
- [ ] Logs redact sensitive data.
- [ ] Source-controlled `.sdkwork/` contains no secrets, runtime data, generated SDK transport output, or user-private files.
