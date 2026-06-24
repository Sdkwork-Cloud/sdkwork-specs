# Application Runtime Topology Archetypes

- Version: 3.0
- Scope: reusable runtime topology patterns referenced by `specs/topology.spec.json` `archetype`
- Related: `APP_RUNTIME_TOPOLOGY_SPEC.md`, `APP_RUNTIME_TOPOLOGY_NAMING.md`, `DEPLOYMENT_SPEC.md`, `CONFIG_SPEC.md`

Archetypes are normative templates. Application specs instantiate them with
concrete deployment profiles, surfaces, binds, dependencies, and orchestration.
They describe connectivity and service layout, not UI/application mode. Browser,
desktop, tablet, mobile, mini program, server, container, and test targets are
runtime targets governed by `CONFIG_SPEC.md` and `DEPLOYMENT_SPEC.md`; they do
not require separate topology archetypes merely because the package runs on a
different client host.

**Naming:** all profile ids, surface ids, env keys, and plane names must match
`APP_RUNTIME_TOPOLOGY_NAMING.md`.

## 1. Archetype Index

| Archetype id | Spoken name | Reference applications |
| --- | --- | --- |
| `application-http-gateway` | application HTTP gateway | `sdkwork-drive` |
| `realtime-application-platform` | realtime application plus platform gateway | `sdkwork-im`, future collaboration/RTC apps |
| `application-rest-edge-device` | application REST plus edge device | `sdkwork-aiot`, future IoT/edge apps |

Retired archetype ids: `http-product-gateway`, `multi-plane-realtime`, and
`dual-plane-connected`.

## 2. `application-http-gateway`

Single application HTTP ingress; optional platform gateway or embedded platform
adapter for IAM and cross-application SDKs.

### Connectivity Planes

- `application` is required.
- `platform` is required when IAM or cross-application SDKs are used.
- `operations` is optional for operator-only control APIs.

### Surfaces

| Surface id | Plane | Protocols |
| --- | --- | --- |
| `application.public-ingress` | application | `http` |
| `platform.api-gateway` | platform | `http` |
| `operations.control-ingress` | operations | `http` |

### Allowed Profiles

| Profile id | deploymentProfile | serviceLayout | environment | Default |
| --- | --- | --- | --- | --- |
| `standalone.unified-process.development` | standalone | unified-process | development | Yes |
| `standalone.unified-process.production` | standalone | unified-process | production | Yes for standalone release |
| `cloud.split-services.development` | cloud | split-services | development | Optional integration profile |
| `cloud.split-services.staging` | cloud | split-services | staging | Optional cloud pre-prod |
| `cloud.split-services.production` | cloud | split-services | production | Yes for cloud release |

Rules:

- Drive-class standalone deployments embed application app/backend/open/admin
  routes behind one application ingress and may embed an approved IAM adapter.
- Cloud deployments use managed platform URLs and split service orchestration.
- All HTTP `*-api` surfaces must integrate `sdkwork-web-framework` or the
  language-equivalent profile required by `WEB_FRAMEWORK_SPEC.md`.

## 3. `realtime-application-platform`

Application HTTP + WebSocket ingress; platform HTTP gateway for IAM, Drive,
Agent, and other shared APIs; optional operations control ingress.

### Connectivity Planes

- `application` is required for product APIs and realtime WebSocket.
- `platform` is required for IAM and cross-application SDKs unless the standalone
  profile embeds an approved platform adapter.
- `operations` is optional for governance/control APIs.

### Surfaces

| Surface id | Plane | Protocols | Notes |
| --- | --- | --- | --- |
| `application.public-ingress` | application | `http`, `websocket` | Single host:port for HTTP and WS upgrade |
| `platform.api-gateway` | platform | `http` | External in cloud; external or embedded adapter in standalone |
| `operations.control-ingress` | operations | `http` | Optional; may be internal-only in development |

### Allowed Profiles

| Profile id | deploymentProfile | serviceLayout | Default |
| --- | --- | --- | --- |
| `standalone.unified-process.development` | standalone | unified-process | Smoke/dev only unless ADR approves production |
| `standalone.split-services.development` | standalone | split-services | Local integration for realtime dependencies |
| `cloud.split-services.development` | cloud | split-services | Cloud integration |
| `cloud.split-services.staging` | cloud | split-services | Cloud pre-prod |
| `cloud.split-services.production` | cloud | split-services | Default production |

### Service Layout Semantics

| serviceLayout | Processes | When |
| --- | --- | --- |
| `unified-process` | Application routes and simplified realtime runtime in one ingress binary | Smoke, demo, or approved standalone runtime |
| `split-services` | Application ingress, internal upstream services, platform gateway, and managed dependencies | Realtime development and cloud production |

Rules:

- Cloud production for realtime apps defaults to `cloud.split-services.production`.
- `standalone.unified-process.production` for realtime apps requires an
  architecture decision that proves embedded or external platform dependency
  coverage, message delivery semantics, persistence, Redis/cache behavior, and
  operational limits.
- IAM-capable clients still use the platform surface contract even when a
  standalone profile embeds an adapter.

### Capability Matrix

| Capability | `standalone.unified-process` | `cloud.split-services` |
| --- | --- | --- |
| Application HTTP/WebSocket | yes | yes |
| IAM login | embedded adapter or platform surface | platform gateway |
| Drive media upload | embedded adapter or dependency SDK base URL | platform/dependency SDK base URL |
| Per-service scaling | no | yes |
| Full upstream matrix | simplified | full |

### Client Env Model

```text
SDKWORK_<APPLICATION_CODE>_APPLICATION_PUBLIC_HTTP_URL
SDKWORK_<APPLICATION_CODE>_APPLICATION_PUBLIC_WEBSOCKET_URL
SDKWORK_<APPLICATION_CODE>_PLATFORM_API_GATEWAY_HTTP_URL
VITE_SDKWORK_<APPLICATION_CODE>_APPLICATION_PUBLIC_HTTP_URL
VITE_SDKWORK_<APPLICATION_CODE>_APPLICATION_PUBLIC_WEBSOCKET_URL
VITE_SDKWORK_<APPLICATION_CODE>_PLATFORM_API_GATEWAY_HTTP_URL
```

Forbidden: `SDKWORK_<APPLICATION_CODE>_SERVER_API_BASE_URL`, `commonSdkRootEnv` pointing at
application URLs for platform SDKs, and undocumented WebSocket URL shapes.

### Cloud Public URL Policy

Choose one canonical pattern per deployment and declare it in the app topology spec:

- Pattern A: HTTP and WSS share one public application host. WebSocket path is
  fixed, for example `/im/v3/api/realtime/ws` on `im.sdkwork.com`.
- Pattern B: Dedicated realtime host. Both hosts must appear explicitly in the
  `cloud.split-services.production` profile.

## 4. `application-rest-edge-device`

Human/admin application REST planes plus separate edge device ingress; platform
gateway when consoles use IAM.

### Connectivity Planes

- `application` is required for app-api and backend/admin REST.
- `platform` is required when consoles use IAM.
- `edge` is required for device gateway protocols.

### Surfaces

| Surface id | Plane | Protocols |
| --- | --- | --- |
| `application.public-ingress` | application | `http` |
| `operations.control-ingress` | operations | `http` |
| `edge.device-ingress` | edge | `http`, `websocket`, `mqtt`, `udp` |
| `platform.api-gateway` | platform | `http` |

### Allowed Profiles

| Profile id | deploymentProfile | serviceLayout |
| --- | --- | --- |
| `standalone.split-services.development` | standalone | split-services |
| `standalone.split-services.production` | standalone | split-services |
| `cloud.split-services.staging` | cloud | split-services |
| `cloud.split-services.production` | cloud | split-services |

Rules:

- Edge ingress is never proxied by `sdkwork-api-cloud-gateway`.
- OTA/device activation responses `MUST` use public URLs from the active profile.
- Standalone edge deployments must still use explicit edge/device surfaces
  instead of hiding device protocols behind application HTTP URLs.

## 5. Adding A New Archetype

1. Propose archetype id, deployment profile support, and connectivity planes in
   an architecture decision.
2. Add a section to this file and register names in
   `APP_RUNTIME_TOPOLOGY_NAMING.md`.
3. Extend `sdkwork-app-topology` JSON Schema v3 enum when archetype validation
   is enforced.
4. Add a reference `examples/<app>/topology.spec.json` in
   `sdkwork-app-topology`.

Do not create `APP_<PRODUCT>_TOPOLOGY_SPEC.md` platform files.
