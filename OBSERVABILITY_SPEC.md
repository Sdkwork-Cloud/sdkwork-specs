# Observability Standard

- Version: 1.0
- Scope: logs, metrics, traces, audit correlation, diagnostics, HTTP/RPC runtime observability
- Related: `SECURITY_SPEC.md`, `RPC_SPEC.md`, `DRIVE_SPEC.md`, `EVENT_SPEC.md`, `TEST_SPEC.md`

Production behavior must be observable without leaking sensitive data.

## 1. Correlation

Rules:

- Every API request `SHOULD` have a `traceId` or correlation ID.
- Every appbase HTTP request `MUST` have a server-owned request id generated at the request framework boundary.
- Error responses `SHOULD` include `traceId`.
- Appbase problem responses `MUST` include the server-owned request id when available.
- Logs, metrics, traces, audit events, and security events `SHOULD` be correlated.
- Tenant and organization context may be logged only when allowed by security and privacy rules.

## 2. Logging

Rules:

- Logs `MUST` be structured in production services.
- Log fields `SHOULD` include timestamp, level, service, environment, traceId, requestId, operationId, route, API surface, interceptor stage, auth mode, status, duration, and safe tenant context.
- RPC logs `SHOULD` include proto package, service, method, operationId, gRPC status code, deadline, duration, and safe tenant context.
- Logs `MUST NOT` include raw tokens, API keys, access tokens, passwords, verification codes, secrets, private keys, or full sensitive payloads.
- API key logs may include key id, safe key prefix, source, and status only after server-side validation.

## 3. Metrics

Metrics must be stable operational contracts, not ad hoc dashboard fields.

Metric naming:

- Runtime/exported metric names `MUST` use lowercase snake case.
- Metric names `SHOULD` use the pattern
  `<app_or_domain>_<resource>_<operation>_<measure>_<unit>`.
- Counters `MUST` end in `_total` when exported to Prometheus-compatible
  systems.
- Duration metrics `MUST` express the unit in the name, usually
  `_duration_seconds`.
- Size metrics `MUST` express the unit in the name, such as `_bytes`.
- Boolean states should be represented as labels on counters or gauges, not as
  separate `*_true` and `*_false` metrics.
- Database projection metric names, such as `ops_metric_snapshot.metric_name`,
  must map to the same canonical runtime metric name or to a documented
  dashboard alias.

Required common labels:

| Label | Requirement |
| --- | --- |
| `service` | Stable process or service name. |
| `environment` | `development`, `test`, `staging`, or `production`. |
| `deployment_mode` | `desktop`, `server`, `container`, `saas`, `private`, `local`, or `test`. |
| `runtime_profile` | Backend/runtime profile, such as `postgresql`, `sqlite`, or `redis`, when the metric depends on infrastructure. |
| `operation_id` | OpenAPI/RPC operation id where available. |
| `route` | HTTP route template, not raw path. |
| `method` | HTTP method or RPC method. |
| `status` | Normalized HTTP status class/code or RPC status. |

Label rules:

- Labels `MUST` be low-cardinality and bounded.
- Labels `MUST NOT` include raw user ids, emails, phone numbers, tenant names,
  API keys, access tokens, prompt text, model input, file paths, object keys,
  signed URLs, SQL text, trace ids, request ids, or full IP addresses.
- Tenant or organization labels are allowed only when the deployment explicitly
  scopes metrics to a small bounded private environment; otherwise use safe
  aggregate dimensions or omit them.
- Dynamic model/provider/channel labels must use stable codes from the API or
  database contract. Free-form display names are not valid labels.
- High-cardinality diagnostics belong in traces, logs, or sampled exemplars,
  not metric labels.

Metric types:

- Request, job, retry, failure, auth failure, rate limit, cache hit/miss, and
  provider invocation counts are counters.
- In-flight requests, queue depth, pool usage, active sessions, and available
  capacity are gauges.
- Latency and duration measurements are histograms. Summaries are allowed only
  when the backend cannot aggregate histograms.
- Monetary values, usage units, and token counts that feed billing must be
  recorded as business facts first; metrics can expose aggregates but must not
  be the source of truth for billing.

Histogram guidance:

- HTTP/RPC latency histograms should use seconds and buckets appropriate for the
  operation class, for example `0.005`, `0.01`, `0.025`, `0.05`, `0.1`, `0.25`,
  `0.5`, `1`, `2.5`, `5`, and `10`.
- Provider and AI generation latency may add larger buckets, but the bucket set
  must be documented and stable for dashboards.
- Background job duration histograms may use coarser buckets, but must still use
  seconds.

Core API metrics:

- Request count by route, method, status.
- Request latency by route and method.
- Error count by code and status.
- Auth failure count.
- Rate limit count.
- API call-chain rejection count by interceptor stage and normalized error kind.
- Request context resolution count by API surface and auth mode.
- SDK generation/contract validation failures in CI.

Core RPC metrics:

- RPC request count by package, service, method, operationId, and gRPC status.
- RPC request latency by service and method.
- RPC deadline exceeded and cancellation count.
- RPC auth failure count.
- RPC health serving status.
- Proto lint, breaking-change, and generated-client validation failures in CI.

Core Drive metrics:

- Upload session count by state and policy.
- Upload completion latency and uploaded bytes by safe policy/provider class.
- Download grant count, expiry bucket, and denial count.
- Storage provider latency/error count by normalized Drive error kind.
- Quarantine, scan failure, retention delete, and reconciliation failure count.

Core database and runtime metrics:

- Database pool connections by state, backend profile, and service.
- Database query or transaction duration by repository/operation class, without
  raw SQL labels.
- Migration and seed counts by result and target version.
- Redis/cache command latency, errors, hits, misses, writes, deletes, and
  refreshes by safe namespace.
- Desktop-local SQLite metrics must use `runtime_profile=sqlite`.
- Desktop-started backend service metrics must use the backend service runtime
  profile, normally `runtime_profile=postgresql`.

Projection and dashboard metrics:

- Tables such as `ops_metric_snapshot` are dashboard projections. They are not
  the primary telemetry source.
- Snapshot rows must include metric scope, canonical name, period, time range,
  safe dimension key/value, value, and unit.
- Metric snapshots must be rebuildable from telemetry streams or durable
  business facts.
- Dashboard projections must not mix unrelated units in one metric name.
- Snapshot dimensions must follow the same low-cardinality and privacy rules as
  exported metric labels.

## 4. Tracing

Rules:

- Services `SHOULD` use OpenTelemetry-compatible trace concepts.
- Trace spans `SHOULD` include operationId, route template, deployment mode, and safe tenant scope.
- RPC trace spans `SHOULD` include proto package, service, method, operationId, gRPC status code, deployment mode, and safe tenant scope.
- Database spans must not include raw SQL with sensitive values.
- Drive spans must not include signed URLs, object keys, provider credentials, or raw file content.

## 5. Audit

Rules:

- IAM, billing, permission, key, tenant, and security operations `MUST` emit audit/security events.
- Audit entries `MUST` capture actor, action, resource, tenant, result, time, and traceId.
- Appbase audit entries `SHOULD` include server request id, API surface, auth mode, key id when API key mode is used, and safe tenant/organization/user context.
- Audit logs must not depend only on application console logs.

## 6. Acceptance Checklist

- [ ] Error responses include traceId.
- [ ] Logs are structured and redacted.
- [ ] Metrics cover route/status/latency/errors.
- [ ] Metrics use canonical names, explicit units, stable types, and bounded labels.
- [ ] Metric labels avoid secrets, PII, raw ids, raw paths, trace ids, and unbounded values.
- [ ] Histogram buckets and units are documented for HTTP/RPC/provider/job durations.
- [ ] Dashboard metric snapshots are rebuildable projections, not billing or audit facts.
- [ ] Sensitive operations emit audit events.
- [ ] Trace context propagates through service calls.
- [ ] RPC services propagate `traceparent` and report package/service/method/status metrics when RPC is enabled.
- [ ] Drive upload/download/provider metrics and traces are present without exposing signed URLs, object keys, or credentials.
