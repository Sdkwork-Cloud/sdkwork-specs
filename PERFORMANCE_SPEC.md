# Performance And Scalability Standard

- Version: 1.0
- Scope: API latency, frontend responsiveness, database query budgets, SDK behavior, rate limits, capacity planning
- Related: `API_SPEC.md`, `PAGINATION_SPEC.md`, `WEB_BACKEND_SPEC.md`, `DATABASE_SPEC.md`, `FRONTEND_SPEC.md`, `OBSERVABILITY_SPEC.md`, `TEST_SPEC.md`

This standard defines minimum performance discipline for reusable modules and shared APIs. Performance requirements must be explicit enough to test, monitor, and preserve across Java/Rust implementations, standalone/cloud deployment profiles, and supported runtime targets.

## 1. Performance Classes

| Class | Examples | Requirement |
| --- | --- | --- |
| P0 | Auth/session, tenant selection, current user, permission hints | Must be fast, cached safely, and monitored |
| P1 | Interactive CRUD and lists | Must have pagination, bounded filters, and predictable latency |
| P2 | Background jobs, reports, exports, AI generation | Must be asynchronous or explicitly long-running |
| P3 | Admin diagnostics, maintenance, migration | May be slower but must be bounded and observable |

Rules:

- Every reusable API resource `SHOULD` declare a performance class.
- P0/P1 APIs `MUST` avoid unbounded scans, unbounded response bodies, hidden N+1 calls, and in-process pagination (`PAGINATION_SPEC.md` §2).
- P2/P3 operations `SHOULD` use job resources, progress APIs, events, or callbacks instead of blocking interactive requests.
- Import, export, report generation, AI execution, media processing, provider synchronization, and other long-running operations that cannot meet the declared synchronous latency budget `MUST` use `API_SPEC.md` section 15.4 async command semantics instead of holding a normal HTTP request open.
- Web backend services and repositories `MUST` implement the declared performance class from the API contract. A fast OpenAPI contract with an unbounded repository query is not standards-compliant.

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
- Handler/controller code `MUST NOT` hide extra backend calls that materially change the operation budget, such as per-row provider calls or per-row SDK calls in a list response.
- Service/use-case code `SHOULD` make expansion and hydration behavior explicit in request parameters, operation documentation, or a separate subresource.

### 2.1 High-Concurrency List Budget

Rules:

- P0/P1 list memory `MUST` be proportional to `page_size`, not total matched rows.
- Inbox, messages, feeds, notifications, logs, and other fast-growing interactive lists `MUST` default to cursor/keyset pagination.
- Deep `OFFSET` on fast-growing tables is forbidden unless an approved bounded admin use case caps the page range.
- List metrics `MUST` expose latency, slow-query count, rows scanned or index-step cost where available, error rate, rate-limit hits, and saturation.

## 3. Database Budgets

Rules:

- High-frequency list queries `MUST` map to indexed access paths.
- Multi-tenant queries `MUST` include tenant isolation keys in query predicates and index design.
- Query plans for L2/L3 tables `SHOULD` be reviewed when new filters or sort orders are added.
- Large table migrations `MUST` have an online/expand-contract plan.
- Denormalized read models `SHOULD` declare source, freshness, rebuild, and drift detection.
- Repository methods used by P0/P1 operations `MUST` have bounded query shapes: explicit limit, indexed filter/sort path, and tenant/data-scope predicates where applicable.
- Repository methods `MUST NOT` perform authorization-blind broad reads and rely on service code to filter large result sets in memory.
- Repository list methods `MUST NOT` load unbounded result sets and paginate with `skip`/`take`/`slice` in service code; see `PAGINATION_SPEC.md`.
- Provider adapter calls inside P0/P1 service paths `MUST` be bounded, cached safely, batched, or moved to asynchronous workflows when they cannot meet the operation budget.

## 4. Frontend Budgets

Rules:

- Initial route render `SHOULD` avoid loading unrelated feature modules.
- Shared modules `SHOULD` be code-splittable when they include route-sized UI.
- P0 session/current-user calls `SHOULD` be cached with clear invalidation on logout, tenant switch, and permission change.
- UI lists `MUST` handle pagination or virtualization when item count can grow.
- Interactive UI lists `MUST` request server pages via SDK `cursor`/`page` parameters and `MUST NOT` use client-side `slice` over fully downloaded arrays (`PAGINATION_SPEC.md` §8).
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
- [ ] Web backend service/repository implementation enforces the same performance class, pagination, query bounds, and tenant/data-scope predicates as the API contract.
- [ ] No list/search path performs in-process full collect + slice (`PAGINATION_SPEC.md`).
- [ ] Frontend handles large lists and does not block the main thread.
- [ ] SDK retry/pagination behavior is safe.
- [ ] Metrics exist for latency, errors, rate limits, and saturation.
