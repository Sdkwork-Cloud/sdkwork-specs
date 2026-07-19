# Application Runtime Topology Naming Registry

- Version: 4.0
- Scope: canonical names for deployment profile, runtime topology vocabulary, profiles, surfaces, environment keys, CLI flags, and documentation
- Related: `APP_RUNTIME_TOPOLOGY_SPEC.md`, `APP_RUNTIME_TOPOLOGY_ARCHETYPES.md`, `NAMING_SPEC.md`, `DEPLOYMENT_SPEC.md`, `CONFIG_SPEC.md`

This file is the naming authority for application runtime topology. If another
document uses a retired synonym, that document is wrong.

## 1. Design Principles

1. Speak in full words. Profile ids and CLI values must be readable in standups
   without decoding: `standalone.production`, not `std.prod`.
2. One concept, one term. Do not create parallel public synonyms such as
   `gateway-mode`, `local-minimal`, `web-gateway`, `private`, or `saas`.
3. Deployment profile before runtime target. `standalone` and `cloud` describe
   the application deployment architecture; runtime target describes the package
   or host surface that starts or consumes that deployment.
4. Internal process layout stays internal. Process count, upstream fan-out, and
   binary decomposition do not appear in profile ids, env key axes, public
   scripts, SDK package names, or application integration manifests.
5. Plane before application line. Connectivity names describe route ownership,
   not marketing names.
6. Env keys are scannable. Fixed segment order is
   `SDKWORK_<APPLICATION_CODE>_<PLANE>_<SURFACE>_<PROPERTY>`.
7. Retire, do not alias. Unreleased applications delete old keys; bridging is
   forbidden outside approved migration tools.

## 2. Axis Registry

| Canonical key | Spoken name | Allowed values | Meaning |
| --- | --- | --- | --- |
| `deploymentProfile` | deployment profile | `standalone`, `cloud` | Active application API/runtime topology |
| `environment` | environment tier | `development`, `test`, `staging`, `production` | Lifecycle stage from `ENVIRONMENT_SPEC.md` |
| `connectivityPlane` | connectivity plane | `application`, `platform`, `operations`, `edge` | Who owns the route and protocol termination |
| `cloudIngress.strategy` | cloud ingress strategy | `platform-collapsed`, `dedicated-application`, `edge-split` | How deployed cloud public planes bind to gateway roles; not a deployment profile |
| `orchestration.processes[].role` | process role | `client`, gateway/API/data/migration/worker roles, `tunnel` | Machine authority for local-process safety checks in topology v5 |

### Deployment Profile

| Value | When to say it | Typical deployment |
| --- | --- | --- |
| `standalone` | APIs terminate at the application-owned standalone gateway | Local dev, desktop-local gateway, private appliance/host, single service/container |
| `cloud` | Clients consume deployed cloud APIs, defaulting to `sdkwork-api-cloud-gateway` HTTP ingress | SDKWork hosted cloud, customer VPC/private cloud, Kubernetes, or local clients consuming cloud APIs |

Rules:

- `standalone` and `cloud` are the only deployment profile values.
- Do not use `saas`, `private`, `local`, `test`, `server`, `container`,
  `desktop`, `browser`, `web`, `mobile`, `mini-program`, `docker`, or hosting
  aliases as deployment profile values.
- SaaS/customer-private ownership is release environment metadata, not a
  topology axis.
- `server`, `container`, `desktop`, browser, mobile, mini-program, and
  `test-runner` are runtime targets in `CONFIG_SPEC.md` and `ENVIRONMENT_SPEC.md`.
- `dual` is the package-id artifact-binding token for a runtime-configurable client, not a
  deployment profile or topology profile-id segment.

### Retired Public Topology Vocabulary

| Retired concept | Replacement |
| --- | --- |
| hosting axis | `deploymentProfile` |
| self-hosted/cloud-hosted labels | `standalone` or `cloud` plus deployment ownership metadata |
| topology/distribution as profile axes | `deploymentProfile` plus internal implementation documentation |
| ambiguous `profile` shorthand | `environment` or full two-segment profile id |
| deployment mode as SaaS/private/local/test | `deploymentProfile` plus environment/release metadata |
| deployment mode as server/container/desktop/web/mobile/mini-program/docker | `runtimeTarget` plus package metadata; Docker-compatible artifacts map to `container` |
| plane names product/foundation/admin/device | `connectivityPlane`: `application`, `platform`, `operations`, `edge` |
| local/split/gateway mode labels | exact `deploymentProfile` plus declared surfaces |

Rules:

- New application standards, repository specs, env files, and scripts `MUST NOT`
  introduce a public process-layout axis.
- Migration tooling may recognize retired values as input only, then normalize
  to `deploymentProfile`, `environment`, runtime target, and declared surfaces
  before application code sees them.

## 3. Profile Id Formula

```text
<deploymentProfile>.<environment>
```

Examples:

| Profile id | Short spoken form |
| --- | --- |
| `standalone.development` | standalone dev |
| `standalone.production` | standalone prod |
| `cloud.staging` | cloud staging |
| `cloud.production` | cloud prod |

Profile env file path:

```text
etc/topology/<deploymentProfile>.<environment>.env
```

CLI:

```bash
--deployment-profile standalone --environment development
--deployment-profile cloud --environment production
```

Rules:

- Profile ids `MUST` have exactly two segments.
- Profile ids `MUST NOT` contain runtime target, database engine, process
  layout, provider name, hosting owner, or package format.

## 4. Connectivity Planes

| Plane | Owns | Example routes / protocols |
| --- | --- | --- |
| `application` | Application-owned APIs and application realtime | `/im/v3/api/*`, HTTP + WebSocket on same ingress |
| `platform` | Shared SDKWork platform APIs | IAM, Drive, Notary, Agent through `sdkwork-api-cloud-gateway` or approved embedded standalone adapter |
| `operations` | Operator / control APIs | Governance, drain, provider registry |
| `edge` | Device and edge protocols | Device WebSocket, MQTT bridge, UDP |

## 5. Surface Id Formula

```text
<connectivityPlane>.<surfaceRole>
```

| Surface id | Plane | Role | Protocols |
| --- | --- | --- | --- |
| `application.public-ingress` | application | Client-facing application ingress | `http`, `ws` |
| `platform.api-gateway` | platform | Shared platform HTTP entry | `http` |
| `operations.control-ingress` | operations | Operator entry | `http` |
| `edge.device-ingress` | edge | Device entry | `http`, `ws`, `mqtt`, `udp` |

Retired surface ids: `product-ingress`, `foundation-gateway`,
`admin-ingress`, and bare `device-ingress`.

## 6. Environment Key Formula

### Deployment And Runtime

| Key | Meaning |
| --- | --- |
| `SDKWORK_<APPLICATION_CODE>_DEPLOYMENT_PROFILE` | `standalone` or `cloud` |
| `SDKWORK_<APPLICATION_CODE>_RUNTIME_TARGET` | One exact `CONFIG_SPEC.md` runtime target: `browser`, `desktop`, `tablet-ipados`, `tablet-android`, `capacitor-ios`, `capacitor-android`, `flutter-ios`, `flutter-android`, `android-native`, `ios-native`, `harmony-native`, `mini-program`, `server`, `container`, or `test-runner` |

Browser/public runtime documents may expose `deploymentProfile` and
`runtimeTarget` only as non-secret normalized values.

### Server-Side Surfaces

```text
SDKWORK_<APPLICATION_CODE>_<PLANE>_<SURFACE>_<PROPERTY>
```

| Property | Meaning | Example |
| --- | --- | --- |
| `BIND` | `host:port` listen address | `SDKWORK_IM_APPLICATION_PUBLIC_INGRESS_BIND` |
| `HTTP_URL` | Public HTTP base URL | `SDKWORK_IM_APPLICATION_PUBLIC_HTTP_URL` |
| `WEBSOCKET_URL` | Public WebSocket origin without path | `SDKWORK_IM_APPLICATION_PUBLIC_WEBSOCKET_URL` |
| `AUTOSTART` | Dev orchestrator autostart | `SDKWORK_IM_PLATFORM_API_GATEWAY_AUTOSTART` |

Plane segment is uppercase single word: `APPLICATION`, `PLATFORM`,
`OPERATIONS`, or `EDGE`.

Surface segment uses uppercase with underscores: `PUBLIC_INGRESS`,
`API_GATEWAY`, `CONTROL_INGRESS`, or `DEVICE_INGRESS`.

### Internal Upstream

Cloud profiles and advanced standalone profiles may define internal upstream
keys for gateway-to-service communication:

```text
SDKWORK_<APPLICATION_CODE>_INTERNAL_<SERVICE>_BIND
```

Example: `SDKWORK_IM_INTERNAL_SESSION_GATEWAY_BIND`.

These keys are server-side only. They `MUST NOT` become client bootstrap keys or
additional required public HTTP surfaces.

### Client-Side Mirror

```text
VITE_<APP_CODE>_<PLANE>_<SURFACE>_<PROPERTY>
```

Example: `VITE_SDKWORK_IM_APPLICATION_PUBLIC_HTTP_URL`.

Rules:

- One env key `MUST NOT` serve two connectivity planes.
- WebSocket URL keys use `WEBSOCKET_URL`, not `WS_URL` or
  `WEBSOCKET_BASE_URL`.
- `SDKWORK_<APPLICATION_CODE>_DEPLOYMENT_MODE` is retired and `MUST` be rejected by new
  application startup, checked-in examples, workflow config, and runtime config.
  New applications use `SDKWORK_<APPLICATION_CODE>_DEPLOYMENT_PROFILE` plus
  `SDKWORK_<APPLICATION_CODE>_RUNTIME_TARGET`.
- Public process-layout env keys are forbidden. Implementation-specific
  upstream config must use internal surface/upstream keys.

## 7. Archetype Registry

| Archetype id | Spoken name | Use when |
| --- | --- | --- |
| `application-http-gateway` | application HTTP gateway | Single application HTTP ingress |
| `realtime-application-platform` | realtime application plus platform gateway | HTTP + WS product ingress with platform dependencies |
| `application-rest-edge-device` | application REST plus edge device | REST services plus separate device ingress |

Retired archetype ids: `http-product-gateway`,
`multi-plane-realtime`, and `dual-plane-connected`.

## 8. Documentation Phrases

Use these exact phrases in reviews and runbooks:

- "This change affects `application.public-ingress` only."
- "Foundation SDKs must use `platform.api-gateway` URLs unless standalone embeds an approved platform adapter."
- "Default standalone profile is `standalone.development`."
- "Default cloud release profile is `cloud.production`."
- "WebSocket terminates on `application.public-ingress`, not `platform.api-gateway`."

Avoid:

- "the gateway" without naming application ingress or platform gateway.
- "server URL" without naming application HTTP URL or platform HTTP URL.
- "local mode"; say `standalone` plus the exact profile id.
- "SaaS mode" as a deployment profile; say `cloud` plus release environment metadata.
- "chat host" for IM. IM is `im.sdkwork.com`; `chat.sdkwork.com` is reserved for LLM dialogue apps.
- public process-layout mode names in docs, scripts, env files, or SDK bootstrap.

## 9. SDKWork Public Host Registry

Application-plane public hosts `MUST` match product domain, not feature nicknames.

| Application | `application.public-ingress` host | Platform gateway |
| --- | --- | --- |
| `sdkwork-im` | `im.sdkwork.com` | `api.sdkwork.com` |
| LLM / Agent dialogue apps | `chat.sdkwork.com` | `api.sdkwork.com` |
| `sdkwork-drive` | `drive.sdkwork.com` | `api.sdkwork.com` |

Rules:

- IM HTTP and WebSocket share `im.sdkwork.com` unless the topology spec declares
  a separate realtime host.
- Do not reuse `chat.sdkwork.com` for IM.
- Platform SDKs use `api.sdkwork.com` in cloud deployments.

## 10. Gateway Crate Registry

Gateway crate names `MUST` encode scope and deployment profile. Naming authority lives in
`APPLICATION_GATEWAY_SPEC.md` and `NAMING_SPEC.md` section 4.3.1.

| Scope | Deployment profile | Canonical crate | Primary surface | Platform dependency |
| --- | --- | --- | --- | --- |
| application | `standalone` | `sdkwork-<application-code>-standalone-gateway` | `application.public-ingress` | may embed approved platform adapter |
| application | `cloud` | `sdkwork-<application-code>-cloud-gateway` | exceptional dedicated `application.public-ingress` | uses external `sdkwork-api-cloud-gateway` for `platform.api-gateway` |
| platform | `cloud` | `sdkwork-api-cloud-gateway` | `platform.api-gateway` plus default collapsed application HTTP | n/a |

Rules:

- Bare `sdkwork-<application-code>-gateway` is retired. The platform gateway canonical crate is
  `sdkwork-api-cloud-gateway`; say `standalone-gateway`, `cloud-gateway`, or
  `api-cloud-gateway` explicitly in reviews, scripts, manifests, and topology docs.
- `gateway:run:standalone` and related `gateway:*:standalone` commands target the standalone
  gateway crate; `gateway:run:cloud` and related `gateway:*:cloud` commands target the cloud
  gateway crate only when an ADR-approved dedicated/edge cloud ingress exists.
- `sdkwork-<application-code>-api-server` is not a substitute for an application gateway crate when
  the process composes or proxies dependency/platform surfaces for a deployment profile.
- Internal capability gateways such as `session-gateway` remain internal service names and do not
  replace application gateway crate naming unless they terminate `application.public-ingress` for
  a declared deployment profile.

Retired crate naming:

| Retired | Replacement |
| --- | --- |
| `sdkwork-api-cloud-gateway-api-server` | `sdkwork-api-cloud-gateway` |
| `sdkwork-<application-code>-gateway` | `sdkwork-<application-code>-standalone-gateway` or `sdkwork-<application-code>-cloud-gateway` |
| `gateway:bundle:*` | `gateway:package:*` |
| `gateway:bundle:validate:*` | `gateway:validate:*` |

## 11. Version History

| Version | Change |
| --- | --- |
| 4.0 | Collapsed topology profiles to `deploymentProfile.environment`; public process-layout axis removed from application integration |
| 3.2 | Platform gateway crate standardized as `sdkwork-api-cloud-gateway`; retired listener crate |
| 3.1 | Gateway crates must use scope plus `standalone` or `cloud` deployment qualifiers |
| 3.0 | Promoted `deploymentProfile = standalone | cloud` as the application deployment architecture and retired hosting/self-hosted/cloud-hosted as topology axes |
