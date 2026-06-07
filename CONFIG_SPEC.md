# Configuration And Environment Standard

- Version: 1.0
- Scope: environment config, SDK client initialization, secrets, feature flags, typed runtime config, dev/test/staging/prod profiles, desktop/server/container/web/H5/Flutter/mini-program/native Android/native iOS/native Harmony switching
- Related: `RUNTIME_DIRECTORY_SPEC.md`, `ENVIRONMENT_SPEC.md`, `DEPENDENCY_MANAGEMENT_SPEC.md`, `DEPLOYMENT_SPEC.md`, `SDK_SPEC.md`, `SECURITY_SPEC.md`, `APPLICATION_SPEC.md`, `APP_MANIFEST_SPEC.md`, `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md`, `APP_PC_ARCHITECTURE_SPEC.md`, `H5_APP_MOBILE_ARCHITECTURE_SPEC.md`, `FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC.md`, `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md`, `ANDROID_APP_MOBILE_ARCHITECTURE_SPEC.md`, `IOS_APP_MOBILE_ARCHITECTURE_SPEC.md`, `HARMONY_APP_MOBILE_ARCHITECTURE_SPEC.md`, `DESKTOP_APP_ARCHITECTURE_SPEC.md`, `I18N_SPEC.md`

This standard defines how applications select environment, deployment mode, base URLs, SDK clients, token storage, and feature flags without leaking those decisions into reusable modules.

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
- SaaS/private/local differences `MUST` be represented as typed deployment mode, not scattered conditionals.
- Lifecycle environment, deployment mode, and runtime target `MUST` be represented as separate typed fields. A single `NODE_ENV`, Vite mode, Spring profile, or Tauri target must not be used as the whole runtime decision model.
- Source/build dependency paths in package, workspace, SDK, or tool config `MUST` follow `DEPENDENCY_MANAGEMENT_SPEC.md` and must not use machine-specific absolute paths.

## 2. Standard Runtime Config

```ts
export type SdkworkEnvironment = "development" | "test" | "staging" | "production";
export type SdkworkConfigProfile = "dev" | "test" | "staging" | "prod";
export type SdkworkBuildMode = "development" | "test" | "staging" | "production";
export type SdkworkDeploymentMode =
  | "web"
  | "h5"
  | "h5-weixin"
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
  | "mp-weixin"
  | "mp-alipay"
  | "mp-baidu"
  | "mp-toutiao"
  | "mp-lark"
  | "mp-qq"
  | "mp-kuaishou"
  | "mp-jd"
  | "mp-360"
  | "mp-dingtalk"
  | "mp-ali"
  | "server"
  | "container"
  | "saas"
  | "private"
  | "local"
  | "test";
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
  deploymentMode: SdkworkDeploymentMode;
  runtimeTarget: SdkworkRuntimeTarget;
  openApiBaseUrl?: string;
  appApiBaseUrl: string;
  backendApiBaseUrl?: string;
  sdkBaseUrls?: SdkworkSdkBaseUrlConfig;
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
  tenantId?: string;
  organizationId?: string;
  featureFlags?: Record<string, boolean | string | number>;
}

export interface SdkworkSdkBaseUrlConfig {
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
- `deploymentMode` describes deployment topology or packaging shape.
- `runtimeTarget` describes where this config is consumed: browser renderer, desktop host, tablet host, Capacitor host, Flutter host, mini program runtime, server process, container process, or test runner.
- `openApiBaseUrl`, `appApiBaseUrl`, and `backendApiBaseUrl` are selected before SDK clients are created.
- `openApiBaseUrl` is optional because not every application consumes an open-api SDK. When present for a SDKWork-owned business open-api, it `MUST` use that domain's approved non-app/non-backend prefix from `API_SPEC.md`, for example `/im/v3/api`. It does not require a literal `/open` path segment. `/v1` is valid only for explicitly documented compatibility APIs such as OpenAI-compatible AI API.
- `sdkBaseUrls` is the canonical per-SDK-surface base URL map for bootstrap. Top-level `openApiBaseUrl`, `appApiBaseUrl`, and `backendApiBaseUrl` remain convenience aliases and must resolve to the same effective values.
- `sdkBaseUrls.dependencySdkBaseUrls` owns base URLs for dependency SDK families such as appbase, Drive, IM, or another product app. It must be keyed by stable SDK family id, not by ad hoc host names.
- `auth` config describes how the runtime obtains and stores credentials. It must not contain actual `authToken`, `accessToken`, `refreshToken`, API key values, or session DTOs.
- `i18n` config describes locale selection, supported locale list, fallback locale, and catalog loading strategy only. It must not contain translated message content, product copy, validation copy, or generated catalog bundles.
- `tenantId` and `organizationId` in config are defaults only; token context is authoritative after authentication.
- Config objects crossing host/native boundaries `SHOULD` be serializable.
- `publicRuntime` is browser-visible and may contain only non-secret values. Browser bundles must not read private process config.
- `server` owns process bind, public URL, reverse-proxy trust, and service profile config. It must not own renderer-only build settings.
- `desktop` owns native host, user config, local service lifecycle, and secure storage provider. It must not own remote business API contracts.
- `tablet` owns iPadOS/Android tablet package identity and platform config references. It must not own phone-first H5 behavior or business SDK bypasses.
- `mobile` owns H5/Capacitor/Flutter/native Android/native iOS/native Harmony mobile package identity, platform config references, secure storage provider selection, and mobile host metadata. It must not own SDK package ownership, business route constants, auth tokens, refresh tokens, signing keys, or business authorization.
- `miniProgram` owns mini program platform identity, app id references, platform config file references, and page/subpackage strategy. It must not own platform private keys, business API contracts, generated SDK ownership, or feature-local auth behavior.
- `paths` resolves the canonical directories defined by `RUNTIME_DIRECTORY_SPEC.md`.
- `database` resolves the structured database fields defined by `RUNTIME_DIRECTORY_SPEC.md` and `DATABASE_SPEC.md`.
- Server and container deployments should use structured PostgreSQL fields.
  `url` is a private explicit override, not the primary production contract.
- Desktop and local-only deployments may use SQLite with `file` under the
  SDKWork user private data directory.
- Desktop runtime config should resolve `database.engine` to `sqlite` and
  `database.file` to the user private data directory by default.
- Desktop/Tauri development commands that start backend services should resolve
  the service database through the PostgreSQL dev profile. That service config
  is separate from the desktop-local SQLite config and must not change the
  installed desktop package default.
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

const backendClient = backendApiBaseUrl
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
- Bootstrap `MUST` classify every SDK before constructing feature services: authenticated app-api, authenticated backend-api, protected open-api API-key, public open-api, local/native, or test fake.
- Token providers for app-api and backend-api SDKs `MUST` support both `Authorization: Bearer <auth_token>` and `Access-Token: <access_token>`.
- In an authenticated application session context, every app-api and backend-api SDK client `MUST` receive credentials from the same global `TokenManager`. This includes appbase app/backend SDKs, product app/backend SDKs, dependency app/backend SDKs, and approved composed wrappers backed by those SDKs.
- Server service-context runtimes that do not represent a user login session `MUST` use one request/service credential provider per service context. They must not create per-domain or per-SDK credential providers for calls that share the same context.
- App-api and backend-api SDK clients `MUST NOT` receive `authToken`, `accessToken`, or `refreshToken` through environment variables, public runtime config, feature flags, app manifests, or per-call manual headers.
- `Access-Token` is the canonical access isolation header. Generated SDKs, runtime adapters, server guards, and tests must not introduce aliases such as `X-Access-Token`, `access_token` query parameters, or product-specific access headers.
- Bootstrap may expose `getAuthHeaders()` only for approved runtime bridges, local service calls, or tests. UI components and feature service facades must call SDK methods instead of assembling headers.
- API key providers for protected open-api SDKs `MUST` be separate from the app login token manager. Raw API key values `MUST NOT` be stored in browser runtime env, app manifests, generated SDK docs, frontend bundles, logs, screenshots, or telemetry. Browser-facing open-api usage must be public, session-mediated, or backed by an approved short-lived credential flow.
- Dependency SDK base URLs `MUST` be configured explicitly when they do not inherit the product app's same-origin defaults. Dependency-owned SDKs must not be regenerated or hard-coded into product SDK base URLs.
- Dependency SDK base URLs may inherit a product same-origin app/backend default only when the
  application runtime declares `dependencyApiSurfaces` mount coverage for that dependency SDK
  family, surface, and prefix. A route contract or `sdkDependencies` entry alone is not enough.
- If `dependencyApiSurfaces` marks a dependency SDK surface as external-service, not-mounted, or
  unverified, SDK client bootstrap `MUST` require the dependency-specific base URL from
  `sdkBaseUrls.dependencySdkBaseUrls` or an equivalent env/runtime config key and must fail fast
  before constructing a client with the product-owned base URL.
- Backend/admin dependency SDKs `MUST` not inherit a browser-visible product backend base URL unless
  the backend/admin UI is allowed to call that surface and runtime mount coverage proves every
  dependency-owned method/path is served at that same origin.
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
- [ ] Lifecycle environment, profile alias, deployment mode, build mode, and runtime target are normalized separately.
- [ ] Dev/test/staging/prod example files are checked in only as safe templates, and local overrides are ignored.
- [ ] Browser public runtime config, desktop user config, H5/Capacitor config, Flutter config, mini program config, native Android config, native iOS config, native Harmony config, server config, container config, and Tauri platform config are separated.
- [ ] Database env parsing maps `SDKWORK_<APP>_DATABASE_ENGINE` and `SDKWORK_<APP>_DATABASE_SSL_MODE` to typed config and rejects `DATABASE_PROVIDER`/`DATABASE_SSLMODE`.
- [ ] Apps with PostgreSQL development support provide `.env.postgres.example` and ignore `.env.postgres`.
- [ ] SDK clients are constructed in bootstrap with separate open-api, app-api, and backend-api base URLs where those surfaces are consumed.
- [ ] SDK inventory classifies every consumed SDK as authenticated app-api, authenticated backend-api, protected open-api API-key, public open-api, local/native, or test fake before services are constructed.
- [ ] Appbase app/backend SDKs, product app/backend SDKs, dependency app/backend SDKs, and approved composed wrappers in the same authenticated application session receive the same global `TokenManager`; server service-context runtimes use one request/service credential provider per service context.
- [ ] Protected open-api SDKs receive API key credentials through a separate provider and are not placed in login TokenManager client lists.
- [ ] Runtime config contains SDK base URL values and token-manager behavior, but does not contain actual auth/access/refresh tokens or raw API keys.
- [ ] Runtime config contains only i18n locale strategy and catalog manifest references, not translated message content or monolithic locale bundles.
- [ ] Dependency SDK base URLs are keyed by SDK family id and are injected during bootstrap instead of hard-coded in services.
- [ ] Deployment mode and environment are explicit.
- [ ] Desktop installed config defaults to user-private SQLite, while desktop-started backend service config uses the server PostgreSQL dev profile unless an explicit SQLite profile is selected.
- [ ] Test config isolates database/schema, Redis key prefix, logs, cache, and temp directories from development and production.
- [ ] Secrets are isolated from manifests and committed files.
- [ ] Feature flags are scoped and documented.
