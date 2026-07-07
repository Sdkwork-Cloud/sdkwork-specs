# Pagination Standard

- Version: 1.3
- Scope: HTTP list/search APIs, web backend services and repositories, database queries, in-memory projection/read models, generated HTTP SDKs, frontend list services, and verification gates
- Related: `API_SPEC.md` (§14.1, §16), `DATABASE_SPEC.md` (§20.5), `WEB_BACKEND_SPEC.md` (§12), `SDK_SPEC.md` (§4.2, §6), `PERFORMANCE_SPEC.md`, `FRONTEND_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md` (§9), `TEST_SPEC.md`, `CODE_REVIEW_SPEC.md`, `QUALITY_GATE_SPEC.md`

This standard defines the canonical SDKWork pagination contract and implementation rules across API, service, database, SDK, and client layers. It exists to prevent unbounded reads, process-memory pagination, and client-side slicing that cause OOM, latency spikes, and inconsistent list behavior under production load.

The canonical HTTP GET wire vocabulary is strict: multi-word query parameters use lower_snake_case. `page_size` is the only page-size query parameter. `pageSize` is reserved for JSON request bodies, response payloads, and language-level SDK models; it is not an HTTP query alias. New and pre-launch applications `MUST NOT` accept `pageSize`, `limit`, or any other pagination compatibility alias on HTTP list/search query strings.

## 1. Normative Language

The words `MUST`, `MUST NOT`, `SHOULD`, `SHOULD NOT`, and `MAY` are used with RFC-style meaning.

## 2. Core Prohibition: No In-Process Pagination

**In-process pagination** means loading, materializing, sorting, or filtering an unbounded or larger-than-page dataset in application memory and then selecting a page with `skip`, `take`, `slice`, `truncate`, `subList`, `Array.prototype.slice`, or equivalent helpers.

This pattern is **forbidden** for L2+ list/search APIs and their backing services because it:

- allocates memory proportional to total row count, not page size;
- hides missing database or index pagination behind a compliant-looking API surface;
- breaks under tenant growth and causes OOM or GC pressure in Rust/Java/Node runtimes;
- encourages frontend `listAll*` helpers that amplify the same failure mode.

### 2.1 Forbidden Patterns

The following `MUST NOT` appear in production list/search paths unless a documented L0/L1 migration exception exists with removal plan and risk register entry:

| Layer | Forbidden pattern | Example smell |
| --- | --- | --- |
| Repository / SQL | Unbounded `SELECT` then slice in service code | `find_all()` → `items.skip(offset).take(limit)` |
| Service / domain | Full `collect()` then window helper on `Vec` | `repo.list_all().await?.into_iter().skip(n).take(m)` |
| Projection / runtime store | Rebuild full collection per request then slice | `build_inbox_vec(principal)` → `list_window(vec, limit, cursor)` |
| HTTP handler | Accept `limit`/`cursor` but paginate an in-memory `Vec` built from full scan | handler passes `limit` only after `collect::<Vec<_>>()` |
| SDK consumer / frontend service | Aggregate all pages or use high default `page_size` then slice locally | `listAllContacts()` → `contacts.slice(start, end)` |
| SDK helper | Auto-fetch every page by default for interactive UI | `client.users.listAll()` without explicit operator opt-in |
| Projection helper | Per-request rebuild of full `BTreeMap`/`Vec` then `offset_limit_page_from_iter` | `collect_inbox_entries()` each HTTP request → `offset_limit_page_from_iter(sorted.into_values(), …)` |
| Directory/search helper | Over-fetch `limit * N` then filter/`take` in service | `list_members_window(limit*4)` → `.filter(q).take(limit)` |
| Batch maintenance | Collect all stale keys then `take(batch_limit)` without index iteration | presence expiration: `collect::<Vec<_>>()` of all stale keys → `take(1024)` |

### 2.2 Required Behavior

Every L2+ list/search operation `MUST`:

1. declare standard pagination input per `API_SPEC.md` §14.1 (`page`/`page_size` or `cursor`/`page_size`, plus typed filters);
2. return `SdkWorkApiResponse.data.items` and `data.pageInfo` per `API_SPEC.md` §16;
3. bound work and memory to **O(page size)** for the response payload, plus **O(log n)** or better indexed seek cost where a total-count or deep offset is not required;
4. push filtering, sorting, and page selection as close to the authoritative store as possible: SQL/keyset first, maintained index second, never unbounded process memory last.

Facade APIs `MUST NOT` claim database pagination while delegating to a service that materializes the full result set.

### 2.3 Per-Request Rebuild Is Not Index Pagination

Calling `offset_limit_page_from_iter` or `BTreeMap::range` **after** rebuilding an unbounded projection for every list request is **forbidden** for P0/P1 interactive APIs. The helper only legalizes bounded window extraction when the backing iterator comes from an **incrementally maintained** index updated on write (favorites, friend-request inventory, contact tag index), not from a full-scope scan assembled per request (inbox/contacts projection paths).

Reviewers `MUST` block code that:

1. scans all memberships, conversations, or scopes for a principal on each list request;
2. inserts results into a fresh `BTreeMap`/`Vec`;
3. pages with `offset_limit_page_from_iter` or `skip`/`take` and claims index-backed pagination.

Remediation: maintain per-principal/per-scope sorted indexes on projection events, or move the list authority to SQL/keyset storage.

### 2.4 Legacy Wire Aliases

Only already-launched L0/L1 authorities with real external consumers may temporarily expose pagination aliases, and only with a migration plan, owner, removal milestone, and risk register entry. These aliases are **technical debt**, not alternate standards. New APIs and pre-launch applications `MUST NOT` introduce or retain them.

| Legacy wire | Canonical meaning | Migration |
| --- | --- | --- |
| `pageSize` query param | `page_size` | Forbidden for new/pre-launch APIs; remove from OpenAPI, handlers, SDK wire serializers, tests, and docs |
| `limit` query param | `page_size` | Only already-launched L0/L1 authorities may keep it until the approved OpenAPI/SDK migration closes |
| numeric `cursor` (`"0"`, `"20"`, …) | offset mode `page` equivalent | Replace with opaque keyset cursor or explicit `page`/`page_size` per `API_SPEC.md` §14.1 |
| `hasMore` + `nextCursor` without `pageInfo.mode` | partial envelope | Align response to `SdkWorkPageData` + `PageInfo.mode` |

New list APIs `MUST NOT` introduce numeric offset cursors unless documented as offset mode with a removal milestone in `MIGRATION_SPEC.md`.

### 2.5 Batch And Maintenance Sweeps

Background expiration, reconciliation, or export jobs `MAY` scan bounded batches from maintained indexes using early `take(batch_limit)` on sorted iterators. They `MUST NOT` materialize unbounded stale-key or stale-row collections when the store already provides sorted index iteration (`BTreeSet`, `BTreeMap`).

Interactive list APIs remain subject to §2 regardless of job context.

## 3. Pagination Modes

SDKWork supports two standard modes. Mode selection is part of the API contract and `MUST` be documented per operation.

| Mode | Wire input | `pageInfo.mode` | Preferred use |
| --- | --- | --- | --- |
| Offset | `page`, `page_size` | `offset` | Admin tables, low-volume stable lists, exact `totalItems` |
| Cursor | `cursor`, `page_size` | `cursor` | High-volume feeds, inbox, messages, logs, notifications, unstable lists |

Rules:

- `page` and `cursor` `MUST NOT` be combined in one request.
- `page_size` `MUST` default to `20` and `MUST NOT` exceed `200` unless a documented L3 exception defines a lower ceiling.
- HTTP GET list/search contracts and handlers `MUST NOT` accept `pageSize`, `limit`, `page_no`, `pageNo`, `per_page`, `size`, or equivalent aliases for `page_size` or `page`.
- Cursor tokens `MUST` be opaque to clients. Clients `MUST NOT` parse or construct cursor payloads.
- Stable sorts `SHOULD` include a unique tie-breaker such as `id` or `createdAt`.
- Offset mode on large or fast-growing tables `SHOULD` be avoided; prefer cursor/keyset mode per `DATABASE_SPEC.md` §20.5.

Authority for wire names, schema shapes, and examples: `API_SPEC.md` §14.1 and §16.

## 4. API Contract Rules

OpenAPI list/search operations `MUST`:

- use shared `SdkWorkListQuery`, `SdkWorkPageData`, and `PageInfo` components from `templates/openapi/components/`;
- declare HTTP GET page-size parameters with wire name `page_size` only. OpenAPI query parameters named `pageSize`, `limit`, `page_no`, `pageNo`, `per_page`, `size`, or equivalent aliases are forbidden for SDKWork-owned business APIs;
- keep `limit` only for already-launched L0/L1 authorities with real external consumers and an approved migration plan. New and pre-launch SDKWork-owned APIs `MUST NOT` declare `limit`;
- document supported filters, sort keys, default sort, pagination mode, and maximum practical volume class (P0/P1/P2 per `PERFORMANCE_SPEC.md`);
- avoid unbounded list operations; bounded-by-design collections `MAY` omit pagination only when cardinality is documented ≤ 100 and enforced by product contract.

List/search handlers `MUST` map request pagination parameters to repository or index window parameters before any unbounded read occurs.

## 5. Service And Repository Implementation

Web backend services and repositories `MUST` implement the same pagination mode and bounds declared in the API contract.

### 5.1 Repository Layer

Repository list methods `MUST`:

- accept explicit `limit` and either `offset` or cursor/keyset continuation parameters;
- include tenant isolation and data-scope predicates in the query, not in post-filter memory;
- use database `LIMIT` / keyset predicates for persisted data;
- avoid `find_all`, `select *` without `LIMIT`, or ORM equivalents on unbounded tables for P0/P1 list APIs.

Repository methods `MUST NOT`:

- return unbounded `Vec`, `List`, `Stream` consumption into memory for P0/P1 interactive lists;
- rely on service-layer authorization filtering of a broad read when the query could have been narrowed in SQL.

### 5.2 Service / Use-Case Layer

Service code `MUST`:

- pass pagination parameters through to repositories or maintained indexes;
- validate `page_size` before query execution;
- map repository windows to `SdkWorkPageData` through `sdkwork-web-framework` response helpers.

Service code `MUST NOT`:

- call repository "load everything" helpers for paginated endpoints;
- sort unbounded in-memory collections per request when the sort key is declared in the API contract and should be indexed;
- build intermediate `Vec` collections larger than `page_size + 1` solely to detect `hasMore`, except in approved test fixtures.

### 5.3 In-Memory Projection And Runtime Stores

Some SDKWork services use in-memory projection stores, actor state, or test/runtime inventories instead of SQL for specific read models. These paths are not exempt from this standard.

Rules:

- projection/read-model list endpoints `MUST` maintain **incrementally updated sorted indexes** (`BTreeMap`, `BTreeSet`, or equivalent) keyed by the API sort contract;
- list operations `MUST` page by iterating the index with bounded `skip`/`take` or key-range selection without first materializing the full logical collection into a new `Vec` each request;
- rebuilding an unbounded projection for every list request `MUST NOT` be followed by in-process slicing as the pagination strategy; fix the projection lifecycle or move pagination to SQL/keyset storage instead.

Acceptable helper pattern for maintained indexes:

```rust
// Bounded window over an indexed iterator — index maintained on write, not rebuilt per request.
let page = offset_limit_page_from_iter(index.iter().map(map_row), page_size, offset);
```

Unacceptable pattern:

```rust
// Forbidden for production list APIs.
let all = store.values().cloned().collect::<Vec<_>>();
let page = all.into_iter().skip(offset).take(limit).collect::<Vec<_>>();
```

## 6. Database Query Rules

Database list queries `MUST` follow `DATABASE_SPEC.md` §20.5 and this section.

| Scenario | Required approach |
| --- | --- |
| Persisted table list (default) | SQL `LIMIT` with indexed `WHERE` / `ORDER BY`; cursor mode uses keyset predicates |
| Large/fast-growing table | Keyset / seek pagination on `(sort_field, id)`; avoid deep `OFFSET` |
| Exact totals for admin offset mode | `COUNT(*)` or maintained counter with same filter predicates; count query must be bounded or cached, not implied by loading all rows |
| Search with ranking | Search engine or SQL window with bounded `LIMIT`; no full-table fetch into app memory |

Rules:

- every list query contract `MUST` declare filter fields, sort fields, pagination mode, max `page_size`, and tenant boundary before indexes are designed;
- `OFFSET` pagination `SHOULD` be limited to small tables, low-frequency admin screens, or capped page ranges;
- query plans for new list filters or sorts `SHOULD` be reviewed for index coverage;
- DB027 (`对外 API 限制最大 page size`) and DB026 (`列表查询有排序和分页契约`) apply to all new persistence-backed lists.

## 7. SDK Generation And Consumption

Generated HTTP SDKs and composed facades `MUST` follow `SDK_SPEC.md` and this section.

Rules:

- list/search methods `MUST` accept standard query parameters or typed `SdkWorkListQuery` bodies and return unwrapped `{ items, pageInfo }` by default;
- generated SDKs may expose language-idiomatic option fields such as `pageSize`, but their HTTP transport `MUST` serialize GET list/search requests as `page_size`; generated operation metadata `MUST NOT` name query parameters `pageSize`, `limit`, `page_no`, `pageNo`, `per_page`, or `size`;
- generated SDKs `MUST NOT` expose default `listAll*` or unbounded auto-pagination helpers for P0/P1 interactive resources;
- explicit "fetch all pages" helpers `MAY` exist only when named to signal cost (`listAllPages`, `iterateAll`, etc.), documented as export/batch-only, and disabled by default in UI service facades;
- SDK consumers `MUST` pass through `pageInfo.nextCursor` or increment `page` until `hasMore` is false; they `MUST NOT` request `page_size=200` (or max) repeatedly as a substitute for proper UI pagination unless performing an approved one-off migration/export script.

## 8. Frontend And Client Consumption

Frontend feature services and UI lists `MUST` follow `FRONTEND_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, and this section.

Rules:

- interactive UI lists `MUST` request one page at a time from the server using standard pagination parameters;
- frontend services `MUST NOT` hand-build `pageSize`, `limit`, `page_no`, `pageNo`, `per_page`, `size`, or numeric-cursor compatibility query strings; use generated SDK clients or canonical `page_size` wire names only;
- UI `MUST` render `pageInfo.hasMore`, `nextCursor`, or page controls from server metadata;
- client-side `slice`, manual offset math, or virtual "page" indexes over a fully downloaded array `MUST NOT` implement server-backed list pagination;
- `listAll*` aggregation helpers `MUST NOT` be used to populate standard paginated tables or infinite-scroll feeds; reserve them for explicit bulk export/admin scripts with progress and cancellation;
- infinite scroll `SHOULD` request the next cursor/page on demand, not prefetch unbounded item arrays into memory.

## 9. Shared Platform Utilities

Applications `SHOULD` reuse shared pagination helpers instead of copying offset/cursor parsing and `PageInfo` construction.

| Runtime | Utility | Use |
| --- | --- | --- |
| Rust HTTP services | `sdkwork-utils-rust::http_api::{parse_offset_list_cursor, offset_limit_page_from_iter, offset_limit_page_info, OffsetLimitPage}` | Bounded offset-window over **indexed** iterators; `PageInfo` mapping |
| Rust HTTP services | `sdkwork-web-framework` response mapping | Serialize `SdkWorkPageData` inside `SdkWorkApiResponse` |
| TypeScript/Java/etc. | Generated SDK `{ items, pageInfo }` unwrap | Consumer services must not parse envelopes manually |

Shared helpers do not make in-process pagination acceptable. They only standardize bounded window extraction once the data source is already index-backed or SQL-bounded.

## 10. Verification And Review Gates

### 10.1 Required Evidence

Pagination work is not complete without:

- OpenAPI list operation using `SdkWorkListQuery` / standard query params and `SdkWorkPageData` output;
- service/repository test proving a requested page returns only `page_size` rows without loading total collection size into memory;
- rejection test for `page_size > 200` (`40003 INVALID_PARAMETER`);
- rejection tests for forbidden pagination aliases (`pageSize`, `limit`, `page_no`, `pageNo`, `per_page`, `size`, and numeric cursor aliases where cursor mode is declared);
- frontend or SDK consumer test proving UI/service uses server `cursor`/`page` rather than local slicing for the same resource;
- performance class declaration for P0/P1 lists per `PERFORMANCE_SPEC.md`.

### 10.2 Static Review Smells

Reviewers `MUST` block merges that introduce or retain:

- `collect::<Vec<_>>()` or `toList()` on unbounded repository results before `skip`/`take`/`slice`;
- per-request projection rebuild (`collect_inbox_*`, `collect_contacts_*`) followed by `offset_limit_page_from_iter` (§2.3);
- helper names such as `list_window(items: Vec<_>, ...)`, `listAll*`, `fetchAll*` on P0/P1 interactive paths without export-only documentation;
- OpenAPI list operations missing `pageInfo`, missing `PageInfo.mode`, missing `page_size` bounds, or declaring forbidden `pageSize`/`limit`/`page_no`/`pageNo`/`per_page`/`size` query parameters;
- frontend table data sources that call `slice` on SDK arrays larger than one page for normal browsing.

Automated gate (heuristic):

```bash
node sdkwork-specs/tools/check-pagination.mjs --workspace <sdkwork-space-or-repo-root>
```

### 10.3 Acceptance Checklist

- [ ] API contract declares mode (`offset` or `cursor`), defaults, max `page_size`, filters, and sort keys.
- [ ] HTTP GET list/search contracts use `page_size` only; no `pageSize`, `limit`, `page_no`, `pageNo`, `per_page`, or `size` query aliases remain.
- [ ] Handler maps pagination params before any unbounded read.
- [ ] Repository/query uses SQL `LIMIT` or keyset predicates, or maintained in-memory index windows.
- [ ] No production path materializes full tenant/user collection then slices in process.
- [ ] SDK list methods return `{ items, pageInfo }`; no default unbounded auto-fetch.
- [ ] Frontend interactive lists request pages from server; no client `slice` pagination.
- [ ] Tests cover page boundaries, empty page, invalid `page_size`, and `hasMore`/`nextCursor` continuity.
- [ ] `node sdkwork-specs/tools/check-pagination.mjs --workspace <root>` passes for touched repositories.
- [ ] `node sdkwork-specs/tools/check-api-response-envelope.mjs --workspace <root>` passes when OpenAPI changed.

## 11. Bounded Collections And Exceptions

A list operation `MAY` omit pagination only when all are true:

- documented maximum cardinality ≤ 100 per authorized scope;
- enforced by schema, product rule, or IAM scope — not by hope;
- response size stays within P0/P1 latency budgets in `PERFORMANCE_SPEC.md`;
- exception is recorded in the API authority description and reviewed in code review.

L0/L1 legacy endpoints that still perform in-process pagination `MUST` have a migration entry in `MIGRATION_SPEC.md` with target mode, owner, and removal milestone. New endpoints `MUST NOT` add new in-process pagination debt.

## 12. Pre-Launch Application Zero-Debt Rule

Applications that have not yet shipped to production (`pre-launch`) have no consumers to be backward compatible with. They `MUST NOT` carry any pagination technical debt:

- No `pageSize` wire aliases in query parameters - `pageSize` is valid only in JSON request bodies, response bodies, and language-level SDK models.
- No legacy `limit` wire aliases in query deserializers — `page_size` only from first release.
- No compatibility query aliases such as `page_no`, `pageNo`, `per_page`, `size`, or equivalent pagination synonyms.
- No numeric offset strings as `cursor` — use opaque keyset cursors or explicit `page`/`page_size` per §3.
- No `OFFSET` pagination on high-volume or fast-growing tables — use keyset/seek pagination per §6.
- No deprecated pagination helper functions (`bounded_sql_list_page`, `limited_list_page`, `resolve_list_page`, `sql_fetch_offset`, or equivalent) in production code paths.
- No legacy wire code mappers (`legacy_wire_result_code`, `legacy_wire_*`, or equivalent) for pagination-related error codes.
- No migration exception entries in `MIGRATION_SPEC.md` for pagination — all list/search APIs `MUST` use canonical `page_size` and keyset/cursor pagination from first release.
- No dual-parse compatibility branches for pagination query strings in handlers, shared utilities, SDK transports, frontend services, or tests.
- No `x-request-id` header fallbacks for `traceId` — use `X-SdkWork-Trace-Id` or server-generated `traceId` only per `API_SPEC.md` §17.
- No `hasMore` + `nextCursor` without `pageInfo.mode` — all list responses `MUST` include `PageInfo.mode` per §3.

Pre-launch applications `MUST` clear all pagination debt before first production release. The pagination debt register (`PAGINATION-DEBT-REGISTER.md` or equivalent) `MUST` show zero residual items for pre-launch applications.

### 12.1 Verification For Pre-Launch Applications

Pre-launch applications `MUST` pass:

```bash
node <sdkwork-specs>/tools/check-pagination.mjs --workspace <workspace-root>
node <sdkwork-specs>/tools/check-api-response-envelope.mjs --workspace <workspace-root>
```

with zero warnings related to pagination query aliases (`pageSize`, `limit`, `page_no`, `pageNo`, `per_page`, `size`), numeric cursor aliases, OFFSET pagination, deprecated helpers, in-process pagination, client-side slicing, or missing `pageInfo.mode`. Pre-launch verification `MUST NOT` use `--allow-known-debt`.

## 13. Cross-Reference Summary

| Topic | Authority |
| --- | --- |
| Wire query params and list input bodies | `API_SPEC.md` §14.1 |
| `PageInfo`, `SdkWorkPageData`, examples | `API_SPEC.md` §16 |
| Index and SQL pagination strategy | `DATABASE_SPEC.md` §20.5, DB026, DB027 |
| Handler/service/repository layering | `WEB_BACKEND_SPEC.md` §12 |
| SDK unwrap and helper policy | `SDK_SPEC.md` §4.2, §6 |
| Latency/page-size budgets | `PERFORMANCE_SPEC.md` §2–§3 |
| Frontend list behavior | `FRONTEND_SPEC.md` §9 |
| App SDK consumer list services | `APP_SDK_INTEGRATION_SPEC.md` §9 |
| Contract and integration tests | `TEST_SPEC.md` |
