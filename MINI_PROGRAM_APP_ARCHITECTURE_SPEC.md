# Mini Program App Architecture Standard

- Version: 1.0
- Scope: SDKWork mini program application roots, SDKWork package taxonomy for mini programs, platform pages/subpackages projection, generated TypeScript app SDK integration, host adapters for mini program APIs, and cross-client route alignment
- Related: `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md`, `APPLICATION_SPEC.md`, `NAMING_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, `APP_MINI_PROGRAM_UI_SPEC.md`, `FRONTEND_SPEC.md`, `UI_ARCHITECTURE_SPEC.md`, `MODULE_SPEC.md`, `COMPONENT_SPEC.md`, `SDK_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md`, `IAM_LOGIN_INTEGRATION_SPEC.md`, `CONFIG_SPEC.md`, `ENVIRONMENT_SPEC.md`, `APP_MANIFEST_SPEC.md`, `SECURITY_SPEC.md`, `PRIVACY_SPEC.md`, `TEST_SPEC.md`

This standard defines the application-root architecture for SDKWork mini program clients, including WeChat Mini Program and future Alipay, DingTalk, Lark, Baidu, QQ, Kuaishou, JD, and other mini program profiles.

SDKWork source packages and mini program platform subpackages are different concepts. SDKWork packages are source, dependency, component, and composition boundaries. Platform `pages` and `subpackages` are runtime packaging and loading boundaries. Business architecture must be expressed through SDKWork packages first, then projected into platform pages/subpackages through route metadata and build tooling.

Use `APP_MINI_PROGRAM_UI_SPEC.md` for detailed mini program pages, components, services, state, i18n, route contribution, and package-local host adapter rules. This file owns the mini program application root, package taxonomy, page/subpackage projection, config, platform host boundary, commands, release, and architecture verification.

## 1. Core Model

```text
mini program root
  -> thin app bootstrap
  -> SDKWork packages under packages/
  -> generated TypeScript app SDKs adapted for mini program runtime
  -> appbase IAM runtime or approved mini program IAM adapter
  -> typed host adapters over wx/my/dd/tt/etc APIs
  -> route contributions projected to pages and subpackages
```

Rules:

- Mini program roots `MUST` use SDKWork packages for core, commons, shell, capability, optional console/admin, and host boundaries.
- Platform `pages` and `subpackages` `MUST NOT` become the primary business architecture boundary.
- Root `src/` `MUST` stay thin: app entry, bootstrap, route projection, shell assembly, SDK client construction, IAM runtime wiring, and host adapter registration.
- Business pages, components, services, state, i18n, and route contributions `MUST` live in packages.
- Platform APIs such as `wx.*`, `my.*`, `dd.*`, or equivalent must be wrapped by typed host adapters.
- Mini program packages `MUST` use generated TypeScript app SDK clients or approved appbase/mini-program wrappers. They must not call backend SDKs for user-facing workflows.

## 2. Standard Root Layout

```text
apps/<product>-mini-program/
  AGENTS.md
  sdkwork.app.config.json
  .sdkwork/
    README.md
    skills/
      README.md
    plugins/
      README.md
  config/
    mini-program/
      runtime-env.development.example.json
      runtime-env.test.example.json
      runtime-env.staging.example.json
      runtime-env.production.example.json
    host/
      mp-weixin.development.example.json
      mp-weixin.test.example.json
      mp-weixin.staging.example.json
      mp-weixin.production.example.json
    server/
      <product>.development.toml.example
      <product>.test.toml.example
      <product>.staging.toml.example
      <product>.production.toml.example
    container/
      <product>.development.toml.example
      <product>.test.toml.example
      <product>.staging.toml.example
      <product>.production.toml.example
  docs/
  scripts/
  sdks/
  specs/
  src/
    app.ts
    app.json
    app.wxss
    bootstrap/
      environment.ts
      runtime.ts
      sdkClients.ts
      iamRuntime.ts
      hostAdapters.ts
      routes.ts
    shell/
    routes/
    pages/
      __generated__/
    subpackages/
      __generated__/
  packages/
    sdkwork-<product>-mp-core/
    sdkwork-<product>-mp-commons/
    sdkwork-<product>-mp-shell/
    sdkwork-<product>-mp-<capability>/
    sdkwork-<product>-mp-console-core/
    sdkwork-<product>-mp-console-shell/
    sdkwork-<product>-mp-console-<capability>/
    sdkwork-<product>-mp-admin-core/
    sdkwork-<product>-mp-admin-shell/
    sdkwork-<product>-mp-admin-<capability>/
    sdkwork-<product>-mp-host/
  tests/
  package.json
  project.config.json
  project.private.config.json.example
```

Rules:

- The root name `apps/<product>-mini-program` is canonical for mini program roots.
- The package segment `mp` is canonical for cross-platform mini program SDKWork packages.
- Platform-specific behavior belongs in host/profile adapters, for example `mp-weixin` config and `sdkwork-<product>-mp-host/src/weixin/`.
- Business packages should not be named `mp-weixin-*` unless the capability is truly platform-exclusive and approved in a component spec.
- `src/pages/__generated__/` and `src/subpackages/__generated__/` are projection targets. Product business code should remain in packages.
- `project.private.config.json` is host-local and must not be committed. A safe `.example` may be committed.

## 3. Package Taxonomy

| Package family | Owns | Must not own |
| --- | --- | --- |
| `sdkwork-<product>-mp-core` | runtime config, SDK factories, appbase IAM adapter, token/session/context stores, route registry, host adapter contracts | pages, business workflows |
| `sdkwork-<product>-mp-commons` | domain-neutral mini program components, form/list/error primitives, design tokens, i18n helpers | business pages, SDK construction |
| `sdkwork-<product>-mp-shell` | app shell, tab/page route composition, AuthGate integration, route projection inputs | business services |
| `sdkwork-<product>-mp-<capability>` | pages, components, services, state, i18n, route contributions, view models | concrete SDK construction, unrelated capabilities |
| `sdkwork-<product>-mp-console-*` | user-facing mini program console workflows through app-api | internal operator workflows |
| `sdkwork-<product>-mp-admin-*` | approved internal operator workflows through backend-api | user app login/session creation |
| `sdkwork-<product>-mp-host` | platform API adapters, permissions, login bridge, secure storage bridge, file/media pickers, QR/camera/share/push/profile APIs | business API transport, authorization |

Rules:

- Mini program admin packages require explicit approval, `backend-admin` surface classification, and backend SDK boundary verification.
- Packages without `mp-console` or `mp-admin` are default mini program app/user packages.
- `sdkwork-<product>-mp-console-<capability>` packages are the user-facing mini program management console family. They follow the same package-internal shape as default mini program capability packages and consume app-api through generated TypeScript app SDK clients or approved appbase/mini-program wrappers.
- `sdkwork-<product>-mp-admin-<capability>` packages are approved internal operations admin packages and map to `backend-admin`; they must consume backend-api through generated backend SDK clients or approved backend wrappers.
- The `<capability>` segment is the concrete business module token. It `MUST` use lower kebab-case and `MUST NOT` be a placeholder such as `console`, `admin`, `manager`, `backend`, `common`, or `misc`.
- Capability packages should map to platform subpackages by default when they contain more than trivial pages.
- Shared components remain domain-neutral. Domain components live in the owning capability package.
- Packages must be small enough to be understood and tested independently.

## 4. Package Internal Shape

```text
packages/sdkwork-<product>-mp-<capability>/
  package.json
  README.md
  src/
    index.ts
    pages/
    components/
    services/
    state/
    i18n/
    routes/
    navigation/
    host/
    types/
  tests/
  specs/
```

Rules:

- `src/index.ts` is the public export boundary.
- `pages/` owns SDKWork source pages before projection into mini program runtime pages.
- `components/` owns package-local mini program components.
- `services/` owns app SDK orchestration through injected SDK clients or service ports.
- `state/` owns view/cache state and must clear sensitive state on logout and account/tenant switch.
- `routes/` owns route contributions and mini program placement metadata.
- `host/` owns adapter contracts used by the package, not platform API implementations.
- Local `types/` owns view models and route params. API DTOs come from generated SDKs.

## 5. SDKWork Packages Versus Platform Subpackages

Rules:

- SDKWork packages are source and dependency boundaries.
- Mini program `subpackages` are runtime loading and package-size boundaries.
- A platform subpackage must not import another feature package's private source paths.
- Build tooling should project route contributions from SDKWork packages into root pages and subpackages.
- Login, first-run, authorization callback, required tab pages, and other mandatory startup pages may live in the root mini program package.
- Larger business capabilities should be placed in platform subpackages.
- A capability should default to one subpackage unless size, platform constraints, or route cohesion require a documented split.

Standard mini program route placement metadata:

```ts
export interface MiniProgramRoutePlacement {
  rootPackage?: boolean;
  subpackage?: string;
  pagePath: string;
  preload?: boolean;
}
```

Example:

```ts
export const ordersRoute = {
  id: "app.commerce.orders.detail",
  surface: "app",
  domain: "commerce",
  capability: "orders",
  screen: "detail",
  titleKey: "commerce.orders.detail.title",
  auth: "required",
  presentation: {
    miniProgram: "subpackagePage",
  },
  miniProgram: {
    subpackage: "orders",
    pagePath: "pages/detail/index",
  },
};
```

## 6. Dependency Direction

Allowed flow:

```text
mp-core, mp-commons
  -> mp-shell, mp-console-core, mp-admin-core
  -> mp-console-shell, mp-admin-shell
  -> app/console/admin capability packages
  -> root src composition and route projection
  -> mp-host platform adapters
```

Rules:

- `mp-core` and `mp-commons` must not import business capability packages.
- Capability services call injected SDK clients or service ports, not raw request APIs.
- Platform API implementations live in `mp-host`, not feature pages.
- Cross-capability behavior uses public exports, route ids, SDK calls, service ports, or approved composed facades.
- Cross-package imports must use package root exports, not private source paths.

## 7. SDK And IAM Integration

Rules:

- User-facing mini program packages `MUST` use generated TypeScript app SDK clients or approved appbase/mini-program wrappers for `/app/v3/api`.
- Mini program admin packages, when approved as `backend-admin` surfaces, `MUST` use backend SDK clients or approved backend wrappers for `/backend/v3/api`.
- The root runtime `MUST` create one global TokenManager or approved mini program equivalent for authenticated session context.
- Appbase login/session behavior should use appbase app SDK resources or an approved mini program IAM adapter. Product packages must not create local auth/session endpoints.
- Mini program platform login codes, phone-number grants, profile prompts, and provider-specific auth facts are platform inputs. They must be exchanged through approved app-api/appbase flows, not through feature-local raw HTTP.
- Token/session clearing must clear platform storage, token manager, context store, sensitive state, and realtime/session bridges.
- Missing SDK methods must be fixed in app-api/OpenAPI/generator inputs and regenerated.

## 8. Host Adapter Boundary

Standard mini program host adapter categories:

```text
platformLogin
secureStorage
camera
qrScanner
mediaPicker
filePicker
share
subscriptionsOrPush
deepLinksOrScene
networkStatus
appLifecycle
clipboard
geolocation
deviceInfo
haptics
paymentBridge
```

Rules:

- Feature packages must not call `wx.*`, `my.*`, `dd.*`, `tt.*`, or equivalent platform globals directly.
- `mp-host` provides platform implementations and fakes for tests.
- Adapter methods must normalize platform-specific errors into stable SDKWork host errors.
- Scene/query/deep-link inputs must validate expected source, path, nonce/state, expiry, and auth requirements before sensitive flows complete.
- File/media upload uses Drive app SDK or approved Drive uploader facades. Host adapters only select or capture files.
- Payment bridge adapters may collect platform payment facts, but payment authorization and order state remain backend/app-api responsibilities.

## 9. Route And UI Alignment

Rules:

- Mini program route ids must follow `<surface>.<domain>.<capability>.<screen>`.
- Route metadata must align with PC, H5, and Flutter route ids when the same workflow exists.
- Mini program physical page paths may differ, but `id`, `surface`, `domain`, `capability`, `screen`, `titleKey`, and `permissionHint` should align.
- `app.json` pages and subpackages should be generated or assembled from route contributions where tooling exists.
- Route metadata must not declare API URLs or SDK methods.
- Mini program UI should be touch-first, safe-area-aware, and package-size-conscious. It must not import desktop-only components, browser DOM-only helpers, or Node-only libraries.

## 10. Config, Build, And Release

Rules:

- `config/mini-program/` owns non-secret runtime templates for SDK base URLs, public feature flags, and app metadata.
- `config/host/` owns platform app ids, platform profiles, permission references, upload environment, platform package settings, and signing/reference metadata.
- Host config must not contain platform private keys, auth tokens, refresh tokens, API keys, database credentials, private endpoints, business API constants, or SDK package ownership.
- `sdkwork.app.config.json` should set `runtime.family = "mini-program"` and a specific `runtime.framework` such as `weixin-mini-program` or `multi-mini-program`.
- `publish.platforms` and package matrix should use backend `PlusPlatform` values such as `MP_WEIXIN`, `MP_ALIPAY`, `MP_DINGTALK`, or `MP_LARK`.
- Store/review screenshots and icons must represent the actual mini program.

## 11. Standard Commands

Mini program roots should provide:

```text
pnpm install
pnpm dev
pnpm mp:dev
pnpm mp:build
pnpm mp:build:staging
pnpm mp:build:prod
pnpm mp:preview
pnpm mp:upload
pnpm typecheck
pnpm lint
pnpm test
pnpm test:config
pnpm test:routes
```

Rules:

- `pnpm dev` starts the default mini program development flow or watcher.
- Production build/upload commands must run route projection, config validation, platform package validation, manifest validation, and secret scans before upload.
- Platform-specific commands should be explicit when more than one mini program platform exists, for example `mp:weixin:build` and `mp:alipay:build`.

## 12. Verification

Required verification for mini program architecture changes:

| Verification | Evidence |
| --- | --- |
| Root layout | Static check proves `.sdkwork/`, `config/mini-program`, `config/host`, `src/bootstrap`, `packages/`, route projection targets, `sdks/`, scripts, and tests exist. |
| Package naming | Static check proves packages use `sdkwork-<product>-mp-*` and reserved console/admin/host forms. |
| Package/subpackage boundary | Static check proves business code lives in SDKWork packages and platform pages/subpackages are projections or thin wrappers. |
| Route projection | Tests prove route contributions generate or assemble `app.json` pages/subpackages deterministically. |
| Route alignment | Static checks prove route ids follow the shared route id format and align with other client roots where applicable. |
| SDK boundary | Static scan proves generated app SDK clients or approved wrappers are used and no raw request APIs/manual auth headers/generated SDK edits were introduced. |
| IAM clearing | Tests prove platform storage, token manager, context store, caches, and sensitive state clear on logout/refresh failure/account switch. |
| Host boundary | Static scan proves feature packages do not call platform globals directly. |
| Config boundary | Tests prove runtime and host config templates are non-secret and reject platform private keys, tokens, API keys, database URLs, and private endpoints. |
| Package-size boundary | Checks prove root package and subpackages stay within documented platform limits when tooling supports it. |

Acceptance checklist:

- [ ] SDKWork packages, not platform subpackages, define the source architecture.
- [ ] Platform pages/subpackages are generated or assembled from route contributions.
- [ ] Package names use the `mp` segment unless a platform-specific exception is approved.
- [ ] Generated TypeScript app SDKs or approved wrappers are injected from bootstrap/core.
- [ ] Platform APIs are behind typed host adapters.
- [ ] Route ids align with other client architectures where workflows match.
- [ ] Config, manifest, platform package metadata, and release files are secret-free.
- [ ] Verification evidence is recorded before completion.
