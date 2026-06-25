# SDKWork IAM Credential Entry Integration Standard

- Version: 1.0
- Scope: login, registration, password reset, OAuth session creation, QR/device authorization bootstrap transport, manifest identity, and dev bootstrap env
- Related: `IAM_SPEC.md`, `IAM_APPLICATION_BOOTSTRAP_SPEC.md`, `IAM_LOGIN_INTEGRATION_SPEC.md`, `API_SPEC.md`, `SDK_SPEC.md`, `WEB_FRAMEWORK_SPEC.md`, `ENVIRONMENT_SPEC.md`

## 1. Purpose

IAM owns credential-entry business handlers and SDK contracts. Host applications must not duplicate bootstrap token injection, client wrapping, or manifest identity mapping in local commons packages.

## 2. Canonical Runtime Package

```text
@sdkwork/iam-credential-entry
```

Rules:

- Host applications `MUST` use this package for `wrapCredentialEntryClient`, `prepareCredentialEntryTokens`, and manifest identity helpers.
- Application repos `MUST NOT` copy credential-entry wrapper logic into local `*-commons` packages.
- The package `MUST` remain transport-only; IAM session persistence stays in `@sdkwork/iam-runtime`.

## 3. Auth Mode: `credential-entry-bootstrap`

OpenAPI operations backed by `HttpRoute::credential_entry_public` `MUST` declare:

```yaml
x-sdkwork-auth-mode: credential-entry-bootstrap
x-sdkwork-forbid-credential-headers: true
security: []
```

SDK transport rules:

- Generated TypeScript clients `MUST` call transport with `credentialEntryBootstrap: true`.
- Transport `MUST` inject bootstrap `Access-Token` from TokenManager.
- Transport `MUST NOT` inject `Authorization`, API keys, or SDKWork context projection headers.
- Pure anonymous operations (`deviceAuthorizations.retrieve`, `deviceAuthorizations.scans.create`, IAM runtime policy reads) remain `x-sdkwork-auth-mode: anonymous` with `skipAuth: true`.

Gateway rules:

- `credential_entry_public` routes `MUST` require bootstrap `Access-Token` JWT for tenant isolation.
- Handlers `MUST` reject inbound user credential headers per `WEB_FRAMEWORK_SPEC.md`.

## 4. Configuration Layering

Effective credential-entry identity resolves in this order:

1. Platform defaults from SDKWork specs
2. `sdkwork.app.config.json` (`app.key`, `backend.tenantId`, `backend.organizationId`, permission scope)
3. Optional module/composition overrides documented in local `specs/`
4. Environment profile secrets and generated bootstrap artifacts

Rules:

- `SDKWORK_ACCESS_TOKEN` is a generated private bootstrap artifact, not hand-authored identity.
- Browser runtimes `MUST NOT` expose bootstrap tokens through `VITE_*` or `PORTAL_PUBLIC_*`.
- Development profiles `MAY` inject bootstrap tokens through private env and Vite development define only.

## 5. Dev Bootstrap

Application repositories `SHOULD` generate bootstrap access tokens from manifest + signing secret through the shared dev env prepare workflow. They `MUST NOT` fork signing logic per application when `@sdkwork/iam-application-bootstrap` and workspace dev env helpers are available.

Canonical helpers:

- `sdkwork-iam/scripts/dev/create-dev-bootstrap-access-token-env.mjs`
  - `mergeRepoDevBootstrapAccessTokenEnv`
  - `resolveRepoApplicationManifestPath`
- `sdkwork-iam/scripts/dev/run-pc-renderer-dev-with-bootstrap.mjs`
  - standalone PC package `dev` scripts that invoke Vite directly
- topology dev orchestrators such as `*-dev.mjs` that spawn renderers after backend health checks

Rules:

- Topology orchestrators `MUST` merge bootstrap env before spawning renderer processes.
- Standalone IAM PC packages `MUST` route `dev` through `run-pc-renderer-dev-with-bootstrap.mjs` unless a repository-local orchestrator already merges bootstrap env.
- BirdCoder and other apps with public-runtime env denylists `MUST` inject bootstrap credentials through approved private dev channels only.

## 6. Acceptance Checklist

- [x] Credential-entry OpenAPI operations use `credential-entry-bootstrap`, not anonymous.
- [x] IAM app SDK transport injects bootstrap `Access-Token` for credential-entry operations.
- [x] Host apps consume `@sdkwork/iam-credential-entry`; no duplicated local wrappers remain.
- [x] `device_authorizations.create` transport sends bootstrap `Access-Token` without session header leakage.
- [x] Production and production-like profiles still fail closed without valid bootstrap JWT.
