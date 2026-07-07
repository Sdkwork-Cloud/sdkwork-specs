# Health Check Standard

- Version: 1.0
- Scope: infrastructure liveness, readiness, and metrics HTTP probes for every SDKWork HTTP listener, standalone/cloud gateway, platform gateway, migration-only API server, and worker with an HTTP admin surface
- Related: `WEB_FRAMEWORK_SPEC.md`, `WEB_BACKEND_SPEC.md`, `OBSERVABILITY_SPEC.md`, `NGINX_SPEC.md`, `DEPLOYMENT_SPEC.md`, `SDKWORK_DEPLOY_SPEC.md`, `SECURITY_SPEC.md`, `INTERNAL_API_SPEC.md`, `RPC_SPEC.md`

This standard defines the **infrastructure** health surface. It is not the same as SDKWork business system health APIs such as `/app/v3/api/system/health`, `/app/v3/api/system/ready`, `/backend/v3/api/system/health`, domain storage-provider health checks, or MCP server health checks.

## 1. Canonical Endpoints

| Probe | Path | Semantics | Success status | Success body |
| --- | --- | --- | --- | --- |
| Liveness | `GET /healthz` | Process is alive and serving HTTP | `200` | `{"status":"ok"}` |
| Readiness | `GET /readyz` | Required dependencies are ready to serve traffic | `200` | `{"status":"ready"}` |
| Liveness alias | `GET /livez` | Kubernetes-style alias of liveness | `200` | Same as `/healthz` |
| Metrics | `GET /metrics` | Prometheus exposition | `200` | Prometheus text |

Rules:

- Every SDKWork HTTP listener, `*-standalone-gateway`, `*-cloud-gateway`, platform gateway, migration-only `*-api-server`, and worker HTTP admin port `MUST` expose `/healthz` and `/readyz`.
- `/livez` `MAY` be mounted as an alias of `/healthz` through `sdkwork-web-bootstrap::service_router`.
- Multi-surface gateway assembly and platform collapsed ingress `MUST` mount infrastructure probes once per listener; see `APPLICATION_GATEWAY_SPEC.md` §5.7.1–§5.7.2.
- `/metrics` `MUST` be mounted through `sdkwork-web-bootstrap::service_router` or an approved framework metrics registry.
- Legacy paths `/health`, `/ready`, and bare `/live` `MUST NOT` be introduced in new work.
- Existing legacy paths `MUST` be removed during migration to this standard; do not keep parallel legacy handlers after cutover.
- Business modules `MUST NOT` introduce infrastructure-like API paths such as `/status`, `/health`, `/ready`, `/system/health`, or `/system/ready` inside their capability namespaces. Use capability-specific diagnostics under the owning domain contract when business health data is required.
- SDKWork business system health paths under `/app/v3/api/system/*` and `/backend/v3/api/system/*` are route-registry owned business API paths, not infrastructure probe aliases. They must pass `check-route-path-collisions.mjs` and must not be implemented by arbitrary feature modules.

## 2. Framework Authority

Rules:

- Rust HTTP runtimes `MUST` mount infrastructure probes through `sdkwork-web-bootstrap::service_router` or `WebFrameworkBuilder::build_router()`.
- Business repositories `MUST NOT` fork local `/healthz`, `/readyz`, `/metrics`, or `/livez` handlers when the framework bootstrap can mount them.
- Runtime-local `src/health.rs` files in gateway or migration-only `*-api-server` crates `MUST` contain only readiness assembly (`ReadinessCheck` wiring), not route definitions.
- Public-path bypass for auth and interceptor chains `MUST` use `sdkwork_web_bootstrap::infra_public_path_prefixes()` or `WebRequestContextProfile::default().public_path_prefixes`.

## 3. Readiness Extension Model

Rules:

- Readiness checks `MUST` implement `sdkwork_web_bootstrap::ReadinessCheck`.
- Multiple probes `MUST` compose through `CompositeReadinessCheck`.
- Built-in adapters:
  - `AlwaysReady`
  - `SqliteReadinessCheck`
  - `PgPoolReadinessCheck`
  - `RedisReadinessCheck`
- Domain-specific checks `MUST` be implemented as additional `ReadinessCheck` implementations in the owning repository and passed into `ServiceRouterConfig::with_readiness_check` or `with_composite_readiness`.
- Production SaaS assembly `MUST` wire an explicit readiness check; unconfigured readiness `MUST` return `503` with a configuration error, not silent success.

## 4. Security

Rules:

- Readiness failure responses `MUST NOT` expose dependency hostnames, credentials, SQL errors, stack traces, or internal topology details to clients.
- The client-safe detail string is `READINESS_DEPENDENCY_UNAVAILABLE` from `sdkwork-web-bootstrap`.
- Detailed failure context `MUST` be logged server-side only.
- Infrastructure probes `MUST` remain outside IAM dual-token auth and `MUST` be listed in `public_path_prefixes`.

## 5. Observability

Rules:

- Health status metrics `MUST` follow `OBSERVABILITY_SPEC.md`:
  - `<service>_health_status` gauge with labels `service`, `environment`, `deployment_profile`, `runtime_target`
- Readiness transitions `SHOULD` update the serving gauge.
- Gateway readiness that probes upstreams `MAY` include structured upstream check metadata in the response when the deployment policy allows internal monitoring.

## 6. Deployment Alignment

Rules:

- Nginx, Kubernetes, and `SDKWORK_DEPLOY_SPEC.md` generators `MUST` target `/healthz` and `/readyz`.
- Upstream readiness path configuration `MUST` default to `/readyz` unless a documented exception exists.
- gRPC health checking remains governed by `RPC_SPEC.md` and `RUST_RPC_SPEC.md`; it is not a substitute for HTTP `/healthz` and `/readyz`.

## 7. Out Of Scope

The following are **not** infrastructure probes and remain governed by their owning API contracts:

- Admin `*/health_check` operations
- App/backend API system health endpoints such as `/app/v3/api/system/health`
- Provider health diagnostics with business payloads
- Desktop/local proxy `/health` endpoints outside SDKWork standard HTTP services

## 8. Verification

Repositories `MUST` verify:

- `/healthz` returns `200` and `{"status":"ok"}` without authentication
- `/readyz` returns `200` when dependencies are ready and `503` when not
- `/readyz` failure bodies do not leak internal dependency details
- Route manifests and `public_path_prefixes` include infrastructure probe paths
- Gateway and migration-only API server crates do not define duplicate local `.route("/healthz")` handlers except documented gateway/upstream extensions
- `check-route-path-collisions.mjs` passes for business system health endpoints and capability diagnostics
