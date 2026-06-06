# SDK Workspace And OpenAPI Generation Detail Standard

- Version: 1.0
- Scope: project-level `sdks/` workspace layout, SDK family directory placement, OpenAPI 3.x authority documents, derived generator inputs, generated output boundaries, backend API SDK generation workflow
- Related: `SDKWORK_WORKSPACE_SPEC.md`, `API_SPEC.md`, `WEB_BACKEND_SPEC.md`, `SDK_SPEC.md`, `COMPONENT_SPEC.md`, `DOMAIN_SPEC.md`, `IAM_LOGIN_INTEGRATION_SPEC.md`, `BACKEND_UI_SPEC.md`, `FRONTEND_SPEC.md`, `CONFIG_SPEC.md`, `TEST_SPEC.md`, `GOVERNANCE_SPEC.md`

This detail standard implements the SDK workspace and OpenAPI generation parts of `SDK_SPEC.md`. It defines how an application keeps SDK generation work in the `sdks/` directory under its application root while preserving one common SDKWork architecture. The application root may live in any repository or product directory; this standard does not assume any fixed parent directory structure. It is intentionally independent of Craw Chat, IM, Java, Rust, React, Flutter, Tauri, SaaS, private, or local deployment choices.

`SDK_SPEC.md` is the primary SDK standard and owns the SDK system model, canonical naming vocabulary, package semantics, generated client surface, auth handling, service facade boundary, integration rules, and generated client quality rules. This file is subordinate to `SDK_SPEC.md`; it owns only the physical application-root `sdks/` structure, SDK family directory placement, OpenAPI authority document materialization, derived generator inputs, generated output placement, and backend API SDK generation workflow.

The canonical SDK generator is defined by `SDK_SPEC.md`: repository-relative `sdk/sdkwork-sdk-generator`, local path `D:\javasource\spring-ai-plus\sdk\sdkwork-sdk-generator`, package `@sdkwork/sdk-generator`, CLI `sdkgen`, and executable `D:\javasource\spring-ai-plus\sdk\sdkwork-sdk-generator\bin\sdkgen.js`. Repository-local generation scripts are allowed only as thin wrappers that materialize input OpenAPI, pass standardized generator arguments, and route output into the application `sdks/` workspace. They must not substitute another generator, use copied generator source, call ad hoc OpenAPI client tools, present `sdkwork-code-generator` as a separate standard, or silently fall back to local stubs for committed SDK output. `sdkwork-code-generator` is only an alias/wrapper name when a repository explicitly documents that it executes this canonical `sdkgen.js` entrypoint; it is not an independent SDKWork HTTP SDK generator.

If this file appears to conflict with `SDK_SPEC.md`, follow `SDK_SPEC.md` for SDK semantics and package/client behavior. Use this file for repository layout and generation artifact placement only when consistent with `SDK_SPEC.md`.

Repository/application root `.sdkwork/` skills and plugins are defined by `SDKWORK_WORKSPACE_SPEC.md`. The generated SDK output `.sdkwork/sdkwork-generator-*.json` files described here are a separate `sdkgen` control plane and must not be used as repository workspace metadata.

## 1. Principles

Rules:

- `SDK_SPEC.md` is the primary SDK standard. This file operationalizes its workspace and generation requirements for repositories and CI.
- Every application that owns generated SDKs `MUST` create `sdks/` under the application root.
- Every application root that owns generated SDKs also `MUST` satisfy `SDKWORK_WORKSPACE_SPEC.md` by providing root `.sdkwork/skills/` and `.sdkwork/plugins/`; those directories live beside `sdks/`, not inside generated SDK output.
- The `sdks/` directory `MUST` be organized by SDK family directories. API authority documents live inside the owning SDK family; API authority names are not top-level SDK family directories.
- OpenAPI 3.x documents are the authority for HTTP SDK generation.
- HTTP SDK generation `MUST` call `D:\javasource\spring-ai-plus\sdk\sdkwork-sdk-generator\bin\sdkgen.js`.
- Generated SDK output `MUST NOT` be hand-edited. Fix the runtime API, OpenAPI authority, generator profile, or composed facade, then regenerate.
- Generated HTTP SDK output `MUST` retain the `sdkgen` control plane: `sdkwork-sdk.json`, `.sdkwork/sdkwork-generator-manifest.json`, `.sdkwork/sdkwork-generator-changes.json`, `.sdkwork/sdkwork-generator-report.json`, and the regeneration-safe `custom/` root.
- Generated output `.sdkwork/` directories are generator-owned. They `MUST NOT` contain repository/application skills, plugins, root workspace manifests, local caches, runtime databases, logs, or secrets.
- Generated HTTP SDK files under `generated/server-openapi` `MUST` remain canonical `sdkgen` output. SDK ownership and dependency standard fields such as `sdkOwner`, `apiAuthority`, `sdkFamily`, `generationInputSpec`, `sdkDependencies`, `ownerOnlyOperationCount`, `standardProfile`, and `standardVersion` belong in `.sdkwork-assembly.json`, optional SDK-family `sdk-manifest.json`, `specs/component.spec.json`, or approved wrapper/composed package metadata outside `generated/server-openapi`; they `MUST NOT` be synced into generated `sdkwork-sdk.json`, generated `package.json`, generated `sdk-manifest.json`, generator `.sdkwork/*` reports, or generated source `sdkMetadata`.
- Handwritten extensions belong only in generated `custom/` roots or approved `composed/` facades outside generated ownership.
- SDK family wrapper scripts `MUST` fail fast when the canonical generator is missing. Stub generators are allowed only as isolated tooling fixtures, not as official SDK family output producers.
- SDK family wrapper scripts, READMEs, manifests, and CI jobs `MUST` identify the generator as `@sdkwork/sdk-generator` / `sdkgen` and record the canonical path or resolved package location plus the generator version or commit.
- Consumer code `MUST` use generated SDK packages or approved composed wrappers. It `MUST NOT` replace missing SDK methods with raw HTTP, manual auth headers, local DTO forks, or package-local OpenAPI forks.
- Backend API SDKs `MUST` be generated from backend OpenAPI contracts and consumed by backend/admin integrations only.
- App/user-facing UI `MUST NOT` call backend SDKs or `/backend/v3/api`.
- SDK generation is local-owner-only. A repository/application `sdks/` workspace generates only the
  API authorities owned by that repository/application. APIs owned by dependency repos, Rust crate
  dependencies, reusable appbase modules, provider repos, or other applications are declared as
  `sdkDependencies` and consumed as dependency SDKs, not copied into the consuming SDK authority.
- Any SDK family directory containing `openapi/*.sdkgen.json`, `openapi/*.sdkgen.yaml`, or
  `openapi/*.sdkgen.yml` `MUST` declare `.sdkwork-assembly.json` in the same family root. A
  generated SDK family without assembly metadata is not a valid SDKWork family and must fail global
  ownership checks.

## 2. Standard Workspace Shape

Recommended application-root shape:

```text
<application-root>/
  .sdkwork/
    README.md
    skills/
      README.md
    plugins/
      README.md
  packages/
    native-rust/
      routes/
        open-api/
          sdkwork-routes-product-open-api/
          sdkwork-routes-catalog-open-api/
        app-api/
          sdkwork-routes-product-app-api/
          sdkwork-routes-cart-app-api/
          sdkwork-routes-order-app-api/
        backend-api/
          sdkwork-routes-product-backend-api/
          sdkwork-routes-order-backend-api/
  sdks/
    README.md
    materialize-<domain>-v<major>-openapi-boundaries.mjs
    workspace-*.mjs
    _route-manifests/
      app-api/
        sdkwork-routes-product-app-api.route-manifest.json
        sdkwork-routes-cart-app-api.route-manifest.json
      backend-api/
      open-api/
    _shared/
    test/
    sdkwork-<domain>-sdk/
      README.md
      openapi/
        sdkwork-<domain>-open-api.openapi.yaml
        sdkwork-<domain>-open-api.sdkgen.yaml
        sdkwork-<domain>-open-api.flutter.sdkgen.yaml
      sdkwork-<domain>-sdk-typescript/
        generated/server-openapi/
        composed/                 # optional semantic facade
      sdkwork-<domain>-sdk-flutter/
      sdkwork-<domain>-sdk-rust/
      sdkwork-<domain>-sdk-java/
      sdkwork-<domain>-sdk-csharp/
      sdkwork-<domain>-sdk-swift/
      sdkwork-<domain>-sdk-kotlin/
      sdkwork-<domain>-sdk-go/
      sdkwork-<domain>-sdk-python/
      specs/
        README.md
        component.spec.json
    sdkwork-<domain>-app-sdk/
      openapi/
        sdkwork-<domain>-app-api.openapi.yaml
        sdkwork-<domain>-app-api.sdkgen.yaml
        sdkwork-<domain>-app-api.flutter.sdkgen.yaml
      ...
    sdkwork-<domain>-backend-sdk/
      openapi/
        sdkwork-<domain>-backend-api.openapi.yaml
        sdkwork-<domain>-backend-api.sdkgen.yaml
      ...
```

Rules:

- Rust HTTP route crates that define SDKWork HTTP API paths, route constants, route manifests,
  router mount points, or handler bindings belong under the application root's Rust workspace, not
  under `sdks/`. The recommended path is
  `packages/native-rust/routes/<surface>/sdkwork-routes-<capability>-<surface>/`.
- Application-root `.sdkwork/` is validated by `SDKWORK_WORKSPACE_SPEC.md`; it is not an SDK family,
  not an OpenAPI authority, and not a generated transport output.
- `<surface>` in Rust route crate placement `MUST` be exactly `open-api`, `app-api`, or
  `backend-api`.
- Rust route crate package names `MUST` follow `API_SPEC.md`:
  `sdkwork-routes-<capability>-open-api`, `sdkwork-routes-<capability>-app-api`, or
  `sdkwork-routes-<capability>-backend-api`.
- `sdkwork-<domain>-sdk` is the public/open domain SDK family.
- `sdkwork-<domain>-app-sdk` is the app/client SDK family for app-api contracts.
- `sdkwork-<domain>-backend-sdk` is the backend/admin SDK family for backend-api contracts.
- `<domain>` is the application domain model, in kebab-case. It should match `DOMAIN_SPEC.md` unless the product has an approved local domain alias.
- Non-OpenAPI SDKs are allowed only when they are declared as provider/runtime SDKs, for example `sdkwork-rtc-sdk`. They `MUST` document that they are not route-generated HTTP SDKs.
- Support directories such as `_shared/` and `test/` may exist under `sdks/` when they serve multiple SDK families.
- Generated language output belongs below the owning SDK family. Do not place generated SDK packages at random application roots.
- The family root is the ownership boundary. `openapi/`, generated language workspaces,
  `specs/component.spec.json`, optional family-root `sdk-manifest.json`, and `.sdkwork-assembly.json`
  belong under that same family root. Ownership and dependency metadata must not be moved into
  generated transport output to make discovery work.
- Rust route crates are source inputs to authority materialization. They `MUST NOT` be placed inside
  generated SDK family directories, and generated SDK code `MUST NOT` import route crate internals.
- Normalized route manifest artifacts, when produced for materialization or CI, belong under
  `<application-root>/sdks/_route-manifests/<surface>/`. They are intermediate authority inputs, not
  SDK families, not generated transport, and not public SDK package roots.

## 3. SDK Family Directory Placement

The following table repeats the canonical SDK/API naming model from `SDK_SPEC.md` only to show where those families and authority documents live in the application-root `sdks/` workspace. `SDK_SPEC.md` remains authoritative for SDK family semantics, API authority semantics, generated package names, generated metadata, manifests, and generator `--sdk-name` values.

| SDK family directory | API authority name | API prefix | Audience |
| --- | --- | --- | --- |
| `sdkwork-<domain>-sdk` | `sdkwork-<domain>-open-api` | Domain-defined, commonly `/im/v3/api` for IM | Public/domain integrations |
| `sdkwork-<domain>-app-sdk` | `sdkwork-<domain>-app-api` | `/app/v3/api` | App, desktop, mobile, H5, and user-facing clients |
| `sdkwork-<domain>-backend-sdk` | `sdkwork-<domain>-backend-api` | `/backend/v3/api` | Backend console, operators, control plane, admin integrations |

Rules:

- The SDK family name and API authority name `MUST` be declared in the family README and component manifest.
- The authority name is the logical API product. Physical OpenAPI filenames may include an application prefix during migration, but the declared authority name must stay standard.
- SDK family names and API authority names `MUST NOT` be conflated. `sdkwork-<domain>-open-api`, `sdkwork-<domain>-app-api`, and `sdkwork-<domain>-backend-api` are API authority names only; they are forbidden as directories directly below `sdks/`, as generated language workspace prefixes, as generated package names, as `sdkMetadata.name`, as `sdk-manifest.json.sdkName`, as assembly `workspace`, as generator `SDK_NAME`, and as generator `--sdk-name`.
- The SDK family generated from an `open-api` authority is always `sdkwork-<domain>-sdk`, not `sdkwork-<domain>-open-api` and not `sdkwork-<domain>-open-sdk`.
- Generated language workspaces `MUST` inherit the SDK family name exactly: `sdkwork-<domain>-sdk-{language}`, `sdkwork-<domain>-app-sdk-{language}`, and `sdkwork-<domain>-backend-sdk-{language}`.
- Generated package names `MUST` trace to the SDK family, not the API authority: `sdkwork-<domain>-sdk-generated-{language}`, `sdkwork-<domain>-app-sdk-generated-{language}`, and `sdkwork-<domain>-backend-sdk-generated-{language}` unless a documented public package alias is declared in the family manifest.
- Public package names may be shorter than workspace names, for example `@sdkwork/im-sdk`, but the package must trace back to the SDK family and authority OpenAPI.
- App SDKs may depend on public/domain SDKs or provider SDKs only through public package entrypoints. They `MUST NOT` import generated transport internals from another family.
- Backend SDKs `MUST NOT` depend on app UI packages, app route guards, or user-facing shell runtime.

Example mapping:

| Route crate | Aggregated API authority | SDK family | Prefix |
| --- | --- | --- | --- |
| `sdkwork-routes-conversation-open-api` | `sdkwork-im-open-api` | `sdkwork-im-sdk` | `/im/v3/api` |
| `sdkwork-routes-product-app-api` | `sdkwork-commerce-app-api` | `sdkwork-commerce-app-sdk` | `/app/v3/api` |
| `sdkwork-routes-order-backend-api` | `sdkwork-commerce-backend-api` | `sdkwork-commerce-backend-sdk` | `/backend/v3/api` |

### 3.1 Rust Route Crate Placement

Rust HTTP route crates are capability-level source packages. They configure paths and routers; they do not own generated SDK output.

Recommended source shape:

```text
packages/native-rust/routes/app-api/sdkwork-routes-product-app-api/
  Cargo.toml
  src/lib.rs
  src/paths.rs
  src/routes.rs
  src/handlers.rs
  src/manifest.rs

packages/native-rust/routes/backend-api/sdkwork-routes-order-backend-api/
  Cargo.toml
  src/lib.rs
  src/paths.rs
  src/routes.rs
  src/handlers.rs
  src/manifest.rs
```

Rules:

- Route crates `MUST` expose route/path definitions through a package root export or Rust public module; consumers must not import private files.
- Route crates `MUST` expose or feed a route manifest that records package name, API surface, owner, domain, capability, prefix, paths, methods, operationIds, tags, auth requirements, and handler binding metadata.
- Route manifests `MUST` be deterministic and suitable for OpenAPI materialization.
- A route crate `MUST` provide one stable manifest entrypoint, for example `src/manifest.rs`
  exporting a framework-neutral manifest structure, a build script emitting JSON, or a checked-in
  `sdkwork.route.manifest.json` file. The normalized artifact consumed by SDK workspace tooling
  `MUST` follow `API_SPEC.md` `kind: sdkwork.route.manifest`.
- Route crates `MUST` validate their surface prefix locally. `sdkwork-routes-product-app-api` cannot mount `/backend/v3/api` or any open-api domain prefix such as `/im/v3/api`.
- Route crates `MUST` not generate SDK code, vendor generated SDK packages, or define final SDK package names.
- Route crates may depend on runtime/service traits and appbase context helpers, but they `MUST NOT` depend on generated app/backend SDKs for the same application authority. Generated SDKs call the API; route crates implement the API.
- Route crate names should use the business capability, for example product, cart, order, payment, catalog, shipment, wallet, tenant, report, or audit. The aggregated authority uses the project/domain, for example commerce.

### 3.2 Route Manifest Artifact Placement

Route manifest source may live inside the Rust route crate, but the SDK workspace needs one normalized view for materialization, ownership checks, and CI diffs.

Recommended normalized output:

```text
<application-root>/sdks/_route-manifests/
  app-api/
    sdkwork-routes-product-app-api.route-manifest.json
    sdkwork-routes-cart-app-api.route-manifest.json
    sdkwork-routes-order-app-api.route-manifest.json
  backend-api/
    sdkwork-routes-order-backend-api.route-manifest.json
  open-api/
    sdkwork-routes-conversation-open-api.route-manifest.json
```

Rules:

- The normalized file name `MUST` be `<packageName>.route-manifest.json`.
- The normalized directory name `MUST` match manifest `surface`.
- The file `packageName`, `surface`, `owner`, `domain`, `capability`, `apiAuthority`,
  `sdkFamily`, `prefix`, and route list `MUST` match the source route crate and `API_SPEC.md`
  route manifest shape.
- Route manifest artifacts are materialization inputs. They `MUST NOT` be placed below
  `generated/server-openapi`, committed as generated SDK control-plane metadata, or imported by UI
  packages and generated SDK consumers.
- If the repository does not commit normalized manifests, the materialization command `MUST` produce
  them before authority OpenAPI generation and the verification command `MUST` compare the produced
  artifacts against the route crate source declarations.
- Normalized manifests `SHOULD` be sorted deterministically by package name, then method, then path,
  then operationId.

## 4. OpenAPI Authority And Derived Inputs

Each OpenAPI-generated SDK family has two contract layers.

| Layer | File pattern | Ownership |
| --- | --- | --- |
| Authority OpenAPI | `openapi/<api-authority>.openapi.yaml` | Human-reviewed source of truth aligned with runtime routes/controllers |
| Derived generator input | `openapi/<api-authority>.sdkgen.yaml`, optional `openapi/<api-authority>.flutter.sdkgen.yaml` | Materialized, deterministic generator input |

Rules:

- Authority OpenAPI documents `MUST` use the OpenAPI 3.x profile in `API_SPEC.md`.
- Authority OpenAPI documents may be materialized from multiple route crate manifests for the same
  owner, domain, and API surface. For example, `sdkwork-commerce-app-api` may aggregate
  `sdkwork-routes-product-app-api`, `sdkwork-routes-cart-app-api`, `sdkwork-routes-order-app-api`,
  and `sdkwork-routes-payment-app-api`.
- Route crate manifests `MUST` be aggregated by surface. An `app-api` authority may consume only
  `sdkwork-routes-*-app-api` manifests; a `backend-api` authority may consume only
  `sdkwork-routes-*-backend-api` manifests; an `open-api` authority may consume only
  `sdkwork-routes-*-open-api` manifests.
- Route crate manifests `MUST` also be aggregated by owner, domain, API authority, SDK family, and
  prefix. A materializer `MUST` fail instead of guessing when two candidate manifests disagree on
  any of those fields.
- The aggregated authority name `MUST` follow `SDK_SPEC.md`: `sdkwork-<domain>-open-api`,
  `sdkwork-<domain>-app-api`, or `sdkwork-<domain>-backend-api`. The route crate name
  `sdkwork-routes-<capability>-<surface>` `MUST NOT` be used as an authority filename except as an
  internal route manifest input.
- Authority OpenAPI documents materialized from route manifests `MUST` copy operation ownership and
  source traceability into `x-sdkwork-owner`, `x-sdkwork-api-authority`, `x-sdkwork-source`, and
  `x-sdkwork-source-route-crate`.
- The materializer `MUST` reject missing route manifest fields, duplicate method/path pairs after
  path-template normalization, wrong surface suffixes, wrong prefixes, dependency-owned routes
  declared as consumer-owned routes, and operationId/tag/domain mismatches.
- Derived generator inputs `MUST` be reproducible from the authority document and materialization script.
- Derived generator inputs `MUST NOT` introduce operations, schemas, security, or paths that are absent from the authority document.
- Generator-specific normalization, language quirks, and Flutter-specific adjustments belong in derived inputs, not runtime API code.
- Authority and derived inputs `MUST` preserve operationId, tag, path, schema, security, and problem-detail semantics.
- OpenAPI documents for app-api and backend-api `MUST` use dual-token security where required by `API_SPEC.md` and `IAM_LOGIN_INTEGRATION_SPEC.md`.
- OpenAPI documents `MUST NOT` expose `X-Request-Id` or client-supplied request correlation IDs for app/backend SDKs.

## 4.1 Dependency Authority Exclusion

Materialization is responsible for converting broad runtime route catalogs into owner-only SDK
authorities. If a repository/application depends on another SDKWork API authority, the consuming
SDK family must subtract that dependency authority before generation.

Rules:

- Materialization scripts `MUST` load or otherwise know every dependency authority that overlaps
  the consuming API prefix.
- Dependency-owned paths `MUST` be removed from the consuming authority and every derived
  `*.sdkgen.*` input before generation. Normalization must compare path templates with parameter
  names canonicalized, for example `{userId}` and `{id}` both compare as `{}`. If ownership differs
  per method, the comparison must include HTTP method.
- The consuming authority `info.description`, README, `.sdkwork-assembly.json`, and component spec
  should state that the authority is owner-only and that dependency capabilities are consumed
  through `sdkDependencies`.
- Dependency SDKs are declared in the consuming SDK family's generation config, `.sdkwork-assembly.json`,
  and family-root `specs/component.spec.json` with matching `sdkDependencies` arrays.
- Independent application roots under `apps/` that include Rust local/private services, Tauri hosts,
  or native Rust runtime crates `MUST` declare `sdkwork-appbase` SDK dependencies before generating
  product-owned SDKs. At minimum, app/user-facing app-api consumers declare
  `sdkwork-appbase/sdks/sdkwork-appbase-app-sdk`; backend/admin consumers also declare
  `sdkwork-appbase/sdks/sdkwork-appbase-backend-sdk`.
- Those Rust-enabled independent apps `MUST` include the Rust package mapping for each required
  appbase SDK dependency when Rust code consumes appbase HTTP SDKs, and their Rust workspace
  manifests must depend on the appbase Rust runtime crates needed for shared context, auth,
  bootstrap, token/session validation, and local/private route behavior.
- Every authored SDK family `MUST` have `specs/component.spec.json` at the family root. Its
  `contracts.sdkDependencies` field `MUST` be present as an explicit array and `MUST` mirror the
  union of top-level `.sdkwork-assembly.json sdkDependencies` plus per-surface `sdkDependencies`.
  SDK families with no dependencies `MUST` declare `contracts.sdkDependencies: []`.
- Dependency SDK families themselves `MUST` be discoverable by the same standards checker as
  consuming SDK families. For example, `sdkwork-appbase/sdks/sdkwork-appbase-app-sdk` and
  `sdkwork-appbase/sdks/sdkwork-appbase-backend-sdk` declare their own assembly metadata and
  operation ownership; applications only reference them through `sdkDependencies`.
- Any committed or materialized `generated/server-openapi` output `MUST` belong to a discoverable
  SDK family with `.sdkwork-assembly.json`. Existing generated output without assembly metadata is
  not grandfathered; add the family assembly or remove the stale generated output before it can pass
  the global SDK ownership check.
- Each dependency declaration `MUST` include `workspace`, `role`, `required: true`,
  `dependencyMode: "consumer-sdk"`, exact `apiPrefix` or `null` for non-HTTP SDKs,
  `generatedTransportImportPolicy: "forbidden"`, and supported language package names.
- `sdkDependencies[].workspace` `MUST` be unique within each dependency list in generation config,
  `.sdkwork-assembly.json`, per-surface declarations, family-root `sdk-manifest.json`, and
  `specs/component.spec.json`. Duplicate references to the same dependency SDK family are a standards
  failure; merge the package-language metadata into one dependency entry instead.
- Each dependency declaration's `workspace` `MUST` resolve to exactly one SDK family discovered by
  the same global ownership check. Global checks therefore include both consuming application roots
  and dependency SDK roots, for example app roots plus `D:\sdkwork-opensource\sdkwork-drive` and
  `D:\sdkwork-opensource\sdkwork-knowledgebase`.
- If a dependency declaration includes `owner`, `apiOwner`, `apiAuthority`, `authoritySpec`, or
  `apiPrefix`, those values `MUST` match the referenced SDK family. `apiPrefix: null` is valid only
  when the referenced SDK family has no HTTP API prefix; it cannot be used to bypass app/backend/open
  prefix matching. Historical authority aliases such as `sdkwork-appbase-app-api` and
  `sdkwork-appbase.app` may normalize to the same authority, but app/backend/open authority
  mismatches are invalid.
- Generated transport output `MUST NOT` import dependency SDK packages, vendor their generated
  transport code, re-export dependency SDK clients, or retain stale API/model/doc files for
  dependency-owned routes.
- Generated transport output, generated docs, generated manifests, and generated package/build
  metadata `MUST NOT` reference package names declared in `sdkDependencies[].packageByLanguage`.
  Dependency package names are consumed by composed wrappers, runtime bootstrap, or application
  integration code outside `generated/server-openapi`.
- A generation wrapper `MUST` delete stale generated-owned files that disappeared from the current
  input. A generator that only overwrites files is not sufficient for owner-only SDKs.
- Verification `MUST` compare the consuming authority, derived inputs, and generated output against
  dependency route sets and fail on overlap.

Example:

If `craw-chat` depends on `sdkwork-appbase`, then `craw-chat/sdks/sdkwork-im-app-sdk` and
`craw-chat/sdks/sdkwork-im-backend-sdk` generate only Craw Chat-owned app/backend APIs.
`sdkwork-appbase` app/backend auth, IAM, session, QR auth, and backend management APIs remain in
`sdkwork-appbase/sdks/sdkwork-appbase-app-sdk` and
`sdkwork-appbase/sdks/sdkwork-appbase-backend-sdk`. Craw Chat records those SDKs as dependencies
and consumes them at the composition layer.

For an independent Rust-enabled app under `apps/`, the same dependency rule applies even when the
local Rust runtime starts appbase-owned routes in the same process. The product app's `sdks/`
workspace still generates only product-owned authorities, records appbase SDKs in
`sdkDependencies`, and wires appbase Rust crates through the Rust workspace rather than copying
appbase OpenAPI, SDK output, request-context code, or IAM/session logic.

## 5. Backend API OpenAPI 3.x Standard

Backend API is the operator/control-plane contract. It must be SDK-generation ready before UI or automation consumers depend on it.

Rules:

- Backend authority OpenAPI `MUST` live under `<application-root>/sdks/sdkwork-<domain>-backend-sdk/openapi/`.
- Backend runtime paths `MUST` start with `/backend/v3/api`.
- Backend OpenAPI `MUST` use `openapi: 3.1.x` when the toolchain supports it, or a documented OpenAPI 3.x fallback only when generator compatibility requires it.
- Backend OpenAPI `MUST` include stable `info.title`, `info.version`, `servers`, `paths`, `components.schemas`, `components.securitySchemes`, and RFC 9457 `application/problem+json` errors.
- Backend operations `MUST` use the tag and dotted `operationId` rules in `API_SPEC.md` so generated clients expose resource-style methods.
- Backend APIs `MUST NOT` expose login, registration, token refresh, logout, verification code, OAuth callback, password reset, MFA challenge, or device authorization endpoints.
- Backend APIs `MUST NOT` expose an `auth` namespace for user-facing IAM session flows. Those flows belong to app-api and are integrated through appbase IAM.
- Backend operations `SHOULD` declare permission, tenant scope, data scope, and audit metadata through SDKWork OpenAPI extensions.
- Backend SDKs are consumed by backend/admin UI, automation, operator tooling, and control-plane integrations. App/user-facing clients `MUST NOT` consume them.

## 6. Generation Workflow

Standard workflow:

```text
runtime API/controller/route crate manifest
  -> normalized route manifest artifacts
  -> authority OpenAPI
  -> materialized sdkgen OpenAPI
  -> D:\javasource\spring-ai-plus\sdk\sdkwork-sdk-generator\bin\sdkgen.js
  -> generated language SDK
  -> composed facade when needed
  -> consumer service integration
```

Rules:

- Add or change the runtime API route crate/controller manifest and authority OpenAPI in the same
  change set.
- Rust route crate manifest changes `MUST` be followed by authority materialization before SDK
  generation.
- Materialization `MUST` load normalized route manifests from
  `<application-root>/sdks/_route-manifests/<surface>/` or produce that normalized view from the
  route crate manifest entrypoints before creating authority OpenAPI.
- Run the family materialization script before SDK generation.
- Generate language packages from derived `*.sdkgen.yaml` inputs, not from ad hoc Swagger UI output.
- Generate language packages with the canonical `sdkgen.js` entrypoint from `D:\javasource\spring-ai-plus\sdk\sdkwork-sdk-generator`; do not use PATH-resolved generators unless the wrapper first proves they are the same canonical generator installation.
- Before calling `sdkgen`, materialize owner-only OpenAPI inputs and subtract dependency-owned
  authority routes. Do not pass a runtime-wide or dependency-inclusive OpenAPI document directly to
  `sdkgen`.
- Put generated transport code under `generated/server-openapi`.
- Put handwritten semantic facades under `composed` only when the SDK family intentionally owns a composed layer.
- Composed code must import generated transport through package root entrypoints, not private generated source paths.
- Generator package, canonical path or resolved package location, generator version or commit, commands, input spec paths, output paths, package names, SDK type, language targets, profile, and wrapper name when present `MUST` be captured in a manifest or README.
- SDK family ownership/dependency manifests `MUST` be generated or checked outside `generated/server-openapi`. Do not make generation idempotency depend on post-processing generated `sdkwork-sdk.json`, generated `package.json`, generated `sdk-manifest.json`, `.sdkwork/sdkwork-generator-manifest.json`, or generated source files with ownership standard fields. Runtime operation maps or composed metadata belong in `composed/` outside generated output.
- If a family-root `sdk-manifest.json` is present, generation or materialization tooling `MUST`
  keep it synchronized with `.sdkwork-assembly.json` and family-root `specs/component.spec.json`.
  It must mirror `sdkOwner`, `apiAuthority`, `sdkFamily`/`sdkName`, `generationInputSpec`, and an
  explicit `sdkDependencies` array. Empty dependencies are represented as `sdkDependencies: []`.
- Re-running materialization and generation without contract changes `SHOULD` be idempotent.
- Re-running generation after a dependency-owned route is removed from the consuming authority
  `MUST` remove stale generated-owned files for that route from source, dist, docs, manifests, and
  language model indexes.

## 7. Language Baseline

The standard OpenAPI HTTP SDK language set is:

- TypeScript
- Dart
- Python
- Go
- Java
- Kotlin
- Swift
- C#
- Flutter
- Rust
- PHP
- Ruby

Rules:

- A product may generate fewer languages only when its README declares the supported subset and no consumer expects the missing package.
- TypeScript and Flutter may use layered generated-plus-composed workspaces.
- Dart, Python, Go, Java, Kotlin, Swift, C#, Rust, PHP, Ruby, and similar targets should keep handwritten helpers thin and outside generated output.
- Android requests route to Kotlin as the generator target unless a separate Android wrapper is explicitly approved.
- iOS requests route to Swift as the generator target unless a separate iOS wrapper is explicitly approved.
- Appbase-owned reusable SDK families `sdkwork-appbase-app-sdk` and `sdkwork-appbase-backend-sdk` `MUST` generate the full language baseline unless a governance exception explicitly narrows the supported consumer set.
- Independent Rust-enabled app repositories under `apps/` that consume appbase capabilities `MUST`
  declare the Rust-language package names for the required appbase SDK dependencies and must not
  omit Rust simply because TypeScript/React is the primary UI language.

## 8. Application Integration Rules

Rules:

- UI code calls services. Services call injected SDK clients. SDK clients own transport.
- App-side PC React, mobile React, Flutter, desktop, and Tauri renderers use app SDKs for user-facing remote business capability.
- Backend/admin UI uses backend SDKs for operator capability and follows `BACKEND_UI_SPEC.md`.
- IAM login/session integration follows `IAM_LOGIN_INTEGRATION_SPEC.md`; do not regenerate product-local login SDKs for appbase-owned auth flows.
- Rust local/private implementations must expose the same OpenAPI paths, operationIds, schemas, errors, and security semantics as the Java SaaS contract for shared APIs.
- Rust local/private appbase implementations must wrap protected routers with the standard appbase request context framework so generated app/backend SDK consumers observe the same auth, tenant, organization, user, request id, and problem-detail behavior.
- Tauri commands should validate local/native capability and then call Rust services or injected SDK clients through approved boundaries. They must not become a hidden raw HTTP SDK replacement.

## 9. Verification

Every SDK family change should verify the relevant subset:

- OpenAPI validates under `API_SPEC.md`.
- Application-root `.sdkwork/skills/` and `.sdkwork/plugins/` validate under
  `SDKWORK_WORKSPACE_SPEC.md`.
- HTTP SDK generation uses `@sdkwork/sdk-generator` / `sdkgen` from `D:\javasource\spring-ai-plus\sdk\sdkwork-sdk-generator`.
- No official SDK generation command, manifest, README, or CI job uses copied generator code, local stubs, generic OpenAPI generators, product-local aliases, or an independent `sdkwork-code-generator`. `sdkwork-code-generator` is only an alias/wrapper name for the canonical `D:\javasource\spring-ai-plus\sdk\sdkwork-sdk-generator\bin\sdkgen.js` entrypoint.
- The application root has no forbidden SDK family directories matching `sdks/sdkwork-<domain>-open-api`, `sdks/sdkwork-<domain>-app-api`, `sdks/sdkwork-<domain>-backend-api`, `sdks/<domain>-open-sdk`, `sdks/<domain>-app-sdk`, or `sdks/<domain>-backend-sdk`.
- Rust route crates, when present, follow
  `packages/native-rust/routes/<surface>/sdkwork-routes-<capability>-<surface>/` and are not placed
  under `sdks/`.
- Route crate package names start with `sdkwork-routes-` and end with exactly one of `open-api`,
  `app-api`, or `backend-api`.
- Generated language workspace directories, generated package names, `sdkMetadata.name`, `sdk-manifest.json.sdkName`, assembly `workspace`, generator `SDK_NAME`, and generator `--sdk-name` all use the SDK family name, not the API authority name.
- Generated output retains `sdkwork-sdk.json`, `.sdkwork/sdkwork-generator-manifest.json`, `.sdkwork/sdkwork-generator-changes.json`, `.sdkwork/sdkwork-generator-report.json`, and `custom/`.
- Generated `sdkwork-sdk.json`, generated `package.json`, generated `sdk-manifest.json` when present, and generated source files remain generator-owned and do not carry ownership/dependency standard fields or `sdkwork` ownership metadata blocks.
- Materialization script produces deterministic authority-to-derived output.
- Materialization script produces deterministic route-manifest-to-authority output when Rust route
  crates participate in the API.
- Materialization script rejects route manifests whose crate name, declared surface, and path prefix
  disagree.
- Materialization script rejects route manifests whose package name, capability, surface,
  `apiAuthority`, `sdkFamily`, prefix, route ownership, or route auth mode does not match
  `API_SPEC.md`.
- Materialized authority operations produced from route manifests include `x-sdkwork-owner`,
  `x-sdkwork-api-authority`, `x-sdkwork-source`, and `x-sdkwork-source-route-crate`.
- Materialization script excludes dependency-owned authority routes from consuming SDK inputs.
- `sdkDependencies` in generation config, `.sdkwork-assembly.json`, and family-root
  `specs/component.spec.json` match exactly. Families with no dependencies still declare
  `contracts.sdkDependencies: []`.
- Family-root `sdk-manifest.json`, when present, mirrors `.sdkwork-assembly.json` for owner,
  authority, SDK family/name, generation input, and `sdkDependencies`.
- Generated transport contains no dependency-owned routes, operationIds, DTOs, API classes,
  language package names, stale docs, stale dist bundles, or generated model indexes.
- Generated TypeScript compiles when TypeScript is supported.
- Generated SDK exposes nested resource methods from `tag + dotted operationId`.
- Generated clients handle `Authorization` and `Access-Token` through SDK/bootstrap infrastructure.
- Problem-detail errors map to generated SDK error metadata where the language supports it.
- App consumers contain no raw app/backend HTTP fallback, manual auth headers, or local SDK forks.
- Backend/admin consumers contain no `fetch`, `axios`, string-built backend URLs, `getBackendSdkClient().http`, or generated-output edits.
- Component specs validate for each authored SDK family.

Example verification commands:

```powershell
# Run from <application-root>.
node .\sdks\materialize-<domain>-v3-openapi-boundaries.mjs
node .\sdks\sdkwork-<domain>-sdk\bin\verify-sdk.mjs
node .\sdks\sdkwork-<domain>-app-sdk\bin\verify-sdk.mjs
node .\sdks\sdkwork-<domain>-backend-sdk\bin\verify-sdk.mjs
```

## 10. Acceptance Checklist

- [ ] `<application-root>/sdks/` exists.
- [ ] `<application-root>/.sdkwork/skills/` and `<application-root>/.sdkwork/plugins/` exist and follow `SDKWORK_WORKSPACE_SPEC.md`.
- [ ] HTTP SDK generation uses the canonical `@sdkwork/sdk-generator` / `sdkgen` from `D:\javasource\spring-ai-plus\sdk\sdkwork-sdk-generator`.
- [ ] Generation manifest or README records generator package, canonical path or resolved package location, generator version or commit, command, input, output, language, SDK type, package name, SDK family name, and standard profile.
- [ ] Generated output retains `sdkwork-sdk.json`, `.sdkwork/sdkwork-generator-manifest.json`, `.sdkwork/sdkwork-generator-changes.json`, `.sdkwork/sdkwork-generator-report.json`, and `custom/`.
- [ ] Generated control-plane and source metadata stays canonical: `sdkwork-sdk.json`, generated package manifests, generated `sdk-manifest.json` when present, and generated source files do not contain owner/dependency overlay fields.
- [ ] SDK families use `sdkwork-<domain>-sdk`, `sdkwork-<domain>-app-sdk`, and `sdkwork-<domain>-backend-sdk` where those surfaces exist.
- [ ] Rust route crates, when present, use `sdkwork-routes-<capability>-open-api`,
  `sdkwork-routes-<capability>-app-api`, or `sdkwork-routes-<capability>-backend-api` and live
  outside `sdks/`.
- [ ] Route manifest artifacts, when present, use `kind: sdkwork.route.manifest`, normalize to
  `sdks/_route-manifests/<surface>/<packageName>.route-manifest.json`, and pass package name,
  surface, prefix, authority, SDK family, auth-mode, ownership, and duplicate-route validation.
- [ ] No `sdks/sdkwork-<domain>-open-api`, `sdks/sdkwork-<domain>-app-api`, `sdks/sdkwork-<domain>-backend-api`, `sdks/<domain>-open-sdk`, `sdks/<domain>-app-sdk`, or `sdks/<domain>-backend-sdk` directory exists.
- [ ] Generated SDK metadata, manifests, package names, language workspace names, and generator arguments use the SDK family name and do not use API authority names as SDK names.
- [ ] Family README declares SDK family, API authority name, API prefix, audience, generated languages, and verification commands.
- [ ] Every SDK family root containing `openapi/*.sdkgen.{json,yaml,yml}` declares `.sdkwork-assembly.json`; no SDK family is invisible to global ownership checks.
- [ ] Every SDK family root containing `generated/server-openapi` output declares `.sdkwork-assembly.json`; stale or legacy generated output is not invisible to global ownership checks.
- [ ] `specs/component.spec.json` exists for every authored SDK family.
- [ ] Every SDK family `specs/component.spec.json` declares `contracts.sdkDependencies` explicitly,
  including `[]` for no dependencies.
- [ ] Every family-root `sdk-manifest.json`, when present, declares explicit `sdkDependencies` and
  matches `.sdkwork-assembly.json` for owner, authority, SDK family/name, and generation input.
- [ ] Authority OpenAPI and derived `sdkgen` inputs are separated.
- [ ] Route crate manifests, when present, aggregate into authority OpenAPI by matching owner,
  domain, surface, API authority, SDK family, and prefix.
- [ ] Authority OpenAPI operations materialized from route manifests declare `x-sdkwork-owner`,
  `x-sdkwork-api-authority`, `x-sdkwork-source`, and `x-sdkwork-source-route-crate`.
- [ ] Authority OpenAPI and derived `sdkgen` inputs contain only owner application/repository API
  routes; dependency authorities are subtracted before generation.
- [ ] Dependency SDKs are recorded in matching `sdkDependencies` entries across generation config,
  `.sdkwork-assembly.json`, and family-root `specs/component.spec.json`.
- [ ] Independent Rust-enabled `apps/` repositories declare `sdkwork-appbase` dependencies, required
  appbase Rust crates, `sdkwork-appbase-app-sdk`, and `sdkwork-appbase-backend-sdk` when backend/admin
  appbase capabilities are used.
- [ ] Every `sdkDependencies[].workspace` resolves to exactly one SDK family in the same global
  ownership check, is unique within its dependency list, and declared owner, authority, authority
  spec, and API prefix values match the referenced dependency family.
- [ ] Generated transport does not copy, import, vendor, or retain stale files for dependency-owned
  APIs.
- [ ] Generated transport output, generated docs, generated manifests, and generated package/build
  metadata do not reference package names declared in `sdkDependencies[].packageByLanguage`.
- [ ] Generated output is under `generated/server-openapi`.
- [ ] Handwritten facades are outside generated output.
- [ ] Backend API OpenAPI uses `/backend/v3/api` and has no login/session namespace.
- [ ] Consumers use generated SDKs or approved composed wrappers only.
- [ ] Verification commands are recorded in the change or release notes.
