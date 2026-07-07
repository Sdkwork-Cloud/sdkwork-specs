# Runtime Directory And Infrastructure Configuration Standard

- Version: 1.0
- Scope: runtime directories, server install layout, desktop private files, development layout, release configuration files, database configuration, Redis configuration, secrets, logs, cache, temporary files, cross-OS path conventions
- Related: `SDKWORK_WORKSPACE_SPEC.md`, `ENVIRONMENT_SPEC.md`, `DEPLOYMENT_SPEC.md`, `CONFIG_SPEC.md`, `DATABASE_SPEC.md`, `CACHE_SPEC.md`, `SECURITY_SPEC.md`, `OBSERVABILITY_SPEC.md`, `NGINX_SPEC.md`

This standard is the canonical SDKWork authority for host filesystem layout and
infrastructure runtime configuration. Application-local documents may provide
examples, but they must not define competing path or database/Redis conventions.

The source-controlled repository/application `.sdkwork/` workspace is governed
by `SDKWORK_WORKSPACE_SPEC.md`. It is not a runtime directory and must not be
used for user-private data, server state, secrets, logs, caches, databases, or
temporary runtime files.

Every SDKWork application must keep runtime files under an SDKWork namespace and
must use a short lowercase application code as the final directory segment. For
example, the Claw Router product uses the application code `router`, so its
Linux service paths are `/etc/sdkwork/router`, `/var/lib/sdkwork/router`, and
`/var/log/sdkwork/router`.

## 1. Design Goals

Runtime layout and infrastructure configuration must satisfy these goals:

- A host can run multiple SDKWork applications without directory collisions.
- Operators can find all SDKWork application files under a single namespace.
- Service/server, desktop, container, and development targets use explicit and
  predictable directories.
- Database and Redis settings are represented by typed config fields, not only
  opaque URLs.
- Secret material is separated from public config and from committed templates.
- Release packages can initialize safe defaults without hiding production
  requirements.
- Existing applications can migrate from historical paths through documented
  compatibility fallbacks, while new work uses only the canonical paths.

## 2. Terms

| Term | Meaning |
| --- | --- |
| Application code | Short lowercase runtime directory code such as `router`, `chat`, `iam`, `drive`, `commerce`, or `billing`. |
| Process name | Executable or service name, such as `clawrouter`. It may differ from the application code. |
| Product name | Human-facing brand or package name, such as SdkWork Claw Router. |
| System scope | Host-level service or daemon files managed by an administrator, package manager, service manager, or container runtime. |
| User scope | Private files owned by one operating-system user, including desktop app config and local data. |
| Runtime config file | Host-local TOML/YAML/JSON file loaded at process startup. TOML is preferred for Rust services. |
| Secret-bearing file | A file containing passwords, API keys, signing keys, private URLs, or encrypted secret payloads. |
| Data directory | Durable mutable application state owned by the process. |
| Cache directory | Rebuildable local cache. Cache loss must not destroy authoritative data. |
| Runtime directory | Ephemeral PID files, sockets, locks, and generated state that should disappear after reboot. |
| Repository workspace `.sdkwork/` | Source-controlled development metadata at a git repository root or application root. It is not runtime state and is governed by `SDKWORK_WORKSPACE_SPEC.md`. |

## 3. Naming Rules

Each SDKWork application must define exactly one canonical application code.

Rules:

- Application codes must be lowercase ASCII kebab-free words using letters,
  digits, and underscores only when a legacy domain already requires it.
- Directory names must use the application code, not the product display name,
  service name, executable name, package name, or repository name.
- System scope paths must use `sdkwork/<application-code>`.
- User private paths must use `.sdkwork/<application-code>`.
- Source-controlled repository/application `.sdkwork/` directories are not user private runtime
  paths. Do not write runtime files under a source root `.sdkwork/`.
- Process-specific files may use the process name inside the application
  directory when it improves operator clarity. For example:
  `/etc/sdkwork/router/clawrouter.toml`.
- New applications should use `<application-code>.toml` and `<application-code>.env` unless the runtime
  has an established process name that operators already use.
- Product display names such as `ClawRouter`, `SdkWork Chat`, or `SDKWork`
  must not appear in Linux system service directories.

Recommended application codes:

| Application line or capability | Application code | Notes |
| --- | --- | --- |
| SdkWork Claw Router | `router` | Process name may remain `clawrouter`. |
| SdkWork Chat | `chat` | User private files use `~/.sdkwork/chat`. |
| IAM service | `iam` | Use only when deployed as an independent process. |
| Drive service | `drive` | Owns durable object/file metadata and local adapters. |
| Commerce service | `commerce` | Owns commerce runtime state. |

## 4. Canonical Directory Matrix

### 4.1 Linux System Scope

Linux service, archive, and package deployments must use these directories.

| Purpose | Canonical path | Ownership | Notes |
| --- | --- | --- | --- |
| Runtime config | `/etc/sdkwork/<application-code>` | `root:sdkwork` | TOML, env files, config templates copied during install. |
| Runtime config file | `/etc/sdkwork/<application-code>/<process>.toml` or `/etc/sdkwork/<application-code>/<application-code>.toml` | `root:sdkwork` | `SDKWORK_<APPLICATION_CODE>_CONFIG_FILE` may override it. |
| Process env file | `/etc/sdkwork/<application-code>/<process>.env` or `/etc/sdkwork/<application-code>/<application-code>.env` | `root:sdkwork` | Non-public process overrides only. |
| Secret files | `/etc/sdkwork/<application-code>/*.secret` | `root:sdkwork` | Prefer `0600` or `0640`; never world-readable. |
| Private immutable runtime assets | `/usr/lib/sdkwork/<application-code>` | `root:root` | Binaries, service-local runtime assets, bundled native libraries. |
| Shared read-only assets | `/usr/share/sdkwork/<application-code>` | `root:root` | Static portal assets, templates, generated SDK archives, catalogs. |
| Documentation | `/usr/share/doc/sdkwork/<application-code>` | `root:root` | Install guide, license notices, runbooks. |
| Durable mutable data | `/var/lib/sdkwork/<application-code>` | `sdkwork:sdkwork` | SQLite only for approved desktop/user-data exceptions, catalogs, queues, generated state. |
| Logs | `/var/log/sdkwork/<application-code>` | `sdkwork:adm` or `sdkwork:sdkwork` | File logs only when journald/stdout is not enough. |
| Cache | `/var/cache/sdkwork/<application-code>` | `sdkwork:sdkwork` | Rebuildable cache. |
| Runtime state | `/run/sdkwork/<application-code>` | `sdkwork:sdkwork` | PID files, sockets, locks. |
| Temporary files | `/tmp/sdkwork/<application-code>` | process user | Only for disposable scratch files. |
| Archive install root | `/opt/sdkwork/<application-code>` | `root:root` | Self-contained tar/zip installs that are not package-manager owned. |

Rules:

- `/etc/sdkwork/<application-code>` is for operator-managed configuration, not generated
  application data.
- `/var/lib/sdkwork/<application-code>` is the only Linux system-scope durable mutable data
  directory.
- `/var/log/sdkwork/<application-code>` is the only Linux system-scope file log directory.
- `/usr/lib/sdkwork/<application-code>`, `/usr/share/sdkwork/<application-code>`, and
  `/usr/share/doc/sdkwork/<application-code>` must contain read-only release assets.
- New code must not write to `/opt/sdkwork/<application-code>` at runtime except for archive
  distributions explicitly installed there.
- New Linux service paths such as `/etc/<process>`, `/var/lib/<process>`,
  `/var/log/<process>`, `/usr/lib/<process>`, `/usr/share/<process>`, or
  `/opt/<process>` are not allowed for SDKWork applications.

### 4.2 Linux User Scope

SDKWork-managed user-private files must use `~/.sdkwork/<application-code>`.

| Purpose | Canonical path |
| --- | --- |
| User private root | `~/.sdkwork/<application-code>` |
| User config | `~/.sdkwork/<application-code>/config` |
| User config file | `~/.sdkwork/<application-code>/config/<process>.toml` or `~/.sdkwork/<application-code>/config/<application-code>.toml` |
| User durable data | `~/.sdkwork/<application-code>/data` |
| User SQLite database | `~/.sdkwork/<application-code>/data/<application-code>.sqlite` or `~/.sdkwork/<application-code>/data/<process>.sqlite` |
| User logs | `~/.sdkwork/<application-code>/logs` |
| User cache | `~/.sdkwork/<application-code>/cache` |
| User secrets | `~/.sdkwork/<application-code>/secrets` |
| User temp | `~/.sdkwork/<application-code>/tmp` |

Rules:

- SDKWork desktop and local private files should use `~/.sdkwork/<application-code>` instead
  of scattered XDG directories so one SDKWork namespace is easy to back up,
  inspect, and remove.
- Applications may read historical XDG paths as compatibility fallbacks during a
  documented migration period, but canonical writes must target
  `~/.sdkwork/<application-code>`.
- Explicit environment variables such as `SDKWORK_<APPLICATION_CODE>_CONFIG_FILE`,
  `SDKWORK_<APPLICATION_CODE>_DATA_DIR`, and `SDKWORK_<APPLICATION_CODE>_CACHE_DIR` override default
  discovery.
- User private secret files should be created with mode `0600`.

### 4.3 macOS System And User Scope

macOS must keep SDKWork files under SDKWork namespaces while respecting platform
service conventions.

| Purpose | System scope | User scope |
| --- | --- | --- |
| Config root | `/Library/Application Support/sdkwork/<application-code>` | `~/.sdkwork/<application-code>/config` |
| Config file | `/Library/Application Support/sdkwork/<application-code>/<process>.toml` | `~/.sdkwork/<application-code>/config/<process>.toml` |
| Data root | `/Library/Application Support/sdkwork/<application-code>/Data` | `~/.sdkwork/<application-code>/data` |
| Logs | `/Library/Logs/sdkwork/<application-code>` | `~/.sdkwork/<application-code>/logs` |
| Cache | `/Library/Caches/sdkwork/<application-code>` | `~/.sdkwork/<application-code>/cache` |
| Secrets | `/Library/Application Support/sdkwork/<application-code>/Secrets` | `~/.sdkwork/<application-code>/secrets` |
| App support alternate | Not applicable | `~/Library/Application Support/sdkwork/<application-code>` |

Rules:

- Service or launchd-managed deployments should use the system-scope locations.
- SDKWork-managed desktop private files should use `~/.sdkwork/<application-code>` for
  consistency across operating systems.
- A signed macOS app bundle may also use `~/Library/Application Support/sdkwork/<application-code>`
  when platform integration requires it, but the application must document this
  as an OS integration alternate and must not mix multiple writable roots
  without migration rules.

### 4.4 Windows System And User Scope

Windows paths must use an SDKWork namespace and the canonical application code.

| Purpose | System scope | User scope |
| --- | --- | --- |
| Program files | `%ProgramFiles%\sdkwork\<application-code>` | Not applicable |
| Config root | `%ProgramData%\sdkwork\<application-code>` | `%USERPROFILE%\.sdkwork\<application-code>\config` |
| Config file | `%ProgramData%\sdkwork\<application-code>\<process>.toml` | `%USERPROFILE%\.sdkwork\<application-code>\config\<process>.toml` |
| Data root | `%ProgramData%\sdkwork\<application-code>\Data` | `%USERPROFILE%\.sdkwork\<application-code>\data` |
| Logs | `%ProgramData%\sdkwork\<application-code>\Logs` | `%USERPROFILE%\.sdkwork\<application-code>\logs` |
| Cache | `%ProgramData%\sdkwork\<application-code>\Cache` | `%USERPROFILE%\.sdkwork\<application-code>\cache` |
| Secrets | `%ProgramData%\sdkwork\<application-code>\Secrets` | `%USERPROFILE%\.sdkwork\<application-code>\secrets` |
| OS roaming alternate | Not applicable | `%APPDATA%\sdkwork\<application-code>` |
| OS local alternate | Not applicable | `%LOCALAPPDATA%\sdkwork\<application-code>` |

Rules:

- Windows service deployments should use `%ProgramData%\sdkwork\<application-code>` for
  mutable/configurable files and `%ProgramFiles%\sdkwork\<application-code>` for read-only
  installed binaries.
- SDKWork-managed user private files should use `%USERPROFILE%\.sdkwork\<application-code>`.
- `%APPDATA%\sdkwork\<application-code>` and `%LOCALAPPDATA%\sdkwork\<application-code>` are allowed only
  when an installer or desktop framework needs Windows roaming/local semantics.
  They must be documented as compatibility or OS integration alternates.
- File ACLs must restrict secret-bearing files to the service account,
  Administrators, and the installing user as appropriate.

### 4.5 Container Scope

Container images must behave like Linux services while preferring platform
secrets and external durable services.

| Purpose | Canonical path |
| --- | --- |
| Config mount | `/etc/sdkwork/<application-code>` |
| Config file | `/etc/sdkwork/<application-code>/<process>.toml` or `/etc/sdkwork/<application-code>/<application-code>.toml` |
| Secret mount | `/run/secrets/sdkwork/<application-code>` |
| Data volume | `/var/lib/sdkwork/<application-code>` |
| Cache volume | `/var/cache/sdkwork/<application-code>` |
| Runtime state | `/run/sdkwork/<application-code>` |
| Image workdir/install root | `/opt/sdkwork/<application-code>` |

Rules:

- Containers must not bake production secrets into image layers.
- PostgreSQL and Redis are external services in production containers.
- Durable data must live on mounted volumes or external services, not ephemeral
  container layers.
- Logs should go to stdout/stderr by default. File logs are optional and, when
  enabled, use `/var/log/sdkwork/<application-code>`.

### 4.6 Non-System Client Runtime Targets

Browser, mobile, tablet, and mini program targets must preserve the same
configuration semantics without forcing server filesystem paths onto sandboxed
clients.

| Runtime target | Writable runtime location | Config rule | Persistence rule |
| --- | --- | --- | --- |
| `browser` | Browser storage only through approved auth/session adapters | Public runtime JSON or `/runtime-env.js`; no private process config | No database, Redis, secret files, or server paths. |
| `tablet-ipados`, `tablet-android` | Platform app-private storage plus approved native host directories | PC renderer config plus tablet host config | Local SQLite/encrypted cache only when documented by the PC/tablet architecture. |
| `capacitor-ios`, `capacitor-android` | Platform app-private storage through Capacitor adapters | H5 public config plus Capacitor host config | Secure storage adapter and local caches only; no committed tokens or signing secrets. |
| `flutter-ios`, `flutter-android` | Platform app-private storage through Flutter adapters | Flutter app config plus host platform config | Secure storage adapter and local caches only. |
| `android-native`, `ios-native`, `harmony-native` | Platform app-private storage | Native app config plus platform host config | Secure storage/keychain equivalents and local caches only. |
| `mini-program` | Platform storage and subpackage/runtime cache controlled by the mini program host | `config/mini-program` plus host platform config | Platform session/storage adapter only; no private app secret in source or package output. |

Rules:

- These targets `MUST NOT` be required to create `/etc/sdkwork`,
  `/var/lib/sdkwork`, `%ProgramData%\sdkwork`, or `~/.sdkwork` paths unless a
  desktop/native host standard explicitly maps that target to an OS user scope.
- Runtime config for sandboxed clients carries the same fields
  (`environment`, `deploymentProfile`, `runtimeTarget`, SDK base URLs, and
  feature flags) but is materialized through the platform's public/app config
  mechanism.
- Secrets, auth tokens, refresh tokens, API keys, signing keys, database URLs,
  and Redis URLs `MUST NOT` be stored in browser runtime config, mini program
  config, generated mobile assets, or committed native platform config.
- Client-local durable data is cache or user-private app data unless an
  architecture decision documents an offline-first authoritative data model and
  synchronization contract.

## 5. Development Environment Standard

Development configuration must be easy to run locally without weakening release
rules.

Repository-local conventions:

| Purpose | Path or file |
| --- | --- |
| Checked-in dev example | `.env.example`, `.env.development.example`, or app-specific equivalent |
| Developer override | `.env.local` or `.env.<profile>.local` |
| PostgreSQL dev example | `.env.postgres.example` |
| PostgreSQL developer override | `.env.postgres` or typed dev config file excluded from source control |
| SQLite dev example | `.env.sqlite.example` when an app needs one |
| SQLite developer override | `.env.sqlite` or typed dev config file excluded from source control |
| Dev generated data | `target/dev/<application-code>` or `~/.sdkwork/<application-code>/dev` |
| Dev SQLite database | `target/dev/<application-code>/<application-code>.sqlite` or `~/.sdkwork/<application-code>/dev/data/<application-code>.sqlite` |
| Dev logs | `target/dev/<application-code>/logs` or `~/.sdkwork/<application-code>/dev/logs` |

Rules:

- `pnpm dev`, `cargo run`, Maven boot runs, and local desktop commands must make
  the database profile explicit in scripts or generated config.
- Desktop/Tauri dev commands that launch a backend service must make that
  service's PostgreSQL profile explicit. Desktop-local SQLite paths remain the
  installed desktop/user-data default and must be exposed only through explicit
  SQLite dev commands or desktop runtime config.
- Release defaults must not be inferred from `.env.local`.
- Checked-in examples must never contain real passwords, tenant tokens, API
  keys, or production hostnames.
- Dev PostgreSQL and Redis credentials must be documented as local-only.
- PostgreSQL dev profiles must use `SDKWORK_<APPLICATION_CODE>_DATABASE_ENGINE=postgresql`
  and `SDKWORK_<APPLICATION_CODE>_DATABASE_SSL_MODE`; they must not use legacy aliases such
  as `DATABASE_PROVIDER` or `DATABASE_SSLMODE`.
- Test databases must be isolated from dev and production databases.
- A local command may write to `target/dev/<application-code>` for disposable workspace data.
  Long-lived private user data should use `~/.sdkwork/<application-code>`.

## 6. Release And Production Configuration Standard

Production deployments must use runtime config files, protected secret files, or
platform secret managers. Dev `.env` files are not production configuration.

Rules:

- Linux service packages must install or initialize `/etc/sdkwork/<application-code>`.
- Standalone server/container and cloud deployments must default to
  PostgreSQL unless an approved desktop-only or local-data exception is
  documented.
- Standalone server/container and cloud deployments that require shared state
  must default to Redis and fail fast when Redis is missing or invalid.
- Production config examples must use structured database and Redis fields.
- `DATABASE_URL` and `REDIS_URL` style overrides are private emergency/operator
  overrides, not the primary release contract.
- Secret-bearing files must have restrictive file permissions and must never be
  committed.
- Release package preflight must validate the config file, secret file paths,
  database reachability when requested, Redis reachability when requested,
  writable data/log/cache directories, and public runtime URL rules.
- Production startup must not silently fall back to SQLite when
  `deployment_profile` is `cloud`, or when `deployment_profile` is `standalone`
  and `runtime_target` is `server` or `container`.

Recommended Linux permissions:

| Path | Mode | Owner |
| --- | --- | --- |
| `/etc/sdkwork/<application-code>` | `0750` | `root:sdkwork` |
| `/etc/sdkwork/<application-code>/*.toml` | `0640` | `root:sdkwork` |
| `/etc/sdkwork/<application-code>/*.env` | `0640` | `root:sdkwork` |
| `/etc/sdkwork/<application-code>/*.secret` | `0600` or `0640` | `root:sdkwork` |
| `/usr/lib/sdkwork/<application-code>` | `0755` | `root:root` |
| `/usr/share/sdkwork/<application-code>` | `0755` | `root:root` |
| `/var/lib/sdkwork/<application-code>` | `0750` | `sdkwork:sdkwork` |
| `/var/log/sdkwork/<application-code>` | `0750` | `sdkwork:adm` or `sdkwork:sdkwork` |
| `/var/cache/sdkwork/<application-code>` | `0750` | `sdkwork:sdkwork` |
| `/run/sdkwork/<application-code>` | `0750` | `sdkwork:sdkwork` |

## 7. Config Discovery And Precedence

Applications must resolve runtime configuration in this order:

1. Built-in safe defaults for non-secret development behavior.
2. Canonical runtime config file for the deployment profile, runtime target,
   and OS.
3. Compatibility fallback config file paths, read-only during migration unless
   the migration plan explicitly says otherwise.
4. Platform secret manager or secret files referenced by the config file.
5. Process environment overrides.
6. CLI flags for one-shot local development, tests, diagnostics, or install
   initialization.

Rules:

- Explicit `SDKWORK_<APPLICATION_CODE>_CONFIG_FILE` always overrides default discovery.
- Explicit `SDKWORK_<APPLICATION_CODE>_DATA_DIR`, `SDKWORK_<APPLICATION_CODE>_CACHE_DIR`, and
  `SDKWORK_<APPLICATION_CODE>_LOG_DIR` override default path discovery for their scope.
- Shared libraries must not read default paths directly. Bootstrap code resolves
  paths and passes typed configuration into the application.
- Release mode should fail validation on unknown strict config keys unless the
  app defines an extension namespace.
- Compatibility fallbacks must emit a migration warning that names the canonical
  target path.

## 8. Runtime Config File Shape

TOML is preferred for SDKWork Rust services and desktop/server packages.

```toml
[runtime]
environment = "production"
deployment_profile = "standalone"
runtime_target = "server"
app_code = "router"
process_name = "clawrouter"

[server]
bind = "0.0.0.0:3900"
external_scheme = "https"
trust_forwarded_headers = true

[paths]
config_directory = "/etc/sdkwork/router"
data_directory = "/var/lib/sdkwork/router"
log_directory = "/var/log/sdkwork/router"
cache_directory = "/var/cache/sdkwork/router"
runtime_directory = "/run/sdkwork/router"

[database]
engine = "postgresql"
host = "db.internal"
port = 5432
database = "sdkwork_ai_prod"
schema = "sdkwork_ai_prod"
username = "sdkwork_ai_prod"
password_file = "/etc/sdkwork/router/database.secret"
ssl_mode = "require"
max_connections = 16
connect_timeout_ms = 3000
idle_timeout_seconds = 600
auto_migrate = false
auto_seed = false

[redis]
enabled = true
host = "redis.internal"
port = 6379
database = 0
username = "default"
password_file = "/etc/sdkwork/router/redis.secret"
key_prefix = "clawrouter"
tls = false
max_connections = 16
connect_timeout_ms = 2000
command_timeout_ms = 1000
pool_idle_timeout_seconds = 60
```

Rules:

- Config keys use lower snake case.
- Environment variables use upper snake case.
- Checked-in examples must use placeholder hosts and passwords.
- `[paths]` is the authoritative place for resolved runtime directories after
  bootstrap.
- `[database]` and `[redis]` must be validated as typed sections before the
  application starts accepting traffic.
- Config writers must not print secret values. They may print whether a secret
  file exists and whether permissions look safe.

## 9. Database Configuration Standard

SDKWork standalone server/container and cloud deployments must use structured
PostgreSQL configuration by default.

Canonical `[database]` fields:

| Field | Required | Notes |
| --- | --- | --- |
| `engine` | yes | `postgresql` for standalone server/container and cloud targets; `sqlite` for desktop user-data targets. |
| `host` | PostgreSQL | Hostname or IP for PostgreSQL. |
| `port` | PostgreSQL | Default `5432`. |
| `database` | PostgreSQL | Database name or catalog. |
| `schema` | optional | PostgreSQL schema, default `public` unless the app standard says otherwise. |
| `username` | PostgreSQL | Database role/user. |
| `password_file` | recommended | Path to secret-bearing file. |
| `password` | allowed with restrictions | Only in protected secret-bearing config. |
| `ssl_mode` | production | `require`, `verify-ca`, or `verify-full` for production where supported. |
| `max_connections` | server/container | Pool limit. |
| `connect_timeout_ms` | recommended | Startup and pool connect timeout. |
| `idle_timeout_seconds` | optional | Pool idle timeout. |
| `url` | advanced override | Private operator override only; never browser-visible. |
| `file` | SQLite | SQLite database file path for local/desktop. |
| `auto_migrate` | explicit | Whether startup may apply migrations. |
| `auto_seed` | explicit | Whether startup may seed baseline data. |

Rules:

- Standalone server/container and cloud release config must not depend on only
  `url`. Structured fields are the primary production contract.
- `SDKWORK_<APPLICATION_CODE>_DATABASE_URL` may override the structured config only when an
  operator explicitly sets it.
- PostgreSQL password material should use `password_file` or a platform secret.
- Direct `password` is allowed only when the entire config file is protected as
  a secret-bearing file.
- Desktop user-data SQLite defaults must place the database under the canonical
  user private data directory, such as `~/.sdkwork/router/data/router.sqlite`,
  unless an app-specific migration plan temporarily reads an older location.
- Desktop package local user data must stay on SQLite by default even when the
  repository's integrated development command uses `.env.postgres.example` and
  PostgreSQL. The PostgreSQL dev profile exercises backend service behavior for
  `pnpm dev`, `pnpm dev:browser`, `pnpm dev:desktop`, or `pnpm dev:server`; it
  is not the desktop data persistence default. Desktop host runner commands
  remain internal implementation details behind `pnpm dev:desktop`.
- Production startup must fail closed if the database config still contains
  placeholder values.
- Migration and seed behavior must be controlled by explicit typed fields or
  install commands, not guessed from environment names.

Recommended env override mapping:

| Env var | Config field |
| --- | --- |
| `SDKWORK_<APPLICATION_CODE>_DATABASE_ENGINE` | `[database].engine` |
| `SDKWORK_<APPLICATION_CODE>_DATABASE_URL` | `[database].url` |
| `SDKWORK_<APPLICATION_CODE>_DATABASE_HOST` | `[database].host` |
| `SDKWORK_<APPLICATION_CODE>_DATABASE_PORT` | `[database].port` |
| `SDKWORK_<APPLICATION_CODE>_DATABASE_NAME` | `[database].database` |
| `SDKWORK_<APPLICATION_CODE>_DATABASE_SCHEMA` | `[database].schema` |
| `SDKWORK_<APPLICATION_CODE>_DATABASE_USERNAME` | `[database].username` |
| `SDKWORK_<APPLICATION_CODE>_DATABASE_PASSWORD_FILE` | `[database].password_file` |
| `SDKWORK_<APPLICATION_CODE>_DATABASE_PASSWORD` | `[database].password` |
| `SDKWORK_<APPLICATION_CODE>_DATABASE_SSL_MODE` | `[database].ssl_mode` |
| `SDKWORK_<APPLICATION_CODE>_DATABASE_MAX_CONNECTIONS` | `[database].max_connections` |
| `SDKWORK_<APPLICATION_CODE>_DATABASE_FILE` | `[database].file` |

Standard PostgreSQL development example shape:

```env
# Unified workspace profile. See ENVIRONMENT_SPEC.md §7.1 and sdkwork-specs/templates/env.postgres.example
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

Rules:

- `.env.postgres.example` is checked in and contains local-only placeholders using `SDKWORK_CLAW_DATABASE_*` only.
- `.env.postgres` is a developer override and must be ignored by source
  control.
- `DATABASE_PROVIDER` and `DATABASE_SSLMODE` are not standard names. New apps
  must reject them rather than silently treating them as aliases.
- `DATABASE_URL` and `DATABASE_ADMIN_URL` may exist only as commented examples
  or explicit operator/developer overrides; split fields are the standard
  integration shape.

## 10. Redis Configuration Standard

Redis is the standard shared cache/state backend for cloud deployments and
standalone server/container deployments that require shared runtime state.

Canonical `[redis]` fields:

| Field | Required | Notes |
| --- | --- | --- |
| `enabled` | yes | `true` for cloud and standalone server/container targets when the app requires shared state; `false` for desktop user-data defaults. |
| `host` | standard mode | Hostname or IP. |
| `port` | standard mode | Default `6379`. |
| `database` | standard mode | Logical database index, default `0`. |
| `username` | optional | ACL username. |
| `password_file` | recommended | Path to secret-bearing file. |
| `password` | allowed with restrictions | Only in protected secret-bearing config. |
| `key_prefix` | recommended | Application namespace, such as `clawrouter`. |
| `tls` | production optional | Use TLS for managed or cross-network Redis. |
| `max_connections` | server/container | Pool limit. |
| `connect_timeout_ms` | recommended | Connection timeout. |
| `command_timeout_ms` | recommended | Per-command timeout. |
| `pool_idle_timeout_seconds` | optional | Pool idle lifetime. |
| `url` | advanced override | Use only when managed Redis cannot be represented cleanly with structured fields. |

Rules:

- `[redis].host`, `[redis].port`, `[redis].database`, `[redis].tls`, pool, and
  timeout fields are the standard configuration shape.
- `[redis].url` is an advanced managed-endpoint override, not the default release
  contract.
- Redis password material should use `password_file` or platform secrets.
- Direct `password` is allowed only when the process environment or config file
  is protected as a secret-bearing source.
- Redis keys must include an application `key_prefix` unless a stronger
  namespace is enforced by the cache adapter.
- Applications must document which capabilities require Redis and must fail fast
  for cloud or standalone server/container targets when a required Redis config
  is absent.
- Desktop user-data targets should keep Redis disabled unless the user
  explicitly enables shared infrastructure.

Recommended env override mapping:

| Env var | Config field |
| --- | --- |
| `SDKWORK_<APPLICATION_CODE>_REDIS_ENABLED` | `[redis].enabled` |
| `SDKWORK_<APPLICATION_CODE>_REDIS_HOST` | `[redis].host` |
| `SDKWORK_<APPLICATION_CODE>_REDIS_PORT` | `[redis].port` |
| `SDKWORK_<APPLICATION_CODE>_REDIS_DATABASE` | `[redis].database` |
| `SDKWORK_<APPLICATION_CODE>_REDIS_USERNAME` | `[redis].username` |
| `SDKWORK_<APPLICATION_CODE>_REDIS_PASSWORD_FILE` | `[redis].password_file` |
| `SDKWORK_<APPLICATION_CODE>_REDIS_PASSWORD` | `[redis].password` |
| `SDKWORK_<APPLICATION_CODE>_REDIS_KEY_PREFIX` | `[redis].key_prefix` |
| `SDKWORK_<APPLICATION_CODE>_REDIS_TLS` | `[redis].tls` |
| `SDKWORK_<APPLICATION_CODE>_REDIS_MAX_CONNECTIONS` | `[redis].max_connections` |
| `SDKWORK_<APPLICATION_CODE>_REDIS_CONNECT_TIMEOUT_MILLIS` | `[redis].connect_timeout_ms` |
| `SDKWORK_<APPLICATION_CODE>_REDIS_COMMAND_TIMEOUT_MILLIS` | `[redis].command_timeout_ms` |
| `SDKWORK_<APPLICATION_CODE>_REDIS_POOL_IDLE_TIMEOUT_SECONDS` | `[redis].pool_idle_timeout_seconds` |
| `SDKWORK_<APPLICATION_CODE>_REDIS_URL` | `[redis].url` |

## 11. Secrets Standard

Secrets include database passwords, Redis passwords, signing keys, API key
peppers, webhook secrets, private TLS keys, provider API keys, and private
connection strings.

Rules:

- Secrets must never appear in browser runtime config, frontend bundles,
  generated SDK examples, screenshots, logs, telemetry attributes, or committed
  templates.
- Secret files in `/etc/sdkwork/<application-code>` must be readable only by the service
  account and administrators.
- User-scope secret files under `~/.sdkwork/<application-code>/secrets` should be readable
  only by the owning user.
- Container deployments should prefer platform secret mounts such as
  `/run/secrets/sdkwork/<application-code>/<secret-name>`.
- Config files may reference secret file paths, but examples must use placeholder
  paths and must not include real secret values.
- Installers may create placeholder secret files, but startup must fail closed
  until required production secrets are replaced.

## 12. Logging, Observability, Cache, And Temp Rules

Rules:

- File logs use `/var/log/sdkwork/<application-code>` for Linux service scope and
  `~/.sdkwork/<application-code>/logs` for user scope.
- Container logs should go to stdout/stderr first and use file logs only when
  explicitly configured.
- Structured logs must redact secrets and private connection strings.
- Cache files use `/var/cache/sdkwork/<application-code>` for Linux service scope and
  `~/.sdkwork/<application-code>/cache` for user scope.
- Temporary files use `/run/sdkwork/<application-code>` for process runtime state and
  `~/.sdkwork/<application-code>/tmp` for user-private temp files. General `/tmp` use is
  allowed only for disposable scratch files with safe cleanup.
- Rebuildable cache must not be treated as authoritative data.
- Durable queue state, catalogs, migration state, or generated data required for
  restart belongs under the data directory, not the cache directory.

## 13. SdkWork Claw Router Profile

SdkWork Claw Router uses:

| Concept | Value |
| --- | --- |
| Application code | `router` |
| Process name | `clawrouter` |
| Linux config file | `/etc/sdkwork/router/clawrouter.toml` |
| Linux env file | `/etc/sdkwork/router/clawrouter.env` |
| Linux database secret | `/etc/sdkwork/router/database.secret` |
| Linux Redis secret | `/etc/sdkwork/router/redis.secret` |
| Linux immutable runtime assets | `/usr/lib/sdkwork/router` |
| Linux shared assets | `/usr/share/sdkwork/router` |
| Linux docs | `/usr/share/doc/sdkwork/router` |
| Linux durable data | `/var/lib/sdkwork/router` |
| Linux logs | `/var/log/sdkwork/router` |
| Linux cache | `/var/cache/sdkwork/router` |
| Linux runtime state | `/run/sdkwork/router` |
| Archive install root | `/opt/sdkwork/router` |
| User private root | `~/.sdkwork/router` |
| User config | `~/.sdkwork/router/config/clawrouter.toml` |
| User data | `~/.sdkwork/router/data` |
| User SQLite database | `~/.sdkwork/router/data/clawrouter.sqlite` |

Rules:

- `clawrouter.service`, `clawrouterctl`, and `clawrouter` remain valid process
  and operator command names.
- Directory paths must use `router`, not `clawrouter`, under SDKWork namespaces.
- Standalone server/container and cloud deployments default to PostgreSQL and
  Redis when shared runtime state is required.
- Desktop user-data targets default to SQLite under the user private data
  directory and Redis disabled.
- Historical desktop paths such as XDG or display-name based locations may be
  read as compatibility fallbacks during migration, but new canonical writes
  must target `~/.sdkwork/router`.

## 14. Migration Rules

When an existing application has historical paths, migration must be explicit.

Rules:

- New installs must use only the canonical SDKWork paths.
- Upgrades may read old paths as compatibility fallbacks.
- If both old and new config files exist, explicit `SDKWORK_<APPLICATION_CODE>_CONFIG_FILE`
  wins; otherwise the canonical path wins and the old path is ignored unless a
  documented migration command is running.
- Migration tooling must copy data before changing the active path and must not
  delete user data automatically.
- Logs must name the old path and canonical target path without printing secrets.
- Release notes must list path changes that operators need to know.

## 15. Acceptance Checklist

- [ ] The application has one canonical lowercase application code.
- [ ] Linux system config is under `/etc/sdkwork/<application-code>`.
- [ ] Linux read-only assets are under `/usr/lib/sdkwork/<application-code>` or `/usr/share/sdkwork/<application-code>`.
- [ ] Linux durable data is under `/var/lib/sdkwork/<application-code>`.
- [ ] Linux logs are under `/var/log/sdkwork/<application-code>`.
- [ ] User private files are under `~/.sdkwork/<application-code>` or the documented Windows equivalent `%USERPROFILE%\.sdkwork\<application-code>`.
- [ ] Development config is separated from release config.
- [ ] PostgreSQL development config uses checked-in `.env.postgres.example`, ignored `.env.postgres`, `SDKWORK_<APPLICATION_CODE>_DATABASE_ENGINE=postgresql`, and `SDKWORK_<APPLICATION_CODE>_DATABASE_SSL_MODE`.
- [ ] Standalone server/container and cloud production config defaults to PostgreSQL through structured `[database]` fields.
- [ ] Desktop user-data config defaults to SQLite under the user private data directory.
- [ ] Redis config uses structured `[redis]` fields by default.
- [ ] `DATABASE_URL` and `REDIS_URL` are private explicit overrides only.
- [ ] Secrets use secret files or platform secrets and are never committed.
- [ ] Compatibility fallbacks are read-only unless a migration command is explicitly running.
- [ ] Tests or preflight checks validate config discovery, path resolution, permissions, and database/Redis config rules.
