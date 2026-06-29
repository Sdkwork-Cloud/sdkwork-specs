# Permission Standard Specification

> Canonical permission, role, and authorization standard for SDKWork IAM.

## Scope

This spec defines:

- User surface classification (app vs organization member)
- Eight immutable standard roles
- Permission code naming and operation mapping
- Server-side authorization enforcement
- OpenAPI contract extensions

Related specs: `IAM_SPEC.md` §7, `API_SPEC.md` §18.

## User Surface

| Field | Rule |
| --- | --- |
| `userSurface.app` | Active `iam_tenant_member` |
| `userSurface.organizationMember` | Active `iam_organization_membership` |

Surfaces may overlap. Backend API requires `loginScope = "ORGANIZATION"` with a non-zero `organizationId` plus route permission. Persistent `userSurface.organizationMember = true` alone does not authorize backend-api access while the active session is personal (`loginScope = "TENANT"`).

## Standard Roles

| Code | Scope | Surface |
| --- | --- | --- |
| `app_user` | tenant | app |
| `org_admin` | organization | organization |
| `org_assistant` | organization | organization |
| `org_auditor` | organization | organization |
| `org_finance` | organization | organization |
| `org_operations` | organization | organization |
| `platform_system_admin` | tenant | platform |
| `platform_super_admin` | tenant | platform |

Legacy `owner` is deprecated; migrate to `org_admin`.

## Permission Codes

Format: `{domain}.{resource}.{action}`

Examples: `iam.users.read`, `iam.oauth.manage`, `commerce.orders.approve`

Wildcard grants:

- `*` — global
- `{domain}.*` — domain-wide
- `*.{action}` — action-wide (e.g. `*.read`)

## Operation Mapping (Backend API)

Backend `operationId` maps to permission codes by convention:

| Operation suffix | Permission action |
| --- | --- |
| `list`, `retrieve`, `tree` | `read` |
| `create` | `create` |
| `update` | `update` |
| `delete`, `revoke` | `delete` / `revoke` |
| `iam.oauth.*` list/retrieve | `iam.oauth.read` |
| `iam.oauth.*` mutations | `iam.oauth.manage` |

Authoritative implementations:

- Rust: `sdkwork-routes-iam-backend-api/src/operation_permissions.rs`
- TypeScript: `@sdkwork/iam-contracts` `backend-operation-permissions.ts`

## Authorization Pipeline

1. `WebRequestContextResolver` — credentials → principal + `permissionScope`
2. Backend surface gate — `loginScope = ORGANIZATION` and non-zero `organizationId` required
3. `ManifestAuthorizationPolicy` — route `required_permission` vs `permissionScope`
4. `IamAuthorizationPolicy` — IAM org/login-scope gate + manifest policy
5. Handler/service — `data_scope` filtering using active `loginScope` and `organizationId`

UI `can()` checks are hints only. Server enforcement is mandatory.

## OpenAPI Extensions

| Extension | Meaning |
| --- | --- |
| `x-sdkwork-permission` | Required permission code |
| `x-sdkwork-required-surface` | `organizationMember` for backend protected routes |

## Extension Rules

- Tenants may define custom roles (`standard = false`)
- Custom role grants cannot exceed assigner's effective `permissionScope`
- Product permissions register under `{product}.{resource}.{action}` through `IAM_MODULE_MANIFEST_SPEC.md` and IMF discovery
- Platform kernel permissions remain in `iam-kernel`; product domains must not be seeded from `sdkwork-iam-bootstrap` monolith catalogs

## Consumer Permission Composition

Consumer applications compose dependency modules as building blocks. See `APP_PERMISSION_COMPOSITION_SPEC.md`.

Rules:

- Consumers inherit dependency permission catalogs through app-surface `component.spec.json` `contracts.permissionComposition.moduleCatalogRefs[]`.
- Consumers **must not** duplicate dependency permission code lists in local TypeScript/Rust constants or feature-package catalogs.
- Consumers **may** declare application-owned permissions in their own `specs/iam.module.manifest.json`.
- Explicit **overrides** (aliases, route hints, bootstrap supplements) must be listed in `permissionComposition`; hidden local overrides are forbidden.
- Frontend route/menu hints may reference inherited codes; server enforcement remains mandatory per the Authorization Pipeline above.

## IMF Commands

Application roots with IAM Module Federation enabled must run:

```bash
pnpm run iam:modules:validate
```

Materialization is performed by `sdkwork-iam-module-registry` during database bootstrap and `import_postgres_default_iam_seed`.

Related: `IAM_RBAC_FEDERATION_SPEC.md`, `IAM_CATALOG_GOVERNANCE_SPEC.md`

## Acceptance

- [ ] All protected backend manifest routes declare `required_permission`
- [ ] OpenAPI operations include matching `x-sdkwork-permission`
- [ ] Standard roles seeded with permission matrix
- [ ] Frontend uses `@sdkwork/iam-contracts` permission helpers (no raw HTTP auth)
