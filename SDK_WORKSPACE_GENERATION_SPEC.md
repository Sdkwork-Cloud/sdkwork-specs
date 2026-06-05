# SDK Workspace And OpenAPI Generation Detail Standard

- Version: 1.0
- Scope: project-level `sdks/` workspace layout, SDK family directory placement, OpenAPI 3.x authority documents, derived generator inputs, generated output boundaries, backend API SDK generation workflow
- Related: `API_SPEC.md`, `SDK_SPEC.md`, `COMPONENT_SPEC.md`, `DOMAIN_SPEC.md`, `IAM_LOGIN_INTEGRATION_SPEC.md`, `BACKEND_UI_SPEC.md`, `FRONTEND_SPEC.md`, `CONFIG_SPEC.md`, `TEST_SPEC.md`, `GOVERNANCE_SPEC.md`

This detail standard implements the SDK workspace and OpenAPI generation parts of `SDK_SPEC.md`. It defines how an application keeps SDK generation work in the `sdks/` directory under its application root while preserving one common SDKWork architecture. The application root may live in any repository or product directory; this standard does not assume any fixed parent directory structure. It is intentionally independent of Craw Chat, IM, Java, Rust, React, Flutter, Tauri, SaaS, private, or local deployment choices.

`SDK_SPEC.md` is the primary SDK standard and owns the SDK system model, canonical naming vocabulary, package semantics, generated client surface, auth handling, service facade boundary, integration rules, and generated client quality rules. This file is subordinate to `SDK_SPEC.md`; it owns only the physical application-root `sdks/` structure, SDK family directory placement, OpenAPI authority document materialization, derived generator inputs, generated output placement, and backend API SDK generation workflow.

The canonical SDK generator is defined by `SDK_SPEC.md`: repository-relative `sdk/sdkwork-sdk-generator`, local path `D:\javasource\spring-ai-plus\sdk\sdkwork-sdk-generator`, package `@sdkwork/sdk-generator`, CLI `sdkgen`, and executable `D:\javasource\spring-ai-plus\sdk\sdkwork-sdk-generator\bin\sdkgen.js`. Repository-local generation scripts are allowed only as thin wrappers that materialize input OpenAPI, pass standardized generator arguments, and route output into the application `sdks/` workspace. They must not substitute another generator, use copied generator source, call ad hoc OpenAPI client tools, present `sdkwork-code-generator` as a separate standard, or silently fall back to local stubs for committed SDK output. `sdkwork-code-generator` is only an alias/wrapper name when a repository explicitly documents that it executes this canonical `sdkgen.js` entrypoint; it is not an independent SDKWork HTTP SDK generator.

If this file appears to conflict with `SDK_SPEC.md`, follow `SDK_SPEC.md` for SDK semantics and package/client behavior. Use this file for repository layout and generation artifact placement only when consistent with `SDK_SPEC.md`.

## 1. Principles

Rules:

- `SDK_SPEC.md` is the primary SDK standard. This file operationalizes its workspace and generation requirements for repositories and CI.
- Every application that owns generated SDKs `MUST` create `sdks/` under the application root.
- The `sdks/` directory `MUST` be organized by SDK family directories. API authority documents live inside the owning SDK family; API authority names are not top-level SDK family directories.
- OpenAPI 3.x documents are the authority for HTTP SDK generation.
- HTTP SDK generation `MUST` call `D:\javasource\spring-ai-plus\sdk\sdkwork-sdk-generator\bin\sdkgen.js`.
- Generated SDK output `MUST NOT` be hand-edited. Fix the runtime API, OpenAPI authority, generator profile, or composed facade, then regenerate.
- Generated HTTP SDK output `MUST` retain the `sdkgen` control plane: `sdkwork-sdk.json`, `.sdkwork/sdkwork-generator-manifest.json`, `.sdkwork/sdkwork-generator-changes.json`, `.sdkwork/sdkwork-generator-report.json`, and the regeneration-safe `custom/` root.
- Handwritten extensions belong only in generated `custom/` roots or approved `composed/` facades outside generated ownership.
- SDK family wrapper scripts `MUST` fail fast when the canonical generator is missing. Stub generators are allowed only as isolated tooling fixtures, not as official SDK family output producers.
- SDK family wrapper scripts, READMEs, manifests, and CI jobs `MUST` identify the generator as `@sdkwork/sdk-generator` / `sdkgen` and record the canonical path or resolved package location plus the generator version or commit.
- Consumer code `MUST` use generated SDK packages or approved composed wrappers. It `MUST NOT` replace missing SDK methods with raw HTTP, manual auth headers, local DTO forks, or package-local OpenAPI forks.
- Backend API SDKs `MUST` be generated from backend OpenAPI contracts and consumed by backend/admin integrations only.
- App/user-facing UI `MUST NOT` call backend SDKs or `/backend/v3/api`.

## 2. Standard Workspace Shape

Recommended application-root shape:

```text
<application-root>/
  sdks/
    README.md
    materialize-<domain>-v<major>-openapi-boundaries.mjs
    workspace-*.mjs
    _shared/
    test/
    sdkwork-<domain>-sdk/
      README.md
      openapi/
        <domain>-open-api.openapi.yaml
        <domain>-open-api.sdkgen.yaml
        <domain>-open-api.flutter.sdkgen.yaml
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
        <domain>-app-api.openapi.yaml
        <domain>-app-api.sdkgen.yaml
        <domain>-app-api.flutter.sdkgen.yaml
      ...
    sdkwork-<domain>-backend-sdk/
      openapi/
        <domain>-backend-api.openapi.yaml
        <domain>-backend-api.sdkgen.yaml
      ...
```

Rules:

- `sdkwork-<domain>-sdk` is the public/open domain SDK family.
- `sdkwork-<domain>-app-sdk` is the app/client SDK family for app-api contracts.
- `sdkwork-<domain>-backend-sdk` is the backend/admin SDK family for backend-api contracts.
- `<domain>` is the application domain model, in kebab-case. It should match `DOMAIN_SPEC.md` unless the product has an approved local domain alias.
- Non-OpenAPI SDKs are allowed only when they are declared as provider/runtime SDKs, for example `sdkwork-rtc-sdk`. They `MUST` document that they are not route-generated HTTP SDKs.
- Support directories such as `_shared/` and `test/` may exist under `sdks/` when they serve multiple SDK families.
- Generated language output belongs below the owning SDK family. Do not place generated SDK packages at random application roots.

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
- The default/open generated SDK family is always `sdkwork-<domain>-sdk`, not `sdkwork-<domain>-open-api` and not `sdkwork-<domain>-open-sdk`.
- Generated language workspaces `MUST` inherit the SDK family name exactly: `sdkwork-<domain>-sdk-{language}`, `sdkwork-<domain>-app-sdk-{language}`, and `sdkwork-<domain>-backend-sdk-{language}`.
- Generated package names `MUST` trace to the SDK family, not the API authority: `sdkwork-<domain>-sdk-generated-{language}`, `sdkwork-<domain>-app-sdk-generated-{language}`, and `sdkwork-<domain>-backend-sdk-generated-{language}` unless a documented public package alias is declared in the family manifest.
- Public package names may be shorter than workspace names, for example `@sdkwork/im-sdk`, but the package must trace back to the SDK family and authority OpenAPI.
- App SDKs may depend on public/domain SDKs or provider SDKs only through public package entrypoints. They `MUST NOT` import generated transport internals from another family.
- Backend SDKs `MUST NOT` depend on app UI packages, app route guards, or user-facing shell runtime.

Example mapping:

| Domain | SDK family | API authority | Prefix |
| --- | --- | --- | --- |
| `im` | `sdkwork-im-sdk` | `sdkwork-im-open-api` | `/im/v3/api` |
| `im` | `sdkwork-im-app-sdk` | `sdkwork-im-app-api` | `/app/v3/api` |
| `im` | `sdkwork-im-backend-sdk` | `sdkwork-im-backend-api` | `/backend/v3/api` |

## 4. OpenAPI Authority And Derived Inputs

Each OpenAPI-generated SDK family has two contract layers.

| Layer | File pattern | Ownership |
| --- | --- | --- |
| Authority OpenAPI | `openapi/<api-authority>.openapi.yaml` | Human-reviewed source of truth aligned with runtime routes/controllers |
| Derived generator input | `openapi/<api-authority>.sdkgen.yaml`, optional `openapi/<api-authority>.flutter.sdkgen.yaml` | Materialized, deterministic generator input |

Rules:

- Authority OpenAPI documents `MUST` use the OpenAPI 3.x profile in `API_SPEC.md`.
- Derived generator inputs `MUST` be reproducible from the authority document and materialization script.
- Derived generator inputs `MUST NOT` introduce operations, schemas, security, or paths that are absent from the authority document.
- Generator-specific normalization, language quirks, and Flutter-specific adjustments belong in derived inputs, not runtime API code.
- Authority and derived inputs `MUST` preserve operationId, tag, path, schema, security, and problem-detail semantics.
- OpenAPI documents for app-api and backend-api `MUST` use dual-token security where required by `API_SPEC.md` and `IAM_LOGIN_INTEGRATION_SPEC.md`.
- OpenAPI documents `MUST NOT` expose `X-Request-Id` or client-supplied request correlation IDs for app/backend SDKs.

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
runtime API/controller/route
  -> authority OpenAPI
  -> materialized sdkgen OpenAPI
  -> D:\javasource\spring-ai-plus\sdk\sdkwork-sdk-generator\bin\sdkgen.js
  -> generated language SDK
  -> composed facade when needed
  -> consumer service integration
```

Rules:

- Add or change the runtime API and authority OpenAPI in the same change set.
- Run the family materialization script before SDK generation.
- Generate language packages from derived `*.sdkgen.yaml` inputs, not from ad hoc Swagger UI output.
- Generate language packages with the canonical `sdkgen.js` entrypoint from `D:\javasource\spring-ai-plus\sdk\sdkwork-sdk-generator`; do not use PATH-resolved generators unless the wrapper first proves they are the same canonical generator installation.
- Put generated transport code under `generated/server-openapi`.
- Put handwritten semantic facades under `composed` only when the SDK family intentionally owns a composed layer.
- Composed code must import generated transport through package root entrypoints, not private generated source paths.
- Generator package, canonical path or resolved package location, generator version or commit, commands, input spec paths, output paths, package names, SDK type, language targets, profile, and wrapper name when present `MUST` be captured in a manifest or README.
- Re-running materialization and generation without contract changes `SHOULD` be idempotent.

## 7. Language Baseline

The standard OpenAPI HTTP SDK language set is:

- TypeScript
- Flutter
- Rust
- Java
- C#
- Swift
- Kotlin
- Go
- Python

Rules:

- A product may generate fewer languages only when its README declares the supported subset and no consumer expects the missing package.
- TypeScript and Flutter may use layered generated-plus-composed workspaces.
- Rust, Java, C#, Swift, Kotlin, Go, Python, and similar targets should keep handwritten helpers thin and outside generated output.
- Android requests route to Kotlin as the generator target unless a separate Android wrapper is explicitly approved.
- iOS requests route to Swift as the generator target unless a separate iOS wrapper is explicitly approved.

## 8. Application Integration Rules

Rules:

- UI code calls services. Services call injected SDK clients. SDK clients own transport.
- App-side PC React, mobile React, Flutter, desktop, and Tauri renderers use app SDKs for user-facing remote business capability.
- Backend/admin UI uses backend SDKs for operator capability and follows `BACKEND_UI_SPEC.md`.
- IAM login/session integration follows `IAM_LOGIN_INTEGRATION_SPEC.md`; do not regenerate product-local login SDKs for appbase-owned auth flows.
- Rust local/private implementations must expose the same OpenAPI paths, operationIds, schemas, errors, and security semantics as the Java SaaS contract for shared APIs.
- Tauri commands should validate local/native capability and then call Rust services or injected SDK clients through approved boundaries. They must not become a hidden raw HTTP SDK replacement.

## 9. Verification

Every SDK family change should verify the relevant subset:

- OpenAPI validates under `API_SPEC.md`.
- HTTP SDK generation uses `@sdkwork/sdk-generator` / `sdkgen` from `D:\javasource\spring-ai-plus\sdk\sdkwork-sdk-generator`.
- No official SDK generation command, manifest, README, or CI job uses copied generator code, local stubs, generic OpenAPI generators, product-local aliases, or an independent `sdkwork-code-generator`. `sdkwork-code-generator` is only an alias/wrapper name for the canonical `D:\javasource\spring-ai-plus\sdk\sdkwork-sdk-generator\bin\sdkgen.js` entrypoint.
- The application root has no forbidden SDK family directories matching `sdks/sdkwork-<domain>-open-api`, `sdks/sdkwork-<domain>-app-api`, `sdks/sdkwork-<domain>-backend-api`, `sdks/<domain>-open-sdk`, `sdks/<domain>-app-sdk`, or `sdks/<domain>-backend-sdk`.
- Generated language workspace directories, generated package names, `sdkMetadata.name`, `sdk-manifest.json.sdkName`, assembly `workspace`, generator `SDK_NAME`, and generator `--sdk-name` all use the SDK family name, not the API authority name.
- Generated output retains `sdkwork-sdk.json`, `.sdkwork/sdkwork-generator-manifest.json`, `.sdkwork/sdkwork-generator-changes.json`, `.sdkwork/sdkwork-generator-report.json`, and `custom/`.
- Materialization script produces deterministic authority-to-derived output.
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
- [ ] HTTP SDK generation uses the canonical `@sdkwork/sdk-generator` / `sdkgen` from `D:\javasource\spring-ai-plus\sdk\sdkwork-sdk-generator`.
- [ ] Generation manifest or README records generator package, canonical path or resolved package location, generator version or commit, command, input, output, language, SDK type, package name, SDK family name, and standard profile.
- [ ] Generated output retains `sdkwork-sdk.json`, `.sdkwork/sdkwork-generator-manifest.json`, `.sdkwork/sdkwork-generator-changes.json`, `.sdkwork/sdkwork-generator-report.json`, and `custom/`.
- [ ] SDK families use `sdkwork-<domain>-sdk`, `sdkwork-<domain>-app-sdk`, and `sdkwork-<domain>-backend-sdk` where those surfaces exist.
- [ ] No `sdks/sdkwork-<domain>-open-api`, `sdks/sdkwork-<domain>-app-api`, `sdks/sdkwork-<domain>-backend-api`, `sdks/<domain>-open-sdk`, `sdks/<domain>-app-sdk`, or `sdks/<domain>-backend-sdk` directory exists.
- [ ] Generated SDK metadata, manifests, package names, language workspace names, and generator arguments use the SDK family name and do not use API authority names as SDK names.
- [ ] Family README declares SDK family, API authority name, API prefix, audience, generated languages, and verification commands.
- [ ] `specs/component.spec.json` exists for every authored SDK family.
- [ ] Authority OpenAPI and derived `sdkgen` inputs are separated.
- [ ] Generated output is under `generated/server-openapi`.
- [ ] Handwritten facades are outside generated output.
- [ ] Backend API OpenAPI uses `/backend/v3/api` and has no login/session namespace.
- [ ] Consumers use generated SDKs or approved composed wrappers only.
- [ ] Verification commands are recorded in the change or release notes.
