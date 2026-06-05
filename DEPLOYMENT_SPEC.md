# Deployment And Runtime Standard

- Version: 1.0
- Scope: SaaS, private, local, Java Spring, Rust local backend, HTTP/RPC runtime bootstrap, frontend bootstrap, environment config
- Related: `APPLICATION_SPEC.md`, `CONFIG_SPEC.md`, `RUNTIME_DIRECTORY_SPEC.md`, `ENVIRONMENT_SPEC.md`, `API_SPEC.md`, `RPC_SPEC.md`, `RUST_RPC_SPEC.md`, `SDK_SPEC.md`, `IAM_SPEC.md`, `IAM_LOGIN_INTEGRATION_SPEC.md`

SDKWork applications must switch between SaaS cloud mode and local/private mode without changing shared module APIs.

Use `CONFIG_SPEC.md` for typed runtime config, SDK client construction, token storage adapters, and feature flags.

## 1. Deployment Modes

| Mode | Backend | Use case |
| --- | --- | --- |
| `saas` | Java Spring `spring-ai-plus-business` | Cloud hosted SDKWork services |
| `private` | Java Spring or Rust service | Customer-controlled deployment |
| `local` | Rust local backend or embedded runtime | Desktop/local-first usage |
| `test` | Mock, fixture, or local test server | Automated tests |

Rules:

- Shared API contracts `MUST` remain identical across `saas`, `private`, and `local`.
- Differences in storage, process model, or token issuer `MUST` be hidden behind SDK client initialization.
- Local-only native capabilities may have local host APIs, but common IAM/API contracts must remain compatible.
- Runtime config and SDK client bootstrap `MUST` follow `CONFIG_SPEC.md`.

## 2. Environment Names

Standard environments:

```text
development
test
staging
production
```

Rules:

- Environment-specific base URLs, tokens, feature flags, and deployment mode belong in bootstrap config.
- Shared packages `MUST NOT` hard-code environment URLs.
- Config keys `SHOULD` be capability-scoped and documented.

## 3. Runtime Bootstrap

Bootstrap owns:

- SDK client construction.
- Base URL selection.
- Token storage adapter selection.
- IAM login/session integration and Rust AppContext validation follow `IAM_LOGIN_INTEGRATION_SPEC.md` in SaaS, private, local, and desktop modes.
- Deployment mode selection.
- Feature flag provider.
- Host/native adapter injection.

Shared modules own:

- Domain services.
- UI composition.
- Generated SDK method consumption.
- Validation and error mapping.

## 4. Java/Rust Parity

Rules:

- Java SaaS and Rust local implementations `MUST` expose the same OpenAPI contract for shared domains.
- Java SaaS and Rust local/private implementations that expose shared RPC services `MUST` preserve the proto contract and operationId mapping defined by `RPC_SPEC.md`.
- Database schemas for shared domains `MUST` map to `DATABASE_SPEC.md`.
- Contract tests `SHOULD` run against both Java and Rust implementations.
- If a Rust local API cannot support a cloud capability, the standard contract must define an explicit unavailable capability response, not a different schema.

## 4.1 RPC Deployment Parity

Rules:

- RPC servers MUST be enabled by explicit runtime config; adding a proto contract does not automatically publish a network endpoint.
- Local desktop mode MAY bind RPC to loopback without TLS when documented as local-only.
- Private and SaaS production RPC endpoints SHOULD use TLS; service-to-service production RPC SHOULD use mTLS.
- Public app RPC endpoints must pass through approved ingress, auth, rate limit, observability, and reflection controls.
- Reflection MUST be disabled or access-controlled for public production endpoints.
- Health checks MAY be exposed to private operators, but must not leak tenant data, schema details, secrets, or internal dependency names.
- RPC and HTTP adapters in the same process MUST share runtime/service/storage wiring instead of creating divergent implementations.

## 5. SdkWork Claw Router Release Deployment Standard

SdkWork Claw Router release packages must support fast installation on Linux, Windows, and macOS across `x64` and `arm64` architectures. Archive, service, and container packages use the server runtime profile. Desktop packages use the desktop runtime profile.

### 5.1 Runtime Profile Defaults

| Package mode | Runtime profile | Database default | Startup behavior |
| --- | --- | --- | --- |
| Archive | `server` | PostgreSQL | Initialize missing config, then run with structured PostgreSQL configuration. |
| Service | `server` | PostgreSQL | Initialize missing config, install service integration, then run after PostgreSQL is configured. |
| Container | `server` | PostgreSQL | Use mounted config, platform secrets, and a mounted writable data directory. |
| Desktop | `desktop` | SQLite | Initialize user config and user-data SQLite automatically. |

Server and container deployments default to PostgreSQL. Desktop deployments
default to SQLite.

Desktop packages must keep local user data on SQLite by default. The
PostgreSQL development profile used by `pnpm dev`, `pnpm desktop:dev`,
`pnpm tauri:dev`, or server integration tests belongs to the launched backend
service runtime. It must not change the desktop package default or the desktop
user data location.

Redis is enabled and required by default for server and container deployments.
Release packages must include the `[redis]` section and password-file paths, and
startup must fail fast when server deployments do not provide Redis
configuration. Desktop deployments keep Redis optional and disabled by default.

### 5.2 Required Runtime Env

Private process variables:

```text
SDKWORK_CLAW_DEPLOYMENT_MODE=server
SDKWORK_CLAW_CONFIG_FILE=/etc/sdkwork/router/clawrouter.toml
SDKWORK_CLAW_DATABASE_ENGINE=postgresql
SDKWORK_CLAW_DATABASE_HOST=db.example.com
SDKWORK_CLAW_DATABASE_PORT=5432
SDKWORK_CLAW_DATABASE_NAME=sdkwork_ai_prod
SDKWORK_CLAW_DATABASE_SCHEMA=public
SDKWORK_CLAW_DATABASE_USERNAME=sdkworkprod
SDKWORK_CLAW_DATABASE_PASSWORD_FILE=/etc/sdkwork/router/database.secret
SDKWORK_CLAW_DATABASE_SSL_MODE=require
SDKWORK_CLAW_DATABASE_MAX_CONNECTIONS=16
# SDKWORK_CLAW_DATABASE_URL=postgresql://sdkworkprod:<password>@db.example.com:5432/sdkwork_ai_prod
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
```

Browser-visible portal variables:

```text
PORTAL_PUBLIC_API_BASE_URL=/v1
PORTAL_PUBLIC_OPEN_API_BASE_URL=/v1
PORTAL_PUBLIC_APP_API_BASE_URL=/app/v3/api
PORTAL_PUBLIC_BACKEND_API_BASE_URL=/backend/v3/api
```

Rules:

- `SDKWORK_CLAW_CONFIG_FILE` overrides the canonical TOML path defined by `RUNTIME_DIRECTORY_SPEC.md`.
- `SDKWORK_CLAW_DEPLOYMENT_MODE` must be `server` for service/container/archive releases and `desktop` for desktop installers.
- Server runtime TOML and private process env must declare PostgreSQL through
  structured fields: `SDKWORK_<APP>_DATABASE_ENGINE`,
  `SDKWORK_<APP>_DATABASE_HOST`, `SDKWORK_<APP>_DATABASE_PORT`,
  `SDKWORK_<APP>_DATABASE_NAME`, `SDKWORK_<APP>_DATABASE_SCHEMA`,
  `SDKWORK_<APP>_DATABASE_USERNAME`, `SDKWORK_<APP>_DATABASE_PASSWORD_FILE`,
  and `SDKWORK_<APP>_DATABASE_SSL_MODE`.
- `DATABASE_PROVIDER` and `DATABASE_SSLMODE` are not standard names and must
  not be accepted by new SDKWork applications.
- `SDKWORK_CLAW_DATABASE_URL` remains an explicit private override and must not be exposed through `PORTAL_PUBLIC_*` or any browser runtime script.
- `SDKWORK_CLAW_REDIS_HOST`, `SDKWORK_CLAW_REDIS_PORT`, `SDKWORK_CLAW_REDIS_DATABASE`, `SDKWORK_CLAW_REDIS_USERNAME`, `SDKWORK_CLAW_REDIS_URL`, `SDKWORK_CLAW_REDIS_PASSWORD_FILE`, `SDKWORK_CLAW_REDIS_PASSWORD`, `SDKWORK_CLAW_REDIS_KEY_PREFIX`, `SDKWORK_CLAW_REDIS_TLS`, `SDKWORK_CLAW_REDIS_MAX_CONNECTIONS`, `SDKWORK_CLAW_REDIS_CONNECT_TIMEOUT_MILLIS`, `SDKWORK_CLAW_REDIS_COMMAND_TIMEOUT_MILLIS`, and `SDKWORK_CLAW_REDIS_POOL_IDLE_TIMEOUT_SECONDS` are private Redis overrides and must not be exposed through browser runtime script.
- `[redis].enabled` defaults to `true` for server/container releases and `false` for desktop. Server deployments must configure `[redis].host`, `[redis].port`, `[redis].database`, and protected password handling before first startup. Use `[redis].url` only as an advanced managed-endpoint override; use separate `tls`, pool, timeout, and `key_prefix` fields for standard deployments.
- `PORTAL_PUBLIC_APP_API_BASE_URL` and `PORTAL_PUBLIC_BACKEND_API_BASE_URL` must remain independently configurable because split deployments may route them to different hosts.
- Open/generic API configuration should use `PORTAL_PUBLIC_OPEN_API_BASE_URL` or `PORTAL_PUBLIC_API_BASE_URL`, not an ambiguous gateway env name.

### 5.3 Runtime Directory Paths

Claw Router uses application code `router` for directory paths and process name
`clawrouter` for binaries, services, commands, and process-specific config
filenames.

| Target | Config file | Data directory |
| --- | --- | --- |
| Linux server/service/container | `/etc/sdkwork/router/clawrouter.toml` | `/var/lib/sdkwork/router` |
| Windows server/service | `%ProgramData%/sdkwork/router/clawrouter.toml` | `%ProgramData%/sdkwork/router/Data` |
| macOS server/service | `/Library/Application Support/sdkwork/router/clawrouter.toml` | `/Library/Application Support/sdkwork/router/Data` |
| Linux desktop | `~/.sdkwork/router/config/clawrouter.toml` | `~/.sdkwork/router/data` |
| Windows desktop | `%USERPROFILE%/.sdkwork/router/config/clawrouter.toml` | `%USERPROFILE%/.sdkwork/router/data` |
| macOS desktop | `~/.sdkwork/router/config/clawrouter.toml` | `~/.sdkwork/router/data` |

Rules:

- Linux release packages must also use `/usr/lib/sdkwork/router`,
  `/usr/share/sdkwork/router`, `/usr/share/doc/sdkwork/router`,
  `/var/log/sdkwork/router`, `/var/cache/sdkwork/router`, and
  `/run/sdkwork/router` when those directories are needed.
- User-private Claw Router files must use `~/.sdkwork/router` or the Windows
  equivalent `%USERPROFILE%/.sdkwork/router`.
- Development PostgreSQL examples must use `.env.postgres.example` for checked-in
  local placeholders and `.env.postgres` for ignored developer overrides.
- Historical desktop paths such as XDG or display-name based directories may
  be read as compatibility fallbacks during migration, but new writes must use
  the canonical SDKWork paths.

### 5.4 Fast Initialization Contract

Every release package must include the installer binary and document these target-host commands:

```sh
clawrouterctl ensure
clawrouterctl refresh-catalog --force
```

The install package planner must also include release env checks and writes:

```sh
pnpm release:env:write -- --check
pnpm release:env:write -- --force
```

Rules:

- Initialization may create the default runtime TOML file when it is missing.
- Server initialization must generate an explicit structured PostgreSQL config.
- PostgreSQL password material should be supplied through `password_file` or platform secrets; direct `password` is allowed only when the runtime TOML is protected as a secret-bearing file.
- Redis password material should be supplied through `password_file` or platform secrets when `[redis].enabled = true`; direct `[redis].password` is allowed only when the runtime TOML is protected as a secret-bearing file.
- Desktop initialization may create the SQLite file under the SDKWork user private data directory.
- Desktop development startup may also launch a backend service with the
  PostgreSQL dev profile; that backend service database is not the desktop
  package's local SQLite store.
- Release packages must include `config/clawrouter.toml.example`, generated `INSTALL.md`, generated `install-manifest.json`, binaries, portal assets, and SDK archives.
- Release packages must not include `.env.release.local`, secrets, local test databases, `node_modules`, or VCS metadata.
- Container packages must mount configuration and mutable data rather than baking secrets or database state into the image.

### 5.5 Ubuntu Release Start Example

For a staged Ubuntu server release:

```sh
sudo apt install ./clawrouter-linux-x64-service-0.2.0.deb
sudo editor /etc/sdkwork/router/clawrouter.toml
sudo systemctl start clawrouter
curl http://127.0.0.1:3900/healthz
curl http://127.0.0.1:3900/readyz
```

The Linux service package creates `/etc/sdkwork/router/clawrouter.toml`,
`/etc/sdkwork/router/clawrouter.env`, and `/etc/sdkwork/router/database.secret`, then
enables `clawrouter.service` on systemd hosts. Operators configure PostgreSQL
in the TOML or protected secret file before starting the service.

For nginx publication, use `NGINX_SPEC.md`. The canonical site path is
`/etc/nginx/sites-enabled/sdkwork/<domain>.conf`, where `<domain>` is the full
public hostname such as `api.sdkwork.com` or `www.sdkwork.com`. The default
Claw Router upstream is `http://127.0.0.1:3900`, and certificate material uses
`/opt/certs/letsencrypt/live/<cert-name>/fullchain.pem` plus
`/opt/certs/letsencrypt/live/<cert-name>/privkey.pem`.

## 6. Acceptance Checklist

- [ ] Deployment mode is explicit.
- [ ] SDK construction is isolated in bootstrap.
- [ ] Shared modules do not hard-code backend type.
- [ ] Java/Rust API parity is tested.
- [ ] Java/Rust RPC parity is tested when shared proto services are exposed.
- [ ] Environment config is documented and typed.
