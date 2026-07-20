# API Assembly Standard

- Version: 1.0
- Scope: application-owned HTTP API composition, host-neutral assembly crates, route-surface completeness, gateway dependency direction, manifests, pnpm commands, migration, and verification
- Related: `APPLICATION_GATEWAY_SPEC.md`, `APPLICATION_SPEC.md`, `APP_COMPOSITION_SPEC.md`, `APP_PERMISSION_COMPOSITION_SPEC.md`, `COMPOSABLE_ARCHITECTURE_SPEC.md`, `COMPONENT_SPEC.md`, `NAMING_SPEC.md`, `WEB_FRAMEWORK_SPEC.md`, `WEB_BACKEND_SPEC.md`, `APP_RUNTIME_TOPOLOGY_SPEC.md`, `PNPM_SCRIPT_SPEC.md`, `MIGRATION_SPEC.md`, `TEST_SPEC.md`

This standard is the normative authority for assembling SDKWork HTTP APIs into
runtime hosts. `APPLICATION_GATEWAY_SPEC.md` owns gateway processes and
listeners; this file owns the API capability graph mounted by those hosts.

## 1. Core Model

Every SDKWork application root owns exactly one application API assembly:

```text
sdkwork-api-<application-code>-assembly
```

The assembly is a host-neutral library. It collects every application-owned
`app-api`, `backend-api`, and `open-api` route surface and exports one typed API
composition contract. The same assembly is consumed by:

- `sdkwork-api-<application-code>-standalone-gateway` for standalone runtime;
- `sdkwork-api-cloud-gateway` for platform cloud runtime.

Build and runtime dependency direction is fixed; arrows mean "depends on":

```text
gateway host -> api-assembly -> route -> service/repository graph
```

Rules:

- Application roots `MUST NOT` depend on, build, start, configure, package, or
  publish `sdkwork-api-cloud-gateway`.
- `sdkwork-api-cloud-gateway` `MAY` consume application API assemblies from the
  platform gateway repository or its governed workspace composition.
- API assemblies `MUST NOT` depend on application standalone or platform cloud
  gateway crates.
- Route crates `MUST NOT` depend on gateway hosts.
- Gateway hosts `MUST NOT` bypass assemblies by mounting application-owned
  route crates directly.
- An application that intentionally exposes no HTTP APIs `MUST` still publish
  an empty assembly manifest with `apiMode: none`; absence of the assembly is
  not a valid no-API declaration.
- Process infrastructure endpoints are not application API surfaces. A gRPC,
  RPC, worker, or service host `MAY` expose only the canonical `/healthz`,
  `/readyz`, and `/metrics` operations endpoints through
  `sdkwork-web-bootstrap` without changing `apiMode: none`. This exception does
  not authorize business handlers, arbitrary probe aliases, dynamic route
  paths, or app/backend/open API routes in that host. The first
  non-infrastructure HTTP route requires a canonical route crate and
  `apiMode: served`.

## 2. Naming And Placement

Canonical Rust package and crate placement:

```text
crates/sdkwork-api-<application-code>-assembly/
  Cargo.toml
  assembly-manifest.json
  specs/component.spec.json
  src/lib.rs
```

Canonical identities:

| Role | Identity |
| --- | --- |
| API assembly package | `sdkwork-api-<application-code>-assembly` |
| Rust library | `sdkwork_api_<application_code>_assembly` |
| Component type | `rust-api-assembly` |
| Manifest kind | `sdkwork.api.assembly` |
| Pnpm namespace | `api:assembly:*` |

The selected application root directory is the application-code authority for
API assembly naming and `MUST` be `sdkwork-<application-code>`. An enclosing
repository may have a different identity, but `app.key`, `backend.appId`,
product name, process name, and repository stem `MUST NOT` silently rename the
assembly. Tools fail closed when the selected application root is not
canonical; move/select the canonical application root before bootstrapping.

Retired identities:

- `sdkwork-<application-code>-gateway-assembly`;
- `sdkwork.gateway.assembly`;
- `gateway:assembly:*`;
- application-owned `sdkwork-<application-code>-cloud-gateway`.

Retired identities may appear only in migration records, compatibility-window
input handling, and negative test fixtures. New or materialized source `MUST`
use the canonical API assembly identity.

## 3. Ownership And Completeness

The application API assembly owns the complete set of application-authored
HTTP route crates, regardless of capability token. Discovery authority order:

1. route `specs/component.spec.json` identity and ownership;
2. route manifest surface and authority metadata;
3. Cargo workspace/package metadata as a consistency check;
4. package-name inference only as migration diagnostics.

Rules:

- Every application-owned route crate `MUST` be included exactly once.
- Every included route crate `MUST` declare exactly one of `app-api`,
  `backend-api`, or `open-api`.
- Every served route crate `gateway_mount` `MUST` return an executable
  `axum::Router`, either directly or through `Result<Router, E>`. Route
  manifests, descriptor collections, OpenAPI metadata, and an empty
  `Router::new()` are inventory contributions, not executable mounts, and
  `MUST NOT` use the `gateway_mount` name or satisfy `apiMode: served`.
- Route ownership `MUST NOT` be inferred solely from an
  `sdkwork-routes-<application-code>-*` package prefix; aggregate application
  repositories may own capability-named route crates.
- Dependency-owned routes remain in the dependency application's assembly.
  Applications and gateways compose dependency assemblies; they do not copy
  dependency route crates into the consuming application's assembly.
- Normalized `(surface, method, path)` identities `MUST` be unique inside an
  assembly and across every set of assemblies mounted by one gateway.
- Permission, request-context, OpenAPI authority, and response-envelope rules
  remain identical in standalone and cloud hosts.

## 4. Assembly Contract

An API assembly exports host-neutral composition contributions:

- application business router;
- route manifest inventory;
- OpenAPI document contributions;
- permission catalog contributions;
- bootstrap dependency requirements;
- readiness contributions without public probe-path ownership.

The canonical Rust entrypoint is:

```rust
pub async fn assemble_api_router(
    context: ApiAssemblyContext,
) -> Result<ApiAssembly, ApiAssemblyError>;
```

An assembly `MAY` additionally export `assemble_api_business_router` for a
multi-assembly host that mounts process infrastructure once. Exported types
`MUST` be host-neutral and `MUST NOT` contain listener bind addresses,
standalone/cloud selection, process supervision, TLS termination, or gateway
repository paths.

The assembly owns application service/repository wiring needed to construct
its APIs. Gateways own listener lifecycle, process-wide Web Framework
infrastructure, observability, shutdown, and topology materialization.

## 5. Assembly Manifest

`assembly-manifest.json` is source-controlled deterministic materialized
output. Minimum shape:

```json
{
  "kind": "sdkwork.api.assembly",
  "schemaVersion": 1,
  "applicationCode": "birdcoder",
  "apiMode": "served",
  "packageName": "sdkwork-api-birdcoder-assembly",
  "crateDir": "crates/sdkwork-api-birdcoder-assembly",
  "routeCrates": []
}
```

Rules:

- `apiMode` is `served` or `none`.
- `served` requires at least one route contribution unless an approved staged
  migration record explains the temporary empty state.
- `none` requires an empty route inventory and `component.spec.json` evidence.
- `generatedAt` or other wall-clock values `MUST NOT` make materialization
  nondeterministic.
- Route entries include package identity, component reference, surface,
  normalized path prefix, mount order, route-manifest reference, and source
  reference.
- `componentRef`, `routeManifestRef`, and `sourceRef` are normalized,
  application-root-relative paths. They `MUST` resolve inside the selected
  application root, `MUST NOT` contain `.` or `..` traversal segments, and
  every referenced file `MUST` exist. A route component declaration beginning
  with `sdks/_route-manifests/` is application-root-relative; other relative
  route-manifest declarations are component-root-relative.
- Materialization `MUST` preserve authored bootstrap code and regenerate only
  declared generated regions or files.

## 6. Gateway Consumption

### 6.1 Standalone

`sdkwork-api-<application-code>-standalone-gateway` consumes the corresponding
application assembly and any explicitly selected dependency assemblies. It is
the only application-plane HTTP listener started by `pnpm dev`.

The standalone gateway `MUST NOT` depend on route, service, repository, or
database implementation crates already owned by an assembly. All such
dependencies enter through assemblies.

### 6.2 Cloud

Only the `sdkwork-api-cloud-gateway` repository owns the platform cloud gateway
process. It selects and consumes approved application assemblies, validates
cross-assembly route collisions, and mounts process infrastructure once.

Application repositories may publish assembly source or artifacts for platform
composition, but they `MUST NOT` declare the cloud gateway as a Cargo, pnpm,
topology, source-config, build, test, or release dependency.

## 7. Pnpm Commands

Application roots that use pnpm expose:

```text
pnpm api:assembly:materialize
pnpm api:assembly:validate
```

Rules:

- Materialization writes only `sdkwork-api-<application-code>-assembly`
  deterministic source and manifest output.
- Validation is read-only.
- Each pnpm command directly invokes its matching canonical tool under
  `sdkwork-specs/tools/` with `--root .`. Application-owned dispatchers,
  `scripts/gateway/assembly-*` wrappers, shell wrappers, and substitute or
  swapped tools are forbidden. The canonical bootstrap computes the required
  workspace-relative command path.
- `pnpm dev` and `pnpm dev:standalone` validate or build the assembly before
  starting the standalone gateway.
- `pnpm dev:cloud` starts no local assembly host, gateway, API listener,
  database, migration, seed, or deployed-service worker.
- Gateway and route changes `MUST` run `api:assembly:validate` in CI.

### 7.1 Canonical Fast Integration

Run these commands from the application root. The one-time bootstrap is the
only canonical assembly onboarding command:

```text
node ../sdkwork-specs/tools/bootstrap-api-assembly-repo.mjs --root .
```

It deterministically:

1. materializes `sdkwork-api-<application-code>-assembly`, including
   `apiMode: none` when the application owns no HTTP routes;
2. adds the assembly to Cargo workspace members when a Cargo workspace exists;
3. makes `api:assembly:materialize` and `api:assembly:validate` delegate
   directly to the canonical `sdkwork-specs` tools;
4. runs read-only assembly validation before reporting success.

It `MUST NOT` create `scripts/gateway/assembly-*` wrappers, create or rename a
standalone gateway, register an assembly in the platform cloud gateway, or
delete migration files. Re-running it is idempotent. Route-owning applications
must fix missing component ownership contracts before bootstrap can pass.

Application hosting reaches distinct readiness states:

| State | Owner | Required evidence |
| --- | --- | --- |
| Contract ready | Route/component owner | Every route crate has `specs/component.spec.json` and route manifest authority |
| Assembly ready | Application repository | Bootstrap succeeds and `pnpm api:assembly:validate` passes |
| Standalone host ready | Application repository | Canonical standalone gateway depends only on approved assemblies and strict readiness audit passes |
| Local development ready | Application repository | `pnpm dev` delegates to `dev:standalone`, one application ingress starts, topology check passes |
| Cloud composition ready | Platform gateway owner | Platform repository selects the published assembly and cross-assembly collision checks pass |

For a canonical new application template, the standalone gateway already
exists. For a governed migration with an existing host, the application owner
may run this one-time wiring aid and must inspect its diff:

```text
node ../sdkwork-specs/tools/wire-api-assembly-host.mjs --root .
```

The wiring aid is not completion evidence. The read-only completion gate is:

```text
pnpm api:assembly:validate
node ../sdkwork-specs/tools/audit-gateway-alignment-repo.mjs --root . --strict
node ../sdkwork-specs/tools/check-application-cloud-gateway-boundary.mjs --root .
node ../sdkwork-specs/tools/check-topology-deployment-profiles.mjs --root .
```

Application teams hand off the assembly crate and deterministic manifest to
the platform owner. They do not hand off or maintain platform cloud gateway
config. Platform registration is a separate platform-owned change and is not
required for local assembly or standalone-host readiness.

## 8. Forbidden Application Cloud Integration

Application-root validation `MUST` fail when active files contain any of:

- a Cargo, package, or workspace dependency on `sdkwork-api-cloud-gateway`;
- a script that resolves, builds, runs, supervises, or packages the platform
  cloud gateway;
- application-owned `sdkwork-api-cloud-gateway.*.toml` source config;
- topology components or processes whose crate, binary, repository, or owner
  is `sdkwork-api-cloud-gateway`;
- application release assets or deployment packages for the platform cloud
  gateway;
- direct route merging in a gateway host.

Client runtime configuration may point to deployed API URLs. It `MUST` use
surface-oriented URL keys and `MUST NOT` require knowledge of the remote
gateway implementation identity.

## 9. Migration

Migration follows `MIGRATION_SPEC.md` and the active API assembly migration
record. The required sequence is:

1. materialize the canonical API assembly;
2. prove route-surface completeness and collision freedom;
3. point the standalone gateway only at assemblies;
4. remove duplicate gateway-host dependencies and direct route merges;
5. remove application cloud-gateway configs, scripts, topology ownership, and
   release assets;
6. register the assembly from the cloud gateway side;
7. remove retired names after both standalone and cloud composition tests pass.

Rollback restores validator audit mode or the previous application release;
it `MUST NOT` restore application ownership or autostart of
`sdkwork-api-cloud-gateway`.

## 10. Verification

Required application checks:

```text
node ../sdkwork-specs/tools/validate-api-assembly.mjs --root .
node ../sdkwork-specs/tools/check-application-cloud-gateway-boundary.mjs --root .
node ../sdkwork-specs/tools/check-single-http-ingress.mjs --root .
node ../sdkwork-specs/tools/check-route-path-collisions.mjs --root .
```

Required workspace checks:

```text
node ../sdkwork-specs/tools/audit-api-assembly-workspace.mjs --workspace ..
node ../sdkwork-specs/tools/check-application-cloud-gateway-boundary.mjs --workspace ..
```

## 11. Acceptance Checklist

- [ ] Exactly one canonical API assembly exists per application root.
- [ ] All application-owned app/backend/open route crates are included once.
- [ ] Standalone and cloud hosts consume the same assembly contract.
- [ ] Application roots do not depend on or operate the platform cloud gateway.
- [ ] Standalone gateway hosts depend on assemblies, not assembly-owned crates.
- [ ] `pnpm dev` delegates to standalone and starts one application HTTP ingress.
- [ ] `pnpm dev:cloud` is remote-client-only.
- [ ] Route, OpenAPI, permission, readiness, and collision checks pass.
