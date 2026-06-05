# Configuration And Environment Standard

- Version: 1.0
- Scope: environment config, SDK client initialization, secrets, feature flags, typed runtime config, SaaS/private/local switching
- Related: `RUNTIME_DIRECTORY_SPEC.md`, `ENVIRONMENT_SPEC.md`, `DEPLOYMENT_SPEC.md`, `SDK_SPEC.md`, `SECURITY_SPEC.md`, `APPLICATION_SPEC.md`, `APP_MANIFEST_SPEC.md`

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

Rules:

- Shared modules `MUST NOT` read process env, `.env` files, local storage, registry, or native config directly.
- Shared modules receive typed config from runtime/bootstrap.
- Secrets `MUST NOT` be stored in app manifests or committed config files.
- SaaS/private/local differences `MUST` be represented as typed deployment mode, not scattered conditionals.

## 2. Standard Runtime Config

```ts
export type SdkworkEnvironment = "development" | "test" | "staging" | "production";
export type SdkworkDeploymentMode = "saas" | "private" | "local" | "test";

export interface SdkworkRuntimeConfig {
  environment: SdkworkEnvironment;
  deploymentMode: SdkworkDeploymentMode;
  appApiBaseUrl: string;
  backendApiBaseUrl?: string;
  paths?: SdkworkRuntimePaths;
  database?: SdkworkDatabaseConfig;
  redis?: SdkworkRedisConfig;
  appKey: string;
  tenantId?: string;
  organizationId?: string;
  featureFlags?: Record<string, boolean | string | number>;
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
- `deploymentMode` describes backend architecture.
- `appApiBaseUrl` and `backendApiBaseUrl` are selected before SDK clients are created.
- `tenantId` and `organizationId` in config are defaults only; token context is authoritative after authentication.
- Config objects crossing host/native boundaries `SHOULD` be serializable.
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
const appClient = createAppClient({
  baseUrl: config.appApiBaseUrl,
  auth: tokenProvider,
});

const backendClient = config.backendApiBaseUrl
  ? createBackendClient({
      baseUrl: config.backendApiBaseUrl,
      auth: tokenProvider,
    })
  : undefined;
```

Rules:

- SDK client constructors may differ by generated SDK package.
- Service modules receive constructed clients, not constructor details.
- Token providers `MUST` support both `Authorization: Bearer <auth_token>` and `Access-Token: <access_token>`.
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

Rules:

- `.env.local` and developer machine config must not be required for CI.
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
- [ ] Database env parsing maps `SDKWORK_<APP>_DATABASE_ENGINE` and `SDKWORK_<APP>_DATABASE_SSL_MODE` to typed config and rejects `DATABASE_PROVIDER`/`DATABASE_SSLMODE`.
- [ ] Apps with PostgreSQL development support provide `.env.postgres.example` and ignore `.env.postgres`.
- [ ] SDK clients are constructed in bootstrap.
- [ ] Deployment mode and environment are explicit.
- [ ] Secrets are isolated from manifests and committed files.
- [ ] Feature flags are scoped and documented.
