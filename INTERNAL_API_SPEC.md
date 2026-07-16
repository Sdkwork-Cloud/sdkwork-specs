# Internal API Standard

- Version: 1.0
- Scope: application-internal HTTP API surface, authority naming, ingress placement, auth, SDK generation, and relationship to Internal RPC
- Related: `API_SPEC.md`, `SDK_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md`, `RPC_SPEC.md`, `WEB_FRAMEWORK_SPEC.md`, `APP_RUNTIME_TOPOLOGY_SPEC.md`, `SECURITY_SPEC.md`, `OBSERVABILITY_SPEC.md`, `COMPONENT_SPEC.md`

Internal API is the fourth canonical SDKWork HTTP surface. It is **not** Open API, App API, or Backend API. It is also **not** RPC: gRPC internal services remain governed by `RPC_SPEC.md` (`internal.v3`).

## 1. Purpose

Internal API exposes operator-trusted, application-local runtime and control-plane HTTP capabilities to:

- first-party UI shells bound to the same application ingress (`application.public-ingress`)
- automation running inside the application trust boundary
- embedded admin or kernel consoles that are not platform-wide backend-admin surfaces

Internal API `MUST NOT` be published on `platform.api-gateway` and `MUST NOT` use dual-token IAM (`Auth-Token` + `Access-Token`) as its primary auth model.

## 2. Surface Identity

| Field | Value |
| --- | --- |
| Contract label | `internal-api` |
| Runtime camelCase label | `internalApi` |
| Locked prefix | `/internal/v3/api` |
| Authority suffix | `internal-api` |
| Authority name | `sdkwork-<domain>-internal-api` |
| SDK family directory | `sdks/sdkwork-<domain>-internal-sdk/` |
| Generated package (TypeScript) | `@sdkwork/<domain>-internal-sdk` |
| Route crate suffix | `internal-api` |

Rules:

- Internal API versions `MUST` stay locked at `/internal/v3/api`.
- Domain segments after the prefix follow `DOMAIN_SPEC.md`, for example `/internal/v3/api/intelligence/runtime/*` for agent runtime kernel UI contracts.
- Internal API `MUST NOT` mount under `/app/v3/api`, `/backend/v3/api`, or approved open-api domain prefixes.
- Internal API `MUST NOT` expose IAM login, register, refresh, logout, verification-code, or other user-session bootstrap endpoints. Those remain app-api only.

## 3. Ingress And Topology

Rules:

- Internal API `MUST` mount on `application.public-ingress` for the owning application.
- Internal API `MUST NOT` be exposed through `platform.api-gateway` unless an explicit, reviewed compatibility exception documents gateway mediation and ingress-token forwarding.
- Topology manifests `MUST` keep business APIs (`/app/v3/api`, `/backend/v3/api`, `/agent/v3/api`) on `platform.api-gateway` and internal runtime APIs on `application.public-ingress`.
- Health probes (`/healthz`, `/readyz`, `/livez`, `/metrics`) remain outside internal-api OpenAPI unless explicitly documented as operational endpoints.

## 4. Auth And Request Context

Rules:

- Protected internal-api operations `MUST` declare `x-sdkwork-api-surface: internal-api` and `x-sdkwork-request-context: WebRequestContext`.
- Default internal-api auth mode is ingress token validation on the application host.
- OpenAPI `MUST` declare `x-sdkwork-auth-mode: ingress-token` for protected internal-api operations unless a documented anonymous health or bootstrap operation is explicitly public.
- Generated `custom` internal SDKs use `components.securitySchemes.ApiKey` with header `X-API-Key` under `sdkwork-v3`; runtime hosts `MUST` accept that header as an ingress-token alias alongside `Authorization: Bearer` and `x-sdkwork-access-token`.
- Internal-api `MUST NOT` require app-api dual-token headers for its baseline protected operations.
- Session ownership and caller identity projection for runtime routes `MAY` use application-local headers such as `x-sdkwork-tenant-id` and `x-sdkwork-user-id` when documented by the owning runtime spec.

## 5. Authority, OpenAPI, And SDK Generation

Rules:

- Authoritative OpenAPI for an application-owned internal surface `MUST` live under `<application-root>/apis/internal-api/<domain>/` and be mirrored into `<application-root>/sdks/sdkwork-<domain>-internal-sdk/openapi/`.
- Authority file name `MUST` be `sdkwork-<domain>-internal-api.openapi.yaml`.
- Derived generator input `MUST` be `sdkwork-<domain>-internal-api.sdkgen.yaml`.
- SDK generation `MUST` follow `SDK_SPEC.md` with `--standard-profile sdkwork-v3` when the generator profile supports the internal prefix; otherwise the SDK family `MUST` document the supported generator mode in family-root `sdk-manifest.json`. Multi-family generation discovers family manifests directly and must not add a parallel registry.
- Generated internal SDK output `MUST` live under `sdkwork-<domain>-internal-sdk-<language>/generated/server-openapi/`.
- Internal SDK families `MUST` declare `sdkOwner`, `apiAuthority`, `sdkSurface: internal`, and owner-only operation metadata identical to other HTTP SDK families.
- Consumers `MUST` integrate through the generated SDK or an approved composed facade; raw HTTP in UI modules is forbidden by `API_SPEC.md`.

## 6. Rust Route Crates

Rules:

- Rust HTTP route crates for internal-api `MUST` be named `sdkwork-routes-<capability>-internal-api`.
- Internal route crates `MAY` mount only `/internal/v3/api` paths.
- Internal route crates `MUST` feed or mirror the internal-api OpenAPI authority; they are implementation inputs, not SDK family names.

## 7. Legacy Compatibility

Rules:

- Historical application-local prefixes such as `/api/kernel/*`, `/api/sessions/*`, and `/api/chat/*` are **retired** in `sdkwork-kernel`; they `MUST NOT` be mounted on new releases.
- Components that have completed internal-api migration `MUST NOT` keep dual mounts or legacy aliases; unmounted retired prefixes return `404 Not Found`.
- New consumers `MUST` target `/internal/v3/api/...` and generated `@sdkwork/<domain>-internal-sdk` clients.
- Retired prefixes `MUST` be recorded in the owning component HTTP surface spec with the removal decision and verification tests that prove they are not mounted.

## 8. Observability

Rules:

- HTTP metrics and structured logs for internal-api `MUST` label `api_surface=internal-api`.
- This label is distinct from RPC `rpc-internal` (`internal.v3`).

## 9. Verification

Required evidence for internal-api changes:

- OpenAPI authority and derived `*.sdkgen.yaml` present under the internal SDK family
- `node scripts/check-agent-sdk-workspace.mjs` or the application-local equivalent passes for the internal family
- Route mount tests prove canonical internal paths and that documented retired prefixes are not mounted
- Topology docs still place the surface on `application.public-ingress`
