# SDKWork IAM Credential Entry Integration Standard

- Version: 1.1
- Scope: login, registration, password reset, OAuth session creation, QR/device authorization bootstrap transport, manifest identity, lifecycle-aware bootstrap env, and Vite development handoff
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
- Vite renderers `MUST` use `@sdkwork/iam-credential-entry/vite`. Source-linked multi-repository workspaces `MAY` resolve that declared package dependency to its canonical `sdkwork-iam-credential-entry/src/vite.ts` source entry while package links are unavailable; applications `MUST NOT` copy its HTML serialization, canonical global assignment, or lifecycle gating.
- Node dev/test orchestrators `MUST` use `sdkwork-iam/scripts/dev/create-dev-bootstrap-access-token-env.mjs`; applications `MUST NOT` copy JWT fixture generation, manifest lookup, or env merge helpers.
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
- Development Vite serve processes `MAY` inject a private bootstrap token only through `createSdkworkCredentialEntryBootstrapVitePlugin`, which assigns `globalThis.__SDKWORK_CREDENTIAL_ENTRY_BOOTSTRAP_ACCESS_TOKEN__` before application modules execute.
- Vite `define` replacement for `process.env.SDKWORK_ACCESS_TOKEN` is not a valid credential-entry handoff. Vite 6 client dev transforms do not guarantee that ordinary define replacement reaches linked source packages.
- Test Vite serve processes `MAY` inject only when the isolated test runner explicitly sets both token-generation and plugin-injection opt-ins.
- Staging and production renderers `MUST NOT` inject bootstrap tokens into HTML, JavaScript bundles, `/runtime-env.js`, or equivalent browser artifacts.

## 5. Lifecycle Bootstrap

Application repositories `MUST` resolve bootstrap access tokens through the shared IAM workflow. They `MUST NOT` fork signing, fixture JWT, manifest identity, private env-file parsing, or HTML injection logic per application.

| Environment | Missing `SDKWORK_ACCESS_TOKEN` | Browser/Vite behavior |
| --- | --- | --- |
| `development` | Shared helper may generate a disposable local bootstrap JWT from application manifest identity. | Serve-only shared plugin may inject the canonical global handoff. |
| `test` | Generation is allowed only with `allowTestTokenGeneration: true` in an isolated test runner. | Injection is allowed only with `allowTestInjection: true`; production bundles must not contain it. |
| `staging` | Startup fails closed. A private secret source must provide the token for approved server/service contexts. | Never inject or embed the token in browser artifacts. |
| `production` | Startup fails closed. A secret manager, mounted secret, protected host env, or equivalent private source must provide the token for approved server/service contexts. | Never inject or embed the token in browser artifacts. |

Canonical helpers:

- `sdkwork-iam/scripts/dev/create-dev-bootstrap-access-token-env.mjs`
  - `mergeRepoBootstrapAccessTokenEnv`
  - `mergeRepoDevBootstrapAccessTokenEnv`
  - `resolveRepoApplicationManifestPath`
- `@sdkwork/iam-credential-entry/node-bootstrap`
  - `readBootstrapAccessTokenEnvFile`
- `@sdkwork/iam-credential-entry/vite`
  - `createSdkworkCredentialEntryBootstrapVitePlugin`
- `sdkwork-iam/scripts/dev/run-pc-renderer-dev-with-bootstrap.mjs`
  - standalone PC package `dev` scripts that invoke Vite directly
- topology dev orchestrators such as `*-dev.mjs` that spawn renderers after backend health checks

Rules:

- Topology orchestrators `MUST` merge bootstrap env before spawning renderer processes.
- Standalone IAM PC packages `MUST` route `dev` through `run-pc-renderer-dev-with-bootstrap.mjs` unless a repository-local orchestrator already merges bootstrap env.
- BirdCoder and other apps with public-runtime env denylists `MUST` inject bootstrap credentials through approved private dev channels only.
- A configured token is preserved in every lifecycle. Shared helpers generate only for development or explicitly isolated tests and fail closed when a required staging/production private token is absent.
- Login, registration completion, refresh, and current-session bootstrap `MUST` replace bootstrap credentials through the global TokenManager. Feature code must not retain or reapply the bootstrap value.

## 6. Acceptance Checklist

- [x] Credential-entry OpenAPI operations use `credential-entry-bootstrap`, not anonymous.
- [x] IAM app SDK transport injects bootstrap `Access-Token` for credential-entry operations.
- [x] Host apps consume `@sdkwork/iam-credential-entry`; no duplicated local wrappers remain.
- [x] Host app Vite configs consume `@sdkwork/iam-credential-entry/vite`; no local serializer or `process.env.SDKWORK_ACCESS_TOKEN` define remains.
- [x] Dev/test orchestrators consume the canonical IAM Node helper; no local fixture JWT or manifest/env helper fork remains.
- [x] `device_authorizations.create` transport sends bootstrap `Access-Token` without session header leakage.
- [x] Production and production-like profiles still fail closed without valid bootstrap JWT.
