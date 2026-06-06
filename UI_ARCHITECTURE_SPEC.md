# UI Architecture Selection Standard

- Version: 1.0
- Scope: UI architecture selection, package-family ownership, app/backend surface separation, SDK boundary verification
- Related: `FRONTEND_SPEC.md`, `APPLICATION_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, `APP_PC_ARCHITECTURE_SPEC.md`, `MODULE_SPEC.md`, `COMPONENT_SPEC.md`, `APP_PC_REACT_UI_SPEC.md`, `APP_MOBILE_REACT_UI_SPEC.md`, `APP_FLUTTER_UI_SPEC.md`, `BACKEND_UI_SPEC.md`, `SDK_SPEC.md`, `API_SPEC.md`, `TEST_SPEC.md`

This standard is the required entrypoint for UI package placement. It decides which architecture-specific UI standard owns the work. It does not replace the detailed UI standards; it prevents package drift before files are created.

For PC browser/desktop/tablet application roots, apply `APP_PC_ARCHITECTURE_SPEC.md` before choosing the detailed UI package standard. That PC root standard owns the normalized `sdkwork-<product>-pc-*`, `sdkwork-<product>-pc-console-*`, and `sdkwork-<product>-pc-admin-*` package taxonomy, plus large-screen tablet packaging through Tauri when enabled.

## 1. Selection Gate

Every UI change `MUST` declare exactly one primary UI architecture before implementation starts.

| Primary architecture | Owning package family | API surface | SDK language and boundary | IAM/appbase boundary | Detailed standard |
| --- | --- | --- | --- | --- | --- |
| App PC React | `packages/pc-react/<domain>/sdkwork-<capability>-pc-react` or `apps/<product>-pc/packages/sdkwork-<product>-pc-<capability>` | `/app/v3/api` | generated TypeScript app SDK or approved appbase wrapper | `@sdkwork/iam-runtime`, `@sdkwork/iam-react`, `@sdkwork/auth-pc-react`, global TokenManager | `APP_PC_ARCHITECTURE_SPEC.md`, then `APP_PC_REACT_UI_SPEC.md` |
| PC user console React | `apps/<product>-pc/packages/sdkwork-<product>-pc-console-<capability>` | `/app/v3/api` or approved console-facing app SDK surface | generated TypeScript app SDK or approved appbase/console wrapper | appbase IAM runtime, console route guards, global TokenManager | `APP_PC_ARCHITECTURE_SPEC.md`, then `APP_PC_REACT_UI_SPEC.md` |
| PC internal admin React | `apps/<product>-pc/packages/sdkwork-<product>-pc-admin-<capability>` | `/backend/v3/api` | generated TypeScript backend SDK or approved backend wrapper | appbase backend SDK for IAM administration; no user-facing auth sessions | `APP_PC_ARCHITECTURE_SPEC.md`, then `BACKEND_UI_SPEC.md` |
| App mobile React | `packages/mobile-react/<domain>/sdkwork-<capability>-mobile-react` | `/app/v3/api` | generated TypeScript app SDK plus typed host adapters | appbase mobile wrapper or approved appbase IAM runtime adapter, global TokenManager | `APP_MOBILE_REACT_UI_SPEC.md` |
| App Flutter | `packages/mobile-flutter/<domain>/sdkwork_<capability>_flutter` | `/app/v3/api` | generated Dart/Flutter app SDK plus platform adapters | generated Dart/Flutter appbase SDK or approved appbase Flutter wrapper, global token-manager equivalent | `APP_FLUTTER_UI_SPEC.md` |
| Backend/admin React | `apps/sdkwork-backend-react-web/packages/sdkwork-react-backend-<domain>` | `/backend/v3/api` | generated TypeScript backend SDK or approved backend wrapper | appbase backend SDK for IAM administration; no user-facing auth sessions | `BACKEND_UI_SPEC.md` |

Rules:

- A single UI package `MUST NOT` mix app UI and backend/admin UI.
- A single UI package `MUST NOT` mix PC React, mobile React, Flutter, and backend/admin React implementations.
- Cross-architecture reuse belongs in contract, service, i18n, token, or generated SDK packages with no UI imports.
- If an existing package path does not match the selected architecture, move or wrap the capability before adding new business behavior.
- User-facing auth, registration, session, OAuth, verification-code login, QR login, password reset, and current user flows belong to app UI and app-api.
- PC packages without `pc-console` or `pc-admin` are app/user packages by default.
- PC `console` packages are user-facing management console packages for customers, tenants, app owners, or product users who manage their own resources.
- PC `admin` packages are company-internal staff/operator packages and use backend-api/backend SDK boundaries.
- Operator-only configuration, audit, provider binding, tenant administration, resource moderation, and platform management belong to backend/admin UI and backend-api.

## 2. Package Ownership

UI package ownership is domain-first and architecture-second.

Rules:

- Domain names `MUST` come from `DOMAIN_SPEC.md`.
- App UI packages `MUST` be split by user-facing domain and capability.
- Backend/admin UI packages `MUST` be split as `@sdkwork/react-backend-<domain>` and aligned with permission prefixes.
- PC user-facing console packages `MUST` be split as `sdkwork-<product>-pc-console-<capability>` and must not be named or treated as internal admin packages.
- PC internal admin packages `MUST` be split as `sdkwork-<product>-pc-admin-<capability>` and must not be placed in user app or console package families.
- `@sdkwork/react-backend-ui` may contain only domain-neutral primitives.
- `@sdkwork/react-backend-core` may contain only SDK/runtime/provider infrastructure.
- Packages named `common`, `misc`, `manager`, `base`, `core`, `admin`, `backend`, or `console` `MUST NOT` own business pages, business services, repositories, route records, menu records, permission constants, or domain i18n unless a root spec explicitly defines their bounded context.
- Multi-domain screens `MUST` compose public exports from domain packages. They must not create a new catch-all business package.

## 3. SDK Boundary

UI architecture decides the SDK surface.

| UI package type | Must use | Must not use |
| --- | --- | --- |
| App PC React | injected app SDK client or appbase service wrapper | backend SDK, backend UI packages, raw HTTP |
| PC user console React | injected app SDK client or approved console-facing appbase wrapper | admin package internals, backend-only SDK resources without an approved console contract, raw HTTP |
| PC internal admin React | injected backend SDK client or backend-core/admin wrapper | app SDK login/session creation, app/console package internals, raw HTTP |
| App mobile React | injected app SDK client, typed host adapters | backend SDK, backend UI packages, native globals for business API calls |
| App Flutter | generated Dart/Flutter app SDK, platform adapter interfaces | backend SDK, React packages, raw `http` calls for app business |
| Backend/admin React | injected backend SDK client or backend-core wrapper | app SDK for operator resources, app UI packages, raw HTTP |

Rules:

- UI components call hooks/services. Services call injected SDK clients.
- Missing SDK methods `MUST` be fixed in the owning app-api, backend-api, or approved open-api OpenAPI contract and generator flow.
- Handwritten raw HTTP fallbacks, manual token/API key headers, local DTO forks, and generated SDK output edits are forbidden for UI business flows.
- Runtime/bootstrap constructs concrete SDK clients. Reusable UI packages receive typed clients, services, or providers.
- Runtime/bootstrap `MUST` apply `APP_SDK_INTEGRATION_SPEC.md`: create one global token manager for authenticated app-api/backend-api SDK clients, bind it to appbase and downstream SDK clients, and keep protected open-api credentials in a separate provider when API key mode is declared.
- Appbase IAM login, registration, session, refresh, logout, verification, OAuth, QR auth, password reset, runtime metadata, and current-user self-service `MUST` remain appbase app SDK or approved appbase wrapper responsibilities.
- Backend/admin IAM management `MUST` use appbase backend SDK resources and must not expose or consume user-facing `auth.sessions.create` through backend SDKs.
- The generated SDK language must match the selected architecture: TypeScript for React packages, Dart/Flutter for Flutter packages, and Rust SDKs or Rust service clients for Rust/native runtime code.
- When a UI/service package consumes a protected open-api SDK, it `MUST` receive an injected open-api SDK client and approved API key credential provider through runtime/bootstrap. It `MUST NOT` place that SDK in app/backend token-manager client lists or assemble `X-API-Key` headers directly.

## 4. Visual And Interaction Boundary

Architecture standards own platform-specific interaction rules.

Rules:

- App PC React optimizes for keyboard, pointer, route persistence, dense desktop layout, multitasking, and adaptive iPadOS/Android tablet large-screen behavior when those targets are enabled.
- App mobile React optimizes for touch, safe areas, compact widths, native host adapters, and app lifecycle transitions.
- App Flutter optimizes for platform widgets, responsive mobile/tablet/foldable/desktop surfaces, and platform adapter interfaces.
- Backend/admin React optimizes for dense, flat, operational workflows with tables, filters, drawers, dialogs, tabs, and repeated administrative actions.
- Shared visual tokens may be common, but package-local global themes, reset CSS, and shell layout overrides are forbidden in domain packages.

## 5. Required Verification

Every touched UI package `MUST` prove the selected architecture boundary.

| Verification | Required evidence |
| --- | --- |
| Package family | Static scan or component spec proves the package path matches the selected architecture. |
| SDK surface | Service tests use fake or generated SDK clients matching the selected SDK surface. |
| No bypass | Static scan proves no raw HTTP, manual token/API key headers, backend/app cross-surface calls, open-api token-manager misuse, or generated SDK edits were introduced. |
| Domain split | Backend/admin business code is not placed in `@sdkwork/react-backend-ui`, `@sdkwork/react-backend-core`, or any catch-all package. |
| UI states | Tests cover loading, empty, validation-error, permission-denied, unavailable, and unknown-error states where applicable. |
| i18n | User-facing or operator-facing copy lives in the package i18n boundary or configured message catalog. |

## 6. Acceptance Checklist

- [ ] Exactly one primary UI architecture was selected.
- [ ] The package path matches the selected architecture table.
- [ ] The detailed architecture standard was applied.
- [ ] Architecture-specific generated SDK language and appbase IAM boundary follow `APP_SDK_INTEGRATION_SPEC.md`.
- [ ] Domain ownership follows `DOMAIN_SPEC.md`.
- [ ] App UI uses app-api/app SDK only for user-facing workflows.
- [ ] Backend/admin UI uses backend-api/backend SDK only for operator workflows.
- [ ] Backend/admin business UI is split by `@sdkwork/react-backend-<domain>`.
- [ ] No catch-all business package was introduced.
- [ ] No raw HTTP, manual auth/API key header, DTO fork, open-api token-manager misuse, or generated SDK edit was introduced.
- [ ] Tests or scans prove package placement, SDK boundary, and representative UI states.
