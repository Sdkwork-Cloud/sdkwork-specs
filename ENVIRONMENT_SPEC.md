# Environment Variable And Runtime Configuration Standard

- Version: 1.0
- Scope: environment variables, runtime config files, public browser runtime config, secrets, database selection, standalone/cloud deployment profiles, desktop/server/container/H5/Flutter/mini-program/native Android/native iOS/native Harmony runtime targets, SDK base URLs, locale strategy, Access-Token and TokenManager credential config rules, RPC endpoints
- Related: `CONFIG_SPEC.md`, `RUNTIME_DIRECTORY_SPEC.md`, `DEPLOYMENT_SPEC.md`, `DATABASE_SPEC.md`, `DATABASE_FRAMEWORK_SPEC.md`, `SECURITY_SPEC.md`, `SDK_SPEC.md`, `RPC_SPEC.md`, `RPC_FRAMEWORK_SPEC.md`, `DISCOVERY_SPEC.md`, `RUST_RPC_SPEC.md`, `APPLICATION_SPEC.md`, `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md`, `APP_H5_ARCHITECTURE_SPEC.md`, `FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC.md`, `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md`, `ANDROID_APP_MOBILE_ARCHITECTURE_SPEC.md`, `IOS_APP_MOBILE_ARCHITECTURE_SPEC.md`, `HARMONY_APP_MOBILE_ARCHITECTURE_SPEC.md`, `I18N_SPEC.md`, `TEST_SPEC.md`

This standard defines the canonical environment and runtime configuration model for SDKWork applications. It exists to prevent each application from inventing different `.env` names, database defaults, SDK base URL rules, config file locations, and secret handling behavior.

`CONFIG_SPEC.md` defines the typed runtime config contract inside application code. This document defines the external operating contract: environment variables, config files, deployment-profile defaults, runtime-target defaults, and validation rules.

## 1. Design Goals

Environment configuration must satisfy these goals:

- One application can run in development, test, staging, and production without code changes.
- `dev`, `test`, `staging`, and `prod` file profiles can be used by scripts while application runtime normalizes them to `development`, `test`, `staging`, and `production`.
- One product can support `standalone` and `cloud` deployment profiles with
  explicit browser, H5, desktop, tablet, Capacitor, Flutter, native mobile,
  mini program, service/server, container, and test-runner runtime targets.
- Browser renderer, H5 mobile renderer, desktop native host, tablet native host, Capacitor host, Flutter host, mini program runtime, native Android host, native iOS host, native Harmony host, server process, container process, and test runner config are separated.
- Server-side release deployments use PostgreSQL by default.
- Desktop installs use SQLite by default in the SDKWork user private data directory defined by `RUNTIME_DIRECTORY_SPEC.md`.
- Desktop/Tauri development commands that start backend services use the server PostgreSQL development profile by default; SQLite is used only by explicit local-data profiles or installed desktop runtime config.
- Every database setting can be specified in a runtime config file and overridden by environment variables for emergency operations.
- Browser-visible values are separated from private process values.
- SDK bootstrap starts from one common SDK root by default, derives explicit open-api, app-api, and backend-api base URLs from that root, and supports per-surface or per-SDK overrides for split deployments.
- Secrets are never committed, never served through browser runtime config, and never logged in plaintext.

## 2. Terms

| Term | Meaning |
| --- | --- |
| Environment | Lifecycle stage: `development`, `test`, `staging`, or `production`. |
| Environment profile alias | Short file/script profile: `dev`, `test`, `staging`, or `prod`. `dev` maps to `development`; `prod` maps to `production`. |
| Deployment profile | Application deployment architecture: `standalone` or `cloud`. |
| Runtime target | Code execution target: `browser`, `desktop`, `tablet-ipados`, `tablet-android`, `capacitor-ios`, `capacitor-android`, `flutter-ios`, `flutter-android`, `android-native`, `ios-native`, `harmony-native`, `mini-program`, `server`, `container`, or `test-runner`. |
| Build mode | Build tool mode such as Vite mode, Tauri build target, or Spring profile alias. It is not sufficient as the full runtime environment model. |
| Process env | Environment variables available to a service process. |
| Runtime config file | Host-local TOML/YAML/JSON config file loaded at startup. TOML is preferred for SDKWork Rust services. |
| Public runtime env | Browser-visible values served through a controlled endpoint such as `/runtime-env.js`. |
| Secret | Password, token, signing key, webhook secret, API key, private connection string, or credential material. |
| SDK surface | Generated SDK family or API surface, such as SDKWork open-api, app-api, backend-api, or an explicitly documented compatibility API such as OpenAI-compatible AI API. |

## 3. Source Precedence

Configuration sources must be resolved by runtime target.

Server and container processes resolve private configuration in this order:

1. Built-in safe defaults for local development, tests, and desktop-only non-secret settings.
2. Runtime config file from the canonical runtime directory or explicit config path.
3. Process environment variables.
4. Command-line arguments for one-shot local development or test commands.
5. Secret manager or OS secure storage for secrets when the deployment platform provides one.

Browser renderers resolve public configuration in this order:

1. Build-time public defaults for development only.
2. Public runtime config document such as `/runtime-env.js` or `/runtime-env.json`.
3. Server-rendered public config values derived from validated private config.
4. Generated SDK client bootstrap validation.

Desktop and tablet native hosts resolve local configuration in this order:

1. Built-in safe desktop/tablet defaults.
2. SDKWork user-private runtime config file from `RUNTIME_DIRECTORY_SPEC.md`.
3. Process env or command-line overrides for development and diagnostics.
4. OS secure storage for tokens and secrets.
5. Platform config such as Tauri `tauri.*.conf.json` for packaging metadata only.

Rules:

- Process env overrides config file values.
- Command-line arguments may override process env only for local development and test tooling, not production service managers.
- Public browser runtime env must be generated from validated process or config-file values by the trusted server.
- Browser renderer code must never read server process env, host-local TOML, platform secret files, or desktop secure storage directly.
- Tauri/native platform config is packaging config, not runtime business config. It may be merged by target platform, but it must not define secrets or API contract ownership.
- Shared modules must not read process env directly. Bootstrap code reads env and constructs typed runtime config.
- Unknown keys in strict release config should fail validation unless explicitly marked as extension keys.

## 4. Naming Standard

Environment variable names must follow this format:

```text
<PLATFORM_OR_APPLICATION_CODE>_<DOMAIN_OR_CAPABILITY>_<SETTING>
```

For SDKWork application private runtime values:

```text
SDKWORK_<APPLICATION_CODE>_<SETTING>
```

Legacy application-specific prefixes such as `SDKWORK_CLAW_*` may remain only during a documented migration window.

For browser-public portal values:

```text
PORTAL_PUBLIC_<SURFACE>_<SETTING>
```

For Vite/browser-internal runtime values:

```text
VITE_<APP_CODE>_<SURFACE>_<SETTING>
```

Rules:

- Use uppercase snake case.
- Use one application-code prefix per application family.
- Use capability names that match `DOMAIN_SPEC.md` and `SDK_SPEC.md`.
- Use `SDK_BASE_URL` only for the common SDK root that can derive multiple SDK surfaces. Do not use generic names such as `GATEWAY_API_BASE_URL` when the consuming SDK surface is more specific. Prefer `OPEN_API_BASE_URL`, `APP_API_BASE_URL`, or `BACKEND_API_BASE_URL` for resolved surface overrides.
- Dependency SDK base URL override variables must include a stable dependency SDK family or dependency app code segment, for example `SDKWORK_<APPLICATION_CODE>_APPBASE_APP_API_BASE_URL`, `SDKWORK_<APPLICATION_CODE>_DRIVE_APP_API_BASE_URL`, or `PORTAL_PUBLIC_IM_OPEN_API_BASE_URL`.
- Do not put secrets in names prefixed with `PORTAL_PUBLIC_`, `VITE_`, `PUBLIC_`, `NEXT_PUBLIC_`, or any variable that is exposed to browser code.
- `SDKWORK_ACCESS_TOKEN` is the unified private bootstrap access credential for every application root. It `MUST` appear in checked-in private env templates such as `.env.example` when the application calls protected app-api or backend-api surfaces. It `MUST NOT` use an app-prefixed name such as `SDKWORK_<APPLICATION_CODE>_ACCESS_TOKEN`. It `MUST NOT` be exposed through `VITE_*`, `PORTAL_PUBLIC_*`, or other browser-visible runtime config.
- `SDKWORK_AUTH_TOKEN`, `SDKWORK_REFRESH_TOKEN`, `SDKWORK_API_KEY`, app-prefixed credential env names, and `VITE_*_TOKEN` remain forbidden as live credential inputs. `auth_token`, `refresh_token`, and API keys `MUST` come from login, refresh, or approved runtime credential providers—not environment variables.
- After appbase login, registration, refresh, or current-session bootstrap succeeds, runtime session tokens from the global TokenManager `MUST` supersede env bootstrap credentials for outbound protected SDK calls. Env bootstrap credentials `MUST NOT` be merged with or override authenticated session tokens.
- Boolean variables must accept only `true`, `false`, `1`, or `0` after normalization.
- URL variables must reject query strings, fragments, control characters, protocol-relative URLs, and non-HTTP schemes unless the specific setting is documented as a database URL.

## 5. Standard Environment Variables

These variables form the baseline for SDKWork applications.

| Variable | Visibility | Required | Description |
| --- | --- | --- | --- |
| `SDKWORK_<APPLICATION_CODE>_ENVIRONMENT` | private | SHOULD | Lifecycle stage: `development`, `test`, `staging`, `production`. |
| `SDKWORK_<APPLICATION_CODE>_CONFIG_PROFILE` | private | SHOULD | File/script profile alias: `dev`, `test`, `staging`, `prod`. Startup must normalize it to `SDKWORK_<APPLICATION_CODE>_ENVIRONMENT`. |
| `SDKWORK_<APPLICATION_CODE>_DEPLOYMENT_PROFILE` | private | SHOULD | Application deployment architecture: `standalone` or `cloud`. |
| `SDKWORK_<APPLICATION_CODE>_RUNTIME_TARGET` | private | SHOULD | Execution target: `browser`, `desktop`, `tablet-ipados`, `tablet-android`, `capacitor-ios`, `capacitor-android`, `flutter-ios`, `flutter-android`, `android-native`, `ios-native`, `harmony-native`, `mini-program`, `server`, `container`, `test-runner`. |
| `SDKWORK_<APPLICATION_CODE>_BUILD_MODE` | private/public by tool | MAY | Build tool mode. It must not replace `ENVIRONMENT`, `DEPLOYMENT_PROFILE`, or `RUNTIME_TARGET`. |
| `SDKWORK_<APPLICATION_CODE>_CONFIG_FILE` | private | MAY | Explicit runtime config file path. |
| `SDKWORK_<APPLICATION_CODE>_SERVER_CONFIG_FILE` | private | MAY | Explicit server process config file path when a PC/desktop root also owns server profiles. Defaults to `CONFIG_FILE` when absent. |
| `SDKWORK_<APPLICATION_CODE>_DESKTOP_CONFIG_FILE` | private | MAY | Explicit desktop/tablet user config file path. Defaults to the user-private SDKWork config path when absent. |
| `SDKWORK_<APPLICATION_CODE>_SDK_BASE_URL` | private | SHOULD when multiple SDK surfaces share one gateway | Common SDK root used to derive SDKWork open-api, app-api, backend-api, and documented dependency SDK base URLs. It must be a deployment root, not a resolved surface URL such as `/v1` or `/backend/v3/api`. |
| `SDKWORK_<APPLICATION_CODE>_API_BASE_URL` | private | MAY | Generic same-origin or service-side default API base URL. Prefer surface-specific variables for SDK client construction. |
| `SDKWORK_<APPLICATION_CODE>_OPEN_API_BASE_URL` | private | MAY | Server/runtime SDKWork open-api or documented compatibility API base URL. Business open-api paths need not include `/open`; they are any approved non-app/non-backend prefix. |
| `SDKWORK_<APPLICATION_CODE>_APP_API_BASE_URL` | private | SHOULD when app SDK is consumed | Server/runtime app-api SDK base URL, normally ending in `/app/v3/api` for SDKWork v3 app-api. |
| `SDKWORK_<APPLICATION_CODE>_BACKEND_API_BASE_URL` | private | SHOULD when backend SDK is consumed | Server/runtime backend-api SDK base URL, normally ending in `/backend/v3/api` for SDKWork v3 backend-api. |
| `SDKWORK_<APPLICATION_CODE>_<DEPENDENCY>_OPEN_API_BASE_URL` | private | MAY | Dependency open-api SDK base URL keyed by dependency SDK family/app code. |
| `SDKWORK_<APPLICATION_CODE>_<DEPENDENCY>_APP_API_BASE_URL` | private | MAY | Dependency app-api SDK base URL keyed by dependency SDK family/app code, for example appbase or Drive. |
| `SDKWORK_<APPLICATION_CODE>_<DEPENDENCY>_BACKEND_API_BASE_URL` | private | MAY | Dependency backend-api SDK base URL keyed by dependency SDK family/app code. |
| `SDKWORK_<APPLICATION_CODE>_TOKEN_MANAGER_MODE` | private | MAY | Credential strategy: `appbase-global`, `service-context`, or `test`. It configures behavior only; it must not contain token values. |
| `SDKWORK_<APPLICATION_CODE>_TOKEN_STORAGE` | private | MAY | Token storage strategy: `memory`, `browser-session`, `browser-local`, `os-secure-storage`, or `server-context`. Browser strategies must pass security review. |
| `SDKWORK_ACCESS_TOKEN` | secret | SHOULD when protected app-api/backend-api is called before interactive login | Unified private bootstrap `access_token` used to seed the global TokenManager or service-context credential provider for SaaS deployment tenant isolation. It `MUST` be a signed SDKWork access token whose claims carry current `tenant_id`, `organization_id`, `app_id`, environment, deployment profile, runtime target, and scope metadata. It `MUST NOT` use an app-prefixed env name. It `MUST NOT` be exposed to browser public runtime config. After login/session bootstrap, runtime session `accessToken` replaces this value. |
| `SDKWORK_ACCESS_TOKEN_HEADER` | private | MAY | Must be `Access-Token` for SDKWork v3 app-api/backend-api. Present only for compatibility validation, not customization. |
| `SDKWORK_AUTH_TOKEN_HEADER` | private | MAY | Must be `Authorization` for SDKWork v3 bearer auth. Present only for compatibility validation, not customization. |
| `SDKWORK_<APPLICATION_CODE>_DEFAULT_LOCALE` | private/public | MAY | Default BCP 47 locale such as `en-US` or `zh-CN`. This configures selection only; translated messages stay in i18n catalog fragments. |
| `SDKWORK_<APPLICATION_CODE>_SUPPORTED_LOCALES` | private/public | MAY | Comma-separated supported locale list. It must not contain translated message content. |
| `SDKWORK_<APPLICATION_CODE>_FALLBACK_LOCALE` | private/public | MAY | Explicit fallback locale, normally `en-US` for first-party SDKWork apps unless a product spec narrows it. |
| `SDKWORK_<APPLICATION_CODE>_I18N_CATALOG_MANIFEST_URL` | private/public | MAY | URL or path to a generated **message-catalog** manifest. The manifest points to package-local fragments or generated bundles and must not be an authored monolithic locale file. |
| `SDKWORK_<APPLICATION_CODE>_DATABASE_ENGINE` | private | MAY | Database engine, normally `postgresql` for standalone server/container and cloud targets, and `sqlite` for desktop user data. |
| `SDKWORK_<APPLICATION_CODE>_DATABASE_HOST` | private | MAY | PostgreSQL host. Prefer this structured field over a URL for release deployments. |
| `SDKWORK_<APPLICATION_CODE>_DATABASE_PORT` | private | MAY | PostgreSQL port, normally `5432`. |
| `SDKWORK_<APPLICATION_CODE>_DATABASE_NAME` | private | MAY | PostgreSQL database name. |
| `SDKWORK_<APPLICATION_CODE>_DATABASE_SCHEMA` | private | MAY | PostgreSQL schema, normally `public` unless the app standard says otherwise. |
| `SDKWORK_<APPLICATION_CODE>_DATABASE_USERNAME` | private | MAY | PostgreSQL username. |
| `SDKWORK_<APPLICATION_CODE>_DATABASE_PASSWORD_FILE` | secret | MAY | PostgreSQL password file path. Prefer this over direct password values. |
| `SDKWORK_<APPLICATION_CODE>_DATABASE_PASSWORD` | secret | MAY | Direct PostgreSQL password override, allowed only for protected process environments or secret-bearing config files. |
| `SDKWORK_<APPLICATION_CODE>_DATABASE_SSL_MODE` | private | MAY | PostgreSQL SSL mode. Production deployments should use `require`, `verify-ca`, or `verify-full` where supported. |
| `SDKWORK_<APPLICATION_CODE>_DATABASE_URL` | private | MAY | Explicit database URL override. Server release packages should prefer structured runtime config fields for PostgreSQL; desktop and local development may use SQLite. |
| `SDKWORK_<APPLICATION_CODE>_DATABASE_FILE` | private | MAY | SQLite database file path for desktop user-data targets. |
| `SDKWORK_<APPLICATION_CODE>_DATABASE_MAX_CONNECTIONS` | private | MAY | Database pool limit. |
| `SDKWORK_<APPLICATION_CODE>_DATABASE_MODULE_ID` | private | MAY | Database lifecycle module id resolved from `database/database.manifest.json`. |
| `SDKWORK_<APPLICATION_CODE>_DATABASE_AUTO_MIGRATE` | private | MAY | When `true`, service bootstrap applies pending migrations. Production SHOULD default to `false`. |
| `SDKWORK_<APPLICATION_CODE>_DATABASE_SEED_ON_BOOT` | private | MAY | When `true`, service bootstrap applies required seed sets if not yet recorded. Production SHOULD default to `false`. |
| `SDKWORK_<APPLICATION_CODE>_DATABASE_SEED_LOCALE` | private | MAY | Seed locale directory name. Default `zh-CN`. |
| `SDKWORK_<APPLICATION_CODE>_DATABASE_SEED_PROFILE` | private | MAY | Seed profile name from `seeds/seed.manifest.json`. Default `standard`. |
| `SDKWORK_<APPLICATION_CODE>_DATABASE_DRIFT_INTERVAL_SEC` | private | MAY | Background drift refresh interval in seconds. Default `60`. |
| `SDKWORK_<APPLICATION_CODE>_REDIS_ENABLED` | private | MAY | Enables the Redis adapter. Cloud deployments and standalone server/container targets that require shared state default to `true`; desktop user-data targets default to `false` unless shared infrastructure is explicitly enabled. |
| `SDKWORK_<APPLICATION_CODE>_REDIS_HOST` | private | MAY | Redis host used when Redis is enabled. Prefer this structured field over a URL. |
| `SDKWORK_<APPLICATION_CODE>_REDIS_PORT` | private | MAY | Redis port used when Redis is enabled. Defaults should normally use `6379`. |
| `SDKWORK_<APPLICATION_CODE>_REDIS_DATABASE` | private | MAY | Redis logical database index used when Redis is enabled. Defaults should normally use `0`. |
| `SDKWORK_<APPLICATION_CODE>_REDIS_USERNAME` | private | MAY | Optional Redis username, for ACL-enabled Redis deployments. |
| `SDKWORK_<APPLICATION_CODE>_REDIS_URL` | private | MAY | Advanced Redis URL override used only when a managed endpoint cannot be represented cleanly with host, port, database, username, and TLS fields. |
| `SDKWORK_<APPLICATION_CODE>_REDIS_PASSWORD_FILE` | secret | MAY | Redis password file path. Prefer this over direct Redis password values. |
| `SDKWORK_<APPLICATION_CODE>_REDIS_PASSWORD` | secret | MAY | Direct Redis password override, allowed only for protected process environments or secret-bearing config files. |
| `SDKWORK_<APPLICATION_CODE>_REDIS_KEY_PREFIX` | private | MAY | Optional key namespace prefix for Redis data owned by the application. |
| `SDKWORK_<APPLICATION_CODE>_REDIS_TLS` | private | MAY | Enables TLS for structured Redis host/port/database configuration. Use `rediss://` when using the URL override. |
| `SDKWORK_<APPLICATION_CODE>_REDIS_MAX_CONNECTIONS` | private | MAY | Redis client pool limit. |
| `SDKWORK_<APPLICATION_CODE>_REDIS_CONNECT_TIMEOUT_MILLIS` | private | MAY | Redis connection timeout in milliseconds. |
| `SDKWORK_<APPLICATION_CODE>_REDIS_COMMAND_TIMEOUT_MILLIS` | private | MAY | Redis command timeout in milliseconds. |
| `SDKWORK_<APPLICATION_CODE>_REDIS_POOL_IDLE_TIMEOUT_SECONDS` | private | MAY | Redis idle connection lifetime in seconds. |
| `SDKWORK_<APPLICATION_CODE>_SERVER_BIND` | private | SHOULD for services | Public service bind address, for example `0.0.0.0:3900`. |
| `SDKWORK_<APPLICATION_CODE>_TRUST_FORWARDED_HEADERS` | private | MAY | Whether reverse-proxy forwarded headers are trusted. |
| `SDKWORK_<APPLICATION_CODE>_LOG_LEVEL` | private | MAY | Runtime log filter. |
| `SDKWORK_<APPLICATION_CODE>_DATA_DIR` | private | MAY | Explicit data directory override. |
| `SDKWORK_<APPLICATION_CODE>_CACHE_DIR` | private | MAY | Explicit cache directory override. |
| `SDKWORK_<APPLICATION_CODE>_LOG_DIR` | private | MAY | Explicit file log directory override. |
| `SDKWORK_<APPLICATION_CODE>_RUNTIME_DIR` | private | MAY | Explicit runtime state directory override for PID files, sockets, locks, and generated ephemeral state. |
| `SDKWORK_<APPLICATION_CODE>_TEMP_DIR` | private | MAY | Explicit temporary file directory override. |
| `SDKWORK_<APPLICATION_CODE>_API_KEY_PEPPER` | secret | REQUIRED when API keys are issued | Pepper used for API key hashing or verification. |
| `SDKWORK_<APPLICATION_CODE>_SESSION_SECRET` | secret | REQUIRED when sessions are issued | Session signing/encryption secret. |
| `SDKWORK_<APPLICATION_CODE>_WEBHOOK_SECRET` | secret | REQUIRED when webhooks are verified | Webhook signing secret. |

Application-specific variables may be added only when they have an owner, validation rule, and documentation entry.

## 5.1 Environment Profiles And Config Files

SDKWork uses canonical lifecycle environment names in code and may use short
profile aliases in scripts and file names.

| Script/file profile | Canonical environment | Required validation |
| --- | --- | --- |
| `dev` | `development` | Local-only defaults allowed; dev secrets must be marked development-only. |
| `test` | `test` | Database, Redis, logs, cache, temp files, and tenant data must be isolated. |
| `staging` | `staging` | Production-like validation, no local defaults, production-style secret handling. |
| `prod` | `production` | No placeholders, no developer paths, no localhost unless explicitly approved for a local appliance. |

Checked-in root templates for an application may include:

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

Ignored host-local files must include:

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

PC browser/desktop/tablet roots should use this grouped config layout when the
application supports multiple runtime targets:

```text
apps/sdkwork-<application-code>-pc/
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

Rules:

- The file suffix selects the profile template; the file content must still declare and validate `[runtime].environment`, `[runtime].deployment_profile`, and `[runtime].runtime_target`.
- `development` and `test` config may include disposable local placeholders. `staging` and `production` examples must show secret file or secret-manager references, not direct real secrets.
- Vite `.env`, `.env.local`, `.env.[mode]`, and `.env.[mode].local` files are build/dev-server inputs only. Only `VITE_` variables may reach browser code, and those variables must be non-secret.
- Public browser values should be emitted by `/runtime-env.js` or an equivalent JSON document when a built artifact is promoted from test to staging to production.
- Java/Spring server modules may provide profile examples such as `application-dev.yml.example`, `application-test.yml.example`, `application-staging.yml.example`, and `application-prod.yml.example`. These are server profile examples only; they do not replace the SDKWork typed runtime config model.
- Rust server, desktop, standalone service, and cloud service packages should prefer TOML runtime config with lower snake case keys.
- Tauri target config files may be copied into `config/tauri/` for templates or live under `src-tauri/` in the desktop package. In both cases they are platform packaging config, not secret-bearing runtime config.
- Production runtime config should be provisioned by installer, service manager, container orchestration, or release tooling. It must not require a committed `.env.production`.

## 5.2 Desktop, Server, Container, And Browser Config Profiles

Runtime target profiles must remain separate even when they are launched from
one PC application root.

| Runtime target | Default config location | Default persistence | Standard profile behavior |
| --- | --- | --- | --- |
| `browser` | `/runtime-env.js` or `/runtime-env.json` served by the trusted host | Browser storage only through approved auth/session adapter | Public SDK URLs and flags only; no secrets, database URLs, or private endpoints. |
| `desktop` | `~/.sdkwork/<application-code>/config/<app>.toml` or `%USERPROFILE%\.sdkwork\<application-code>\config\<app>.toml` | SQLite under SDKWork user-private data directory | Installed desktop runtime; may start local services but desktop user config stays separate. |
| `tablet-ipados` | Platform app-private config plus approved Tauri iOS config | SQLite or approved encrypted platform-local storage | Same PC renderer and SDK/IAM runtime; iPadOS packaging metadata is target config. |
| `tablet-android` | Platform app-private config plus approved Tauri Android config | SQLite or approved encrypted platform-local storage | Same PC renderer and SDK/IAM runtime; Android package/signing metadata is target config. |
| `capacitor-ios` | H5 mobile `config/browser` plus `config/host` Capacitor iOS profile and platform app-private storage | Approved secure storage adapter; local caches only | Same H5 mobile renderer and SDK/IAM runtime; iOS package/signing metadata is host config. |
| `capacitor-android` | H5 mobile `config/browser` plus `config/host` Capacitor Android profile and platform app-private storage | Approved secure storage adapter; local caches only | Same H5 mobile renderer and SDK/IAM runtime; Android package/signing metadata is host config. |
| `flutter-ios` | Flutter `config/app` plus `config/host` iOS profile and platform app-private storage | Approved secure storage adapter; local caches only | Generated Dart SDK/IAM runtime; iOS package/signing metadata is host config. |
| `flutter-android` | Flutter `config/app` plus `config/host` Android profile and platform app-private storage | Approved secure storage adapter; local caches only | Generated Dart SDK/IAM runtime; Android package/signing metadata is host config. |
| `android-native` | Android native `config/app` plus `config/host` Android profile and platform app-private storage | Approved secure storage adapter; local caches only | Generated Kotlin/Java SDK/IAM runtime; Android package/signing metadata is host config. |
| `ios-native` | iOS native `config/app` plus `config/host` iOS profile and platform app-private storage | Approved secure storage adapter; local caches only | Generated Swift SDK/IAM runtime; iOS package/signing metadata is host config. |
| `harmony-native` | Harmony native `config/app` plus `config/host` Harmony profile and platform app-private storage | Approved secure storage adapter; local caches only | Generated ArkTS/TypeScript SDK/IAM runtime adapted for Harmony; Harmony package/signing metadata is host config. |
| `mini-program` | Mini program `config/mini-program` plus `config/host` platform profile | Platform storage through approved host adapter | Generated TypeScript app SDK or approved wrapper; platform pages/subpackages are route projections. |
| `server` | `/etc/sdkwork/<application-code>/<process>.toml` or `%ProgramData%\sdkwork\<app>\<process>.toml` | PostgreSQL, Redis when required | Long-running service, explicit bind, reverse proxy assumptions, strict secret handling. |
| `container` | Mounted `/etc/sdkwork/<application-code>/<process>.toml`, env, and `/run/secrets/...` | External PostgreSQL/Redis or mounted volumes | Image contains examples only; runtime config and secrets are injected. |
| `test-runner` | Ephemeral generated config under test temp directory | Isolated SQLite or isolated PostgreSQL schema/database | No shared dev/prod state; deterministic cleanup. |

Rules:

- The runtime target table above is an exhaustive config profile matrix for
  application runtime targets. Environment templates, TOML files, generated
  public runtime JSON, native host config, and workflow env must use these
  exact values from `CONFIG_SPEC.md`.
- Docker-compatible deployments `MUST` declare `runtime_target = "container"`.
  `docker` is allowed only as tooling/provider/package-format wording, not as
  a runtime target or deployment profile value.
- `pnpm dev` for a PC root starts the browser renderer unless the local app spec says otherwise.
- `pnpm dev:server` starts the server process with the development server config profile.
- `pnpm dev:desktop` starts the desktop shell and may also start a server process, but the server process reads the server development profile, not the installed desktop profile.
- Installed desktop packages use `deployment_profile = "standalone"` and `runtime_target = "desktop"` by default.
- Standalone server packages use `deployment_profile = "standalone"` and `runtime_target = "server"` by default.
- Standalone single-container packages use `deployment_profile = "standalone"` and `runtime_target = "container"` by default.
- Cloud container packages use `deployment_profile = "cloud"` and `runtime_target = "container"` by default.
- Test runners use `environment = "test"` and `runtime_target = "test-runner"` even when the code under test is a server or desktop runtime.
- A config validator must fail if a production server profile contains localhost API endpoints, development-only secrets, test database names, writable developer directories, or placeholder passwords.

## 6. SDK Base URL Standard

Generated SDK bootstrap should require one common SDK root by default, then resolve explicit base URLs for each SDK surface before constructing generated clients. Per-surface and per-SDK variables are overrides, not mandatory boilerplate for ordinary same-gateway deployments.

| SDK surface | Private server/runtime env | Public browser runtime env | Vite/dev-server public env | Default |
| --- | --- | --- | --- | --- |
| Common SDK root | `SDKWORK_<APPLICATION_CODE>_SDK_BASE_URL` | `PORTAL_PUBLIC_SDK_BASE_URL` | `VITE_<APP_CODE>_SDK_BASE_URL` | Same-origin deployment root, for example `/` or a gateway origin. |
| Public API reference / generic OpenAPI display | `SDKWORK_<APPLICATION_CODE>_API_BASE_URL` | `PORTAL_PUBLIC_API_BASE_URL` | `VITE_API_BASE_URL` | Same-origin API path, app-specific. |
| SDKWork open-api SDK or documented OpenAI-compatible API | `SDKWORK_<APPLICATION_CODE>_OPEN_API_BASE_URL` | `PORTAL_PUBLIC_OPEN_API_BASE_URL` | `VITE_<APP_CODE>_OPEN_API_BASE_URL` | Derived from the common SDK root plus the approved open-api prefix, or from the API reference base URL when documented. |
| App/user SDK | `SDKWORK_<APPLICATION_CODE>_APP_API_BASE_URL` | `PORTAL_PUBLIC_APP_API_BASE_URL` | `VITE_<APP_CODE>_APP_API_BASE_URL` | Derived from the common SDK root plus `/app/v3/api` for SDKWork v3 app-api. |
| `backend-admin` SDK | `SDKWORK_<APPLICATION_CODE>_BACKEND_API_BASE_URL` | `PORTAL_PUBLIC_BACKEND_API_BASE_URL` | `VITE_<APP_CODE>_BACKEND_API_BASE_URL` | Derived from the common SDK root plus `/backend/v3/api` for SDKWork v3 backend-api. |
| Dependency open-api SDK | `SDKWORK_<APPLICATION_CODE>_<DEPENDENCY>_OPEN_API_BASE_URL` | `PORTAL_PUBLIC_<DEPENDENCY>_OPEN_API_BASE_URL` | `VITE_<APP_CODE>_<DEPENDENCY>_OPEN_API_BASE_URL` | Derived from the common SDK root only when the dependency surface is documented as served by that gateway; otherwise configure this override. |
| Dependency app-api SDK | `SDKWORK_<APPLICATION_CODE>_<DEPENDENCY>_APP_API_BASE_URL` | `PORTAL_PUBLIC_<DEPENDENCY>_APP_API_BASE_URL` | `VITE_<APP_CODE>_<DEPENDENCY>_APP_API_BASE_URL` | Derived from the common SDK root plus the dependency app-api prefix only when hosted by the same edge; otherwise configure this override. |
| Dependency backend-api SDK | `SDKWORK_<APPLICATION_CODE>_<DEPENDENCY>_BACKEND_API_BASE_URL` | `PORTAL_PUBLIC_<DEPENDENCY>_BACKEND_API_BASE_URL` | `VITE_<APP_CODE>_<DEPENDENCY>_BACKEND_API_BASE_URL` | Derived from the common SDK root only when verified dependency backend mount coverage exists; otherwise configure this override. |

Rules:

- SDKWork open-api SDK and documented compatibility API configuration must use `OPEN_API_BASE_URL` terminology. For SDKWork business open-api SDKs, the value `MUST` be that domain's approved non-app/non-backend prefix from `API_SPEC.md`, for example `/im/v3/api`; it does not imply a literal `/open` path segment. For explicitly documented OpenAI-compatible APIs, `/v1` remains valid as a protocol-compatibility prefix and must not be used as the default for new SDKWork-owned business open-api domains. `gateway` can remain an internal system id when the generated schema or UI already uses it, but environment names should describe the SDK surface.
- The common SDK root must not itself be a resolved surface URL such as `/v1`, `/app/v3/api`, or `/backend/v3/api`. A surface URL may be configured only through the matching surface or SDK-specific override.
- App SDK and `backend-admin` SDK clients must receive explicit resolved base
  URLs after config resolution because they may terminate at different hosts in
  cloud or customer-owned split-service deployments.
- Appbase, Drive, IM, payment, media, or other dependency SDK override variables must be keyed by dependency SDK family/app code. Do not hide dependency base URLs behind an application-local `API_BASE_URL` when the dependency can be deployed independently.
- Browser public runtime config may expose SDK base URLs only when the browser is allowed to call that SDK surface directly. `backend-admin` base URLs must not be exposed to user-facing app UI or PC user console UI unless that route surface is explicitly `backend-admin`.
- Defaults should be same-origin paths in browser deployments so remote browsers are not given loopback addresses, but dependency SDK same-origin defaults are allowed only when `dependencyApiSurfaces` records verified mount coverage for that dependency surface.
- Dependency backend-api SDK override variables such as
  `SDKWORK_<APPLICATION_CODE>_APPBASE_BACKEND_API_BASE_URL`,
  `PORTAL_PUBLIC_APPBASE_BACKEND_API_BASE_URL`, and
  `VITE_SDKWORK_APPBASE_BACKEND_API_BASE_URL` are optional when `SDK_BASE_URL` points to a verified gateway that serves the dependency backend routes. They `MUST` be configured explicitly when the dependency backend is deployed elsewhere or when mount coverage is not documented.
- A checked-in example may leave a required external dependency backend base URL empty to force deployment configuration, but it `MUST NOT` set that dependency URL to `/backend/v3/api` or another application-owned default without matching `dependencyApiSurfaces` coverage evidence.
- Absolute HTTP/HTTPS origins must be added to the production Content Security Policy `connect-src`.
- Generated SDK examples must not hard-code tenant-specific hosts.
- Base URL values must not include query strings, fragments, embedded credentials, API keys, tokens, or tenant-specific secret material.
- Environment variable names ending in `_REFRESH_TOKEN`, `_AUTH_TOKEN`, `_API_KEY`, or browser/public `*_TOKEN` are forbidden as live credential inputs unless a spec explicitly marks the variable as a test-only fixture. `SDKWORK_ACCESS_TOKEN` is the only allowed private bootstrap access credential according to section 6.1. Production browser configs must fail validation when bootstrap or session token values are exposed through `VITE_*` or `PORTAL_PUBLIC_*`.

### 6.1 Access Token And Credential Configuration

Every SDKWork application that consumes protected app-api or backend-api surfaces
`MUST` treat `Access-Token` as a mandatory outbound credential whenever a
credential is available. Tenant, organization, app, environment, deployment
profile, runtime target, and scope context `MUST` be carried inside signed token
claims, not in client-writable request fields or SDKWork context-projection
headers.

Credential sources:

| Phase | `access_token` source | `auth_token` source | Rule |
| --- | --- | --- | --- |
| Service/bootstrap | `SDKWORK_ACCESS_TOKEN` in private env or secret manager | Appbase IAM login/registration/refresh/current-session only | Used only before interactive login or for approved service-context runtimes (`server`, `container`, `test-runner`, and documented desktop service contexts). |
| Interactive session | Appbase IAM login/registration/refresh/current-session response | Same appbase IAM response | Replaces bootstrap credentials in TokenManager, session store, and context store. |
| Browser/renderer | TokenManager session storage after login | TokenManager session storage after login | `MUST NOT` read live tokens from `VITE_*`, `PORTAL_PUBLIC_*`, or public runtime config. |

| Credential | Source | Header | Env/config rule |
| --- | --- | --- | --- |
| Auth token | Appbase IAM session/login/refresh/current-session only | `Authorization: Bearer <auth_token>` | Forbidden in environment variables. Forbidden in browser public runtime config. |
| Access token | Appbase IAM session/login/refresh/current-session, or private bootstrap `SDKWORK_ACCESS_TOKEN` before login | `Access-Token: <JWT access_token>` | `SDKWORK_ACCESS_TOKEN` `SHOULD` be configured for every application root that calls protected APIs. Value `MUST` be a signed JWT, not a semicolon claim string. Forbidden in browser public runtime config. Superseded by session tokens after login. |
| Refresh token | Appbase IAM refresh flow only | Not sent on business API requests | Not allowed in env or browser public runtime config. Storage is controlled by appbase IAM runtime. |
| API key | Open-api credential provider for `api-key` or `open-api-flexible` mode | `X-API-Key` or declared scheme | Not allowed in environment variables. Raw value may exist only in protected secret manager, server-side non-env config, OS secure storage, or test fixture. Never in browser public runtime config. |
| OAuth bearer | Open-api credential provider for `oauth` or `open-api-flexible` mode | `Authorization: Bearer <token>` | Raw value may exist only in protected secret manager, server-side config, OS secure storage, or test fixture. Never in browser public runtime config. |

Rules:

- Protected app-api and backend-api SDK requests `MUST` send `Access-Token: <JWT access_token>` whenever the runtime has an access token available from bootstrap or session state.
- Protected app-api and backend-api SDK requests `MUST` send `Authorization: Bearer <auth_token>` whenever the runtime has an auth token available from bootstrap or session state.
- App-api and backend-api SDK clients must obtain runtime session tokens through the global TokenManager or language-equivalent credential provider. Service/bootstrap runtimes may seed that provider from `SDKWORK_ACCESS_TOKEN` only.
- When both bootstrap/session `auth_token` and `access_token` are present, frameworks and runtimes `MUST` treat overlapping principal and tenancy claims from `auth_token` as authoritative. Overlapping fields are: `sub`/`user_id`, `sid`/`session_id`, `tenant_id`, `organization_id`, `login_scope`, and `auth_level`. Access-isolation-only fields such as `data_scope`, `permission_scope`, deployment profile, runtime target, and sharding hints remain authoritative from `access_token`.
- If `access_token` carries an overlapping claim that contradicts the authoritative `auth_token` value after normalization, the request `MUST` be rejected.
- TokenManager config may be controlled by `SDKWORK_<APPLICATION_CODE>_TOKEN_MANAGER_MODE` and `SDKWORK_<APPLICATION_CODE>_TOKEN_STORAGE`, but those variables describe behavior only and must never contain token values.
- TokenManager config may be controlled by `SDKWORK_<APPLICATION_CODE>_TOKEN_MANAGER_MODE` and `SDKWORK_<APPLICATION_CODE>_TOKEN_STORAGE`, but those variables describe behavior only and must never contain token values.
- `SDKWORK_ACCESS_TOKEN_HEADER` may exist only to assert that the runtime uses `Access-Token`; SDKWork v3 applications must reject any value other than `Access-Token`.
- `SDKWORK_AUTH_TOKEN_HEADER` may exist only to assert that the runtime uses `Authorization`; SDKWork v3 applications must reject any value other than `Authorization`.
- Browser public runtime config must never include token manager state, token storage contents, refresh tokens, API keys, or generated `getAuthHeaders()` output.
- Desktop apps should store tokens through OS secure storage or approved encrypted storage. Server-side service contexts should use typed request context or trusted service credentials, not `.env` session tokens.
- Test fixtures may contain fake token strings only when the file is clearly test-only, excluded from production bundles, and covered by static scans that prevent reuse in release config.
- Runtime env, tracked `.env.example`, bootstrap overlays, runtime TOML, and public runtime config `MUST NOT` define fixed IAM identity scope through `SDKWORK_IAM_BOOTSTRAP_*`, `SDKWORK_IAM_LOCAL_*`, `SDKWORK_USER_CENTER_BOOTSTRAP_*`, runtime `SDKWORK_APP_ID`, `VITE_SDKWORK_APP_ID`, or equivalent tenant/organization/user/owner bootstrap variables. Current tenant, organization, user, session, and app scope `MUST` come from dual-token JWT claims after login according to `IAM_LOGIN_INTEGRATION_SPEC.md`.
- Release and CI tooling `MAY` use `SDKWORK_APP_ID` only as build or workflow metadata. That variable `MUST NOT` be read by live IAM runtime, TokenManager, or protected SDK client scope resolution.

## 7. Database Selection Standard

Database defaults depend on `deploymentProfile` and `runtimeTarget`.

Standalone server/container targets and cloud targets default to PostgreSQL
through runtime TOML, environment, or orchestration config. Desktop user data
remains SQLite by default. Desktop/Tauri development commands that start a
backend service use PostgreSQL to exercise server behavior, but that does not
change the desktop package database default. `SDKWORK_<APPLICATION_CODE>_DATABASE_URL` is an
explicit operator override, not the primary production configuration path.
Application root `pnpm dev:browser` and `pnpm dev:desktop` are development
orchestration defaults, not installer defaults: both must select the
PostgreSQL development profile, `serviceLayout = unified-process`, and
`deploymentProfile = standalone` unless an explicit suffixed command selects
SQLite, split-services, or cloud.

| Deployment profile | Runtime target | Default database | Requirement |
| --- | --- | --- | --- |
| `standalone` | `desktop` | SQLite for user data; PostgreSQL for a launched backend service in dev | Desktop user data uses a user-private SQLite file. Desktop-started backend services use the server PostgreSQL dev profile unless an explicit SQLite command is selected. |
| `standalone` | `server` | PostgreSQL | Release/server packages must use PostgreSQL by default unless an approved single-user appliance exception exists. |
| `standalone` | `container` | PostgreSQL | Single-container packages keep database state external or on explicit mounted volumes; do not store production DB state in ephemeral layers. |
| `cloud` | `server` or `container` | Managed PostgreSQL or compatible service | Must satisfy `DATABASE_SPEC.md`, secret handling, readiness, backup, and rollback requirements. |
| `standalone` or `cloud` | `test-runner` | Isolated SQLite or isolated PostgreSQL | Test DB must be isolated per test run. |

### 7.1 Unified Workspace PostgreSQL Profile

All SDKWork applications in one workspace share one PostgreSQL connection identity for development and production. The canonical profile is owned by `sdkwork-claw-router` and uses `SDKWORK_CLAW_DATABASE_*` keys.

Applications MUST NOT define per-app PostgreSQL database names, usernames, passwords, schemas, or URLs that differ from this profile in checked-in `.env.postgres.example`, topology profile env files, release templates, or operator documentation.

| Environment | Canonical keys | Database | Schema | Username | Password |
| --- | --- | --- | --- | --- | --- |
| Development | `SDKWORK_CLAW_DATABASE_*` | `sdkwork_ai_dev` | `sdkwork_ai_dev` | `sdkwork_ai_dev` | `sdkworkdev123` |
| Production | `SDKWORK_CLAW_DATABASE_*` | `sdkwork_ai_prod` | `sdkwork_ai_prod` | `sdkwork_ai_prod` | secret file or protected env |

Rules:

- `SDKWORK_CLAW_DATABASE_*` is the single source of truth for PostgreSQL connection identity across IAM, gateway-embedded routers, and application services.
- Per-app `SDKWORK_<APPLICATION_CODE>_DATABASE_*` keys MAY remain for pool sizing, deployment mode, table prefix, SQLite desktop paths, and service-specific bootstrap, but MUST NOT redefine host, port, database, schema, username, password, or URL in checked-in files.
- Every application repository MUST ship `.env.postgres.example` that contains only `SDKWORK_CLAW_DATABASE_*` fields copied from `sdkwork-specs/templates/env.postgres.example` or `sdkwork-claw-router/.env.postgres.example`.
- Developer overrides belong in ignored `.env.postgres` at the application root or in `sdkwork-claw-router/.env.postgres`; do not fork per-app connection identity in source control.
- Dev orchestration, topology loaders, and IAM env helpers MUST resolve PostgreSQL through `SDKWORK_CLAW_DATABASE_*` before any per-app database fields.
- Rust services using `sdkwork-database-config` already fall back to `SDKWORK_CLAW_DATABASE_*`; applications must not reintroduce separate default URLs.
- Table ownership and migrations remain per service; only the PostgreSQL instance and login identity are shared.

Canonical development template:

```env
SDKWORK_CLAW_DATABASE_ENGINE=postgresql
SDKWORK_CLAW_DATABASE_HOST=127.0.0.1
SDKWORK_CLAW_DATABASE_PORT=5432
SDKWORK_CLAW_DATABASE_NAME=sdkwork_ai_dev
SDKWORK_CLAW_DATABASE_SCHEMA=sdkwork_ai_dev
SDKWORK_CLAW_DATABASE_USERNAME=sdkwork_ai_dev
SDKWORK_CLAW_DATABASE_PASSWORD=sdkworkdev123
SDKWORK_CLAW_DATABASE_SSL_MODE=disable
SDKWORK_CLAW_DATABASE_MAX_CONNECTIONS=10
```

Canonical production server/container fields:

```env
SDKWORK_CLAW_DATABASE_ENGINE=postgresql
SDKWORK_CLAW_DATABASE_HOST=db.example.com
SDKWORK_CLAW_DATABASE_PORT=5432
SDKWORK_CLAW_DATABASE_NAME=sdkwork_ai_prod
SDKWORK_CLAW_DATABASE_SCHEMA=sdkwork_ai_prod
SDKWORK_CLAW_DATABASE_USERNAME=sdkwork_ai_prod
SDKWORK_CLAW_DATABASE_PASSWORD_FILE=/etc/sdkwork/router/database.secret
SDKWORK_CLAW_DATABASE_SSL_MODE=require
SDKWORK_CLAW_DATABASE_MAX_CONNECTIONS=20
```

Rules:

- Server release packages must generate an explicit structured PostgreSQL config with host, database, username, and secret handling fields.
- Desktop packages and desktop runtime profiles must keep local user data on
  SQLite by default. They must create the SQLite file under the SDKWork user
  private data directory, not under server data directories and not in
  PostgreSQL, unless the user explicitly configures an external database.
- SDKWork application root commands follow `PNPM_SCRIPT_SPEC.md`. `pnpm dev`
  starts the default development workflow. `pnpm dev:browser` and
  `pnpm dev:desktop` default to PostgreSQL, `unified-process`, and standalone.
  Product-prefixed public commands such as `clawrouter:dev`, `drive:dev`, and
  `im:dev` are retired. The PostgreSQL development profile belongs to dev
  orchestration and any launched service runtime; it must not be treated as the
  installed desktop-local data store.
- Explicit application server SQLite development commands, such as
  `pnpm dev:server:sqlite`, must be named clearly and used only when
  validating local SQLite behavior for the application server runtime. Desktop
  client commands such as `pnpm dev:desktop:sqlite` must remain gateway-backed
  client commands when the application standard assigns default API serving to
  sdkwork-api-cloud-gateway.
- PostgreSQL secrets should use `password_file` or a platform secret; direct `password` is allowed only when the runtime config file is protected as a secret-bearing file.
- Development PostgreSQL profiles must use a checked-in `.env.postgres.example`
  file with local-only placeholder values and an ignored `.env.postgres`
  developer override.
- `.env.postgres.example` must use the unified `SDKWORK_CLAW_DATABASE_*` split
  fields from `§7.1 Unified Workspace PostgreSQL Profile` and
  `sdkwork-specs/templates/env.postgres.example`. Per-app
  `SDKWORK_<APPLICATION_CODE>_DATABASE_*` connection identity fields are not allowed in
  checked-in PostgreSQL templates.
- If database initialization needs an admin connection, use
  `SDKWORK_CLAW_DATABASE_ADMIN_HOST`, `SDKWORK_CLAW_DATABASE_ADMIN_PORT`,
  `SDKWORK_CLAW_DATABASE_ADMIN_USERNAME`, `SDKWORK_CLAW_DATABASE_ADMIN_PASSWORD`,
  `SDKWORK_CLAW_DATABASE_ADMIN_DATABASE`, and `SDKWORK_CLAW_DATABASE_ADMIN_SSL_MODE`.
- `DATABASE_PROVIDER` and `DATABASE_SSLMODE` are not standard names. New apps
  must reject them rather than accepting aliases.

Standard `.env.postgres.example` shape:

```env
# Copy from sdkwork-specs/templates/env.postgres.example
SDKWORK_CLAW_DATABASE_ENGINE=postgresql
SDKWORK_CLAW_DATABASE_HOST=127.0.0.1
SDKWORK_CLAW_DATABASE_PORT=5432
SDKWORK_CLAW_DATABASE_NAME=sdkwork_ai_dev
SDKWORK_CLAW_DATABASE_SCHEMA=sdkwork_ai_dev
SDKWORK_CLAW_DATABASE_USERNAME=sdkwork_ai_dev
SDKWORK_CLAW_DATABASE_PASSWORD=sdkworkdev123
SDKWORK_CLAW_DATABASE_SSL_MODE=disable
SDKWORK_CLAW_DATABASE_MAX_CONNECTIONS=10

SDKWORK_CLAW_DATABASE_ADMIN_HOST=127.0.0.1
SDKWORK_CLAW_DATABASE_ADMIN_PORT=5432
SDKWORK_CLAW_DATABASE_ADMIN_USERNAME=postgres
SDKWORK_CLAW_DATABASE_ADMIN_PASSWORD=postgres_admin_pass
SDKWORK_CLAW_DATABASE_ADMIN_DATABASE=postgres
SDKWORK_CLAW_DATABASE_ADMIN_SSL_MODE=disable
```
- Desktop packages may create SQLite automatically during first-run initialization.
- Database URLs are private process/config values. They must never be exposed through `PORTAL_PUBLIC_*` or `VITE_*`.
- Pool settings must be explicit for server/container deployments.
- Migration and seed behavior must be controlled by typed install/init settings, not implicit environment guesses.

## 8. Runtime Directory Paths

`RUNTIME_DIRECTORY_SPEC.md` is the canonical path standard for SDKWork
applications. Environment handling must reference that file instead of defining
app-local directory schemes.

For application code `<app>`:

| OS/profile | Config file | Data directory | Log directory |
| --- | --- | --- | --- |
| Linux service/container | `/etc/sdkwork/<application-code>/<app>.toml` or `/etc/sdkwork/<application-code>/<process>.toml` | `/var/lib/sdkwork/<application-code>` | `/var/log/sdkwork/<application-code>` |
| Linux user/desktop | `~/.sdkwork/<application-code>/config/<app>.toml` or `~/.sdkwork/<application-code>/config/<process>.toml` | `~/.sdkwork/<application-code>/data` | `~/.sdkwork/<application-code>/logs` |
| macOS service | `/Library/Application Support/sdkwork/<application-code>/<app>.toml` or process-specific equivalent | `/Library/Application Support/sdkwork/<application-code>/Data` | `/Library/Logs/sdkwork/<application-code>` |
| macOS user/desktop | `~/.sdkwork/<application-code>/config/<app>.toml` or process-specific equivalent | `~/.sdkwork/<application-code>/data` | `~/.sdkwork/<application-code>/logs` |
| Windows service | `%ProgramData%\sdkwork\<app>\<app>.toml` or process-specific equivalent | `%ProgramData%\sdkwork\<app>\Data` | `%ProgramData%\sdkwork\<app>\Logs` |
| Windows user/desktop | `%USERPROFILE%\.sdkwork\<application-code>\config\<app>.toml` or process-specific equivalent | `%USERPROFILE%\.sdkwork\<application-code>\data` | `%USERPROFILE%\.sdkwork\<application-code>\logs` |
| Container | `/etc/sdkwork/<application-code>/<app>.toml` or process-specific equivalent | `/var/lib/sdkwork/<application-code>` or mounted volume | stdout/stderr, optional `/var/log/sdkwork/<application-code>` |

Rules:

- `SDKWORK_<APPLICATION_CODE>_CONFIG_FILE` must override default config discovery.
- `SDKWORK_<APPLICATION_CODE>_DATA_DIR`, `SDKWORK_<APPLICATION_CODE>_CACHE_DIR`, and
  `SDKWORK_<APPLICATION_CODE>_LOG_DIR` may override their resolved directories.
- Config files must be created with restrictive permissions when they include secrets.
- Desktop apps should place SQLite data under the user private data path, not beside the executable.
- Server services should place mutable data under `/var/lib/sdkwork/<application-code>/` on Linux or the equivalent service data directory on other systems.
- Release archives must include example config templates but must not include host-local secrets.
- Historical XDG, `%APPDATA%`, `%LOCALAPPDATA%`, or display-name directories may be read as compatibility fallbacks during migration, but canonical SDKWork writes should target `~/.sdkwork/<application-code>` or the Windows equivalent `%USERPROFILE%\.sdkwork\<application-code>` for user-private files.

## 9. Runtime Config File Shape

TOML is the preferred runtime config file format for SDKWork Rust and desktop/server packages.

```toml
[runtime]
environment = "production"
deployment_profile = "standalone"
runtime_target = "server"
config_profile = "prod"

[server]
bind = "0.0.0.0:3900"
external_scheme = "https"
trust_forwarded_headers = true

[database]
engine = "postgresql"
host = "db.example.com"
port = 5432
database = "sdkwork_ai_prod"
schema = "sdkwork_ai_prod"
username = "sdkwork_ai_prod"
password_file = "/etc/sdkwork/router/database.secret"
ssl_mode = "require"
max_connections = 20

[redis]
enabled = true
host = "redis.example.com"
port = 6379
database = 0
# username = "default"
# url = "redis://redis.example.com:6379/0"
password_file = "/etc/sdkwork/router/redis.secret"
key_prefix = "clawrouter"
tls = false
max_connections = 16
connect_timeout_ms = 2000
command_timeout_ms = 1000
pool_idle_timeout_seconds = 60

[portal.public]
# /v1 is valid here only for an explicitly documented OpenAI-compatible API.
# SDKWork-owned business open-api domains use their approved prefix, for example /im/v3/api.
api_base_url = "/v1"
open_api_base_url = "/v1"
app_api_base_url = "/app/v3/api"
backend_api_base_url = "/backend/v3/api"
tool_api_enabled = false

[portal.tools]
rate_limit_requests = 120
rate_limit_window_seconds = 60
sdk_archive_root = "/var/lib/sdkwork/router/sdk-archives"
```

Rules:

- Config files should use lower snake case.
- `[runtime].environment`, `[runtime].deployment_profile`, and `[runtime].runtime_target` are required in non-example release config.
- `[runtime].config_profile` is optional and exists only for operator readability or script traceability.
- Environment variables should use upper snake case.
- The mapping between file keys and env keys must be documented and tested.
- Secrets may appear in protected host-local config files, but checked-in examples must use placeholders.
- Database config must prefer structured fields in `[database]`. A full `url`
  is a private operator override, not the primary release contract.
- Redis config must live under `[redis]`. Cloud deployments and standalone server/container deployments that require shared state default to `enabled = true` and must fail fast when Redis is required but not configured; desktop user-data targets default to `enabled = false`.
- Redis connections should use `host`, `port`, `database`, `username`, `tls`, pool size, and timeout fields as the primary configuration. `url` is an advanced override for managed Redis endpoints whose connection contract cannot be represented cleanly with separate fields.
- Redis secrets should use `password_file` or platform secrets. Direct `password` is allowed only when the runtime TOML is protected as a secret-bearing file.
- Public browser runtime config must be generated from `[portal.public]` or equivalent validated env values.

Development server profile:

```toml
[runtime]
environment = "development"
deployment_profile = "standalone"
runtime_target = "server"
config_profile = "dev"

[server]
bind = "127.0.0.1:3900"
trust_forwarded_headers = false

[database]
engine = "postgresql"
host = "127.0.0.1"
port = 5432
database = "sdkwork_ai_dev"
schema = "sdkwork_ai_dev"
username = "sdkwork_ai_dev"
password = "sdkworkdev123"
ssl_mode = "disable"
max_connections = 10

[redis]
enabled = true
host = "127.0.0.1"
port = 6379
database = 0
key_prefix = "<app>:dev"
tls = false
```

Test server profile:

```toml
[runtime]
environment = "test"
deployment_profile = "standalone"
runtime_target = "test-runner"
config_profile = "test"

[paths]
data_directory = "<test-temp>/<app>/data"
log_directory = "<test-temp>/<app>/logs"
cache_directory = "<test-temp>/<app>/cache"
runtime_directory = "<test-temp>/<app>/run"
temp_directory = "<test-temp>/<app>/tmp"

[database]
engine = "postgresql"
host = "127.0.0.1"
port = 5432
database = "<app>_test_<run_id>"
schema = "<app>_test_<run_id>"
username = "<app>test"
password = "test-only-change-me"
ssl_mode = "disable"
max_connections = 4

[redis]
enabled = true
host = "127.0.0.1"
port = 6379
database = 15
key_prefix = "<app>:test:<run_id>"
tls = false
```

Production server profile:

```toml
[runtime]
environment = "production"
deployment_profile = "standalone"
runtime_target = "server"
config_profile = "prod"

[server]
bind = "0.0.0.0:3900"
external_scheme = "https"
trust_forwarded_headers = true

[database]
engine = "postgresql"
host = "db.internal"
port = 5432
database = "sdkwork_ai_prod"
schema = "sdkwork_ai_prod"
username = "sdkwork_ai_prod"
password_file = "/etc/sdkwork/router/database.secret"
ssl_mode = "require"
max_connections = 20

[redis]
enabled = true
host = "redis.internal"
port = 6379
database = 0
password_file = "/etc/sdkwork/<application-code>/redis.secret"
key_prefix = "<app>:prod"
tls = true
```

Installed desktop production profile:

```toml
[runtime]
environment = "production"
deployment_profile = "standalone"
runtime_target = "desktop"
config_profile = "prod"

[desktop]
native_host = "tauri"
local_service_enabled = true
secure_storage_provider = "os-keychain"

[database]
engine = "sqlite"
file = "~/.sdkwork/<application-code>/data/<app>.sqlite"
max_connections = 1

[redis]
enabled = false
```

## 10. Application Architecture Matrix

### 10.1 Browser Portal SPA

Use when a React/Vite/browser application is served by an edge service or static host.

Required behavior:

- Load `/runtime-env.js` or equivalent before the hashed application bundle.
- Use only browser-visible runtime variables for SDK client base URLs.
- Prefer `PORTAL_PUBLIC_SDK_BASE_URL` as the common public SDK root and derive open/app/backend public base URLs from it. Use `PORTAL_PUBLIC_OPEN_API_BASE_URL`, `PORTAL_PUBLIC_APP_API_BASE_URL`, `PORTAL_PUBLIC_BACKEND_API_BASE_URL`, or dependency-specific overrides only for split deployments or nonstandard mounts.
- Reject invalid public URLs at startup or build-time preflight.
- Treat Vite mode as build-time input only. Runtime environment, deployment profile, and runtime target must come from validated public runtime config.
- Browser public runtime config must declare `environment`, `deploymentProfile`, and `runtimeTarget = "browser"` or their JSON/language equivalents.

Recommended variables:

```text
# /v1 is valid here only for an explicitly documented OpenAI-compatible API.
# SDKWork-owned business open-api domains use their approved prefix, for example /im/v3/api.
PORTAL_PUBLIC_API_BASE_URL=/v1
PORTAL_PUBLIC_SDK_BASE_URL=/
PORTAL_PUBLIC_OPEN_API_BASE_URL=/v1
PORTAL_PUBLIC_APP_API_BASE_URL=/app/v3/api
PORTAL_PUBLIC_BACKEND_API_BASE_URL=/backend/v3/api
PORTAL_PUBLIC_TOOL_API_ENABLED=false
```

Recommended public runtime config:

```json
{
  "environment": "production",
  "deploymentProfile": "cloud",
  "runtimeTarget": "browser",
  "openApiBaseUrl": "/v1",
  "appApiBaseUrl": "/app/v3/api",
  "backendApiBaseUrl": "/backend/v3/api"
}
```

### 10.2 Backend-Admin Web Application

Use when an operator console consumes `backend-admin` APIs.

Required behavior:

- Consume generated `backend-admin` SDKs through approved wrappers.
- Configure `backend-admin` through the common SDK root by default. Use `PORTAL_PUBLIC_BACKEND_API_BASE_URL` only when the admin backend is split from the common gateway or needs a nonstandard mount.
- Never expose backend service-to-service secrets to browser code.

Recommended public runtime variable:

```text
PORTAL_PUBLIC_SDK_BASE_URL=/
# Optional override when backend-admin is split from the common SDK root:
# PORTAL_PUBLIC_BACKEND_API_BASE_URL=/backend/v3/api
```

### 10.3 App/User Web Application

Use when user-facing UI consumes app APIs.

Required behavior:

- Consume generated app SDKs through approved wrappers.
- Configure app API through the common SDK root by default. Use `PORTAL_PUBLIC_APP_API_BASE_URL` only when app-api is split from the common gateway or needs a nonstandard mount.
- Store tokens only through the platform-approved auth/session adapter.
- User-facing app UI and PC user console UI must not read `backend-admin` SDK base URLs.

Recommended public runtime variable:

```text
PORTAL_PUBLIC_SDK_BASE_URL=/
# Optional override when app-api is split from the common SDK root:
# PORTAL_PUBLIC_APP_API_BASE_URL=/app/v3/api
```

### 10.4 Desktop Application

Use when the application is installed per user and can run locally.

Required behavior:

- Default to SQLite in the SDKWork user private data directory.
- When the desktop app starts a backend service during development, that service
  uses the server PostgreSQL dev profile unless an explicit SQLite command is
  selected.
- Support a config file in the SDKWork user private config directory.
- Keep secrets in OS secure storage when possible.
- Allow `SDKWORK_<APPLICATION_CODE>_DATABASE_URL` to override the local database for diagnostics and managed operator deployments.

Example desktop config:

```toml
[runtime]
environment = "production"
deployment_profile = "standalone"
runtime_target = "desktop"

[database]
engine = "sqlite"
file = "~/.sdkwork/<application-code>/data/<app>.sqlite"
max_connections = 1
```

### 10.5 Server Service

Use when the application runs as a long-lived service on a VM or bare-metal host.

Required behavior:

- Require PostgreSQL for release deployment.
- Read config from the canonical service config path or `SDKWORK_<APPLICATION_CODE>_CONFIG_FILE`.
- Bind explicitly and document reverse-proxy assumptions.
- Fail fast when required secrets or database config are missing.
- Declare `environment`, `deployment_profile = "standalone"`, and `runtime_target = "server"` in runtime config.

Example server env:

```text
SDKWORK_<APPLICATION_CODE>_CONFIG_FILE=/etc/sdkwork/<application-code>/<app>.toml
SDKWORK_<APPLICATION_CODE>_ENVIRONMENT=production
SDKWORK_<APPLICATION_CODE>_CONFIG_PROFILE=prod
SDKWORK_<APPLICATION_CODE>_DEPLOYMENT_PROFILE=standalone
SDKWORK_<APPLICATION_CODE>_RUNTIME_TARGET=server
SDKWORK_CLAW_DATABASE_ENGINE=postgresql
SDKWORK_CLAW_DATABASE_HOST=db.example.com
SDKWORK_CLAW_DATABASE_PORT=5432
SDKWORK_CLAW_DATABASE_NAME=sdkwork_ai_prod
SDKWORK_CLAW_DATABASE_SCHEMA=sdkwork_ai_prod
SDKWORK_CLAW_DATABASE_USERNAME=sdkwork_ai_prod
SDKWORK_CLAW_DATABASE_PASSWORD_FILE=/etc/sdkwork/router/database.secret
SDKWORK_CLAW_DATABASE_SSL_MODE=require
SDKWORK_CLAW_DATABASE_MAX_CONNECTIONS=20
# SDKWORK_CLAW_DATABASE_URL=postgresql://sdkwork_ai_prod:change-me@db.example.com:5432/sdkwork_ai_prod
SDKWORK_<APPLICATION_CODE>_SERVER_BIND=0.0.0.0:3900
SDKWORK_<APPLICATION_CODE>_TRUST_FORWARDED_HEADERS=1
```

### 10.6 Container Deployment

Use when the application runs in Docker, Kubernetes, or another container runtime.

Required behavior:

- Read config from mounted files and process env.
- Store mutable data on mounted volumes or external services.
- Do not bake secrets into the image.
- Prefer service DNS names for internal API targets.
- Declare `environment`, `deployment_profile = "cloud"`, and `runtime_target = "container"` for cloud images. Use `deployment_profile = "standalone"` only for a documented single-container standalone package.

Example container env:

```text
SDKWORK_<APPLICATION_CODE>_CONFIG_FILE=/etc/sdkwork/<application-code>/<app>.toml
SDKWORK_<APPLICATION_CODE>_ENVIRONMENT=production
SDKWORK_<APPLICATION_CODE>_CONFIG_PROFILE=prod
SDKWORK_<APPLICATION_CODE>_DEPLOYMENT_PROFILE=cloud
SDKWORK_<APPLICATION_CODE>_RUNTIME_TARGET=container
SDKWORK_CLAW_DATABASE_ENGINE=postgresql
SDKWORK_CLAW_DATABASE_HOST=postgres
SDKWORK_CLAW_DATABASE_PORT=5432
SDKWORK_CLAW_DATABASE_NAME=sdkwork_ai_prod
SDKWORK_CLAW_DATABASE_SCHEMA=sdkwork_ai_prod
SDKWORK_CLAW_DATABASE_USERNAME=sdkwork_ai_prod
SDKWORK_CLAW_DATABASE_PASSWORD_FILE=/run/secrets/sdkwork/database-password
SDKWORK_CLAW_DATABASE_MAX_CONNECTIONS=20
# SDKWORK_CLAW_DATABASE_URL=postgresql://sdkwork_ai_prod:change-me@postgres:5432/sdkwork_ai_prod
SDKWORK_<APPLICATION_CODE>_SERVER_BIND=0.0.0.0:3900
```

## 11. sdkwork-claw-router Application Env

The SdkWork Claw Router product uses the `SDKWORK_CLAW_` prefix for private process values and `PORTAL_PUBLIC_` for browser-visible portal values.

Claw Router release and operations docs also reference the cross-product shorthand aliases `SDKWORK_<APP>_DATABASE_ENGINE` and `SDKWORK_<APP>_DATABASE_SSL_MODE`; these map to the canonical `SDKWORK_<APPLICATION_CODE>_DATABASE_ENGINE` and `SDKWORK_<APPLICATION_CODE>_DATABASE_SSL_MODE` keys defined in section 4.

Standalone server/single-container and cloud deployments default to PostgreSQL.
Desktop runtime targets default to SQLite.

### 11.1 Runtime Config Precedence

Claw Router startup must resolve runtime configuration in this order:

1. Built-in deployment-profile and runtime-target defaults.
2. Canonical runtime TOML path defined by `RUNTIME_DIRECTORY_SPEC.md`.
3. `SDKWORK_CLAW_CONFIG_FILE`.
4. Private process env overrides such as `SDKWORK_CLAW_DATABASE_URL`.
5. CLI flags for development, smoke tests, or explicit one-shot operations.

Rules:

- `SDKWORK_CLAW_DEPLOYMENT_PROFILE=standalone` is the default for archive, service, single-container, and desktop releases.
- `SDKWORK_CLAW_DEPLOYMENT_PROFILE=cloud` is the default for cloud image/bundle releases.
- `SDKWORK_CLAW_ENVIRONMENT`, `SDKWORK_CLAW_CONFIG_PROFILE`, and
  `SDKWORK_CLAW_DEPLOYMENT_PROFILE`, and `SDKWORK_CLAW_RUNTIME_TARGET` must be
  resolved before database, Redis, or SDK base URL defaults are selected.
- `SDKWORK_CLAW_CONFIG_FILE` may point to any administrator-managed TOML file.
- `SDKWORK_CLAW_DATABASE_URL` overrides TOML database fields only as an explicit operator override.
- `SDKWORK_CLAW_DATABASE_MAX_CONNECTIONS` overrides `[database].max_connections` in TOML.
- If a config file is missing, startup tooling should initialize the default TOML file before validation.
- Server startup must create an explicit structured PostgreSQL runtime config when no database is configured.
- Server startup must fail closed when PostgreSQL configuration still uses the generated placeholder host or password.
- Desktop startup may initialize a local SQLite database automatically.

### 11.2 Runtime Directory Paths

| Target | Config file | Data directory | Default database |
| --- | --- | --- | --- |
| Linux server/service/container | `/etc/sdkwork/router/clawrouter.toml` | `/var/lib/sdkwork/router` | PostgreSQL through structured TOML fields |
| Windows server/service | `%ProgramData%/sdkwork/router/clawrouter.toml` | `%ProgramData%/sdkwork/router/Data` | PostgreSQL through structured TOML fields |
| macOS server/service | `/Library/Application Support/sdkwork/router/clawrouter.toml` | `/Library/Application Support/sdkwork/router/Data` | PostgreSQL through structured TOML fields |
| Linux desktop | `~/.sdkwork/router/config/clawrouter.toml` | `~/.sdkwork/router/data` | `sqlite://~/.sdkwork/router/data/clawrouter.sqlite` |
| Windows desktop | `%USERPROFILE%/.sdkwork/router/config/clawrouter.toml` | `%USERPROFILE%/.sdkwork/router/data` | `sqlite://%USERPROFILE%/.sdkwork/router/data/clawrouter.sqlite` |
| macOS desktop | `~/.sdkwork/router/config/clawrouter.toml` | `~/.sdkwork/router/data` | `sqlite://~/.sdkwork/router/data/clawrouter.sqlite` |

Rules:

- Release packages must include `config/clawrouter.toml.example`.
- Release packages must not include `.env.release.local`.
- Host-local env files may be generated during install initialization, but secrets must remain on the target host. Linux service packages should use `/etc/sdkwork/router/clawrouter.env` for process overrides and `/etc/sdkwork/router/database.secret` for the default PostgreSQL password file.
- Desktop SQLite files must live under the SDKWork user private data directory, not beside the executable.
- Server mutable state belongs under the OS service data directory or a mounted volume.
- Historical desktop paths such as XDG or display-name based locations may be read as compatibility fallbacks during migration, but canonical writes must target `~/.sdkwork/router` or the Windows equivalent `%USERPROFILE%/.sdkwork/router`.

### 11.3 Development

```text
SDKWORK_CLAW_DEPLOYMENT_PROFILE=standalone
SDKWORK_CLAW_ENVIRONMENT=development
SDKWORK_CLAW_CONFIG_PROFILE=dev
SDKWORK_CLAW_RUNTIME_TARGET=server
SDKWORK_CLAW_DATABASE_ENGINE=postgresql
SDKWORK_CLAW_DATABASE_HOST=127.0.0.1
SDKWORK_CLAW_DATABASE_PORT=5432
SDKWORK_CLAW_DATABASE_NAME=sdkwork_ai_dev
SDKWORK_CLAW_DATABASE_SCHEMA=sdkwork_ai_dev
SDKWORK_CLAW_DATABASE_USERNAME=sdkwork_ai_dev
SDKWORK_CLAW_DATABASE_PASSWORD=sdkworkdev123
SDKWORK_CLAW_DATABASE_SSL_MODE=disable
SDKWORK_CLAW_DATABASE_MAX_CONNECTIONS=10
SDKWORK_CLAW_DATABASE_ADMIN_HOST=127.0.0.1
SDKWORK_CLAW_DATABASE_ADMIN_PORT=5432
SDKWORK_CLAW_DATABASE_ADMIN_USERNAME=postgres
SDKWORK_CLAW_DATABASE_ADMIN_PASSWORD=postgres_admin_pass
SDKWORK_CLAW_DATABASE_ADMIN_DATABASE=postgres
SDKWORK_CLAW_DATABASE_ADMIN_SSL_MODE=disable
# SDKWORK_CLAW_DATABASE_URL=postgresql://sdkwork_ai_dev:sdkworkdev123@127.0.0.1:5432/sdkwork_ai_dev?sslmode=disable
SDKWORK_CLAW_REDIS_ENABLED=true
SDKWORK_CLAW_REDIS_HOST=redis.example.com
SDKWORK_CLAW_REDIS_PORT=6379
SDKWORK_CLAW_REDIS_DATABASE=0
# SDKWORK_CLAW_REDIS_URL=redis://redis.example.com:6379/0
SDKWORK_CLAW_REDIS_KEY_PREFIX=clawrouter
SDKWORK_CLAW_REDIS_TLS=false
SDKWORK_CLAW_REDIS_MAX_CONNECTIONS=16
SDKWORK_CLAW_REDIS_CONNECT_TIMEOUT_MILLIS=2000
SDKWORK_CLAW_REDIS_COMMAND_TIMEOUT_MILLIS=1000
SDKWORK_CLAW_REDIS_POOL_IDLE_TIMEOUT_SECONDS=60
SDKWORK_CLAW_SERVER_BIND=127.0.0.1:3900
SDKWORK_CLAW_GATEWAY_BIND=127.0.0.1:3901
SDKWORK_CLAW_ADMIN_API_BIND=127.0.0.1:3902
SDKWORK_CLAW_APP_API_BIND=127.0.0.1:3903
SDKWORK_CLAW_API_KEY_PEPPER=development-only-change-me
SDKWORK_CLAW_TRUSTED_SUBJECT_SECRET=development-only-change-me
SDKWORK_CLAW_APP_SESSION_SECRET=development-only-change-me
# /v1 is valid here only for an explicitly documented OpenAI-compatible API.
# SDKWork-owned business open-api domains use their approved prefix, for example /im/v3/api.
PORTAL_PUBLIC_API_BASE_URL=/v1
PORTAL_PUBLIC_OPEN_API_BASE_URL=/v1
PORTAL_PUBLIC_APP_API_BASE_URL=/app/v3/api
PORTAL_PUBLIC_BACKEND_API_BASE_URL=/backend/v3/api
PORTAL_PUBLIC_TOOL_API_ENABLED=false
```

Claw Router checks in `.env.postgres.example` with these local PostgreSQL
fields. Developers may copy it to `.env.postgres`; that override is host-local
and excluded from source control. Startup scripts assemble the split fields into
`SDKWORK_CLAW_DATABASE_URL` for Rust services only after validation.

This development PostgreSQL profile is for the workspace server/runtime
integration path. It does not change the desktop runtime profile. Desktop
packages and desktop user data remain SQLite by default at
`~/.sdkwork/router/data/clawrouter.sqlite` or the equivalent Windows user
profile path.

### 11.4 Desktop Install

```text
SDKWORK_CLAW_DEPLOYMENT_PROFILE=standalone
SDKWORK_CLAW_ENVIRONMENT=production
SDKWORK_CLAW_CONFIG_PROFILE=prod
SDKWORK_CLAW_RUNTIME_TARGET=desktop
SDKWORK_CLAW_CONFIG_FILE=~/.sdkwork/router/config/clawrouter.toml
SDKWORK_CLAW_DATABASE_MAX_CONNECTIONS=1
SDKWORK_CLAW_REDIS_ENABLED=false
SDKWORK_CLAW_REDIS_HOST=redis.example.com
SDKWORK_CLAW_REDIS_PORT=6379
SDKWORK_CLAW_REDIS_DATABASE=0
# SDKWORK_CLAW_REDIS_URL=redis://redis.example.com:6379/0
SDKWORK_CLAW_REDIS_KEY_PREFIX=clawrouter
SDKWORK_CLAW_REDIS_TLS=false
SDKWORK_CLAW_REDIS_MAX_CONNECTIONS=4
SDKWORK_CLAW_REDIS_CONNECT_TIMEOUT_MILLIS=2000
SDKWORK_CLAW_REDIS_COMMAND_TIMEOUT_MILLIS=1000
SDKWORK_CLAW_REDIS_POOL_IDLE_TIMEOUT_SECONDS=60
# /v1 is valid here only for an explicitly documented OpenAI-compatible API.
# SDKWork-owned business open-api domains use their approved prefix, for example /im/v3/api.
PORTAL_PUBLIC_API_BASE_URL=/v1
PORTAL_PUBLIC_OPEN_API_BASE_URL=/v1
PORTAL_PUBLIC_APP_API_BASE_URL=/app/v3/api
PORTAL_PUBLIC_BACKEND_API_BASE_URL=/backend/v3/api
```

Desktop installers should generate a user config file and a SQLite database under the SDKWork user private directories when no explicit database URL is configured.
Desktop packages must not require PostgreSQL for first run. If an advanced user
explicitly configures PostgreSQL, that is an override of the desktop default,
not the product default.

Example Linux desktop config:

```toml
[runtime]
environment = "production"
deployment_profile = "standalone"
runtime_target = "desktop"
config_profile = "prod"

[database]
engine = "sqlite"
file = "~/.sdkwork/router/data/clawrouter.sqlite"
max_connections = 1

[redis]
enabled = false
host = "redis.example.com"
port = 6379
database = 0
# username = "default"
# url = "redis://redis.example.com:6379/0"
key_prefix = "clawrouter"
tls = false
max_connections = 4
connect_timeout_ms = 2000
command_timeout_ms = 1000
pool_idle_timeout_seconds = 60
```

### 11.5 Server Release

```text
SDKWORK_CLAW_DEPLOYMENT_PROFILE=standalone
SDKWORK_CLAW_ENVIRONMENT=production
SDKWORK_CLAW_CONFIG_PROFILE=prod
SDKWORK_CLAW_RUNTIME_TARGET=server
SDKWORK_CLAW_CONFIG_FILE=/etc/sdkwork/router/clawrouter.toml
SDKWORK_CLAW_DATABASE_MAX_CONNECTIONS=16
SDKWORK_CLAW_REDIS_ENABLED=true
SDKWORK_CLAW_REDIS_HOST=redis.example.com
SDKWORK_CLAW_REDIS_PORT=6379
SDKWORK_CLAW_REDIS_DATABASE=0
# SDKWORK_CLAW_REDIS_URL=redis://redis.example.com:6379/0
SDKWORK_CLAW_SERVER_BIND=0.0.0.0:3900
SDKWORK_CLAW_EDGE_SERVER=1
SDKWORK_CLAW_EDGE_EXTERNAL_SCHEME=https
SDKWORK_CLAW_EDGE_TRUST_FORWARDED_HEADERS=1
# /v1 is valid here only for an explicitly documented OpenAI-compatible API.
# SDKWork-owned business open-api domains use their approved prefix, for example /im/v3/api.
PORTAL_PUBLIC_API_BASE_URL=/v1
PORTAL_PUBLIC_OPEN_API_BASE_URL=/v1
PORTAL_PUBLIC_APP_API_BASE_URL=/app/v3/api
PORTAL_PUBLIC_BACKEND_API_BASE_URL=/backend/v3/api
PORTAL_PUBLIC_TOOL_API_ENABLED=false
SDKWORK_CLAW_EDGE_CSP_CONNECT_SRC=
SDKWORK_CLAW_TOOL_API_RATE_LIMIT_REQUESTS=120
SDKWORK_CLAW_TOOL_API_RATE_LIMIT_WINDOW_SECONDS=60
SDKWORK_CLAW_TOOL_API_SDK_GENERATOR_BASE_URL=
SDKWORK_CLAW_TOOL_API_SDK_ARCHIVE_ROOT=
```

Private edge-server env keys use the `SDKWORK_CLAW_EDGE_*` and `SDKWORK_CLAW_TOOL_API_*`
prefixes. The Rust edge gateway reads these canonical names first and accepts legacy
`PORTAL_TOOL_API_*`, `PORTAL_CSP_*`, `PORTAL_SECURITY_*`, and `PORTAL_STATIC_*` aliases
only as a read-only migration fallback. New release-host configuration must not assign
legacy private edge keys.

Example Linux server config:

```toml
[runtime]
environment = "production"
deployment_profile = "standalone"
runtime_target = "server"
config_profile = "prod"

[database]
engine = "postgresql"
host = "db.internal"
port = 5432
database = "sdkwork_ai_prod"
schema = "sdkwork_ai_prod"
username = "sdkwork_ai_prod"
password_file = "/etc/sdkwork/router/database.secret"
# password = "real-password"
ssl_mode = "require"
max_connections = 16

[redis]
enabled = true
host = "redis.example.com"
port = 6379
database = 0
# username = "default"
# url = "redis://redis.example.com:6379/0"
password_file = "/etc/sdkwork/router/redis.secret"
key_prefix = "clawrouter"
tls = false
max_connections = 16
connect_timeout_ms = 2000
command_timeout_ms = 1000
pool_idle_timeout_seconds = 60

[paths]
data_directory = "/var/lib/sdkwork/router"
```

For Claw Router, Redis is enabled and required by default for server and
container deployments. Keep `[redis].enabled = true`, set `[redis].host`,
`[redis].port`, and `[redis].database` before first startup, and use
`[redis].url` only as an advanced managed-endpoint override. Prefer
`[redis].password_file` over direct `[redis].password`. Desktop deployments
keep Redis optional and disabled by default.

### 11.6 Cloud Split-Service Deployment

Use when the portal edge service forwards to separate internal gateway, app API, and `backend-admin` API services.

```text
SDKWORK_CLAW_DEPLOYMENT_PROFILE=cloud
SDKWORK_CLAW_RUNTIME_TARGET=container
SDKWORK_CLAW_EDGE_GATEWAY_BASE_URL=http://gateway.internal:18080
SDKWORK_CLAW_EDGE_APP_API_BASE_URL=http://app-api.internal:18082
SDKWORK_CLAW_EDGE_BACKEND_API_BASE_URL=http://admin-api.internal:18081
# /v1 is valid here only for an explicitly documented OpenAI-compatible API.
# SDKWork-owned business open-api domains use their approved prefix, for example /im/v3/api.
PORTAL_PUBLIC_API_BASE_URL=/v1
PORTAL_PUBLIC_OPEN_API_BASE_URL=/v1
PORTAL_PUBLIC_APP_API_BASE_URL=/app/v3/api
PORTAL_PUBLIC_BACKEND_API_BASE_URL=/backend/v3/api
```

If a tenant exposes the documented OpenAI-compatible API from a different public host, `/v1` remains valid as the compatibility prefix:

```text
PORTAL_PUBLIC_API_BASE_URL=https://docs-api.example.com/v1
PORTAL_PUBLIC_OPEN_API_BASE_URL=https://open-api.example.com/v1
PORTAL_PUBLIC_APP_API_BASE_URL=https://app-api.example.com/app/v3/api
PORTAL_PUBLIC_BACKEND_API_BASE_URL=https://admin-api.example.com/backend/v3/api
```

If the override is for a SDKWork-owned business open-api domain, use that domain's approved prefix:

```text
PORTAL_PUBLIC_OPEN_API_BASE_URL=https://im-api.example.com/im/v3/api
PORTAL_PUBLIC_APP_API_BASE_URL=https://app-api.example.com/app/v3/api
PORTAL_PUBLIC_BACKEND_API_BASE_URL=https://admin-api.example.com/backend/v3/api
```

## 12. Release Env Files

Release env files are host-local artifacts.

Rules:

- Checked-in `.env.release.example` files are references only.
- `.env.release.local` must be generated on the release host and must not be committed.
- Release env writers must print safe summaries only and must not echo secrets.
- Strict release preflight must validate required values before packaging.
- Optional public overrides, such as `PORTAL_PUBLIC_OPEN_API_BASE_URL`, may be omitted when they inherit a required base URL.

Minimum release host contract for `sdkwork-claw-router`:

```text
SDKWORK_CLAW_POSTGRES_TEST_DATABASE_URL=postgres://user:password@host:5432/db
# /v1 is valid here only for an explicitly documented OpenAI-compatible API.
# SDKWork-owned business open-api domains use their approved prefix, for example /im/v3/api.
PORTAL_PUBLIC_API_BASE_URL=/v1
PORTAL_PUBLIC_OPEN_API_BASE_URL=/v1
PORTAL_PUBLIC_APP_API_BASE_URL=/app/v3/api
PORTAL_PUBLIC_BACKEND_API_BASE_URL=/backend/v3/api
PORTAL_PUBLIC_TOOL_API_ENABLED=false
```

## 13. Security Rules

- Secrets must not appear in browser runtime env, static assets, generated SDK examples, logs, screenshots, telemetry attributes, or committed templates.
- Database URLs are private unless they point to a local non-secret disposable test database.
- Public runtime env must be served with `Cache-Control: no-store` when values can vary per deployment.
- CSP `connect-src` must include only validated absolute API origins and the application origin.
- Env parsing must fail closed on malformed URLs, invalid booleans, invalid numbers, and missing required release secrets.
- Local development default secrets must be clearly marked as development-only.
- Env and public runtime config may expose locale strategy values such as default locale, supported locales, fallback locale, and message-catalog manifest URL, but must not embed translated message catalogs, L1 brand/store copy overrides, or generated locale bundle contents.

## 14. Validation And Tests

Every application that adopts this standard should provide:

- Unit tests for env parsing and default resolution.
- Profile normalization tests for `dev -> development`, `prod -> production`, and rejection of unknown profile names.
- Runtime target tests for browser, desktop, tablet, Capacitor, Flutter, mini program, native Android, native iOS, native Harmony, server, container, and test-runner defaults.
- Config file parsing tests for canonical and explicit paths.
- Release preflight validation for required production variables.
- Browser runtime env tests that verify public values load before SDK clients are constructed.
- Browser public runtime tests that verify no secret, database URL, Redis URL, token, signing key, or private endpoint is emitted through `/runtime-env.js`, `PORTAL_PUBLIC_*`, or `VITE_*`.
- I18n runtime config tests that verify env/public config contains only locale strategy and message-catalog manifest references, not translated message content or app/root/package locale monoliths.
- Database selection tests for desktop SQLite and server PostgreSQL behavior.
- Test-profile isolation tests for database/schema names, Redis key prefix, logs, cache, runtime, and temp directories.
- Tauri/native config tests that verify platform config contains packaging metadata, permissions, capabilities, and signing references only, not API secrets or business SDK contracts.
- Script syntax checks for env writer, preflight, installer, and production starter scripts.
- Security tests that prevent private env values from being emitted to public runtime config.

Acceptance checklist:

- [ ] Env names follow the product and capability prefix rules.
- [ ] `SDKWORK_<APPLICATION_CODE>_ENVIRONMENT`, `SDKWORK_<APPLICATION_CODE>_CONFIG_PROFILE`, `SDKWORK_<APPLICATION_CODE>_DEPLOYMENT_PROFILE`, and `SDKWORK_<APPLICATION_CODE>_RUNTIME_TARGET` are normalized and validated separately.
- [ ] Dev/test/staging/prod example files exist where applicable and local overrides are ignored.
- [ ] Public values are separated from private and secret values.
- [ ] Generated SDK base URLs resolve from one common SDK root plus optional per-surface or per-SDK overrides; effective open-api, app-api, and backend-api URLs are explicit after resolution.
- [ ] Locale env/public runtime values contain only default/supported/fallback locale strategy and message-catalog manifest references; translated messages remain in `I18N_SPEC.md` message-catalog fragments.
- [ ] Server release defaults require PostgreSQL.
- [ ] PostgreSQL development templates use `.env.postgres.example` with unified `SDKWORK_CLAW_DATABASE_*` fields from `ENVIRONMENT_SPEC.md` §7.1 and `sdkwork-specs/templates/env.postgres.example`.
- [ ] Checked-in topology profiles and release env files do not define per-app PostgreSQL database names, usernames, passwords, or schemas that differ from the unified claw-router profile.
- [ ] Workspace verification passes: `node ../sdkwork-specs/tools/check-unified-postgres-profile.mjs` from each application root (or once from workspace root).
- [ ] Legacy database env aliases such as `DATABASE_PROVIDER` and `DATABASE_SSLMODE` are rejected for new apps.
- [ ] Database lifecycle env keys follow `DATABASE_FRAMEWORK_SPEC.md` when the repository owns a `database/` module.
- [ ] Desktop install defaults to SQLite in the SDKWork user private data directory.
- [ ] Desktop installed config, desktop-started server dev config, browser public runtime config, H5/Capacitor config, Flutter config, mini program config, container config, and Tauri platform config are separate files or clearly separate sections.
- [ ] Test config isolates database/schema, Redis key prefix, logs, cache, runtime, and temp directories.
- [ ] Runtime config file path can be specified explicitly.
- [ ] Canonical runtime directory paths are documented for Linux, macOS, Windows, and containers.
- [ ] Release env files are generated locally and excluded from source control.
- [ ] Strict validation covers URLs, booleans, numbers, secrets, and unknown keys.

## 15. RPC Environment Variables

RPC runtime variables are private process variables unless explicitly documented as browser-visible gRPC-Web configuration.

| Variable | Visibility | Required | Description |
| --- | --- | --- | --- |
| `SDKWORK_<APPLICATION_CODE>_RPC_ENABLED` | private | MAY | Enables the app/domain RPC server. |
| `SDKWORK_<APPLICATION_CODE>_RPC_BIND_ADDR` | private | SHOULD when RPC is enabled | Bind address such as `127.0.0.1:50051` for standalone desktop/dev targets or `0.0.0.0:50051` behind approved ingress. |
| `SDKWORK_<APPLICATION_CODE>_RPC_PUBLIC_ENDPOINT` | private/public by deployment | MAY | Endpoint published to generated external RPC clients. |
| `SDKWORK_<APPLICATION_CODE>_RPC_TLS_ENABLED` | private | SHOULD for production | Enables server TLS. |
| `SDKWORK_<APPLICATION_CODE>_RPC_MTLS_ENABLED` | private | SHOULD for service-to-service production | Requires client certificates. |
| `SDKWORK_<APPLICATION_CODE>_RPC_REFLECTION_ENABLED` | private | MAY | Enables gRPC reflection. Must be disabled or access-controlled in public production. |
| `SDKWORK_<APPLICATION_CODE>_RPC_HEALTH_ENABLED` | private | SHOULD | Enables gRPC health service. |
| `SDKWORK_<APPLICATION_CODE>_RPC_GRPC_WEB_ENABLED` | private | MAY | Enables gRPC-Web bridge for approved browser clients. |
| `SDKWORK_<APPLICATION_CODE>_RPC_DEFAULT_DEADLINE_MS` | private | MAY | Default client/server deadline in milliseconds. |
| `SDKWORK_<APPLICATION_CODE>_RPC_RESOLVER_PROFILE` | private | SHOULD when RPC clients use dynamic resolution | `static`, `static-composite`, `discovery`, or `composite`. |
| `SDKWORK_<APPLICATION_CODE>_RPC_RESILIENCE_PROFILE` | private | MAY | Default resilience profile from `RPC_RESILIENCE_SPEC.md`. |
| `SDKWORK_<APPLICATION_CODE>_DISCOVERY_ENDPOINT` | private | SHOULD when resolver profile is `discovery` or `composite` | gRPC endpoint for `sdkwork-discovery` application ingress. |

Rules:

- RPC endpoint variables MUST reject query strings, fragments, control characters, and non-HTTP(S) schemes unless a runtime explicitly documents a Unix domain socket or named-pipe transport.
- TLS certificate paths and private keys are secrets or secret-bearing config and MUST NOT be exposed to browser runtime config.
- `PORTAL_PUBLIC_*_RPC_ENDPOINT` variables MAY exist only for approved gRPC-Web clients and must follow the same public-runtime validation rules as HTTP SDK base URLs.
- Shared modules MUST receive RPC clients through bootstrap/service injection; they must not read RPC environment variables directly.
- Discovery process variables use the `SDKWORK_DISCOVERY_` prefix and are defined in section 16.

## 16. Discovery Environment Variables

Discovery runtime variables are private process variables for `sdkwork-discovery` and discovery-aware RPC resolvers.

| Variable | Visibility | Required | Description |
| --- | --- | --- | --- |
| `SDKWORK_DISCOVERY_CONFIG_FILE` | private | MAY | Host-local discovery config file path selector. |
| `SDKWORK_DISCOVERY_ENVIRONMENT` | private | SHOULD | Lifecycle environment for registry/config scope. |
| `SDKWORK_DISCOVERY_CONFIG_PROFILE` | private | MAY | Config profile alias such as `dev`, `test`, `staging`, `prod`. |
| `SDKWORK_DISCOVERY_HOSTING` | private | MAY | Hosting archetype such as `self-hosted` or `cloud-hosted`. |
| `SDKWORK_DISCOVERY_SERVICE_LAYOUT` | private | MAY | Service layout such as `unified-process` or split services. |
| `SDKWORK_DISCOVERY_APPLICATION_PUBLIC_INGRESS_BIND` | private | SHOULD | Bind address for application registry/config ingress. |
| `SDKWORK_DISCOVERY_APPLICATION_PUBLIC_GRPC_URL` | private | SHOULD | Published gRPC URL for registry/config clients. |
| `SDKWORK_DISCOVERY_OPERATIONS_CONTROL_INGRESS_BIND` | private | MAY | Bind address for operator/admin ingress. |
| `SDKWORK_DISCOVERY_OPERATIONS_CONTROL_GRPC_URL` | private | MAY | Published gRPC URL for admin clients. |
| `SDKWORK_DISCOVERY_STORAGE_PROVIDER` | private | SHOULD | `memory`, `sqlite`, `postgres`, `redis`, `etcd`, or `consul`. |
| `SDKWORK_DISCOVERY_DATABASE_ENGINE` | private | MAY | Canonical database engine alias that must agree with storage provider when both are set. |
| `SDKWORK_DISCOVERY_RPC_TLS_ENABLED` | private | SHOULD for production | Enables discovery server TLS. |
| `SDKWORK_DISCOVERY_RPC_MTLS_ENABLED` | private | SHOULD for service-to-service production | Requires client certificates on discovery ingress. |
| `SDKWORK_DISCOVERY_RPC_AUTH_MODE` | private | SHOULD | Discovery RPC auth mode such as service-token. |
| `SDKWORK_DISCOVERY_RPC_ALLOW_UNSIGNED_LOCAL_CONTEXT` | private | MAY | Development/test loopback-only unsigned caller context. |
| `SDKWORK_DISCOVERY_WATCH_ENABLED` | private | MAY | Enables watch RPC services. |
| `SDKWORK_DISCOVERY_METRICS_BIND` | private | MAY | Prometheus metrics bind address when enabled. |

Rules:

- Application-owned RPC services MUST NOT overload `SDKWORK_DISCOVERY_*` keys for non-discovery behavior.
- Production discovery config MUST reject unsigned local context, inline secrets, and non-durable storage providers per `DISCOVERY_SPEC.md`.
- RPC client resolvers SHOULD read `SDKWORK_<APPLICATION_CODE>_DISCOVERY_ENDPOINT` or topology-provided discovery URLs instead of hard-coded peer lists.
