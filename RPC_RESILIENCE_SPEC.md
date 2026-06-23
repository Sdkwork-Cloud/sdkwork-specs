# SDKWork RPC Resilience Standard

- Version: 1.0
- Scope: RPC deadlines, retries, retry budgets, circuit breaking, load-balancing interaction, graceful shutdown, streaming backpressure, and failure classification for SDKWork gRPC services and framework-integrated clients
- Related: `RPC_SPEC.md`, `RPC_FRAMEWORK_SPEC.md`, `DISCOVERY_SPEC.md`, `RUST_RPC_SPEC.md`, `DEPLOYMENT_SPEC.md`, `OBSERVABILITY_SPEC.md`, `SECURITY_SPEC.md`, `TEST_SPEC.md`
- Future consolidation: high-availability platform rules may later merge into `RELIABILITY_SPEC.md`; until that spec exists, this file is authoritative for RPC resilience

This document defines executable resilience rules for SDKWork RPC. `RPC_SPEC.md` declares idempotency and deadline requirements at the contract layer. `RPC_FRAMEWORK_SPEC.md` applies those rules in server and client pipelines. This file owns retry, budget, breaker, drain, and load-balancing policy profiles.

## 1. Normative Language

The words `MUST`, `MUST NOT`, `SHOULD`, `SHOULD NOT`, and `MAY` use RFC-style meaning.

## 2. Resilience Profiles

Resilience behavior is selected by named profile in RPC manifest, discovery effective config, or bootstrap config.

| Profile | Use |
| --- | --- |
| `rpc-default` | Standard internal unary orchestration |
| `rpc-read-only` | List/retrieve/query methods with no write side effects |
| `rpc-idempotent-write` | Manifest-marked idempotent commands |
| `rpc-critical-write` | Money-moving or security-sensitive writes; conservative retry |
| `rpc-stream` | Server/bidi streaming methods |
| `rpc-local-dev` | Loopback development only; relaxed retry with explicit env gate |

Rules:

- Production `MUST NOT` use `rpc-local-dev`.
- Methods `MUST` declare the profile in RPC manifest or generated SDK metadata.
- Profile changes that widen retry behavior are breaking for client safety and require migration evidence.

## 3. Deadlines And Cancellation

Rules:

- Every client call `SHOULD` set an explicit deadline.
- Servers `MUST` observe cancellation and stop work promptly.
- Default deadline `MAY` come from `SDKWORK_<APPLICATION_CODE>_RPC_DEFAULT_DEADLINE_MS` or discovery effective config.
- Cascading calls `MUST` use a child deadline shorter than the parent remaining budget.
- Servers `MUST NOT` keep database transactions open while waiting on downstream RPC or external providers.

## 4. Retry Policy

Retries are allowed only when the RPC manifest marks the method retryable or the method is naturally idempotent and documented.

### 4.1 Retryable gRPC Status Codes

Default retryable codes for approved profiles:

| gRPC status | Default retry |
| --- | --- |
| `UNAVAILABLE` | Yes for `rpc-default`, `rpc-read-only`, `rpc-idempotent-write` |
| `RESOURCE_EXHAUSTED` | Limited retry with backoff when server signals retryability |
| `DEADLINE_EXCEEDED` | No unless parent policy explicitly allows bounded hedging |
| `ABORTED` | Only when manifest documents safe replay |
| `INTERNAL` | No by default |
| `UNAUTHENTICATED`, `PERMISSION_DENIED`, `INVALID_ARGUMENT`, `NOT_FOUND`, `ALREADY_EXISTS`, `FAILED_PRECONDITION` | No |

Rules:

- Non-idempotent writes `MUST NOT` retry without `idempotency-key`.
- Retry count `MUST` be bounded.
- Backoff `SHOULD` use exponential delay with jitter.
- Retry decisions `MUST` respect remaining parent deadline.

### 4.2 Retry Budget

Rules:

- Each caller process `SHOULD` enforce a retry budget per target `service_name` to prevent retry storms.
- When the budget is exhausted, callers `MUST` fail fast with `UNAVAILABLE` or wrapped SDKWork error rather than unbounded retry.
- Budget exhaustion `MUST` emit metrics and logs with `service_name` and `operationId`.

## 5. Circuit Breaking

Rules:

- Framework clients `SHOULD` support circuit breakers per `service_name` or per `service_name + method` for hot paths.
- Breaker open state `MUST` fail fast without opening new connections.
- Half-open probes `SHOULD` use a single trial request before full recovery.
- Breaker thresholds `SHOULD` be configurable through discovery effective config.
- Breaker state changes `MUST` be observable through metrics.

## 6. Load Balancing And Health

Load balancing is performed after resolver output and before transport selection.

Supported algorithms:

| Algorithm | Use |
| --- | --- |
| `pick_first` | Local dev and single-instance static resolver |
| `round_robin` | Homogeneous internal services |
| `weighted` | Heterogeneous capacity or canary pools |
| `subset` | Large clusters; limit active connections per client |

Rules:

- Production discovery resolution `SHOULD` use `healthy_only = true`.
- Load balancers `MUST` remove instances that fail consecutive health or RPC handshake checks according to profile.
- Sticky routing `MAY` be used only when documented, for example watch stream stickiness to one discovery node.
- Weight and priority from discovery metadata `SHOULD` be honored when present.

## 7. Graceful Shutdown

Discovery-enabled RPC servers `MUST` follow:

```text
stop accepting new RPC
drain in-flight unary and streaming calls within drain timeout
deregister from discovery
stop renew loop
close listeners
```

Rules:

- Drain timeout `MUST` be configured and logged.
- Forced shutdown after timeout `MUST` be explicit in ops runbooks.
- Kubernetes or orchestrator preStop hooks `SHOULD` align with drain duration.
- Deregister `SHOULD` precede listener close so clients stop receiving new picks promptly.

## 8. Streaming Resilience

Streaming methods require explicit policies beyond unary defaults.

Rules:

- Server streams `MUST` support cancellation and heartbeat when idle beyond `heartbeat_interval`.
- Client streams and bidi streams `MUST` declare buffer limits and backpressure behavior in RPC manifest.
- Stream reconnect `MAY` resume only when manifest defines cursor/sequence resumption.
- Stream retries `MUST NOT` replay unacknowledged side effects without idempotency or deduplication policy.

## 9. Failure Classification

Callers `MUST` map failures using `RPC_SPEC.md` error table before applying resilience behavior.

Rules:

- Validation and auth failures `MUST NOT` trigger transport retry.
- Provider unavailable failures `MAY` trigger retry only within budget and idempotency policy.
- Clients `MUST` surface typed SDKWork errors to business code where generated SDK supports them.

## 10. Verification

Every resilience profile or framework resilience change `MUST` verify:

- [ ] Non-idempotent methods do not retry without idempotency metadata in tests.
- [ ] Retryable status whitelist matches manifest profile.
- [ ] Retry budget exhaustion fails fast in at least one integration test.
- [ ] Graceful shutdown test proves deregister and drain ordering when discovery is enabled.
- [ ] Streaming cancellation test passes for at least one approved stream method or framework stream fixture.
- [ ] Breaker open/half-open behavior is covered for at least one client factory test when breakers are enabled.

## 11. External Baselines

- gRPC retry guide: https://grpc.io/docs/guides/retry/
- Google SRE retry budget concepts: https://sre.google/sre-book/handling-overload/
- gRPC keepalive and connection management: https://grpc.io/docs/guides/keepalive/
