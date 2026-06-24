# Application Gateway Standard

- Version: 1.1
- Scope: application and platform HTTP gateway roles, deployment-profile-qualified crate naming, repository layout, topology bindings, component contracts, pnpm command mapping, and verification for SDKWork gateway processes
- Related: `NAMING_SPEC.md` §4.3.1, `APP_RUNTIME_TOPOLOGY_SPEC.md`, `APP_RUNTIME_TOPOLOGY_NAMING.md` §10, `APP_RUNTIME_TOPOLOGY_ARCHETYPES.md`, `WEB_FRAMEWORK_SPEC.md`, `WEB_BACKEND_SPEC.md`, `RUST_CODE_SPEC.md`, `PNPM_SCRIPT_SPEC.md` §7, `SDKWORK_WORKSPACE_SPEC.md`, `COMPONENT_SPEC.md`, `ENVIRONMENT_SPEC.md`, `DEPLOYMENT_SPEC.md`, `MIGRATION_SPEC.md` §8, `TEST_SPEC.md`

This standard is the normative entrypoint for SDKWork gateway naming and structure. Crate naming authority for the deployment qualifiers lives in `NAMING_SPEC.md` §4.3.1; connectivity-plane and surface authority lives in `APP_RUNTIME_TOPOLOGY_NAMING.md`. If this file conflicts with a more specific gateway rule in those files, the more specific file wins and this file must be updated.

## 1. Design Principles

1. **One role, one name.** A gateway process must be identifiable from its crate name alone. Bare `sdkwork-<application-code>-gateway` and bare `sdkwork-api-cloud-gateway` are retired because they hide the deployment profile and confuse application ingress with platform ingress.
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
| `sdkwork-api-cloud-gateway` | `sdkwork-api-cloud-gateway` | bare platform gateway |
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

## 6. Repository Structure

Application gateway crates `MUST` live under `crates/`:

```text
<application-repo>/
  crates/
    sdkwork-<application-code>-standalone-gateway/
    sdkwork-<application-code>-cloud-gateway/
  specs/topology.spec.json
  configs/topology/
  scripts/gateway-*.mjs
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

- Gateway crates `MUST NOT` be placed under `services/`, `packages/`, or other ad hoc process directories in new work.
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

## 12. Verification

Repositories with gateway crates `MUST`:

- pass `node tools/check-identity-naming.mjs --mode consumer --root .` without bare `sdkwork-api-cloud-gateway` or bare application gateway crate hits;
- declare gateway crates under `crates/` in workspace manifests;
- expose profile-qualified `gateway:*` scripts when gateway release or run workflows exist;
- include bootstrap smoke proving framework-mounted routes or proxy/composition routes on the declared gateway crate.

Standards verification:

```bash
node tools/check-identity-naming.mjs --root .
```

## 13. Acceptance Checklist

- [ ] All gateway crates follow `sdkwork-<scope>-<deploymentProfile>-gateway`.
- [ ] Platform gateway uses `sdkwork-api-cloud-gateway`, not bare `sdkwork-api-cloud-gateway`.
- [ ] Application gateway crates use `standalone` or `cloud` deployment qualifiers.
- [ ] Gateway crates live under `crates/` with local `specs/component.spec.json`.
- [ ] `api-server` and gateway responsibilities are not conflated.
- [ ] Topology, env keys, orchestration, and dependency paths reference canonical crate and repository names.
- [ ] Retired bare gateway names and `gateway:bundle:*` scripts are removed or migration-documented.
