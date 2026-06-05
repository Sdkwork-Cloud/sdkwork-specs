# Environment Variable And Runtime Configuration Standard

- Version: 1.0
- Scope: environment variables, runtime config files, public browser runtime config, secrets, database selection, desktop/server/container deployment modes, SDK base URLs, RPC endpoints
- Related: `CONFIG_SPEC.md`, `RUNTIME_DIRECTORY_SPEC.md`, `DEPLOYMENT_SPEC.md`, `DATABASE_SPEC.md`, `SECURITY_SPEC.md`, `SDK_SPEC.md`, `RPC_SPEC.md`, `RUST_RPC_SPEC.md`, `APPLICATION_SPEC.md`, `TEST_SPEC.md`

This standard defines the canonical environment and runtime configuration model for SDKWork applications. It exists to prevent each application from inventing different `.env` names, database defaults, SDK base URL rules, config file locations, and secret handling behavior.

`CONFIG_SPEC.md` defines the typed runtime config contract inside application code. This document defines the external operating contract: environment variables, config files, deployment-mode defaults, and validation rules.

## 1. Design Goals

Environment configuration must satisfy these goals:

- One application can run in development, test, staging, and production without code changes.
- One product can support browser, desktop, service/server, and container deployment modes with explicit defaults.
- Server-side release deployments use PostgreSQL by default.
- Desktop installs use SQLite by default in the SDKWork user private data directory defined by `RUNTIME_DIRECTORY_SPEC.md`.
- Desktop/Tauri development commands that start backend services use the server PostgreSQL development profile by default; SQLite is used only by explicit local-data profiles or installed desktop runtime config.
- Every database setting can be specified in a runtime config file and overridden by environment variables for emergency operations.
- Browser-visible values are separated from private process values.
- Generated SDK clients receive per-surface base URLs, not one ambiguous global URL.
- Secrets are never committed, never served through browser runtime config, and never logged in plaintext.

## 2. Terms

| Term | Meaning |
| --- | --- |
| Environment | Lifecycle stage: `development`, `test`, `staging`, or `production`. |
| Deployment mode | Runtime architecture: `desktop`, `server`, `container`, `saas`, `private`, `local`, or `test`. |
| Process env | Environment variables available to a service process. |
| Runtime config file | Host-local TOML/YAML/JSON config file loaded at startup. TOML is preferred for SDKWork Rust services. |
| Public runtime env | Browser-visible values served through a controlled endpoint such as `/runtime-env.js`. |
| Secret | Password, token, signing key, webhook secret, API key, private connection string, or credential material. |
| SDK surface | Generated SDK family or API surface, such as Open API, app API, backend/admin API, or AI API. |

## 3. Source Precedence

Configuration sources must be resolved in this order:

1. Built-in safe defaults for local development and desktop-only non-secret settings.
2. Runtime config file from the canonical runtime directory or explicit config path.
3. Process environment variables.
4. Command-line arguments for one-shot local development or test commands.
5. Secret manager or OS secure storage for secrets when the deployment platform provides one.

Rules:

- Process env overrides config file values.
- Command-line arguments may override process env only for local development and test tooling, not production service managers.
- Public browser runtime env must be generated from validated process or config-file values by the trusted server.
- Shared modules must not read process env directly. Bootstrap code reads env and constructs typed runtime config.
- Unknown keys in strict release config should fail validation unless explicitly marked as extension keys.

## 4. Naming Standard

Environment variable names must follow this format:

```text
<PRODUCT_OR_PLATFORM>_<APP_OR_CAPABILITY>_<SETTING>
```

For application-specific products:

```text
SDKWORK_CLAW_<SETTING>
SDKWORK_<APP_CODE>_<SETTING>
```

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
- Use one product prefix per product family.
- Use capability names that match `DOMAIN_SPEC.md` and `SDK_SPEC.md`.
- Do not use generic names such as `GATEWAY_API_BASE_URL` when the consuming SDK surface is more specific. Prefer `OPEN_API_BASE_URL`, `APP_API_BASE_URL`, or `BACKEND_API_BASE_URL`.
- Do not put secrets in names prefixed with `PORTAL_PUBLIC_`, `VITE_`, `PUBLIC_`, `NEXT_PUBLIC_`, or any variable that is exposed to browser code.
- Boolean variables must accept only `true`, `false`, `1`, or `0` after normalization.
- URL variables must reject query strings, fragments, control characters, protocol-relative URLs, and non-HTTP schemes unless the specific setting is documented as a database URL.

## 5. Standard Environment Variables

These variables form the baseline for SDKWork applications.

| Variable | Visibility | Required | Description |
| --- | --- | --- | --- |
| `SDKWORK_<APP>_ENVIRONMENT` | private | SHOULD | Lifecycle stage: `development`, `test`, `staging`, `production`. |
| `SDKWORK_<APP>_DEPLOYMENT_MODE` | private | SHOULD | Runtime architecture: `desktop`, `server`, `container`, `saas`, `private`, `local`, `test`. |
| `SDKWORK_<APP>_CONFIG_FILE` | private | MAY | Explicit runtime config file path. |
| `SDKWORK_<APP>_DATABASE_ENGINE` | private | MAY | Database engine, normally `postgresql` for server/container and `sqlite` for desktop/local-only. |
| `SDKWORK_<APP>_DATABASE_HOST` | private | MAY | PostgreSQL host. Prefer this structured field over a URL for release deployments. |
| `SDKWORK_<APP>_DATABASE_PORT` | private | MAY | PostgreSQL port, normally `5432`. |
| `SDKWORK_<APP>_DATABASE_NAME` | private | MAY | PostgreSQL database name. |
| `SDKWORK_<APP>_DATABASE_SCHEMA` | private | MAY | PostgreSQL schema, normally `public` unless the app standard says otherwise. |
| `SDKWORK_<APP>_DATABASE_USERNAME` | private | MAY | PostgreSQL username. |
| `SDKWORK_<APP>_DATABASE_PASSWORD_FILE` | secret | MAY | PostgreSQL password file path. Prefer this over direct password values. |
| `SDKWORK_<APP>_DATABASE_PASSWORD` | secret | MAY | Direct PostgreSQL password override, allowed only for protected process environments or secret-bearing config files. |
| `SDKWORK_<APP>_DATABASE_SSL_MODE` | private | MAY | PostgreSQL SSL mode. Production deployments should use `require`, `verify-ca`, or `verify-full` where supported. |
| `SDKWORK_<APP>_DATABASE_URL` | private | MAY | Explicit database URL override. Server release packages should prefer structured runtime config fields for PostgreSQL; desktop and local development may use SQLite. |
| `SDKWORK_<APP>_DATABASE_FILE` | private | MAY | SQLite database file path for desktop/local-only deployments. |
| `SDKWORK_<APP>_DATABASE_MAX_CONNECTIONS` | private | MAY | Database pool limit. |
| `SDKWORK_<APP>_REDIS_ENABLED` | private | MAY | Enables the Redis adapter. Server and container deployments default to `true` and require Redis; desktop and local-only deployments default to `false` unless shared infrastructure is explicitly enabled. |
| `SDKWORK_<APP>_REDIS_HOST` | private | MAY | Redis host used when Redis is enabled. Prefer this structured field over a URL. |
| `SDKWORK_<APP>_REDIS_PORT` | private | MAY | Redis port used when Redis is enabled. Defaults should normally use `6379`. |
| `SDKWORK_<APP>_REDIS_DATABASE` | private | MAY | Redis logical database index used when Redis is enabled. Defaults should normally use `0`. |
| `SDKWORK_<APP>_REDIS_USERNAME` | private | MAY | Optional Redis username, for ACL-enabled Redis deployments. |
| `SDKWORK_<APP>_REDIS_URL` | private | MAY | Advanced Redis URL override used only when a managed endpoint cannot be represented cleanly with host, port, database, username, and TLS fields. |
| `SDKWORK_<APP>_REDIS_PASSWORD_FILE` | secret | MAY | Redis password file path. Prefer this over direct Redis password values. |
| `SDKWORK_<APP>_REDIS_PASSWORD` | secret | MAY | Direct Redis password override, allowed only for protected process environments or secret-bearing config files. |
| `SDKWORK_<APP>_REDIS_KEY_PREFIX` | private | MAY | Optional key namespace prefix for Redis data owned by the application. |
| `SDKWORK_<APP>_REDIS_TLS` | private | MAY | Enables TLS for structured Redis host/port/database configuration. Use `rediss://` when using the URL override. |
| `SDKWORK_<APP>_REDIS_MAX_CONNECTIONS` | private | MAY | Redis client pool limit. |
| `SDKWORK_<APP>_REDIS_CONNECT_TIMEOUT_MILLIS` | private | MAY | Redis connection timeout in milliseconds. |
| `SDKWORK_<APP>_REDIS_COMMAND_TIMEOUT_MILLIS` | private | MAY | Redis command timeout in milliseconds. |
| `SDKWORK_<APP>_REDIS_POOL_IDLE_TIMEOUT_SECONDS` | private | MAY | Redis idle connection lifetime in seconds. |
| `SDKWORK_<APP>_SERVER_BIND` | private | SHOULD for services | Public service bind address, for example `0.0.0.0:3900`. |
| `SDKWORK_<APP>_TRUST_FORWARDED_HEADERS` | private | MAY | Whether reverse-proxy forwarded headers are trusted. |
| `SDKWORK_<APP>_LOG_LEVEL` | private | MAY | Runtime log filter. |
| `SDKWORK_<APP>_DATA_DIR` | private | MAY | Explicit data directory override. |
| `SDKWORK_<APP>_CACHE_DIR` | private | MAY | Explicit cache directory override. |
| `SDKWORK_<APP>_LOG_DIR` | private | MAY | Explicit file log directory override. |
| `SDKWORK_<APP>_RUNTIME_DIR` | private | MAY | Explicit runtime state directory override for PID files, sockets, locks, and generated ephemeral state. |
| `SDKWORK_<APP>_TEMP_DIR` | private | MAY | Explicit temporary file directory override. |
| `SDKWORK_<APP>_API_KEY_PEPPER` | secret | REQUIRED when API keys are issued | Pepper used for API key hashing or verification. |
| `SDKWORK_<APP>_SESSION_SECRET` | secret | REQUIRED when sessions are issued | Session signing/encryption secret. |
| `SDKWORK_<APP>_WEBHOOK_SECRET` | secret | REQUIRED when webhooks are verified | Webhook signing secret. |

Application-specific variables may be added only when they have an owner, validation rule, and documentation entry.

## 6. SDK Base URL Standard

Generated SDK clients must receive independent base URLs per SDK surface.

| SDK surface | Server/runtime env | Browser runtime env | Default |
| --- | --- | --- | --- |
| Public API reference / generic OpenAPI display | `PORTAL_PUBLIC_API_BASE_URL` | `VITE_API_BASE_URL` | Same-origin API path, app-specific. |
| Open SDK / OpenAI-compatible API | `PORTAL_PUBLIC_OPEN_API_BASE_URL` | `VITE_<APP_CODE>_OPEN_API_BASE_URL` | Defaults to `PORTAL_PUBLIC_API_BASE_URL`. |
| App/user SDK | `PORTAL_PUBLIC_APP_API_BASE_URL` | `VITE_<APP_CODE>_APP_API_BASE_URL` | Same-origin app API path. |
| Backend/admin SDK | `PORTAL_PUBLIC_BACKEND_API_BASE_URL` | `VITE_<APP_CODE>_BACKEND_API_BASE_URL` | Same-origin backend/admin API path. |

Rules:

- Open SDK configuration must use `OPEN_API_BASE_URL` terminology. `gateway` can remain an internal system id when the generated schema or UI already uses it, but environment names should describe the SDK surface.
- App SDK and backend/admin SDK base URLs must remain independent because they may terminate at different hosts in private deployments.
- Defaults should be same-origin paths in browser deployments so remote browsers are not given loopback addresses.
- Absolute HTTP/HTTPS origins must be added to the production Content Security Policy `connect-src`.
- Generated SDK examples must not hard-code tenant-specific hosts.

## 7. Database Selection Standard

Database defaults depend on deployment mode.

Server and container deployments default to PostgreSQL through the runtime TOML.
Desktop/runtime local user data remains SQLite by default. Desktop/Tauri
development commands that start a backend service use PostgreSQL to exercise
server behavior, but that does not change the desktop package database default.
`SDKWORK_<APP>_DATABASE_URL` is an explicit operator override, not the primary
production configuration path.

| Deployment mode | Default database | Requirement |
| --- | --- | --- |
| `desktop` | SQLite for local user data; PostgreSQL for a launched backend service in dev | Desktop-local data uses a user-private SQLite file. Desktop-started backend services use the server PostgreSQL dev profile unless an explicit SQLite command is selected. |
| `local` | SQLite or PostgreSQL by explicit profile | Local-only desktop/user data uses SQLite. Integrated service development uses PostgreSQL to match server behavior. |
| `test` | SQLite or isolated PostgreSQL | Test DB must be isolated per test run. |
| `server` | PostgreSQL | Release/server packages must use PostgreSQL by default unless an approved local-only exception exists. |
| `container` | PostgreSQL | Database is external to the container; do not store production DB state in ephemeral layers. |
| `saas` | PostgreSQL or managed compatible service | Must satisfy `DATABASE_SPEC.md`. |
| `private` | PostgreSQL by default | SQLite is allowed only for single-user desktop/private appliances with documented limits. |

Rules:

- Server release packages must generate an explicit structured PostgreSQL config with host, database, username, and secret handling fields.
- Desktop packages and desktop runtime profiles must keep local user data on
  SQLite by default. They must create the SQLite file under the SDKWork user
  private data directory, not under server data directories and not in
  PostgreSQL, unless the user explicitly configures an external database.
- `pnpm dev`, `pnpm desktop:dev`, and `pnpm tauri:dev` may use PostgreSQL for
  backend service integration. This PostgreSQL profile belongs to the launched
  service runtime and must not be treated as the desktop-local data store.
- Explicit SQLite development commands, such as `pnpm dev:sqlite` or
  `pnpm tauri:dev:sqlite`, must be named clearly and used only when validating
  local SQLite behavior.
- PostgreSQL secrets should use `password_file` or a platform secret; direct `password` is allowed only when the runtime config file is protected as a secret-bearing file.
- Development PostgreSQL profiles must use a checked-in `.env.postgres.example`
  file with local-only placeholder values and an ignored `.env.postgres`
  developer override.
- `.env.postgres.example` must use the split-field names
  `SDKWORK_<APP>_DATABASE_ENGINE`, `SDKWORK_<APP>_DATABASE_HOST`,
  `SDKWORK_<APP>_DATABASE_PORT`, `SDKWORK_<APP>_DATABASE_NAME`,
  `SDKWORK_<APP>_DATABASE_SCHEMA`, `SDKWORK_<APP>_DATABASE_USERNAME`,
  `SDKWORK_<APP>_DATABASE_PASSWORD`, `SDKWORK_<APP>_DATABASE_SSL_MODE`, and
  `SDKWORK_<APP>_DATABASE_MAX_CONNECTIONS`.
- If database initialization needs an admin connection, use
  `SDKWORK_<APP>_DATABASE_ADMIN_HOST`, `SDKWORK_<APP>_DATABASE_ADMIN_PORT`,
  `SDKWORK_<APP>_DATABASE_ADMIN_USERNAME`,
  `SDKWORK_<APP>_DATABASE_ADMIN_PASSWORD`,
  `SDKWORK_<APP>_DATABASE_ADMIN_DATABASE`, and
  `SDKWORK_<APP>_DATABASE_ADMIN_SSL_MODE`.
- `DATABASE_PROVIDER` and `DATABASE_SSLMODE` are not standard names. New apps
  must reject them rather than accepting aliases.

Standard `.env.postgres.example` shape:

```env
SDKWORK_<APP>_DATABASE_ENGINE=postgresql
SDKWORK_<APP>_DATABASE_HOST=127.0.0.1
SDKWORK_<APP>_DATABASE_PORT=5432
SDKWORK_<APP>_DATABASE_NAME=<app>_dev
SDKWORK_<APP>_DATABASE_SCHEMA=<app>_dev
SDKWORK_<APP>_DATABASE_USERNAME=<app>dev
SDKWORK_<APP>_DATABASE_PASSWORD=local_dev_password
SDKWORK_<APP>_DATABASE_SSL_MODE=disable
SDKWORK_<APP>_DATABASE_MAX_CONNECTIONS=10

SDKWORK_<APP>_DATABASE_ADMIN_HOST=127.0.0.1
SDKWORK_<APP>_DATABASE_ADMIN_PORT=5432
SDKWORK_<APP>_DATABASE_ADMIN_USERNAME=postgres
SDKWORK_<APP>_DATABASE_ADMIN_PASSWORD=postgres_admin_pass
SDKWORK_<APP>_DATABASE_ADMIN_DATABASE=postgres
SDKWORK_<APP>_DATABASE_ADMIN_SSL_MODE=disable
```
- Desktop packages may create SQLite automatically during first-run initialization.
- Database URLs are private process/config values. They must never be exposed through `PORTAL_PUBLIC_*` or `VITE_*`.
- Pool settings must be explicit for server/container deployments.
- Migration and seed behavior must be controlled by typed install/init settings, not implicit environment guesses.

## 8. Runtime Directory Paths

`RUNTIME_DIRECTORY_SPEC.md` is the canonical path standard for SDKWork
applications. Environment handling must reference that file instead of defining
app-local directory schemes.

For product code `<app>`:

| OS/profile | Config file | Data directory | Log directory |
| --- | --- | --- | --- |
| Linux service/container | `/etc/sdkwork/<app>/<app>.toml` or `/etc/sdkwork/<app>/<process>.toml` | `/var/lib/sdkwork/<app>` | `/var/log/sdkwork/<app>` |
| Linux user/desktop | `~/.sdkwork/<app>/config/<app>.toml` or `~/.sdkwork/<app>/config/<process>.toml` | `~/.sdkwork/<app>/data` | `~/.sdkwork/<app>/logs` |
| macOS service | `/Library/Application Support/sdkwork/<app>/<app>.toml` or process-specific equivalent | `/Library/Application Support/sdkwork/<app>/Data` | `/Library/Logs/sdkwork/<app>` |
| macOS user/desktop | `~/.sdkwork/<app>/config/<app>.toml` or process-specific equivalent | `~/.sdkwork/<app>/data` | `~/.sdkwork/<app>/logs` |
| Windows service | `%ProgramData%\sdkwork\<app>\<app>.toml` or process-specific equivalent | `%ProgramData%\sdkwork\<app>\Data` | `%ProgramData%\sdkwork\<app>\Logs` |
| Windows user/desktop | `%USERPROFILE%\.sdkwork\<app>\config\<app>.toml` or process-specific equivalent | `%USERPROFILE%\.sdkwork\<app>\data` | `%USERPROFILE%\.sdkwork\<app>\logs` |
| Container | `/etc/sdkwork/<app>/<app>.toml` or process-specific equivalent | `/var/lib/sdkwork/<app>` or mounted volume | stdout/stderr, optional `/var/log/sdkwork/<app>` |

Rules:

- `SDKWORK_<APP>_CONFIG_FILE` must override default config discovery.
- `SDKWORK_<APP>_DATA_DIR`, `SDKWORK_<APP>_CACHE_DIR`, and
  `SDKWORK_<APP>_LOG_DIR` may override their resolved directories.
- Config files must be created with restrictive permissions when they include secrets.
- Desktop apps should place SQLite data under the user private data path, not beside the executable.
- Server services should place mutable data under `/var/lib/sdkwork/<app>/` on Linux or the equivalent service data directory on other systems.
- Release archives must include example config templates but must not include host-local secrets.
- Historical XDG, `%APPDATA%`, `%LOCALAPPDATA%`, or display-name directories may be read as compatibility fallbacks during migration, but canonical SDKWork writes should target `~/.sdkwork/<app>` or the Windows equivalent `%USERPROFILE%\.sdkwork\<app>` for user-private files.

## 9. Runtime Config File Shape

TOML is the preferred runtime config file format for SDKWork Rust and desktop/server packages.

```toml
[runtime]
environment = "production"
deployment_mode = "server"

[server]
bind = "0.0.0.0:3900"
external_scheme = "https"
trust_forwarded_headers = true

[database]
engine = "postgresql"
host = "db.example.com"
port = 5432
database = "sdkwork"
username = "sdkwork"
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
- Environment variables should use upper snake case.
- The mapping between file keys and env keys must be documented and tested.
- Secrets may appear in protected host-local config files, but checked-in examples must use placeholders.
- Database config must prefer structured fields in `[database]`. A full `url`
  is a private operator override, not the primary release contract.
- Redis config must live under `[redis]`. Server and container deployments default to `enabled = true` and must fail fast when Redis is required but not configured; desktop and local-only deployments default to `enabled = false`.
- Redis connections should use `host`, `port`, `database`, `username`, `tls`, pool size, and timeout fields as the primary configuration. `url` is an advanced override for managed Redis endpoints whose connection contract cannot be represented cleanly with separate fields.
- Redis secrets should use `password_file` or platform secrets. Direct `password` is allowed only when the runtime TOML is protected as a secret-bearing file.
- Public browser runtime config must be generated from `[portal.public]` or equivalent validated env values.

## 10. Application Architecture Matrix

### 10.1 Browser Portal SPA

Use when a React/Vite/browser application is served by an edge service or static host.

Required behavior:

- Load `/runtime-env.js` or equivalent before the hashed application bundle.
- Use only browser-visible runtime variables for SDK client base URLs.
- Keep app/backend/open SDK base URLs independent.
- Reject invalid public URLs at startup or build-time preflight.

Recommended variables:

```text
PORTAL_PUBLIC_API_BASE_URL=/v1
PORTAL_PUBLIC_OPEN_API_BASE_URL=/v1
PORTAL_PUBLIC_APP_API_BASE_URL=/app/v3/api
PORTAL_PUBLIC_BACKEND_API_BASE_URL=/backend/v3/api
PORTAL_PUBLIC_TOOL_API_ENABLED=false
```

### 10.2 Backend/Admin Web Application

Use when an operator console consumes backend/admin APIs.

Required behavior:

- Consume generated backend/admin SDKs through approved wrappers.
- Configure backend/admin base URL independently from app/user APIs.
- Never expose backend service-to-service secrets to browser code.

Recommended public runtime variable:

```text
PORTAL_PUBLIC_BACKEND_API_BASE_URL=/backend/v3/api
```

### 10.3 App/User Web Application

Use when user-facing UI consumes app APIs.

Required behavior:

- Consume generated app SDKs through approved wrappers.
- Configure app API base URL independently from backend/admin APIs.
- Store tokens only through the platform-approved auth/session adapter.

Recommended public runtime variable:

```text
PORTAL_PUBLIC_APP_API_BASE_URL=/app/v3/api
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
- Allow `SDKWORK_<APP>_DATABASE_URL` to override the local database for diagnostics and managed private deployments.

Example desktop config:

```toml
[runtime]
environment = "production"
deployment_mode = "desktop"

[database]
engine = "sqlite"
file = "~/.sdkwork/<app>/data/<app>.sqlite"
max_connections = 1
```

### 10.5 Server Service

Use when the application runs as a long-lived service on a VM or bare-metal host.

Required behavior:

- Require PostgreSQL for release deployment.
- Read config from the canonical service config path or `SDKWORK_<APP>_CONFIG_FILE`.
- Bind explicitly and document reverse-proxy assumptions.
- Fail fast when required secrets or database config are missing.

Example server env:

```text
SDKWORK_<APP>_CONFIG_FILE=/etc/sdkwork/<app>/<app>.toml
SDKWORK_<APP>_DATABASE_ENGINE=postgresql
SDKWORK_<APP>_DATABASE_HOST=db.example.com
SDKWORK_<APP>_DATABASE_PORT=5432
SDKWORK_<APP>_DATABASE_NAME=sdkwork
SDKWORK_<APP>_DATABASE_USERNAME=sdkwork
SDKWORK_<APP>_DATABASE_PASSWORD_FILE=/etc/sdkwork/<app>/database.secret
SDKWORK_<APP>_DATABASE_SSL_MODE=require
SDKWORK_<APP>_DATABASE_MAX_CONNECTIONS=20
# SDKWORK_<APP>_DATABASE_URL=postgres://sdkwork:change-me@db.example.com:5432/sdkwork
SDKWORK_<APP>_SERVER_BIND=0.0.0.0:3900
SDKWORK_<APP>_TRUST_FORWARDED_HEADERS=1
```

### 10.6 Container Deployment

Use when the application runs in Docker, Kubernetes, or another container runtime.

Required behavior:

- Read config from mounted files and process env.
- Store mutable data on mounted volumes or external services.
- Do not bake secrets into the image.
- Prefer service DNS names for internal API targets.

Example container env:

```text
SDKWORK_<APP>_CONFIG_FILE=/etc/sdkwork/<app>/<app>.toml
SDKWORK_<APP>_DATABASE_ENGINE=postgresql
SDKWORK_<APP>_DATABASE_HOST=postgres
SDKWORK_<APP>_DATABASE_PORT=5432
SDKWORK_<APP>_DATABASE_NAME=sdkwork
SDKWORK_<APP>_DATABASE_USERNAME=sdkwork
SDKWORK_<APP>_DATABASE_PASSWORD_FILE=/run/secrets/sdkwork/<app>/database-password
SDKWORK_<APP>_DATABASE_MAX_CONNECTIONS=20
# SDKWORK_<APP>_DATABASE_URL=postgres://sdkwork:change-me@postgres:5432/sdkwork
SDKWORK_<APP>_SERVER_BIND=0.0.0.0:3900
```

## 11. sdkwork-claw-router Application Env

The SdkWork Claw Router product uses the `SDKWORK_CLAW_` prefix for private process values and `PORTAL_PUBLIC_` for browser-visible portal values.

Server and container deployments default to PostgreSQL. Desktop deployments default to SQLite.

### 11.1 Runtime Config Precedence

Claw Router startup must resolve runtime configuration in this order:

1. Built-in deployment-mode defaults.
2. Canonical runtime TOML path defined by `RUNTIME_DIRECTORY_SPEC.md`.
3. `SDKWORK_CLAW_CONFIG_FILE`.
4. Private process env overrides such as `SDKWORK_CLAW_DATABASE_URL`.
5. CLI flags for development, smoke tests, or explicit one-shot operations.

Rules:

- `SDKWORK_CLAW_DEPLOYMENT_MODE=server` is the default for archive, service, and container releases.
- `SDKWORK_CLAW_DEPLOYMENT_MODE=desktop` is the default for desktop installers.
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
SDKWORK_CLAW_DEPLOYMENT_MODE=server
SDKWORK_CLAW_DATABASE_ENGINE=postgresql
SDKWORK_CLAW_DATABASE_HOST=127.0.0.1
SDKWORK_CLAW_DATABASE_PORT=5432
SDKWORK_CLAW_DATABASE_NAME=sdkwork_ai_dev
SDKWORK_CLAW_DATABASE_SCHEMA=sdkwork_ai_dev
SDKWORK_CLAW_DATABASE_USERNAME=sdkworkdev123
SDKWORK_CLAW_DATABASE_PASSWORD=sdkwork_dev_password
SDKWORK_CLAW_DATABASE_SSL_MODE=disable
SDKWORK_CLAW_DATABASE_MAX_CONNECTIONS=10
SDKWORK_CLAW_DATABASE_ADMIN_HOST=127.0.0.1
SDKWORK_CLAW_DATABASE_ADMIN_PORT=5432
SDKWORK_CLAW_DATABASE_ADMIN_USERNAME=postgres
SDKWORK_CLAW_DATABASE_ADMIN_PASSWORD=postgres_admin_pass
SDKWORK_CLAW_DATABASE_ADMIN_DATABASE=postgres
SDKWORK_CLAW_DATABASE_ADMIN_SSL_MODE=disable
# SDKWORK_CLAW_DATABASE_URL=postgresql://sdkworkdev123:sdkwork_dev_password@127.0.0.1:5432/sdkwork_ai_dev?sslmode=disable
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
SDKWORK_CLAW_DEPLOYMENT_MODE=desktop
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
deployment_mode = "desktop"

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
SDKWORK_CLAW_DEPLOYMENT_MODE=server
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
PORTAL_PUBLIC_API_BASE_URL=/v1
PORTAL_PUBLIC_OPEN_API_BASE_URL=/v1
PORTAL_PUBLIC_APP_API_BASE_URL=/app/v3/api
PORTAL_PUBLIC_BACKEND_API_BASE_URL=/backend/v3/api
PORTAL_PUBLIC_TOOL_API_ENABLED=false
```

Example Linux server config:

```toml
[runtime]
deployment_mode = "server"

[database]
engine = "postgresql"
host = "db.internal"
port = 5432
database = "sdkwork_ai_prod"
username = "sdkworkprod@2026++"
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

### 11.6 Private Split-Service Deployment

Use when the portal edge service forwards to separate internal gateway, app API, and backend/admin API services.

```text
SDKWORK_CLAW_EDGE_GATEWAY_BASE_URL=http://gateway.internal:18080
SDKWORK_CLAW_EDGE_APP_API_BASE_URL=http://app-api.internal:18082
SDKWORK_CLAW_EDGE_BACKEND_API_BASE_URL=http://admin-api.internal:18081
PORTAL_PUBLIC_API_BASE_URL=/v1
PORTAL_PUBLIC_OPEN_API_BASE_URL=/v1
PORTAL_PUBLIC_APP_API_BASE_URL=/app/v3/api
PORTAL_PUBLIC_BACKEND_API_BASE_URL=/backend/v3/api
```

If a tenant exposes the Open SDK from a different public host, set only the Open SDK override:

```text
PORTAL_PUBLIC_API_BASE_URL=https://docs-api.example.com/v1
PORTAL_PUBLIC_OPEN_API_BASE_URL=https://open-api.example.com/v1
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

## 14. Validation And Tests

Every application that adopts this standard should provide:

- Unit tests for env parsing and default resolution.
- Config file parsing tests for canonical and explicit paths.
- Release preflight validation for required production variables.
- Browser runtime env tests that verify public values load before SDK clients are constructed.
- Database selection tests for desktop SQLite and server PostgreSQL behavior.
- Script syntax checks for env writer, preflight, installer, and production starter scripts.
- Security tests that prevent private env values from being emitted to public runtime config.

Acceptance checklist:

- [ ] Env names follow the product and capability prefix rules.
- [ ] Public values are separated from private and secret values.
- [ ] Generated SDK base URLs are independent per surface.
- [ ] Server release defaults require PostgreSQL.
- [ ] PostgreSQL development templates use `.env.postgres.example` with `SDKWORK_<APP>_DATABASE_ENGINE=postgresql`, `SDKWORK_<APP>_DATABASE_SSL_MODE`, and matching `DATABASE_ADMIN_*` split fields when admin initialization is needed.
- [ ] Legacy database env aliases such as `DATABASE_PROVIDER` and `DATABASE_SSLMODE` are rejected for new apps.
- [ ] Desktop install defaults to SQLite in the SDKWork user private data directory.
- [ ] Runtime config file path can be specified explicitly.
- [ ] Canonical runtime directory paths are documented for Linux, macOS, Windows, and containers.
- [ ] Release env files are generated locally and excluded from source control.
- [ ] Strict validation covers URLs, booleans, numbers, secrets, and unknown keys.

## 15. RPC Environment Variables

RPC runtime variables are private process variables unless explicitly documented as browser-visible gRPC-Web configuration.

| Variable | Visibility | Required | Description |
| --- | --- | --- | --- |
| `SDKWORK_<APP>_RPC_ENABLED` | private | MAY | Enables the app/domain RPC server. |
| `SDKWORK_<APP>_RPC_BIND_ADDR` | private | SHOULD when RPC is enabled | Bind address such as `127.0.0.1:50051` for local mode or `0.0.0.0:50051` behind private ingress. |
| `SDKWORK_<APP>_RPC_PUBLIC_ENDPOINT` | private/public by deployment | MAY | Endpoint published to generated external RPC clients. |
| `SDKWORK_<APP>_RPC_TLS_ENABLED` | private | SHOULD for production | Enables server TLS. |
| `SDKWORK_<APP>_RPC_MTLS_ENABLED` | private | SHOULD for service-to-service production | Requires client certificates. |
| `SDKWORK_<APP>_RPC_REFLECTION_ENABLED` | private | MAY | Enables gRPC reflection. Must be disabled or access-controlled in public production. |
| `SDKWORK_<APP>_RPC_HEALTH_ENABLED` | private | SHOULD | Enables gRPC health service. |
| `SDKWORK_<APP>_RPC_GRPC_WEB_ENABLED` | private | MAY | Enables gRPC-Web bridge for approved browser clients. |
| `SDKWORK_<APP>_RPC_DEFAULT_DEADLINE_MS` | private | MAY | Default client/server deadline in milliseconds. |

Rules:

- RPC endpoint variables MUST reject query strings, fragments, control characters, and non-HTTP(S) schemes unless a runtime explicitly documents a Unix domain socket or named-pipe transport.
- TLS certificate paths and private keys are secrets or secret-bearing config and MUST NOT be exposed to browser runtime config.
- `PORTAL_PUBLIC_*_RPC_ENDPOINT` variables MAY exist only for approved gRPC-Web clients and must follow the same public-runtime validation rules as HTTP SDK base URLs.
- Shared modules MUST receive RPC clients through bootstrap/service injection; they must not read RPC environment variables directly.
