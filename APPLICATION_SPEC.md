# Application Module Standard

- Version: 1.0
- Scope: all SDKWork SaaS, private, local, desktop, web, and mobile applications
- Related: `DOMAIN_SPEC.md`, `MODULE_SPEC.md`, `FRONTEND_SPEC.md`, `UI_ARCHITECTURE_SPEC.md`, `APP_PC_REACT_UI_SPEC.md`, `APP_MOBILE_REACT_UI_SPEC.md`, `APP_FLUTTER_UI_SPEC.md`, `BACKEND_UI_SPEC.md`, `CONFIG_SPEC.md`, `APP_MANIFEST_SPEC.md`, `API_SPEC.md`, `SDK_SPEC.md`, `IAM_SPEC.md`, `DEPLOYMENT_SPEC.md`, `TEST_SPEC.md`

This standard defines how applications are assembled from reusable modules. The goal is to make product apps thin composition layers and keep shared capabilities reusable across SaaS Java backends, Rust local/private backends, and different frontend architectures.

Use `MODULE_SPEC.md` for reusable package contracts, `FRONTEND_SPEC.md` for architecture-neutral UI-service-SDK rules, `CONFIG_SPEC.md` for environment and SDK client bootstrap, and `APP_MANIFEST_SPEC.md` for `sdkwork.app.config.json`.

Application UI work must also pass the `UI_ARCHITECTURE_SPEC.md` selection gate and select exactly one architecture-specific UI standard before files are created:

| UI architecture | Required standard | Package family |
| --- | --- | --- |
| App PC React | `APP_PC_REACT_UI_SPEC.md` | `packages/pc-react/<domain>/sdkwork-<capability>-pc-react` |
| App mobile React | `APP_MOBILE_REACT_UI_SPEC.md` | `packages/mobile-react/<domain>/sdkwork-<capability>-mobile-react` |
| App Flutter | `APP_FLUTTER_UI_SPEC.md` | `packages/mobile-flutter/<domain>/sdkwork_<capability>_flutter` |
| Backend/admin React | `BACKEND_UI_SPEC.md` | `apps/sdkwork-backend-react-web/packages/sdkwork-react-backend-<domain>` |

Rules:

- App/user-facing packages consume app-api through app SDKs or approved appbase wrappers.
- Backend/admin packages consume backend-api through backend SDKs or approved backend wrappers.
- UI packages from different architecture families must not import each other's pages, components, routes, host adapters, or runtime globals.
- Backend/admin UI must be split by business domain and permission prefix. It must not be placed into one catch-all backend package.
- Shared cross-architecture logic must be extracted into contract, service, i18n, token, or generated SDK packages that have no UI runtime dependency.

## 1. Architecture Principle

Applications are assembled from stable capability modules.

```text
app shell
  -> route/layout/bootstrap
  -> feature UI package
  -> service/facade package
  -> generated SDK client
  -> app-api/backend-api/local-api
```

Rules:

- App shells `MUST` stay thin: routing, layout, providers, bootstrap, native host binding, environment selection.
- Shared business behavior `MUST` live in reusable packages, not app-local pages.
- UI packages `MUST NOT` build raw HTTP requests or auth headers.
- Services `MUST` receive SDK clients by dependency injection.
- SDK clients may differ by app, package, or environment, but service method shape must stay stable.
- Reusable module contracts `MUST` follow `MODULE_SPEC.md`.
- Frontend implementation `MUST` follow `FRONTEND_SPEC.md`.
- Runtime config and SDK client construction `MUST` follow `CONFIG_SPEC.md`.

## 2. Module Taxonomy

| Layer | Responsibility | Example |
| --- | --- | --- |
| `foundation` | Shell, router, command palette, search, workspace primitives | `sdkwork-router-pc-react` |
| `host` | Tauri/browser/mobile/native host boundaries | `sdkwork-host-tauri-pc-react` |
| `iam` | Tenant, organization, user, auth, permissions, security settings | `sdkwork-iam-core-pc-react` |
| `system` | Settings, notifications, docs, dashboard, support | `sdkwork-settings-pc-react` |
| `communication` | IM, contacts, channels, social, notifications | `sdkwork-im-pc-react` |
| `intelligence` | AI models, agents, prompts, tools, workflows | `sdkwork-agent-pc-react` |
| `drive` | Drive spaces, nodes, upload/download, file picker, storage-backed resource selection | `sdkwork-drive-pc-react` |
| `content` | Documents, assets, media publishing, editor workflows built on Drive-backed files | `sdkwork-content-pc-react` |
| `commerce` | Billing, wallet, payment, subscription, entitlement | `sdkwork-billing-pc-react` |
| `device` | Install, distribution, device bridge, local runtime | `sdkwork-device-pc-react` |
| `ecosystem` | Plugin, marketplace, app store | `sdkwork-plugin-pc-react` |

Rules:

- API and database domain names `MUST` use canonical domain names such as `iam`, not vague names such as `identity`.
- Canonical domain ownership and naming `MUST` follow `DOMAIN_SPEC.md`.
- Existing package grouping names may remain during migration, but new standard contracts must use canonical domains.
- Each package `MUST` have one clear capability and one public root export.
- Cross-package imports `MUST` use package root exports, not package-internal `src` paths.
- Shared modules `SHOULD` be framework-specific only where UI/runtime requires it; pure contracts should be framework-neutral when practical.

## 3. Package Shape

Recommended frontend package structure:

```text
packages/<architecture>/<domain>/<package>/
  package.json
  README.md
  src/
    index.ts
    services/
    types/
    components/
    pages/
    hooks/
  tests/
```

Rules:

- `src/index.ts` `MUST` be the public API.
- Business services `SHOULD` be in `src/services`.
- DTOs should come from generated SDKs or shared contract packages, not local copies.
- Package README `MUST` document capability, dependencies, integration inputs, and verification command.
- Host/native code `MUST` stay in host packages or native subdirectories.

## 4. Composition Inputs

Reusable modules `MUST` accept explicit inputs.

```ts
export interface AppModuleRuntime<TAppClient, TBackendClient> {
  appClient: TAppClient;
  backendClient?: TBackendClient;
  environment: "development" | "test" | "staging" | "production";
  deploymentMode: "saas" | "private" | "local";
}
```

Rules:

- No shared module may hard-code a SaaS base URL, local port, tenant ID, token, or generated SDK package.
- Environment differences belong in bootstrap/config.
- Runtime inputs `SHOULD` be serializable where they cross host/native boundaries.
- Feature flags `SHOULD` be capability-scoped.

## 5. Frontend Boundaries

| Boundary | Allowed | Forbidden |
| --- | --- | --- |
| UI | render, form state, accessibility, local view state | direct SDK transport, token parsing |
| Service | SDK calls, validation mapping, cache invalidation, orchestration | raw HTTP, hidden global client |
| SDK | typed API transport | product UI decisions |
| Host | native filesystem/process/window/device access | business authorization |

Rules:

- UI modules may call services, not raw SDK clients, when reusable business behavior exists.
- Services may expose domain-friendly methods but should preserve generated SDK semantics.
- Host adapters must not become business service layers.

## 6. Acceptance Checklist

- [ ] Module has one domain and one capability.
- [ ] Domain name is registered or accepted by `DOMAIN_SPEC.md`.
- [ ] Public exports are stable and documented.
- [ ] Reusable module contract follows `MODULE_SPEC.md`.
- [ ] The correct architecture-specific UI standard is selected when the module has UI.
- [ ] UI-service-SDK layering is respected.
- [ ] SDK clients are injected at initialization.
- [ ] Runtime config and SDK construction follow `CONFIG_SPEC.md`.
- [ ] No raw HTTP or manual auth headers in business UI modules.
- [ ] SaaS/private/local differences are isolated in bootstrap.
- [ ] Tests cover service contract and module integration.
