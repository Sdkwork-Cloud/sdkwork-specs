# Application Runtime Topology Adoption Guide

- Version: 3.0
- Scope: how every SDKWork application adopts the shared deployment/topology framework
- Related: `APP_RUNTIME_TOPOLOGY_SPEC.md`, `APP_RUNTIME_TOPOLOGY_NAMING.md`, `APP_RUNTIME_TOPOLOGY_ARCHETYPES.md`, `DEPLOYMENT_SPEC.md`, `../sdkwork-app-topology/README.md`

This guide is the single adoption path. Application repositories must not invent
parallel deployment vocabulary or duplicate profile loaders.

## 1. Shared Stack

| Layer | Owner | Application responsibility |
| --- | --- | --- |
| Platform specs | `sdkwork-specs/APP_RUNTIME_TOPOLOGY_*` | Declare deployment profile, archetype, surfaces, and profile ids |
| Framework library | `@sdkwork/app-topology` | Load profiles, resolve surface URLs, IAM DB helpers, health waits |
| Thin adapter | `scripts/lib/<app>-topology.mjs` | Pin spec path, export app defaults |
| Dev orchestrator | `scripts/<app>-dev.mjs` | Spawn processes, health-gate clients |
| Profile env | `configs/topology/*.env` | Authoritative binds and public URLs |

Forbidden:

- hand-rolled profile parsing.
- inline port literals in feature packages.
- duplicate env key naming.
- `self-hosted`, `cloud-hosted`, `saas`, `private`, or `local` as topology
  profile id segments.

## 2. Required Files Per Application

```text
specs/topology.spec.json              # schemaVersion 3
configs/topology/<profile-id>.env     # one file per active profile
scripts/lib/<app>-topology.mjs        # adapter over @sdkwork/app-topology
scripts/<app>-dev.mjs                 # topology-aware dev entry
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
| `sdkwork-drive` | `application-http-gateway` | `standalone.unified-process.development` | `standalone.unified-process.production` or `cloud.split-services.production` |
| `sdkwork-im` | `realtime-application-platform` | `standalone.split-services.development` or `cloud.split-services.development` | `cloud.split-services.production` |
| `sdkwork-aiot` | `application-rest-edge-device` | `standalone.split-services.development` | `cloud.split-services.production` |

Rules:

- Every app must declare whether it supports `standalone`, `cloud`, or both.
- New application templates should include at least one `standalone` profile and
  one `cloud` profile unless the app is explicitly client-only.
- Realtime or edge apps may require `split-services` even in standalone because
  the deployment unit can contain multiple managed processes.

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
- The adapter must expose only normalized v3 values to application code.

## 6. Dev Orchestrator Pattern

1. Parse `--deployment-profile` and `--service-layout`, or use a fixed default profile id.
2. Load `configs/topology/<profile-id>.env` from the adapter.
3. Merge `process.env`, profile env, and optional database env.
4. Set `SDKWORK_<APPLICATION_CODE>_DEPLOYMENT_PROFILE` to `standalone` or `cloud`.
5. Set `SDKWORK_<APPLICATION_CODE>_RUNTIME_TARGET` to `server`, `container`, `desktop`, `browser`, or `test-runner`.
6. Health-check required surfaces before starting Vite, Tauri, backend, workers, or clients.
7. Inject client env keys from profile; never hardcode `127.0.0.1:*` in orchestrator except as profile defaults in checked-in topology env examples.

CLI naming follows `PNPM_SCRIPT_SPEC.md`:

```bash
pnpm dev                                      # default development profile
pnpm dev:browser:postgres:unified-process:standalone
pnpm dev:browser:postgres:split-services:cloud
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
| `sdkwork-drive` | v3 topology spec, standalone and cloud profiles |
| `sdkwork-im` | v3 topology spec, realtime standalone smoke and cloud split profiles |
| `sdkwork-aiot` | v3 topology spec, edge surfaces and cloud split profiles |
| `sdkwork-app-topology` | v3 schema/runtime, profile loader, surface resolvers, health helpers |

## 10. Retirement Checklist

When migrating an application, delete and do not alias:

- v1/v2 topology env files using `self-hosted.*` or `cloud-hosted.*`.
- `SDKWORK_*_TOPOLOGY`, `VITE_*_TOPOLOGY`, and `SDKWORK_*_HOSTING`.
- `SDKWORK_*_DEPLOYMENT_MODE` as a deployment architecture field.
- `--topology` and `--hosting` CLI flags.
- App-local `commonSdkRootEnv` pointing at application URLs for platform SDKs.
- Hardcoded ports in Rust `default_*_upstreams()`; load from spec/profile.

Migration tools may read retired values only long enough to emit v3
`deploymentProfile`, `runtimeTarget`, and profile id outputs.
