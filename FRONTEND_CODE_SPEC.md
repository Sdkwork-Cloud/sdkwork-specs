# Frontend Code Standard

- Version: 1.0
- Scope: React, PC browser UI, PC desktop renderer UI, mobile React, Flutter UI, backend/admin UI, frontend services, state, i18n, and UI tests
- Related: `CODE_STYLE_SPEC.md`, `NAMING_SPEC.md`, `FRONTEND_SPEC.md`, `UI_ARCHITECTURE_SPEC.md`, `APP_PC_ARCHITECTURE_SPEC.md`, `APP_PC_REACT_UI_SPEC.md`, `APP_MOBILE_REACT_UI_SPEC.md`, `APP_FLUTTER_UI_SPEC.md`, `BACKEND_UI_SPEC.md`, `I18N_SPEC.md`, `TEST_SPEC.md`

This standard applies only when frontend, renderer, UI, React, Flutter, or backend/admin UI code is touched.

## 1. Architecture Selection

Rules:

- Read `UI_ARCHITECTURE_SPEC.md` before creating or moving UI packages.
- PC app, PC console, and PC admin packages also follow `APP_PC_ARCHITECTURE_SPEC.md`.
- Then load exactly one detailed UI spec for the touched surface: `APP_PC_REACT_UI_SPEC.md`, `APP_MOBILE_REACT_UI_SPEC.md`, `APP_FLUTTER_UI_SPEC.md`, or `BACKEND_UI_SPEC.md`.
- Do not import UI components, routes, host adapters, or runtime wrappers across architecture families.

## 2. UI-Service-SDK Flow

Required flow:

```text
UI component
  -> hook or page service
  -> domain service
  -> injected generated SDK client or approved composed wrapper
```

Rules:

- UI components must not construct SDK clients.
- UI components must not manually assemble raw HTTP requests or auth headers.
- User-facing UI uses app SDK surfaces.
- Backend/admin UI uses backend SDK surfaces.
- Frontend services normalize loading, empty, permission-denied, validation, and problem-detail error states.

## 3. Component Organization

Recommended package shape:

```text
src/
  index.ts
  components/
  pages/
  hooks/
  services/
  state/
  i18n/
  routes/
  tests/
```

Rules:

- Components focus on rendering and local interaction.
- Pages compose components, hooks, and services.
- Services own SDK calls and business orchestration.
- Route/menu metadata stays in the owning package family.
- User-facing text uses i18n/message catalogs when the package is reusable or user-facing.

## 4. UX And Accessibility

Rules:

- Backend/admin UI should optimize for dense operational workflows: tables, filters, drawers, dialogs, tabs, and repeated actions.
- App UI should match the selected product architecture and not import backend/admin UI packages.
- Buttons, inputs, tabs, menus, toggles, sliders, and dialogs should use the design system or established local primitives.
- Loading, empty, error, permission-denied, and validation states must be explicit.
- Interactive elements need accessible names and keyboard behavior where applicable.

## 5. State And Data

Rules:

- Keep server state behind services, generated SDK clients, or established query/cache libraries.
- Do not persist presigned URLs, object keys, `File` objects, raw provider URLs, or upload part lists as business identity.
- Drive-backed media and upload behavior follow `DRIVE_SPEC.md` and `MEDIA_RESOURCE_SPEC.md`.
- Tokens and credentials must not enter browser public runtime env, i18n catalogs, screenshots, logs, or frontend bundles.

## 6. Verification

Rules:

- Service tests use fake generated SDK clients or generated SDK clients.
- UI tests cover key loading, empty, error, permission-denied, and success states.
- Architecture scans must prove the package family uses the correct SDK surface and does not import forbidden UI/runtime packages.
- Visual or browser verification is required for substantial UI changes when a runnable app exists.

## 7. Acceptance Checklist

- [ ] Correct UI architecture spec was loaded.
- [ ] UI -> service -> SDK flow is preserved.
- [ ] Components do not construct SDK clients or raw HTTP requests.
- [ ] Text, errors, and permissions are surfaced intentionally.
- [ ] Package family naming and SDK surface checks pass.

