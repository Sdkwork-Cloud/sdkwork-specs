# SDKWork IAM Credential Entry Integration Standard

- Version: 1.2
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

OpenAPI operations backed by `HttpRoute::credential_entry_bootstrap` (or the migration alias `credential_entry_public`) `MUST` declare:

```yaml
x-sdkwork-auth-mode: credential-entry-bootstrap
x-sdkwork-forbid-credential-headers: true
security:
  - AccessToken: []
```

SDK transport rules:

- Generated TypeScript clients `MUST` call transport with `credentialEntryBootstrap: true`.
- Transport `MUST` inject bootstrap `Access-Token` from TokenManager.
- Transport `MUST NOT` inject `Authorization`, API keys, or SDKWork context projection headers.
- The credential-entry wrapper `MUST` fail before network dispatch when no bootstrap access token is available. It `MUST NOT` clear session credentials and then send an unauthenticated request that can only fail as server `40101`.
- Pure anonymous operations (`deviceAuthorizations.retrieve`, `deviceAuthorizations.scans.create`, IAM runtime policy reads) remain `x-sdkwork-auth-mode: anonymous` with `skipAuth: true`.

Gateway rules:

- `credential_entry_public` is a migration helper name only. New route contracts use first-class `RouteAuth::CredentialEntryBootstrap`; the helper must construct that profile and must not encode it as `Public + flag`.
- Credential-entry routes `MUST` require bootstrap `Access-Token` JWT for tenant isolation.
- The Web Framework credential-contamination guard `MUST` reject `Authorization`, refresh, API-key, OAuth, ingress/agent, and client-projected context credentials before handlers run. Handlers do not parse or reject headers themselves.

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
- Production browser clients obtain only a short-lived bootstrap JWT through an approved IAM/application bootstrap exchange or trusted native host channel. The exchange derives app/tenant/audience from server-owned deployment binding, never client tenant selectors; applies origin policy, rate limits, `Cache-Control: no-store`, short expiry, and credential-entry-only purpose; and returns no user session credential.
- A production browser credential-entry runtime `MUST` fail bootstrap before rendering an actionable login form when neither an approved short-lived exchange nor a trusted host channel is configured.

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

- The repository-level `sdkwork-app` lifecycle facade `MUST` run the canonical IAM development bootstrap provider before spawning any renderer that consumes credential-entry operations. Application-local orchestration helpers are forbidden after migration.
- The lifecycle facade `MUST` pass the resolved renderer bind/port and bootstrap env to the same child process plan; package scripts `MUST NOT` override the topology-selected port with a hard-coded value.
- Standalone IAM PC packages `MUST` route `dev` through `run-pc-renderer-dev-with-bootstrap.mjs` unless a repository-local orchestrator already merges bootstrap env.
- BirdCoder and other apps with public-runtime env denylists `MUST` inject bootstrap credentials through approved private dev channels only.
- A configured token is preserved in every lifecycle. Shared helpers generate only for development or explicitly isolated tests and fail closed when a required staging/production private token is absent.
- Login, registration completion, refresh, and current-session bootstrap `MUST` replace bootstrap credentials through the global TokenManager. Feature code must not retain or reapply the bootstrap value.

## 6. Acceptance Checklist

- [ ] Credential-entry route manifests, OpenAPI, SDK metadata, generated call options, and runtime `RouteAuth` all use `credential-entry-bootstrap`, not anonymous.
- [ ] OpenAPI requires only `AccessToken`; SDK transport injects only bootstrap `Access-Token` and fails before dispatch when it is absent.
- [ ] Host apps consume `@sdkwork/iam-credential-entry`; no duplicated local wrappers remain.
- [ ] Host app Vite configs consume `@sdkwork/iam-credential-entry/vite`; no local serializer or `process.env.SDKWORK_ACCESS_TOKEN` define remains.
- [ ] `sdkwork-app` invokes the canonical IAM dev bootstrap provider before renderer spawn; no application-local token generation/helper fork remains.
- [ ] `device_authorizations.create` sends bootstrap `Access-Token` without session or context-header leakage, and every negative credential vector stops before handler execution.
- [ ] Development/test lifecycle gates and production browser bootstrap exchange/host channels fail closed under the exact environment policy.
- [ ] Renderer port/bind, injected bootstrap, browser access endpoint, and CORS authority come from the same resolved runtime plan.
