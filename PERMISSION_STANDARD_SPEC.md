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

Surfaces may overlap. Backend API requires `organizationMember = true`.

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

- Rust: `sdkwork-router-iam-backend-api/src/operation_permissions.rs`
- TypeScript: `@sdkwork/iam-contracts` `backend-operation-permissions.ts`

## Authorization Pipeline

1. `WebRequestContextResolver` — credentials → principal + `permissionScope`
2. Backend surface gate — organization membership context required
3. `ManifestAuthorizationPolicy` — route `required_permission` vs `permissionScope`
4. `IamAuthorizationPolicy` — IAM org gate + manifest policy
5. Handler/service — `data_scope` filtering

UI `can()` checks are hints only. Server enforcement is mandatory.

## OpenAPI Extensions

| Extension | Meaning |
| --- | --- |
| `x-sdkwork-permission` | Required permission code |
| `x-sdkwork-required-surface` | `organizationMember` for backend protected routes |

## Extension Rules

- Tenants may define custom roles (`standard = false`)
- Custom role grants cannot exceed assigner's effective `permissionScope`
- Product permissions register under `{product}.{resource}.{action}`

## Acceptance

- [ ] All protected backend manifest routes declare `required_permission`
- [ ] OpenAPI operations include matching `x-sdkwork-permission`
- [ ] Standard roles seeded with permission matrix
- [ ] Frontend uses `@sdkwork/iam-contracts` permission helpers (no raw HTTP auth)
