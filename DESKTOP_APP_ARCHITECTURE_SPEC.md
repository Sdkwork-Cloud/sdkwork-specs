# Desktop App Architecture Standard

- Version: 1.0
- Scope: PC desktop and large-screen tablet native applications, especially Tauri-hosted web apps, desktop shells, iPadOS/Android tablet targets, native host adapters, local runtime integration, packaging, and release boundaries
- Related: `APPLICATION_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, `APP_PC_ARCHITECTURE_SPEC.md`, `UI_ARCHITECTURE_SPEC.md`, `APP_PC_REACT_UI_SPEC.md`, `FRONTEND_SPEC.md`, `SDK_SPEC.md`, `IAM_LOGIN_INTEGRATION_SPEC.md`, `CONFIG_SPEC.md`, `ENVIRONMENT_SPEC.md`, `RUNTIME_DIRECTORY_SPEC.md`, `DEPLOYMENT_SPEC.md`, `SECURITY_SPEC.md`, `TEST_SPEC.md`

This standard defines the architecture boundary for SDKWork desktop and large-screen tablet native applications. It is intentionally product-neutral. It applies to Tauri, Electron-like shells, browser-installed desktop shells, tablet-native Tauri targets, and native wrappers that host a web UI, but the normative Tauri profile is defined here because Tauri is the preferred SDKWork native host.

Desktop apps are app composition layers. They should be thin, predictable, and reusable across products. Product-specific UI and business behavior belong in app PC UI packages and service packages. Native host code belongs behind explicit host adapters and commands.

Desktop SDK composition, appbase IAM runtime wiring, dependency SDK usage, and global TokenManager behavior follow `APP_SDK_INTEGRATION_SPEC.md`.

For SDKWork PC applications, `APP_PC_ARCHITECTURE_SPEC.md` is the parent application-root standard. This file is the desktop/tablet native host detail standard for the `sdkwork-<application-code>-pc-desktop` package and related Tauri packaging behavior, including Windows, macOS, Linux, iPadOS, and Android tablet targets.

## 1. Reference Architecture

Standard desktop architecture:

```text
desktop/tablet native app shell
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
- Application features `MUST` live in domain or capability packages, not in native host commands.
- Remote business traffic `MUST` use generated SDK clients or approved wrappers.
- Native host commands `MUST` expose local device or operating-system capability only. They must not become app business services.

## 2. Layer Responsibilities

| Layer | Owns | Must not own |
| --- | --- | --- |
| Desktop/tablet app shell | routing, layout, providers, SDK bootstrap, session bootstrap, environment mode, host adapter binding | reusable feature workflows, generated SDK internals, database access |
| UI packages | pages, components, hooks, view state, route-level interaction | raw HTTP, manual auth headers, Tauri command strings scattered across feature code |
| Service/facade packages | SDK orchestration, validation mapping, domain-friendly methods, cache invalidation | UI rendering, native window/file/process control, hidden global transport |
| Generated SDK clients | typed transport, auth token plumbing, request/response models | product UI behavior, native host behavior |
| Native host adapter | typed wrappers for window, tray, filesystem, process, notifications, deep links, clipboard, updater | remote business authorization, app-domain workflows, direct database access |
| Local runtime | embedded or local HTTP/RPC service, local-only API bridge, runtime files, user-private state | UI composition, package-local feature shortcuts |
| Tablet platform target | iPadOS/Android packaging config, safe-area/platform lifecycle adapters, signing metadata, large-screen behavior | phone-first H5 behavior, separate auth model, business SDK bypasses |

Rules:

- UI calls services or hooks. Services call SDK clients.
- UI may call host adapters for local-only UX capability, but feature components `SHOULD NOT` import raw Tauri APIs directly.
- Host adapters `MUST` be small and typed. They may translate between UI-friendly methods and native commands.
- Local runtime APIs `MUST` follow the same contract and SDK boundary rules as remote APIs when they expose business behavior.

## 3. Desktop, Tablet, And Server Runtime Boundary

Desktop applications have two different persistence concerns:

| Concern | Standard database | Owner |
| --- | --- | --- |
| Desktop local user data | SQLite | Native runtime, installed package, host-local user config |
| Tablet local user data | SQLite or approved platform-local encrypted storage | Native runtime, installed package, platform app-private storage |
| Explicit service/backend runtime started by desktop development commands | PostgreSQL | Server/runtime service profile |

Rules:

- Installed desktop applications `MUST` store desktop-local user data in SQLite
  under the SDKWork user private data directory unless the user explicitly
  configures an external database.
- Installed tablet native applications `MUST` store tablet-local user data in
  SQLite or an approved encrypted platform-local storage adapter under the
  platform app-private directory. They `MUST NOT` write user state into generated
  native project directories.
- Desktop/Tauri development commands that start the product service runtime
  `MUST` use the server PostgreSQL development profile for the service/backend
  process. Applications whose default desktop development commands are
  gateway-backed client commands, such as SDKWork Claw Router `pnpm dev:desktop`,
  must keep product server startup on explicit server commands.
- The desktop shell must not infer that the service database is SQLite just
  because the runtime target is `desktop`. The deployment profile remains
  `standalone` or `cloud`; the launched service profile describes backend
  persistence.
- SQLite development entrypoints are allowed only as explicit local-data or
  regression profiles, such as `pnpm dev:server:sqlite` or a documented
  desktop-local validation command; they must not replace the default explicit
  service/runtime PostgreSQL profile.
- Feature UI and host adapters `MUST NOT` access either SQLite or PostgreSQL
  directly. They call services, SDKs, or local runtime APIs.

## 4. Standard Package Shape

Recommended shape:

```text
apps/sdkwork-<application-code>-pc/
  package.json
  vite.config.ts
  config/
    browser/
    desktop/
    server/
    container/
    tauri/
  src/
    App.tsx
    AuthGate.tsx
    bootstrap/
  packages/
    sdkwork-<application-code>-pc-core/
      src/sdk/
      src/session/
      src/host/
    sdkwork-<application-code>-pc-commons/
    sdkwork-<application-code>-pc-<capability>/
    sdkwork-<application-code>-pc-console-<capability>/
    sdkwork-<application-code>-pc-admin-<capability>/
    sdkwork-<application-code>-pc-desktop/
      package.json
      src-tauri/
        tauri.conf.json
        tauri.windows.conf.json
        tauri.macos.conf.json
        tauri.linux.conf.json
        tauri.ios.conf.json
        tauri.android.conf.json
        src/
        permissions/
        capabilities/
        gen/
          apple/
          android/
```

Rules:

- The root PC app package owns web bootstrap and web build scripts.
- Repositories that include a desktop app `MUST` expose top-level launch commands that follow `PNPM_SCRIPT_SPEC.md`: `pnpm dev` starts the default PC renderer or documented default development workflow, and `pnpm dev:desktop` starts the default desktop shell. Tauri CLI commands remain implementation details behind action-first public scripts.
- The PC renderer dev command `MUST` use the same host and port as the Tauri `devUrl`, and it `MUST` fail on port conflicts instead of silently falling back to another port.
- Existing backend or application server development commands `MUST` remain available under explicit names such as `pnpm dev:server`, `pnpm dev:postgres`, or `pnpm dev:sqlite` when `pnpm dev` is assigned to the desktop renderer.
- The desktop package owns Tauri CLI, Tauri config, Rust shell code, icons, permissions, and native bundle scripts.
- The desktop package also owns iPadOS and Android tablet Tauri target metadata, generated native project directories, signing/runbook references, and target-specific capabilities.
- The root PC app `MUST NOT` own Tauri native dependencies unless the app is intentionally single-package and documents that exception.
- Shared UI and services live in `packages/*` or approved appbase packages.
- Generated SDK output lives in SDK workspaces and `MUST NOT` be edited by the desktop app.
- Package names should express product, `pc` surface, and capability according to `APP_PC_ARCHITECTURE_SPEC.md`. Avoid catch-all names for business features.

## 5. Tauri Host Profile

Tauri is the preferred SDKWork desktop shell profile.

Required Tauri properties:

| Area | Standard |
| --- | --- |
| Package boundary | Tauri shell and tablet-native target config live in a native host package named `sdkwork-<application-code>-pc-desktop`. |
| Web dev server | `devUrl` points to the root PC app dev server. |
| Web build output | `frontendDist` points to the root PC app build output. |
| Window model | Window labels, size, minimum size, title, and decoration policy are explicit. |
| Commands | Commands are narrow host capabilities with typed request/response payloads. |
| Permissions | Capabilities and permissions are least-privilege and listed in source control. |
| Bundle metadata | product name, identifier, version, icons, and targets are explicit and release-controlled. |
| Tablet metadata | iPadOS bundle id/signing profile and Android package/signing metadata are explicit and release-controlled when those targets are enabled. |

Rules:

- Tauri commands `MUST` be named by host capability, not business use case.
- Window control, tray, updater, deep link, file dialog, filesystem, shell open, clipboard, notification, and process integration belong behind host adapters.
- Tauri command handlers `MUST` validate inputs and return safe errors. They must not leak secrets, tokens, local file contents, or raw system errors.
- Tauri permissions `MUST` be minimized. A feature requiring broader permission needs a documented reason and test coverage.
- The renderer `SHOULD` call a typed host adapter rather than `window.__TAURI__` directly.
- Web-only mode must degrade gracefully when Tauri APIs are unavailable.
- Tablet mode must degrade gracefully when a desktop-only host capability is unavailable and must expose only target-supported capability adapters.

## 5.1 Tauri Tablet Target Profile

Tauri tablet targets are allowed for PC applications because they preserve the same large-screen renderer and workflow model.

Rules:

- iPadOS and Android tablet targets `MUST` reuse the PC renderer, package taxonomy, SDK clients, appbase IAM runtime, and global TokenManager defined by `APP_PC_ARCHITECTURE_SPEC.md`.
- iPadOS target configuration `MUST` document bundle id, Apple team, provisioning profile, signing certificate, entitlements, minimum OS version, icons, launch assets, and distribution path.
- Android tablet target configuration `MUST` document package name, min/target SDK, signing key handling, ABI targets, icons, adaptive icon assets, APK/AAB outputs, and distribution path.
- Tablet target commands `SHOULD` be exposed as `pnpm dev:tablet-ipados`, `pnpm build:tablet-ipados`, `pnpm dev:tablet-android`, and `pnpm build:tablet-android`.
- iOS/iPadOS builds require macOS with Apple tooling. Android tablet builds require Android tooling. CI pipelines `MUST` record which runner image satisfies each target.
- Tablet UI `MUST` handle safe areas, orientation, split view or multi-window where supported, pointer/keyboard input, touch/stylus input, virtual keyboard, and foreground/background lifecycle transitions.
- Tablet targets `MUST NOT` introduce phone-first navigation, mobile-only SDK wrappers, copied auth stores, or divergent route ownership inside the PC root.

## 6. SDK, Session, And Auth

Rules:

- Desktop apps `MUST` use the same generated SDK boundary as web apps.
- Desktop IAM login/session integration `MUST` follow `IAM_LOGIN_INTEGRATION_SPEC.md`; Tauri may support host storage, OAuth/deep-link bridging, and local runtime lifecycle, but must not own business authentication.
- Desktop runtime/bootstrap `MUST` follow `APP_SDK_INTEGRATION_SPEC.md`: construct appbase app SDK clients, application/dependency app SDK clients, explicit `backend-admin` backend SDK clients only when the desktop runtime owns a `backend-admin` surface, one global token manager, token/context stores, open-api credential providers, and host adapters in one composition boundary.
- Renderer appbase IAM runtime `MUST` own login, registration, current session, refresh, logout, verification, OAuth, QR auth, password reset, runtime metadata, current-user self-service, and token propagation to authenticated SDK clients.
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
| `tablet-ipados` | iPadOS native package using the PC renderer and Tauri iOS target. |
| `tablet-android` | Android tablet native package using the PC renderer and Tauri Android target. |
| `standalone` | Self-contained application deployment profile. |
| `cloud` | Cloud/service deployment profile using managed ingress and dependencies. |
| `browser` | Browser runtime target without native host APIs. |

Rules:

- Environment variables and runtime config follow `ENVIRONMENT_SPEC.md` and `CONFIG_SPEC.md`.
- Lifecycle environment, profile alias, deployment profile, build mode, and runtime target `MUST` be modeled separately. Tauri target, Vite mode, or Spring profile must not be used as the entire runtime decision.
- Runtime directories, logs, cache, user-private files, and local database paths follow `RUNTIME_DIRECTORY_SPEC.md`.
- Desktop-local data uses SQLite by default, tablet-local data uses SQLite or approved platform-local encrypted storage, while the backend service launched
  by desktop development commands uses the PostgreSQL dev profile unless an
  explicit SQLite command is selected.
- Installed desktop config uses `environment = "production"`,
  `deployment_profile = "standalone"`, and `runtime_target = "desktop"` by
  default unless the installer is explicitly producing a cloud-managed desktop
  profile.
- Desktop development config uses `environment = "development"` and `runtime_target = "desktop"` for the native shell, while any launched backend service uses a separate `runtime_target = "server"` config.
- Desktop and tablet test config uses `environment = "test"` and isolates SQLite files, logs, cache, temp files, local service ports, and backend test databases.
- Release builds `MUST NOT` hard-code localhost API or websocket endpoints.
- Development defaults may use localhost only in development-prunable branches or explicit local profiles.
- Local runtime bridges `MUST` expose stable API contracts and must be replaceable by remote services without UI rewrites.
- Feature packages `MUST NOT` read deployment profile or runtime target directly
  unless they own a true platform-specific concern.

Standard desktop/native config files:

```text
apps/sdkwork-<application-code>-pc/
  config/
    desktop/
      <application-code>.development.toml.example
      <application-code>.test.toml.example
      <application-code>.staging.toml.example
      <application-code>.production.toml.example
    server/
      <application-code>.development.toml.example
      <application-code>.test.toml.example
      <application-code>.staging.toml.example
      <application-code>.production.toml.example
    tauri/
      tauri.conf.json
      tauri.windows.conf.json
      tauri.macos.conf.json
      tauri.linux.conf.json
      tauri.ios.conf.json
      tauri.android.conf.json
  packages/sdkwork-<application-code>-pc-desktop/
    src-tauri/
      tauri.conf.json
      tauri.windows.conf.json
      tauri.macos.conf.json
      tauri.linux.conf.json
      tauri.ios.conf.json
      tauri.android.conf.json
```

Rules:

- `config/desktop/*.toml.example` describes installed desktop/tablet runtime defaults: local host mode, secure storage provider, local service lifecycle, user-private directories, and SQLite or encrypted local storage.
- `config/server/*.toml.example` describes backend/service defaults used by
  `pnpm dev:server`, desktop-started services, service releases, and
  customer-owned or cloud deployments.
- `config/tauri/*` or `src-tauri/tauri.*.conf.json` describes platform packaging metadata: bundle identifier, package name, window metadata, permissions, capabilities, icons, mobile/tablet target metadata, updater metadata, and signing references.
- Tauri config may contain signing key references, keychain names, environment variable names, or CI secret identifiers. It must not contain signing private keys, auth tokens, refresh tokens, database passwords, API keys, or private endpoints.
- Tauri platform-specific config files may override target-specific packaging values and permissions. They must not override app/console/admin route ownership, generated SDK packages, API path contracts, TokenManager wiring, or appbase IAM behavior.
- Desktop installer initialization may generate host-local runtime config under the SDKWork user-private config directory. Generated config is runtime state and must not be copied back into source control.

Recommended commands:

```text
pnpm dev:desktop
pnpm dev:desktop:server
pnpm dev:desktop:sqlite
pnpm test:desktop
pnpm check:tauri-config
pnpm build:desktop
pnpm build:desktop:staging
pnpm build:desktop:prod
pnpm build:tablet-ipados:prod
pnpm build:tablet-android:prod
```

Command rules:

- `dev:desktop` uses the default desktop development orchestration profile and
  must resolve to PostgreSQL, `unified-process`, and standalone by default. It
  may remain client-only when the application standard assigns default API
  serving to a shared gateway, but the selected dev topology/database profile
  is still `postgres:unified-process:standalone`.
- `dev:desktop:server` or an equivalent explicit server command makes the backend
  service profile explicit when contributors need to debug the desktop plus
  service integration path.
- `dev:desktop:sqlite`, `dev:server:sqlite`, or an equivalent documented command
  is the explicit local SQLite regression profile. It must not become the
  default server integration command.
- `check:tauri-config` validates platform config merge, profile normalization, desktop/server split, secret absence, local path resolution, and test isolation.
- `build:desktop:prod`, `build:tablet-ipados:prod`, and `build:tablet-android:prod` must run release preflight before packaging.

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

- Web build, desktop bundle, and tablet-native package are separate stages.
- The root app build produces renderer assets. The desktop package bundles those assets.
- Desktop package scripts `SHOULD` provide explicit local dev and local build commands.
- The repository top-level `package.json` `MUST` provide launch aliases for the default desktop app so contributors can start it from the repository root without knowing the app subdirectory.
- Tauri package metadata `MUST` include stable product name, identifier, version, icons, and bundle targets.
- Tablet package metadata `MUST` include stable bundle/package identifiers, version, icons, signing configuration references, and target outputs.
- Release artifacts `MUST` be reproducible from source, lockfile, Tauri config, runtime config templates, and SDK versions.
- Desktop installers, IPA artifacts, APK/AAB artifacts, and generated native projects must not include local secrets, developer caches, generated temporary files, or runtime state.
- Public release behavior must be verified with production-like config, not only dev server config.

## 10. Standard Verification

Required verification for desktop architecture changes:

| Verification | Evidence |
| --- | --- |
| Package boundary | Static scan proves Tauri code lives in the desktop package and feature UI lives in app/domain packages. |
| SDK boundary | Static scan proves no raw HTTP, manual token headers, or generated SDK edits were introduced for business flows. |
| Host boundary | Static scan proves feature packages use host adapters or shell-owned commands, not scattered raw Tauri globals. |
| Session behavior | Logout, refresh failure, and account switch clear session and prevent stale route guards. |
| Config behavior | Localhost defaults are dev/local only; dev/test/staging/prod profiles normalize correctly; browser public runtime, desktop user runtime, server runtime, container runtime, and Tauri platform config remain separate. |
| Database boundary | Desktop-local user data resolves to SQLite; desktop-started backend services resolve to PostgreSQL unless an explicit SQLite command is used. |
| Tauri config | `devUrl`, `frontendDist`, window config, permissions, capabilities, bundle metadata, and icons are present. |
| Tablet config | iPadOS/Android config, signing references, large-screen behavior, safe-area handling, permissions/capabilities, and output artifact commands are present when enabled. |
| Type and build | Changed packages pass typecheck and relevant build or smoke commands. |

Suggested commands depend on the app, but every desktop app should define equivalents for:

```text
pnpm dev
pnpm dev:desktop
pnpm dev:tablet-ipados
pnpm dev:tablet-android
pnpm --dir apps/sdkwork-<application-code>-pc lint
pnpm --dir apps/sdkwork-<application-code>-pc build
pnpm --dir apps/sdkwork-<application-code>-pc test:config
pnpm --dir apps/sdkwork-<application-code>-pc exec <architecture-contract-tests>
pnpm --filter @sdkwork/<application-code>-pc-desktop build:desktop:local
pnpm --filter @sdkwork/<application-code>-pc-desktop check:tauri-config
pnpm --filter @sdkwork/<application-code>-pc-desktop build:tablet-ipados
pnpm --filter @sdkwork/<application-code>-pc-desktop build:tablet-android
```

## 11. Acceptance Checklist

- [ ] Desktop/tablet native architecture was considered separately from app PC UI architecture.
- [ ] Repository top-level `pnpm dev` and `pnpm dev:desktop` can start the default PC renderer/default development workflow and desktop shell.
- [ ] App shell is thin and does not own reusable business workflows.
- [ ] UI-service-SDK layering follows `FRONTEND_SPEC.md` and `APP_PC_REACT_UI_SPEC.md`.
- [ ] Remote business calls use generated SDK clients or approved wrappers.
- [ ] Native host commands are narrow, typed, least-privilege, and local-only.
- [ ] Desktop-local user data uses SQLite, tablet-local user data uses SQLite or approved encrypted platform storage, while desktop/tablet-started backend services use the PostgreSQL dev profile by default.
- [ ] Desktop user runtime config, desktop-started server config, browser public runtime config, container runtime config, and Tauri platform config are separated for development, test, staging, and production.
- [ ] Tauri platform config contains only packaging metadata, permissions, capabilities, and signing references; secrets and business API contracts are excluded.
- [ ] Tauri config, permissions, capabilities, icons, and bundle metadata are explicit.
- [ ] iPadOS and Android tablet package metadata, signing references, safe-area/lifecycle behavior, and build commands are explicit when tablet targets are enabled.
- [ ] Session/logout/token handling is centralized and tested.
- [ ] Runtime config and directories follow `ENVIRONMENT_SPEC.md` and `RUNTIME_DIRECTORY_SPEC.md`.
- [ ] Release builds do not hard-code localhost or developer-only paths.
- [ ] Verification covers package boundary, SDK boundary, host boundary, config, and session behavior.
