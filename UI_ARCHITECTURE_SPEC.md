# UI Architecture Selection Standard

- Version: 1.0
- Scope: UI architecture selection, package-family ownership, app/backend surface separation, SDK boundary verification
- Related: `FRONTEND_SPEC.md`, `APPLICATION_SPEC.md`, `MODULE_SPEC.md`, `COMPONENT_SPEC.md`, `APP_PC_REACT_UI_SPEC.md`, `APP_MOBILE_REACT_UI_SPEC.md`, `APP_FLUTTER_UI_SPEC.md`, `BACKEND_UI_SPEC.md`, `SDK_SPEC.md`, `API_SPEC.md`, `TEST_SPEC.md`

This standard is the required entrypoint for UI package placement. It decides which architecture-specific UI standard owns the work. It does not replace the detailed UI standards; it prevents package drift before files are created.

## 1. Selection Gate

Every UI change `MUST` declare exactly one primary UI architecture before implementation starts.

| Primary architecture | Owning package family | API surface | SDK boundary | Detailed standard |
| --- | --- | --- | --- | --- |
| App PC React | `packages/pc-react/<domain>/sdkwork-<capability>-pc-react` | `/app/v3/api` | generated app SDK or approved appbase wrapper | `APP_PC_REACT_UI_SPEC.md` |
| App mobile React | `packages/mobile-react/<domain>/sdkwork-<capability>-mobile-react` | `/app/v3/api` | generated app SDK plus typed host adapters | `APP_MOBILE_REACT_UI_SPEC.md` |
| App Flutter | `packages/mobile-flutter/<domain>/sdkwork_<capability>_flutter` | `/app/v3/api` | generated Dart/Flutter app SDK plus platform adapters | `APP_FLUTTER_UI_SPEC.md` |
| Backend/admin React | `apps/sdkwork-backend-react-web/packages/sdkwork-react-backend-<domain>` | `/backend/v3/api` | generated backend SDK or approved backend wrapper | `BACKEND_UI_SPEC.md` |

Rules:

- A single UI package `MUST NOT` mix app UI and backend/admin UI.
- A single UI package `MUST NOT` mix PC React, mobile React, Flutter, and backend/admin React implementations.
- Cross-architecture reuse belongs in contract, service, i18n, token, or generated SDK packages with no UI imports.
- If an existing package path does not match the selected architecture, move or wrap the capability before adding new business behavior.
- User-facing auth, registration, session, OAuth, verification-code login, QR login, password reset, and current user flows belong to app UI and app-api.
- Operator-only configuration, audit, provider binding, tenant administration, resource moderation, and platform management belong to backend/admin UI and backend-api.

## 2. Package Ownership

UI package ownership is domain-first and architecture-second.

Rules:

- Domain names `MUST` come from `DOMAIN_SPEC.md`.
- App UI packages `MUST` be split by user-facing domain and capability.
- Backend/admin UI packages `MUST` be split as `@sdkwork/react-backend-<domain>` and aligned with permission prefixes.
- `@sdkwork/react-backend-ui` may contain only domain-neutral primitives.
- `@sdkwork/react-backend-core` may contain only SDK/runtime/provider infrastructure.
- Packages named `common`, `misc`, `manager`, `base`, `core`, `admin`, `backend`, or `console` `MUST NOT` own business pages, business services, repositories, route records, menu records, permission constants, or domain i18n unless a root spec explicitly defines their bounded context.
- Multi-domain screens `MUST` compose public exports from domain packages. They must not create a new catch-all business package.

## 3. SDK Boundary

UI architecture decides the SDK surface.

| UI package type | Must use | Must not use |
| --- | --- | --- |
| App PC React | injected app SDK client or appbase service wrapper | backend SDK, backend UI packages, raw HTTP |
| App mobile React | injected app SDK client, typed host adapters | backend SDK, backend UI packages, native globals for business API calls |
| App Flutter | generated Dart/Flutter app SDK, platform adapter interfaces | backend SDK, React packages, raw `http` calls for app business |
| Backend/admin React | injected backend SDK client or backend-core wrapper | app SDK for operator resources, app UI packages, raw HTTP |

Rules:

- UI components call hooks/services. Services call injected SDK clients.
- Missing SDK methods `MUST` be fixed in the owning app-api or backend-api OpenAPI contract and generator flow.
- Handwritten raw HTTP fallbacks, manual token headers, local DTO forks, and generated SDK output edits are forbidden for UI business flows.
- Runtime/bootstrap constructs concrete SDK clients. Reusable UI packages receive typed clients, services, or providers.

## 4. Visual And Interaction Boundary

Architecture standards own platform-specific interaction rules.

Rules:

- App PC React optimizes for keyboard, pointer, route persistence, dense desktop layout, and multitasking.
- App mobile React optimizes for touch, safe areas, compact widths, native host adapters, and app lifecycle transitions.
- App Flutter optimizes for platform widgets, responsive mobile/tablet/foldable/desktop surfaces, and platform adapter interfaces.
- Backend/admin React optimizes for dense, flat, operational workflows with tables, filters, drawers, dialogs, tabs, and repeated administrative actions.
- Shared visual tokens may be common, but package-local global themes, reset CSS, and shell layout overrides are forbidden in domain packages.

## 5. Required Verification

Every touched UI package `MUST` prove the selected architecture boundary.

| Verification | Required evidence |
| --- | --- |
| Package family | Static scan or component spec proves the package path matches the selected architecture. |
| SDK surface | Service tests use fake or generated SDK clients matching the selected app/backend surface. |
| No bypass | Static scan proves no raw HTTP, manual token headers, backend/app cross-surface calls, or generated SDK edits were introduced. |
| Domain split | Backend/admin business code is not placed in `@sdkwork/react-backend-ui`, `@sdkwork/react-backend-core`, or any catch-all package. |
| UI states | Tests cover loading, empty, validation-error, permission-denied, unavailable, and unknown-error states where applicable. |
| i18n | User-facing or operator-facing copy lives in the package i18n boundary or configured message catalog. |

## 6. Acceptance Checklist

- [ ] Exactly one primary UI architecture was selected.
- [ ] The package path matches the selected architecture table.
- [ ] The detailed architecture standard was applied.
- [ ] Domain ownership follows `DOMAIN_SPEC.md`.
- [ ] App UI uses app-api/app SDK only for user-facing workflows.
- [ ] Backend/admin UI uses backend-api/backend SDK only for operator workflows.
- [ ] Backend/admin business UI is split by `@sdkwork/react-backend-<domain>`.
- [ ] No catch-all business package was introduced.
- [ ] No raw HTTP, manual auth header, DTO fork, or generated SDK edit was introduced.
- [ ] Tests or scans prove package placement, SDK boundary, and representative UI states.
