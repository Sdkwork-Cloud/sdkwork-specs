# ADR-20260809 Platform Gateway Realtime Hosting

Status: proposed
Requirement: REQ-2026-0809-platform-gateway-realtime-hosting
Owner: SDKWork platform
Date: 2026-08-09
Specs: `APP_RUNTIME_TOPOLOGY_SPEC.md`, `APPLICATION_GATEWAY_SPEC.md`, `APP_RUNTIME_TOPOLOGY_NAMING.md`, `ENVIRONMENT_SPEC.md`, `APP_RUNTIME_TOPOLOGY_ARCHETYPES.md`, `NAMING_SPEC.md`, `TEST_SPEC.md`

## Context

`ADR-20260720-api-assembly-gateway-hosting` retired application-level HTTP
cloud gateways and kept protocol-specific edge or realtime ingress as a
separate ADR-governed role. As a result, an application's realtime plane
(WebSocket upgrade plus client link transports such as TCP, UDP, and QUIC)
must terminate on the application's own ingress process even in a `cloud`
profile, where the deployed platform cloud gateway
(`sdkwork-api-cloud-gateway`) is the only deployed host.

`sdkwork-im` already ships its realtime plane as an embeddable library
(`services/session-gateway`, `bootstrap_gateway_embedded_realtime_plane`), and
its standalone gateway embeds the plane in a single process. Hosting the same
plane inside the platform cloud gateway would let one deployed process
terminate the application's HTTP APIs and its realtime connections, reducing
deployed process count without changing IM's single-process standalone mode.

## Decision

- The platform cloud gateway `sdkwork-api-cloud-gateway` `MAY` host a declared
  application realtime plane as an embedded dependency runtime surface.
- This hosting mode applies to the `application` plane only: WebSocket
  upgrade (same listener as HTTP) and application client link transports
  (TCP, UDP, QUIC) that the application declares as part of its realtime
  surface. Device/edge protocols remain the `edge` plane and stay
  responsibility-specific `edge-runtime` processes.
- Hosting requires all of: the application declares the realtime hosting mode
  in its topology, the platform gateway declares the corresponding
  dependency surface and Cargo feature, and this ADR is recorded.
- The application's `application.public-ingress` surface identity, env keys,
  and SDK-facing URLs do not change; only the terminating host identity may
  be the deployed platform cloud gateway in a `cloud` profile.
- The application standalone gateway remains the supported host for
  `standalone` profiles; both hosting modes must keep working.

## Alternatives

- Keep realtime termination on the application's own process in `cloud`
  profiles: rejected because it forces an extra deployed process per realtime
  application and duplicates the embeddable plane already provided by
  `session-gateway`.
- Introduce a second generic application cloud gateway role: rejected by
  `ADR-20260720`; a second HTTP gateway role is retired.
- Route application link transports through an `edge` plane role: rejected
  because TCP/UDP/QUIC client links are application-plane client connection
  protocols, not device/edge protocols; `edge-runtime` stays reserved for
  device and edge ingress.

## Consequences

- `APP_RUNTIME_TOPOLOGY_SPEC.md` connectivity-plane rules gain an approved
  platform-hosted realtime exception; `APPLICATION_GATEWAY_SPEC.md` gains a
  declared non-HTTP listener exception for link transports while the single
  HTTP ingress rule stays intact for HTTP.
- The platform gateway repository may add a realtime Cargo feature and
  embedded surface per hosted application; each requires component-spec
  evidence and coverage.
- Deployment must supply the realtime plane's environment (database URL,
  optional Redis cluster bus, node identity, transport binds, QUIC TLS
  material) and honor its production fail-closed rules.
- Verification adds gateway realtime hosting tests: WebSocket upgrade
  reachable through the gateway ingress, link transports spawned only when
  declared, and single HTTP ingress checks unaffected.
- This decision extends, not supersedes,
  `ADR-20260720-api-assembly-gateway-hosting`.

## Verification

- `APP_RUNTIME_TOPOLOGY_SPEC.md` and `APPLICATION_GATEWAY_SPEC.md` updated to
  the platform-hosted realtime mode.
- `APP_RUNTIME_TOPOLOGY_NAMING.md` and `ENVIRONMENT_SPEC.md` register the
  realtime environment key family and the platform gateway realtime toggle.
- Gateway repository: `foundation-im-realtime` Cargo feature, embedded
  realtime plane surface, WebSocket upgrade and link-transport tests pass.
- Single HTTP ingress checks pass with declared non-HTTP link listeners.
- `sdkwork-im` standalone gateway mode is unchanged and its checks pass.

## Supersedes / Superseded By

Extends `ADR-20260720-api-assembly-gateway-hosting`; nothing is superseded.
