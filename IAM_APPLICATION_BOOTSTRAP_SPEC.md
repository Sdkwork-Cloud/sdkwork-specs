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
| Issue access credential | `POST` | `/backend/v3/api/iam/access_credentials` | `accessCredentials.create` | `bootstrap-body` |

Rules:

- Bootstrap operations `MUST NOT` require dual-token headers.
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

## 3. Reusable Framework Package

The canonical reusable module is:

```text
@sdkwork/iam-application-bootstrap
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
| SaaS/private backend SDK runtime | `createIamApplicationBootstrapClientFromBackend` | Uses generated `@sdkwork/appbase-backend-sdk` or approved backend SDK |
| Existing IAM service runtime | `createIamApplicationBootstrapClientFromIamService` | Uses `@sdkwork/iam-service` without raw HTTP |
| Server/container service bootstrap | fetch or backend SDK adapter | May write `.sdkwork.local.env` or inject env through approved secret store |

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
- Batch bootstrap `MUST` resolve per-app domain from `sdkwork.app.config.json#environments` unless `--domain` overrides all apps.
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

## 8. New Application Checklist

- [ ] Declare non-empty `backend.accessTokenPermissionScope` in `sdkwork.app.config.json`.
- [ ] Use `@sdkwork/iam-application-bootstrap` for bootstrap orchestration.
- [ ] Keep CLI/bootstrap scripts thin; no raw bootstrap HTTP in app code.
- [ ] Wire backend SDK or IAM service adapter for non-CLI environments.
- [ ] Document `admin:bootstrap:app` or approved equivalent in the app runbook.
- [ ] Run `check-iam-application-bootstrap-standard.mjs` before merge.
- [ ] Run `@sdkwork/iam-application-bootstrap` contract tests when the framework package is present in the workspace.

## 9. Acceptance Checklist

- [ ] Bootstrap flow uses register → provision → enable → access credential only.
- [ ] No `plus_*`, legacy `iam_application`, or `studio_*` bootstrap ownership remains in IAM appbase paths.
- [ ] Backend bootstrap paths use `lower_snake_case` static segments.
- [ ] Generated backend SDK and `@sdkwork/iam-service` expose `iam.applications.register`, `iam.tenantApplications.*`, and `iam.accessCredentials.create`.
- [ ] Application-owned scripts import `@sdkwork/iam-application-bootstrap` instead of raw bootstrap HTTP.
- [ ] Manifest mapping and auth merge live in the framework package.
- [ ] Governance checker passes for the application root.
