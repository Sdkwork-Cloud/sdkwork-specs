# Desktop App Architecture Standard

- Version: 1.0
- Scope: PC and desktop applications, especially Tauri-hosted web apps, desktop shells, native host adapters, local runtime integration, packaging, and release boundaries
- Related: `APPLICATION_SPEC.md`, `UI_ARCHITECTURE_SPEC.md`, `APP_PC_REACT_UI_SPEC.md`, `FRONTEND_SPEC.md`, `SDK_SPEC.md`, `IAM_LOGIN_INTEGRATION_SPEC.md`, `CONFIG_SPEC.md`, `ENVIRONMENT_SPEC.md`, `RUNTIME_DIRECTORY_SPEC.md`, `DEPLOYMENT_SPEC.md`, `SECURITY_SPEC.md`, `TEST_SPEC.md`

This standard defines the architecture boundary for SDKWork desktop applications. It is intentionally product-neutral. It applies to Tauri, Electron-like shells, browser-installed desktop shells, and native wrappers that host a web UI, but the normative Tauri profile is defined here because Tauri is the preferred SDKWork desktop host.

Desktop apps are app composition layers. They should be thin, predictable, and reusable across products. Product-specific UI and business behavior belong in app PC UI packages and service packages. Native host code belongs behind explicit host adapters and commands.

## 1. Reference Architecture

Standard desktop architecture:

```text
desktop app shell
  -> route/layout/providers/bootstrap
  -> UI packages
  -> service/facade layer
  -> generated SDK clients or approved wrappers
  -> app/backend/local APIs
  -> optional native host adapters
```

Rules:

- Desktop apps `MUST` separate web UI, service orchestration, SDK transport, native host capabilities, and local runtime concerns.
- The app shell `MUST` stay thin: route composition, layout, providers, SDK bootstrap, session bootstrap, environment selection, and host adapter registration.
- Product features `MUST` live in domain or capability packages, not in native host commands.
- Remote business traffic `MUST` use generated SDK clients or approved wrappers.
- Native host commands `MUST` expose local device or operating-system capability only. They must not become app business services.

## 2. Layer Responsibilities

| Layer | Owns | Must not own |
| --- | --- | --- |
| Desktop app shell | routing, layout, providers, SDK bootstrap, session bootstrap, environment mode, host adapter binding | reusable feature workflows, generated SDK internals, database access |
| UI packages | pages, components, hooks, view state, route-level interaction | raw HTTP, manual auth headers, Tauri command strings scattered across feature code |
| Service/facade packages | SDK orchestration, validation mapping, domain-friendly methods, cache invalidation | UI rendering, native window/file/process control, hidden global transport |
| Generated SDK clients | typed transport, auth token plumbing, request/response models | product UI behavior, native host behavior |
| Native host adapter | typed wrappers for window, tray, filesystem, process, notifications, deep links, clipboard, updater | remote business authorization, app-domain workflows, direct database access |
| Local runtime | embedded or local HTTP/RPC service, local-only API bridge, runtime files, user-private state | UI composition, package-local feature shortcuts |

Rules:

- UI calls services or hooks. Services call SDK clients.
- UI may call host adapters for local-only UX capability, but feature components `SHOULD NOT` import raw Tauri APIs directly.
- Host adapters `MUST` be small and typed. They may translate between UI-friendly methods and native commands.
- Local runtime APIs `MUST` follow the same contract and SDK boundary rules as remote APIs when they expose business behavior.

## 3. Desktop Data And Server Runtime Boundary

Desktop applications have two different persistence concerns:

| Concern | Standard database | Owner |
| --- | --- | --- |
| Desktop local user data | SQLite | Desktop runtime, installed desktop package, host-local user config |
| Service/backend runtime started by desktop development commands | PostgreSQL | Server/runtime service profile |

Rules:

- Installed desktop applications `MUST` store desktop-local user data in SQLite
  under the SDKWork user private data directory unless the user explicitly
  configures an external database.
- Desktop/Tauri development commands that start the product service runtime,
  such as `pnpm desktop:dev` or `pnpm tauri:dev`, `MUST` use the server
  PostgreSQL development profile for the service/backend process.
- The desktop shell must not infer that the service database is SQLite just
  because the deployment mode is `desktop`. The deployment mode describes shell
  behavior; the launched service profile describes backend persistence.
- SQLite development entrypoints are allowed only as explicit local-data or
  regression profiles, such as `pnpm tauri:dev:sqlite`; they must not replace
  the default service/runtime PostgreSQL profile.
- Feature UI and host adapters `MUST NOT` access either SQLite or PostgreSQL
  directly. They call services, SDKs, or local runtime APIs.

## 4. Standard Package Shape

Recommended shape:

```text
apps/<product>-pc/
  package.json
  vite.config.ts
  src/
    App.tsx
    AuthGate.tsx
    bootstrap/
  packages/
    <product>-pc-core/
      src/sdk/
      src/session/
      src/host/
    <product>-pc-commons/
    <product>-pc-<domain>/
    <product>-pc-desktop/
      package.json
      src-tauri/
        tauri.conf.json
        src/
        permissions/
        capabilities/
```

Rules:

- The root PC app package owns web bootstrap and web build scripts.
- Repositories that include a desktop app `MUST` expose top-level launch commands: `pnpm dev` starts the default PC renderer, and `pnpm tauri:dev` starts the default Tauri desktop shell.
- The PC renderer dev command `MUST` use the same host and port as the Tauri `devUrl`, and it `MUST` fail on port conflicts instead of silently falling back to another port.
- Existing backend or product server development commands `MUST` remain available under explicit names such as `pnpm dev:server`, `pnpm dev:postgres`, or `pnpm dev:sqlite` when `pnpm dev` is assigned to the desktop renderer.
- The desktop package owns Tauri CLI, Tauri config, Rust shell code, icons, permissions, and native bundle scripts.
- The root PC app `MUST NOT` own Tauri native dependencies unless the app is intentionally single-package and documents that exception.
- Shared UI and services live in `packages/*` or approved appbase packages.
- Generated SDK output lives in SDK workspaces and `MUST NOT` be edited by the desktop app.
- Package names should express product, surface, and capability. Avoid catch-all names for business features.

## 5. Tauri Host Profile

Tauri is the preferred SDKWork desktop shell profile.

Required Tauri properties:

| Area | Standard |
| --- | --- |
| Package boundary | Tauri shell lives in a desktop package such as `<product>-pc-desktop`. |
| Web dev server | `devUrl` points to the root PC app dev server. |
| Web build output | `frontendDist` points to the root PC app build output. |
| Window model | Window labels, size, minimum size, title, and decoration policy are explicit. |
| Commands | Commands are narrow host capabilities with typed request/response payloads. |
| Permissions | Capabilities and permissions are least-privilege and listed in source control. |
| Bundle metadata | product name, identifier, version, icons, and targets are explicit and release-controlled. |

Rules:

- Tauri commands `MUST` be named by host capability, not business use case.
- Window control, tray, updater, deep link, file dialog, filesystem, shell open, clipboard, notification, and process integration belong behind host adapters.
- Tauri command handlers `MUST` validate inputs and return safe errors. They must not leak secrets, tokens, local file contents, or raw system errors.
- Tauri permissions `MUST` be minimized. A feature requiring broader permission needs a documented reason and test coverage.
- The renderer `SHOULD` call a typed host adapter rather than `window.__TAURI__` directly.
- Web-only mode must degrade gracefully when Tauri APIs are unavailable.

## 6. SDK, Session, And Auth

Rules:

- Desktop apps `MUST` use the same generated SDK boundary as web apps.
- Desktop IAM login/session integration `MUST` follow `IAM_LOGIN_INTEGRATION_SPEC.md`; Tauri may support host storage, OAuth/deep-link bridging, and local runtime lifecycle, but must not own business authentication.
- SDK clients are constructed in bootstrap/core code and injected into service facades.
- UI components `MUST NOT` create SDK clients, manually attach auth headers, parse JWTs for authorization, or call raw HTTP for business behavior.
- Session storage belongs in a core session module. Feature packages read session through exported helpers or injected services.
- Logout `MUST` clear persisted session state, reset generated SDK clients, reset realtime clients where applicable, close sensitive local state, and navigate to the login entry.
- Authenticated route guards `MUST` re-check persisted session state after logout, token refresh failure, tenant switch, or account switch.
- Tokens, QR keys, OAuth codes, refresh tokens, verification codes, and password reset tokens `MUST NOT` be logged or shown in UI.

## 7. Config And Runtime Modes

Desktop apps normally support more than one runtime mode.

| Mode | Meaning |
| --- | --- |
| `desktop` | Installed desktop app with native shell and user-private runtime files. |
| `local` | Local development or local-only runtime, often using localhost services. |
| `private` | Private deployment using configured server endpoints. |
| `saas` | Public hosted deployment using public server endpoints. |
| `web` | Browser-hosted build without native host APIs. |

Rules:

- Environment variables and runtime config follow `ENVIRONMENT_SPEC.md` and `CONFIG_SPEC.md`.
- Runtime directories, logs, cache, user-private files, and local database paths follow `RUNTIME_DIRECTORY_SPEC.md`.
- Desktop-local data uses SQLite by default, while the backend service launched
  by desktop development commands uses the PostgreSQL dev profile unless an
  explicit SQLite command is selected.
- Release builds `MUST NOT` hard-code localhost API or websocket endpoints.
- Development defaults may use localhost only in development-prunable branches or explicit local profiles.
- Local runtime bridges `MUST` expose stable API contracts and must be replaceable by remote services without UI rewrites.
- Feature packages `MUST NOT` read deployment mode directly unless they own a true platform-specific concern.

## 8. Native Capability Boundary

Native capability is local capability. Business authorization remains on the API side.

Allowed native host concerns:

- window controls, tray menu, deep links, notifications;
- file picker, clipboard, shell open, safe local file access;
- updater and release channel integration;
- device identity and local-only diagnostics;
- local runtime process lifecycle when explicitly owned by the desktop shell.

Forbidden native host concerns:

- app-api or backend-api business authorization decisions;
- direct database access for feature workflows;
- secret token generation outside the auth/session standard;
- generated SDK bypasses;
- login, token refresh, permission evaluation, or business authorization;
- long-running domain workflows that should be services.

Rules:

- Host adapters `MUST` expose typed methods such as `windowControl(action)` or `openExternal(url)`, not raw command names throughout UI code.
- Native host errors should map to user-safe messages and diagnostic codes.
- Native code should emit structured logs without secrets.

## 9. Packaging And Release

Rules:

- Web build and desktop bundle are separate stages.
- The root app build produces renderer assets. The desktop package bundles those assets.
- Desktop package scripts `SHOULD` provide explicit local dev and local build commands.
- The repository top-level `package.json` `MUST` provide launch aliases for the default desktop app so contributors can start it from the repository root without knowing the app subdirectory.
- Tauri package metadata `MUST` include stable product name, identifier, version, icons, and bundle targets.
- Release artifacts `MUST` be reproducible from source, lockfile, Tauri config, runtime config templates, and SDK versions.
- Desktop installers must not include local secrets, developer caches, generated temporary files, or runtime state.
- Public release behavior must be verified with production-like config, not only dev server config.

## 10. Standard Verification

Required verification for desktop architecture changes:

| Verification | Evidence |
| --- | --- |
| Package boundary | Static scan proves Tauri code lives in the desktop package and feature UI lives in app/domain packages. |
| SDK boundary | Static scan proves no raw HTTP, manual token headers, or generated SDK edits were introduced for business flows. |
| Host boundary | Static scan proves feature packages use host adapters or shell-owned commands, not scattered raw Tauri globals. |
| Session behavior | Logout, refresh failure, and account switch clear session and prevent stale route guards. |
| Config behavior | Localhost defaults are dev/local only; release config uses runtime/env standards. |
| Database boundary | Desktop-local user data resolves to SQLite; desktop-started backend services resolve to PostgreSQL unless an explicit SQLite command is used. |
| Tauri config | `devUrl`, `frontendDist`, window config, permissions, capabilities, bundle metadata, and icons are present. |
| Type and build | Changed packages pass typecheck and relevant build or smoke commands. |

Suggested commands depend on the app, but every desktop app should define equivalents for:

```text
pnpm dev
pnpm tauri:dev
pnpm --dir apps/<product>-pc lint
pnpm --dir apps/<product>-pc build
pnpm --dir apps/<product>-pc exec <architecture-contract-tests>
pnpm --filter <product>-pc-desktop desktop:build:local
```

## 11. Acceptance Checklist

- [ ] Desktop architecture was considered separately from app PC UI architecture.
- [ ] Repository top-level `pnpm dev` and `pnpm tauri:dev` can start the default PC renderer and Tauri desktop shell.
- [ ] App shell is thin and does not own reusable business workflows.
- [ ] UI-service-SDK layering follows `FRONTEND_SPEC.md` and `APP_PC_REACT_UI_SPEC.md`.
- [ ] Remote business calls use generated SDK clients or approved wrappers.
- [ ] Native host commands are narrow, typed, least-privilege, and local-only.
- [ ] Desktop-local user data uses SQLite, while desktop-started backend services use the PostgreSQL dev profile by default.
- [ ] Tauri config, permissions, capabilities, icons, and bundle metadata are explicit.
- [ ] Session/logout/token handling is centralized and tested.
- [ ] Runtime config and directories follow `ENVIRONMENT_SPEC.md` and `RUNTIME_DIRECTORY_SPEC.md`.
- [ ] Release builds do not hard-code localhost or developer-only paths.
- [ ] Verification covers package boundary, SDK boundary, host boundary, config, and session behavior.
