# Configuration And Environment Standard

- Version: 1.0
- Scope: environment config, SDK client initialization, secrets, feature flags, typed runtime config, dev/test/staging/prod profiles, desktop/server/container/web/H5/Flutter/mini-program/native Android/native iOS/native Harmony switching
- Related: `RUNTIME_DIRECTORY_SPEC.md`, `ENVIRONMENT_SPEC.md`, `DEPENDENCY_MANAGEMENT_SPEC.md`, `DEPLOYMENT_SPEC.md`, `SDK_SPEC.md`, `SECURITY_SPEC.md`, `APPLICATION_SPEC.md`, `APP_MANIFEST_SPEC.md`, `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md`, `APP_PC_ARCHITECTURE_SPEC.md`, `APP_H5_ARCHITECTURE_SPEC.md`, `FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC.md`, `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md`, `ANDROID_APP_MOBILE_ARCHITECTURE_SPEC.md`, `IOS_APP_MOBILE_ARCHITECTURE_SPEC.md`, `HARMONY_APP_MOBILE_ARCHITECTURE_SPEC.md`, `DESKTOP_APP_ARCHITECTURE_SPEC.md`, `I18N_SPEC.md`

This standard defines how applications select environment, deployment profile,
runtime target, base URLs, SDK clients, token storage, and feature flags without
leaking those decisions into reusable modules.

## 1. Configuration Sources

Allowed config sources:

| Source | Use |
| --- | --- |
| app manifest | App identity, runtime family, release/distribution metadata |
| environment variables | Deployment-specific base URLs, feature flags, safe non-secret runtime values |
| secret manager / secure storage | Secrets, tokens, private keys, signing credentials |
| bootstrap file | Local development defaults and app shell wiring |
| server config | Java/Rust service process settings |
| platform config | Tauri/native target packaging metadata, permissions, capabilities, signing references |

Rules:

- Shared modules `MUST NOT` read process env, `.env` files, local storage, registry, or native config directly.
- Shared modules receive typed config from runtime/bootstrap.
- Secrets `MUST NOT` be stored in app manifests or committed config files.
- Standalone/cloud differences `MUST` be represented as typed
  `deploymentProfile`, not scattered conditionals.
- Lifecycle environment, deployment profile, and runtime target `MUST` be
  represented as separate typed fields. A single `NODE_ENV`, Vite mode, Spring
  profile, Tauri target, or container image name must not be used as the whole
  runtime decision model.
- Source/build dependency paths in package, workspace, SDK, or tool config `MUST` follow `DEPENDENCY_MANAGEMENT_SPEC.md` and must not use machine-specific absolute paths.

## 2. Standard Runtime Config

```ts
export type SdkworkEnvironment = "development" | "test" | "staging" | "production";
export type SdkworkConfigProfile = "dev" | "test" | "staging" | "prod";
export type SdkworkBuildMode = "development" | "test" | "staging" | "production";
export type SdkworkDeploymentProfile = "standalone" | "cloud";
export type SdkworkRuntimeTarget =
  | "browser"
  | "desktop"
  | "tablet-ipados"
  | "tablet-android"
  | "capacitor-ios"
  | "capacitor-android"
  | "flutter-ios"
  | "flutter-android"
  | "android-native"
  | "ios-native"
  | "harmony-native"
  | "mini-program"
  | "server"
  | "container"
  | "test-runner";

export interface SdkworkRuntimeConfig {
  environment: SdkworkEnvironment;
  configProfile?: SdkworkConfigProfile;
  buildMode?: SdkworkBuildMode;
  deploymentProfile: SdkworkDeploymentProfile;
  runtimeTarget: SdkworkRuntimeTarget;
  openApiBaseUrl?: string;
  appApiBaseUrl: string;
  backendApiBaseUrl?: string;
  sdkBaseUrls?: SdkworkSdkBaseUrlConfig;
  dependencyApiSurfaces?: SdkworkDependencyApiSurfaceConfig[];
  dependencyApiExports?: SdkworkDependencyApiExportConfig[];
  auth?: SdkworkAuthRuntimeConfig;
  i18n?: SdkworkI18nRuntimeConfig;
  publicRuntime?: SdkworkPublicRuntimeConfig;
  server?: SdkworkServerConfig;
  desktop?: SdkworkDesktopConfig;
  tablet?: SdkworkTabletConfig;
  mobile?: SdkworkMobileConfig;
  miniProgram?: SdkworkMiniProgramConfig;
  paths?: SdkworkRuntimePaths;
  database?: SdkworkDatabaseConfig;
  redis?: SdkworkRedisConfig;
  appKey: string;
  featureFlags?: Record<string, boolean | string | number>;
}

export interface SdkworkSdkBaseUrlConfig {
  sdkBaseUrl?: string;
  defaultApiBaseUrl?: string;
  openApiBaseUrl?: string;
  appApiBaseUrl: string;
  backendApiBaseUrl?: string;
  dependencySdkBaseUrls?: Record<string, SdkworkDependencySdkBaseUrls>;
}

export interface SdkworkDependencySdkBaseUrls {
  openApiBaseUrl?: string;
  appApiBaseUrl?: string;
  backendApiBaseUrl?: string;
}

export interface SdkworkDependencyApiSurfaceConfig {
  workspace: string;
  sdkFamily: string;
  apiAuthority: string;
  surface: "open-api" | "app-api" | "backend-api";
  apiPrefix: string | null;
  runtimeMode: "same-origin" | "external-service" | "not-mounted";
  sameOriginAllowed: boolean;
  executableExport?: string;
  cargoFeature?: string;
  cargoDependency?: string;
  mountPath?: string;
  routeContract?: string;
  coverage: "verified" | "partial" | "missing";
  requiredBaseUrlKey?: string;
}

export interface SdkworkDependencyApiExportConfig {
  workspace: string;
  sdkFamily: string;
  apiAuthority: string;
  surface: "open-api" | "app-api" | "backend-api";
  apiPrefix: string | null;
  exportMode: "none" | "dependency-sdk" | "composed-wrapper" | "service-port" | "documentation-only";
  visibility: "internal" | "app" | "backend-admin" | "public" | string;
  methods?: string[];
  methodSelector?: string;
  packageExport?: string;
  servicePort?: string;
  documentationRef?: string;
  runtimeRequired?: boolean;
}

export interface SdkworkAuthRuntimeConfig {
  tokenManagerMode: "appbase-global" | "service-context" | "test";
  tokenStorage: "memory" | "browser-session" | "browser-local" | "os-secure-storage" | "server-context";
  accessTokenHeader: "Access-Token";
  authTokenHeader: "Authorization";
  refreshEnabled?: boolean;
  apiKeyCredentialProvider?: "server" | "secure-storage" | "short-lived" | "test";
}

export interface SdkworkI18nRuntimeConfig {
  defaultLocale: string;
  supportedLocales: string[];
  fallbackLocale: string;
  loadingStrategy?: "eager-core-lazy-feature" | "lazy-route-fragments" | "platform-generated-bundle";
  catalogManifestUrl?: string;
}

export interface SdkworkPublicRuntimeConfig {
  sdkBaseUrl?: string;
  apiBaseUrl?: string;
  openApiBaseUrl?: string;
  appApiBaseUrl?: string;
  backendApiBaseUrl?: string;
  dependencySdkBaseUrls?: Record<string, SdkworkDependencySdkBaseUrls>;
  i18n?: SdkworkI18nRuntimeConfig;
  runtimeEnvFile?: string;
  featureFlags?: Record<string, boolean | string | number>;
}

export interface SdkworkServerConfig {
  bind?: string;
  externalScheme?: "http" | "https";
  publicBaseUrl?: string;
  trustForwardedHeaders?: boolean;
  profileConfigFile?: string;
}

export interface SdkworkDesktopConfig {
  nativeHost: "tauri" | "electron" | "browser-installed" | "custom";
  localServiceEnabled?: boolean;
  localServiceBind?: string;
  userConfigFile?: string;
  secureStorageProvider?: string;
}

export interface SdkworkTabletConfig {
  platform: "ipad-os" | "android-tablet";
  nativeHost: "tauri" | "custom";
  bundleId?: string;
  packageName?: string;
  platformConfigFile?: string;
}

export interface SdkworkMobileConfig {
  architecture: "h5" | "capacitor" | "flutter" | "android-native" | "ios-native" | "harmony-native";
  platform?: "ios" | "android" | "harmony" | "browser" | "weixin-browser";
  nativeHost?: "capacitor" | "flutter" | "android-native" | "ios-native" | "harmony-native" | "browser" | "custom";
  bundleId?: string;
  packageName?: string;
  platformConfigFile?: string;
  secureStorageProvider?: string;
}

export interface SdkworkMiniProgramConfig {
  platform: "weixin" | "alipay" | "baidu" | "toutiao" | "lark" | "qq" | "kuaishou" | "jd" | "360" | "dingtalk" | "ali" | "custom";
  appId?: string;
  platformConfigFile?: string;
  subpackageStrategy?: "capability" | "manual" | "single-package";
}

export interface SdkworkRuntimePaths {
  appCode: string;
  processName?: string;
  configDirectory?: string;
  configFile?: string;
  dataDirectory?: string;
  logDirectory?: string;
  cacheDirectory?: string;
  runtimeDirectory?: string;
  tempDirectory?: string;
}

export interface SdkworkDatabaseConfig {
  engine: "postgresql" | "sqlite";
  host?: string;
  port?: number;
  database?: string;
  schema?: string;
  username?: string;
  passwordFile?: string;
  password?: string;
  sslMode?: string;
  maxConnections?: number;
  connectTimeoutMs?: number;
  idleTimeoutSeconds?: number;
  url?: string;
  file?: string;
  autoMigrate?: boolean;
  autoSeed?: boolean;
}

export interface SdkworkRedisConfig {
  enabled: boolean;
  host?: string;
  port?: number;
  database?: number;
  username?: string;
  url?: string;
  passwordFile?: string;
  password?: string;
  keyPrefix?: string;
  tls?: boolean;
  maxConnections?: number;
  connectTimeoutMs?: number;
  commandTimeoutMs?: number;
  poolIdleTimeoutSeconds?: number;
}
```

Rules:

- `environment` describes lifecycle stage.
- `configProfile` is a file/profile alias used by scripts and config file names. `dev` maps to `development`; `prod` maps to `production`. Application code should normalize to `environment`.
- `buildMode` describes the bundler/build tool mode. It is useful for Vite or native package scripts, but it is not the lifecycle authority for runtime behavior.
- `deploymentProfile` describes application deployment architecture and is only
  `standalone` or `cloud`.
- `runtimeTarget` describes where this config is consumed: browser renderer, desktop host, tablet host, Capacitor host, Flutter host, mini program runtime, server process, container process, or test runner.
- `openApiBaseUrl`, `appApiBaseUrl`, and `backendApiBaseUrl` are resolved before SDK clients are created, but backend SDK clients may be constructed only after the SDK inventory classifies the runtime as `backend-admin`.
- `openApiBaseUrl` is optional because not every application consumes an open-api SDK. When present for a SDKWork-owned business open-api, it `MUST` use that domain's approved non-app/non-backend prefix from `API_SPEC.md`, for example `/im/v3/api`. It does not require a literal `/open` path segment. `/v1` is valid only for explicitly documented compatibility APIs such as OpenAI-compatible AI API.
- `sdkBaseUrls` is the canonical SDK base URL map for bootstrap. It `SHOULD` start from one common `sdkBaseUrl` when one public SDK gateway, reverse proxy, or app edge serves all consumed SDK surfaces. `openApiBaseUrl`, `appApiBaseUrl`, `backendApiBaseUrl`, and dependency-specific entries are overrides, not a requirement to configure every SDK separately.
- A common `sdkBaseUrl` is a root, origin, or deployment path prefix. Bootstrap derives surface URLs by appending the standard API prefixes, for example `/v1`, `/app/v3/api`, and `/backend/v3/api`. It `MUST NOT` treat a surface URL such as `/v1` as the common SDK root for other surfaces.
- Per-surface and per-SDK overrides win over the common `sdkBaseUrl`. This keeps the simple one-base-url deployment path while still allowing split services, private dependency hosts, and tenant-specific SDK routing.
- `sdkBaseUrls.dependencySdkBaseUrls` owns override base URLs for dependency SDK families such as appbase, Drive, IM, or another product app. It must be keyed by stable SDK family id, not by ad hoc host names.
- `dependencyApiSurfaces` records which dependency-owned HTTP API surfaces are available through
  the current runtime, which are external services, and which are intentionally not mounted. It
  `MUST` match component/runtime manifests and the dependency surface rules in `SDK_SPEC.md`.
- Rust gateway runtimes may record `cargoFeature` and `cargoDependency` on dependency API surface
  entries. These values are pointers into native Cargo metadata, not a replacement catalog; tooling
  must verify them with `cargo metadata`, `[workspace.dependencies]`, and the runtime crate's
  feature table.
- Rust gateway dependency surfaces that are split upstream proxies `MUST` use `runtimeMode:
  "external-service"` or the gateway's equivalent split runtime mode plus `requiredBaseUrlKey` or
  dependency SDK base URL config. They `MUST NOT` set `cargoFeature` or `cargoDependency` unless an
  embedded executable dependency is actually compiled into the gateway.
- `dependencyApiExports` records which dependency-owned API capabilities this application or
  component intentionally exposes through authored public integration surfaces. It `MUST` default to
  `[]`; dependency APIs are not exported by a consuming app merely because dependency SDK clients
  are configured.
- `auth` config describes how the runtime obtains and stores credentials. It must not contain actual `authToken`, `accessToken`, `refreshToken`, API key values, or session DTOs.
- `i18n` config describes locale selection, supported locale list, fallback locale, and catalog loading strategy only. It must not contain translated message content, product copy, validation copy, or generated catalog bundles.
- Runtime config `MUST NOT` define `tenantId` or `organizationId` as API/SDK call defaults. Tenant and organization context after authentication is resolved from tokens, API key records, or server-side request context. Pre-auth tenant or organization selection must use IAM login/selection flows, not SDK config or per-call options.
- Config objects crossing host/native boundaries `SHOULD` be serializable.
- `publicRuntime` is browser-visible and may contain only non-secret values such
  as normalized `deploymentProfile`, `runtimeTarget`, public SDK base URLs, and
  feature flags. Browser bundles must not read private process config.
- `server` owns process bind, public URL, reverse-proxy trust, and service profile config. It must not own renderer-only build settings.
- `desktop` owns native host, user config, local service lifecycle, and secure storage provider. It must not own remote business API contracts.
- `tablet` owns iPadOS/Android tablet package identity and platform config references. It must not own phone-first H5 behavior or business SDK bypasses.
- `mobile` owns H5/Capacitor/Flutter/native Android/native iOS/native Harmony mobile package identity, platform config references, secure storage provider selection, and mobile host metadata. It must not own SDK package ownership, business route constants, auth tokens, refresh tokens, signing keys, or business authorization.
- `miniProgram` owns mini program platform identity, app id references, platform config file references, and page/subpackage strategy. It must not own platform private keys, business API contracts, generated SDK ownership, or feature-local auth behavior.
- `paths` resolves the canonical directories defined by `RUNTIME_DIRECTORY_SPEC.md`.
- `database` resolves the structured database fields defined by `RUNTIME_DIRECTORY_SPEC.md` and `DATABASE_SPEC.md`.
- Standalone server/container and cloud runtime targets should use structured PostgreSQL fields.
  `url` is a private explicit override, not the primary production contract.
- Desktop runtime targets may use SQLite with `file` under the
  SDKWork user private data directory.
- Desktop runtime config should resolve `database.engine` to `sqlite` and
  `database.file` to the user private data directory by default.
- Application root `dev:browser` and `dev:desktop` commands are development
  orchestration defaults. They should resolve `database.engine = "postgresql"`
  `serviceLayout = "unified-process"`, and `deploymentProfile = "standalone"`
  unless an explicit suffixed command selects SQLite, split-services, or cloud.
  This development service config is separate from the desktop-local SQLite
  config and must not change the installed desktop package default.
- Environment parsing for `database` must map
  `SDKWORK_<APP>_DATABASE_ENGINE` to `engine` and
  `SDKWORK_<APP>_DATABASE_SSL_MODE` to `sslMode`. New applications must reject
  `DATABASE_PROVIDER` and `DATABASE_SSLMODE` instead of treating them as
  aliases.
- Redis config is optional infrastructure config. The default is
  `enabled: false`; reusable modules must not assume Redis exists unless their
  bootstrap receives an enabled typed Redis config.
- Redis connections should prefer separate `host`, `port`, and `database`
  fields. `url` is an advanced override for managed Redis endpoints whose
  connection contract cannot be represented cleanly with separate fields.
- Redis password material should use `passwordFile` or a platform secret.
  Direct `password` is allowed only when the process environment or config file
  is protected as a secret-bearing source.

### 2.1 Runtime Target Authority

`SdkworkRuntimeTarget` is the canonical runtime-target vocabulary for SDKWork
application config, manifests, workflow targets, release evidence, topology
fixtures, and validation. Other specs may reference this list but must not
invent alternate deployment-mode values.

| Runtime target | Runtime family | Config owner | Secret/session owner | Package/release notes |
| --- | --- | --- | --- | --- |
| `browser` | web/H5 renderer | public runtime config and browser bootstrap | browser token storage adapter only; no private secrets | Web URL or static web package; may be `cloud` or documented standalone/offline package. |
| `desktop` | PC desktop host | desktop user config and native host config | OS secure storage or approved user-private secrets | Signed desktop installer or app bundle; defaults to standalone. |
| `tablet-ipados` | PC tablet host | PC renderer config plus iPadOS/Tauri host config | iPadOS secure storage or approved host adapter | IPA/TestFlight/App Store/private package for large-screen tablet behavior. |
| `tablet-android` | PC tablet host | PC renderer config plus Android/Tauri host config | Android secure storage or approved host adapter | APK/AAB/Play/private package for large-screen tablet behavior. |
| `capacitor-ios` | H5 mobile host | H5 browser config plus Capacitor iOS host config | iOS secure storage through Capacitor adapter | IPA/TestFlight/App Store/private package. |
| `capacitor-android` | H5 mobile host | H5 browser config plus Capacitor Android host config | Android secure storage through Capacitor adapter | APK/AAB/Play/private package. |
| `flutter-ios` | Flutter mobile host | Flutter app config plus iOS host config | Flutter secure storage adapter backed by iOS facilities | IPA/TestFlight/App Store/private package. |
| `flutter-android` | Flutter mobile host | Flutter app config plus Android host config | Flutter secure storage adapter backed by Android facilities | APK/AAB/Play/private package. |
| `android-native` | native Android app | Android app config plus Gradle/manifest host config | Android secure storage or approved platform adapter | APK/AAB/Play/private package. |
| `ios-native` | native iOS app | iOS app config plus Xcode/Swift package host config | iOS Keychain or approved platform adapter | IPA/TestFlight/App Store/private package. |
| `harmony-native` | native HarmonyOS app | Harmony app config plus hvigor/ohpm host config | Harmony secure storage or approved platform adapter | Harmony package or store/private distribution artifact. |
| `mini-program` | mini program host | mini program app config plus platform host config | platform session/storage adapter; no committed app secret | Platform upload/review/release package. |
| `server` | service process | server runtime config | process secret manager or protected config file | Archive, OS service, or cloud service artifact. |
| `container` | containerized service | mounted config, env, and platform secret manager | orchestrator secret manager or mounted secret files | OCI/Docker-compatible image, chart, manifest, or deployment bundle. |
| `test-runner` | automated test runtime | generated test config | ephemeral test credentials only | Test evidence only; not a production package target. |

Rules:

- Validators `MUST` reject `mobile`, `native`, `web`, `docker`, `server`,
  `desktop`, or `container` when they are used as deployment profiles. Only
  exact `SdkworkRuntimeTarget` values may describe runtime targets.
- Package profile values such as `mobile`, `tablet`, `desktop`, `server`, and
  `container` are artifact taxonomy labels. They do not replace
  `runtimeTarget`.
- Docker-compatible artifacts use `runtimeTarget = "container"`. The word
  `docker` may appear only in package format, tooling, provider, or operator
  documentation.
- H5 web and PC web both use `runtimeTarget = "browser"`. The app root and
  `runtime.framework` distinguish `react`, `react-h5`, and other browser
  architectures.

## 3. SDK Client Bootstrap

Bootstrap creates SDK clients:

```ts
const openApiBaseUrl = config.sdkBaseUrls?.openApiBaseUrl ?? config.openApiBaseUrl;

const openApiClient = openApiBaseUrl
  ? createOpenApiClient({
      baseUrl: openApiBaseUrl,
      apiKey: apiKeyProvider,
    })
  : undefined;

const appClient = createAppClient({
  baseUrl: config.sdkBaseUrls?.appApiBaseUrl ?? config.appApiBaseUrl,
  tokenManager,
});

const backendApiBaseUrl = config.sdkBaseUrls?.backendApiBaseUrl ?? config.backendApiBaseUrl;
const isBackendAdminRuntime = classifyRuntimeSurface(config) === "backend-admin";

const backendClient = isBackendAdminRuntime && backendApiBaseUrl
  ? createBackendClient({
      baseUrl: backendApiBaseUrl,
      tokenManager,
    })
  : undefined;
```

Rules:

- SDK client constructors may differ by generated SDK package.
- Service modules receive constructed clients, not constructor details.
- Runtime config selects SDK base URLs, dependency surfaces, and credential modes. It `MUST NOT` contain live tokens, raw API keys, or per-user session credential values.
- Runtime config `SHOULD` allow one browser-visible public SDK root, for example `PORTAL_PUBLIC_SDK_BASE_URL`, and derive standard open-api, app-api, and backend-api public runtime URLs from it. Applications `MAY` also expose per-surface or per-SDK public override keys such as `PORTAL_PUBLIC_OPEN_API_BASE_URL`, `PORTAL_PUBLIC_APP_API_BASE_URL`, `PORTAL_PUBLIC_BACKEND_API_BASE_URL`, or dependency-specific keys.
- Bootstrap `MUST` classify every SDK before constructing feature services: authenticated app-api, authenticated `backend-admin` backend-api, protected open-api API-key, protected open-api OAuth bearer, protected open-api flexible, public open-api, local/native, or test fake. The presence of `backendApiBaseUrl` alone is not permission to construct a backend SDK client.
- Token providers for app-api and backend-api SDKs `MUST` support both `Authorization: Bearer <auth_token>` and `Access-Token: <access_token>`.
- In an authenticated application session context, every app-api SDK client and every explicit `backend-admin` backend-api SDK client `MUST` receive credentials from the same global `TokenManager`. This includes appbase app SDKs, application/dependency app SDKs, explicit `backend-admin` appbase backend SDKs, application/dependency backend SDKs, and approved composed wrappers backed by those SDKs.
- Server service-context runtimes that do not represent a user login session `MUST` use one request/service credential provider per service context. They must not create per-domain or per-SDK credential providers for calls that share the same context.
- App-api and backend-api SDK clients `MUST NOT` receive `authToken`, `accessToken`, or `refreshToken` through environment variables, public runtime config, feature flags, app manifests, or per-call manual headers.
- `Access-Token` is the canonical access isolation header. Generated SDKs, runtime adapters, server guards, and tests must not introduce aliases such as `X-Access-Token`, `access_token` query parameters, or product-specific access headers.
- Bootstrap may expose `getAuthHeaders()` only for approved runtime bridges, local service calls, or tests. UI components and feature service facades must call SDK methods instead of assembling headers.
- Open-api credential providers for protected open-api SDKs `MUST` be separate from the app login token manager. API key and OAuth bearer secrets `MUST NOT` be stored in browser runtime env, app manifests, generated SDK docs, frontend bundles, logs, screenshots, or telemetry. Browser-facing open-api usage must be public, session-mediated, or backed by an approved short-lived credential flow.
- Dependency SDK base URLs `MUST` be configured explicitly when they do not inherit the application common SDK root or a product app's verified same-origin defaults. Dependency-owned SDKs must not be regenerated or hard-coded into product SDK base URLs.
- Dependency SDK base URLs may inherit the common `sdkBaseUrl` when that base URL is documented as a gateway/root that serves the dependency surface, or they may inherit a product same-origin app/backend default only when the
  application runtime declares `dependencyApiSurfaces` mount coverage for that dependency SDK
  family, surface, and prefix. A route contract or `sdkDependencies` entry alone is not enough.
- `dependencyApiSurfaces` entries with `runtimeMode: "same-origin"` `MUST` set
  `sameOriginAllowed: true`, name the executable router/controller/service export or equivalent
  runtime adapter, and record `coverage: "verified"` before SDK clients may inherit the product
  same-origin `appApiBaseUrl` or `backendApiBaseUrl`.
- When a shared Rust gateway provides the same-origin or embedded dependency surface,
  `dependencyApiSurfaces` `SHOULD` also name the Cargo feature and Cargo dependency that activate
  that executable integration. The feature/dependency evidence must resolve through Cargo metadata;
  a separate gateway catalog file is not accepted as the source of these facts.
- When a shared Rust gateway only proxies a split upstream dependency service, the dependency
  surface names the upstream/base-url config instead of Cargo feature/dependency evidence. Split
  proxy coverage proves gateway routing and upstream configuration; it does not prove same-process
  embedded router availability.
- A shared gateway split proxy surface `MUST NOT` be created from SDK family name alone. The
  existing SDK assembly, component spec, or runtime manifest must also prove a materialized route
  path set with a stable route prefix. Acceptable materialized evidence includes authority OpenAPI
  `paths`, derived `*.sdkgen.*` OpenAPI inputs, or normalized route manifests under
  `sdks/_route-manifests/<surface>/`. Generic-only roots and SDK assemblies with no paths are
  tracked as future integration candidates, not required runtime upstreams.
- A dependency SDK family may expose multiple stable route prefixes, for example a comments SDK
  owning both `/app/v3/api/comments` and `/app/v3/api/engagement`. Runtime config `MUST` declare
  each prefix as a separate dependency API surface while sharing the same service id and
  `requiredBaseUrlKey`, so route matching stays precise without broad fallback ownership.
- Product application runtime config that consumes a shared foundation gateway `SHOULD` use one
  common gateway root as the default dependency base URL source. Product-local server env such as a
  web gateway upstream must default to that common gateway root for foundation surfaces; direct
  dependency module URLs are per-surface overrides for explicit split deployments and must not be
  hidden as the default.
- A common dependency gateway root does not collapse application-owned SDK roots. Application-owned
  `openApiBaseUrl`, `appApiBaseUrl`, and `backendApiBaseUrl` may remain same-origin or otherwise
  application-owned while dependency SDK base URLs derive from the shared gateway root.
- Application-local runtime env `MUST NOT` materialize per-module foundation upstream defaults beside a
  configured shared gateway root. Appbase, Drive, commerce, search, voice, image, comments, course,
  messaging, or other foundation module URLs are explicit split overrides only.
- Launch/config tests for applications that consume a shared foundation gateway `MUST` prove dependency
  SDK defaults derive from the gateway root while application-owned app/backend/open SDK base URLs remain
  application-owned.
- When dependency API surfaces overlap by prefix, runtime config or the component spec `MUST`
  describe the route precedence that the gateway enforces. Specific dependency patterns and fixed
  IAM/provider routes resolve before broad fallback prefixes. Foundation prefixes such as Drive,
  Notary, RTC, Agent/Kernel, AIoT, Memory, Knowledgebase, News, Notes, Music, Generations,
  Community, Search, Voice, Image, Comments, Course, and Messaging must resolve before broad
  app/backend fallback surfaces. Broad split upstream surfaces
  may inherit a common SDK root only when tests prove they do not shadow more specific dependency
  surfaces.
- Same-origin dependency surface config `MUST` name only production-capable routers, controllers,
  service adapters, or upstreams as verified coverage. Demo routers, mock servers, fixture stores,
  hard-coded IAM tenants/users/organizations/API keys, or seed-only responses are valid only in
  explicitly marked tests and must not enable application same-origin SDK base URL inheritance.
- `dependencyApiSurfaces` entries with `runtimeMode: "external-service"` `MUST` set
  `sameOriginAllowed: false` and provide `requiredBaseUrlKey` or another deterministic pointer to
  `sdkBaseUrls.dependencySdkBaseUrls[<sdkFamily>]`.
- `dependencyApiSurfaces` entries with `runtimeMode: "not-mounted"` `MUST` set
  `sameOriginAllowed: false`; bootstrap must not construct a dependency SDK client for that surface
  unless a feature/config path explicitly changes the runtime mode.
- If `dependencyApiSurfaces` marks a dependency SDK surface as external-service, not-mounted, or
  unverified, SDK client bootstrap `MUST` require the dependency-specific base URL from
  `sdkBaseUrls.dependencySdkBaseUrls`, a common `sdkBaseUrl` that explicitly represents a gateway
  serving that dependency surface, or an equivalent env/runtime config key and must fail fast before
  constructing a client with the application-owned base URL.
- Runtime bootstrap `MUST` compare `dependencyApiExports` with `dependencyApiSurfaces`. Any export
  with `runtimeRequired: true` must have either verified same-origin coverage or a configured
  dependency-specific base URL before feature services are constructed.
- `backend-admin` dependency SDKs `MUST` not inherit a browser-visible application backend base URL unless
  the `backend-admin` UI is allowed to call that surface and runtime mount coverage proves every
  dependency-owned method/path is served at that same origin. They `MAY` use a common SDK root only
  when that root is explicitly configured as a gateway serving the dependency backend surface, not
  merely because the application-owned backend SDK has a default `/backend/v3/api` URL.
- For appbase backend-admin IAM, `PORTAL_PUBLIC_SDK_BASE_URL` may derive
  `PORTAL_PUBLIC_APPBASE_BACKEND_API_BASE_URL` only when it is a gateway that serves
  `/backend/v3/api/iam/*`. An application backend default such as
  `PORTAL_PUBLIC_BACKEND_API_BASE_URL` or `VITE_CLAWROUTER_BACKEND_API_BASE_URL` may be used for
  `@sdkwork/appbase-backend-sdk` only when `dependencyApiSurfaces` records verified same-origin
  mount coverage for a production-capable appbase backend IAM router/controller/service adapter.
  Appbase app SDK configuration, route metadata, local/demo routers, and fake response handlers are
  not evidence for appbase backend IAM availability.
- Token refresh behavior `MUST` be centralized so modules do not implement competing refresh flows.
- Test mode may use fake SDK clients or mock servers with the same resource surface.

## 4. Environment Names And Files

Standard environments:

```text
development
test
staging
production
```

Standard profile aliases and file suffixes:

| Profile alias | Canonical environment | Allowed file suffixes | Typical use |
| --- | --- | --- | --- |
| `dev` | `development` | `.dev`, `.development` | Local development, dev services, desktop dev shell |
| `test` | `test` | `.test` | Automated tests, isolated test databases, CI smoke runs |
| `staging` | `staging` | `.staging` | Production-like rehearsal, release verification |
| `prod` | `production` | `.prod`, `.production` | Production release/runtime |

Recommended checked-in templates:

```text
.env.example
.env.development.example
.env.test.example
.env.staging.example
.env.production.example
.env.postgres.example
config/<app>.toml.example
config/<app>.development.toml.example
config/<app>.test.toml.example
config/<app>.staging.toml.example
config/<app>.production.toml.example
```

Recommended host-local ignored overrides:

```text
.env.local
.env.development.local
.env.test.local
.env.staging.local
.env.production.local
.env.postgres
.env.release.local
config/*.local.toml
```

PC/browser/desktop application roots should keep deployment-target templates grouped when the app has more than one runtime target:

```text
config/
  browser/
    runtime-env.development.example.json
    runtime-env.test.example.json
    runtime-env.staging.example.json
    runtime-env.production.example.json
  desktop/
    <app>.development.toml.example
    <app>.test.toml.example
    <app>.staging.toml.example
    <app>.production.toml.example
  server/
    <app>.development.toml.example
    <app>.test.toml.example
    <app>.staging.toml.example
    <app>.production.toml.example
  container/
    <app>.development.toml.example
    <app>.test.toml.example
    <app>.staging.toml.example
    <app>.production.toml.example
  tauri/
    tauri.conf.json
    tauri.windows.conf.json
    tauri.macos.conf.json
    tauri.linux.conf.json
    tauri.ios.conf.json
    tauri.android.conf.json
```

H5/Capacitor, Flutter, mini program, native Android, native iOS, and native Harmony roots use the equivalent grouped layout defined by their root architecture standards. Browser-based H5 roots use `config/browser/`; Flutter and native mobile roots use `config/app/`; mini program roots use `config/mini-program/`; all mobile roots keep platform metadata in `config/host/` and server/container templates outside public app config.

Java/Spring server packages may additionally provide checked-in examples such as
`application-dev.yml.example`, `application-test.yml.example`, and
`application-prod.yml.example`. Rust server packages should prefer TOML runtime
config. The profile names are an integration convenience; SDKWork code still
normalizes them into `SdkworkEnvironment`.

Rules:

- The runtime must validate the declared `environment`; it must not infer production safety from a file name alone.
- `dev` and `prod` are file/profile aliases only. Persisted runtime config should use `development` and `production`.
- `development`, `test`, `staging`, and `production` templates may be checked in only as examples with safe placeholders.
- `.env.local` and developer machine config must not be required for CI.
- Vite `.env`, `.env.local`, `.env.[mode]`, and `.env.[mode].local` files are build/dev-server inputs. Only `VITE_` values are exposed to browser code, and `VITE_*` must contain only public non-secret values.
- Browser deploy-time SDK URLs should be served through `/runtime-env.js` or an equivalent public runtime config document instead of being frozen into a hashed bundle when the same build artifact is promoted across environments.
- Server production config must come from process env, an administrator-managed runtime config file, deployment infrastructure, or a secret manager, not from a committed `.env.production`.
- Test config must isolate database names or schemas, Redis key prefixes, log directories, cache directories, and temp directories from development and production.
- Desktop installed runtime config must live in the SDKWork user private config directory and default to SQLite user data. Desktop/Tauri development service config is a separate server config profile and defaults to PostgreSQL.
- Tauri platform config files may own bundle identifiers, icons, permissions, capabilities, window metadata, mobile/tablet target metadata, and signing references. They must not contain secrets, business API route contracts, or SDK ownership decisions.
- Native Android, iOS, and Harmony host config files may own application ids, bundle ids, module ids, icons, permissions, capabilities, app links/universal links/wants, push profiles, store profiles, signing reference names, and OS version requirements. They must not contain signing private keys, tokens, business API route contracts, or SDK ownership decisions.
- `.env.postgres.example` is the checked-in local PostgreSQL template for apps
  that support PostgreSQL development. It must use split fields such as
  `SDKWORK_<APP>_DATABASE_ENGINE=postgresql` and
  `SDKWORK_<APP>_DATABASE_SSL_MODE=disable`, plus `DATABASE_ADMIN_*` split
  fields when database initialization needs an admin connection.
- `.env.postgres` is a host-local developer override and must be excluded from
  source control.
- Production config must come from deployment infrastructure or secret manager.
- Config keys `SHOULD` be namespaced by capability, such as `SDKWORK_IAM_*`.
- Unknown config keys in machine-readable manifests `SHOULD` fail validation to prevent drift.
- Locale and i18n runtime config keys should stay small and declarative: default locale, supported locales, fallback locale, and catalog manifest URL. Translation catalogs follow `I18N_SPEC.md` package-local fragment ownership and must not be embedded in runtime config, feature flags, app manifests, or environment files.

## 5. Feature Flags

Rules:

- Feature flags `SHOULD` be capability-scoped and typed.
- Security, tenant isolation, and permission enforcement `MUST NOT` depend only on frontend feature flags.
- Feature flags that affect API or database semantics `MUST` be documented in the relevant spec or module README.
- Long-lived flags `SHOULD` have an owner and removal condition.

## 6. Secret Handling

Rules:

- Secrets, tokens, private keys, refresh tokens, verification codes, and API keys `MUST NOT` appear in app manifests, generated SDK docs, frontend bundles, logs, telemetry attributes, or screenshots.
- Desktop apps `SHOULD` store tokens in OS secure storage through a host adapter.
- Browser apps `SHOULD` prefer secure, httpOnly server-managed cookies when the architecture supports them; otherwise token storage risks must be documented.
- Local development secrets must be excluded from source control.

## 7. Acceptance Checklist

- [ ] Runtime config is typed.
- [ ] Shared modules do not read env/global config directly.
- [ ] Lifecycle environment, profile alias, deployment profile, build mode, and runtime target are normalized separately.
- [ ] Dev/test/staging/prod example files are checked in only as safe templates, and local overrides are ignored.
- [ ] Browser public runtime config, desktop user config, H5/Capacitor config, Flutter config, mini program config, native Android config, native iOS config, native Harmony config, server config, container config, and Tauri platform config are separated.
- [ ] Database env parsing maps `SDKWORK_<APP>_DATABASE_ENGINE` and `SDKWORK_<APP>_DATABASE_SSL_MODE` to typed config and rejects `DATABASE_PROVIDER`/`DATABASE_SSLMODE`.
- [ ] Apps with PostgreSQL development support provide `.env.postgres.example` and ignore `.env.postgres`.
- [ ] SDK clients are constructed in bootstrap from one common SDK base URL plus per-surface/per-SDK overrides, with separate effective open-api, app-api, and `backend-admin` backend-api URLs where those surfaces are consumed.
- [ ] SDK inventory classifies every consumed SDK as authenticated app-api, authenticated `backend-admin` backend-api, protected open-api API-key, protected open-api OAuth bearer, protected open-api flexible, public open-api, local/native, or test fake before services are constructed.
- [ ] Appbase app SDKs, application/dependency app SDKs, explicit `backend-admin` appbase backend SDKs, application/dependency backend SDKs, and approved composed wrappers in the same authenticated application session receive the same global `TokenManager`; server service-context runtimes use one request/service credential provider per service context.
- [ ] Protected open-api SDKs receive credentials through a separate open-api credential provider matching their declared auth mode and are not placed in login TokenManager client lists.
- [ ] Runtime config contains SDK base URL values and token-manager behavior, but does not contain actual auth/access/refresh tokens or raw API keys.
- [ ] Runtime config contains only i18n locale strategy and catalog manifest references, not translated message content or monolithic locale bundles.
- [ ] Dependency SDK base URLs are keyed by SDK family id and are injected during bootstrap instead of hard-coded in services.
- [ ] `dependencyApiExports` is explicit and defaults to `[]`; dependency API exports with
  `runtimeRequired: true` have verified same-origin `dependencyApiSurfaces` coverage or explicit
  dependency SDK base URL config before feature services are constructed.
- [ ] Same-origin dependency API surfaces name an executable router/controller/service export and
  have verified coverage before dependency SDK clients inherit application app/backend base URLs.
- [ ] Rust gateway dependency API surfaces, when used, name Cargo feature/dependency evidence that
  resolves through Cargo metadata instead of a separate gateway catalog.
- [ ] Application runtime defaults route shared foundation API upstreams through the declared gateway
  common SDK root or managed gateway process; direct dependency module URLs are explicit overrides.
- [ ] Deployment profile and environment are explicit.
- [ ] Desktop installed config defaults to user-private SQLite, while desktop-started backend service config uses the server PostgreSQL dev profile unless an explicit SQLite profile is selected.
- [ ] Test config isolates database/schema, Redis key prefix, logs, cache, and temp directories from development and production.
- [ ] Secrets are isolated from manifests and committed files.
- [ ] Feature flags are scoped and documented.
