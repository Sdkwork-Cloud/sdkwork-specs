# Subject And Entity ID Standard

- Version: 1.0
- Scope: IAM principals, HTTP request context, SQL tenant/user scope, runtime business entity primary keys, and cross-boundary ID serialization
- Applies to: `sdkwork-iam`, `sdkwork-web-framework`, application route crates, repositories, OpenAPI contracts, generated SDKs, and database schemas that persist `tenant_id`, `organization_id`, or `user_id`

This document is the cross-cutting authority for **who the caller is** (subject scope) and **how entity IDs move** between JWT claims, HTTP JSON, domain models, and SQL `BIGINT` columns. It does not replace `DATABASE_SPEC.md` table design, `IAM_SPEC.md` auth policy, or `API_SPEC.md` OpenAPI shape rules; it binds them together so IAM, web-framework, and persistence layers agree on the same ID vocabulary.

## 1. ID Taxonomy

SDKWork uses multiple ID families. Do not reuse one family for another.

| ID family | Examples | Wire/storage shape | Primary use | MUST NOT be used for |
| --- | --- | --- | --- | --- |
| **Snowflake entity id** | `100001`, `4000382910274560001` | SQL `BIGINT` / Rust `i64`; HTTP JSON **string** | Runtime business primary keys (`id`), IAM `tenant_id` / `user_id`, SQL subject scope (`tenant_id`, `organization_id`, `user_id`) | Session correlation, request tracing, route identity |
| **Reserved stable id** | bootstrap admin `1`, catalog seed `9101` | Same as snowflake entity id when numeric | Official seeds, install baselines, cross-version reference repair | Ad hoc runtime user/tenant creation |
| **UUID / ULID public id** | `550e8400-e29b-41d4-a716-446655440000` | `string(36..64)` | External stable reference (`uuid` column), sync, compensation, cross-store linkage | IAM `iam_user.id` / `iam_tenant.id` primary keys for new entities |
| **Opaque correlation id** | `session-abc`, server request id | Opaque string | `session_id`, `request_id`, `trace_id`, idempotency keys where declared | SQL `tenant_id` / `user_id` columns |
| **Prefixed legacy opaque id** (retired) | `iamu_{uuid}`, `iamt_{uuid}`, `org_{...}`, `tenant_{...}` | Opaque string | Historical IAM rows only; subject to automatic repair | New IAM entity creation, new JWT claims, new SQL writes |
| **Business code / number** | `ORD-20260426-0001` | String | Human-readable business numbers (`business_no`, `code`) | Internal join keys unless explicitly modeled |
| **Route / operation id** | `app.ai.dashboard.overview` | Dotted string | Route manifests, OpenAPI `operationId`, SDK method identity | Database primary keys |
| **RPC identity URI** | `sdkwork-rpc://...` | URI string | RPC discovery and invocation identity | HTTP subject scope |

Rules:

- When a field name is `id`, `tenant_id`, `user_id`, `organization_id`, `owner_id`, `operator_id`, `created_by`, or `updated_by` on a runtime business table, it `MUST` use the **snowflake entity id** family unless an explicit reserved-stable-id exception is documented in the owning module contract.
- When a field name is `uuid`, `session_id`, `request_id`, `trace_id`, or `idempotency_key`, it `MUST NOT` be forced into snowflake semantics.
- New code `MUST NOT` invent additional prefixed opaque primary-key shapes such as `iamu_`, `iamt_`, `usr_`, or raw UUID strings for IAM tenant/user primary keys.

## 2. SQL Subject Scope

**SQL subject scope** is the tenant/user isolation tuple consumed by repositories that persist `BIGINT` subject columns.

| Field | SQL type | Parse rule | Semantics |
| --- | --- | --- | --- |
| `tenant_id` | `BIGINT` | Positive `int64` (`> 0`) | Active tenant for the authenticated principal |
| `organization_id` | `BIGINT` | `int64` (`>= 0`) | Active organization; `0` means tenant-level scope, not unknown |
| `user_id` | `BIGINT` | Positive `int64` (`> 0`) | Authenticated user or service-account subject mapped to a user row |

Rules:

- Protected app-api and backend-api handlers that query tenant-scoped SQL tables `MUST` resolve subject scope from `WebRequestContext` / `TenantAppContext` and map into native `i64` values before repository access.
- Handlers `MUST NOT` trust client-supplied `tenant_id`, `tenantId`, `user_id`, `userId`, or equivalent headers/parameters to choose ambient subject scope. Current scope comes from validated dual-token claims or validated API-key/OAuth context per `API_SPEC.md` and `IAM_SPEC.md`.
- Mapping failure because principal IDs are not positive numeric SQL subjects `MUST` fail closed with HTTP `422 Unprocessable Entity` and business code `4220`. It `MUST NOT` be reported as HTTP `500` or internal error code `5001`.
- Legacy opaque IAM ids in an otherwise authenticated principal `SHOULD` produce a `4220` message that tells the operator to restart IAM repair or sign in again after repair.

### 2.1 Projection Chain

Canonical projection for SQL-backed handlers:

```text
WebRequestContext.principal
  -> TenantAppContext (framework service view)
  -> SqlScopedSubject { tenant_id: i64, organization_id: i64, user_id: i64 }
  -> repository / SQL bind parameters
```

Legacy migration bridge (allowed only while handlers still extract `TrustedRequestSubject`):

```text
WebRequestContext.principal
  -> TrustedRequestSubject (legacy bridge)
  -> SqlScopedSubject
```

Rules:

- New handlers `SHOULD` consume `TenantAppContext` or an application `SqlScopedSubject` extractor wired from `WebRequestContext`.
- Legacy `TrustedRequestSubject` header projection exists only for migration. It `MUST` use the same numeric parse rules as SQL subject scope.
- Repositories `MUST NOT` parse JWTs or credential headers directly to obtain `tenant_id` / `user_id`.

## 3. IAM Entity IDs

IAM tables `iam_tenant.id`, `iam_user.id`, and matching JWT claims `tenant_id`, `user_id` / `sub` `MUST` be **positive numeric snowflake strings** generated by the platform ID provider.

| Entity | Column / claim | New-entity rule | Generator |
| --- | --- | --- | --- |
| Tenant | `iam_tenant.id`, claim `tenant_id` | Positive snowflake string | IAM snowflake provider (`sdkwork-id-core` profile) |
| User | `iam_user.id`, claim `user_id` / `sub` | Positive snowflake string | IAM snowflake provider |
| Organization | `iam_organization.id`, claim `organization_id` | Positive snowflake string or reserved `0` in tenant-level sessions | IAM/catalog seed policy |
| Session | `iam_session.id`, claim `session_id` / `sid` | Opaque string allowed | IAM session service |

Rules:

- Registration, directory user creation, OAuth first-login user creation, and admin-provisioned users `MUST` allocate snowflake ids at insert time.
- JWT parsers and IAM directory APIs `MUST` treat `tenant_id` and `user_id` as numeric strings at the HTTP boundary and native numeric types inside Rust/Java/SQL code.
- IAM `MUST NOT` issue new production tokens whose `tenant_id` or `user_id` uses retired opaque prefixes (`iamu_`, `iamt_`, `org_`, `tenant_`) or bare UUID strings.
- Documented bootstrap exceptions `MAY` use reserved stable numeric ids such as default bootstrap admin `user_id = "1"` when declared in the owning IAM bootstrap contract.

### 3.1 Legacy Opaque IAM IDs

Historical IAM deployments may still store:

- `iamu_{uuid}` user ids
- `iamt_{uuid}` tenant ids
- bare UUID strings that do not parse as positive `int64`

Rules:

- IAM bootstrap and IAM app-api pool initialization `SHOULD` run **legacy subject repair** that rewrites opaque `iam_user.id` values to snowflake ids and updates dependent FK tables (`iam_session`, `iam_credential`, `iam_tenant_member`, `iam_organization_membership`, role/group bindings).
- Bootstrap reserved ids such as default admin `1` `MUST` be preserved by repair logic.
- Applications `MUST` tolerate repair during startup; they `MUST NOT` assume old JWTs remain valid after repair. Users `MUST` sign in again to obtain tokens with repaired ids.
- Data keyed only by the pre-repair user id in non-IAM business tables is outside automatic IAM repair scope and `MAY` require an explicit business-data migration.

## 4. Runtime Business Entity IDs

Runtime business tables follow `DATABASE_SPEC.md` section 6.10:

- Primary key `id` `MUST` be explicit snowflake `BIGINT` assigned before `INSERT`.
- `tenant_id`, `organization_id`, and `user_id` scope columns `MUST` use the same positive/`>= 0` numeric semantics as SQL subject scope.
- Official install seeds and built-in catalog rows `MAY` use reserved stable ids instead of runtime snowflake allocation when required for install idempotency.

Rust implementations `SHOULD` use:

- `sdkwork_platform_id_service::SnowflakeIdGenerator` for general runtime entities
- IAM-owned snowflake node configuration for IAM entities when isolated node ids are required

## 5. Serialization Boundaries

| Boundary | `int64` / snowflake representation | Owner spec |
| --- | --- | --- |
| HTTP JSON request/response | `type: string`, `format: int64`, digit pattern, `x-sdkwork-int64-string: true` | `API_SPEC.md` |
| TypeScript / browser SDK | string compare and transport only | `API_SPEC.md`, `SDK_SPEC.md` |
| JWT claims `tenant_id`, `user_id`, `organization_id` | decimal digit strings in claim JSON | `IAM_SPEC.md` |
| Rust / Java / Go domain models | native `i64` / `long` / `int64` | `DATABASE_SPEC.md`, language specs |
| SQL columns | `BIGINT` bind parameters | `DATABASE_SPEC.md` |

Rules:

- Frontend and generated TypeScript SDKs `MUST NOT` parse snowflake ids into JavaScript `number`.
- Server HTTP adapters `MUST` parse inbound int64 strings once at the boundary, validate sign/range, then pass native numeric values inward.
- Internal Rust services `MUST NOT` store SQL subject scope as `String` merely because the browser JSON contract uses strings.

## 6. Error Semantics

| Condition | HTTP status | Business code | Meaning |
| --- | --- | --- | --- |
| Missing or invalid auth on protected route | `401` | `4010` or surface-specific auth code | Unauthenticated |
| Authenticated principal present but IDs cannot map to SQL subject scope | `422` | `4220` | Subject mapping failure |
| Legacy opaque IAM id still present in principal after auth | `422` | `4220` | Repair or re-login required |

Rules:

- `4220` is a client-actionable contract error, not a server fault. Do not map it to `500`/`5001`.
- Logs `MAY` include tenant/user id strings for diagnosis; they `MUST NOT` log signing keys or raw tokens.

## 7. Related Standards

| Topic | Authority |
| --- | --- |
| Snowflake profile, DDL `BIGINT` rules, reserved seed ids | `DATABASE_SPEC.md` §6.1, §6.3, §6.4, §6.10 |
| JWT claims, dual-token subject fields | `IAM_SPEC.md` §5.2 |
| `WebRequestContext`, `TenantAppContext` | `WEB_FRAMEWORK_SPEC.md` §5, §5.1 |
| OpenAPI int64 string rules, ban on client tenant selectors | `API_SPEC.md` |
| Identity lattice naming | `NAMING_SPEC.md` |
| Legacy IAM id repair rollout | `MIGRATION_SPEC.md` |

## 8. Verification Checklist

- [ ] New IAM users and tenants receive positive numeric snowflake string primary keys.
- [ ] JWT `tenant_id` and `user_id` claims match the IAM row ids and parse into positive SQL `BIGINT` values.
- [ ] Protected SQL handlers resolve subject scope from `WebRequestContext`, not raw headers or client parameters.
- [ ] Subject mapping failures return `422` / `4220`, not `500` / `5001`.
- [ ] OpenAPI and SDK expose snowflake ids as strings at the HTTP boundary only.
- [ ] Legacy opaque IAM ids are repaired on IAM startup or covered by an explicit migration plan.
- [ ] Reserved bootstrap ids remain stable across repair and upgrade.
