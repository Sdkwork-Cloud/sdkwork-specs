# Test And Verification Standard

- Version: 1.0
- Scope: contract tests, SDK/RPC generation tests, backend tests, frontend tests, parity tests, security tests
- Related: all specs

No standard is complete until it is executable.

## 1. Required Test Classes

| Area | Required verification |
| --- | --- |
| Repository workspace | Git repository root and application root `.sdkwork/` presence checks, tracked `skills/` and `plugins/` placeholders, skill/plugin manifest checks, static scans for forbidden secrets/runtime/generated SDK files |
| API | OpenAPI validation, strict profile validation, request/response examples, Rust route crate naming and route-manifest aggregation checks |
| Web backend | Controller/router path checks, handler/service/repository boundary tests, typed request-context checks, transaction/idempotency tests, static scans for raw credential parsing |
| RPC | Proto compile, proto lint, breaking-change check, service manifest, unary server/client smoke tests, generated cross-language client checks |
| SDK | Validate `SDK_SPEC.md` semantics, validate application-root `sdks/` layout from `SDK_WORKSPACE_GENERATION_SPEC.md`, materialize OpenAPI authority to derived generator inputs, generate SDK through `D:\javasource\spring-ai-plus\sdk\sdkwork-sdk-generator` (`@sdkwork/sdk-generator` / `sdkgen`), compile SDK, verify README examples and method surface |
| App SDK composition | Validate `APP_SDK_INTEGRATION_SPEC.md`: architecture-specific SDK language, dependency SDK declarations, appbase IAM runtime wiring, one global TokenManager, and no dependency API regeneration |
| PC application architecture | Validate `APP_PC_ARCHITECTURE_SPEC.md`: application root layout, normalized `sdkwork-<product>-pc-*` package names, app/console/admin separation, shared renderer, desktop/tablet host placement, SDK/IAM boundaries |
| Environment/config | Validate `CONFIG_SPEC.md` and `ENVIRONMENT_SPEC.md`: lifecycle environment, profile alias, deployment mode, build mode, runtime target, dev/test/staging/prod files, browser/desktop/server/container/Tauri config separation, public/private/secret boundaries |
| Database | Schema lint, migration test, tenant/index checks |
| Drive | Drive API/SDK contract tests, Drive Uploader App SDK tests, Rust `DriveUploaderService` tests, upload-session idempotency, resumable part tests, attribution/statistic tests, retention cleanup tests, provider capability tests, business-module scans for forbidden app-local storage lifecycle |
| IAM/security | Token validation, permission denial, tenant isolation, audit event, appbase login integration, logout clearing, Rust AppContext guard |
| Frontend | Service tests with injected SDK client, UI integration tests |
| UI architecture | Static/package scan that the package family matches `UI_ARCHITECTURE_SPEC.md` plus `APP_PC_ARCHITECTURE_SPEC.md` for PC roots and exactly one detailed UI spec such as `APP_PC_REACT_UI_SPEC.md`, `APP_MOBILE_REACT_UI_SPEC.md`, `APP_FLUTTER_UI_SPEC.md`, or `BACKEND_UI_SPEC.md` |
| Deployment | SaaS/local/private parity tests |
| Events | Schema compatibility, idempotent consumer, replay behavior |
| Performance | Pagination, latency budget, retry, rate-limit behavior |
| Documentation | README/examples match public contracts |

## 2. Contract Tests

Rules:

- Every API change `MUST` include a test that proves the OpenAPI contract can generate the intended SDK shape.
- Every Rust HTTP route crate change `MUST` include or update verification that the crate name,
  declared surface, mounted path prefix, route manifest, aggregated API authority, and generated SDK
  family mapping satisfy `API_SPEC.md`, `SDK_SPEC.md`, and `SDK_WORKSPACE_GENERATION_SPEC.md`.
- Every SDK workspace or OpenAPI generation change `MUST` satisfy `SDK_SPEC.md` first for canonical SDK/API naming vocabulary, family naming, package semantics, generated client behavior, auth behavior, and service integration; then satisfy `SDK_WORKSPACE_GENERATION_SPEC.md` for application-root `sdks/` layout, authority OpenAPI location, deterministic derived inputs, generated-output placement, and component specs.
- SDK generation verification `MUST` prove the command uses the canonical `@sdkwork/sdk-generator` / `sdkgen` from `D:\javasource\spring-ai-plus\sdk\sdkwork-sdk-generator`; `sdkwork-code-generator`, local stubs, copied generator code, or generic OpenAPI generators are not valid production SDK verification evidence.
- File storage, upload, download, and object-storage contract changes `MUST` verify Drive API/SDK generation and must scan business modules for forbidden app-local upload/session/provider/object lifecycle code.
- Drive Uploader contract changes `MUST` verify App API operations `uploader.uploads.prepare`, `uploader.uploads.parts.markUploaded`, `uploadSessions.parts.presign`, and `uploadSessions.complete`, plus generated SDK/composed SDK exposure of `client.uploader.*`.
- Every RPC change `MUST` include a test that proves proto contracts compile and generated clients expose the intended service/method surface.
- New SDKWork v3 open-api, app-api, and backend-api generation tests `MUST` run the SDK generator with `--standard-profile sdkwork-v3`.
- New standard RPC contracts `SHOULD` run proto lint and breaking-change checks.
- Breaking changes `MUST` fail compatibility tests unless explicitly approved in `GOVERNANCE_SPEC.md`.

## 2.0 Repository Workspace Tests

Repository workspace tests make `SDKWORK_WORKSPACE_SPEC.md` executable.

Rules:

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
  `~/.sdkwork/<app>` runtime state.
- Static scans `MUST NOT` treat generated SDK output
  `.sdkwork/sdkwork-generator-manifest.json`, `.sdkwork/sdkwork-generator-changes.json`, or
  `.sdkwork/sdkwork-generator-report.json` as repository/application workspace files. Those files
  are valid only below generated SDK output and are governed by `SDK_SPEC.md` and
  `SDK_WORKSPACE_GENERATION_SPEC.md`.

## 2.1 Rust Route Manifest Contract Tests

Rust route manifest verification makes route/path configuration executable instead of convention-only.

Rules:

- Route manifest tests `MUST` validate `schemaVersion`, `kind: sdkwork.route.manifest`,
  `packageName`, `surface`, `owner`, `domain`, `capability`, `apiAuthority`, `sdkFamily`, `prefix`,
  and a non-empty `routes` list.
- Route manifest tests `MUST` prove `packageName` follows
  `sdkwork-routes-<capability>-<surface>`, the source directory follows
  `packages/native-rust/routes/<surface>/<packageName>/`, and the normalized artifact path follows
  `sdks/_route-manifests/<surface>/<packageName>.route-manifest.json` when normalized artifacts are
  produced.
- Surface-prefix tests `MUST` fail when `app-api` routes do not use `/app/v3/api`, `backend-api`
  routes do not use `/backend/v3/api`, or `open-api` routes use `/app/v3/api` or
  `/backend/v3/api`. Open-api tests `MUST` allow only the approved versioned domain prefix declared
  by the authority, for example `/im/v3/api`.
- Route-entry tests `MUST` validate uppercase HTTP method, full path including prefix, stable
  operationId, non-empty tags, auth projection, handler traceability, schema references when known,
  and source traceability.
- Duplicate tests `MUST` fail on duplicate `(method, path)` pairs after path-template
  normalization.
- Ownership tests `MUST` prove the route manifest owner, API authority, SDK family, and route-level
  ownership materialize to `x-sdkwork-owner`, `x-sdkwork-api-authority`, `x-sdkwork-source`, and
  `x-sdkwork-source-route-crate` in the authority OpenAPI.
- Auth-mode tests `MUST` prove protected app-api/backend-api routes project dual-token security,
  protected open-api routes project API key security unless a compatibility contract says otherwise,
  and public routes project `security: []`.
- Aggregation tests `MUST` fail on mixed surfaces, mismatched owner/domain/API authority/SDK family,
  wrong prefix, operationId/tag/domain mismatch, and dependency-owned operations declared in the
  consuming authority.
- Determinism tests `SHOULD` run route-manifest-to-authority materialization twice and compare the
  produced authority OpenAPI and derived `*.sdkgen.*` inputs.

## 2.2 RPC Contract Tests

Rules:

- RPC manifest tests `MUST` verify every service method maps to an SDKWork operationId or a documented composition method.
- Public RPC packages `MUST` generate and compile Rust clients plus at least one non-Rust client in CI or release validation.
- Rust RPC server tests `MUST` cover metadata auth, access token, request id, trace, deadline, idempotency key, and error mapping.
- Health and reflection behavior `MUST` be tested for local/private/production configuration.
- RPC adapter tests `MUST` verify the adapter uses runtime/service boundaries and does not depend on HTTP/Tauri adapters or direct SQLx storage unless explicitly approved.

## 2.3 Web Backend Implementation Tests

Web backend tests prove the implementation follows `WEB_BACKEND_SPEC.md`, not only that the OpenAPI document validates.

Rules:

- Controller/router tests `MUST` prove mounted paths, HTTP methods, class/module prefixes, and route
  manifests match the approved API surface and authority OpenAPI.
- Handler tests `MUST` cover request decoding, response mapping, problem-detail mapping, typed
  request context consumption, and the absence of raw credential parsing.
- Service/use-case tests `MUST` run without an HTTP server and cover business rules, authorization
  decisions, tenant/data-scope behavior, idempotency, transaction boundaries, events, cache
  invalidation, and provider adapter calls where relevant.
- Repository tests `MUST` cover tenant predicates, organization/data-scope predicates, optimistic
  concurrency, migration compatibility, and index/query shape for high-traffic queries.
- Static scans `MUST` fail when handlers or services parse `Authorization`, `Access-Token`,
  `X-API-Key`, request IDs, tenant IDs, organization IDs, user IDs, or permission scopes from raw
  headers instead of consuming the typed request context.
- Static scans `MUST` fail when route crates/controllers depend on the generated SDK for the same
  authority, when UI/service code imports route constants, or when dependency-owned routes are
  copied into a product authority.
- Provider adapter tests `MUST` prove raw HTTP usage, when present, is isolated inside an approved
  provider adapter and does not leak provider DTOs or raw provider errors into SDKWork API schemas.

## 2.4 PC Application Architecture Tests

PC application architecture tests make `APP_PC_ARCHITECTURE_SPEC.md` executable.

Rules:

- PC application root tests `MUST` verify `.sdkwork/`, `src/`, `packages/`, `sdks/`, `scripts/`, and required package metadata exist for every new PC application root.
- PC application capability tests `MUST` verify runtime/bootstrap, SDK/IAM composition, app shell, console shell, admin shell, domain packages, native host package, release commands, observability, and package-boundary verification have explicit owners when those capabilities are present.
- Package naming tests `MUST` fail when new PC packages omit the `pc` segment, for example `sdkwork-<product>-console-*` or `sdkwork-<product>-admin-*`.
- Package naming tests `MUST` recognize `sdkwork-<product>-pc-<capability>` as the default user-facing app package family.
- Console package tests `MUST` recognize only `sdkwork-<product>-pc-console-<capability>` as user-facing management console packages and must fail if they import `pc-admin` internals.
- Admin package tests `MUST` recognize only `sdkwork-<product>-pc-admin-<capability>` as company-internal admin packages and must fail if they import app/user or `pc-console` internals for business behavior.
- Surface SDK tests `MUST` prove app and console packages use generated app SDK clients or approved appbase wrappers, while admin packages use generated backend SDK clients or approved backend wrappers.
- Static scans `MUST` fail when app/console/admin packages use raw HTTP, manual `Authorization`, `Access-Token`, or `X-API-Key` headers for business flows.
- Root thinness tests `SHOULD` fail when root `src/` contains business service implementations, mock data arrays, domain repositories, or feature-specific SDK orchestration outside bootstrap/core.
- Desktop/tablet-enabled PC roots `MUST` run the native host verification required by `DESKTOP_APP_ARCHITECTURE_SPEC.md`, including `sdkwork-<product>-pc-desktop` package placement, Tauri `devUrl`, `frontendDist`, capabilities, permissions, platform config files, web fallback, iPadOS packaging, and Android tablet packaging when enabled.
- Tablet packaging tests `MUST` verify iPadOS/Android tablet targets reuse the PC renderer, SDK clients, appbase IAM runtime, global TokenManager, and route ownership instead of introducing phone-first H5 or mobile-only auth/runtime code.
- Tablet packaging tests `MUST` verify safe-area, orientation, virtual keyboard, pointer/keyboard, touch/stylus, split view or multi-window behavior where supported, and foreground/background lifecycle handling when tablet targets are enabled.
- Route tests `MUST` prove app, console, and admin route contributions are assembled by their owning shell and do not share hidden route constants or backend API paths.
- Config tests `MUST` prove PC roots separate browser public runtime config, desktop user runtime config, desktop-started server config, container config, and Tauri platform config.
- Profile tests `MUST` prove `dev` normalizes to `development`, `prod` normalizes to `production`, unknown profile aliases fail, and Vite/Tauri/Spring build modes do not replace the SDKWork runtime environment model.
- SDK base URL tests `MUST` prove private env, browser public runtime env, and Vite dev env resolve independent open-api, app-api, backend-api, and dependency SDK base URLs without falling back to one ambiguous global URL.
- Credential config tests `MUST` prove `AUTH_TOKEN`, `ACCESS_TOKEN`, `REFRESH_TOKEN`, `VITE_*_TOKEN`, `PORTAL_PUBLIC_*_TOKEN`, and equivalent live credential env variables are rejected outside explicitly marked test fixtures.
- Access token header tests `MUST` prove SDKWork v3 app-api/backend-api clients use `Access-Token` exactly and reject aliases such as `X-Access-Token` or query-string access tokens.
- Test-profile tests `MUST` prove database/schema, Redis key prefix, logs, cache, runtime, and temp directories are isolated from development and production.
- Release preflight tests `MUST` fail when production PC/desktop/server config contains localhost service endpoints, development secrets, test database names, writable developer directories, unresolved placeholders, or source-controlled secret files.
- Tauri platform config tests `MUST` prove platform files own bundle ids, package names, window metadata, permissions, capabilities, icons, mobile/tablet metadata, and signing references only; they must not contain auth tokens, database credentials, API keys, SDK package ownership, or business route constants.

## 2.5 Drive Uploader Tests

Drive Uploader tests make `DRIVE_SPEC.md` executable for all client and server upload paths.

Rules:

- Drive product service tests `MUST` prove `DriveUploaderService` validates `PrepareUploaderUploadCommand`, `UploaderActor`, `UploaderTarget`, `UploaderRetention`, profile, checksum, part number, offsets, sizes, object target, content type, filename, and tenant/app/resource identifiers.
- Rust server-side upload tests `MUST` prove generated/imported server bytes call `DriveUploaderService`, `PrepareUploaderUploadCommand`, or an approved `sdkwork_drive_product::uploader` facade instead of calling `/app/v3/api/drive/uploader/*` over HTTP or direct S3/OSS/MinIO/local filesystem provider APIs.
- App API route tests `MUST` prove `/app/v3/api/drive/uploader/uploads`, `/app/v3/api/drive/uploader/uploads/{uploadItemId}/parts/{partNo}`, `/app/v3/api/drive/upload_sessions/{uploadSessionId}/parts/{partNo}`, and `/app/v3/api/drive/upload_sessions/{uploadSessionId}/complete` delegate to Drive-owned services and expose SDKWork operationIds.
- App SDK tests `MUST` prove `sdkwork-drive-app-sdk` exposes `client.uploader.upload`, `uploadByProfile`, `uploadVideo`, `uploadImage`, `uploadAudio`, `uploadDocument`, `uploadArchive`, `uploadText`, `uploadDataset`, `uploadAttachment`, `uploadAvatar`, and `uploadThumbnail`.
- Client upload service tests `MUST` prove feature upload facades delegate to injected Drive SDK `client.uploader.*`, provide tenant, organization when applicable, user/anonymous actor, `appId`, `appResourceType`, `appResourceId`, `scene`, `source`, profile, file metadata, target, and retention.
- Attribution tests `MUST` prove Drive uploader facts retain tenant, organization, actor type/id, user id when available, app id, app resource type/id, scene, source, upload profile, content type/group, file size, part counts, Drive space/node/session, and retention.
- Resumability tests `MUST` prove prepare/resume returns already uploaded parts, mark-uploaded is idempotent, missing parts are uploaded only once, and server state remains authoritative over local SDK state.
- Retention and cleanup tests `MUST` prove temporary uploads are swept by Drive maintenance jobs, automatic soft delete/hard delete records audit and `dr_drive_file_sensitive_operation` snapshots, and app-local cleanup jobs do not own Drive content lifecycle.
- Explicit target-space tests `MUST` prove active target-space validation, writer/owner permission checks, anonymous writer share-token handling, raw share-token non-persistence, and forbidden anonymous target writes without a valid share token.
- Business API tests `MUST` prove product commands accept Drive references, Drive-backed `MediaResource`, or business relation ids after upload. They must fail when product APIs expose duplicate `/upload`, `/presign`, `/complete`, upload-session, file-part, bucket, or object-key contracts for SDKWork-owned files.

## 3. Security Tests

Rules:

- Protected app-api and backend-api operations `MUST` test missing auth token, missing access token, invalid token, expired token, wrong tenant, and insufficient permission.
- Protected open-api operations `MUST` test missing API key, invalid API key, expired/revoked API key, wrong tenant/app binding, insufficient permission scope, and the absence of app login token fallback.
- IAM login integration `MUST` test the checks required by `IAM_LOGIN_INTEGRATION_SPEC.md`: appbase boundary, SDK token wiring, route guard, logout clearing, forbidden product-local auth routes, Rust dual-token guard, and AppContext safety.
- App SDK composition tests `MUST` prove appbase app SDK, optional appbase backend SDK, product app SDKs, and product backend SDKs share one token manager through `setTokenManager` or the language-equivalent credential hook.
- Appbase IAM runtime tests `MUST` prove token persistence failure does not update the global token manager, context propagation failure rolls back token/context state, stale AppContext is cleared when a committed session has no context, new sessions do not inherit old refresh tokens, and refresh/current-session continuation preserves refresh tokens only when allowed.
- Logout tests `MUST` prove local token store, global token manager, context store, sensitive caches, realtime/session bridges, and native/platform secure storage clear even when remote session deletion fails.
- Backend/admin SDK tests `MUST` prove backend IAM SDK clients do not expose user-facing `auth.sessions.create`, `auth.registrations.create`, refresh, logout, or equivalent login/session creation resources.
- Public APIs `MUST` test rate limit and input validation when relevant.
- Sensitive responses `MUST` test redaction.

## 4. Frontend Tests

Rules:

- Service tests `MUST` use injected SDK client fakes or generated SDK clients.
- UI tests `SHOULD` verify service integration, loading, error, empty, and permission-denied states.
- Raw HTTP usage in business modules `SHOULD` be checked by static scan.
- Static frontend scans MUST fail on xRequestId, `x-request-id`, `X-Request-Id`, `createRequestId`, or direct `crypto.randomUUID()` usage in application source because request identity is server-owned.
- Static SDK and OpenAPI scans MUST fail when generated app/backend HTTP SDKs or app/backend OpenAPI documents expose `xRequestId` or `X-Request-Id`.
- Static SDK/bootstrap scans MUST fail when protected open-api SDK clients are added to app/backend global token-manager client lists instead of an API key credential provider.
- Static SDK/bootstrap scans MUST fail when authenticated app-api/backend-api SDK clients are not passed through the global token-manager-aware SDK list such as `clients.sdkClients`.
- Static env/config scans MUST fail when `.env`, runtime TOML examples, `/runtime-env.js`, `PORTAL_PUBLIC_*`, or `VITE_*` contain live auth tokens, access tokens, refresh tokens, API keys, generated auth headers, or SDK credential DTOs.
- Static frontend/service scans MUST fail when UI packages or service facades manually assemble auth/API key headers such as `Authorization`, `Access-Token`, or `X-API-Key` instead of using SDK credential APIs.
- Static frontend/service scans MUST fail when UI packages or service facades import Rust route crates such as `sdkwork-routes-*-app-api` or assemble URLs from route constants instead of calling generated SDK clients.
- Static frontend scans MUST fail when browser or service code uses raw object-storage provider SDKs, persists presigned URLs as business identity, or bypasses generated Drive SDK methods for SDKWork-owned uploads/downloads.
- App PC React, PC user console React, PC internal admin React, mobile React, Flutter, and backend/admin React packages `MUST` run the package placement and SDK boundary checks required by `UI_ARCHITECTURE_SPEC.md`, `APP_PC_ARCHITECTURE_SPEC.md` for PC roots, and their detailed UI spec.
- Architecture SDK checks `MUST` verify TypeScript SDKs stay in React packages, Dart/Flutter SDKs stay in Flutter packages, Rust SDKs or Rust service clients stay in Rust/native runtime code, and no package imports another architecture's UI/runtime wrapper to bypass a missing SDK method.
- Public runtime env checks `MUST` fail if `/runtime-env.js`, `/runtime-env.json`, `PORTAL_PUBLIC_*`, `VITE_*`, `PUBLIC_*`, or `NEXT_PUBLIC_*` exposes secrets, database URLs, Redis URLs, tokens, signing keys, private service endpoints, or backend-only credentials.
- Browser bootstrap tests `MUST` prove public runtime config loads before generated SDK clients are constructed and that open-api, app-api, and backend-api base URLs remain independent.
- TokenManager bootstrap tests `MUST` prove base URLs are resolved before SDK construction, the same global token manager is injected into every authenticated app-api/backend-api SDK, and protected open-api SDKs use API key credential providers instead.
- Backend/admin UI verification `MUST` fail if business pages, services, or repositories are placed in `@sdkwork/react-backend-ui`, `@sdkwork/react-backend-core`, or one catch-all backend package instead of `@sdkwork/react-backend-<domain>`.
- PC application architecture verification `MUST` fail if new app, console, or admin packages omit the `pc` segment or if `pc-console` and `pc-admin` packages import each other's business internals.
- App UI verification `MUST` fail if user-facing packages call `/backend/v3/api`, import backend SDK packages, or depend on backend/admin UI packages.
- Backend/admin UI verification `MUST` fail if operator packages call `/app/v3/api` for backend resources or construct raw HTTP requests around missing backend SDK methods.

## 5. Performance And Documentation Tests

Rules:

- P0/P1 APIs `SHOULD` include pagination/bounded-query verification.
- SDK generation tests `MUST` verify the intended nested resource method surface from `SDK_SPEC.md`.
- SDK workspace tests `MUST` verify the intended `sdkwork-<domain>-sdk`, `sdkwork-<domain>-app-sdk`, and `sdkwork-<domain>-backend-sdk` family contracts from `SDK_SPEC.md`, plus the physical workspace placement required by `SDK_WORKSPACE_GENERATION_SPEC.md`, when those surfaces exist.
- SDK workspace tests `MUST` verify route crate -> aggregated API authority -> generated SDK family mappings when Rust route crates participate in API generation, for example `sdkwork-routes-product-app-api` -> `sdkwork-commerce-app-api` -> `sdkwork-commerce-app-sdk`.
- Module README examples `SHOULD` be checked against exported public APIs when tooling is available.
- App manifest changes `SHOULD` run `node apps/scripts/validate-sdkwork-app-standard-v3.mjs`.

## 6. Completion Checklist

- [ ] Relevant spec checklist is satisfied.
- [ ] Repository/application `.sdkwork/skills/` and `.sdkwork/plugins/` checks pass when a repository root or application root is created or maintained.
- [ ] OpenAPI/SDK generation verification passes under `SDK_SPEC.md`.
- [ ] Web backend implementation checks pass under `WEB_BACKEND_SPEC.md` when controllers, route crates, handlers, services, repositories, or runtime composition are touched.
- [ ] SDK workspace layout and OpenAPI authority/derived input checks pass under `SDK_WORKSPACE_GENERATION_SPEC.md` when SDK generation is touched.
- [ ] Rust route crate naming, surface prefix, route manifest, and authority aggregation checks pass when Rust HTTP routes are touched.
- [ ] Proto/RPC generation verification passes when RPC contracts are touched.
- [ ] Typecheck/build passes for touched packages.
- [ ] Security and tenant isolation tests cover negative cases.
- [ ] IAM login/session integration tests cover appbase route guard, logout clearing, SDK boundary, Rust AppContext validation, and forbidden local auth namespaces when relevant.
- [ ] Frontend service uses injected SDK clients.
- [ ] UI architecture package placement and SDK surface checks pass for touched UI packages.
- [ ] PC application architecture root layout, package naming, app/console/admin separation, desktop/tablet host checks, and iPadOS/Android tablet packaging checks pass when a PC application root is touched.
- [ ] Environment/config checks pass for lifecycle environment, profile alias, deployment mode, build mode, runtime target, dev/test/staging/prod files, local override ignore rules, desktop/server split, browser public runtime, container config, and Tauri platform config.
- [ ] SDK base URL and Access-Token checks pass for per-surface base URL resolution, dependency SDK base URLs, forbidden token env variables, `Access-Token` header semantics, and global TokenManager injection.
- [ ] Verification commands and outputs are recorded.
