# Application Gateway Standard

- Version: 2.1
- Scope: application standalone and platform cloud HTTP gateway hosts, listener ownership, naming, topology binding, thin-host boundaries, pnpm commands, migration, and verification
- Related: `API_ASSEMBLY_SPEC.md`, `NAMING_SPEC.md` section 4.3.1, `APP_RUNTIME_TOPOLOGY_SPEC.md`, `APP_RUNTIME_TOPOLOGY_NAMING.md`, `WEB_FRAMEWORK_SPEC.md`, `WEB_BACKEND_SPEC.md`, `COMPONENT_SPEC.md`, `PNPM_SCRIPT_SPEC.md`, `MIGRATION_SPEC.md`, `TEST_SPEC.md`

This standard owns HTTP gateway processes and listener behavior. API route,
service, repository, permission, and OpenAPI composition belongs to
`API_ASSEMBLY_SPEC.md`.

## 1. Gateway Roles

SDKWork defines exactly two generic HTTP gateway roles:

| Role | Canonical crate | Owner | Deployment profile | Surface |
| --- | --- | --- | --- | --- |
| Application standalone gateway | `sdkwork-api-<application-code>-standalone-gateway` | Application repository | `standalone` | `application.public-ingress` |
| Platform cloud gateway | `sdkwork-api-cloud-gateway` | Platform gateway repository | `cloud` | Deployed application and platform HTTP ingress |

Rules:

- Application-level generic HTTP cloud gateways are retired.
- `sdkwork-api-cloud-gateway` is not an application component, dependency,
  local development sidecar, config bundle, or release artifact.
- Device or edge protocol ingress uses
  `sdkwork-<application-code>-<edge-capability>-edge-runtime`, declares topology
  role `edge-runtime`, and requires an ADR. It `MUST NOT` use the retired generic
  `sdkwork-<application-code>-cloud-gateway` identity, mount application HTTP API
  surfaces, or use gateway command namespaces.
- Bare `sdkwork-<application-code>-gateway` and `*-api-server` listener roles
  are retired.

## 2. Host And Capability Separation

Gateways are thin runtime hosts. Every application API capability reaches a
gateway through `sdkwork-api-<application-code>-assembly`.

```text
sdkwork-api-<application-code>-standalone-gateway --+
                                                     +-> sdkwork-api-<application-code>-assembly
sdkwork-api-cloud-gateway --------------------------+
```

Arrows mean "depends on". The two hosts are siblings; neither gateway depends
on or starts the other.

Gateway hosts own listener lifecycle, process-wide Web Framework
infrastructure, observability, topology materialization, assembly selection,
and cross-assembly collision validation. They do not own application route
aggregation, API bootstrap dependencies, OpenAPI authority, permission
catalogs, or SDK generation.

### 2.1 Vocabulary Discipline

These terms are not interchangeable:

| Term | Meaning | Valid consumer reference |
| --- | --- | --- |
| API surface | Client-visible URL contract and endpoint provenance | `application.public-ingress` or `platform.api-gateway` |
| API assembly | Host-neutral application API capability library | `sdkwork-api-<application-code>-assembly` |
| Application standalone gateway | Application-owned standalone HTTP process | `sdkwork-api-<application-code>-standalone-gateway` |
| Platform cloud gateway | Platform-owned cloud HTTP process | `sdkwork-api-cloud-gateway` |
| Gateway host | A statement that intentionally applies to both canonical process roles | No client/runtime-config identity |

Active standards, manifests, and application documentation `MUST NOT` use
bare phrases such as "the gateway", "shared gateway", or "SDKWork API
gateway" when one exact role or surface is intended. Application config and
composition output name API surfaces and URL provenance, never a remote
gateway implementation. `integration.foundationApiGateway` is retired; its
facts belong to topology surfaces, `sdkDependencies`, and
`dependencyApiSurfaces`.

## 3. Standalone Application Gateway

Every application root has one canonical standalone host:

```text
crates/sdkwork-api-<application-code>-standalone-gateway/
```

It terminates `application.public-ingress` for `standalone.*`, consumes the
application API assembly and explicitly selected dependency assemblies, starts
as the sole application HTTP listener for `pnpm dev`, and mounts process
infrastructure exactly once.

It `MUST NOT` depend on, resolve, or start `sdkwork-api-cloud-gateway`; depend
directly on application route crates; duplicate assembly-owned implementation
dependencies; or start per-surface HTTP sidecars.

## 4. Platform Cloud Gateway

`sdkwork-api-cloud-gateway` is owned only by the platform gateway repository.
It consumes approved API assemblies from the platform side and exposes their
HTTP capabilities in deployed cloud topology.

Application repositories publish assembly contracts; they do not configure
the platform host. Assembly registration, selection, rollout, routing, and
cloud host config live in the platform gateway or platform deployment
authority. Cross-assembly route collisions are validated before bind and
process infrastructure is mounted once.

## 5. Single HTTP Ingress

Standalone application development and deployment allows exactly one
application-plane HTTP listener:

```text
sdkwork-api-<application-code>-standalone-gateway
```

`app-api`, `backend-api`, and `open-api` are route surfaces, not listener
processes. Route crates and service-host packages may remain build/test units,
but default standalone orchestration `MUST NOT` start them as HTTP sidecars.
An assembly may count a route surface as served only when its mount contributes
an executable `axum::Router`; route manifests and descriptors never establish
runtime HTTP capability by themselves.

An RPC, gRPC, worker, or service host that has no application HTTP API may own
an operations-only listener for canonical `/healthz`, `/readyz`, and `/metrics`
endpoints when its topology declares that operations surface. Such a listener
is not `application.public-ingress`, does not make the application assembly
`served`, and must be composed through `sdkwork-web-bootstrap`. It must not
mount business routes or become a second application-plane HTTP ingress.

Cloud development is remote-client-only. `cloud.development` starts no local
standalone gateway, platform gateway, API listener, data service, migration,
seed, or deployed-service worker.

## 6. Repository Layout

Application repository:

```text
crates/
  sdkwork-api-<application-code>-assembly/
  sdkwork-api-<application-code>-standalone-gateway/
  sdkwork-routes-<capability>-app-api/
  sdkwork-routes-<capability>-backend-api/
  sdkwork-routes-<capability>-open-api/
```

Platform gateway repository:

```text
crates/
  sdkwork-api-cloud-gateway/
  sdkwork-api-cloud-gateway-config/
  sdkwork-api-cloud-gateway-registry/
  sdkwork-api-cloud-gateway-observability/
```

Application repositories `MUST NOT` contain the platform gateway crate,
platform gateway TOML files, or platform gateway packaging assets.

## 7. Component Contracts

| Component | Type | Required dependency |
| --- | --- | --- |
| API assembly | `rust-api-assembly` | Application-owned route/service/repository graph |
| Standalone gateway | `rust-api-standalone-gateway` | `sdkwork-api-<application-code>-assembly` |
| Platform cloud gateway | `rust-platform-cloud-gateway` | Approved API assembly set or upstream registry |

## 8. Pnpm Commands

Application roots expose `api:assembly:materialize`,
`api:assembly:validate`, and only `gateway:*:standalone` commands. The
standalone commands target `sdkwork-api-<application-code>-standalone-gateway`.

The canonical onboarding and readiness sequence is defined by
`API_ASSEMBLY_SPEC.md` section 7.1. Assembly bootstrap does not imply standalone
host readiness; `audit-gateway-alignment-repo.mjs --root . --strict` is the
host completion gate.

Only the `sdkwork-api-cloud-gateway` repository exposes
`gateway:run:cloud`, `gateway:build:cloud`, `gateway:package:cloud`, and
`gateway:validate:cloud`.

## 9. Topology Binding

Application topology declares its standalone gateway and surface-oriented
remote URLs. It does not declare a cloud gateway crate, binary, repository,
owner, bind variable, config path, or autostart flag.

Canonical roles are `api-standalone-gateway` in an application topology and
`platform-cloud-gateway` in the platform gateway topology. Application client
config points to deployed API URLs without identifying the cloud gateway
implementation.

## 10. Migration

| Retired | Replacement |
| --- | --- |
| `sdkwork-<application-code>-gateway-assembly` | `sdkwork-api-<application-code>-assembly` |
| `sdkwork-<application-code>-standalone-gateway` | `sdkwork-api-<application-code>-standalone-gateway` |
| `sdkwork-<application-code>-cloud-gateway` | Platform-hosted assembly or responsibility-specific edge ingress |
| `sdkwork-<application-code>-api-server` | `sdkwork-api-<application-code>-standalone-gateway` |
| `gateway:assembly:*` | `api:assembly:*` |

Migration must materialize and validate the API assembly before removing the
old host. Rollback may return validation to audit mode but must not restore
application ownership or autostart of `sdkwork-api-cloud-gateway`.

## 11. Verification

Run application checks from the selected application root:

```text
node ../sdkwork-specs/tools/validate-api-assembly.mjs --root .
node ../sdkwork-specs/tools/check-application-cloud-gateway-boundary.mjs --root .
node ../sdkwork-specs/tools/check-single-http-ingress.mjs --root .
node ../sdkwork-specs/tools/scan-duplicate-gateway-api-deps.mjs --root .
node ../sdkwork-specs/tools/check-route-path-collisions.mjs --root .
```

## 12. Acceptance Checklist

- [ ] Application HTTP APIs enter hosts only through API assemblies.
- [ ] Application standalone gateway uses the canonical `sdkwork-api-*` name.
- [ ] Applications do not depend on, start, configure, or package cloud gateway.
- [ ] Platform cloud gateway consumes assemblies from the platform side.
- [ ] Gateway hosts are thin and mount process infrastructure once.
- [ ] Standalone has one application HTTP listener.
- [ ] Cloud development starts no local API-plane process.
