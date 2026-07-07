# Reusable Module Standard

- Version: 1.0
- Scope: reusable frontend/backend modules, appbase packages, service facades, extension points, module composition
- Related: `APPLICATION_LAYERED_ARCHITECTURE_SPEC.md`, `COMPOSABLE_ARCHITECTURE_SPEC.md`, `DOMAIN_SPEC.md`, `APPLICATION_SPEC.md`, `APP_COMPOSITION_SPEC.md`, `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, `APP_PC_ARCHITECTURE_SPEC.md`, `APP_H5_ARCHITECTURE_SPEC.md`, `FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC.md`, `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md`, `ANDROID_APP_MOBILE_ARCHITECTURE_SPEC.md`, `IOS_APP_MOBILE_ARCHITECTURE_SPEC.md`, `HARMONY_APP_MOBILE_ARCHITECTURE_SPEC.md`, `CODE_STYLE_SPEC.md`, `NAMING_SPEC.md`, `RUST_CODE_SPEC.md`, `JAVA_CODE_SPEC.md`, `TYPESCRIPT_CODE_SPEC.md`, `FRONTEND_CODE_SPEC.md`, `FRONTEND_SPEC.md`, `UI_ARCHITECTURE_SPEC.md`, `APP_PC_REACT_UI_SPEC.md`, `APP_MOBILE_REACT_UI_SPEC.md`, `APP_FLUTTER_UI_SPEC.md`, `APP_MINI_PROGRAM_UI_SPEC.md`, `APP_ANDROID_NATIVE_UI_SPEC.md`, `APP_IOS_NATIVE_UI_SPEC.md`, `APP_HARMONY_NATIVE_UI_SPEC.md`, `BACKEND_UI_SPEC.md`, `SDK_SPEC.md`, `API_SPEC.md`, `TEST_SPEC.md`

This standard defines the building-block model for SDKWork applications. A reusable module must be installable, understandable, replaceable, and testable without copying app-specific code. Application-wide L0-L6 responsibility boundaries follow `APPLICATION_LAYERED_ARCHITECTURE_SPEC.md`; cross-stack composition closure follows `COMPOSABLE_ARCHITECTURE_SPEC.md`.

## 1. Module Contract

Every reusable module `MUST` expose a public contract.

```ts
export interface SdkworkModule<TClients, TConfig, TServices> {
  name: string;
  version: string;
  domain: string;
  initialize(input: {
    clients: TClients;
    config: TConfig;
    services?: Partial<TServices>;
  }): TServices;
}
```

Rules:

- A module `MUST` declare one primary domain and one capability.
- A module `MUST` expose one package root export from `src/index.ts` or the language-equivalent public export file defined by its architecture standard.
- A new composable module `MUST` declare `contracts.layerRole`, `contracts.publicExports`,
  `contracts.providedPorts`, and `contracts.requiredPorts` in `specs/component.spec.json` so
  consumers can integrate it without reading private implementation files.
- A module `MUST NOT` require app-local globals, hidden singleton SDK clients, hard-coded URLs, hard-coded tenant IDs, or manually assembled auth headers.
- A module `MUST` be usable with standalone/cloud SDK clients and Java/Rust
  runtime implementations when its domain is shared.
- A module `SHOULD` publish a small public type surface and hide implementation internals.
- A module implementation `MUST` follow `CODE_STYLE_SPEC.md`, `NAMING_SPEC.md`, and the language-specific spec only for languages it actually uses.

## 2. Package Classification

| Package type | Owns | Must not own |
| --- | --- | --- |
| `contracts` | Public TypeScript interfaces, generated type adapters, constants | UI, network calls |
| `service` | Domain orchestration, SDK client injection, validation mapping | React rendering, host calls |
| `ui` | Stateless or controlled visual components | business authorization, raw SDK calls |
| `feature` | Integrated pages/hooks using services and UI | transport configuration |
| `runtime` | Providers, bootstrap, storage adapters, host adapters | domain invariants |
| `host` | browser/mobile/native/runtime boundary | API business logic |
| `backend-domain-ui` | `backend-admin` domain pages, route/menu metadata, operator services using backend SDK | app/user-facing UI, app SDK calls, backend SDK construction |
| `pc-console-ui` | User-facing PC management console pages, route metadata, console services using app SDKs | company-internal admin workflows, backend-only operation center behavior |
| `pc-admin-ui` | Company-internal PC admin pages, route/menu metadata, internal operator services using backend SDKs | app/user-facing UI, user console workflows, app SDK login/session creation |
| `client-app-ui` | Client app-root packages aligned by core, commons, shell, capability, console/admin, and host roles | cross-architecture UI imports, hidden SDK constructors, platform globals |

Rules:

- Shared foundation modules `SHOULD` split contracts, service, UI, feature, runtime, and host only when the split reduces coupling.
- Small modules may keep these layers in one package, but boundaries must remain visible in folders and exports.
- A package named `core` must be domain-specific, such as `sdkwork-iam-core-pc-react`; generic `sdkwork-core` is forbidden for new shared domain behavior.
- PC user console modules `MUST` follow `APP_PC_ARCHITECTURE_SPEC.md` and be split as `sdkwork-<application-code>-pc-console-<capability>`.
- PC internal admin modules `MUST` follow `APP_PC_ARCHITECTURE_SPEC.md` and `BACKEND_UI_SPEC.md` and be split as `sdkwork-<application-code>-pc-admin-<capability>`.
- H5 application modules `MUST` follow `APP_H5_ARCHITECTURE_SPEC.md` and be split as `sdkwork-<application-code>-h5-<capability>`, with Capacitor host code in `sdkwork-<application-code>-h5-capacitor`.
- Flutter mobile modules `MUST` follow `FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC.md` and be split as lower snake case Dart packages such as `sdkwork_<application_code>_flutter_mobile_<capability>`.
- Mini program modules `MUST` follow `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` and `APP_MINI_PROGRAM_UI_SPEC.md` and be split as `sdkwork-<application-code>-mp-<capability>` source packages or approved shared `sdkwork-<capability>-mini-program` packages. Platform `pages` and `subpackages` are projections, not the source module boundary.
- Android native modules `MUST` follow `ANDROID_APP_MOBILE_ARCHITECTURE_SPEC.md` and `APP_ANDROID_NATIVE_UI_SPEC.md` and be split as `sdkwork-<application-code>-android-mobile-<capability>` source packages or approved shared `sdkwork-<capability>-android-native` packages.
- iOS native modules `MUST` follow `IOS_APP_MOBILE_ARCHITECTURE_SPEC.md` and `APP_IOS_NATIVE_UI_SPEC.md` and be split as `sdkwork-<application-code>-ios-mobile-<capability>` source packages or approved shared `sdkwork-<capability>-ios-native` packages.
- Harmony native modules `MUST` follow `HARMONY_APP_MOBILE_ARCHITECTURE_SPEC.md` and `APP_HARMONY_NATIVE_UI_SPEC.md` and be split as `sdkwork-<application-code>-harmony-mobile-<capability>` source packages or approved shared `sdkwork-<capability>-harmony-native` packages.
- Standalone backend/admin UI modules `MUST` follow `BACKEND_UI_SPEC.md` and be split by business domain as `@sdkwork/react-backend-<domain>`.
- `@sdkwork/react-backend-ui` may contain only domain-neutral primitives; backend business pages and services must live in the owning backend domain package.

## 3. Appbase Canonical Modules

`apps/sdkwork-appbase` should use canonical IAM and platform naming for new modules.

| Capability | Canonical module intent |
| --- | --- |
| `iam-auth` | Login, registration, sessions, token refresh/logout, MFA/passkey/OAuth extensions |
| `iam-user` | Current user, profiles, identities, credentials, preferences |
| `iam-tenant` | Tenant selection, tenant settings, tenant members |
| `iam-organization` | Organization tree, departments, organization members |
| `iam-permission` | Roles, permissions, policies, authorization hints |
| `iam-security` | Security events, audit timeline, devices, API keys |
| `platform-app` | App manifest, app registry, environment, release/update metadata |
| `runtime-bootstrap` | SDK client creation, deployment profile, runtime target, token storage, host adapter injection, IAM application bootstrap orchestration through `@sdkwork/iam-application-bootstrap` |

Rules:

- New modules use `iam`, not `identity`, for user/auth/tenant/permission foundations.
- Legacy package names may be wrapped during migration, but new public contracts use canonical names.
- UI labels may use user-friendly wording; domain contracts use canonical domain names.

## 4. Dependency Direction

Allowed dependency flow:

```text
feature -> ui
feature -> service
service -> contracts
service -> generated SDK client interface
runtime -> service
runtime -> host adapter
app shell -> runtime
app shell -> feature
```

Forbidden dependencies:

- `contracts` importing `ui`, `service`, generated SDK implementations, or app shell code.
- `ui` constructing generated SDK clients.
- `service` importing app route files, page components, or native host implementations.
- shared modules importing another package through `/src/...` internals.
- foundation modules depending on application-specific feature modules.

## 4.1 Implementation Layout

Rules:

- Module entrypoints expose public contracts and composition helpers only.
- Reusable modules consumed by an application must be registered and bound through the architecture core package `composition/module-registry.*` per `APP_COMPOSITION_SPEC.md`.
- Reusable modules expose provided/required ports through `COMPONENT_SPEC.md` and
  `COMPOSABLE_ARCHITECTURE_SPEC.md`; README examples may explain those ports but must not become
  the authority.
- Durable module layer boundaries `MUST` follow `APPLICATION_LAYERED_ARCHITECTURE_SPEC.md`; a
  module that mixes UI, service, repository, provider, runtime, and contract ownership must split
  those responsibilities or document a temporary migration exception in its component spec.
- Business logic belongs in service/use-case modules.
- Persistence belongs in repository modules.
- Provider calls and host/runtime integration belong in adapters.
- Configuration belongs in typed config/bootstrap modules.
- Tests must target the public contract or focused internal units, not private file paths from other packages.
- Rust modules must not collect business logic in `src/lib.rs`; `RUST_CODE_SPEC.md` defines the required split.
- Java modules follow controller/service/repository/package boundaries from `JAVA_CODE_SPEC.md`.
- TypeScript modules use `src/index.ts` as the export boundary and typed SDK ports from `TYPESCRIPT_CODE_SPEC.md`.
- Frontend modules keep UI, hooks, services, state, routes, and i18n separated according to `FRONTEND_CODE_SPEC.md`.

## 5. SDK Client Port Injection

Reusable modules separate what changes from what stays stable:

| Concern | Owner |
| --- | --- |
| Concrete SDK constructor, base URL, environment, deployment profile, runtime target, and endpoint selection | runtime/bootstrap |
| Generated app SDK package name and client class | application adapter |
| Generated backend SDK package name and client class | application adapter |
| Stable resource method surface such as `client.auth.sessions.create` | module SDK port |
| Business orchestration and normalization | module service |
| React UI and hooks | module UI/feature layer |

Rules:

- A shared module `MUST` accept generated SDK clients through typed ports instead of importing app-specific SDK packages directly.
- A shared module `MUST NOT` create concrete app/backend SDK clients inside UI components or service functions.
- The app SDK and backend SDK may come from different generated packages, but equivalent shared resources `MUST` use the same `tag + operationId` method tree.
- Runtime/bootstrap owns environment, standalone/cloud deployment profile,
  runtime target, endpoint selection, and token store wiring.
- Service modules may compose multiple SDK calls into one use case, but they `MUST NOT` hide missing SDK operations with raw HTTP fallbacks.
- Tests `MUST` prove the service works with fake clients that implement the same generated resource surface.

IAM example:

```ts
const isBackendAdminRuntime = classifyRuntimeSurface(config) === "backend-admin";

createIamRuntime({
  clients: {
    appbaseApp,
    appbaseBackend: isBackendAdminRuntime ? appbaseBackend : undefined,
    sdkClients: [
      productAppSdk,
      ...(isBackendAdminRuntime ? [productBackendSdk] : []),
    ],
  },
  config: {
    appId: "commerce-pc",
    deploymentProfile: "cloud",
    runtimeTarget: "browser",
    environment: "prod",
  },
  tokenStore,
});
```

Communication modules follow the same rule. IM and RTC consumers use the public packages `@sdkwork/im-sdk` and `@sdkwork/rtc-sdk`, whose active source workspaces are:

- `apps/sdkwork-im/sdks/sdkwork-im-sdk`
- `../sdkwork-rtc/sdks/sdkwork-rtc-sdk`

Deprecated `openchat` sources `MUST NOT` be used for new appbase modules.

## 5.1 UI Architecture Module Families

| Architecture | Canonical package family | Required spec |
| --- | --- | --- |
| Cross-architecture shared packages | `apps/sdkwork-<application-code>-common/packages/sdkwork-<capability>` | `APPLICATION_SPEC.md`, `MODULE_SPEC.md` |
| App PC React | `apps/sdkwork-<application-code>-pc/packages/sdkwork-<application-code>-pc-<capability>` or `apps/sdkwork-<domain>-pc/packages/sdkwork-<domain>-pc-<capability>` in a domain repository | `APP_PC_ARCHITECTURE_SPEC.md`, then `APP_PC_REACT_UI_SPEC.md` |
| PC user console React | `apps/sdkwork-<application-code>-pc/packages/sdkwork-<application-code>-pc-console-<capability>` | `APP_PC_ARCHITECTURE_SPEC.md`, then `APP_PC_REACT_UI_SPEC.md` |
| PC internal admin React | `apps/sdkwork-<application-code>-pc/packages/sdkwork-<application-code>-pc-admin-<capability>` | `APP_PC_ARCHITECTURE_SPEC.md`, then `BACKEND_UI_SPEC.md` |
| H5 mobile React | `apps/sdkwork-<application-code>-h5/packages/sdkwork-<application-code>-h5-<capability>` | `APP_H5_ARCHITECTURE_SPEC.md`, then `APP_MOBILE_REACT_UI_SPEC.md` |
| App Flutter | `apps/sdkwork-<application-code>-flutter-mobile/packages/sdkwork_<application_code>_flutter_mobile_<capability>` | `FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC.md`, then `APP_FLUTTER_UI_SPEC.md` |
| Mini program app | `apps/sdkwork-<application-code>-mini-program/packages/sdkwork-<application-code>-mp-<capability>` | `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md`, then `APP_MINI_PROGRAM_UI_SPEC.md` |
| Android native app | `apps/sdkwork-<application-code>-android-mobile/packages/sdkwork-<application-code>-android-mobile-<capability>` | `ANDROID_APP_MOBILE_ARCHITECTURE_SPEC.md`, then `APP_ANDROID_NATIVE_UI_SPEC.md` |
| iOS native app | `apps/sdkwork-<application-code>-ios-mobile/packages/sdkwork-<application-code>-ios-mobile-<capability>` | `IOS_APP_MOBILE_ARCHITECTURE_SPEC.md`, then `APP_IOS_NATIVE_UI_SPEC.md` |
| Harmony native app | `apps/sdkwork-<application-code>-harmony-mobile/packages/sdkwork-<application-code>-harmony-mobile-<capability>` | `HARMONY_APP_MOBILE_ARCHITECTURE_SPEC.md`, then `APP_HARMONY_NATIVE_UI_SPEC.md` |
| Standalone backend/admin React | `apps/sdkwork-backend-react-web/packages/sdkwork-react-backend-<domain>` | `BACKEND_UI_SPEC.md` |

Rules:

- A UI module `MUST` choose the architecture package family through `UI_ARCHITECTURE_SPEC.md` before implementation.
- Legacy repository-root families such as `packages/pc-react/<domain>/`, `packages/common/<domain>/`, and `packages/mobile-react/<domain>/` are migration-only. New modules `MUST NOT` add them in domain multi-surface repositories.
- App-side and PC user console UI modules consume app SDK surfaces; PC internal admin and standalone backend/admin UI modules are `backend-admin` modules and consume backend SDK surfaces.
- Modules for different UI architectures may share contracts, generated SDK surfaces, service concepts, route ids, i18n keys, and design tokens, but must not import each other's UI components, routes, platform pages, widgets, or host implementations.
- PC internal admin and standalone backend React modules are `backend-admin` modules and must not be consolidated into a single backend business package. Split them by business domain, capability, and permission prefix.
- Catch-all backend/admin packages are forbidden for business pages, business services, repositories, route records, menu records, permission constants, and domain i18n.

## 6. Extension Points

Reusable modules `MUST` make variation explicit.

```ts
export interface IamModuleExtensions {
  passwordPolicy?: PasswordPolicyProvider;
  mfaProvider?: MfaProvider;
  organizationLabelProvider?: OrganizationLabelProvider;
  permissionCatalogProvider?: PermissionCatalogProvider;
}
```

Rules:

- Extension points `MUST` be interfaces, callbacks, providers, or adapters.
- Extension points `MUST` have deterministic fallback behavior.
- Extension points `MUST NOT` require consumers to monkey-patch generated SDK clients or overwrite internal files.
- Extensions that change API or database semantics require updates to `API_SPEC.md` or `DATABASE_SPEC.md`.

## 7. Module Documentation

Each reusable module `MUST` include:

- Capability and domain.
- Public exports.
- Required SDK client surface.
- Configuration inputs.
- Extension points.
- Security assumptions.
- Tests and verification command.
- Example integration in standalone and cloud application profiles when applicable.

## 8. Acceptance Checklist

- [ ] Module has one domain and one capability.
- [ ] Public contract is exported from `src/index.ts`.
- [ ] New composable modules declare layer role and port contracts in `component.spec.json`.
- [ ] Implementation follows `CODE_STYLE_SPEC.md`, `NAMING_SPEC.md`, and only the language specs used by the module.
- [ ] Entry files do not contain unrelated business logic, persistence, provider adapters, and tests.
- [ ] Dependencies flow in the allowed direction.
- [ ] SDK clients are injected and typed.
- [ ] Concrete SDK constructors stay in runtime/bootstrap or application adapters.
- [ ] IAM application bootstrap stays in `@sdkwork/iam-application-bootstrap`; scripts remain thin wrappers.
- [ ] Standalone/cloud variation and runtime-target variation are hidden behind runtime/bootstrap.
- [ ] Extension points are explicit.
- [ ] Module tests use fake or generated SDK clients.
- [ ] README documents integration and verification.
