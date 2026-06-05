# Performance And Scalability Standard

- Version: 1.0
- Scope: API latency, frontend responsiveness, database query budgets, SDK behavior, rate limits, capacity planning
- Related: `API_SPEC.md`, `DATABASE_SPEC.md`, `FRONTEND_SPEC.md`, `OBSERVABILITY_SPEC.md`, `TEST_SPEC.md`

This standard defines minimum performance discipline for reusable modules and shared APIs. Performance requirements must be explicit enough to test, monitor, and preserve across SaaS Java and Rust local/private implementations.

## 1. Performance Classes

| Class | Examples | Requirement |
| --- | --- | --- |
| P0 | Auth/session, tenant selection, current user, permission hints | Must be fast, cached safely, and monitored |
| P1 | Interactive CRUD and lists | Must have pagination, bounded filters, and predictable latency |
| P2 | Background jobs, reports, exports, AI generation | Must be asynchronous or explicitly long-running |
| P3 | Admin diagnostics, maintenance, migration | May be slower but must be bounded and observable |

Rules:

- Every reusable API resource `SHOULD` declare a performance class.
- P0/P1 APIs `MUST` avoid unbounded scans, unbounded response bodies, and hidden N+1 calls.
- P2/P3 operations `SHOULD` use job resources, progress APIs, events, or callbacks instead of blocking interactive requests.

## 2. API Budgets

Default targets for production-like environments:

| Metric | P0 | P1 | P2/P3 |
| --- | --- | --- | --- |
| p95 latency | <= 300 ms | <= 800 ms | documented per operation |
| max page size | 100 | 200 | documented |
| default page size | 20-50 | 20-100 | documented |
| request timeout | <= 10 s | <= 30 s | documented |

Rules:

- List APIs `MUST` have pagination or explicit bounded cardinality.
- Search/filter APIs `MUST` document supported filters and sort keys.
- Expensive commands `SHOULD` support idempotency keys.
- API responses `SHOULD` avoid embedding large related collections; use subresources or explicit expansion.

## 3. Database Budgets

Rules:

- High-frequency list queries `MUST` map to indexed access paths.
- Multi-tenant queries `MUST` include tenant isolation keys in query predicates and index design.
- Query plans for L2/L3 tables `SHOULD` be reviewed when new filters or sort orders are added.
- Large table migrations `MUST` have an online/expand-contract plan.
- Denormalized read models `SHOULD` declare source, freshness, rebuild, and drift detection.

## 4. Frontend Budgets

Rules:

- Initial route render `SHOULD` avoid loading unrelated feature modules.
- Shared modules `SHOULD` be code-splittable when they include route-sized UI.
- P0 session/current-user calls `SHOULD` be cached with clear invalidation on logout, tenant switch, and permission change.
- UI lists `MUST` handle pagination or virtualization when item count can grow.
- Desktop/native modules `SHOULD` avoid blocking the main UI thread for file, process, or local backend calls.

## 5. SDK Behavior

Rules:

- SDKs `SHOULD` expose timeout, retry, abort/cancel, and request-id options when the language supports them.
- SDK retries `MUST` be disabled or conservative for non-idempotent operations unless idempotency keys are used.
- SDK pagination helpers `SHOULD` preserve page boundaries and must not auto-fetch unbounded datasets by default.
- SDK error types `SHOULD` expose status, problem type, error code, traceId, and retryability.

## 6. Capacity And Quotas

Rules:

- Tenant-level quotas `SHOULD` be explicit for storage, API rate, concurrent jobs, integrations, and AI workloads.
- Rate limits `MUST` protect login, verification, password reset, token refresh, expensive search, exports, and provider callbacks.
- Quota/rate-limit responses `MUST` use standard problem details and safe retry metadata.
- Capacity assumptions for L3 domains `SHOULD` be recorded with expected tenant count, users per tenant, rows per tenant, and growth rate.

## 7. Acceptance Checklist

- [ ] API has pagination/bounded response design.
- [ ] Expected latency and timeout behavior are documented.
- [ ] Database access path and tenant index strategy are clear.
- [ ] Frontend handles large lists and does not block the main thread.
- [ ] SDK retry/pagination behavior is safe.
- [ ] Metrics exist for latency, errors, rate limits, and saturation.
