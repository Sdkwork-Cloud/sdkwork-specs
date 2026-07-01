# Migration Standard

- Version: 1.0
- Scope: API migration, database migration, SDK migration, config migration, package migration, route migration, compatibility windows, rollback
- Related: `RPC_SPEC.md`, `RPC_SDK_WORKSPACE_SPEC.md`, `RPC_FRAMEWORK_SPEC.md`, `DISCOVERY_SPEC.md`, `SDK_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md`, `DATABASE_SPEC.md`, `CONFIG_SPEC.md`, `ENVIRONMENT_SPEC.md`, `APPLICATION_SPEC.md`, `COMPONENT_SPEC.md`, `TEST_SPEC.md`, `DOCUMENTATION_SPEC.md`

This standard defines how SDKWork changes existing contracts without breaking consumers unexpectedly.

## 1. Migration Authority

Rules:

- API compatibility follows `API_SPEC.md`.
- RPC compatibility follows `RPC_SPEC.md`.
- RPC resolver migrations from static endpoints to `sdkwork-discovery` MUST record compatibility window, rollback, affected `service_name` values, and client resolver profile changes in the migration plan.
- Discovery storage or auth policy changes MUST follow `DISCOVERY_SPEC.md` and include rollback evidence.
- SDK compatibility follows `SDK_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md`, and `RPC_SDK_WORKSPACE_SPEC.md` when RPC SDKs are touched.
- Database compatibility follows `DATABASE_SPEC.md`.
- Runtime config compatibility follows `CONFIG_SPEC.md` and `ENVIRONMENT_SPEC.md`.
- Package/component ownership follows `APPLICATION_SPEC.md`, `MODULE_SPEC.md`, and `COMPONENT_SPEC.md`.
- Breaking migrations require `GOVERNANCE_SPEC.md` approval.

## 2. Migration Plan

Required for non-trivial migration:

```yaml
id: MIG-2026-0001
owner: team-or-person
status: proposed | active | blocked | completed | rolled-back
requirement: REQ-2026-0001
type: api | rpc | sdk | database | config | package | route | release | mixed
scope:
  producers:
    - package-or-service
  consumers:
    - app-or-sdk-or-service
compatibility_window:
  starts_at: YYYY-MM-DD
  ends_at: YYYY-MM-DD
strategy: expand-contract | parallel-run | dual-write | adapter | cutover | no-compatibility-approved
rollback:
  supported: true
  steps:
    - concrete rollback step
verification:
  - command or checklist
```

Rules:

- The plan must name producers and consumers.
- Compatibility windows must have dates or release versions.
- No-compatibility migrations require explicit governance approval.
- Migration plans must not rely on hidden local conventions.

## 3. Strategies

| Strategy | Use |
| --- | --- |
| expand-contract | add new field/table/API/SDK surface while old surface remains valid |
| parallel-run | old and new paths run side by side until evidence supports cutover |
| dual-write | writes populate old and new storage/contracts during transition |
| adapter | compatibility wrapper maps old consumers to new implementation |
| cutover | move consumers after readiness checks |
| no-compatibility-approved | explicitly approved break with clear release communication |

Rules:

- Prefer expand-contract for API, SDK, and database changes.
- Contracting old fields, operations, tables, package names, route ids, or config keys happens only after consumers are migrated and evidence exists.
- Dual-write requires idempotency, reconciliation, and rollback behavior.
- Adapters must have removal dates.

## 4. Contract Migration

Rules:

- Deprecated API/RPC operations must be marked by the owning contract and documented for generated SDKs.
- RPC SDK migrations MUST name proto package, service, method, message, field, generated language package versions, affected consumers, compatibility window, and rollback or forward-fix plan.
- SDK aliases or compatibility facades must be marked deprecated and tied to removal criteria.
- Generated SDK output must not be edited by hand to create compatibility.
- Route ids and i18n keys should remain stable across client migrations unless a route migration plan exists.
- Public naming migrations require `NAMING_SPEC.md` and governance review.

### 4.1 HTTP Framework Migration

Rules:

- Repositories migrating from `sdkwork-platform-http-context-service` or other appbase-local HTTP context frameworks to `sdkwork-web-framework` must follow `WEB_FRAMEWORK_SPEC.md` and the framework migration guide at `../sdkwork-web-framework/docs/10-migration-from-appbase.md`.
- During migration, `AppRequestContext` may remain as a type alias for `WebRequestContext`, but new handlers, OpenAPI extensions, and documentation must use `WebRequestContext`.
- Migration plans must name affected route crates, API servers, appbase adapters, and verification commands before removing legacy HTTP context crates.

### 4.2 HTTP Response Envelope Migration

Rules:

- L2+ `app-api`, `backend-api`, and SDKWork-owned business `open-api` contracts `MUST` migrate to `SdkWorkApiResponse` success bodies and section 14 input rules per `API_SPEC.md` section 4.5 and section 15.
- Vendor compatibility `open-api` operations that intentionally preserve upstream wire `MUST` declare `x-sdkwork-wire-protocol: external` and `x-sdkwork-external-protocol-id` per section 4.5.2 instead of being forced into `SdkWorkApiResponse`.
- Legacy envelopes `PlusApiResult`, `AppbaseApiResult`, `StoreApiResult`, interim `SdkWorkResponse`, and per-domain `*ApiResult` `MUST` be removed from OpenAPI authorities, handlers, generated SDK types, frontend service parsers, and documentation during migration.
- Wire field `requestId` `MUST` be renamed to `traceId` in success and error responses. New contracts `MUST NOT` declare `requestId`.
- Success envelopes `MUST` add required numeric `code` with value `0` per §15.3. Error responses `MUST` use numeric non-zero `ProblemDetail.code`.
- String wire codes such as `ok`, `validation_error`, or snake_case error names `MUST` be replaced with the numeric registry in §15.3 during migration.
- Bare domain DTO success bodies and top-level `{ items, pageInfo, traceId }` list bodies `MUST` be wrapped into `SdkWorkApiResponse.data`.
- HTTP 2xx responses that encode business failure through `success`, human `message`, or non-success `code` `MUST` be replaced with `ProblemDetail` and the correct HTTP error status.
- Migration steps for each owning repository: update OpenAPI schemas, regenerate SDKs with `--standard-profile sdkwork-v3`, update framework response mapping, update frontend/backend services to generated unwrap behavior and typed `ProblemDetail.code`/`traceId`, and run `node <sdkwork-specs>/tools/check-api-response-envelope.mjs --workspace <workspace-root>`.

## 5. Data Migration

Rules:

- Database migrations must be forward-safe for the supported deployment profile
  and runtime target.
- Backfills must be idempotent and resumable.
- Tenant isolation, indexing, query shape, and audit requirements must be tested when data moves.
- Destructive data migrations require explicit owner approval, backup/restore evidence, and rollback or forward-fix plan.

## 6. Config And Release Migration

Rules:

- Config migrations must keep lifecycle environment, deployment profile, build
  mode, and runtime target separated.
- Old env/config keys must have compatibility aliases only when documented with removal dates.
- Release plans must describe when old and new contracts are accepted.
- Rollback must explain whether config, SDK, database, and artifacts roll back together or separately.

## 7. Acceptance Checklist

- [ ] Producers, consumers, strategy, compatibility window, and owner are named.
- [ ] Related specs and contracts are cited.
- [ ] Deprecated surfaces have removal criteria.
- [ ] Tests cover old path, new path, and cutover when applicable.
- [ ] Rollback or forward-fix plan is explicit.
- [ ] Release notes and documentation explain user/operator impact.

## 8. Identity And Naming Terminology Migration

Public naming migrations for application identity and commerce capabilities follow `NAMING_SPEC.md` §0.

| Retired | Canonical replacement | Notes |
| --- | --- | --- |
| `<product>` placeholder | `<application-code>` (kebab-case) or `<application_code>` (Dart) | L2 application code from `RUNTIME_DIRECTORY_SPEC.md` |
| bare `<app>` path placeholder | `<application-code>` | `app` remains valid for `app-api`, `app.key`, app/user surface |
| `product-specific`, `product-local`, `product-owned` | `application-specific`, `application-local`, `application-owned` | customization of one application line |
| `product-prefix` / `product-prefixed` (pnpm) | `application-code-prefix` / `application-code-prefixed` | forbids `drive:dev`, not merchandise |
| `sdkwork-commerce (deleted)` monolith repository (T0 composition shell) | T1 capability repositories (`sdkwork-shop`, `sdkwork-order`, `sdkwork-payment`, `sdkwork-merchandise`, …) | migration-only; do not add route crates, `*-api-server` expansion, or `sdkwork-commerce (deleted)-pc` packages in the monolith |
| commerce capability `product` | `merchandise` | sibling of `catalog` and `shop`; see `DOMAIN_SPEC.md` §3.1 |
| `sdkwork-commerce (deleted)-product-service` | `sdkwork-merchandise-service` | domain service |
| `sdkwork-*-pc-product`, `sdkwork-*-h5-product` | `sdkwork-*-pc-merchandise`, etc. | client packages |
| `@sdkwork/react-backend-product` | `@sdkwork/react-backend-merchandise` | backend UI |
| `sdkwork-<application-code>-product` crate suffix | forbidden generic suffix | not a merchandise capability rename |
| `Product apps` / `product apps` | `consuming applications` or `application roots` | L1 product name |
| `product prefix` (pnpm) | `application-code prefix` | commerce merchandise |
| `product approval` | `governance approval` | L1 product name |
| `product adapter` | `application-line adapter` | not merchandise capability |
| `product same-origin` | `application same-origin` | runtime mount default |
| consumer `specs/dependency-api-surfaces.json` | resolver-generated `generated/composition.resolved.json` | transitional; new consumers must not add hand-maintained consumer copies |
| `product copy` (i18n/config) | `L1 brand/store copy` or `message-catalog content` | not merchandise |
| `product OpenAPI` | `application-owned OpenAPI` | authority ownership |
| `shared foundation gateway` (without plane) | `platform connectivity-plane gateway` | domain `platform` |
| `sdkwork-<application-code>-gateway` | `sdkwork-<application-code>-standalone-gateway` or `sdkwork-<application-code>-cloud-gateway` | application gateway crate; see `APPLICATION_GATEWAY_SPEC.md` and `NAMING_SPEC.md` §4.3.1 |
| `sdkwork-api-cloud-gateway` | `sdkwork-api-cloud-gateway` | platform gateway crate and repository; see `APPLICATION_GATEWAY_SPEC.md` |
| `sdkwork-api-cloud-gateway-*` support crates | `sdkwork-api-cloud-gateway-*` | platform gateway config, registry, observability, api-server |
| bare `gateway` in crate/script names | `standalone-gateway`, `cloud-gateway`, or `api-cloud-gateway` | deployment-profile-qualified gateway ingress |
| bare `catalog` (i18n normative) | `message catalog` / `i18n catalog fragment` | commerce `catalog` capability |
| `identity` domain packages | `iam` | identity projection headers |
| `PRODUCT_OR_PLATFORM` env formula | `PLATFORM_OR_APPLICATION_CODE` or `SDKWORK_<APPLICATION_CODE>_` | — |

Rules:

- New standards and packages must use canonical terms only.
- Compatibility aliases may exist during the compatibility window but must record removal dates and fail verification after cutover.
- Verification uses `tools/check-identity-naming.mjs` plus existing Rust crate naming scans in `TEST_SPEC.md`.

## 9. Package Directory Migration

Domain, multi-surface, and single-surface application repositories `MUST` migrate repository-root package families into `apps/` application roots.

Repository kind during migration:

| Phase | `repository-kind` | Checker mode | Expected outcome |
| --- | --- | --- | --- |
| Legacy debt present | `legacy-application` | `migration` | warnings only |
| Canonical application layout | `application` | `enforce` | pass |
| Workspace audit / planning | any | `audit` | report only |

Run:

```bash
node ../sdkwork-specs/tools/check-workspace-packages-layout.mjs --workspace .. --mode audit
node ../sdkwork-specs/tools/check-workspace-packages-layout.mjs --root . --mode migration
node ../sdkwork-specs/tools/check-workspace-packages-layout.mjs --root . --mode enforce
```

| Retired repository-root path | Canonical replacement | Notes |
| --- | --- | --- |
| `packages/` at git repository root in an application repository | `apps/sdkwork-<application-code>-<client-arch>/packages/` or `apps/sdkwork-<application-code>-common/packages/` | applies to single-surface and multi-surface repositories |
| `packages/common/<domain>/sdkwork-<capability>` | `apps/sdkwork-<application-code>-common/packages/sdkwork-<capability>` | cross-architecture contracts, runtime, service, bootstrap, SDK ports |
| `packages/common/rpc/sdkwork-rpc-contracts` | `apps/sdkwork-<application-code>-common/packages/sdkwork-rpc-contracts` | shared RPC proto only |
| `packages/pc-react/<domain>/sdkwork-<capability>-pc-react` | `apps/sdkwork-<application-code>-pc/packages/sdkwork-<capability>-pc-react` or `apps/sdkwork-<domain>-pc/packages/...` in a domain repository | PC React UI modules |
| `packages/mobile-react/<domain>/...` | `apps/sdkwork-<application-code>-h5/packages/...` | H5/mobile React modules |
| `packages/mobile-flutter/<domain>/...` | `apps/sdkwork-<application-code>-flutter-mobile/packages/...` | Flutter modules |
| `packages/mini-program/<domain>/...` | `apps/sdkwork-<application-code>-mini-program/packages/...` | mini program modules |
| `packages/android-native/<domain>/...` | `apps/sdkwork-<application-code>-android-mobile/packages/...` | Android native modules |
| `packages/ios-native/<domain>/...` | `apps/sdkwork-<application-code>-ios-mobile/packages/...` | iOS native modules |
| `packages/harmony-native/<domain>/...` | `apps/sdkwork-<application-code>-harmony-mobile/packages/...` | Harmony native modules |

Rules:

- Migration plans `MUST` name producer paths, consumer workspace links, proto materialization targets, and verification commands.
- After cutover, `application` repositories `MUST` declare `repository-kind: application` and `MUST NOT` keep repository-root `packages/`.
- During migration, legacy application repositories `SHOULD` declare `repository-kind: legacy-application` until architecture-qualified `apps/sdkwork-<application-code>-*/packages/` cutover completes.
- Dedicated shared package-family repositories `MAY` keep repository-root `packages/` only when the root README declares `repository-kind: shared-package-family`.
- Foundation dependency repositories `MAY` keep repository-root `packages/` when the root README declares `repository-kind: foundation-dependency` or states the repository is not an independent SDKWork application root.
- Repath scripts and compatibility aliases may exist only during the documented compatibility window.
- New standards, templates, and authored documentation `MUST` cite canonical `apps/sdkwork-<application-code>-*/packages/` paths only.
- Verification `SHOULD` include `node ../sdkwork-specs/tools/check-workspace-packages-layout.mjs --root .`.
