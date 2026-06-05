# Reusable Module Standard

- Version: 1.0
- Scope: reusable frontend/backend modules, appbase packages, service facades, extension points, module composition
- Related: `DOMAIN_SPEC.md`, `APPLICATION_SPEC.md`, `FRONTEND_SPEC.md`, `UI_ARCHITECTURE_SPEC.md`, `APP_PC_REACT_UI_SPEC.md`, `APP_MOBILE_REACT_UI_SPEC.md`, `APP_FLUTTER_UI_SPEC.md`, `BACKEND_UI_SPEC.md`, `SDK_SPEC.md`, `API_SPEC.md`, `TEST_SPEC.md`

This standard defines the building-block model for SDKWork applications. A reusable module must be installable, understandable, replaceable, and testable without copying app-specific code.

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
- A module `MUST` expose one package root export from `src/index.ts`.
- A module `MUST NOT` require app-local globals, hidden singleton SDK clients, hard-coded URLs, hard-coded tenant IDs, or manually assembled auth headers.
- A module `MUST` be usable with SaaS Java SDK clients and Rust local/private SDK clients when its domain is shared.
- A module `SHOULD` publish a small public type surface and hide implementation internals.

## 2. Package Classification

| Package type | Owns | Must not own |
| --- | --- | --- |
| `contracts` | Public TypeScript interfaces, generated type adapters, constants | UI, network calls |
| `service` | Domain orchestration, SDK client injection, validation mapping | React rendering, host calls |
| `ui` | Stateless or controlled visual components | business authorization, raw SDK calls |
| `feature` | Integrated pages/hooks using services and UI | transport configuration |
| `runtime` | Providers, bootstrap, storage adapters, host adapters | domain invariants |
| `host` | browser/mobile/native/runtime boundary | API business logic |
| `backend-domain-ui` | Backend/admin domain pages, route/menu metadata, operator services using backend SDK | app/user-facing UI, app SDK calls, backend SDK construction |

Rules:

- Shared foundation modules `SHOULD` split contracts, service, UI, feature, runtime, and host only when the split reduces coupling.
- Small modules may keep these layers in one package, but boundaries must remain visible in folders and exports.
- A package named `core` must be domain-specific, such as `sdkwork-iam-core-pc-react`; generic `sdkwork-core` is forbidden for new shared domain behavior.
- Backend/admin UI modules `MUST` follow `BACKEND_UI_SPEC.md` and be split by business domain as `@sdkwork/react-backend-<domain>`.
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
| `runtime-bootstrap` | SDK client creation, deployment mode, token storage, host adapter injection |

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
- foundation modules depending on product-specific feature modules.

## 5. SDK Client Port Injection

Reusable modules separate what changes from what stays stable:

| Concern | Owner |
| --- | --- |
| Concrete SDK constructor, base URL, environment, SaaS/private/local endpoint selection | runtime/bootstrap |
| Generated app SDK package name and client class | application adapter |
| Generated backend SDK package name and client class | application adapter |
| Stable resource method surface such as `client.auth.sessions.create` | module SDK port |
| Business orchestration and normalization | module service |
| React UI and hooks | module UI/feature layer |

Rules:

- A shared module `MUST` accept generated SDK clients through typed ports instead of importing app-specific SDK packages directly.
- A shared module `MUST NOT` create concrete app/backend SDK clients inside UI components or service functions.
- The app SDK and backend SDK may come from different generated packages, but equivalent shared resources `MUST` use the same `tag + operationId` method tree.
- Runtime/bootstrap owns dev/test/prod/SaaS/private/local selection and token store wiring.
- Service modules may compose multiple SDK calls into one use case, but they `MUST NOT` hide missing SDK operations with raw HTTP fallbacks.
- Tests `MUST` prove the service works with fake clients that implement the same generated resource surface.

IAM example:

```ts
createIamRuntime({
  clients: {
    app: appSdkClient,
    backend: backendSdkClient,
  },
  config: {
    appId: "sdkwork-router",
    deploymentMode: "saas",
    environment: "prod",
  },
  tokenStore,
});
```

Communication modules follow the same rule. IM and RTC consumers use the public packages `@sdkwork/im-sdk` and `@sdkwork/rtc-sdk`, whose active source workspaces are:

- `apps/craw-chat/sdks/sdkwork-im-sdk`
- `apps/craw-chat/sdks/sdkwork-rtc-sdk`

Deprecated `openchat` sources `MUST NOT` be used for new appbase modules.

## 3.1 UI Architecture Module Families

| Architecture | Canonical package family | Required spec |
| --- | --- | --- |
| App PC React | `packages/pc-react/<domain>/sdkwork-<capability>-pc-react` | `APP_PC_REACT_UI_SPEC.md` |
| App mobile React | `packages/mobile-react/<domain>/sdkwork-<capability>-mobile-react` | `APP_MOBILE_REACT_UI_SPEC.md` |
| App Flutter | `packages/mobile-flutter/<domain>/sdkwork_<capability>_flutter` | `APP_FLUTTER_UI_SPEC.md` |
| Backend/admin React | `apps/sdkwork-backend-react-web/packages/sdkwork-react-backend-<domain>` | `BACKEND_UI_SPEC.md` |

Rules:

- A UI module `MUST` choose the architecture package family through `UI_ARCHITECTURE_SPEC.md` before implementation.
- App-side UI modules consume app SDK surfaces; backend/admin UI modules consume backend SDK surfaces.
- Modules for different UI architectures may share contracts and service concepts, but must not import each other's UI components, routes, or host adapters.
- Backend/admin modules must not be consolidated into a single backend business package. Split them by business domain and permission prefix.
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
- Example integration in a SaaS app and a local/private app when applicable.

## 8. Acceptance Checklist

- [ ] Module has one domain and one capability.
- [ ] Public contract is exported from `src/index.ts`.
- [ ] Dependencies flow in the allowed direction.
- [ ] SDK clients are injected and typed.
- [ ] Concrete SDK constructors stay in runtime/bootstrap or application adapters.
- [ ] SaaS/local/private variation is hidden behind runtime/bootstrap.
- [ ] Extension points are explicit.
- [ ] Module tests use fake or generated SDK clients.
- [ ] README documents integration and verification.
