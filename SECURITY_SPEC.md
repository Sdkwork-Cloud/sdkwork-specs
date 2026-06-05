# Security Standard

- Version: 1.0
- Scope: authentication, authorization, token use, API/RPC security, frontend handling, logging, secrets
- Related: `API_SPEC.md`, `RPC_SPEC.md`, `DRIVE_SPEC.md`, `IAM_SPEC.md`, `IAM_LOGIN_INTEGRATION_SPEC.md`, `OBSERVABILITY_SPEC.md`, `TEST_SPEC.md`

Security is a cross-cutting requirement. It must be enforced by backend services and reflected in OpenAPI contracts, SDK behavior, frontend service boundaries, and tests.

## 1. Authentication And Tokens

Rules:

- Protected HTTP APIs `MUST` require both `AuthToken` and `AccessToken`.
- Protected RPC methods `MUST` require the equivalent `authorization` and `access-token` metadata unless the method is explicitly public or internal mTLS-only.
- Product app login/session integration, AuthGate behavior, generated SDK token wiring, logout clearing, and Rust AppContext validation `MUST` follow `IAM_LOGIN_INTEGRATION_SPEC.md`.
- Public endpoints `MUST` explicitly declare `security: []`.
- Tokens `MUST` be signed or resolved through a trusted server-side session store.
- Token expiry, revocation, rotation, and audience checks are mandatory for production.
- Tokens and secrets `MUST NOT` be logged.

## 2. Authorization

Rules:

- Server-side authorization `MUST` be enforced for every protected operation.
- Permission checks `MUST` include tenant and organization context.
- Object-level authorization `MUST` be checked before returning or mutating tenant data.
- Admin/backend APIs `MUST` use least privilege and audit sensitive operations.

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

## 6. Secure Logging

Rules:

- Logs `MUST` include correlation IDs and tenant context where safe.
- Logs `MUST NOT` contain secrets, passwords, raw tokens, verification codes, or full private payloads.
- Audit logs `MUST` be append-oriented and tamper-resistant for L3 domains.

## 7. Acceptance Checklist

- [ ] OpenAPI security declarations are explicit.
- [ ] RPC metadata auth declarations are explicit for every service method.
- [ ] Dual-token validation is enforced server-side.
- [ ] Tenant/object authorization is tested.
- [ ] Drive upload/download grants are short-lived, authorized, and do not leak provider credentials or signed URL material into logs.
- [ ] Sensitive fields are write-only or omitted.
- [ ] Rate limits exist for auth-sensitive paths.
- [ ] Logs redact sensitive data.
