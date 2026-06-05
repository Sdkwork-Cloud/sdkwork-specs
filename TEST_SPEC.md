# Test And Verification Standard

- Version: 1.0
- Scope: contract tests, SDK/RPC generation tests, backend tests, frontend tests, parity tests, security tests
- Related: all specs

No standard is complete until it is executable.

## 1. Required Test Classes

| Area | Required verification |
| --- | --- |
| API | OpenAPI validation, strict profile validation, request/response examples |
| RPC | Proto compile, proto lint, breaking-change check, service manifest, unary server/client smoke tests, generated cross-language client checks |
| SDK | Validate `SDK_SPEC.md` semantics, validate application-root `sdks/` layout from `SDK_WORKSPACE_GENERATION_SPEC.md`, materialize OpenAPI authority to derived generator inputs, generate SDK through `D:\javasource\spring-ai-plus\sdk\sdkwork-sdk-generator` (`@sdkwork/sdk-generator` / `sdkgen`), compile SDK, verify README examples and method surface |
| Database | Schema lint, migration test, tenant/index checks |
| Drive | Drive API/SDK contract tests, upload-session idempotency, provider capability tests, business-module scans for forbidden app-local storage lifecycle |
| IAM/security | Token validation, permission denial, tenant isolation, audit event, appbase login integration, logout clearing, Rust AppContext guard |
| Frontend | Service tests with injected SDK client, UI integration tests |
| UI architecture | Static/package scan that the package family matches `UI_ARCHITECTURE_SPEC.md` plus exactly one of `APP_PC_REACT_UI_SPEC.md`, `APP_MOBILE_REACT_UI_SPEC.md`, `APP_FLUTTER_UI_SPEC.md`, or `BACKEND_UI_SPEC.md` |
| Deployment | SaaS/local/private parity tests |
| Events | Schema compatibility, idempotent consumer, replay behavior |
| Performance | Pagination, latency budget, retry, rate-limit behavior |
| Documentation | README/examples match public contracts |

## 2. Contract Tests

Rules:

- Every API change `MUST` include a test that proves the OpenAPI contract can generate the intended SDK shape.
- Every SDK workspace or OpenAPI generation change `MUST` satisfy `SDK_SPEC.md` first for canonical SDK/API naming vocabulary, family naming, package semantics, generated client behavior, auth behavior, and service integration; then satisfy `SDK_WORKSPACE_GENERATION_SPEC.md` for application-root `sdks/` layout, authority OpenAPI location, deterministic derived inputs, generated-output placement, and component specs.
- SDK generation verification `MUST` prove the command uses the canonical `@sdkwork/sdk-generator` / `sdkgen` from `D:\javasource\spring-ai-plus\sdk\sdkwork-sdk-generator`; `sdkwork-code-generator`, local stubs, copied generator code, or generic OpenAPI generators are not valid production SDK verification evidence.
- File storage, upload, download, and object-storage contract changes `MUST` verify Drive API/SDK generation and must scan business modules for forbidden app-local upload/session/provider/object lifecycle code.
- Every RPC change `MUST` include a test that proves proto contracts compile and generated clients expose the intended service/method surface.
- New SDKWork v3 app, backend, and IM API generation tests `MUST` run the SDK generator with `--standard-profile sdkwork-v3`.
- New standard RPC contracts `SHOULD` run proto lint and breaking-change checks.
- Breaking changes `MUST` fail compatibility tests unless explicitly approved in `GOVERNANCE_SPEC.md`.

## 2.1 RPC Contract Tests

Rules:

- RPC manifest tests `MUST` verify every service method maps to an SDKWork operationId or a documented composition method.
- Public RPC packages `MUST` generate and compile Rust clients plus at least one non-Rust client in CI or release validation.
- Rust RPC server tests `MUST` cover metadata auth, access token, request id, trace, deadline, idempotency key, and error mapping.
- Health and reflection behavior `MUST` be tested for local/private/production configuration.
- RPC adapter tests `MUST` verify the adapter uses runtime/service boundaries and does not depend on HTTP/Tauri adapters or direct SQLx storage unless explicitly approved.

## 3. Security Tests

Rules:

- Protected APIs `MUST` test missing auth token, missing access token, invalid token, expired token, wrong tenant, and insufficient permission.
- IAM login integration `MUST` test the checks required by `IAM_LOGIN_INTEGRATION_SPEC.md`: appbase boundary, SDK token wiring, route guard, logout clearing, forbidden product-local auth routes, Rust dual-token guard, and AppContext safety.
- Public APIs `MUST` test rate limit and input validation when relevant.
- Sensitive responses `MUST` test redaction.

## 4. Frontend Tests

Rules:

- Service tests `MUST` use injected SDK client fakes or generated SDK clients.
- UI tests `SHOULD` verify service integration, loading, error, empty, and permission-denied states.
- Raw HTTP usage in business modules `SHOULD` be checked by static scan.
- Static frontend scans MUST fail on xRequestId, `x-request-id`, `X-Request-Id`, `createRequestId`, or direct `crypto.randomUUID()` usage in application source because request identity is server-owned.
- Static SDK and OpenAPI scans MUST fail when generated app/backend HTTP SDKs or app/backend OpenAPI documents expose `xRequestId` or `X-Request-Id`.
- Static frontend scans MUST fail when browser or service code uses raw object-storage provider SDKs, persists presigned URLs as business identity, or bypasses generated Drive SDK methods for SDKWork-owned uploads/downloads.
- App PC React, mobile React, Flutter, and backend/admin React packages `MUST` run the package placement and SDK boundary checks required by `UI_ARCHITECTURE_SPEC.md` and their detailed UI spec.
- Backend/admin UI verification `MUST` fail if business pages, services, or repositories are placed in `@sdkwork/react-backend-ui`, `@sdkwork/react-backend-core`, or one catch-all backend package instead of `@sdkwork/react-backend-<domain>`.
- App UI verification `MUST` fail if user-facing packages call `/backend/v3/api`, import backend SDK packages, or depend on backend/admin UI packages.
- Backend/admin UI verification `MUST` fail if operator packages call `/app/v3/api` for backend resources or construct raw HTTP requests around missing backend SDK methods.

## 5. Performance And Documentation Tests

Rules:

- P0/P1 APIs `SHOULD` include pagination/bounded-query verification.
- SDK generation tests `MUST` verify the intended nested resource method surface from `SDK_SPEC.md`.
- SDK workspace tests `MUST` verify the intended `sdkwork-<domain>-sdk`, `sdkwork-<domain>-app-sdk`, and `sdkwork-<domain>-backend-sdk` family contracts from `SDK_SPEC.md`, plus the physical workspace placement required by `SDK_WORKSPACE_GENERATION_SPEC.md`, when those surfaces exist.
- Module README examples `SHOULD` be checked against exported public APIs when tooling is available.
- App manifest changes `SHOULD` run `node apps/scripts/validate-sdkwork-app-standard-v3.mjs`.

## 6. Completion Checklist

- [ ] Relevant spec checklist is satisfied.
- [ ] OpenAPI/SDK generation verification passes under `SDK_SPEC.md`.
- [ ] SDK workspace layout and OpenAPI authority/derived input checks pass under `SDK_WORKSPACE_GENERATION_SPEC.md` when SDK generation is touched.
- [ ] Proto/RPC generation verification passes when RPC contracts are touched.
- [ ] Typecheck/build passes for touched packages.
- [ ] Security and tenant isolation tests cover negative cases.
- [ ] IAM login/session integration tests cover appbase route guard, logout clearing, SDK boundary, Rust AppContext validation, and forbidden local auth namespaces when relevant.
- [ ] Frontend service uses injected SDK clients.
- [ ] UI architecture package placement and SDK surface checks pass for touched UI packages.
- [ ] Verification commands and outputs are recorded.
