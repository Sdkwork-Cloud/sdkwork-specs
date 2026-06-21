# IAM RBAC Federation Standard

- Version: 1.0
- Scope: distributed permission catalogs, role catalogs, directory templates, module discovery, registry materialization, and RBAC evaluation boundaries
- Related: `IAM_SPEC.md`, `PERMISSION_STANDARD_SPEC.md`, `IAM_MODULE_MANIFEST_SPEC.md`, `IAM_DIRECTORY_TEMPLATE_SPEC.md`, `IAM_CATALOG_GOVERNANCE_SPEC.md`, `DATABASE_SPEC.md`, `DATABASE_FRAMEWORK_SPEC.md`, `MODULE_SPEC.md`, `COMPONENT_SPEC.md`, `API_SPEC.md`, `SECURITY_SPEC.md`, `APP_MANIFEST_SPEC.md`

SDKWork adopts **IAM Module Federation (IMF)**. Platform kernel capabilities stay in `sdkwork-appbase`. Product domains declare permissions, domain-standard roles, role-grant extensions, and directory tree templates through `iam.module.manifest.json`. Applications compose enabled modules; the registry orchestrator discovers, validates, merges, and materializes catalogs into `iam_*` tables.

## 1. Layer Model

| Layer | Name | Owner | Primary tables |
| --- | --- | --- | --- |
| L1 | Subject directory | Kernel skeleton + module templates | `iam_tenant`, `iam_organization`, `iam_department`, `iam_position`, memberships, assignments, closure tables |
| L2 | Capability catalog | Each module | `iam_permission`, `iam_module_registry_*` |
| L3 | Assignment | Kernel roles + module extensions | `iam_role`, `iam_role_permission`, `iam_role_binding`, `iam_role_exclusion` |
| L4 | Policy | Kernel + module condition vocabulary | `iam_policy`, binding `condition_json` |
| L5 | Surface | Kernel only | Derived `userSurface`, token `permission_scope`, backend surface gate |

Authorization chain:

```text
subject -> role_binding (allow/deny) -> role -> role_permission -> permission -> policy (optional) -> surface gate
```

Rules:

- UI permission checks are hints only. Server-side authorization is mandatory.
- Deny bindings override allow bindings when both match.
- Custom tenant roles cannot exceed the assigner's effective `permission_scope`.
- Product domains must not fork RBAC evaluation engines.

## 2. Ownership Boundaries

| Artifact | `sdkwork-appbase` / `iam-kernel` | Domain module | Application root |
| --- | --- | --- | --- |
| RBAC evaluation / wildcard semantics | yes | no | no |
| Eight platform standard roles | yes | no | no |
| `iam.*` permissions | yes | no | no |
| `{domain}.*` permissions | no | yes | no |
| Domain standard roles | no | yes | no |
| Role grant extensions for platform roles | kernel base only | yes | no |
| Root org / general dept / member position skeleton | yes | no | no |
| Domain dept/position subtree templates | no | yes | no |
| Enabled module set | default bundled list | no | yes (`sdkwork.app.config.json`) |
| Tenant custom roles | no | no | runtime only |

## 3. Discovery And Materialization

Discovery sources, in priority order:

1. `specs/iam.module.manifest.json` — authoritative catalog
2. OpenAPI / route manifest `x-sdkwork-permission` — reconciliation input
3. `component.spec.json` `contracts.iamModuleManifest` — component registration
4. Generated lock artifact `iam-registry.lock.json` — release audit snapshot

Commands (application root):

```bash
pnpm run iam:modules:discover
pnpm run iam:modules:validate
pnpm run iam:modules:plan
pnpm run iam:modules:materialize
```

Materialization writes:

- `iam_permission`, `iam_role`, `iam_role_permission`
- directory entities and closure rows from templates
- `iam_module_registry_entry`, `iam_module_registry_snapshot`, `iam_catalog_materialization`

`db:seed` profile `operational` must invoke IMF materialization after SQL subject seed.

## 4. Industry Alignment

| Concept | SDKWork mapping |
| --- | --- |
| Permission | `iam_permission.code` |
| Role | `iam_role` with `role_class` |
| Role assignment | `iam_role_binding` |
| Resource hierarchy | tenant → organization → department → position |
| Group | `iam_group` / `iam_group_member` |
| Service account | `iam_service_account` |
| Deny | `iam_role_binding.effect = deny` (evaluated in `sdkwork-appbase-iam-bootstrap::rbac_scope`) |
| SoD | `iam_role_exclusion` (materialized from module manifests) |
| ABAC | `iam_policy`, binding `condition_json` |
| Managed catalog registry | `iam_module_registry_*` |

## 5. Acceptance Checklist

- [x] Every bundled domain permission is declared in an `iam.module.manifest.json` owned by that domain.
- [x] `sdkwork-appbase-iam-bootstrap` no longer owns non-`iam.*` permission seeds directly.
- [x] `pnpm run iam:modules:validate` passes in CI.
- [x] `import_postgres_default_iam_seed` delegates to the module registry orchestrator.
- [x] OpenAPI protected operations reconcile to manifest permissions.
- [x] Registry snapshots are written on every materialization.
- [x] Backend role binding and role-permission grants enforce assigner `permission_scope` coverage and block retired permissions.
- [x] Backend directory APIs expose tenant-scoped `iam_group`, `iam_group_member`, and `iam_service_account` CRUD aligned with kernel permissions.
- [x] Nested department templates resolve `parentRef`, persist hierarchy paths, and materialize `iam_department_closure` rows.
- [x] Operational `zh-CN` locale seed overlays apply IMF display labels after catalog materialization.
- [x] Deprecated permissions declare `replacementCode` (enforced by `iam:modules:validate` and registry validation).
