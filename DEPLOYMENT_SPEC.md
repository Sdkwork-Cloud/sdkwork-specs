# Deployment And Runtime Standard

- Version: 1.0
- Scope: standalone/cloud application deployment profiles, Java Spring, Rust backend, HTTP/RPC runtime bootstrap, frontend bootstrap, environment config
- Related: `APPLICATION_SPEC.md`, `APP_MANIFEST_SPEC.md`, `CONFIG_SPEC.md`, `RUNTIME_DIRECTORY_SPEC.md`, `ENVIRONMENT_SPEC.md`, `GITHUB_WORKFLOW_SPEC.md`, `RELEASE_SPEC.md`, `API_SPEC.md`, `RPC_SPEC.md`, `RUST_RPC_SPEC.md`, `SDK_SPEC.md`, `IAM_SPEC.md`, `IAM_LOGIN_INTEGRATION_SPEC.md`

SDKWork applications must deploy through one of two standardized application deployment profiles: `standalone` or `cloud`. Shared module APIs, route contracts, generated SDKs, IAM request context, and runtime bootstrap must remain the same across both profiles.

Use `CONFIG_SPEC.md` for typed runtime config, SDK client construction, token storage adapters, and feature flags.

## 1. Deployment Profiles

`deploymentProfile` is the canonical application deployment architecture field.
All SDKWork applications `MUST` declare exactly one active deployment profile at
runtime and in release/package metadata.

| Profile | Architecture | Use case |
| --- | --- | --- |
| `standalone` | Self-contained application unit with one public application ingress and application-owned runtime config | Desktop, local development, demos, private appliance/server install, single-node service, single-container package |
| `cloud` | Cloud/service deployment with split services, managed dependencies, explicit ingress, environment-scoped secrets, release orchestration, and independent scaling | SDKWork hosted SaaS, customer VPC/private cloud, Kubernetes or equivalent orchestration |

Rules:

- `deploymentProfile` values are only `standalone` and `cloud`.
- Old values such as `saas`, `private`, `local`, `test`, `server`,
  `container`, `desktop`, `browser`, `web`, `mobile`, `mini-program`,
  `docker`, and hosting aliases `MUST NOT` be used as deployment profile
  values.
- SaaS, customer-private, local, and test are environment, ownership, tenancy,
  release, or test-fixture concerns. They must be represented through
  environment, release metadata, runtime target, topology profile, or test
  fixture config, not through a third deployment profile.
- Shared API contracts `MUST` remain identical across `standalone` and `cloud`.
- Differences in storage, process model, topology, dependency availability, or token issuer `MUST` be hidden behind SDK client initialization and `WebRequestContext` construction.
- Local-only native capabilities may have local host APIs, but common IAM/API contracts must remain compatible and must not leak local-only parameters into generated SDK inputs.
- Runtime config and SDK client bootstrap `MUST` follow `CONFIG_SPEC.md`.

### 1.1 Standalone Profile

Rules:

- `standalone` deployments `MUST` expose one public application ingress for
  SDKWork HTTP `*-api` surfaces unless the app is a pure client package.
- All application-owned `open-api`, `app-api`, `backend-api`, route crates,
  controller modules, gateways, and API servers in a standalone deployment
  `MUST` integrate `sdkwork-web-framework` or the language-equivalent profile
  defined by `WEB_FRAMEWORK_SPEC.md`.
- Every route/operation served in standalone `MUST` receive
  `WebRequestContext`; tenant and organization context come from auth/access
  token validation, API key records, or server-side request context, not from
  generated `tenant_id` or `tenantId` SDK inputs.
- Dependency APIs may be embedded, mounted same-origin, proxied, or consumed by
  generated dependency SDK clients only when `dependencyApiSurfaces` declares
  the mode and verification evidence required by `CONFIG_SPEC.md` and
  `SDK_SPEC.md`.
- Standalone server packages default to PostgreSQL. Standalone desktop
  user-data runtime targets may default to SQLite under the SDKWork
  user-private directory.
- Redis is required only when the application profile declares shared runtime
  state, realtime fanout, rate limiting, queueing, or cache behavior that
  requires Redis.
- Standalone release artifacts may be archives, OS services, desktop
  installers, or single-container packages, but all of them remain one
  application deployment unit.

### 1.2 Cloud Profile

Rules:

- `cloud` deployments `MUST` use split services for production unless an
  approved architecture decision documents why the app remains a single service
  behind cloud ingress.
- `cloud` deployments `MUST` declare public ingress, service discovery or
  upstreams, managed secrets, persistent data stores, readiness/liveness checks,
  observability, rollback, and release environment binding.
- Platform capabilities such as IAM, appbase, Drive, shared agent services, and
  cross-product SDKs `MUST` be reached through declared platform/application
  surfaces or dependency SDK base URLs. They must not be hidden behind ad hoc
  localhost defaults.
- Cloud browser/runtime config `SHOULD` start from one public SDK root when a
  gateway serves all SDK surfaces, and `MUST` support explicit per-surface or
  per-dependency base URL overrides for split deployments.
- Cloud release artifacts are container images, charts/manifests, deployment
  bundles, or provider-specific deployment packages with SBOM, provenance,
  checksums, signing, rollout, and rollback evidence.

### 1.3 Application Mode Coverage

`CONFIG_SPEC.md` owns the canonical `runtimeTarget` vocabulary. This section
defines how those runtime targets participate in the two deployment profiles;
it is not a second enum.

| Application mode | Runtime target values | Allowed deployment profiles | Primary config owner | Release behavior |
| --- | --- | --- | --- | --- |
| Browser web | `browser` | `cloud`; `standalone` only for a packaged local/offline web shell or private static bundle | Public runtime config from `CONFIG_SPEC.md` and `ENVIRONMENT_SPEC.md` | Web URL, static bundle, or edge-hosted package with public SDK base URLs and asset rollback evidence. |
| PC desktop | `desktop` | `standalone` | Desktop/user runtime config plus platform host config | Signed installer or app bundle; user-private storage defaults apply. |
| Large-screen tablet | `tablet-ipados`, `tablet-android` | `standalone` for packaged tablet apps; `cloud` only for hosted browser/tablet web surfaces | PC renderer config plus tablet host config | IPA/APK/AAB or platform package evidence; tablet is a runtime/package target, not a deployment profile. |
| H5 and Capacitor mobile | `browser`, `capacitor-ios`, `capacitor-android` | `cloud` for H5 web URLs; `standalone` for packaged Capacitor apps | H5 public config plus Capacitor host config | Web URL for H5; IPA/APK/AAB for Capacitor packages. |
| Flutter mobile | `flutter-ios`, `flutter-android` | `standalone` for packaged apps | Flutter app config plus platform host config | IPA/APK/AAB or store-owned package with signing and store rollout evidence. |
| Native mobile | `android-native`, `ios-native`, `harmony-native` | `standalone` for packaged apps | Native app config plus platform host config | AAB/APK, IPA, Harmony package, app-store, or private distribution evidence. |
| Mini program | `mini-program` | `cloud` when served through platform review/release; `standalone` only for documented private/platform-local packages | Mini program config plus host platform config | Platform upload/review/release package with app id, version, and rollback notes. |
| Server service | `server` | `standalone` or `cloud` | Server process config | Archive, service package, or cloud service artifact with PostgreSQL/Redis and ingress evidence. |
| Container image or bundle | `container` | `standalone` for single-container units; `cloud` for orchestrated images/bundles | Mounted container config, env, and platform secrets | OCI image, Docker-compatible image, chart/manifest, or deployment bundle with digest and rollback evidence. |
| Test runner | `test-runner` | Not a production deployment profile; uses `environment = test` | Ephemeral test config | Test artifacts are evidence only and must not be published as production runtime packages. |

Rules:

- `deploymentProfile` answers how the application is deployed and operated.
  `runtimeTarget` answers where the package runs. A client package may be a
  standalone artifact while calling cloud SDK surfaces.
- `docker` is a packaging/tool ecosystem term. SDKWork runtime metadata uses
  `runtimeTarget = "container"` and package/workflow metadata uses container or
  OCI/Docker image formats as defined by `APP_MANIFEST_SPEC.md` and
  `GITHUB_WORKFLOW_SPEC.md`.
- Package metadata, workflow targets, release notes, and manifest entries
  `MUST` carry both `deploymentProfile` and `runtimeTarget` and validate them
  against the matrix above.
- Pure client packages do not have to expose HTTP ingress. Any API surface they
  serve, proxy, or compose still follows `WEB_FRAMEWORK_SPEC.md`,
  `API_SPEC.md`, and `WebRequestContext` rules.

## 2. Environment Names

Standard environments:

```text
development
test
staging
production
```

Rules:

- Environment-specific base URLs, feature flags, deployment profile, and runtime target belong in bootstrap config.
- Shared packages `MUST NOT` hard-code environment URLs.
- Config keys `SHOULD` be capability-scoped and documented.

## 3. Runtime Bootstrap

Bootstrap owns:

- SDK client construction.
- Base URL selection.
- Token storage adapter selection.
- IAM login/session integration and Rust AppContext validation follow `IAM_LOGIN_INTEGRATION_SPEC.md` in standalone, cloud, desktop, server, container, browser, mobile, and test runner targets.
- Deployment profile and runtime target selection.
- Feature flag provider.
- Host/native adapter injection.

Shared modules own:

- Domain services.
- UI composition.
- Generated SDK method consumption.
- Validation and error mapping.

## 4. Java/Rust Parity

Rules:

- Cloud and standalone implementations `MUST` expose the same OpenAPI contract for shared domains.
- Java, Rust, or other runtime implementations that expose shared RPC services `MUST` preserve the proto contract and operationId mapping defined by `RPC_SPEC.md`.
- Database schemas for shared domains `MUST` map to `DATABASE_SPEC.md`.
- Contract tests `SHOULD` run against both Java and Rust implementations.
- If a standalone runtime cannot support a cloud-only capability, the standard contract must define an explicit unavailable capability response, not a different schema.

## 4.1 RPC Deployment Parity

Rules:

- RPC servers MUST be enabled by explicit runtime config; adding a proto contract does not automatically publish a network endpoint.
- Standalone desktop runtime MAY bind RPC to loopback without TLS when documented as local-only.
- Standalone service and cloud production RPC endpoints SHOULD use TLS; service-to-service production RPC SHOULD use mTLS.
- Public app RPC endpoints must pass through approved ingress, auth, rate limit, observability, and reflection controls.
- Reflection MUST be disabled or access-controlled for public production endpoints.
- Health checks MAY be exposed to private operators, but must not leak tenant data, schema details, secrets, or internal dependency names.
- RPC and HTTP adapters in the same process MUST share runtime/service/storage wiring instead of creating divergent implementations.

## 5. SdkWork Claw Router Release Deployment Standard

SdkWork Claw Router release packages must support fast installation on Linux,
Windows, and macOS across `x64` and `arm64` architectures. Archive, service,
single-container, and desktop packages use the `standalone` deployment profile.
Cloud container images and orchestration bundles use the `cloud` deployment
profile.

### 5.1 Runtime Profile Defaults

| Package mode | Deployment profile | Runtime target | Database default | Startup behavior |
| --- | --- | --- | --- | --- |
| Archive | `standalone` | `server` | PostgreSQL | Initialize missing config, then run with structured PostgreSQL configuration. |
| Service | `standalone` | `server` | PostgreSQL | Initialize missing config, install service integration, then run after PostgreSQL is configured. |
| Single container | `standalone` | `container` | PostgreSQL | Use mounted config, protected secrets, and a mounted writable data directory as one application unit. |
| Cloud image/bundle | `cloud` | `container` | Managed PostgreSQL | Use orchestrator-injected config, platform secrets, managed dependencies, probes, rollout, and rollback policy. |
| Desktop | `standalone` | `desktop` | SQLite | Initialize user config and user-data SQLite automatically. |

Standalone server/container and cloud container deployments default to
PostgreSQL. Desktop runtime targets default to SQLite.

Desktop packages must keep local user data on SQLite by default. Development
orchestration is stricter: SDKWork application root `pnpm dev:browser` and
`pnpm dev:desktop` default to PostgreSQL, `serviceLayout = unified-process`,
and `deploymentProfile = standalone`. Explicit SQLite, split-services, or
cloud development paths must use suffixed commands such as
`pnpm dev:desktop:sqlite` or
`pnpm dev:browser:postgres:split-services:cloud`. The PostgreSQL development
profile belongs to dev orchestration and any launched backend service runtime;
it must not change the installed desktop package default or the desktop user
data location.

Redis is enabled and required by default for cloud deployments and standalone
server/container packages that declare shared runtime state. Release packages
must include the `[redis]` section and password-file paths when Redis is
required, and startup must fail fast when required Redis configuration is
missing. Desktop runtime targets keep Redis optional and disabled by default.

### 5.2 Required Runtime Env

Private process variables:

```text
SDKWORK_CLAW_DEPLOYMENT_PROFILE=standalone
SDKWORK_CLAW_RUNTIME_TARGET=server
SDKWORK_CLAW_CONFIG_FILE=/etc/sdkwork/router/clawrouter.toml
SDKWORK_CLAW_DATABASE_ENGINE=postgresql
SDKWORK_CLAW_DATABASE_HOST=db.example.com
SDKWORK_CLAW_DATABASE_PORT=5432
SDKWORK_CLAW_DATABASE_NAME=sdkwork_ai_prod
SDKWORK_CLAW_DATABASE_SCHEMA=sdkwork_ai_prod
SDKWORK_CLAW_DATABASE_USERNAME=sdkwork_ai_prod
SDKWORK_CLAW_DATABASE_PASSWORD_FILE=/etc/sdkwork/router/database.secret
SDKWORK_CLAW_DATABASE_SSL_MODE=require
SDKWORK_CLAW_DATABASE_MAX_CONNECTIONS=16
# SDKWORK_CLAW_DATABASE_URL=postgresql://sdkwork_ai_prod:<password>@db.example.com:5432/sdkwork_ai_prod
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
# /v1 is valid here only for OpenAI-compatible API compatibility.
# SDKWork-owned business open-api domains use their approved prefix, for example /im/v3/api.
PORTAL_PUBLIC_API_BASE_URL=/v1
PORTAL_PUBLIC_OPEN_API_BASE_URL=/v1
PORTAL_PUBLIC_APP_API_BASE_URL=/app/v3/api
PORTAL_PUBLIC_BACKEND_API_BASE_URL=/backend/v3/api
```

Rules:

- `SDKWORK_CLAW_CONFIG_FILE` overrides the canonical TOML path defined by `RUNTIME_DIRECTORY_SPEC.md`.
- `SDKWORK_CLAW_DEPLOYMENT_PROFILE` must be `standalone` for archive, service,
  single-container, and desktop releases, and `cloud` for cloud image/bundle
  releases.
- `SDKWORK_CLAW_RUNTIME_TARGET` must be `server` for archive/service releases,
  `container` for container images, and `desktop` for desktop installers.
- `SDKWORK_CLAW_DEPLOYMENT_MODE` is retired. New application startup,
  checked-in examples, release env files, workflow config, app manifests, and
  runtime TOML must reject it. Migration tools may read it only outside
  application startup and must normalize it into `SDKWORK_CLAW_DEPLOYMENT_PROFILE`
  plus `SDKWORK_CLAW_RUNTIME_TARGET` before application code sees the config.
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
- `[redis].enabled` defaults to `true` for cloud releases and standalone
  server/container releases that declare shared runtime state; it defaults to
  `false` for desktop. Deployments that require Redis must configure
  `[redis].host`, `[redis].port`, `[redis].database`, and protected password
  handling before first startup. Use `[redis].url` only as an advanced
  managed-endpoint override; use separate `tls`, pool, timeout, and
  `key_prefix` fields for standard deployments.
- `PORTAL_PUBLIC_APP_API_BASE_URL` and `PORTAL_PUBLIC_BACKEND_API_BASE_URL` must remain independently configurable because split deployments may route them to different hosts.
- SDKWork open-api, OpenAI-compatible, or generic API configuration should use `PORTAL_PUBLIC_OPEN_API_BASE_URL` or `PORTAL_PUBLIC_API_BASE_URL`, not an ambiguous gateway env name. A `/v1` value is valid only for an explicitly documented OpenAI-compatible compatibility API; SDKWork-owned business open-api domains must use their approved non-app/non-backend prefix from `API_SPEC.md`, for example `/im/v3/api`.

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

- [ ] Deployment profile is explicit and is either `standalone` or `cloud`.
- [ ] Runtime target is explicit and separate from deployment profile.
- [ ] SDK construction is isolated in bootstrap.
- [ ] Shared modules do not hard-code backend type.
- [ ] Standalone/cloud API parity is tested.
- [ ] Standalone/cloud RPC parity is tested when shared proto services are exposed.
- [ ] Environment config is documented and typed.
