# Application Runtime Topology Standard

- Version: 4.0
- Scope: cross-application deployment entrypoints, multi-plane routing, multi-protocol surfaces, dev orchestration contracts, and client bootstrap URL authority
- Related: `APPLICATION_GATEWAY_SPEC.md`, `APP_RUNTIME_TOPOLOGY_NAMING.md`, `APP_RUNTIME_TOPOLOGY_ARCHETYPES.md`, `DEPLOYMENT_SPEC.md`, `ENVIRONMENT_SPEC.md`, `CONFIG_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, `GITHUB_WORKFLOW_SPEC.md`, `../sdkwork-app-topology/README.md`

This standard defines where clients, operators, devices, and SDKs connect for
each SDKWork application. `DEPLOYMENT_SPEC.md` owns the application deployment
architecture: every deployable application uses exactly one active
`deploymentProfile`: `standalone` or `cloud`.

`deploymentProfile` is the only deployment-mode axis exposed to application
integration, SDK bootstrap, dev scripts, profile ids, and release automation.
Process decomposition, upstream scaling, and platform adapter placement are
implementation details inside the selected profile; they are not additional
profile segments.

**Naming authority:** `APP_RUNTIME_TOPOLOGY_NAMING.md`. All labels, env keys,
profile ids, CLI flags, and examples must match that registry.

## 1. Non-Goals

- OpenAPI/SDK ownership. Use `API_SPEC.md`, `SDK_SPEC.md`, and app integration specs.
- nginx, K8s, systemd, or provider-specific manifest details.
- Backward compatibility with retired deployment vocabulary.
- Exposing internal process decomposition as an SDKWork application integration mode.

## 2. Vocabulary

Applications `MUST` use these axes.

| Axis | Key | Values | Question it answers |
| --- | --- | --- | --- |
| Deployment profile | `deploymentProfile` | `standalone`, `cloud` | What deployment architecture is this application using? |
| Environment tier | `environment` | `development`, `test`, `staging`, `production` | Which lifecycle stage is active? |
| Connectivity plane | `connectivityPlane` | `application`, `platform`, `operations`, `edge` | Who owns this route? |

Examples in conversation:

- "Drive production uses `standalone.production`."
- "IM production uses `cloud.production`."
- "Realtime WebSocket terminates on `application.public-ingress`, not `platform.api-gateway`."

Rules:

- `deploymentProfile` values are only `standalone` and `cloud`.
- `standalone` means the application is shipped and operated as a
  self-contained deployment unit. It may embed application routes, dependency
  adapters, and an approved platform adapter behind one application ingress.
- `cloud` means the application is operated through cloud release automation,
  managed secrets, probes, rollout/rollback, and an application cloud gateway.
  It may proxy to internal upstream services, but clients still see one
  application ingress surface.
- Retired terms such as `self-hosted`, `cloud-hosted`, `saas`, `private`,
  `local`, `hosting`, `topology`, and `distribution` `MUST NOT` be used as
  active deployment profile or profile-id segments.
- `deploymentProfile` must not be inferred from `runtimeTarget`. A container
  can be a `standalone` single-container artifact or a `cloud` orchestrated
  image.
- Internal process count, binary count, and upstream fan-out `MUST NOT` appear
  in profile ids, SDK package names, public scripts, browser env keys, or
  application integration contracts.

## 3. Connectivity Planes

| Plane | Owner | Protocols | Terminated by |
| --- | --- | --- | --- |
| `application` | Application repository | `http`, `ws`, future `sse` | Application public ingress (`sdkwork-<application-code>-standalone-gateway` or `sdkwork-<application-code>-cloud-gateway`) |
| `platform` | Shared SDKWork platform | `http` | `sdkwork-api-cloud-gateway` or an approved embedded standalone adapter |
| `operations` | Application operator APIs | `http` | Operations control ingress |
| `edge` | Device or edge gateway | `ws`, `mqtt`, `udp`, device `http` | Edge device ingress |

Rules:

- Application realtime WebSocket `MUST` terminate on `application.public-ingress`.
- Platform APIs `MUST` use `platform.api-gateway` URLs in client bootstrap
  unless the standalone profile explicitly embeds an approved platform adapter.
- Edge protocols `MUST NOT` be routed through `sdkwork-api-cloud-gateway` unless a
  future platform spec adds an edge tier.
- Each plane `MUST` have distinct env keys from `APP_RUNTIME_TOPOLOGY_NAMING.md`.

## 4. Surfaces

A surface is a named ingress: bind, public URL, protocol set, and optional path
metadata.

Surface id pattern:

```text
<connectivityPlane>.<surfaceRole>
```

Example declaration in `specs/topology.spec.json`:

```json
{
  "id": "application.public-ingress",
  "connectivityPlane": "application",
  "protocols": ["http", "websocket"],
  "bindEnv": "SDKWORK_IM_APPLICATION_PUBLIC_INGRESS_BIND",
  "httpUrlEnv": "SDKWORK_IM_APPLICATION_PUBLIC_HTTP_URL",
  "websocketUrlEnv": "SDKWORK_IM_APPLICATION_PUBLIC_WEBSOCKET_URL",
  "websocketPath": "/im/v3/api/realtime/ws"
}
```

Rules:

- HTTP and WebSocket on the same surface share host and port; only the scheme differs.
- `websocketUrlEnv` is origin only; SDKs append `websocketPath`.
- `bindEnv` is server-side; `*UrlEnv` keys are used by clients and orchestration.

## 5. Archetypes

Applications declare `archetype` in `specs/topology.spec.json`. Definitions
live in `APP_RUNTIME_TOPOLOGY_ARCHETYPES.md`.

| Archetype | Typical products |
| --- | --- |
| `application-http-gateway` | Drive-class HTTP applications |
| `realtime-application-platform` | IM and future realtime collaboration apps |
| `application-rest-edge-device` | AIoT and future edge/device apps |

## 6. Profile Contract

### Profile Id

```text
<deploymentProfile>.<environment>
```

Examples:

```text
standalone.development
standalone.production
cloud.staging
cloud.production
```

Rules:

- Profile ids `MUST` contain exactly two segments.
- The first segment `MUST` be `standalone` or `cloud`.
- The second segment `MUST` be a normalized environment tier from
  `ENVIRONMENT_SPEC.md`.
- A profile id `MUST NOT` encode runtime target, database engine, process
  count, upstream count, hosting ownership, or package format.

### Repository Files

```text
specs/topology.spec.json
configs/topology/<profile-id>.env
docs/topology-standard.md
scripts/lib/<application-code>-topology.mjs
```

Implementation: `@sdkwork/app-topology` (`../sdkwork-app-topology`).

## 7. Client Bootstrap

- IAM login uses `platform.api-gateway` when the platform plane is external.
- Embedded standalone IAM adapters must preserve the same SDK contract,
  credential rules, and `WebRequestContext` behavior.
- Application open-api and app-api SDKs use `application.public-ingress` HTTP URL.
- Realtime SDKs use `application.public-ingress` WebSocket URL.
- Client env keys mirror server keys with the configured browser prefix.

Forbidden:

- One ambiguous URL for both application and platform SDKs.
- Hardcoded loopback ports in feature packages.
- Generated SDK operations that accept current tenant context through
  `tenant_id` or `tenantId` parameters.

## 8. Dev Orchestration

Dev scripts `MUST`:

1. Load profile env from `configs/topology/` through `@sdkwork/app-topology`.
2. Start processes from `topology.spec.json` `orchestration.profiles[<profile-id>]`.
3. Health-check required surfaces before starting clients.
4. Accept `--deployment-profile` and `--environment`.
5. Print the resolved `deploymentProfile`, `environment`, runtime target,
   database profile when applicable, and profile id at startup.

Root `dev:browser` and `dev:desktop` are default dev orchestration commands.
They `MUST` resolve to `standalone.development` and the PostgreSQL dev database
profile unless the command name explicitly selects another database or `cloud`.
New dev scripts `MUST NOT` accept or emit retired deployment flags such as
`--hosting self-hosted` or `--hosting cloud-hosted`.

For `deploymentProfile=standalone`, orchestration `MUST` start only the
application ingress process for application-plane HTTP APIs. Internal route
crates may be embedded in that ingress process, and dev/runtime contracts `MUST
NOT` require extra loopback API ports to make application-plane APIs reachable.

For every profile, orchestration `MUST` treat HTTP API ingress as **single-bind
per plane**:

- `application.public-ingress` is the only application-plane HTTP listener that
  dev scripts, client bootstrap, and default smoke tests may require.
- `platform.api-gateway` is the only platform-plane HTTP listener that dev
  scripts and client bootstrap may require when platform APIs are in scope.
- Additional HTTP surface ids such as `application.backend-http`,
  `application.open-http`, or per-service listener binaries `MUST NOT` appear
  as separately required orchestration processes when a gateway already
  terminates the same plane. Those binaries remain valid as internal upstream
  or packaging targets only.
- Dev orchestration scripts `MUST NOT` spawn HTTP sidecar loops, multi-port
  service matrices, or reserved loopback port tables whose only purpose is to
  keep extra application HTTP listeners alive locally.

Normative gateway integration rules live in `APPLICATION_GATEWAY_SPEC.md`
section 5.6. Workspace verification:
`node tools/audit-single-http-ingress-workspace.mjs`.

Adoption steps: `APP_RUNTIME_TOPOLOGY_ADOPTION.md`.

## 9. Deployment Standard Mapping

| Deployment profile | Runtime target coverage |
| --- | --- |
| `standalone` | `server`, `container`, `desktop`, `tablet-ipados`, `tablet-android`, `capacitor-ios`, `capacitor-android`, `flutter-ios`, `flutter-android`, `android-native`, `ios-native`, `harmony-native`, `mini-program` when packaged as a private/platform-local app, and `test-runner` |
| `cloud` | `container`, `server`, `browser`, `mini-program`, H5 browser surfaces, cloud-served public runtime config, and `test-runner` |

Rules:

- `server`, `container`, `desktop`, `browser`, tablet, Capacitor, Flutter,
  native mobile, mini-program, and `test-runner` values from `CONFIG_SPEC.md`
  are runtime targets, not deployment profiles.
- Client runtime targets may be standalone release artifacts while their SDK
  base URLs point at cloud services. This does not create a third deployment
  profile.
- `browser` and H5 cloud surfaces normally connect to `application.public-ingress`
  and `platform.api-gateway` through public runtime config. Native, desktop,
  tablet, Flutter, Capacitor, and mini program packages connect through the
  same declared surfaces after host/bootstrap config resolves SDK base URLs.
- `docker` is not a topology or deployment profile value. Docker-compatible
  packages use `runtimeTarget = "container"` and container/OCI package metadata.
- SaaS and customer-private ownership are release/deployment-environment
  metadata. They must not create new topology profile ids.

## 10. CI And Packaging

Package profile slugs for deployable artifacts `MUST` include `standalone` or
`cloud`.

Examples:

```text
standalone-server
standalone-desktop
standalone-container
cloud-container
cloud-platform-config-bundle
cloud-application-public-ingress
```

Rules:

- Surface roles may be appended for deployable config bundles.
- Ambiguous application-code-prefixed gateway names are forbidden. Application gateway crates must
  use `sdkwork-<application-code>-standalone-gateway` or
  `sdkwork-<application-code>-cloud-gateway` per `NAMING_SPEC.md` section 4.3.1.
- Matrix planners must pass `SDKWORK_DEPLOYMENT_PROFILE` to lifecycle steps.

## 11. Verification

- Validate spec: `node ../sdkwork-app-topology/scripts/sdkwork-topology.mjs validate --root .`
- Contract tests load profile fixtures; no inline port literals in source.
- Naming audit must reject retired terms from `APP_RUNTIME_TOPOLOGY_NAMING.md`.
- Validation must fail when a topology profile id starts with retired hosting aliases.
- Validation must fail when a deployment profile is any value other than
  `standalone` or `cloud`.
- Validation must fail when a topology profile id contains more or fewer than
  two segments.
- Standalone smoke tests must prove one public application ingress can serve all
  declared application-plane HTTP APIs without extra loopback route servers.
- Cloud smoke tests must prove internal upstream URLs, platform surfaces,
  secrets, probes, and SDK base URL resolution are explicit while client
  bootstrap still receives one application ingress URL.
- Single HTTP ingress checks must pass:
  `node tools/check-single-http-ingress.mjs --root .` per repository and
  `node tools/audit-single-http-ingress-workspace.mjs --workspace ..` across
  SDKWork application repositories.

## 12. Retirement Policy

Unreleased applications delete retired keys, binaries, and docs. No aliases or
bridges are allowed in application code. Compatibility aliases are allowed only
inside an approved migration tool and must normalize to `deploymentProfile`,
`runtimeTarget`, `environment`, and the v4 profile id before application code
sees them.
