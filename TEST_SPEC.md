# Test And Verification Standard

- Version: 1.0
- Scope: contract tests, SDK/RPC generation tests, backend tests, frontend tests, parity tests, security tests
- Related: all specs

No standard is complete until it is executable.

## 1. Required Test Classes

| Area | Required verification |
| --- | --- |
| Agent entrypoints | Repository/application `AGENTS.md` presence, tool compatibility shims such as `CLAUDE.md`, `GEMINI.md`, and `CODEX.md` where required, required sections, relative `sdkwork-specs` path checks, `SOUL.md`/`AGENTS_SPEC.md` references, and no duplicated root spec bodies |
| Repository workspace | Git repository root and application root standard top-level directory dictionary checks, `.sdkwork/` presence checks, tracked `skills/` and `plugins/` placeholders, skill/plugin manifest checks, static scans for forbidden secrets/runtime/generated SDK files, repository `README.md` `repository-kind:` declaration, and package-family path layout via `tools/check-workspace-packages-layout.mjs` (`enforce`, `migration`, or `audit` mode) |
| pnpm scripts | Validate `PNPM_SCRIPT_SPEC.md`: required root scripts, application-code-prefix retirement, allowed public namespaces, action-first runtime target command names, canonical gateway command order, retired deployment word rejection, package-local script scans, documentation/config command examples, and active runner-script `pnpm` invocation scans |
| Code style and naming | `CODE_STYLE_SPEC.md` and `NAMING_SPEC.md` checks for focused entrypoints, public exports, generated-code boundaries, canonical names, identity lattice terminology (`tools/check-identity-naming.mjs`), and no catch-all implementation files |
| Language-specific code | On-demand Rust, Java, TypeScript, and frontend checks only when those languages/frameworks are touched |
| Tailwind CSS integration | `TAILWIND_CSS_INTEGRATION_SPEC.md` checks via `tools/check-tailwind-integration.mjs` for shell bootstrap ownership, forbidden feature-package `@import "tailwindcss"`, and deprecated Vite aliases |
| Requirements | Validate `REQUIREMENTS_SPEC.md`: requirement id, owner, status, priority, acceptance criteria, non-functional requirements when relevant, traceability to affected specs/components, and verification evidence |
| Architecture decisions | Validate `ARCHITECTURE_DECISION_SPEC.md`: ADR presence when required, decision shape, architecture views when applicable, alternatives, consequences, verification, and supersession links |
| Engineering workflow | Validate `ENGINEERING_WORKFLOW_SPEC.md`: intake, clarification, decision, plan, implementation, verification, review, release handoff, checkpoints, blockers, and evidence bundle references |
| Code review | Validate `CODE_REVIEW_SPEC.md`: reviewer evidence, risk level, generated artifact boundaries, findings/outcomes, and no review-free security, migration, release, or standards changes |
| Quality gates | Validate `QUALITY_GATE_SPEC.md`: Definition of Ready, Definition of Done, merge gate, release gate, exception gate, risk level, and evidence bundle completeness |
| Release | Validate `RELEASE_SPEC.md`: version, artifacts, changelog, rollout, rollback, freeze, post-release evidence, and release gate satisfaction |
| Migration | Validate `MIGRATION_SPEC.md`: migration plan, compatibility window, affected consumers, sequencing, rollback, data/contract/config/package coverage, and owner approval |
| Dependency management | Validate `DEPENDENCY_MANAGEMENT_SPEC.md`: native build-tool dependency management, one repository-root workspace manifest per git repository, forbidden umbrella application workspaces at multi-repository checkout roots, package import closure, source/build dependency paths, release Git refs, stale dependency cleanup, cross-platform path separators, lockfiles or equivalent reproducibility evidence, dependency-owned SDK/API filtering, single-source-of-truth workspace declarations, `workspace:*` for pnpm, `{ workspace = true }` for Cargo, Flutter/Dart path centralization, and forbidden scattered sibling paths in member packages |
| Application layered architecture | Validate `APPLICATION_LAYERED_ARCHITECTURE_SPEC.md`: L0-L6 API/service/domain/repository/adapter/runtime/frontend dependency direction, controller/service/repository separation, frontend UI-service-SDK injection, open-closed extension boundaries, route ownership, and common URL path reservation |
| Composable architecture | Validate `COMPOSABLE_ARCHITECTURE_SPEC.md`: standard closure matrix coverage, component layer roles, provided/required ports, executable runtime entrypoints, frontend core/feature/host package boundaries, Rust service/route/repository Cargo dependency boundaries, generated resolved architecture graph, route ownership, common URL path reservation, and permission inheritance |
| Supply chain security | Validate `SUPPLY_CHAIN_SECURITY_SPEC.md`: dependency integrity, build integrity, generator authority, SBOM, provenance, signing, checksums, attestations, and supply-chain exceptions |
| API | OpenAPI validation, strict profile validation, `SdkWorkApiResponse` envelope validation (`check-api-response-envelope.mjs`), route path collision validation (`check-route-path-collisions.mjs`), legacy envelope bootstrap (`align-openapi-response-envelope.mjs`, `align-openapi-response-envelope-workspace.mjs`), request/response examples, Rust route crate naming and route-manifest aggregation checks |
| Web backend | Controller/router path checks, handler/service/repository boundary tests, typed request-context checks, transaction/idempotency tests, static scans for raw credential parsing |
| RPC | Proto compile, proto lint, breaking-change check, service manifest, unary server/client smoke tests, generated cross-language client checks, RPC framework integration, discovery resolver integration, resilience profile checks |
| Discovery | Registry upsert/renew/deregister, config publish/effective resolution, watch replay, permission enforcement, production config safety validation |
| SDK | Validate `SDK_SPEC.md` semantics, validate application-root `sdks/` layout from `SDK_WORKSPACE_GENERATION_SPEC.md`, validate SDK package naming from `SDK_PACKAGE_NAMING_SPEC.md`, validate family-root manifests from `SDK_MANIFEST_SPEC.md`, trace authored `apis/` contracts to materialized authority OpenAPI when `apis/` is used, materialize OpenAPI authority to derived generator inputs, generate SDK through `..\sdkwork-sdk-generator` (`@sdkwork/sdk-generator` / `sdkgen`), compile SDK, verify README examples and method surface |
| App SDK composition | Validate `APP_SDK_INTEGRATION_SPEC.md`: architecture-specific SDK language, dependency SDK declarations, appbase IAM runtime wiring, one global TokenManager, explicit dependency API export policy, and no dependency API regeneration |
| Dependency API export | Validate dependency API export policy: `dependencyApiExports` defaults to no export, configured exports reference declared `sdkDependencies`, generated application-owned SDKs stay owner-only, and exported dependency capabilities live only in approved authored facades, service ports, dependency SDK injection, host adapters, or documentation-only surfaces |
| Dependency API surface | Validate dependency SDK runtime composition: every `sdkDependencies` HTTP entry has a `dependencyApiSurfaces` runtime declaration, same-origin dependency SDK defaults have verified executable mount coverage, route metadata is not treated as an executable router, external dependency SDKs fail fast without explicit base URLs, and missing mounts/upstreams fail before `502` or `404` user requests |
| Client architecture alignment | Validate `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md`: package taxonomy, dependency direction, route identity, host adapter boundary, SDK/IAM/runtime composition, and cross-client workflow alignment |
| Dependency composition | Validate `APP_COMPOSITION_SPEC.md`, `APP_INTEGRATION_CONVENTIONS.md`, `COMPOSABLE_ARCHITECTURE_SPEC.md`, and `APP_PERMISSION_COMPOSITION_SPEC.md`: core-package composition layout, bootstrap SDK inventory derivation, frontend/backend dependency chains, component port bindings, permission catalog inheritance, feature-package import boundaries, Rust crate boundaries, and composition resolver output |
| PC application architecture | Validate `APP_PC_ARCHITECTURE_SPEC.md`: application root layout, normalized `sdkwork-<application-code>-pc-*` package names, app/console/admin separation, shared renderer, desktop/tablet host placement, SDK/IAM boundaries |
| H5 application architecture | Validate `APP_H5_ARCHITECTURE_SPEC.md`: `sdkwork-<application-code>-h5-*`, `sdkwork-<application-code>-h5-console-*`, and `sdkwork-<application-code>-h5-admin-*` package names, shared H5/Capacitor renderer, typed host adapters, SDK/IAM boundaries, mobile config, and release metadata |
| Flutter app mobile architecture | Validate `FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC.md`: default, console, and admin Dart package naming, thin root `lib/`, generated Dart app/backend SDK boundary, platform adapters, route identity, and Flutter release metadata |
| Mini program architecture | Validate `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md`: SDKWork default/console/admin source package taxonomy, page/subpackage projection, platform host adapters, generated TypeScript app/backend SDK boundary, and platform package config |
| Mini program UI | Validate `APP_MINI_PROGRAM_UI_SPEC.md`: package-local pages/components/services/state/i18n/routes, route projection inputs, host adapter contracts, app SDK boundary, UI states, and package-size checks |
| Android native mobile architecture | Validate `ANDROID_APP_MOBILE_ARCHITECTURE_SPEC.md`: `sdkwork-<application-code>-android-mobile-*`, `sdkwork-<application-code>-android-mobile-console-*`, and `sdkwork-<application-code>-android-mobile-admin-*` package names, thin root `app/`, generated Kotlin/Java app/backend SDK boundary, Android host adapters, route identity, Android config, and release metadata |
| iOS native mobile architecture | Validate `IOS_APP_MOBILE_ARCHITECTURE_SPEC.md`: `sdkwork-<application-code>-ios-mobile-*`, `sdkwork-<application-code>-ios-mobile-console-*`, and `sdkwork-<application-code>-ios-mobile-admin-*` package names, thin root `App/`, generated Swift app/backend SDK boundary, iOS host adapters, route identity, iOS config, and release metadata |
| Harmony native mobile architecture | Validate `HARMONY_APP_MOBILE_ARCHITECTURE_SPEC.md`: `sdkwork-<application-code>-harmony-mobile-*`, `sdkwork-<application-code>-harmony-mobile-console-*`, and `sdkwork-<application-code>-harmony-mobile-admin-*` package names, thin root `entry/`, generated ArkTS/TypeScript app/backend SDK boundary, HarmonyOS host adapters, route identity, Harmony config, and release metadata |
| Native mobile UI | Validate `APP_ANDROID_NATIVE_UI_SPEC.md`, `APP_IOS_NATIVE_UI_SPEC.md`, or `APP_HARMONY_NATIVE_UI_SPEC.md`: package-local screens/pages/components/services/state/i18n/routes, host adapter contracts, app/user-console SDK boundary, UI states, and lifecycle/security checks |
| Internationalization | Validate `I18N_SPEC.md`: language/framework i18n directory layouts through `tools/check-i18n-standard.mjs`, package-local **message catalog** fragments, backend message bundles, framework `WebLocaleContext`, locale fallback, API `ProblemDetail` i18n metadata, SDK locale providers, database seed i18n versions, duplicate-key checks, missing-key checks, commerce `catalog` vs i18n catalog disambiguation, and no authored app/root/backend/admin/package locale monoliths |
| Environment/config | Validate `CONFIG_SPEC.md` and `ENVIRONMENT_SPEC.md`: lifecycle environment, profile alias, deployment profile, build mode, runtime target, dev/test/staging/prod files, browser/desktop/H5/Capacitor/Flutter/mini-program/native Android/native iOS/native Harmony/server/container/Tauri config separation, public/private/secret boundaries |
| Database | Schema lint, migration test, tenant/index checks, and `DATABASE_FRAMEWORK_SPEC.md` lifecycle asset checks when `database/` exists |
| Drive | Drive API/SDK contract tests, Drive Uploader App SDK tests, Rust `DriveUploaderService` tests, upload-session idempotency, resumable part tests, attribution/statistic tests, retention cleanup tests, provider capability tests, business-module scans for forbidden app-local storage lifecycle |
| IAM/security | Token validation, permission denial, tenant isolation, audit event, appbase login integration, logout clearing, Rust AppContext guard |
| Frontend | Service tests with injected SDK client, UI integration tests |
| UI architecture | Static/package scan that the package family matches `UI_ARCHITECTURE_SPEC.md` plus the relevant root architecture spec and exactly one detailed UI/package spec such as `APP_PC_REACT_UI_SPEC.md`, `APP_MOBILE_REACT_UI_SPEC.md`, `APP_FLUTTER_UI_SPEC.md`, `APP_MINI_PROGRAM_UI_SPEC.md`, `APP_ANDROID_NATIVE_UI_SPEC.md`, `APP_IOS_NATIVE_UI_SPEC.md`, `APP_HARMONY_NATIVE_UI_SPEC.md`, or `BACKEND_UI_SPEC.md` |
| Deployment | Standalone/cloud parity tests, topology profile validation, deployment profile and runtime target separation |
| GitHub workflow | `GITHUB_WORKFLOW_SPEC.md` checks for `sdkwork.workflow.json`, thin reusable workflow entrypoint, planner/schema alignment, dependency `refInput` dispatch inputs and `dependency_refs_json` passthrough, deploymentProfile/runtimeTarget target metadata, safe refs and paths, lifecycle env, release policy, publication policy gates, supply-chain policy, attestation policy, deployment environment binding, and repository validation |
| Events | Schema compatibility, idempotent consumer, replay behavior |
| Performance | Pagination, latency budget, retry, rate-limit behavior |
| Documentation | README/examples match public contracts |

## 2. Contract Tests

Rules:

- Application layering scans `MUST` fail when Java controllers import repository, persistence, or
  infrastructure implementation packages directly; when controllers own transaction annotations;
  when repository or persistence code imports HTTP framework types; when frontend UI calls raw HTTP;
  or when frontend services construct SDK clients instead of receiving injected clients.
- `check-application-layering.mjs` `MUST` support both `--root <repo>` and `--workspace <workspace>`
  and report repository-qualified issues for workspace scans.
- Every API change `MUST` include a test that proves the OpenAPI contract can generate the intended SDK shape and declares `SdkWorkApiResponse` success schemas plus `ProblemDetail` errors for L2+ SDKWork-owned custom `app-api`, `backend-api`, and business `open-api` surfaces. Omitted `x-sdkwork-wire-protocol` means SDKWork-owned custom API (`sdkwork-v3`) and is not an exemption. Vendor compatibility open-api operations declared with operation-level `x-sdkwork-wire-protocol: external` plus `x-sdkwork-external-protocol-id` per `API_SPEC.md` section 4.5.2 are exempt from envelope checks.
- API tests for SDKWork-owned localized errors `SHOULD` prove `ProblemDetail.code` and `traceId` remain stable machine fields while optional `i18nKey`, `locale`, and field-level localization metadata follow `I18N_SPEC.md`.
- `check-api-response-envelope.mjs` `MUST` scan app-api, backend-api, and open-api authority OpenAPI documents, including SDK family authority files under `sdks/*-sdk/openapi/`, and fail when SDKWork-owned custom operations omit `SdkWorkApiResponse` or `ProblemDetail`. It `MUST` skip only operations marked operation-level `x-sdkwork-wire-protocol: external` with `x-sdkwork-external-protocol-id`; mixed documents are validated per operation.
- SDKWork-owned HTTP API contract tests `MUST` prove every operation maps to one `API_SPEC.md` section 15.4 pattern: retrieve, list, search, create, update, delete, command, async command, or bulk command. New and pre-launch APIs `MUST NOT` keep non-standard statuses such as create returning `200` or delete returning a JSON success body.
- `check-api-operation-patterns.mjs` `MUST` scan app-api, backend-api, and business open-api authority OpenAPI documents and fail on operationId/action drift, create/update/delete/search status mismatches, delete JSON success bodies, and non-external SDKWork-owned operations that bypass the operation matrix. It `MUST` skip only vendor compatibility operations marked with operation-level `x-sdkwork-wire-protocol: external` and `x-sdkwork-external-protocol-id`.
- `check-route-path-collisions.mjs` `MUST` scan route manifests and app-api/backend-api/SDKWork-owned open-api authority OpenAPI documents and fail on duplicate normalized `(surface, method, path)` registrations. Path-template dialects `{id}`, `:id`, and `<id>` `MUST` normalize to the same parameter segment. Intentional overrides require an ADR marker. Standard health/readiness paths such as `/app/v3/api/system/health`, `/app/v3/api/system/ready`, `/backend/v3/api/system/health`, and `/backend/v3/api/system/ready` are reserved for the standard health route owner.
- Route path tests `MUST` fail when feature or dependency modules claim common infrastructure-like or system paths such as `/status`, `/health`, `/ready`, `/system/health`, or `/system/ready` instead of a capability-specific resource path. Infrastructure probes remain `/healthz`, `/readyz`, `/livez`, and `/metrics`; business system health endpoints remain single-owner API operations under the reserved app/backend system paths.
- Security and API contract tests `MUST` fail when mandatory-sensitive operations from `SECURITY_SPEC.md` section 5 omit `x-sdkwork-rate-limit-tier` or when the runtime framework does not enforce the declared tier.
- Create, update, delete, command, async command, and bulk command tests `MUST` cover success status, `SdkWorkApiResponse.data` or `204` semantics, `ProblemDetail` failure mapping, idempotency behavior when declared, and optimistic concurrency behavior when declared.
- Every Rust HTTP route crate change `MUST` include or update verification that the crate name,
  declared surface, mounted path prefix, route manifest, aggregated API authority, and generated SDK
  family mapping satisfy `API_SPEC.md`, `SDK_SPEC.md`, and `SDK_WORKSPACE_GENERATION_SPEC.md`.
- Every SDKWork HTTP `*-api` contract/runtime change `MUST` include verification that route
  manifests, authority OpenAPI, derived `*.sdkgen.*` inputs, and runtime handlers/controllers keep
  the `WEB_FRAMEWORK_SPEC.md` request-context contract: `requestContext: WebRequestContext`,
  `apiSurface`, `x-sdkwork-request-context: WebRequestContext`, and `x-sdkwork-api-surface`.
- Every SDK workspace or OpenAPI generation change `MUST` satisfy `SDK_SPEC.md` first for canonical SDK/API naming vocabulary, family naming, package semantics, generated client behavior, auth behavior, and service integration; then satisfy `SDK_WORKSPACE_GENERATION_SPEC.md` for application-root `sdks/` layout, authority OpenAPI location, deterministic derived inputs, generated-output placement, and component specs.
- SDK generation verification `MUST` prove the command uses the canonical `@sdkwork/sdk-generator` / `sdkgen` from `..\sdkwork-sdk-generator`; `sdkwork-code-generator`, local stubs, copied generator code, or generic OpenAPI generators are not valid production SDK verification evidence.
- SDK family verification `MUST` prove `SDK_PACKAGE_NAMING_SPEC.md` and `SDK_MANIFEST_SPEC.md` are satisfied: composed consumer package names and generated transport package names are not conflated, family-root `sdk-manifest.json` is present when required, and ownership/dependency metadata does not live under generated transport output.
- SDK/OpenAPI contract tests `MUST` fail when route manifests, authority OpenAPI, derived `*.sdkgen.*` inputs, generated SDK method surfaces, generated README examples, or generated type models expose `tenant_id` or `tenantId` as a current-tenant path, query, header, cookie, method, `params`, per-call option, credential option, or client-writable request body input.
- Dependency API surface verification `MUST` prove each HTTP `sdkDependencies` entry has a matching
  `dependencyApiSurfaces` runtime declaration. The test must fail when route contracts, route
  manifests, or OpenAPI authority files are treated as same-origin executable router coverage
  without an executable router/controller export.
- Gateway dependency surface verification `MUST` prove route precedence when multiple dependency
  surfaces share a root prefix. Tests must show fixed IAM/provider routes and more specific
  dependency prefixes resolve before broad fallback split surfaces, and that split fallback surfaces
  are validated through upstream/base-url config rather than fake Cargo feature evidence.
- Dependency API export verification `MUST` prove dependency APIs are not re-exported by default.
  When `dependencyApiExports` is configured, tests must prove every entry references a declared
  `sdkDependencies` workspace, uses an approved export mode, and exposes code only through authored
  composed wrappers, service ports, application core exports, host adapters, or documentation-only
  surfaces outside `generated/server-openapi`.
- SDK generation verification `MUST` prove enabling `dependencyApiExports` does not add
  dependency-owned operations, schemas, namespaces, generated API classes, generated docs, or package
  imports to the consuming application-owned generated SDK.
- Same-origin dependency SDK tests `MUST` compare dependency method/path expectations against the
  runtime mount coverage evidence. External-service dependency SDK tests `MUST` prove SDK bootstrap
  uses dependency-specific base URL config and does not fall back to application same-origin
  app/backend base URLs.
- Same-origin dependency SDK tests `MUST` fail when the mounted implementation is a demo/sample
  router, mock server, fixture store, seeded fake response, hard-coded IAM tenant/user/organization
  or API key, or synthetic success handler. Verified mount coverage must exercise real
  stores/services/upstreams or explicitly prove that unimplemented commands fail closed.
- Appbase backend IAM dependency tests `MUST` prove that backend-admin consumers of
  `@sdkwork/iam-backend-sdk` either receive an explicit appbase backend/gateway base URL that
  serves `/backend/v3/api/iam/*` or inherit the application backend base URL only after a
  production-capable appbase backend IAM router/controller/service adapter is verified in
  `dependencyApiSurfaces`. The tests must also prove appbase app SDK integration alone is not
  treated as backend IAM route coverage and that demo rows such as hard-coded tenants,
  organizations, users, or API keys are not returned by admin user or organization routes.
- Runtime dependency preflight tests `MUST` fail before serving traffic when a dependency API export
  or dependency SDK client would otherwise produce a proxy configuration error, `502`, or `404`
  because the dependency upstream is missing, the executable router/controller/service is not
  mounted, or coverage is only metadata.
- File storage, upload, download, and object-storage contract changes `MUST` verify Drive API/SDK generation and must scan business modules for forbidden app-local upload/session/provider/object lifecycle code.
- Drive Uploader contract changes `MUST` verify App API operations `uploader.uploads.prepare`, `uploader.uploads.parts.markUploaded`, `uploadSessions.parts.presign`, and `uploadSessions.complete`, plus generated SDK/composed SDK exposure of `client.uploader.*`.
- Every RPC change `MUST` include a test that proves proto contracts compile and generated clients expose the intended service/method surface.
- Every RPC SDK workspace or generator change `MUST` satisfy `RPC_SPEC.md` for contract semantics and `RPC_SDK_WORKSPACE_SPEC.md` for proto source placement, RPC manifest coverage, `sdkgen --protocol rpc` behavior, generated-output boundaries, and verification evidence.
- RPC SDK generation verification `MUST` include the relevant subset of proto lint, proto breaking-change check, RPC manifest coverage, `sdkgen --protocol rpc --dry-run`, generated client compile, metadata provider example check, and unary smoke test.
- RPC SDK verification `MUST` run `sdkgen inspect --protocol rpc` for every generated and supported
  RPC SDK language workspace. Inspect may pass through convention evidence when no generated
  control-plane files are present: the RPC SDK family root, `rpc/*.manifest.json`, proto source
  reference, generated language workspace name, and native package manifest. If generated
  control-plane files are emitted for release, CI, audit, or migration evidence, their standard names
  are `.sdkwork/sdkwork-generator-manifest.json`, `.sdkwork/sdkwork-generator-changes.json`, and
  `.sdkwork/sdkwork-generator-report.json`, and they are valid RPC evidence only when SDK metadata
  declares `protocol: "rpc"`.
- SDK generator tests `MUST` prove `sdkgen inspect` is documented as generated SDK evidence
  inspection. HTTP/OpenAPI inspect may be described as reading persisted generated SDK control-plane
  artifacts, but RPC inspect documentation and CLI help `MUST NOT` imply that persisted
  control-plane files are required for normal RPC SDK workspaces.
- RPC SDK family/component metadata tests `MUST` prove optional RPC control-plane policy is recorded
  at most once at the family or component contract level, and that generated language workspace
  entries do not duplicate derived `manifest`, `changes`, or `report` paths.
- RPC SDK family/component README tests `MUST` prove optional generator evidence is described as
  convention-derived and that day-to-day source evidence does not enumerate derived
  `.sdkwork/sdkwork-generator-*` paths.
- RPC SDK generator non-regression tests `MUST` prove existing `sdkgen generate` commands without `--protocol rpc` continue to generate HTTP/OpenAPI SDKs without requiring proto roots, RPC manifests, Buf, protoc, or RPC-specific flags.
- New SDKWork v3 open-api, app-api, and backend-api generation tests `MUST` run the SDK generator with `--standard-profile sdkwork-v3`.
- New standard RPC contracts `SHOULD` run proto lint and breaking-change checks.
- Breaking changes `MUST` fail compatibility tests unless explicitly approved in `GOVERNANCE_SPEC.md`.

## 2.0 Repository Workspace Tests

Repository workspace tests make `SDKWORK_WORKSPACE_SPEC.md` executable.

Rules:

- Every independent git repository root and every independent SDKWork application root `MUST` be
  checked against the standard top-level directory dictionary in `SDKWORK_WORKSPACE_SPEC.md`.
- New repository/application templates `MUST` fail if the complete standard directory dictionary is
  missing tracked placeholders or content.
- Tests `MUST` allow inactive capability directories to be absent only when the root README or linked
  root layout documentation explains the active layout.
- Tests `MUST` fail when active capabilities use competing top-level names instead of `apis/`,
  `apps/`, `crates/`, `sdks/`, `jobs/`, `tools/`, `plugins/`, `examples/`, `configs/`,
  `deployments/`, `scripts/`, `docs/`, or `tests/`.
- Tests `MUST` fail on generic competing top-level names such as `api/`, `sdk/`, `package/`,
  `deploy/`, `deployment/`, or `tooling/`.
- Tests `MUST` allow top-level `config/` only when the selected architecture-specific app surface root under `apps/sdkwork-<application-code>-<client-arch>/` requires `config/` per the governing architecture standard; otherwise project-root config content uses `configs/`.
- Tests `MUST` fail when root `README.md` omits `repository-kind:` for SDKWork git repository roots.
- Tests `MUST` allow top-level `packages/` only for `shared-package-family` or `foundation-dependency` repositories with the matching README declaration; `application` repositories `MUST` place package families under `apps/sdkwork-<application-code>-common/packages/` or `apps/sdkwork-<application-code>-<client-arch>/packages/`.
- Tests `MUST` fail when a domain multi-surface repository that owns `apis/`, `apps/`, `crates/`, or
  `sdks/` still contains repository-root `packages/`, `packages/common/`, `packages/pc-react/`, or other
  legacy architecture-family directories after migration cutover.
- Tests `MUST` fail when a single-surface application repository still keeps repository-root `packages/` instead of `apps/sdkwork-<application-code>-<client-arch>/packages/`.
- Tests `MUST` fail when authored documentation, component specs, workspace manifests, or migration-free
  source still reference legacy repository-root package paths where canonical `apps/sdkwork-<application-code>-common/packages/`
  or `apps/sdkwork-<application-code>-<client-arch>/packages/` replacements exist.
- Tests `MUST` fail when `tsconfig*.json` `compilerOptions.paths`, `include`, `exclude`, or `files` entries
  still reference legacy `packages/common/`, `packages/pc-react/`, or sibling-repository legacy package paths
  after canonical replacements exist or when the referenced target no longer resolves.
- Every independent SDKWork application git repository `MUST` be checked for `apps/README.md`.
- Tests `MUST` fail when an independent application repository is missing `apps/` or `apps/README.md`.
- Tests `MUST` fail when `apps/README.md` does not index a direct child application root directory.
- Tests `MUST` fail when `apps/README.md` does not state primary app surface placement or cite
  `APPLICATION_SPEC.md` and `SDKWORK_WORKSPACE_SPEC.md`.
- Tests `MUST` fail when repository root `README.md` does not link to `apps/README.md` while `apps/` exists.
- Tests `MUST` fail when authored API contracts, API manifests, API examples, API changelogs, or API
  validation fixtures are placed outside `apis/` without an approved local spec, or when generated
  SDK transport output or SDK family directories are placed inside `apis/`.
- Tests `MUST` fail when `apis/` contains generated SDK control-plane `.sdkwork/` files, generated
  language SDK output, controller/handler/service/repository implementation code, or SDK family
  workspaces.
- Tests `MUST` fail when `sdks/` is used as the sole authored API source for a repository or
  application that owns API contracts requiring `apis/`.
- Tests `MUST` prove `apis/` and `sdks/` are distinct when both exist: `apis/` holds API source and
  review inputs; `sdks/` holds SDK family workspaces, materialized authority OpenAPI, derived
  `sdkgen` inputs, generated language workspaces, and SDK component metadata.
- Tests `MUST` fail when Rust worker implementation is duplicated under `jobs/` instead of living in
  `crates/sdkwork-<domain>-<capability>-worker/`; `jobs/` may contain schedules, queue bindings,
  batch descriptors, runbooks, and non-Rust job packages.
- Tests `MUST` fail when reusable parsers, generators, validators, CLIs, or operator utilities are
  hidden in `scripts/` instead of `tools/` or an appropriate package/crate. `scripts/` entrypoints
  should remain thin wrappers.
- Tests `MUST` fail when application/runtime plugin source in `plugins/` is confused with
  repository/application agent plugin workspaces in `.sdkwork/plugins/`.
- Tests `MUST` fail when `plugins/<plugin-name>/` lacks a README, component spec, source boundary,
  or tests appropriate for an installable application/runtime plugin.
- Tests `MUST` fail when source-controlled `configs/`, architecture-local `config/`, or
  `deployments/` includes user-private runtime config, live secrets, tokens, private keys,
  environment-local overrides, runtime databases, caches, logs, or generated local state.
- Tests `MUST` fail when root `tests/` fixtures contain real secrets, tokens, private customer data,
  or runtime state, or when package-local unit tests are moved to root `tests/` without a
  cross-package/contract/integration/e2e/static purpose.
- Every git repository root and SDKWork application root `MUST` be checked for `AGENTS.md`.
- `AGENTS.md` tests `MUST` verify required sections from `AGENTS_SPEC.md`, relative links to `sdkwork-specs/README.md`, `SOUL.md`, and `AGENTS_SPEC.md`, and task-to-spec mappings for on-demand language specs.
- Compatibility files such as `CLAUDE.md`, `GEMINI.md`, `CODEX.md`, `agent.md`, `AGENT.md`, or `agents.md`, when present, `MUST` point to `AGENTS.md` and must not duplicate a divergent rule body.
- `AGENTS.md` static scans `MUST` fail when the file copies large root spec bodies instead of linking to relative root specs.
- Every git repository root `MUST` be checked for `.sdkwork/README.md`,
  `.sdkwork/skills/README.md`, and `.sdkwork/plugins/README.md`.
- Every SDKWork application root `MUST` be checked for `.sdkwork/README.md`,
  `.sdkwork/skills/README.md`, and `.sdkwork/plugins/README.md`.
- Workspace tests `MUST` fail when `.sdkwork/skills/` or `.sdkwork/plugins/` exists only as an
  untracked empty directory with no committed placeholder or content.
- Skill tests `MUST` fail when a real skill directory under `.sdkwork/skills/<skill-name>/` lacks
  `SKILL.md` or when `<skill-name>` is not lowercase kebab-case.
- Plugin tests `MUST` fail when an installable plugin under `.sdkwork/plugins/<plugin-name>/` lacks
  `.codex-plugin/plugin.json` or when `<plugin-name>` is not lowercase kebab-case.
- Static scans `MUST` fail when source-controlled `.sdkwork/` contains obvious secrets, auth tokens,
  private keys, runtime databases, logs, caches, generated SDK transport output, or copied
  `~/.sdkwork/<application-code>` runtime state.
- Static scans `MUST NOT` treat generated SDK output
  `.sdkwork/sdkwork-generator-manifest.json`, `.sdkwork/sdkwork-generator-changes.json`, or
  `.sdkwork/sdkwork-generator-report.json` as repository/application workspace files. Those files
  are valid only below generated SDK output and are governed by `SDK_SPEC.md` and
  `SDK_WORKSPACE_GENERATION_SPEC.md`.

## 2.0.1 Repository Documentation Layout Tests

Repository documentation tests make `DOCUMENTATION_SPEC.md` section 2 executable.

Rules:

- Every independent git repository root and every independent SDKWork application root with active `docs/` `MUST` be checked for `docs/README.md`, `docs/product/prd/PRD.md`, and `docs/architecture/tech/TECH_ARCHITECTURE.md`.
- Tests `MUST` fail when root `README.md` or `AGENTS.md` does not link to the Canon documentation paths.
- Tests `MUST` fail when new architecture decision records are added under `docs/adr/` instead of `docs/architecture/decisions/`.
- Tests `SHOULD` verify `docs/product/requirements/REQ-*` and `docs/architecture/decisions/ADR-*` filenames follow the documented id patterns when those directories contain tracked records.
- Tests `SHOULD` verify `docs/INDEX.yaml` Canon paths when the file is present.
- Standards repositories `MUST` still provide Canon documentation, but `docs/product/prd/PRD.md` may describe standards governance instead of an end-user product.
- Narrow-purpose tool repositories `MAY` use a short non-product PRD stub when `docs/architecture/tech/TECH_ARCHITECTURE.md` documents integration boundaries.

Recommended commands:

```bash
node ../sdkwork-specs/tools/bootstrap-repository-docs.mjs --root .
node ../sdkwork-specs/tools/migrate-legacy-canon-paths.mjs --root .
node ../sdkwork-specs/tools/align-repository-docs.mjs --root .
node ../sdkwork-specs/tools/check-repository-docs-standard.mjs --root .
node ../sdkwork-specs/tools/check-apps-directory-index.mjs --root .
node ../sdkwork-specs/tools/check-workspace-packages-layout.mjs --root . --mode enforce
node ../sdkwork-specs/tools/check-workspace-packages-layout.mjs --workspace <workspace-root> --mode enforce
node ../sdkwork-specs/tools/check-workspace-packages-layout.mjs --workspace <workspace-root> --mode audit
node ../sdkwork-specs/tools/align-workspace-packages-layout.mjs --root . [--dry-run]
node ../sdkwork-specs/tools/align-workspace-packages-layout.mjs --workspace <workspace-root> [--dry-run]
node ../sdkwork-specs/tools/check-workspace-federation-paths.mjs --workspace <workspace-root>
node ../sdkwork-specs/tools/align-workspace-federation-paths.mjs --workspace <workspace-root> [--dry-run]
node ../sdkwork-specs/tools/check-workspace-lock-package-paths.mjs --workspace <workspace-root>
node ../sdkwork-specs/tools/align-workspace-lock-package-paths.mjs --workspace <workspace-root>
node ../sdkwork-specs/tools/align-openapi-response-envelope-workspace.mjs --workspace <workspace-root> [--dry-run]
node ../sdkwork-specs/tools/align-apps-directory-index.mjs --root .
node ../sdkwork-specs/tools/audit-apps-directory-index-workspace.mjs --workspace <workspace-root>
node ../sdkwork-specs/tools/audit-repository-docs-workspace.mjs --workspace <workspace-root>
```

## 2.0.2 Code Style And Naming Tests

Code style tests make `CODE_STYLE_SPEC.md`, `NAMING_SPEC.md`, and language specs executable.

## 2.0.3 pnpm Script Tests

pnpm script tests make `PNPM_SCRIPT_SPEC.md` executable.

Rules:

- Every SDKWork application repository root that uses `package.json#scripts`
  `MUST` expose `dev`, `build`, `test`, `check`, `verify`, and `clean`.
- Tests `MUST` fail when repository root public script names start with product
  tokens such as `drive`, `im`, `clawrouter`, or the application-specific
  application code.
- Tests `MUST` fail when root public script names contain retired deployment
  words such as `self-hosted`, `cloud-hosted`, `hosting`, or
  `deploymentMode`.
- Tests `MUST` fail when root or package-local script command values, standard
  command examples, or active command-bearing JSON use retired deployment
  flags or values such as `--hosting`, `self-hosted`, `cloud-hosted`, or
  `deploymentMode`.
- Tests `MUST` fail when runtime target scripts are exposed as
  platform/tool-first names such as `browser:*`, `desktop:*`, `tauri:*`,
  `docker:*`, `android:*`, `ios:*`, `harmony:*`, `flutter:*`, or
  `mini-program:*`. Public scripts use action-first names such as
  `dev:browser`, `dev:desktop`, `build:desktop`, `build:container`,
  `build:android-native`, and `build:mini-program`.
- Tests `MUST` fail when Tauri is used as a public runtime target suffix such
  as `dev:tauri`; Tauri is a tool/runtime implementation detail behind the
  canonical `desktop` runtime target.
- Tests `MUST` fail when gateway scripts use deployment profile before action,
  such as `gateway:cloud:bundle` or `gateway:standalone:pack`. Use
  `gateway:package:cloud` and `gateway:package:standalone`.
- Tests `MUST` fail when root `dev:browser` or `dev:desktop` defaults resolve
  to SQLite, cloud, split hidden topology, or retired `--hosting` flags. These
  defaults must resolve through their direct command value or root-script
  delegation chain to PostgreSQL, `unified-process`, and `standalone`; explicit
  alternatives use suffixed scripts such as `dev:desktop:sqlite` or
  `dev:browser:postgres:split-services:cloud`.
- Tests `MUST` verify new root API/SDK command families use `api:*` and
  `sdk:*` public namespaces for cross-application automation.
- Tests `MUST` scan app surface and package-local `package.json#scripts` for
  retired deployment words, retired public namespaces such as `server:*`,
  `service:*`, `portal:*`, `product:*`, `alignment:*`, `apis:*`, `file-sdk:*`,
  and `prepare:*`, and platform/tool-first runtime aliases such as `browser:*`,
  `desktop:*`, `tauri:*`, `docker:*`, `android:*`, `ios:*`, `harmony:*`,
  `flutter:*`, `mini-program:*`, and `*:tauri`, while ignoring generated SDK
  package manifests under generated output.
- Tests `MUST` scan active command-bearing JSON such as `sdkwork.app.config.json`,
  `sdkwork.workflow.json`, active `specs/*.json`, and Tauri config command hooks
  for the same application-code-prefix, action-first runtime target, and gateway command
  order rules, plus retired deployment flags and values.
- Application repositories may call the canonical validator with:

```text
node ../sdkwork-specs/tools/check-pnpm-script-standard.mjs --root . --application-code-prefix <application-code-token>
node ../sdkwork-specs/tools/check-identity-naming.mjs --root ../sdkwork-specs --mode standards
node ../sdkwork-specs/tools/check-identity-naming.mjs --root .
```

Rules:

- Naming tests `MUST` verify package, SDK family, API authority, route crate, component, and database identifiers touched by a change follow `NAMING_SPEC.md`.
- Component manifest tests `MUST` verify authored components include `CODE_STYLE_SPEC.md`, `NAMING_SPEC.md`, and only the language-specific specs required by `component.languages`.
- Rust code scans `MUST` fail when `src/lib.rs` contains handlers, repositories, SQL queries, provider clients, large DTO definitions, long business services, or test fixtures instead of module declarations and re-exports.
- Rust crate naming scans `MUST` verify authored Rust crates use one of the responsibility-specific
  families from `RUST_CODE_SPEC.md` and `APPLICATION_GATEWAY_SPEC.md`: `sdkwork-<domain>-<capability>-service`,
  `sdkwork-<domain>-<capability>-repository-sqlx`, `sdkwork-routes-<capability>-<surface>`,
  `sdkwork-<application-code>-service-host`,
  `sdkwork-<application-code>-native-host`, `sdkwork-<application-code>-tauri-host`,
  `sdkwork-<domain>-<capability>-worker`, `sdkwork-<application-code>-standalone-gateway`,
  `sdkwork-<application-code>-cloud-gateway`, or platform `sdkwork-api-cloud-gateway` as the
  platform `api-cloud-gateway`.
- Rust crate naming scans `MUST` fail on bare application gateway crate names such as
  `sdkwork-<application-code>-gateway` without a `standalone` or `cloud` qualifier.
- Rust crate naming scans `MUST` fail on retired platform listener crate names such as
  `sdkwork-api-cloud-gateway-api-server`; the canonical platform gateway crate is
  `sdkwork-api-cloud-gateway`.
- Application gateway crate scans `MUST` verify gateway crates live under `crates/` and declare
  `component.type` of `rust-standalone-gateway` or `rust-cloud-gateway` per `APPLICATION_GATEWAY_SPEC.md`.
- Rust HTTP route crate naming scans `MUST` verify Cargo package names follow
  `sdkwork-routes-<capability>-<surface>` per `API_SPEC.md` §4.2.
- Rust crate naming scans `MUST` fail on forbidden generic crate names such as
  `sdkwork-<application-code>-product`, `sdkwork-<application-code>-runtime`,
  `sdkwork-<domain>-<capability>-runtime`, `sdkwork-<application-code>-backend`,
  `sdkwork-<application-code>-core`, `sdkwork-<application-code>-common`, `sdkwork-<application-code>-manager`, and
  `sdkwork-<application-code>-server-runtime`.
- Rust service crate scans `MUST` verify service crates keep business behavior under `domain/`,
  `ports/`, and `service/`, and do not depend on concrete SQLx repository implementation crates.
- Rust SQLx repository crate scans `MUST` verify repository implementation crates keep database
  schema, row mapping, query bodies, and repository implementations under `db/`, `mapper/`, and
  `repository/`, and do not parse HTTP context or own business authorization.
- Rust route crate scans `MUST` verify `paths.rs`, `routes.rs`, `handlers.rs`, and `manifest.rs` exist when a crate owns SDKWork HTTP routes.
- Rust migration-only API server, service host, native host, worker, standalone gateway, cloud gateway, and
  platform gateway scans `MUST` verify runnable
  crates use the standard directories from `RUST_CODE_SPEC.md` and do not collapse business rules,
  SQL query bodies, route authority, and process startup into one catch-all crate.
- Java code scans `MUST` verify Spring controllers stay thin and do not own business logic, persistence, or provider calls.
- TypeScript code scans `MUST` verify `src/index.ts` is a public export boundary and that business modules do not import package internals through `/src/...`.
- Frontend code scans `MUST` verify UI components do not construct SDK clients or raw HTTP requests.
- I18n scans `MUST` fail when authored locale resources collapse a whole app, client root, backend/admin root, or package into one locale file instead of package-local fragments defined by `I18N_SPEC.md`.
- I18n directory scans `MUST` verify authored source fragments use the language/framework layouts from `I18N_SPEC.md` section 6.1: React and TypeScript under `src/i18n/<locale>/<domain>/<capability>/`, Flutter under `lib/src/i18n/<locale>/<domain>/<capability>/`, Android under `src/main/i18n/<locale>/<domain>/<capability>/`, iOS under `Sources/<Module>/I18n/<locale>/<domain>/<capability>/`, Harmony under `src/main/ets/i18n/<locale>/<domain>/<capability>/`, Rust under `resources/i18n/<locale>/<domain>/<capability>/`, Java/Spring under `src/main/resources/i18n/<locale>/<domain>/<capability>/`, and database seeds under `database/seeds/locales/<locale>/<domain>/<capability>/`.
- `tools/check-i18n-standard.mjs` is the canonical repository/workspace validator for authored i18n source layout, locale monolith rejection, platform aggregate projection markers, Rust/Java backend message bundle placement, database locale seed path shape, and exclusion of vendored or third-party source trees from SDKWork-authored layout enforcement.
- I18n scans `MUST` fail when platform aggregate files such as Android `res/values*/strings.xml`, iOS `*.lproj/Localizable.strings`, Harmony `resources/**/element/string.json`, Flutter `lib/l10n/app_*.arb`, or mini program platform resource bundles are hand-authored as feature-copy source instead of generated or thin projections from package-local fragments.
- I18n scans `MUST` fail when frontend services, UI components, backend handlers, or controllers manually parse or set locale headers instead of using runtime/framework locale providers.
- I18n scans `MUST` fail when runtime config, env templates, app manifests, or feature flags embed translated message content instead of strategy, manifest URLs, or bundle versions.
- I18n scans `MUST` fail when locale directory names use platform suffixes as authored source directories instead of normalized BCP 47 tags such as `zh-CN` and `en-US`.
- Generated-code scans `MUST` fail when generated SDK transport output is hand-edited outside approved `custom/` roots or composed facades.

## 2.0.2.1 Database Framework Tests

Database framework tests make `DATABASE_FRAMEWORK_SPEC.md` executable.

Rules:

- Application repositories that own a `database/` directory `MUST` provide `tests/contract/database-framework.contract.test.*` or call the canonical validator.
- Database framework tests `MUST` verify `database/database.manifest.json`, `database/contract/schema.yaml`, `database/seeds/seed.manifest.json`, required locale directories, and drift policy presence.
- Database framework tests `MUST` verify seed `i18nVersion`, fallback/default/supported/active locales, locale set versions, and checksums when locale-specific seed files exist.
- Database framework tests `MUST` verify L2 contract fields: `contractVersion: "1.0.0"`, `lifecycle.autoMigrate: true`, non-empty prefix/table registries, and at least one baseline `.sql` file under `database/ddl/baseline/<engine>/` for every engine declared in `database.manifest.json`.
- Database framework tests `MUST` verify root `db:validate`, `db:migrate`, `db:status`, `db:materialize:contract`, and `db:bootstrap` scripts exist when database lifecycle is active.
- Database framework tests `MUST` fail when crate-local `migrations/` remain the only migration source without an approved exception or adoption plan.
- Application repositories may call the canonical validator with:

```text
node ../sdkwork-specs/tools/check-database-framework-standard.mjs --root .
```

- Workspace maintainers `MAY` audit all `sdkwork-*` repositories with:

```text
node ../sdkwork-specs/tools/audit-database-framework-workspace.mjs --workspace ..
```

- New database modules `SHOULD` be scaffolded from `templates/database/` with:

```text
node ../sdkwork-specs/tools/bootstrap-database-module.mjs --repo <repo-name>
```

- Migration smoke tests `MUST` bootstrap an empty database to the latest schema on each supported engine.
- Seed smoke tests `MUST` prove `seeds/common` plus default locale `zh-CN` are idempotent and record locale/profile/`i18nVersion`/checksum evidence in seed history.
- Drift tests `MUST` prove a fresh bootstrap yields zero error-level drift.
- Drift tests `MUST` cover constraint/index diffs (`missing_constraint`, `extra_index`) and column nullability mismatches under `type_mismatch`.
- Checksum immutability tests `MUST` prove modified applied migration files fail migrate/plan with `checksum_mismatch`.
- Layout validation `MUST` fail when a numbered `.up.sql` migration lacks its paired `.down.sql`.

## 2.0.2.2 IAM Application Bootstrap Tests

IAM application bootstrap tests make `IAM_APPLICATION_BOOTSTRAP_SPEC.md` executable.

Rules:

- Application repositories that declare `sdkwork.app.config.json` or own `scripts/bootstrap/*` `MUST` depend on `@sdkwork/iam-application-bootstrap`.
- Bootstrap scripts `MUST NOT` embed raw bootstrap HTTP paths.
- Application repositories with IAM bootstrap `MUST` expose `admin:bootstrap:app` and `check:iam-application-bootstrap` (or `test:contract:iam-application-bootstrap`).
- Application repositories may call the canonical validator with:

```text
node ../sdkwork-specs/tools/check-iam-application-bootstrap-standard.mjs --root .
```

- Repositories that own `@sdkwork/iam-application-bootstrap` `MUST` run its package contract tests in IAM standard verification.

## 2.0.2 GitHub Workflow Tests

GitHub workflow tests make `GITHUB_WORKFLOW_SPEC.md` executable.

Rules:

- Application workflow tests `MUST` verify `sdkwork.workflow.json` exists when the application is packaged, released, or deployed through GitHub Actions.
- Application workflow tests `MUST` verify `.github/workflows/package.yml` is a thin reusable workflow call to `Sdkwork-Cloud/sdkwork-github-workflow/.github/workflows/sdkwork-package.yml@<pinned-ref>`.
- Application workflow tests `MUST` fail when large framework workflow bodies, dependency checkout scripts, matrix planning, release upload logic, or attestation logic are copied into application repositories.
- Application repositories may call the canonical entrypoint validator with:

```text
node ../sdkwork-specs/tools/check-agent-workflow-standard.mjs --root .
```

The validator covers application packaging workflow entrypoints, target
`deploymentProfile`/`runtimeTarget` metadata, copied release workflow drift,
repository/application `AGENTS.md` dynamic progressive loading, compatibility
shims, and relative `sdkwork-specs` path resolution.
- Framework planner tests `MUST` reject unknown config properties, schema-declared type violations, empty target lists, duplicate target ids, non-canonical target ids, duplicate target formats, unsupported enum values, missing or mismatched Linux native package distributions, mixed Linux native/generic formats, dynamic lifecycle `uses`, unsafe relative paths, dependency checkout path overlaps, unsafe dependency refs, unsupported dependency token secret names, deployment selectors that match no package target, and non-string lifecycle `env` values.
- Framework planner tests `MUST` prove JSON Schema, planner validation, example configs, generated bootstrap output, and reusable workflow policy consumption remain aligned.
- Package naming tests `MUST` prove package ids use `<platform>-<architecture>-<deployment-profile>-<profile>-<format-token>` for generic packages, Linux native `deb`/`rpm` package ids use `linux-<distribution>-<architecture>-<deployment-profile>-<profile>-<format-token>`, variant packages use `<platform>-<architecture>-<deployment-profile>-<profile>-<variant>-<format-token>` or `linux-<distribution>-<architecture>-<deployment-profile>-<profile>-<variant>-<format-token>`, artifact names use `<artifactPrefix>-<packageId>`, `tar.gz` becomes `tar-gz`, server packages do not use `service` aliases, Windows desktop targets cover both `msi` and `exe` when both installers are configured, and browser, H5, server, PC desktop, Capacitor, Flutter, native mobile, tablet, mini program, container, variant, and multi-format targets remain unique.
- Package target taxonomy tests `MUST` prove `platform`, package `profile`,
  `deploymentProfile`, and `runtimeTarget` are separate fields. They must fail
  when package profile is `web`, `docker`, `standalone`, or `cloud`; when
  platform is used as `runtimeTarget`; or when runtime target is used as
  deployment profile.
- Package runtime target tests `MUST` cover every canonical `CONFIG_SPEC.md`
  runtime target used by the application: `browser`, `desktop`,
  `tablet-ipados`, `tablet-android`, `capacitor-ios`, `capacitor-android`,
  `flutter-ios`, `flutter-android`, `android-native`, `ios-native`,
  `harmony-native`, `mini-program`, `server`, `container`, and
  `test-runner`. Tests must fail when `mobile`, `native`, `web`, or `docker`
  is used as a runtime target.
- Toolchain tests `MUST` prove `actions/setup-toolchains` consumes every planner output for supported toolchains instead of silently ignoring declared language versions or mobile/native toggles.
- Matrix tests `MUST` cover platform, architecture, deployment profile, package
  profile, runtime target, format, multi-format artifact naming, no-target
  failure behavior, browser/H5 targets, mobile/native targets, mini program
  targets, container/Docker-compatible targets, and tablet targets when tablet
  packaging is supported.
- Version resolution tests `MUST` prove GitHub workflow matrix summaries, lifecycle environments, and changelog planning prefer explicit package versions, then normalized release tags, then `release.defaultVersion`.
- Generator tests `MUST` prove `init-app` emits canonical starter targets for requested profiles, including Linux Debian `deb`, Linux RHEL `rpm`, generic Linux `tar.gz`, Windows desktop `msi`, Windows desktop `exe`, macOS desktop `dmg`, browser/H5 web URL targets, container OCI targets, mobile app targets, tablet targets, and mini program package targets when those profiles are requested.
- Generator tests `MUST` prove generated lifecycle placeholder steps are shell-neutral across Linux, Windows, and macOS runners by using an explicit supported shell and reading SDKWork values through a shell-neutral environment API such as `process.env`.
- Lifecycle tests `MUST` prove package and deployment environment variables are injected into lifecycle steps, Linux native package deployment keeps `SDKWORK_PACKAGE_DISTRIBUTION`, variant package deployment keeps `SDKWORK_PACKAGE_VARIANT`, and execution stops on failure.
- Publication tests `MUST` prove `publish.workflowArtifact`, `publish.githubRelease`, `publish.retentionDays`, and caller inputs are both respected.
- Aggregate Release tests `MUST` prove `publish.aggregateRelease`, `publish.aggregateArtifactPath`, and `publish.aggregateUploadGlobs` are validated by planner and schema; per-target GitHub Release upload is disabled when aggregate mode is enabled; the reusable workflow adds exactly one aggregate publish job; package workflow artifacts are downloaded before final publication; `lifecycle.publish` receives `SDKWORK_RELEASE_AGGREGATE=true`, `SDKWORK_PACKAGE_ID=aggregate-release`, and aggregate path/glob environment; framework changelog rendering still supplies the GitHub Release `notes-file`; and final upload uses `publish.aggregateUploadGlobs`.
- Changelog tests `MUST` prove `release.changelog` validation, manifest `release.notes[]` rendering, stale manifest note rejection for non-matching package versions or release tags, file-based changelog rendering, git fallback rendering, generated `init-app` default changelog config, and GitHub Release `notes-file` upload wiring.
- Supply-chain tests `MUST` prove `security.signingRequired`, `security.sbomRequired`, `security.artifactAttestations`, target-level signing overrides, and artifact attestation gates are enforced.
- Dependency checkout tests `MUST` prove refs are safe before `git fetch`, checkout paths are safe, tokens are not embedded in clone URLs, and dependency ref JSON inputs are passed through environment variables or files rather than direct shell expression interpolation.
- Dependency checkout tests `MUST` prove workflow checkout paths are safe implementation details, native build-tool source paths do not depend on machine-specific absolute paths, packaged applications declare the SDKWork repository refs they need in `sdkwork.workflow.json`, and unused dependencies are not left in `sdkwork.workflow.json`.
- Composite action tests `MUST` prove shell-based actions pass action inputs through environment variables or structured argument arrays instead of embedding `${{ inputs.* }}` directly in shell script bodies.
- Repository validation tests `MUST` include both a negative case for `${{ inputs.* }}` inside literal `run` script bodies and a positive case proving later `env:`, `with:`, `if:`, or reusable workflow metadata expressions are not misclassified as shell script content.
- Deployment tests `MUST` prove configured deployments bind to GitHub Environments and pass deployment environment, URL, and lifecycle values to the lifecycle runner.
- Repository validation for `sdkwork-github-workflow` `MUST` check `AGENTS.md`, compatibility shims, `.sdkwork/` files, reusable workflow YAML, composite actions, schema, examples, templates, generator output, and repository documentation.

## 2.0.3 Engineering Lifecycle Tests

Engineering lifecycle tests make `REQUIREMENTS_SPEC.md`, `ARCHITECTURE_DECISION_SPEC.md`, `ENGINEERING_WORKFLOW_SPEC.md`, `CODE_REVIEW_SPEC.md`, `QUALITY_GATE_SPEC.md`, `RELEASE_SPEC.md`, `MIGRATION_SPEC.md`, and `SUPPLY_CHAIN_SECURITY_SPEC.md` executable.

Rules:

- Requirement checks `MUST` fail when non-trivial behavior, contract, runtime, security, release, or migration changes have no requirement record, no acceptance criteria, no owner, or no verification mapping.
- ADR checks `MUST` fail when boundary, ownership, API/SDK authority, persistence, runtime topology, security posture, release posture, or cross-client architecture decisions are implemented without an architecture decision record.
- Workflow checks `MUST` verify the work records intake, clarification or explicit no-ambiguity statement, decision/plan when applicable, implementation scope, verification evidence, review state, release/migration handoff, and blocker handling.
- Review checks `MUST` verify risk level, reviewer evidence, generated artifact treatment, security/privacy/supply-chain coverage when applicable, and explicit review outcome.
- Quality gate checks `MUST` verify Definition of Ready before implementation, Definition of Done before completion, merge gate before merge, release gate before release, and exception gate before an approved deviation.
- Release checks `MUST` verify version, artifacts, changelog, rollout, rollback, release freeze when applicable, post-release follow-up, and release gate evidence.
- Migration checks `MUST` verify compatibility window, affected consumers, sequencing, rollback, data/contract/config/package coverage, verification commands, and owner approval.
- Supply-chain checks `MUST` verify dependency sources, lockfiles or pinned refs, generated artifact authority, build inputs, SBOM, provenance, signing, checksums, attestations, and exception expiry.
- Lifecycle evidence checks `SHOULD` be static and deterministic when possible; manual evidence is acceptable only when the local repository has no executable source for the decision.

## 2.1 Rust Route Manifest Contract Tests

Rust route manifest verification makes route/path configuration executable instead of convention-only.

Rules:

- Route manifest tests `MUST` validate `schemaVersion`, `kind: sdkwork.route.manifest`,
  `packageName`, `surface`, `owner`, `domain`, `capability`, `apiAuthority`, `sdkFamily`, `prefix`,
  and a non-empty `routes` list.
- Route manifest tests `MUST` prove `packageName` follows
  `sdkwork-routes-<capability>-<surface>`, the source directory follows
  `packages/<packageName>/`, and the normalized artifact path follows
  `sdks/_route-manifests/<surface>/<packageName>.route-manifest.json` when normalized artifacts are
  produced.
- Surface-prefix tests `MUST` fail when `app-api` routes do not use `/app/v3/api`, `backend-api`
  routes do not use `/backend/v3/api`, or `open-api` routes use `/app/v3/api` or
  `/backend/v3/api`. Open-api tests `MUST` allow only the approved versioned domain prefix declared
  by the authority, for example `/im/v3/api`.
- Route-entry tests `MUST` validate uppercase HTTP method, full path including prefix, stable
  operationId, non-empty tags, `requestContext: WebRequestContext`, route-level `apiSurface`, auth
  projection, handler traceability, schema references when known, and source traceability.
- Route-entry tests `MUST` fail when `apiSurface` or `x-sdkwork-api-surface` uses camelCase
  runtime labels such as `openApi`, `appApi`, or `backendApi`; contract artifacts use canonical
  kebab-case labels such as `open-api`, `app-api`, and `backend-api`.
- Duplicate tests `MUST` fail on duplicate `(method, path)` pairs after path-template
  normalization.
- Route registry tests `MUST` prove `check-route-path-collisions.mjs` fails when two route manifests,
  two OpenAPI authorities, or a route manifest and an OpenAPI authority declare distinct operations
  with the same normalized `(surface, method, path)`.
- Ownership and framework metadata tests `MUST` prove the route manifest owner, API authority, SDK
  family, route-level ownership, `requestContext`, `apiSurface`, and optional `rateLimitTier`
  materialize to `x-sdkwork-owner`, `x-sdkwork-api-authority`, `x-sdkwork-source`,
  `x-sdkwork-source-route-crate`, `x-sdkwork-request-context`, `x-sdkwork-api-surface`, and
  `x-sdkwork-rate-limit-tier` when present in the authority OpenAPI.
- Auth-mode tests `MUST` prove protected app-api/backend-api routes project dual-token security,
  protected open-api routes project API key, OAuth bearer, or flexible open-api security according to the route manifest,
  and public SDK-generated routes project both `security: []` and
  `x-sdkwork-auth-mode: anonymous`.
- Credential-entry tests `MUST` prove login, registration, OAuth session creation, QR auth session
  creation or password completion, password reset request, password reset completion, and equivalent
  anonymous credential-entry operations set `forbidCredentialHeaders: true`, materialize
  `x-sdkwork-forbid-credential-headers: true`, and reject inbound `Authorization`, `Access-Token`,
  `X-Api-Key`/`X-API-Key`, SDKWork identity projection headers, and equivalent credential headers.
- Open-api prefix tests `MUST` prove approved domain prefixes such as `/im/v3/api` classify as
  `open-api` and fail when framework/materializer code recognizes only a literal `/open/v3/api`
  prefix.
- Aggregation tests `MUST` fail on mixed surfaces, mismatched owner/domain/API authority/SDK family,
  wrong prefix, missing or mismatched `requestContext`/`apiSurface`, operationId/tag/domain
  mismatch, and dependency-owned operations declared in the consuming authority.
- Determinism tests `SHOULD` run route-manifest-to-authority materialization twice and compare the
  produced authority OpenAPI and derived `*.sdkgen.*` inputs.

## 2.2 RPC Contract Tests

Rules:

- RPC manifest tests `MUST` verify every service method maps to an SDKWork operationId or a documented composition method.
- Public RPC packages `MUST` generate and compile Rust clients plus at least one non-Rust client in CI or release validation.
- Rust RPC server tests `MUST` cover metadata auth, access token, request id, trace, deadline, idempotency key, and error mapping.
- Health and reflection behavior `MUST` be tested for standalone development,
  customer-owned internal, and production cloud configuration.
- RPC adapter tests `MUST` verify the adapter uses runtime/service boundaries and does not depend on HTTP/Tauri adapters or direct SQLx storage unless explicitly approved.

## 2.2.1 RPC Framework Integration Tests

RPC framework integration tests prove every SDKWork gRPC server and approved cross-process RPC client follows `RPC_FRAMEWORK_SPEC.md`.

Rules:

- RPC-enabled service hosts `MUST` include framework pipeline assembly checks for server stages and approved client stages.
- Static scans `MUST` fail when business modules construct raw gRPC channels or stubs when a generated SDKWork RPC family exists.
- Bootstrap tests `MUST` prove RPC clients are injected into services instead of being read from environment variables in business modules.
- Framework integration tests `MUST` verify metadata providers, deadline propagation, and error mapping on at least one unary smoke path per enabled RPC surface.
- Standards repositories and `sdkwork-rpc-framework` `MUST` run `node tools/check-rpc-framework-standard.mjs` from the parent workspace root.
- Discovery-aligned repositories `MUST` run `node tools/check-discovery-standard.mjs` from the parent workspace root.

## 2.2.2 Discovery Integration Tests

Discovery integration tests prove registry/config/watch behavior follows `DISCOVERY_SPEC.md`.

Rules:

- Discovery-enabled RPC hosts `MUST` test register, renew, and deregister lifecycle ordering.
- Resolver integration tests `MUST` prove `discovery` and approved `composite` profiles resolve healthy gRPC instances.
- Watch replay tests `MUST` prove clients can reconnect from a prior revision.
- Production config validation tests `MUST` reject unsigned local context, inline secrets, and non-durable storage providers for discovery.

## 2.2.3 RPC Resilience Tests

RPC resilience tests prove deadlines, retries, budgets, drain, and breaker behavior follow `RPC_RESILIENCE_SPEC.md`.

Rules:

- Non-idempotent RPC writes `MUST` have tests proving retry is blocked without idempotency metadata.
- Graceful shutdown tests `MUST` prove deregister and drain ordering when discovery is enabled.
- Resilience profile tests `MUST` verify retry status whitelists match manifest declarations.

## 2.3 Web Backend Implementation Tests

Web backend tests prove the implementation follows `WEB_BACKEND_SPEC.md`, not only that the OpenAPI document validates.

Rules:

- Controller/router tests `MUST` prove mounted paths, HTTP methods, class/module prefixes, and route
  manifests match the approved API surface and authority OpenAPI.
- Handler tests `MUST` cover request decoding, operation-pattern success mapping from `API_SPEC.md` section 15.4, `SdkWorkApiResponse` success mapping, delete `204` no-body mapping, problem-detail mapping, typed list/search input per section 14.1 for business open-api handlers, vendor adapter passthrough only for operations marked `x-sdkwork-wire-protocol: external`, request context consumption, and the absence of raw credential parsing.
- Service/use-case tests `MUST` run without an HTTP server and cover business rules, authorization
  decisions, tenant/data-scope behavior, idempotency, transaction boundaries, events, cache
  invalidation, and provider adapter calls where relevant.
- Create/update/delete/command service tests `MUST` prove transaction boundaries, idempotency replay/conflict behavior, optimistic concurrency conflict mapping, audit/event/cache side effects, and no duplicate irreversible side effects on retry.
- Repository tests `MUST` cover tenant predicates, organization/data-scope predicates, optimistic
  concurrency, migration compatibility, TEXT-stored `instant` cast comparisons for IAM/session/token expiry paths, and index/query shape for high-traffic queries.
- Static scans `MUST` fail when handlers or services parse `Authorization`, `Access-Token`,
  `X-API-Key`, request IDs, tenant IDs, organization IDs, user IDs, or permission scopes from raw
  headers instead of consuming the typed request context.
- Static scans `MUST` fail when route crates/controllers depend on the generated SDK for the same
  authority, when UI/service code imports route constants, or when dependency-owned routes are
  copied into an application-owned API authority.
- Provider adapter tests `MUST` prove raw HTTP usage, when present, is isolated inside an approved
  provider adapter and does not leak provider DTOs or raw provider errors into SDKWork API schemas.

### 2.3.1 Web Framework Integration Tests

Web framework integration tests prove every SDKWork HTTP `*-api` runtime follows
`WEB_FRAMEWORK_SPEC.md`, not only `WEB_BACKEND_SPEC.md`.

Rules:

- Application repositories and modules that own, serve, develop, proxy, or compose any SDKWork HTTP
  `*-api` surface `MUST` include framework integration checks.
- Repositories with Rust HTTP route crates, migration-only API servers, or gateways `MUST` include verification that
  `sdkwork-web-framework` is declared as a dependency.
- Bootstrap smoke tests `MUST` prove gateways and migration-only API servers mount routes through framework
  bootstrap rather than ad hoc Axum/Tower security stacks.
- Pipeline contract tests `MUST` prove the standard 18-stage interceptor order is not bypassed for
  protected routers or gateway proxy/composition routes.
- Locale context tests `MUST` prove public and protected SDKWork HTTP routes receive `WebRequestContext.locale`, unsupported requested locales resolve through the configured fallback chain, and handlers/controllers do not parse locale headers directly.
- Locale response tests `MUST` prove localized responses emit `Content-Language`, language-varying responses emit `Vary: Accept-Language`, and framework problem mapping preserves numeric `ProblemDetail.code`/`traceId` while exposing safe `i18nKey`/`locale` metadata when configured.
- Route manifest tests `MUST` fail when any route entry omits `requestContext: WebRequestContext` or
  `apiSurface`.
- OpenAPI/materialization tests `MUST` fail when HTTP operations omit
  `x-sdkwork-request-context: WebRequestContext` or `x-sdkwork-api-surface`.
- SDK workspace tests `MUST` fail when derived `*.sdkgen.*` inputs drop
  `x-sdkwork-request-context`, `x-sdkwork-api-surface`, or required rate-limit tiers from the
  authority OpenAPI.
- Static scans `MUST` fail when route crate handlers or Java controller methods parse
  `Authorization`, `Access-Token`, `X-API-Key`, tenant IDs, organization IDs, user IDs, permission
  scopes, request IDs, locale, or language from raw headers instead of consuming `WebRequestContext` or the Java
  typed-context equivalent.
- Java/Spring tests, when Java API modules are present, `MUST` prove typed context argument
  resolution, interceptor order, centralized problem-detail mapping, and OpenAPI/manifest metadata
  parity with the Rust framework profile.
- Open-api auth check: protected routes declare `api-key`, `oauth`, or `open-api-flexible`; security vectors cover missing credentials, API key resolution, OAuth bearer resolution, and flexible scheme selection.
- Architecture tests `MUST` fail when `sdkwork-web-framework` depends on business route crates or when business repositories vendor framework pipeline source locally.

## 2.4 PC Application Architecture Tests

PC application architecture tests make `APP_PC_ARCHITECTURE_SPEC.md` executable.

Rules:

- PC application root tests `MUST` verify `.sdkwork/`, `src/`, `packages/`, `sdks/`, `scripts/`, and required package metadata exist for every new PC application root.
- PC application capability tests `MUST` verify runtime/bootstrap, SDK/IAM composition, app shell, console shell, admin shell, domain packages, native host package, release commands, observability, and package-boundary verification have explicit owners when those capabilities are present.
- Package naming tests `MUST` fail when new PC packages omit the `pc` segment, for example `sdkwork-<application-code>-console-*` or `sdkwork-<application-code>-admin-*`.
- Package naming tests `MUST` recognize `sdkwork-<application-code>-pc-<capability>` as the default user-facing app package family.
- Console package tests `MUST` recognize only `sdkwork-<application-code>-pc-console-<capability>` as user-facing management console packages and must fail if they import `pc-admin` internals.
- Admin package tests `MUST` recognize only `sdkwork-<application-code>-pc-admin-<capability>` as `backend-admin` company-internal admin packages and must fail if they import app/user or `pc-console` internals for business behavior.
- Surface SDK tests `MUST` prove app and console packages use generated app SDK clients or approved appbase wrappers, while `backend-admin` packages use generated backend SDK clients or approved backend wrappers.
- SDK export boundary tests `MUST` prove app/frontend core packages export the application-owned app SDK and required dependency app SDK wrappers, including appbase app SDK wrappers, and do not export backend SDK wrappers, appbase backend SDK wrappers, backend base URL resolvers, or backend generated SDK clients.
- `backend-admin` SDK boundary scans `MUST` fail when app packages, app auth runtime, user-facing console packages, or shared frontend core packages import backend SDK packages, appbase backend SDK clients, backend wrapper functions, or backend base URL resolvers. The same scans `MUST` allow those imports only in `backend-admin` package families such as PC `pc-admin-*`, standalone backend/admin React domain packages, or backend service modules acting for admin workflows.
- Non-admin SDK boundary tests `MUST` prove every app package, user-facing console package, app auth runtime package, shared frontend core package, mobile/native/desktop renderer package, and app-side service package uses generated app SDK clients or approved app SDK wrappers for SDKWork remote capabilities. These tests `MUST` fail on backend SDK imports, backend SDK exports, backend SDK client construction, backend SDK proxy/wrapper facades, backend generated SDK package exposure, backend base URL resolver access, or appbase backend SDK client use.
- Appbase app SDK directory tests `MUST` prove user-facing IAM directory/contact resources required by contacts, address books, workspace navigation, organization tree, department tree, memberships, assignments, positions, and role-binding read views are exported through app SDK or approved app SDK wrappers. Tests must not pass by deleting the app SDK export.
- Static scans `MUST` fail when app/console/admin packages use raw HTTP, manual `Authorization`, `Access-Token`, or `X-API-Key` headers for business flows.
- Root thinness tests `SHOULD` fail when root `src/` contains business service implementations, mock data arrays, domain repositories, or feature-specific SDK orchestration outside bootstrap/core.
- Desktop/tablet-enabled PC roots `MUST` run the native host verification required by `DESKTOP_APP_ARCHITECTURE_SPEC.md`, including `sdkwork-<application-code>-pc-desktop` package placement, Tauri `devUrl`, `frontendDist`, capabilities, permissions, platform config files, web fallback, iPadOS packaging, and Android tablet packaging when enabled.
- Tablet packaging tests `MUST` verify iPadOS/Android tablet targets reuse the PC renderer, SDK clients, appbase IAM runtime, global TokenManager, and route ownership instead of introducing phone-first H5 or mobile-only auth/runtime code.
- Tablet packaging tests `MUST` verify safe-area, orientation, virtual keyboard, pointer/keyboard, touch/stylus, split view or multi-window behavior where supported, and foreground/background lifecycle handling when tablet targets are enabled.
- Route tests `MUST` prove app, console, and admin route contributions are assembled by their owning shell and do not share hidden route constants or backend API paths.
- Config tests `MUST` prove PC roots separate browser public runtime config, desktop user runtime config, desktop-started server config, container config, and Tauri platform config.
- Profile tests `MUST` prove `dev` normalizes to `development`, `prod` normalizes to `production`, unknown profile aliases fail, and Vite/Tauri/Spring build modes do not replace the SDKWork runtime environment model.
- SDK base URL tests `MUST` prove private env, browser public runtime env, and Vite dev env resolve independent open-api, app-api, backend-api, and dependency SDK base URLs without falling back to one ambiguous global URL.
- Shared gateway launch tests `MUST` prove foundation dependency SDK defaults use the declared
  common gateway root or managed `sdkwork-api-cloud-gateway` process, application-owned app/backend/open
  API base URLs remain application-owned, and per-module foundation upstream env vars are explicit
  overrides rather than default materialized config.
- Credential config tests `MUST` prove private bootstrap `SDKWORK_ACCESS_TOKEN` is documented for application roots that call protected APIs, is rejected from `VITE_*` and `PORTAL_PUBLIC_*`, and is superseded by appbase session tokens after login. `AUTH_TOKEN`, `REFRESH_TOKEN`, `API_KEY`, `VITE_*_TOKEN`, and `PORTAL_PUBLIC_*_TOKEN` remain rejected in environment configuration outside explicitly marked test fixtures.
- Access token header tests `MUST` prove SDKWork v3 app-api/backend-api clients use `Access-Token` exactly, send JWT compact serialization values, reject aliases such as `X-Access-Token` or query-string access tokens, reject semicolon claim-string access tokens, and reject auth/access JWTs missing `token_version` or carrying obsolete/future versions outside the configured upgrade window.
- Test-profile tests `MUST` prove database/schema, Redis key prefix, logs, cache, runtime, and temp directories are isolated from development and production.
- Release preflight tests `MUST` fail when production PC/desktop/server config contains localhost service endpoints, development secrets, test database names, writable developer directories, unresolved placeholders, or source-controlled secret files.
- Tauri platform config tests `MUST` prove platform files own bundle ids, package names, window metadata, permissions, capabilities, icons, mobile/tablet metadata, and signing references only; they must not contain auth tokens, database credentials, API keys, SDK package ownership, or business route constants.

## 2.4.1 Client Architecture Alignment Tests

Client architecture alignment tests make `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md` executable across PC, H5, Flutter, mini program, native Android, native iOS, native HarmonyOS, and future client roots.

Rules:

- Client root tests `MUST` verify root layout, `.sdkwork/`, `config/`, `src/` or `lib/` bootstrap, `packages/`, `sdks/`, `specs/`, scripts, and tests according to the selected root architecture standard.
- Package taxonomy tests `MUST` prove packages use the selected architecture segment and reserved roles such as `core`, `commons`, `shell`, capability, `console-*`, `admin-*`, and `host`.
- Package taxonomy tests `MUST` prove packages without a `console` or `admin` role segment are default app/user packages, `console-<capability>` packages are user-facing management console packages, and `admin-<capability>` packages are `backend-admin` internal operator packages.
- SDK boundary tests `MUST` prove default app and user-console packages use app-api/app SDK clients or approved appbase wrappers, while admin packages use backend-api/backend SDK clients or approved backend wrappers.
- Dependency direction tests `MUST` fail when `core` or `commons` imports capability packages, when capability packages deep import each other, or when host packages own business SDK transport.
- Route identity tests `MUST` prove route ids follow `<surface>.<domain>.<capability>.<screen>` and route metadata does not declare API URLs, SDK methods, or HTTP path constants.
- Cross-client alignment tests `SHOULD` prove workflows implemented in multiple client roots share route id, title key, permission hint, SDK surface, service contract, and i18n key.
- I18n alignment tests `SHOULD` prove shared workflows use stable key prefixes while each client architecture keeps authored locale resources in its own package-local fragments and language/framework layout from `I18N_SPEC.md` section 6.1.
- SDK locale provider tests `SHOULD` prove generated SDK clients receive locale providers from runtime/bootstrap and feature services do not set `Accept-Language` or `X-SdkWork-Locale` manually.
- Host adapter tests `MUST` prove feature packages depend on adapter contracts instead of platform globals or native plugin APIs.
- SDK/IAM tests `MUST` prove bootstrap/core constructs SDK clients, binds the authenticated token manager, and injects SDK/service ports into feature packages.

Native composition tests make `APP_COMPOSITION_SPEC.md` executable across client application roots.

Rules:

- Composable architecture tests `MUST` prove every applicable row in `COMPOSABLE_ARCHITECTURE_SPEC.md` section 1.1 maps from primary standard to machine contract to validator evidence. Missing `component.spec.json` fields, route manifest metadata, permission catalog refs, OpenAPI extensions, SDK dependency declarations, or generated `composition.resolved.json#architecture` output must fail before merge.
- Client app roots must expose composition metadata through `*-core/specs/component.spec.json#contracts.sdkDependencies` without a parallel dependency manifest file.
- Component closure tests `MUST` include `node tools/check-component-port-bindings.mjs --root <repo-root>` whenever new authored modules, package roles, runtime entrypoints, dependency API surfaces, provided ports, or required ports are added or changed.
- Frontend composition verification `MUST` include `node tools/check-frontend-composition.mjs --root <repo-root>` whenever client package roles, core imports, SDK access, host adapters, app/user console packages, or internal admin packages are added or changed.
- Rust backend composition verification `MUST` include `node tools/check-rust-backend-composition.mjs --root <repo-root>` whenever Cargo members, route crates, service crates, repository crates, service-hosts, gateway crates, workers, or Rust runtime dependencies are added or changed.
- Internationalization verification `MUST` include `node tools/check-i18n-standard.mjs --root <repo-root>` whenever authored locale fragments, generated platform localization projections, backend message resources, or database locale seeds are added or changed.
- Composition tests `MUST` prove backend SDK clients appear only under `backend-admin` core packages.
- Core package tests `MUST` prove `src/composition/` or `lib/composition/` exists and required public export subpaths are declared for TypeScript/React core packages.
- Bootstrap tests `MUST` prove runtime SDK inventory is derived from core `component.spec.json` and composition entry rather than a second handwritten inventory.
- Feature package import tests `MUST` fail when capability packages import generated SDK packages or sibling capability private paths directly.
- Workspace verification `MUST` include `node tools/verify-repo.mjs --root <repo-root>` and repo-root `pnpm-workspace.yaml` must be synchronized via `node tools/sync-workspace.mjs --repo <repo-name> --root <repo-root>`.
- Composition resolver verification `MUST` include `node tools/resolve-composition.mjs --root <repo-root> --write` and `node tools/check-composition-resolver.mjs --root <repo-root>` for client application repositories with `sdkDependencies`.
- Composition resolver tests `MUST` fail when generated `generated/composition.resolved.json#architecture` is missing component layer roles, frontend package role graph, Rust crate graph summary, route manifest inventory, runtime dependency API surfaces, or inherited permission refs required by declared SDK dependencies.
- Permission composition verification `MUST` include `node tools/check-permission-composition.mjs --root <repo-root>` for client application repositories with HTTP `sdkDependencies`.
- Permission composition tests `MUST` fail when HTTP `sdkDependencies` have no `contracts.permissionComposition`, when dependency SDKs lack inherited module catalog refs, or when OpenAPI `x-sdkwork-permission` codes are absent from inherited or application-owned catalogs.

## 2.4.2 H5 Application Architecture Tests

H5 application architecture tests make `APP_H5_ARCHITECTURE_SPEC.md` executable.

Rules:

- H5 mobile root tests `MUST` verify `.sdkwork/`, `config/browser`, `config/host`, `src/bootstrap`, `packages/`, `sdks/`, `scripts/`, and tests exist.
- Package naming tests `MUST` prove packages use `sdkwork-<application-code>-h5-*`, including reserved `core`, `commons`, `shell`, `console-*`, `admin-*`, and `capacitor` package roles.
- H5 surface tests `MUST` prove `sdkwork-<application-code>-h5-<capability>` packages are default app/user packages, `sdkwork-<application-code>-h5-console-<capability>` packages are user-facing management console packages, and `sdkwork-<application-code>-h5-admin-<capability>` packages are `backend-admin` packages.
- H5 SDK boundary tests `MUST` prove app and console packages use generated TypeScript app SDK clients or approved appbase wrappers, while admin packages use generated backend SDK clients or approved backend wrappers.
- Renderer sharing tests `MUST` prove H5, Capacitor iOS, and Capacitor Android targets reuse the same renderer build, route contributions, SDK clients, appbase IAM runtime, and global TokenManager.
- Capacitor boundary tests `MUST` fail when feature packages import Capacitor plugins or platform globals directly.
- Mobile host adapter tests `MUST` cover unsupported, permission-denied, unavailable, cancelled, and invalid-state errors for native capabilities used by features.
- Deep-link tests `MUST` validate expected scheme, host, path, state, nonce, expiry, and unsafe-link rejection.
- Push lifecycle tests `MUST` cover permission denied, token registration, token refresh, logout unregister/clear, and foreground/background handling when push is enabled.
- H5 config tests `MUST` prove browser public runtime config loads before SDK construction and contains no secrets, tokens, database URLs, Redis URLs, private endpoints, or signing material.
- Capacitor host config tests `MUST` prove host config owns only bundle/package ids, schemes, app links/universal links, permissions, capabilities, icons, signing references, and store metadata.
- H5/Capacitor release preflight tests `MUST` validate H5 URLs, IPA/App Store metadata, APK/AAB/Google Play metadata, governed media, checksums, SBOM/provenance, signing references, and secret absence.

## 2.4.3 Flutter App Mobile Architecture Tests

Flutter app mobile architecture tests make `FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC.md` executable.

Rules:

- Flutter root tests `MUST` verify `.sdkwork/`, `config/app`, `config/host`, `lib/bootstrap`, `packages/`, `sdks/`, scripts, and tests exist.
- Dart package naming tests `MUST` prove Flutter mobile packages use lower snake case names such as `sdkwork_<application_code>_flutter_mobile_<capability>`, `sdkwork_<application_code>_flutter_mobile_console_<capability>`, or `sdkwork_<application_code>_flutter_mobile_admin_<capability>`.
- Flutter surface tests `MUST` prove packages without `_console_` or `_admin_` are default app/user packages, `_console_` packages are user-facing management console packages, and `_admin_` packages are `backend-admin` packages.
- Flutter SDK boundary tests `MUST` prove app and console packages use generated Dart/Flutter app SDK clients or approved appbase Flutter wrappers, admin packages use generated Dart/Flutter backend SDK clients or approved backend wrappers, and no raw `http`, manual auth headers, TypeScript wrappers, React packages, or generated SDK edits are introduced.
- Root thinness tests `SHOULD` fail when root `lib/` contains business screens, generated SDK orchestration outside bootstrap, mock data arrays, or feature-specific services.
- Platform adapter tests `MUST` prove widgets, controllers, blocs, notifiers, and services do not call platform plugins or method channels directly.
- Flutter route tests `MUST` prove named routes or router entries map to SDKWork route ids and align with cross-client route metadata when the workflow exists elsewhere.
- Flutter state tests `MUST` prove logout, refresh failure, tenant switch, and account switch clear secure platform storage, token manager, context store, sensitive state, and realtime/session bridges.
- Flutter release preflight tests `MUST` validate iOS/Android package metadata, signing references, icons, screenshots, checksums/SBOM/provenance, and secret absence.

## 2.4.4 Mini Program Architecture Tests

Mini program architecture tests make `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` executable.

Rules:

- Mini program root tests `MUST` verify `.sdkwork/`, `config/mini-program`, `config/host`, `src/bootstrap`, `packages/`, route projection targets, `sdks/`, scripts, and tests exist.
- Package naming tests `MUST` prove SDKWork source packages use `sdkwork-<application-code>-mp-*` and reserved `core`, `commons`, `shell`, `console-*`, `admin-*`, and `host` roles.
- Mini program surface tests `MUST` prove `sdkwork-<application-code>-mp-<capability>` packages are default app/user packages, `sdkwork-<application-code>-mp-console-<capability>` packages are user-facing management console packages, and `sdkwork-<application-code>-mp-admin-<capability>` packages are `backend-admin` packages.
- Mini program SDK boundary tests `MUST` prove app and console packages use generated TypeScript app SDK clients or approved mini program wrappers, admin packages use generated backend SDK clients or approved backend wrappers, and no raw request APIs, manual auth headers, backend SDKs for user workflows, or generated SDK edits are introduced.
- Package/subpackage boundary tests `MUST` fail when platform `pages` or `subpackages` become the source business architecture instead of projections or thin wrappers from SDKWork packages.
- Route projection tests `MUST` prove route contributions generate or assemble `app.json` pages/subpackages deterministically.
- Platform host tests `MUST` fail when feature packages call `wx.*`, `my.*`, `dd.*`, `tt.*`, or equivalent platform globals directly.
- Mini program IAM tests `MUST` prove platform login codes, phone-number grants, scene/query inputs, and provider-specific auth facts are exchanged through approved app-api/appbase flows.
- Mini program config tests `MUST` prove platform app ids and host metadata are separated from private keys, auth tokens, API keys, database URLs, private endpoints, and business route constants.
- Package-size tests `SHOULD` prove root package and subpackages stay within documented platform limits when tooling supports it.

## 2.4.5 Mini Program UI Tests

Mini program UI tests make `APP_MINI_PROGRAM_UI_SPEC.md` executable.

Rules:

- Mini program UI package tests `MUST` verify package placement under `apps/sdkwork-<application-code>-mini-program/packages/sdkwork-<application-code>-mp-*`, `apps/sdkwork-<application-code>-mini-program/packages/sdkwork-<application-code>-mp-console-*`, `apps/sdkwork-<application-code>-mini-program/packages/sdkwork-<application-code>-mp-admin-*`, or approved `packages/mini-program/<domain>/sdkwork-<capability>-mini-program` shared packages.
- Package-local boundary tests `MUST` prove `pages`, `components`, `services`, `state`, `i18n`, `routes`, `navigation`, `host`, and `types` responsibilities remain visible when those concerns exist.
- I18n tests `MUST` prove mini program locale resources use the `src/i18n/<locale>/<domain>/<capability>/` source layout from `I18N_SPEC.md` section 6.1 and that platform page/subpackage resource aggregates are generated or thin assemblies, not hand-authored app-wide locale files.
- Route contribution tests `MUST` prove every route declares `id`, `surface`, `domain`, `capability`, `screen`, `titleKey`, `auth`, and mini program placement metadata without API URLs or SDK method names.
- SDK tests `MUST` prove services receive generated app SDK clients or approved wrappers through injection and do not use raw request APIs or manual auth headers.
- Host adapter tests `MUST` prove source pages/components/services do not call platform globals such as `wx.*`, `my.*`, `dd.*`, or `tt.*` directly.
- State clearing tests `MUST` prove logout, refresh failure, account switch, and tenant switch clear token storage, context state, sensitive package state, caches, and realtime/session bridges.
- UI state tests `SHOULD` cover loading, empty, validation-error, permission-denied, offline/unavailable, and unknown-error states for representative pages.
- Package-size tests `SHOULD` prove large dependencies, media, and compatibility layers do not exceed platform package or subpackage budgets when tooling supports it.

## 2.4.6 Android Native Mobile Architecture Tests

Android native mobile architecture tests make `ANDROID_APP_MOBILE_ARCHITECTURE_SPEC.md` executable.

Rules:

- Android root tests `MUST` verify `.sdkwork/`, `config/app`, `config/host`, root `app` bootstrap, `packages/`, `sdks/`, scripts, Gradle files, and tests exist.
- Android package naming tests `MUST` prove packages use `sdkwork-<application-code>-android-mobile-*` and reserved `core`, `commons`, `shell`, `console-*`, `admin-*`, and `host` roles.
- Android surface tests `MUST` prove `sdkwork-<application-code>-android-mobile-<capability>` packages are default app/user packages, `sdkwork-<application-code>-android-mobile-console-<capability>` packages are user-facing management console packages, and `sdkwork-<application-code>-android-mobile-admin-<capability>` packages are `backend-admin` packages.
- Android SDK boundary tests `MUST` prove app and console packages use generated Kotlin/Java app SDK clients or approved Android wrappers, admin packages use generated Kotlin/Java backend SDK clients or approved backend wrappers, and no raw HTTP, manual auth headers, TypeScript/Flutter/Swift/ArkTS wrappers, or generated SDK edits are introduced.
- Android root thinness tests `MUST` fail when the root `app/` module owns business screens, mock data arrays, feature services, or concrete SDK orchestration outside bootstrap.
- Android host adapter tests `MUST` prove feature screens, view models, and services do not call Android framework APIs, Activity result APIs, Play Services clients, or push/camera/secure-storage APIs directly for host capabilities.
- Android route tests `MUST` prove navigation destinations map to SDKWork route ids and align with cross-client route metadata when the workflow exists elsewhere.
- Android config tests `MUST` prove application ids, permissions, app links, push metadata, signing references, icons, and store metadata are separated from private keys, auth tokens, API keys, database URLs, private endpoints, and business route constants.
- Android release preflight tests `MUST` validate APK/AAB or store package metadata, signing references, icons, screenshots, checksums/SBOM/provenance, and secret absence.

## 2.4.7 iOS Native Mobile Architecture Tests

iOS native mobile architecture tests make `IOS_APP_MOBILE_ARCHITECTURE_SPEC.md` executable.

Rules:

- iOS root tests `MUST` verify `.sdkwork/`, `config/app`, `config/host`, root `App` bootstrap, `packages/`, `sdks/`, scripts, Xcode/SPM files, and tests exist.
- iOS package naming tests `MUST` prove packages use `sdkwork-<application-code>-ios-mobile-*` and reserved `core`, `commons`, `shell`, `console-*`, `admin-*`, and `host` roles.
- iOS surface tests `MUST` prove `sdkwork-<application-code>-ios-mobile-<capability>` packages are default app/user packages, `sdkwork-<application-code>-ios-mobile-console-<capability>` packages are user-facing management console packages, and `sdkwork-<application-code>-ios-mobile-admin-<capability>` packages are `backend-admin` packages.
- iOS SDK boundary tests `MUST` prove app and console packages use generated Swift app SDK clients or approved iOS wrappers, admin packages use generated Swift backend SDK clients or approved backend wrappers, and no raw HTTP, manual auth headers, TypeScript/Flutter/Kotlin/ArkTS wrappers, or generated SDK edits are introduced.
- iOS root thinness tests `MUST` fail when the root `App/` target owns business screens, mock data arrays, feature services, or concrete SDK orchestration outside bootstrap.
- iOS host adapter tests `MUST` prove feature screens, view models, and services do not call iOS framework APIs, keychain, push, universal-link, camera, biometric, or file APIs directly for host capabilities.
- iOS route tests `MUST` prove navigation routes map to SDKWork route ids and align with cross-client route metadata when the workflow exists elsewhere.
- iOS config tests `MUST` prove bundle ids, entitlements, associated domains, push metadata, signing references, icons, and store metadata are separated from private keys, auth tokens, API keys, database URLs, private endpoints, and business route constants.
- iOS release preflight tests `MUST` validate IPA/App Store/TestFlight or private package metadata, signing references, icons, screenshots, checksums/SBOM/provenance, and secret absence.

## 2.4.8 Harmony Native Mobile Architecture Tests

Harmony native mobile architecture tests make `HARMONY_APP_MOBILE_ARCHITECTURE_SPEC.md` executable.

Rules:

- Harmony root tests `MUST` verify `.sdkwork/`, `config/app`, `config/host`, root `entry` bootstrap, `packages/`, `sdks/`, scripts, ohpm/hvigor files, and tests exist.
- Harmony package naming tests `MUST` prove packages use `sdkwork-<application-code>-harmony-mobile-*` and reserved `core`, `commons`, `shell`, `console-*`, `admin-*`, and `host` roles.
- Harmony surface tests `MUST` prove `sdkwork-<application-code>-harmony-mobile-<capability>` packages are default app/user packages, `sdkwork-<application-code>-harmony-mobile-console-<capability>` packages are user-facing management console packages, and `sdkwork-<application-code>-harmony-mobile-admin-<capability>` packages are `backend-admin` packages.
- Harmony SDK boundary tests `MUST` prove app and console packages use generated ArkTS/TypeScript app SDK clients or approved Harmony wrappers, admin packages use generated Harmony-compatible backend SDK clients or approved backend wrappers, and no raw request APIs, manual auth headers, React/Flutter/Kotlin/Swift wrappers, or generated SDK edits are introduced.
- Harmony root thinness tests `MUST` fail when the root `entry/` module owns business pages, mock data arrays, feature services, or concrete SDK orchestration outside bootstrap.
- Harmony host adapter tests `MUST` prove feature pages, view models, and services do not call HarmonyOS system APIs, ability context, want handling, push, camera, secure-storage, or file APIs directly for host capabilities.
- Harmony route tests `MUST` prove page/navigation routes map to SDKWork route ids and align with cross-client route metadata when the workflow exists elsewhere.
- Harmony config tests `MUST` prove bundle/app ids, module metadata, device types, permissions, push metadata, signing references, icons, and store metadata are separated from private keys, auth tokens, API keys, database URLs, private endpoints, and business route constants.
- Harmony release preflight tests `MUST` validate Harmony direct or store package metadata, HAP/APP artifact metadata when represented through `OTHER`, signing references, icons, screenshots, checksums/SBOM/provenance, and secret absence.

## 2.4.9 Native Mobile UI Tests

Native mobile UI tests make `APP_ANDROID_NATIVE_UI_SPEC.md`, `APP_IOS_NATIVE_UI_SPEC.md`, and `APP_HARMONY_NATIVE_UI_SPEC.md` executable.

Rules:

- Native UI package tests `MUST` verify package placement under the selected root family, including default app packages, user console packages, and admin packages such as `apps/sdkwork-<application-code>-android-mobile/packages/sdkwork-<application-code>-android-mobile-*`, `apps/sdkwork-<application-code>-android-mobile/packages/sdkwork-<application-code>-android-mobile-console-*`, `apps/sdkwork-<application-code>-android-mobile/packages/sdkwork-<application-code>-android-mobile-admin-*`, `apps/sdkwork-<application-code>-ios-mobile/packages/sdkwork-<application-code>-ios-mobile-*`, `apps/sdkwork-<application-code>-ios-mobile/packages/sdkwork-<application-code>-ios-mobile-console-*`, `apps/sdkwork-<application-code>-ios-mobile/packages/sdkwork-<application-code>-ios-mobile-admin-*`, `apps/sdkwork-<application-code>-harmony-mobile/packages/sdkwork-<application-code>-harmony-mobile-*`, `apps/sdkwork-<application-code>-harmony-mobile/packages/sdkwork-<application-code>-harmony-mobile-console-*`, or `apps/sdkwork-<application-code>-harmony-mobile/packages/sdkwork-<application-code>-harmony-mobile-admin-*`.
- Package-local boundary tests `MUST` prove screens/pages, components/views, presentation/view models/controllers, services, state, i18n/resources, routes/navigation, host adapter contracts, and models remain visible when those concerns exist.
- I18n/resource tests `MUST` prove Android, iOS, and Harmony authored resources use the source layouts from `I18N_SPEC.md` section 6.1, platform resource aggregates are generated or assembled from package-local fragments, and authored resources do not collapse whole-root copy into one file.
- SDK tests `MUST` prove app and user console services receive generated app SDK clients or approved wrappers through injection, admin services receive generated backend SDK clients or approved backend wrappers through injection, and no UI service uses raw HTTP/request APIs or manual auth headers.
- Host adapter tests `MUST` prove feature UI and view models do not call platform APIs directly for host capabilities.
- State clearing tests `MUST` prove logout, refresh failure, account switch, and tenant switch clear token storage, context state, sensitive package state, caches, and realtime/session bridges.
- UI state tests `SHOULD` cover loading, empty, validation-error, permission-denied, offline/unavailable, and unknown-error states for representative screens/pages.

## 2.5 Drive Uploader Tests

Drive Uploader tests make `DRIVE_SPEC.md` executable for all client and server upload paths.

Rules:

- Drive server-side service tests `MUST` prove `DriveUploaderService` validates `PrepareUploaderUploadCommand`, `UploaderActor`, `UploaderTarget`, `UploaderRetention`, profile, checksum, part number, offsets, sizes, object target, content type, filename, and tenant/app/resource identifiers.
- Rust server-side upload tests `MUST` prove generated/imported server bytes call `DriveUploaderService`, `PrepareUploaderUploadCommand`, or an approved Drive server-side uploader facade instead of calling `/app/v3/api/drive/uploader/*` over HTTP or direct S3/OSS/MinIO/local filesystem provider APIs.
- App API route tests `MUST` prove `/app/v3/api/drive/uploader/uploads`, `/app/v3/api/drive/uploader/uploads/{uploadItemId}/parts/{partNo}`, `/app/v3/api/drive/upload_sessions/{uploadSessionId}/parts/{partNo}`, and `/app/v3/api/drive/upload_sessions/{uploadSessionId}/complete` delegate to Drive-owned services and expose SDKWork operationIds.
- App SDK tests `MUST` prove `sdkwork-drive-app-sdk` exposes `client.uploader.upload`, `uploadByProfile`, `uploadVideo`, `uploadImage`, `uploadAudio`, `uploadDocument`, `uploadArchive`, `uploadText`, `uploadDataset`, `uploadAttachment`, `uploadAvatar`, and `uploadThumbnail`.
- Client upload service tests `MUST` prove feature upload facades delegate to injected Drive SDK `client.uploader.*`, provide `appId`, `appResourceType`, `appResourceId`, `scene`, `source`, profile, file metadata, target, and retention, and do not pass tenant, organization, or authenticated user context as generated SDK method inputs.
- Attribution tests `MUST` prove Drive uploader facts retain tenant, organization, actor type/id, user id when available, app id, app resource type/id, scene, source, upload profile, content type/group, file size, part counts, Drive space/node/session, and retention.
- Resumability tests `MUST` prove prepare/resume returns already uploaded parts, mark-uploaded is idempotent, missing parts are uploaded only once, and server state remains authoritative over local SDK state.
- Retention and cleanup tests `MUST` prove temporary uploads are swept by Drive maintenance jobs, automatic soft delete/hard delete records audit and `dr_drive_file_sensitive_operation` snapshots, and app-local cleanup jobs do not own Drive content lifecycle.
- Explicit target-space tests `MUST` prove active target-space validation, writer/owner permission checks, anonymous writer share-token handling, raw share-token non-persistence, and forbidden anonymous target writes without a valid share token.
- Business API tests `MUST` prove application commands accept Drive references, Drive-backed `MediaResource`, or business relation ids after upload. They must fail when application APIs expose duplicate `/upload`, `/presign`, `/complete`, upload-session, file-part, bucket, or object-key contracts for SDKWork-owned files.

## 2.6 Deployment Profile And Runtime Topology Tests

Deployment profile tests make `DEPLOYMENT_SPEC.md`,
`APP_RUNTIME_TOPOLOGY_SPEC.md`, `CONFIG_SPEC.md`, `ENVIRONMENT_SPEC.md`,
`APP_MANIFEST_SPEC.md`, and `GITHUB_WORKFLOW_SPEC.md` executable.

Rules:

- Config, env, manifest, topology, and workflow validation `MUST` accept only
  `deploymentProfile` values `standalone` and `cloud`.
- Tests `MUST` fail when checked-in application runtime config, TOML examples,
  app manifests, topology profile ids, workflow targets, package metadata, or
  release env files use `saas`, `private`, `local`, `test`, `server`,
  `container`, `desktop`, `browser`, `web`, `mobile`, `mini-program`,
  `docker`, `self-hosted`, `cloud-hosted`, or `hosting` as deployment profile
  values.
- Static config scans `MUST` fail for new application startup inputs that define
  `SDKWORK_<APPLICATION_CODE>_DEPLOYMENT_MODE`, `SDKWORK_CLAW_DEPLOYMENT_MODE`,
  `[runtime].deployment_mode`, `deploymentMode`, or CLI flags such as
  `--hosting` as active deployment architecture. Migration tools may cover
  those aliases only when tests prove they normalize to `deploymentProfile`,
  `runtimeTarget`, and v3 topology profile ids before application code sees the
  config.
- Topology tests `MUST` fail when profile ids begin with `self-hosted.` or
  `cloud-hosted.`, or when they do not follow
  `<deploymentProfile>.<serviceLayout>.<environment>`.
- Workspace topology parity checks `MUST` run
  `node tools/check-topology-deployment-profiles.mjs --workspace ..` and pass
  for every application repository with `specs/topology.spec.json`.
- Single HTTP ingress checks `MUST` run
  `node tools/check-single-http-ingress.mjs --root .` for repositories with
  topology specs or dev orchestration scripts, and
  `node tools/audit-single-http-ingress-workspace.mjs --workspace ..` across
  SDKWork application repositories per `APPLICATION_GATEWAY_SPEC.md` §5.6 and
  `APP_RUNTIME_TOPOLOGY_SPEC.md` §8. Workspace audit `MUST` pass with zero
  multi-listener orchestration errors; gateway crate migration warnings may
  remain until `--strict` is enabled repository-wide.
- Gateway assembly checks `MUST` run
  `node tools/validate-gateway-assembly.mjs --root .` for repositories that own
  `crates/sdkwork-routes-<application-code>-*` members, and `MUST` fail when
  `sdkwork-<application-code>-gateway-assembly` is missing, `assembly-manifest.json`
  drifts from workspace discovery, or standalone/cloud gateway sources hand-merge
  `sdkwork_routes_*` / `sdkwork-routes-*` routers.
- Workspace gateway assembly audits `MUST` run
  `node tools/audit-gateway-assembly-workspace.mjs --workspace ..` and pass with
  zero errors and zero warnings before claiming gateway assembly alignment is complete.
- Repositories with assembly crates `MUST` run `pnpm gateway:assembly:validate` in CI
  or root `pnpm verify` when gateway crates or route crates change.
- Workspace hosting-debt checks `MUST` run
  `node tools/check-app-runtime-hosting-debt.mjs --workspace ..` and pass for
  every application repository with active dev scripts, packaging targets, or
  topology script metadata. Retired vocabulary recorded under `retired` sections
  is allowed; active `--hosting`, `self-hosted`, and `cloud-hosted` usage is not.
- Application topology alignment `MAY` use
  `node tools/align-app-topology-deployment-profiles.mjs --workspace ..` before
  manual review of orchestration and gateway crate bindings.
- Application hosting-debt alignment `MAY` use
  `node tools/align-app-runtime-hosting-debt.mjs --workspace ..` before manual
  review of dev orchestrators and packaging profile ids.
- Runtime config tests `MUST` prove lifecycle environment, config profile,
  build mode, deployment profile, and runtime target are normalized separately.
- App manifest tests `MUST` prove `runtime.supportedDeploymentProfiles` is
  non-empty, `runtime.defaultDeploymentProfile` is supported, and package
  entries use valid `deploymentProfile` plus `runtimeTarget` metadata.
- App manifest tests `MUST` prove package platform, source type, package
  format, package profile, deployment profile, runtime target, and
  `runtime.framework` align with the package consistency matrix in
  `APP_MANIFEST_SPEC.md`.
- App manifest tests `MUST` fail when a package id profile segment conflicts
  with explicit package metadata, `runtimeTarget`, or `runtime.framework`.
- App manifest tests `MUST` prove schema, full example, validator, initializer,
  and platform_app export projection stay aligned when deployment profile,
  runtimeTarget, package matrix, or release metadata rules change.
- GitHub workflow planner tests `MUST` prove deployable targets declare
  `deploymentProfile` and `runtimeTarget`, inject `SDKWORK_DEPLOYMENT_PROFILE`
  and `SDKWORK_RUNTIME_TARGET` into package/deployment lifecycle steps, and
  generate package ids with the deployment profile segment required by
  `GITHUB_WORKFLOW_SPEC.md`.
- GitHub workflow entrypoint tests `MUST` prove every
  `dependencies[].refInput` and `verificationDependencies[].refInput` in
  `sdkwork.workflow.json` is exposed by the thin package workflow through a
  matching `workflow_dispatch` input and `dependency_refs_json` entry.
- GitHub workflow planner tests `MUST` fail when `docker`, `mobile`, `native`,
  or `web` is used as a deployment profile or non-canonical runtime target.
- Runtime target matrix tests `MUST` prove browser, desktop, tablet,
  Capacitor, Flutter, native Android, native iOS, native Harmony, mini program,
  server, container, and test-runner targets can each be represented without
  creating new deployment profile values.
- Deployment smoke tests `MUST` prove standalone profiles can run as one
  application deployment unit with one public application ingress for HTTP
  `*-api` surfaces, while cloud profiles use explicit split-service URLs,
  secrets, probes, rollout, and rollback metadata.

## 3. Security Tests

Rules:

- Protected app-api and backend-api operations `MUST` test missing auth token, missing access token, invalid token, expired token, wrong tenant, wrong tenant signing key, contradictory overlapping auth/access token tenant claims, auth-token precedence on overlapping claims, invalid login scope, and insufficient permission.
- Protected open-api operations `MUST` test missing API key, invalid API key, expired/revoked API key, missing OAuth bearer, invalid OAuth bearer, expired/revoked OAuth bearer, wrong tenant/app binding, insufficient permission scope, flexible mode scheme selection when both headers are present, and the absence of app login token fallback.
- IAM login integration `MUST` test the checks required by `IAM_LOGIN_INTEGRATION_SPEC.md`: appbase boundary, SDK token wiring, route guard, logout clearing, forbidden application-local auth routes, Rust dual-token guard, AppContext safety, anonymous login request behavior, tenant resolution from real IAM data, and organization-selection continuation behavior.
- IAM login tests `MUST` prove login requests do not trust inbound credentials or SDKWork context-projection headers as tenant/user/organization context.
- IAM token tests `MUST` prove `authToken` and `accessToken` both include tenant, organization, login scope, user, and session claims, that overlapping claims resolve from `authToken` when both tokens are present, and that contradictory overlapping `accessToken` claims are rejected.
- IAM tenant signing tests `MUST` prove different tenants use different signing keys or key references, `kid` resolves to the expected tenant key, and a token signed with another tenant's key fails validation.
- IAM organization login tests `MUST` cover zero active organization membership as tenant-level login, one or more active organization memberships as a `LOGIN_CONTEXT_SELECTION` challenge that includes the personal-login option when allowed, and final context selection membership validation before token issuance.
- Static or contract tests `MUST` fail when authenticated backend code fills request context from demo tenants, hard-coded tenants, mock users, email-normalized user ids, or raw request context headers instead of verified token/session context.
- App SDK composition tests `MUST` prove the application bootstrap declares or derives an SDK inventory and classifies every consumed SDK as authenticated app-api, authenticated `backend-admin` backend-api, protected open-api API-key, protected open-api OAuth bearer, protected open-api flexible, public open-api, local/native, or test fake before feature services are constructed.
- App SDK composition tests `MUST` prove appbase app SDK, application/dependency app SDKs, explicit `backend-admin` appbase backend/application backend/dependency backend SDKs, and approved composed wrappers backed by those SDKs share one TokenManager through `setTokenManager`, constructor injection, or the language-equivalent credential hook.
- App SDK composition tests `MUST` prove Drive app SDK clients and other dependency SDK clients are declared as dependency SDKs for consuming applications, share the authenticated global TokenManager when required, and are not regenerated into application-owned SDK families.
- App SDK composition tests `MUST` prove `dependencyApiExports` is explicit and defaults to `[]`.
  Configured dependency API exports must be visible only through their declared `packageExport`,
  `servicePort`, dependency SDK injection, or documentation reference; generated application-owned SDK
  transports must stay owner-only.
- App SDK composition tests `MUST` prove every dependency API export with `runtimeRequired: true`
  has either verified same-origin `dependencyApiSurfaces` coverage or dependency-specific base URL
  config before feature services are constructed.
- App SDK composition tests `MUST` prove application auth runtime integration uses the approved high-level IAM auth runtime/factory for the architecture when one exists, for example `createSdkworkAppbasePcAuthRuntime(...)` on PC React.
- Appbase IAM runtime tests `MUST` prove token persistence failure does not update the global token manager, context propagation failure rolls back token/context state, stale AppContext is cleared when a committed session has no context, new sessions do not inherit old refresh tokens, and refresh/current-session continuation preserves refresh tokens only when allowed.
- Logout tests `MUST` prove local token store, global token manager, context store, sensitive caches, realtime/session bridges, and native/platform secure storage clear even when remote session deletion fails.
- `backend-admin` SDK tests `MUST` prove backend IAM SDK clients do not expose user-facing `auth.sessions.create`, `auth.registrations.create`, refresh, logout, or equivalent login/session creation resources.
- Public APIs `MUST` test rate limit and input validation when relevant.
- Sensitive responses `MUST` test redaction.

## 4. Frontend Tests

Rules:

- Service tests `MUST` use injected SDK client fakes or generated SDK clients.
- UI tests `SHOULD` verify service integration, loading, error, empty, and permission-denied states.
- Raw HTTP usage in business modules `SHOULD` be checked by static scan.
- Static frontend scans MUST fail on xRequestId, `x-request-id`, `X-Request-Id`, `createRequestId`, or direct `crypto.randomUUID()` usage in application source because request identity is server-owned.
- Static SDK and OpenAPI scans MUST fail when generated app/backend HTTP SDKs or app/backend OpenAPI documents expose `xRequestId` or `X-Request-Id`.
- Static SDK and OpenAPI scans MUST fail when generated app-api, backend-api, or protected open-api SDKs or OpenAPI documents expose `tenant_id` or `tenantId` as current-tenant method arguments, `params` fields, request parameters, per-call credential options, or client-writable body fields. Tenant context must be asserted through dual-token or API-key context tests instead.
- Static SDK/bootstrap scans MUST fail when protected open-api SDK clients are added to app/backend global token-manager client lists instead of a declared open-api credential provider.
- Static SDK/bootstrap scans MUST fail when authenticated app-api SDK clients or explicit `backend-admin` backend-api SDK clients are not passed through the global token-manager-aware SDK list such as `clients.sdkClients`.
- Static SDK/bootstrap scans MUST fail when the same application runtime/session context creates more than one live `TokenManager`, creates per-domain/per-package/per-service TokenManagers, or constructs an authenticated app SDK client or explicit `backend-admin` backend SDK client without joining the global TokenManager closure.
- Static SDK/bootstrap scans MUST fail when application packages import `@sdkwork/iam-sdk-adapter`, call `createIamAppSdkAdapter(...)`, call `createIamBackendSdkAdapter(...)`, or wire `createIamRuntime(...)` directly for appbase login instead of using the approved high-level appbase runtime/factory.
- Static env/config scans MUST fail when `.env`, runtime TOML examples, `/runtime-env.js`, `PORTAL_PUBLIC_*`, or `VITE_*` contain live auth tokens, access tokens, refresh tokens, API keys, generated auth headers, or SDK credential DTOs.
- Static env/config scans MUST fail when application runtime source, IAM runtime bootstrap, tracked `.env.example`, or public runtime config reads `SDKWORK_IAM_BOOTSTRAP_*`, `SDKWORK_IAM_LOCAL_*`, `SDKWORK_USER_CENTER_BOOTSTRAP_*`, runtime `SDKWORK_APP_ID`, `VITE_SDKWORK_APP_ID`, or equivalent fixed tenant/organization/user/owner bootstrap variables for current IAM scope. Tenant, organization, user, session, and app scope MUST be asserted through dual-token claim tests instead.
- Static frontend/service scans MUST fail when UI packages or service facades manually assemble auth/API key headers such as `Authorization`, `Access-Token`, or `X-API-Key` instead of using SDK credential APIs.
- Static frontend/service scans MUST fail when UI packages or service facades import Rust route crates such as `sdkwork-routes-*-app-api` or assemble URLs from route constants instead of calling generated SDK clients.
- Static frontend scans MUST fail when browser or service code uses raw object-storage provider SDKs, persists presigned URLs as business identity, or bypasses generated Drive SDK methods for SDKWork-owned uploads/downloads.
- Static frontend scans MUST fail when feature code outside the Drive SDK composed uploader calls raw `fetch`, `axios`, generic HTTP clients, or handwritten SDKs against `/app/v3/api/drive/uploader`, `/app/v3/api/drive/upload_sessions`, S3, OSS, MinIO, local object-storage, or provider presign endpoints.
- Static frontend scans MUST fail when UI components or feature services persist `File`, object URL, presigned URL, provider URL, bucket, object key, upload part list, or local uploader state as business identity.
- Static frontend/service scans MUST fail when upload services do not supply Drive Uploader attribution metadata such as `appId`, `appResourceType`, `appResourceId`, `scene`, `source`, and upload profile from a stable service/component configuration.
- Static Rust scans MUST fail when server-side upload paths for SDKWork-owned files create app-local upload tables, generate provider object keys, call S3/OSS/MinIO/local filesystem provider SDKs directly, or call Drive App API HTTP routes instead of `DriveUploaderService` or an approved Drive server-side uploader facade.
- App, user-console, and internal-admin packages for PC React, H5 mobile React, Flutter, mini program, Android native, iOS native, Harmony native, and standalone backend/admin React packages `MUST` run the package placement and SDK boundary checks required by `UI_ARCHITECTURE_SPEC.md`, their root architecture standard, and their detailed UI/package spec.
- Architecture SDK checks `MUST` verify TypeScript SDKs stay in React and mini program packages, Dart/Flutter SDKs stay in Flutter packages, Kotlin/Java SDKs stay in Android native packages, Swift SDKs stay in iOS native packages, ArkTS/TypeScript Harmony SDKs stay in Harmony native packages, Rust SDKs or Rust service clients stay in Rust/native runtime code, and no package imports another architecture's UI/runtime wrapper to bypass a missing SDK method.
- Public runtime env checks `MUST` fail if `/runtime-env.js`, `/runtime-env.json`, `PORTAL_PUBLIC_*`, `VITE_*`, `PUBLIC_*`, or `NEXT_PUBLIC_*` exposes secrets, database URLs, Redis URLs, tokens, signing keys, private service endpoints, or backend-only credentials.
- Browser bootstrap tests `MUST` prove public runtime config loads before generated SDK clients are constructed and that open-api, app-api, and backend-api base URLs remain independent.
- TokenManager bootstrap tests `MUST` prove base URLs and SDK inventory classification are resolved before SDK construction, the same global TokenManager is injected into appbase app SDKs, application/dependency app SDKs, explicit `backend-admin` backend SDKs, and approved composed SDK clients for the same authenticated session context, and protected open-api SDKs use declared open-api credential providers instead.
- `backend-admin` UI verification `MUST` fail if business pages, services, or repositories are placed in `@sdkwork/react-backend-ui`, `@sdkwork/react-backend-core`, or one catch-all backend package instead of `@sdkwork/react-backend-<domain>`.
- PC application architecture verification `MUST` fail if new app, console, or admin packages omit the `pc` segment or if `pc-console` and `pc-admin` packages import each other's business internals.
- App UI verification `MUST` fail if user-facing packages call `/backend/v3/api`, import backend SDK packages, or depend on `backend-admin` UI packages.
- `backend-admin` UI verification `MUST` fail if operator packages call `/app/v3/api` for backend resources or construct raw HTTP requests around missing backend SDK methods.

## 5. Performance And Documentation Tests

Rules:

- P0/P1 APIs `SHOULD` include pagination/bounded-query verification.
- P0/P1 list/search APIs `MUST` include tests that prove store-level or index-level pagination and reject in-process full collect + slice patterns per `PAGINATION_SPEC.md` §10.
- SDKWork-owned list/search API tests `MUST` reject forbidden pagination aliases (`pageSize`, `limit`, `page_no`, `pageNo`, `per_page`, `size`) on HTTP GET query strings with `40003 INVALID_PARAMETER` for new and pre-launch applications.
- Cursor-mode list/search API tests `MUST` reject requests that combine `page` and `cursor`; numeric offset strings as cursor are forbidden for new and pre-launch applications.
- Frontend list service tests `SHOULD` fail when interactive screens use `listAll*` + `slice` instead of server `cursor`/`page`.
- Frontend list service tests for SDKWork-owned APIs `MUST` prove emitted HTTP query strings or generated SDK calls use canonical `page_size`, not `pageSize` or `limit`, when the test boundary observes wire parameters.
- SDK generation tests `MUST` verify the intended nested resource method surface from `SDK_SPEC.md`.
- SDK workspace tests `MUST` verify the intended `sdkwork-<domain>-sdk`, `sdkwork-<domain>-app-sdk`, and `sdkwork-<domain>-backend-sdk` family contracts from `SDK_SPEC.md`, plus the physical workspace placement required by `SDK_WORKSPACE_GENERATION_SPEC.md`, when those surfaces exist.
- SDK workspace tests `MUST` verify authored API contracts under `apis/` trace to the materialized
  authority OpenAPI under the owning `sdks/` SDK family when `apis/` is used as the source contract
  location.
- SDK workspace tests `MUST` verify route crate -> aggregated API authority -> generated SDK family mappings when Rust route crates participate in API generation, for example `sdkwork-routes-merchandise-app-api` -> `sdkwork-commerce (deleted)-app-api` -> `sdkwork-commerce (deleted)-app-sdk`.
- Observability tests `MUST` prove logs, metrics, traces, health checks, and
  dashboard projections use `deployment_profile` and exact
  `CONFIG_SPEC.md` `runtime_target` label values without introducing
  `web`, `mobile`, `native`, or `docker` runtime-target aliases.
- Module README examples `SHOULD` be checked against exported public APIs when tooling is available.
- App manifest changes `SHOULD` run `node apps/scripts/validate-sdkwork-app-standard-v3.mjs`.

## 6. Completion Checklist

- [ ] Relevant spec checklist is satisfied.
- [ ] `AGENTS.md` exists and resolves root `sdkwork-specs` by relative path when repository/application entrypoints are touched.
- [ ] Requirement records, acceptance criteria, and traceability checks pass when non-trivial behavior, contract, runtime, security, release, or migration work is touched.
- [ ] Architecture decision checks pass when boundaries, ownership, runtime topology, persistence, API/SDK authority, release posture, security posture, or cross-client alignment change.
- [ ] Engineering workflow checkpoints, review evidence, and quality gate evidence are recorded when work crosses a planning, merge, release, migration, or exception boundary.
- [ ] Release, migration, and supply-chain evidence checks pass when package versions, artifacts, rollout/rollback, compatibility windows, dependencies, build inputs, generated artifacts, SBOM/provenance/signing/checksums/attestations, or publication policy are touched.
- [ ] Code style, naming, identity lattice terminology (`tools/check-identity-naming.mjs`), and only relevant language-specific checks pass when authored code is touched.
- [ ] Repository/application `.sdkwork/skills/` and `.sdkwork/plugins/` checks pass when a repository root or application root is created or maintained.
- [ ] Standard top-level directory checks pass when a repository root or application root is created or maintained.
- [ ] `apps/README.md` directory index checks pass for independent application repositories.
- [ ] `apis/` and `sdks/` boundary checks pass when API contracts or SDK generation are touched.
- [ ] OpenAPI/SDK generation verification passes under `SDK_SPEC.md`.
- [ ] OpenAPI/SDK scans prove current tenant context is not generated as `tenant_id` or `tenantId` inputs.
- [ ] Web backend implementation checks pass under `WEB_BACKEND_SPEC.md` when controllers, route crates, handlers, services, repositories, or runtime composition are touched.
- [ ] Application layered architecture checks pass under `APPLICATION_LAYERED_ARCHITECTURE_SPEC.md` when API/service/domain/repository/adapter/runtime/frontend boundaries are touched.
- [ ] Web framework integration checks pass under `WEB_FRAMEWORK_SPEC.md` when any SDKWork HTTP
      `*-api` route crate, controller module, migration-only API server, gateway, framework adapter, or runtime
      composition is touched.
- [ ] Composable architecture closure checks pass under `COMPOSABLE_ARCHITECTURE_SPEC.md` when module boundaries, dependency SDKs, frontend packages, Rust crates, routes, permissions, or runtime composition are touched.
- [ ] SDK workspace layout and OpenAPI authority/derived input checks pass under `SDK_WORKSPACE_GENERATION_SPEC.md` when SDK generation is touched.
- [ ] Rust route crate naming, surface prefix, route manifest, and authority aggregation checks pass when Rust HTTP routes are touched.
- [ ] Proto/RPC generation verification passes when RPC contracts are touched.
- [ ] RPC framework integration verification passes when RPC servers or cross-process RPC clients are touched.
- [ ] Discovery integration verification passes when dynamic RPC resolution or `sdkwork-discovery` behavior is touched.
- [ ] RPC resilience verification passes when retry, breaker, or drain behavior changes.
- [ ] RPC SDK workspace and `sdkgen --protocol rpc` verification passes when RPC SDK generation is touched.
- [ ] HTTP SDK generation non-regression verification passes when RPC generator code changes.
- [ ] Typecheck/build passes for touched packages.
- [ ] Security and tenant isolation tests cover negative cases.
- [ ] IAM login/session integration tests cover appbase route guard, logout clearing, SDK boundary, Rust AppContext validation, and forbidden local auth namespaces when relevant.
- [ ] Frontend service uses injected SDK clients.
- [ ] I18n verification covers language/framework directory layout, package-local fragments, generated platform resource boundaries, duplicate keys, missing active-locale keys, locale fallback, and safe localized errors when user-facing or operator-facing copy is touched.
- [ ] UI architecture package placement and SDK surface checks pass for touched UI packages.
- [ ] PC application architecture root layout, package naming, app/console/admin separation, desktop/tablet host checks, and iPadOS/Android tablet packaging checks pass when a PC application root is touched.
- [ ] H5 mobile, Flutter mobile, mini program, Android native, iOS native, and Harmony native architecture checks pass when those client roots or packages are touched.
- [ ] Environment/config checks pass for lifecycle environment, profile alias, deployment profile, build mode, runtime target, dev/test/staging/prod files, local override ignore rules, browser public runtime, desktop user/server split, H5/Capacitor config, Flutter config, mini program config, native Android config, native iOS config, native Harmony config, container config, and Tauri platform config.
- [ ] Deployment profile checks reject retired deployment-mode keys and values, validate standalone/cloud topology profile ids, and prove package/workflow metadata carries `deploymentProfile` and `runtimeTarget`.
- [ ] GitHub workflow checks pass for thin reusable workflow entrypoints, config validation, matrix planning, dependency checkout safety, lifecycle env injection, publication policy gates, artifact attestation policy, deployment environment binding, and framework repository validation when GitHub packaging/release/deployment workflows are touched.
- [ ] Observability checks pass for structured logs, metrics, traces, health
      checks, `deployment_profile`, exact `runtime_target` labels, bounded
      labels, and secret/PII redaction when runtime or production readiness is
      touched.
- [ ] SDK base URL and Access-Token checks pass for per-surface base URL resolution, dependency SDK base URLs, forbidden token env variables, `Access-Token` header semantics, and global TokenManager injection.
- [ ] Drive Uploader checks pass for client `client.uploader.*` usage, Rust `DriveUploaderService` usage, attribution/statistics, retention cleanup, and forbidden app-local upload/provider bypasses when upload is touched.
- [ ] Verification commands and outputs are recorded.
