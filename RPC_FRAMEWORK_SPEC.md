# SDKWork RPC Framework Integration Standard

- Version: 1.0
- Scope: mandatory integration of `sdkwork-rpc-framework` for SDKWork gRPC servers and internal/backend RPC clients, resolver integration with `sdkwork-discovery`, interceptor pipelines, bootstrap wiring, and language-equivalent runtime profiles
- Related: `RPC_SPEC.md`, `DISCOVERY_SPEC.md`, `RPC_RESILIENCE_SPEC.md`, `RPC_SDK_WORKSPACE_SPEC.md`, `RUST_RPC_SPEC.md`, `JAVA_CODE_SPEC.md`, `WEB_FRAMEWORK_SPEC.md`, `CONFIG_SPEC.md`, `ENVIRONMENT_SPEC.md`, `DEPLOYMENT_SPEC.md`, `SECURITY_SPEC.md`, `OBSERVABILITY_SPEC.md`, `SDK_SPEC.md`, `MIGRATION_SPEC.md`, `TEST_SPEC.md`
- Detail standard: `../sdkwork-rpc-framework/specs/RPC_FRAMEWORK_STANDARD.md` (L1 framework repository authoritative for crate APIs, pipeline stages, extension traits, and capability matrix when present)

This standard defines when and how SDKWork applications and services **must** integrate the `sdkwork-rpc-framework` repository. `RPC_SPEC.md` owns contract semantics. `DISCOVERY_SPEC.md` owns registry and config control plane behavior. This file owns **RPC runtime framework integration** for servers and approved RPC clients.

## 1. System Model

```text
sdkwork-specs (L0)
  RPC_SPEC.md + DISCOVERY_SPEC.md + RPC_RESILIENCE_SPEC.md
       -> narrows
sdkwork-specs/RPC_FRAMEWORK_SPEC.md (L0 integration mandate)
       -> narrows
sdkwork-rpc-framework/specs/RPC_FRAMEWORK_STANDARD.md (L1 executable profile)
       -> enforced by
sdkwork-rpc-framework crates (L2 runtime)
       -> extended by
business repositories: sdkwork-<domain>-rpc + service-host/api-server (L3)
```

Rules:

- The canonical SDKWork RPC application framework repository is `sdkwork-rpc-framework`.
- Any SDKWork repository that owns, serves, develops, or consumes SDKWork gRPC services across process boundaries `MUST` follow this standard for server binding and approved client invocation.
- Business repositories `MUST NOT` fork, copy, or reimplement the standard RPC interceptor chain, metadata normalization, resolver integration, resilience policy application, or secure defaults locally.
- `sdkwork-rpc-framework` `MUST NOT` depend on any business repository, business RPC server crate, application-owned proto authority, or application-owned RPC SDK family.
- Java gRPC backends do not cargo-depend on the Rust framework, but they `MUST` preserve equivalent interceptor order, metadata vocabulary, resolver behavior, and error semantics defined by `RPC_SPEC.md` and this file.

## 2. Mandatory Scope

The following artifacts `MUST` integrate `sdkwork-rpc-framework` or a language-equivalent approved profile:

| Artifact | Requirement |
| --- | --- |
| `sdkwork-<domain>-rpc-rust` or equivalent domain RPC server crate | Framework server pipeline, interceptor assembly, health/reflection registration |
| `sdkwork-<application-code>-service-host` when serving RPC | Framework bootstrap, discovery registration lifecycle, drain/shutdown |
| `sdkwork-<application-code>-api-server` when serving RPC alongside HTTP | Shared runtime wiring; separate listeners allowed |
| Internal/backend RPC client factories in service hosts | Framework client pipeline, resolver, metadata providers, resilience profile |
| Contract-only `apis/rpc/` sources | RPC manifests still declare `rpc_surface`, `discovery_service_name`, and `resilience_profile` when dynamic resolution is used |

Out of scope for mandatory framework integration:

- Browser UI packages that consume HTTP SDKs only
- Generated RPC SDK package source itself
- In-process trait/port calls inside one runtime container with no network hop
- `sdkwork-discovery` control-plane server implementation, which follows `DISCOVERY_SPEC.md` and may seed the framework reference implementation

These out-of-scope artifacts still `MUST NOT` introduce a competing RPC context or invocation framework when they call SDKWork RPC services.

## 3. Architecture Rule

SDKWork RPC development uses one architecture:

```text
requirement / ADR
  -> proto contract + RPC manifest + parity registry
  -> sdkwork-rpc-framework server/client helpers
  -> metadata/context/deadline/idempotency admission
  -> RPC adapter
  -> domain runtime/service/port dispatch
  -> typed proto response mapping
  -> generated RPC SDK or approved facade for remote callers
```

Rules:

- RPC adapters `MUST` call the same runtime/service/port boundary used by HTTP or Tauri adapters.
- RPC adapters `MUST NOT` call SQLx repositories, HTTP routers, or Tauri commands directly.
- UI packages and frontend services `MUST` consume generated HTTP SDKs unless gRPC-Web is explicitly approved.
- Service hosts `MUST` construct RPC clients during bootstrap and inject them into facades or backend services.

## 4. RPC Identity

SDKWork RPC identity is used consistently in logs, metrics, traces, audits, discovery metadata, manifests, and parity checks.

Canonical identity URI:

```text
sdkwork-rpc://{namespace}/{environment}/{rpc_surface}/{proto_package}/{Service}/{Method}?operationId={dotted.id}
```

Example:

```text
sdkwork-rpc://acme/production/internal/sdkwork.communication.internal.v1/RoomOrchestrationService/CreateRoom?operationId=rooms.create
```

Rules:

- `operationId` `MUST` match `RPC_SPEC.md` and `apis/rpc/parity-registry.yaml` when HTTP parity exists.
- `rpc_surface` `MUST` be one of `app`, `backend`, `internal`, `common`.
- Observability labels `MUST` use `proto_package`, `service`, `method`, `operationId`, and `rpc_surface` together. Free-form handler names are not a substitute for `operationId`.

## 5. Server Pipeline

Every SDKWork RPC server `MUST` execute the standard server stages in order:

| Stage | Responsibility |
| --- | --- |
| 1. Transport security | TLS/mTLS termination or approved local-only exemption |
| 2. Metadata normalization | Lowercase key handling, required key validation |
| 3. Deadline and cancellation | Honor `grpc-timeout` and context cancellation |
| 4. Trace propagation | Extract/inject `traceparent` and request id |
| 5. Auth and context resolution | App/backend/internal profile selection |
| 6. Idempotency admission | Validate `idempotency-key` and `x-request-hash` policy |
| 7. Authorization | Enforce method auth at runtime/service boundary |
| 8. Proto validation | Reject malformed or policy-violating payloads |
| 9. Operation dispatch | Map to `operationId` and domain runtime |
| 10. Error mapping | Map domain errors to gRPC status and SDKWork details |
| 11. Audit and metrics | Emit safe logs, metrics, and trace completion |

Rules:

- Stage order `MUST NOT` be reordered locally except through approved framework extension traits documented in the L1 framework standard.
- Authorization `MUST NOT` occur only in client SDKs.
- Internal RPC `MUST` reject caller-supplied tenant overrides that conflict with service identity resolution.

## 6. Client Pipeline

Every SDKWork internal/backend RPC client `MUST` execute the standard client stages in order:

| Stage | Responsibility |
| --- | --- |
| 1. Invocation context | Metadata providers, deadline, retry budget, caller identity |
| 2. Name resolution | `static`, `discovery`, or `composite` resolver |
| 3. Load balancing | Pick healthy target from resolver snapshot |
| 4. Transport | Shared channel/subchannel, TLS/mTLS, keepalive |
| 5. Call execution | Unary or streaming per manifest |
| 6. Resilience | Retry, timeout, circuit breaker per `RPC_RESILIENCE_SPEC.md` |
| 7. Observability | Trace, metrics, safe logging |

Rules:

- Business modules `MUST NOT` construct raw gRPC channels or stubs when a generated SDKWork RPC family exists.
- Missing RPC client capability `MUST` be fixed by updating proto and RPC manifest, then regenerating.
- Metadata providers for `authorization`, `access-token`, `traceparent`, `idempotency-key`, and `x-request-hash` `MUST` be injected through bootstrap infrastructure.

## 7. Resolver Integration

Resolver behavior is governed by `DISCOVERY_SPEC.md` and selected through framework config.

| Resolver | Use |
| --- | --- |
| `static` | Approved standalone loopback or documented fixed endpoints |
| `static-composite` | Unified-process topology tables |
| `discovery` | Default production dynamic resolution through `sdkwork-discovery` |
| `composite` | Discovery primary with static fallback only when migration policy allows |

Rules:

- Cloud and multi-instance production `MUST` use `discovery` or approved `composite` with discovery primary.
- Resolver output `MUST` filter `healthy_only` and `protocol = grpc` for internal orchestration unless a method documents otherwise.
- Watch-based cache refresh `SHOULD` be preferred over aggressive polling.

## 8. Bootstrap Integration

Service bootstrap `MUST` include RPC framework stages after runtime initialization and before accepting traffic.

Standard stage names:

```text
validate-rpc-contracts
initialize-rpc-framework
bind-rpc-services
register-discovery-instance
start-discovery-renew-loop
```

Shutdown stages:

```text
drain-rpc-servers
deregister-discovery-instance
stop-discovery-renew-loop
```

Rules:

- Bootstrap `MUST` build an RPC client inventory for every consumed RPC SDK family before feature services start.
- Discovery registration `MUST` occur only after RPC listeners are ready to serve.
- Shared modules `MUST` receive RPC clients through injection; they `MUST NOT` read RPC or discovery environment variables directly.

## 9. Generated RPC SDK Boundary

Generated RPC SDK integration follows `RPC_SDK_WORKSPACE_SPEC.md` and `SDK_SPEC.md`.

Rules:

- Generated RPC SDKs are transport packages, not business facades, unless an approved composed wrapper is documented.
- Framework client factories `MAY` wrap generated clients but `MUST NOT` hide request/response types needed by tests and observability.
- RPC SDK README examples `MUST` show framework/bootstrap wiring for metadata providers, resolver selection, deadline, and one unary call.

## 10. Language Profiles

### 10.1 Rust

Rust RPC integration `MUST` follow `RUST_RPC_SPEC.md` and depend on `sdkwork-rpc-framework` crates instead of assembling tonic middleware locally in domain crates.

### 10.2 Java

Java/Spring gRPC integrations `MUST`:

- preserve the server and client stage order from this spec;
- use framework-equivalent metadata and context types;
- use discovery resolver integration for production service hosts;
- keep business logic in services, not in generated stub subclasses.

A future `JAVA_RPC_SPEC.md` may narrow Java package layout; until then, this section is authoritative for Java RPC framework parity.

## 11. Dual-Protocol Parity

HTTP/OpenAPI and gRPC remain peer adapters over one runtime.

Rules:

- Shared operations `MUST` keep the same `operationId` and compatible auth/idempotency policy.
- `apis/rpc/parity-registry.yaml` `MUST` be updated when parity changes.
- Framework parity tests `SHOULD` verify HTTP and RPC adapters call the same runtime entrypoints for shared operations.

## 12. Security

RPC framework integration `MUST` follow `SECURITY_SPEC.md`.

Rules:

- App RPC uses the dual-token metadata model.
- Backend RPC uses backend/operator or service identity.
- Internal RPC `SHOULD` use mTLS in production.
- Reflection and health endpoints `MUST` follow environment policy.
- Framework `MUST NOT` log raw tokens, secrets, or high-cardinality user data.

## 13. Observability

Framework instrumentation `MUST` follow `OBSERVABILITY_SPEC.md`.

Rules:

- Server and client spans `MUST` include `proto_package`, `service`, `method`, `operationId`, `rpc_surface`, and gRPC status.
- Metrics `MUST` use the RPC metric names and label vocabulary from `OBSERVABILITY_SPEC.md`.
- Streaming methods `MUST` emit stream lifecycle metrics when enabled.

## 14. Verification

Every RPC framework integration change `MUST` verify:

- [ ] Server pipeline stages are assembled through the framework or approved language profile.
- [ ] Client calls use framework resolver and resilience profiles in production paths.
- [ ] Discovery register/renew/deregister lifecycle is tested when dynamic resolution is enabled.
- [ ] Metadata, deadline, idempotency, and error mapping tests pass.
- [ ] No forbidden dependency from RPC adapter crates to HTTP/Tauri adapters or direct SQLx storage.
- [ ] RPC identity URI fields are present in logs or trace attributes for at least one smoke test per surface.

## 15. External Baselines

- gRPC interceptors and middleware concepts: https://grpc.io/docs/guides/interceptors/
- gRPC keepalive: https://grpc.io/docs/guides/keepalive/
- OpenTelemetry RPC conventions: https://opentelemetry.io/docs/specs/semconv/rpc/
