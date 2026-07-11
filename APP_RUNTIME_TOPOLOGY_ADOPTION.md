# Application Runtime Topology Adoption Guide

- Version: 4.0
- Scope: how every SDKWork application adopts the shared deployment/topology framework
- Related: `APP_RUNTIME_TOPOLOGY_SPEC.md`, `APP_RUNTIME_TOPOLOGY_NAMING.md`, `APP_RUNTIME_TOPOLOGY_ARCHETYPES.md`, `APPLICATION_GATEWAY_SPEC.md`, `DEPLOYMENT_SPEC.md`, `../sdkwork-app-topology/README.md`

This guide is the single adoption path. Application repositories must not invent
parallel deployment vocabulary, duplicate profile loaders, or expose internal
process layout as an application integration mode.

## 1. Shared Stack

| Layer | Owner | Application responsibility |
| --- | --- | --- |
| Platform specs | `sdkwork-specs/APP_RUNTIME_TOPOLOGY_*` | Declare deployment profile, archetype, surfaces, and two-segment profile ids |
| Framework library | `@sdkwork/app-topology` | Load profiles, resolve surface URLs, IAM DB helpers, health waits |
| Thin adapter | `scripts/lib/<application-code>-topology.mjs` | Pin spec path, export app defaults |
| Dev orchestrator | `scripts/<application-code>-dev.mjs` | Spawn processes, health-gate clients |
| Profile env | `configs/topology/*.env` | Authoritative binds and public URLs |

Forbidden:

- hand-rolled profile parsing.
- inline port literals in feature packages.
- duplicate env key naming.
- deployment ownership labels or internal process-layout terms as topology
  profile id segments.
- additional client-visible HTTP URLs for application APIs when a gateway already
  terminates the same plane.

## 2. Required Files Per Application

```text
specs/topology.spec.json              # schemaVersion 4
configs/topology/<profile-id>.env     # one file per active profile
scripts/lib/<application-code>-topology.mjs        # adapter over @sdkwork/app-topology
scripts/<application-code>-dev.mjs                 # topology-aware dev entry
docs/topology-standard.md             # human summary for the team
package.json                          # "@sdkwork/app-topology": "file:../sdkwork-app-topology"
```

Validate:

```bash
node ../sdkwork-app-topology/scripts/sdkwork-topology.mjs validate --root . --spec specs/topology.spec.json
```

## 3. Pick An Archetype

| Application | Archetype | Default dev profile | Default production profile |
| --- | --- | --- | --- |
| `sdkwork-drive` | `application-http-gateway` | `standalone.development` | `standalone.production` or `cloud.production` |
| `sdkwork-im` | `realtime-application-platform` | `standalone.development` or `cloud.development` | `cloud.production` |
| `sdkwork-aiot` | `application-rest-edge-device` | `standalone.development` | `cloud.production` |

Rules:

- Every app must declare whether it supports `standalone`, `cloud`, or both.
- New application templates should include at least one `standalone` profile and
  one `cloud` profile unless the app is explicitly client-only.
- Realtime or edge apps may run multiple internal workers or upstream services,
  but the public application profile remains `standalone.*` or `cloud.*`.

## 4. Declare Surfaces In Spec

Minimum surface block pattern:

```json
"application.public-ingress": {
  "connectivityPlane": "application",
  "bindEnv": "SDKWORK_<APPLICATION_CODE>_APPLICATION_PUBLIC_INGRESS_BIND",
  "httpUrlEnv": "SDKWORK_<APPLICATION_CODE>_APPLICATION_PUBLIC_HTTP_URL",
  "clientHttpEnv": "VITE_SDKWORK_<APPLICATION_CODE>_APPLICATION_PUBLIC_HTTP_URL"
},
"platform.api-gateway": {
  "connectivityPlane": "platform",
  "httpUrlEnv": "SDKWORK_<APPLICATION_CODE>_PLATFORM_API_GATEWAY_HTTP_URL",
  "clientHttpEnv": "VITE_SDKWORK_<APPLICATION_CODE>_PLATFORM_API_GATEWAY_HTTP_URL",
  "autostartEnv": "SDKWORK_<APPLICATION_CODE>_PLATFORM_API_GATEWAY_AUTOSTART"
}
```

Realtime apps add `websocketUrlEnv` on `application.public-ingress`.

## 5. Adapter Pattern

```javascript
import { createTopologyRuntime, loadTopologySpec } from '@sdkwork/app-topology';

const spec = loadTopologySpec(path.join(REPO_ROOT, 'specs/topology.spec.json'));
const runtime = createTopologyRuntime(spec, REPO_ROOT);

export const loadProfile = runtime.loadProfile;
export const resolveSurfaceHttpUrl = runtime.resolveSurfaceHttpUrl.bind(runtime);
export const resolveDeploymentProfile = runtime.resolveDeploymentProfile.bind(runtime);
```

Rules:

- The adapter must not duplicate profile id parsing.
- The adapter must reject unknown deployment profiles before process startup.
- The adapter must expose only normalized v4 values to application code.

## 6. Dev Orchestrator Pattern

1. Parse `--deployment-profile` and `--environment`, or use a fixed default profile id.
2. Load `configs/topology/<profile-id>.env` from the adapter.
3. Merge `process.env`, profile env, and optional database env.
4. Set `SDKWORK_<APPLICATION_CODE>_DEPLOYMENT_PROFILE` to `standalone` or `cloud`.
5. Set `SDKWORK_<APPLICATION_CODE>_RUNTIME_TARGET` to `server`, `container`, `desktop`, `browser`, or `test-runner`.
6. Health-check required surfaces before starting Vite, Tauri, backend, workers, or clients.
7. Inject client env keys from profile; never hardcode `127.0.0.1:*` in orchestrator except as profile defaults in checked-in topology env examples.

CLI naming follows `PNPM_SCRIPT_SPEC.md`:

```bash
pnpm dev                                      # default standalone development profile
pnpm dev:browser:postgres:standalone
pnpm dev:browser:postgres:cloud
pnpm dev:desktop
pnpm verify:smoke
```

Product-prefixed public commands such as `drive:dev` and `im:dev` are retired.

## 7. Client Runtime

- Read `VITE_*_<PLANE>_*` surface keys from profile env.
- Browser public runtime config may expose `deploymentProfile`, `runtimeTarget`,
  and public SDK base URLs only.
- IAM/appbase SDKs must use `platform.api-gateway` URL unless standalone embeds
  an approved platform adapter.
- Product app/open SDKs use `application.public-ingress`.
- Generated SDKs must not accept `tenant_id` or `tenantId` for current tenant
  context; request context is derived from credentials and server-side
  `WebRequestContext`.

## 8. CI And Packaging

- Package profile slugs include `standalone` or `cloud`.
- Matrix planners pass `SDKWORK_DEPLOYMENT_PROFILE` to every lifecycle step.
- Standalone package targets include archive, service, desktop, and
  single-container variants when supported.
- Cloud package targets include container image, chart/manifest/config bundle,
  or provider deployment bundle variants.

Examples:

```bash
node scripts/print-package-matrix.mjs --deployment-profile standalone
node scripts/print-package-matrix.mjs --deployment-profile cloud
```

## 9. Reference Implementations

| Repo | Required status |
| --- | --- |
| `sdkwork-drive` | v4 topology spec, standalone and cloud profiles |
| `sdkwork-im` | v4 topology spec, realtime standalone smoke and cloud profiles |
| `sdkwork-aiot` | v4 topology spec, edge surfaces and cloud profiles |
| `sdkwork-app-topology` | v4 schema/runtime, profile loader, surface resolvers, health helpers |

## 10. Retirement Checklist

When migrating an application, delete and do not alias:

- old topology env files whose profile id is not `<deploymentProfile>.<environment>`.
- `SDKWORK_*_TOPOLOGY`, `VITE_*_TOPOLOGY`, and `SDKWORK_*_HOSTING`.
- `SDKWORK_*_DEPLOYMENT_MODE` as a deployment architecture field.
- `--topology`, `--hosting`, and any public process-layout CLI flags.
- App-local `commonSdkRootEnv` pointing at application URLs for platform SDKs.
- Hardcoded ports in Rust `default_*_upstreams()`; load from spec/profile.

Migration tools may read retired values only long enough to emit v4
`deploymentProfile`, `runtimeTarget`, `environment`, and profile id outputs.

## 11. Single HTTP Ingress Migration

Normative rules: `APPLICATION_GATEWAY_SPEC.md` section 5.6 and
`APP_RUNTIME_TOPOLOGY_SPEC.md` section 8.

Every application migration must:

1. Point `standalone.*` orchestration at
   `sdkwork-<application-code>-standalone-gateway`. A single existing listener
   that already mounts every application HTTP surface on one bind is
   migration-only evidence and must be renamed to the standalone gateway before
   release.
2. Embed route crates and service libraries in the gateway router instead of
   starting extra application HTTP listeners in dev.
3. Point `cloud.*` dev orchestration at
   `sdkwork-<application-code>-cloud-gateway` plus optional
   `sdkwork-api-cloud-gateway`; internal service binaries stay behind the
   gateway and must not become client bootstrap URLs.
4. Delete dev sidecar hooks, reserved loopback port matrices, and contract
   tests that assume multi-port local HTTP API startup.
5. Verify with `node ../sdkwork-specs/tools/check-single-http-ingress.mjs --root .`.

Workspace audit:

```bash
node ../sdkwork-specs/tools/audit-single-http-ingress-workspace.mjs --workspace ..
```

Gateway migration backlog is workspace-generated evidence, not a hard-coded
global standards table. The adoption record for each consumer repository belongs
in that repository's migration plan, release evidence, or the latest workspace
audit output.

The workspace audit must report these classes without preserving stale
repository-specific rows in this standard:

- hard errors: multiple client-facing HTTP listeners remain in one connectivity
  plane.
- gateway warnings: a single listener exists but `application.public-ingress`
  still points at a retired ingress name.
- assembly warnings: gateway crates still hand-merge route crates instead of
  using `sdkwork-<application-code>-gateway-assembly`.
- clean: `application.public-ingress` points at the canonical standalone or
  cloud gateway and route composition evidence is present.

Run:

```bash
node tools/audit-single-http-ingress-workspace.mjs --workspace ..
```

Use `--strict` to fail CI on gateway migration warnings after hard errors are cleared.
