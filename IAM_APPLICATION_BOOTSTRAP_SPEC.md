# SDKWork IAM Application Bootstrap Standard

- Version: 1.0
- Scope: registered application templates, tenant applications, bootstrap orchestration, access credential issuance, manifest mapping, reusable framework package, and application onboarding enforcement
- Related: `IAM_SPEC.md`, `APP_MANIFEST_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, `MODULE_SPEC.md`, `API_SPEC.md`, `CONFIG_SPEC.md`, `ENVIRONMENT_SPEC.md`, `PNPM_SCRIPT_SPEC.md`, `TEST_SPEC.md`, `DATABASE_FRAMEWORK_SPEC.md`

This standard defines the canonical two-layer IAM application model and the reusable bootstrap framework that every new SDKWork application must use.

## 1. Domain Model

SDKWork IAM application provisioning uses two layers. Do not introduce `plus_*` tables, `studio_*` tables, or a separate deployment entity in IAM database ownership.

| Layer | Database | Meaning |
| --- | --- | --- |
| Registered application | `iam_application_template`, `iam_application_template_package` | Platform-wide application definition registered by bootstrap operators |
| Tenant application | `iam_tenant_application` | Tenant-scoped runtime instance with domain, access permissions, status, and runtime `app_id` |

Rules:

- Registration creates or updates an application template.
- Provisioning creates a tenant application bound to a template.
- Enable transitions the tenant application to an operable state.
- Access credential issuance creates delegated `auth_token` and `access_token` only after the tenant application is enabled.
- Deployment is not a separate IAM table. Deployment behavior is expressed through provision, update, enable, and runtime configuration on the tenant application.

## 2. Canonical Backend API Surface

All bootstrap operations live in backend-api only. Static path segments use `lower_snake_case`.

| Business step | Method | Path | operationId | Auth mode |
| --- | --- | --- | --- | --- |
| Register application template | `POST` | `/backend/v3/api/iam/applications/register` | `applications.register` | `bootstrap-body` |
| Provision tenant application | `POST` | `/backend/v3/api/iam/tenant_applications` | `tenantApplications.provision` | `bootstrap-body` |
| Update tenant application | `PATCH` | `/backend/v3/api/iam/tenant_applications/{tenantApplicationId}` | `tenantApplications.update` | `bootstrap-body` |
| Enable tenant application | `POST` | `/backend/v3/api/iam/tenant_applications/{tenantApplicationId}/enable` | `tenantApplications.enable` | `bootstrap-body` |
| Retrieve tenant application | `GET` | `/backend/v3/api/iam/tenant_applications/{tenantApplicationId}` | `tenantApplications.retrieve` | `dual-token` |
| Issue access credential | `POST` | `/backend/v3/api/iam/access_credentials` | `accessCredentials.create` | `bootstrap-body` |

Rules:

- Bootstrap operations `MUST NOT` require dual-token headers.
- `tenantApplications.retrieve` is an authenticated admin read (dual-token) for runtime inspection; it is not part of the bootstrap-body flow and returns redacted `runtimeConfig` (including `[redacted]` for `oauth.relyingParty.clientSecretHash`).
- Bootstrap body authentication `MUST` use super-admin credentials in the JSON body through `authToken` or username/email/phone plus `password`.
- Handlers `MUST` enforce bootstrap-operator checks, per-operation permission codes, and tenant scope before business rules run.
- Consumers `MUST NOT` hand-craft raw HTTP to these paths when `@sdkwork/iam-application-bootstrap` or generated backend SDK clients are available.

Required permission codes:

```text
iam.applications.register
iam.tenant_applications.provision
iam.tenant_applications.update
iam.tenant_applications.enable
iam.access_credentials.create
```

Admin read permission for `tenantApplications.retrieve` reuses `iam.tenant_applications.update` so OAuth relying-party administrators can read back redacted runtime config without bootstrap-body credentials.

## 3. Reusable Framework Package

The canonical reusable module is:

```text
@sdkwork/iam-application-bootstrap
```

Physical package root in `sdkwork-iam`:

```text
apps/sdkwork-iam-common/packages/sdkwork-iam-application-bootstrap
```

Rules:

- New applications and appbase-derived repositories `MUST` use this package for register → provision → enable → access credential orchestration.
- Application code `MUST NOT` duplicate manifest mapping, auth merge, env output formatting, or step ordering in local scripts.
- CLI/bootstrap scripts `MAY` remain thin wrappers that parse args, load manifest/profile, choose a transport, and call the framework module.
- The framework `MUST` expose a transport port (`IamApplicationBootstrapClient`) and at least these adapters:
  - `createFetchIamApplicationBootstrapClient(...)` for CLI/tooling environments
  - `createIamApplicationBootstrapClientFromBackend(...)` for generated backend SDK clients
  - `createIamApplicationBootstrapClientFromIamService(...)` for `@sdkwork/iam-service` facades
  - `createIamApplicationBootstrapFromIamService(...)` and `createIamApplicationBootstrapFromIamRuntime(...)` for runtime/service composition
- The framework `MUST` expose:
  - `bootstrapApplicationFromManifest(...)`
  - `createIamApplicationBootstrap(...)`
  - optional `updateTenantApplication(...)` on the client port and module facade
  - manifest mapping helpers
  - bootstrap auth/env resolution helpers
  - env handoff helpers such as `formatBootstrapEnvFile(...)`

Forbidden in application-owned bootstrap code:

- raw `fetch`/`axios`/HTTP client calls to bootstrap IAM paths
- copied manifest-to-command mapping outside the framework unless an approved local narrowing spec documents an exception
- direct SQL against `iam_application_template` or `iam_tenant_application` from application scripts

## 4. Manifest Mapping

`sdkwork.app.config.json` remains the registration source of truth. See `APP_MANIFEST_SPEC.md` for field semantics.

Minimum manifest fields for IAM bootstrap:

| Manifest field | Bootstrap use |
| --- | --- |
| `app.key` | registered template `appKey` |
| `app.name`, `app.displayName`, `app.appType` | template identity |
| `app.identifiers.*` | optional template identifiers |
| `backend.accessTokenPermissionScope` or `backend.permissionScope` | required non-empty default access permissions |
| `backend.tenantId`, `backend.organizationId` | tenant application scope defaults |
| `backend.appId` | tenant application runtime `app_id`; must match the PC/H5/mobile auth runtime `appId` and bootstrap `Access-Token` JWT `app_id` claim when the surface uses credential-entry |
| `backend.primaryDomain` or runtime `--domain` / env | tenant application domain |
| `artifacts.installConfig.packages[]` | optional template package metadata |
| `release.notes[]` | template version/channel |

Rules:

- `backend.accessTokenPermissionScope` `MUST` be a non-empty string array for every new app.
- Bootstrap `MUST` fail closed when default access permissions are missing.
- Manifest content `MUST NOT` contain secrets, live tokens, or bootstrap passwords.

## 5. Runtime Environments

The same framework `MUST` work across these environments by swapping only the transport adapter and environment resolution:

| Environment | Required adapter | Notes |
| --- | --- | --- |
| Local CLI / CI bootstrap | `createFetchIamApplicationBootstrapClient` | Uses `admin:bootstrap:app` or equivalent thin script |
| SaaS/private backend SDK runtime | `createIamApplicationBootstrapClientFromBackend` | Uses generated `@sdkwork/iam-backend-sdk` or approved backend SDK |
| Existing IAM service runtime | `createIamApplicationBootstrapClientFromIamService` | Uses `@sdkwork/iam-service` without raw HTTP |
| Server/container service bootstrap | fetch or backend SDK adapter | May write `.sdkwork.local.env` or inject env through approved secret store |
| Embedded unified-process / installer runtime | `sdkwork-iam-embedded-application-bootstrap` (Rust) | Reads `sdkwork.app.config.json`, calls `ensure_tenant_application_runtime` directly on the IAM Postgres profile |

### 5.1 Embedded Rust Runtime Bootstrap

Naming follows `NAMING_SPEC.md`: the retired `product-*` bootstrap prefix is forbidden. Use `tenant application` for IAM registry rows and `embedded application bootstrap` for the shared Rust crate.

When IAM runs inside an application process or installer (`unified-process`, standalone gateway, database ensure), applications `MUST` use the shared Rust crate:

```text
sdkwork-iam/crates/sdkwork-iam-embedded-application-bootstrap
```

Rules:

- Application repositories `MUST NOT` duplicate manifest mapping, Postgres `search_path` wiring, tenant-application reconcile logic, or raw SQL against `iam_application_template` / `iam_tenant_application`.
- Application repositories `MAY` keep a thin adapter crate that supplies additional runtime bindings (for example IM PC + H5) but `MUST` delegate to `ensure_tenant_application_from_app_root` or `ensure_tenant_application_from_app_root_with_env_and_fallback`.
- `ensure_tenant_application_from_app_root_with_env` without a repository-root fallback `MUST NOT` be used in application adapters; it silently skips provisioning when `SDKWORK_*_APP_ROOT` env vars are unset.
- `sdkwork-iam-database-host` `MUST` invoke `ensure_tenant_application_from_app_root_if_configured` after IAM migrations when `SDKWORK_APP_ROOT` (or an approved app-root env alias) points at a manifest-bearing application root.
- Embedded bootstrap `MUST` derive `instance_key` through `tenant_application_instance_key(runtime_app_id, environment)` so tenant applications do not collide with platform defaults such as `default`.
- Embedded bootstrap `MUST` upsert tenant applications by stable row id and reconcile org-template, runtime app id, and instance-key conflicts before enable.

Forbidden in application-owned embedded bootstrap code:

- copied manifest-to-command mapping outside the shared crate
- per-app Postgres pool helpers that omit unified schema `search_path`
- blind `INSERT` tenant application rows without reconcile/upsert

Embedded IAM integration checklist for application repositories that call `build_sdkwork_iam_app_api_router()`:

1. Bootstrap IAM schema with `sdkwork_iam_database_host::bootstrap_iam_database_from_env()` before tenant application provisioning when the process owns IAM lifecycle.
2. Call `ensure_tenant_application_from_app_root_with_env_and_fallback(...)` (or an approved thin adapter) before building the IAM router on every startup path (standalone gateway, unified-process, installer, direct API server).
3. Inject `SDKWORK_APP_ROOT` and the approved app-root alias (such as `SDKWORK_DRIVE_APP_ROOT` or `SDKWORK_IM_APP_ROOT`) at the **consumer application manifest root** for tenant application provisioning. Inject `SDKWORK_IAM_APP_ROOT` at the sibling `sdkwork-iam` repository root so IAM database-host post-bootstrap hooks can materialize IMF catalog and IAM database assets from the canonical IAM ownership boundary.
4. Keep manifest mapping, Postgres `search_path`, reconcile/upsert, and `instance_key` derivation in `sdkwork-iam-embedded-application-bootstrap` / `sdkwork-iam-web-adapter`; application adapters only supply repo-root fallback and optional runtime bindings.
5. Add a repository governance test under `scripts/dev/*-iam-application-bootstrap-standard.test.mjs` that asserts the adapter, startup ordering, dependencies, and dev env injection.

Cloud split-services repositories `MUST` inject `SDKWORK_APP_ROOT` on every dev and gateway startup path (directly or through `@sdkwork/app-topology` `resolveIamDevEnv()`). Repository topology contract tests `SHOULD` assert `IAM_APPLICATION_BOOTSTRAP_ENV`, `resolveIamDevEnv`, and the app-specific `SDKWORK_<APP>_APP_ROOT` alias in dev orchestrators.

Rules:

- Browser/renderer runtimes `MUST NOT` execute bootstrap registration directly.
- Bootstrap output env keys `SHOULD` include:
  - `SDKWORK_TENANT_ID`
  - `SDKWORK_ORGANIZATION_ID`
  - `SDKWORK_TENANT_APPLICATION_ID`
  - `SDKWORK_APP_ID`
  - `SDKWORK_APP_DOMAIN`
  - `SDKWORK_APP_ACCESS_CREDENTIAL`
  - `SDKWORK_ACCESS_TOKEN`
  - `SDKWORK_AUTH_TOKEN`
- After interactive login, session bootstrap `MUST` replace bootstrap env credentials per `IAM_SPEC.md` section 5.2.1.

## 6. Repository Script Standard

Application repositories that provide IAM bootstrap tooling `SHOULD` expose:

```text
pnpm run admin:bootstrap:app -- --config <app-root>/sdkwork.app.config.json --domain <primary-domain>
```

Workspace-level batch bootstrap lives in `sdkwork-space/bin/`:

| Platform | Command |
| --- | --- |
| Linux / macOS | `./bin/bootstrap-all-apps.sh --profile <dev\|test\|staging\|production>` |
| Windows PowerShell | `.\bin\bootstrap-all-apps.ps1 --profile <dev\|test\|staging\|production>` |
| Windows CMD | `bin\bootstrap-all-apps.cmd --profile <dev\|test\|staging\|production>` |
| Node | `node bin/bootstrap-all-apps.mjs --profile <dev\|test\|staging\|production>` |

Rules:

- Batch bootstrap `MUST` delegate per-app execution to `@sdkwork/iam-application-bootstrap` through `sdkwork-appbase/scripts/bootstrap/bootstrap-app.mjs`.
- Batch bootstrap `MUST` load environment profile values from `configs/bootstrap/profiles/<profile>.env` or `<profile>.local.env`.
- Batch bootstrap `MUST` resolve per-app domain from `sdkwork.app.config.json#environments`, `runtime.apiBaseUrl`, or `backend.defaultBind` unless `--domain` overrides all apps.
- Legacy `schemaVersion: 1` `sdkwork.app.config` and `schemaVersion: 2` backend gateway manifests `MAY` be upgraded in place through `bin/scaffold-app-manifest-bootstrap.mjs` before batch bootstrap.
- Public script first segment `MUST` be `admin` per `PNPM_SCRIPT_SPEC.md` for application repositories; workspace `bin/` utilities `MAY` use neutral names such as `bootstrap-all-apps`.
- Database seed/bootstrap scripts `MUST NOT` be confused with IAM application bootstrap; database lifecycle remains under `db:*`.

## 7. Verification

Every repository that owns application bootstrap behavior `MUST` run:

```bash
node ../sdkwork-specs/tools/check-iam-application-bootstrap-standard.mjs --root .
```

Application repositories with IAM bootstrap `MUST` also run:

```bash
pnpm --filter @sdkwork/iam-application-bootstrap test
```

Embedded IAM application repositories under `sdkwork-space` `MUST` run the workspace audit before merge:

```bash
node ../sdkwork-specs/tools/audit-iam-embedded-bootstrap-workspace.mjs
```

Each embedded IAM repository `MUST` provide `scripts/dev/*-iam-application-bootstrap-standard.test.mjs` and keep startup ordering aligned with section 5.1. Cloud split-services repositories `MUST` inject `SDKWORK_APP_ROOT` on every dev and gateway startup path (directly or through `@sdkwork/app-topology` `resolveIamDevEnv()`).

## 8. New Application Checklist

- [ ] Declare non-empty `backend.accessTokenPermissionScope` in `sdkwork.app.config.json`.
- [ ] Use `@sdkwork/iam-application-bootstrap` for bootstrap orchestration.
- [ ] Keep CLI/bootstrap scripts thin; no raw bootstrap HTTP in app code.
- [ ] Wire backend SDK or IAM service adapter for non-CLI environments.
- [ ] For embedded unified-process/installer runtimes, delegate to `sdkwork-iam-embedded-application-bootstrap` instead of local SQL/bootstrap copies.
- [ ] Document `admin:bootstrap:app` or approved equivalent in the app runbook.
- [ ] Run `check-iam-application-bootstrap-standard.mjs` before merge.
- [ ] For embedded IAM runtimes, run `audit-iam-embedded-bootstrap-workspace.mjs` and the repository `*-iam-application-bootstrap-standard.test.mjs` governance test before merge.
- [ ] Run `@sdkwork/iam-application-bootstrap` contract tests when the framework package is present in the workspace.

## 9. Acceptance Checklist

- [ ] Bootstrap flow uses register → provision → enable → access credential only.
- [ ] No `plus_*`, legacy `iam_application`, or `studio_*` bootstrap ownership remains in IAM appbase paths.
- [ ] Backend bootstrap paths use `lower_snake_case` static segments.
- [ ] Generated backend SDK and `@sdkwork/iam-service` expose `iam.applications.register`, `iam.tenantApplications.*`, and `iam.accessCredentials.create`.
- [ ] Application-owned scripts import `@sdkwork/iam-application-bootstrap` instead of raw bootstrap HTTP.
- [ ] Embedded Rust runtimes import `sdkwork-iam-embedded-application-bootstrap` instead of local tenant-application SQL.
- [ ] Manifest mapping and auth merge live in the framework package.
- [ ] Governance checker passes for the application root.
