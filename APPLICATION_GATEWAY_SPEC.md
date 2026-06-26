# Application Gateway Standard

- Version: 1.1
- Scope: application and platform HTTP gateway roles, deployment-profile-qualified crate naming, repository layout, topology bindings, component contracts, pnpm command mapping, and verification for SDKWork gateway processes
- Related: `NAMING_SPEC.md` §4.3.1, `APP_RUNTIME_TOPOLOGY_SPEC.md`, `APP_RUNTIME_TOPOLOGY_NAMING.md` §10, `APP_RUNTIME_TOPOLOGY_ARCHETYPES.md`, `WEB_FRAMEWORK_SPEC.md`, `WEB_BACKEND_SPEC.md`, `RUST_CODE_SPEC.md`, `PNPM_SCRIPT_SPEC.md` §7, `SDKWORK_WORKSPACE_SPEC.md`, `COMPONENT_SPEC.md`, `ENVIRONMENT_SPEC.md`, `DEPLOYMENT_SPEC.md`, `MIGRATION_SPEC.md` §8, `TEST_SPEC.md`

This standard is the normative entrypoint for SDKWork gateway naming and structure. Crate naming authority for the deployment qualifiers lives in `NAMING_SPEC.md` §4.3.1; connectivity-plane and surface authority lives in `APP_RUNTIME_TOPOLOGY_NAMING.md`. If this file conflicts with a more specific gateway rule in those files, the more specific file wins and this file must be updated.

## 1. Design Principles

1. **One role, one name.** A gateway process must be identifiable from its crate name alone. Bare `sdkwork-<application-code>-gateway` and bare `sdkwork-api-cloud-gateway` (without the explicit `api-cloud-gateway` role) are retired because they hide the deployment profile and confuse application ingress with platform ingress.
2. **Deployment profile is part of identity.** `standalone` and `cloud` are not feature flags, binary aliases, or runtime toggles inside one gateway crate. They are separate crate families when distinct ingress processes exist for that profile.
3. **One symmetric formula.** Every gateway crate uses `sdkwork-<scope>-<deploymentProfile>-gateway`. Application scope is `<application-code>`; platform scope is `api`.
4. **Plane before product.** Platform connectivity uses `sdkwork-api-cloud-gateway` on `platform.api-gateway`. Application connectivity uses `sdkwork-<application-code>-standalone-gateway` or `sdkwork-<application-code>-cloud-gateway` on `application.public-ingress`.
5. **High cohesion, low coupling.** Each gateway crate owns ingress composition for one scope and one deployment profile. Route crates, domain services, repository crates, and internal capability processes remain separate crates and must not be folded into a catch-all gateway crate.
6. **Speak in full words.** Reviews, scripts, topology docs, and component manifests must say `standalone-gateway`, `cloud-gateway`, or `api-cloud-gateway`; never "the gateway" without naming scope, plane, and deployment profile.

## 2. Unified Naming Formula

```text
sdkwork-<scope>-<deploymentProfile>-gateway
```

| Scope token | Plane | Allowed `deploymentProfile` in crate name | Example |
| --- | --- | --- | --- |
| `<application-code>` | `application` | `standalone`, `cloud` | `sdkwork-drive-standalone-gateway`, `sdkwork-im-cloud-gateway` |
| `api` | `platform` | `cloud` only | `sdkwork-api-cloud-gateway` |

Rules:

- Application gateway crates `MUST` use `<application-code>` as the scope token.
- Platform gateway crates `MUST` use scope token `api` and deployment qualifier `cloud`.
- Bare `sdkwork-api-cloud-gateway` and bare `sdkwork-<application-code>-gateway` are retired.
- Standalone platform gateway crates `MUST NOT` be introduced. Standalone deployments embed an approved platform adapter inside `sdkwork-<application-code>-standalone-gateway` or consume documented standalone topology adapters instead of inventing `sdkwork-api-standalone-gateway`.

## 3. Gateway Role Taxonomy

SDKWork recognizes exactly three normative gateway roles:

| Role | Canonical crate | Connectivity plane | Primary surface | Owns |
| --- | --- | --- | --- | --- |
| Platform cloud gateway | `sdkwork-api-cloud-gateway` | `platform` | `platform.api-gateway` | Shared SDKWork platform APIs such as IAM, Drive, and Notary |
| Standalone application gateway | `sdkwork-<application-code>-standalone-gateway` | `application` | `application.public-ingress` | Self-contained application ingress for `deploymentProfile=standalone` |
| Cloud application gateway | `sdkwork-<application-code>-cloud-gateway` | `application` | `application.public-ingress` | Scale-out application ingress for `deploymentProfile=cloud` |

Rules:

- Application gateway crates `MUST` receive exactly one deployment qualifier: `standalone` or `cloud`.
- Platform gateway crates `MUST` use the `cloud` deployment qualifier in the crate name.
- Application gateway crates `MUST NOT` terminate `platform.api-gateway` unless an approved standalone embedded platform adapter is documented in topology and ADR evidence.
- Edge ingress such as `edge.device-ingress` uses edge-specific process names and `MUST NOT` reuse gateway crate naming unless that process terminates `application.public-ingress` for a declared deployment profile.

## 4. Naming Registry

### 4.1 Application Gateway Crates

```text
sdkwork-<application-code>-standalone-gateway
sdkwork-<application-code>-cloud-gateway
```

Support crates mirror the parent family:

```text
sdkwork-<application-code>-standalone-gateway-config
sdkwork-<application-code>-standalone-gateway-observability
sdkwork-<application-code>-cloud-gateway-config
sdkwork-<application-code>-cloud-gateway-observability
```

### 4.2 Platform Cloud Gateway Crates

Platform gateway crates live in the `sdkwork-api-cloud-gateway` repository:

```text
sdkwork-api-cloud-gateway
sdkwork-api-cloud-gateway-config
sdkwork-api-cloud-gateway-registry
sdkwork-api-cloud-gateway-observability
sdkwork-api-cloud-gateway-api-server
```

Binary names, systemd units, container entrypoints, and release artifact process ids `MUST` match the canonical crate name unless a documented platform packaging exception exists in `RELEASE_SPEC.md`.

Retired repository directory name: `sdkwork-api-cloud-gateway`. New work and migrations `SHOULD` use `sdkwork-api-cloud-gateway` as the repository root name.

### 4.3 Retired Names

| Retired | Replacement | Notes |
| --- | --- | --- |
| bare `sdkwork-api-cloud-gateway` crate name | `sdkwork-api-cloud-gateway` as the platform `api-cloud-gateway` role | forbid using the crate name without the `api-cloud-gateway` role and topology context |
| `sdkwork-api-cloud-gateway-*` support crates | `sdkwork-api-cloud-gateway-*` | config, registry, observability, api-server |
| `sdkwork-api-cloud-gateway` repository directory | `sdkwork-api-cloud-gateway` | platform gateway product repository |
| `sdkwork-<application-code>-gateway` | `sdkwork-<application-code>-standalone-gateway` or `sdkwork-<application-code>-cloud-gateway` | bare application gateway |
| `sdkwork-im-cloud-gateway` | `sdkwork-im-cloud-gateway` | IM cloud split ingress |
| `sdkwork-clawrouter-cloud-gateway` | `sdkwork-clawrouter-cloud-gateway` | claw-router cloud ingress |
| `sdkwork-aiot-cloud-gateway` | `sdkwork-aiot-cloud-gateway` | AIoT cloud ingress |
| `gateway:bundle:*` | `gateway:package:*` | pnpm script namespace |
| `gateway:bundle:validate:*` | `gateway:validate:*` | pnpm script namespace |

## 5. Responsibility Boundaries

### 5.1 Standalone Application Gateway

Use `sdkwork-<application-code>-standalone-gateway` when the repository ships `deploymentProfile=standalone` application ingress that:

- terminates `application.public-ingress` for local dev, desktop/private appliance, or single-container release;
- mounts application-owned route crates and/or proxies dependency or platform surfaces for that standalone profile;
- may embed an approved standalone platform adapter instead of requiring an external `sdkwork-api-cloud-gateway` process.

Typical topology: `standalone.unified-process.*` (default) or approved `standalone.split-services.*`.

### 5.2 Cloud Application Gateway

Use `sdkwork-<application-code>-cloud-gateway` when the repository ships `deploymentProfile=cloud` application ingress that:

- terminates `application.public-ingress` for cloud, scale-out, or private-cloud release;
- proxies to decomposed internal upstream services declared in `topology.spec.json`;
- consumes external `sdkwork-api-cloud-gateway` for `platform.api-gateway` unless an approved exception exists.

Typical topology: `cloud.split-services.*` (default) or approved `cloud.unified-process.*`.

### 5.3 Platform Cloud Gateway

Use `sdkwork-api-cloud-gateway` when the repository owns the shared SDKWork platform HTTP ingress that:

- terminates `platform.api-gateway`;
- serves IAM, Drive, Notary, and other approved platform HTTP surfaces;
- is consumed by cloud application gateways and cloud client bootstrap through `SDKWORK_<APPLICATION_CODE>_PLATFORM_API_GATEWAY_HTTP_URL` or equivalent topology env keys.

Platform gateway crates `MUST NOT` be renamed back to bare `sdkwork-api-cloud-gateway` for brevity.

### 5.4 API Server (Not a Gateway)

`sdkwork-<application-code>-api-server` owns an HTTP server that mounts application-owned route crates only.

Use `api-server` when the process:

- listens on HTTP;
- mounts route crates from the same application;
- does **not** compose, proxy, or fail-close dependency/platform surfaces for a deployment profile.

Use `standalone-gateway` or `cloud-gateway` when the process additionally composes, proxies, or fail-closes dependency or platform HTTP surfaces for that deployment profile.

An application repository `MAY` own both an `api-server` and one or both gateway crate families when responsibilities remain separate processes or binaries.

### 5.5 Internal Capability Gateways (Out of Scope)

Internal service names such as `session-gateway`, `session-gateway-bin`, or domain-specific edge bridges are capability or internal upstream process names. They:

- `MAY` exist under `services/` when they are not application ingress crates;
- `MUST NOT` replace application or platform gateway crate naming;
- `MUST NOT` terminate `application.public-ingress` unless documented as the declared ingress for a deployment profile in topology and component specs.

### 5.6 Single HTTP Ingress (Normative)

SDKWork HTTP APIs `MUST` expose **one client-facing HTTP bind per connectivity plane**, not a matrix of independent `*-api` / `*-service-bin` listeners started by default dev orchestration or default release profiles.

| Plane | Canonical ingress crate/binary | Client-facing surface | Integration model |
| --- | --- | --- | --- |
| Application (standalone) | `sdkwork-<application-code>-standalone-gateway` | `application.public-ingress` | Mount application route crates and approved dependency/platform adapters **in-process** on the gateway router |
| Application (cloud) | `sdkwork-<application-code>-cloud-gateway` | `application.public-ingress` | Terminate one public HTTP bind; compose or proxy to internal upstreams declared in topology without requiring extra loopback HTTP listeners in dev |
| Platform (cloud/shared) | `sdkwork-api-cloud-gateway` | `platform.api-gateway` | Integrate all approved platform `*-api` surfaces on **one** HTTP bind |

Rules:

- `standalone.unified-process.*` `MUST` start exactly **one** application-plane HTTP ingress process (`sdkwork-<application-code>-standalone-gateway` or an approved equivalent `api-server` that already mounts every declared application HTTP surface on the same bind). Dev orchestration `MUST NOT` spawn additional loopback HTTP servers for `app-api`, `backend-api`, `open-api`, or `*-service-bin` packages.
- `cloud.split-services.*` client bootstrap and dev orchestration `MUST` still present **one** `application.public-ingress` HTTP URL and **one** `platform.api-gateway` HTTP URL. Decomposed `*-service-bin` binaries are internal scaling/release artifacts; they `MUST NOT` become the default way to make APIs reachable through multiple local HTTP ports.
- Route crates (`sdkwork-routes-*`) and service libraries (`*-service`) are **composition units**. They `MAY` ship `*-service-bin` packages for cloud deployment matrices, CI smoke, or operator-managed scale-out, but those binaries `MUST NOT` replace gateway embedding for standalone dev or become mandatory multi-port dev sidecars.
- Background workers, schedulers, and non-HTTP runtimes `MAY` run as separate processes when they do not terminate additional public HTTP API surfaces.
- gRPC, internal RPC, WebSocket upgrades on the declared ingress bind, and client renderer dev servers (for example Vite) are out of scope for this HTTP ingress count; they follow `RPC_SPEC.md`, `APP_RUNTIME_TOPOLOGY_SPEC.md` §3, and frontend dev orchestration rules respectively.
- Hard-coded loopback port matrices for application-plane sidecars in dev scripts, topology env files, or contract tests are forbidden for new work and `MUST` be removed during ingress migrations.

Reference implementations:

- Standalone: `sdkwork-drive` `standalone.unified-process.*` starts `sdkwork-drive-standalone-gateway` only.
- Application cloud ingress: `sdkwork-im` `cloud.split-services.*` starts `sdkwork-im-cloud-gateway` as the sole application HTTP ingress in dev orchestration.
- Platform cloud ingress: `sdkwork-api-cloud-gateway` composes IAM, Drive, Notary, and other platform HTTP surfaces on one bind.

### 5.7 Gateway Assembly (Normative)

Application HTTP planes `MUST` compose route crates through a generated **gateway assembly** crate instead of hand-merging `sdkwork_routes_*` routers inside standalone or cloud gateway mains.

| Concept | Canonical name | Responsibility |
| --- | --- | --- |
| Gateway assembly crate | `sdkwork-<application-code>-gateway-assembly` | Discover application-owned route crates, merge `gateway_mount` routers, own application-plane bootstrap hooks, export one `assemble_application_router` entrypoint |
| Route crate mount | `gateway_mount` | Return an `axum::Router` (sync or async) for one capability/surface; may wrap legacy `build_*_public_app` exports during migration |
| Route manifest export | `gateway_route_manifest` | Re-export or feed `kind: sdkwork.route.manifest` metadata for assembly ordering and validation |
| Thin gateway crate | `sdkwork-<application-code>-standalone-gateway` / `sdkwork-<application-code>-cloud-gateway` | IAM/platform adapters, listener, observability, topology env — **not** per-route `Router::merge` matrices |

Design rules:

- **Convention over configuration.** Assembly discovery `MUST` scan the Cargo workspace for members matching `crates/sdkwork-routes-<application-code>-*`. Repositories `MUST NOT` add `application.http-plane.json`, `integrationMode`, `applicationBundle`, or other consumer-side JSON to declare assembly membership.
- **No duplicate catalogs.** When Cargo workspace membership and route manifests already identify route crates, standalone scripts `MUST NOT` maintain parallel hand-edited merge lists except during an explicitly time-boxed migration with failing validation.
- **Generated assembly artifacts are source-controlled.** `pnpm gateway:assembly:materialize` `MUST` write deterministic output under `crates/sdkwork-<application-code>-gateway-assembly/` (at minimum `Cargo.toml`, `assembly-manifest.json`, and generated dependency/manifest modules). CI and local dev `MUST` run `pnpm gateway:assembly:validate` to prove parity with workspace discovery.
- **Thin gateways.** Standalone and cloud gateway `main.rs` files `MUST` call the assembly entrypoint for application-plane routes. Direct `router.merge(sdkwork_routes_*)` or `merge(sdkwork-routes-*)` calls in gateway mains are forbidden for new work and `MUST` be removed during assembly migration.
- **Platform consumer linking.** `sdkwork-api-cloud-gateway` and sibling platform ingress repositories `MAY` link a dependency application's assembly crate by convention: `sdkwork-<domain>-app-sdk` → repository `sdkwork-<domain>` → `crates/sdkwork-<domain>-gateway-assembly`. No extra fields in `dependency.composition.json` are required.
- **Ordering.** When multiple route crates share a path prefix, assembly `MUST` order mounts using `gateway_route_manifest` `mountOrder` when present, otherwise lexicographic package name. Conflicts `MUST` fail validation instead of silently overriding handlers.
- **Transitional legacy mounts.** Until every route crate exports `gateway_mount`, assembly `MAY` keep a checked-in `src/bootstrap.rs` with application-specific service wiring. Materialize `MUST` still regenerate manifest metadata and `Cargo.toml` route-crate dependencies from workspace discovery; validation `MUST` fail when discovered route crates are missing from `assembly-manifest.json`.

Reference pilots: `sdkwork-im`, `sdkwork-drive`.

## 6. Repository Structure

Application gateway crates `MUST` live under `crates/`:

```text
<application-repo>/
  crates/
    sdkwork-<application-code>-gateway-assembly/
    sdkwork-<application-code>-standalone-gateway/
    sdkwork-<application-code>-cloud-gateway/
  specs/topology.spec.json
  configs/topology/
  scripts/gateway/
    assembly-materialize.mjs
    assembly-validate.mjs
```

Platform gateway repository layout:

```text
sdkwork-api-cloud-gateway/
  crates/
    sdkwork-api-cloud-gateway/
    sdkwork-api-cloud-gateway-config/
    sdkwork-api-cloud-gateway-registry/
    sdkwork-api-cloud-gateway-observability/
    sdkwork-api-cloud-gateway-api-server/
  specs/
  configs/
  deployments/
  scripts/
```

Rules:

- Gateway assembly crates `MUST` live under `crates/sdkwork-<application-code>-gateway-assembly/`.
- Gateway crates `SHOULD` live under `crates/` in new work. Legacy `services/` gateway binaries `MAY` remain until migrated but `MUST NOT` grow new hand-edited route merge matrices.
- Repositories that only publish `platform.api-gateway` config bundles and do not own an application gateway binary `MAY` omit application gateway crates but `MUST NOT` invent bare gateway names in scripts or docs.

## 7. Topology Binding

Gateway-related env keys `MUST` follow `APP_RUNTIME_TOPOLOGY_NAMING.md`.

| Concern | Example key |
| --- | --- |
| Platform gateway bind | `SDKWORK_API_CLOUD_GATEWAY_BIND` |
| Platform gateway config path | `SDKWORK_API_CLOUD_GATEWAY_CONFIG` |
| Application platform gateway URL | `SDKWORK_IM_PLATFORM_API_GATEWAY_HTTP_URL` |
| Application ingress bind | `SDKWORK_IM_APPLICATION_PUBLIC_INGRESS_BIND` |
| Standalone gateway config path | `SDKWORK_IM_STANDALONE_GATEWAY_CONFIG` |

Retired platform bind/config keys `SDKWORK_API_CLOUD_GATEWAY_BIND` and `SDKWORK_API_CLOUD_GATEWAY_CONFIG` `MUST` be normalized to `SDKWORK_API_CLOUD_GATEWAY_*` in new topology profiles and examples. Migration mapping lives in `MIGRATION_SPEC.md` §8.

Orchestration entries `MUST` reference canonical crate names:

```json
{
  "processId": "platform-api-cloud-gateway",
  "crate": "sdkwork-api-cloud-gateway",
  "deploymentProfile": "cloud",
  "surface": "platform.api-gateway"
}
```

## 8. Component Contract

| Field | Standalone application | Cloud application | Platform cloud |
| --- | --- | --- | --- |
| `component.type` | `rust-standalone-gateway` | `rust-cloud-gateway` | `rust-platform-cloud-gateway` |
| `component.name` | `sdkwork-<application-code>-standalone-gateway` | `sdkwork-<application-code>-cloud-gateway` | `sdkwork-api-cloud-gateway` |
| `component.domain` | primary application domain | primary application domain | `platform` |
| `component.capability` | `gateway` | `gateway` | `gateway` |
| `component.surface` | `gateway-api` | `gateway-api` | `gateway-api` |

Required `canonicalSpecs` for all gateway components include `APPLICATION_GATEWAY_SPEC.md`, `NAMING_SPEC.md`, `WEB_FRAMEWORK_SPEC.md`, `WEB_BACKEND_SPEC.md`, `RUST_CODE_SPEC.md`, `APP_RUNTIME_TOPOLOGY_SPEC.md`, `APP_RUNTIME_TOPOLOGY_NAMING.md`, `PNPM_SCRIPT_SPEC.md`, and `TEST_SPEC.md`.

## 9. pnpm Command Mapping

Application repositories:

| Command | Target crate when owned |
| --- | --- |
| `gateway:run:standalone` | `sdkwork-<application-code>-standalone-gateway` |
| `gateway:run:cloud` | `sdkwork-<application-code>-cloud-gateway` |
| `gateway:package:standalone` | standalone gateway artifact |
| `gateway:package:cloud` | cloud gateway artifact or approved platform config bundle |
| `gateway:assembly:materialize` | regenerate `sdkwork-<application-code>-gateway-assembly` from workspace discovery |
| `gateway:assembly:validate` | verify assembly manifest parity and forbid thin-gateway route merges |

Platform gateway repository (`sdkwork-api-cloud-gateway`):

| Command | Target |
| --- | --- |
| `gateway:package:standalone` | standalone-packaged platform gateway server artifact when the repository publishes one |
| `gateway:validate:standalone` | standalone platform gateway validation |
| `gateway:matrix` | release matrix for platform gateway packages |

Rules:

- Platform gateway repository scripts `MUST NOT` target bare `sdkwork-api-cloud-gateway`.
- Config-bundle-only application repositories `MAY` expose `gateway:package:cloud` without a local application gateway binary.

## 10. Reference Matrix

| Application / product | Standalone gateway | Cloud gateway | Platform dependency |
| --- | --- | --- | --- |
| `drive` | `sdkwork-drive-standalone-gateway` | optional | `sdkwork-api-cloud-gateway` |
| `im` | `sdkwork-im-standalone-gateway` | `sdkwork-im-cloud-gateway` | `sdkwork-api-cloud-gateway` |
| `clawrouter` | optional | `sdkwork-clawrouter-cloud-gateway` | `sdkwork-api-cloud-gateway` |
| `aiot` | optional | `sdkwork-aiot-cloud-gateway` | `sdkwork-api-cloud-gateway` |
| platform | n/a | n/a | `sdkwork-api-cloud-gateway` |

## 11. Migration Rules

Rules:

- Unreleased applications and the platform gateway repository `MUST` delete bare `sdkwork-api-cloud-gateway` crate and repository aliases rather than preserve them in application code.
- Rename migrations `MUST` update Cargo workspace members, topology orchestration, env keys, pnpm scripts, component specs, release manifests, dependency paths, and docs in one change set when possible.
- Dependency paths such as `../sdkwork-api-cloud-gateway/crates/sdkwork-api-cloud-gateway` `MUST` migrate to `../sdkwork-api-cloud-gateway/crates/sdkwork-api-cloud-gateway`.
- Mapping authority: `MIGRATION_SPEC.md` §8 and `APP_RUNTIME_TOPOLOGY_NAMING.md` §10.
- Repositories with hand-edited gateway route merges `MUST` introduce `sdkwork-<application-code>-gateway-assembly`, move bootstrap logic there, and delete direct `sdkwork_routes_*` merges from gateway mains in the same migration when feasible.
- Route crates `MUST` gain `gateway_mount` and `gateway_route_manifest` exports per `WEB_BACKEND_SPEC.md` §4.2.1 as they are touched; assembly materialize `MUST` prefer `gateway_mount` when present.

## 12. Verification

Repositories with gateway crates `MUST`:

- pass `node tools/check-identity-naming.mjs --mode consumer --root .` without bare `sdkwork-api-cloud-gateway` or bare application gateway crate hits;
- declare gateway crates under `crates/` in workspace manifests;
- expose profile-qualified `gateway:*` scripts when gateway release or run workflows exist;
- include bootstrap smoke proving framework-mounted routes or proxy/composition routes on the declared gateway crate.

Standards verification:

```bash
node tools/check-identity-naming.mjs --root .
node tools/check-single-http-ingress.mjs --root .
node tools/validate-gateway-assembly.mjs --root .
```

Workspace verification:

```bash
node tools/audit-single-http-ingress-workspace.mjs --workspace ..
```

## 13. Acceptance Checklist

- [ ] All gateway crates follow `sdkwork-<scope>-<deploymentProfile>-gateway`.
- [ ] Platform gateway uses `sdkwork-api-cloud-gateway`, not bare `sdkwork-api-cloud-gateway`.
- [ ] Application gateway crates use `standalone` or `cloud` deployment qualifiers.
- [ ] Gateway crates live under `crates/` with local `specs/component.spec.json`.
- [ ] `api-server` and gateway responsibilities are not conflated.
- [ ] Topology, env keys, orchestration, and dependency paths reference canonical crate and repository names.
- [ ] Retired bare gateway names and `gateway:bundle:*` scripts are removed or migration-documented.
- [ ] Standalone and cloud dev orchestration expose one HTTP bind per plane through gateway crates, not multiple `*-api` / `*-service-bin` listeners.
- [ ] `node tools/check-single-http-ingress.mjs --root .` passes for repositories with topology specs or dev orchestration scripts.
- [ ] `sdkwork-<application-code>-gateway-assembly` exists when the repository owns `sdkwork-routes-<application-code>-*` workspace members.
- [ ] `pnpm gateway:assembly:validate` passes; gateway mains do not hand-merge route crates.
