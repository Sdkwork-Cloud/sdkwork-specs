# App Permission Composition Standard

- Version: 1.0
- Scope: modular permission catalog inheritance, consumer override policy, route guard hints, bootstrap scope layering, and alignment with IMF module manifests
- Related: `PERMISSION_STANDARD_SPEC.md`, `IAM_MODULE_MANIFEST_SPEC.md`, `IAM_RBAC_FEDERATION_SPEC.md`, `APP_COMPOSITION_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, `MODULE_SPEC.md`, `API_SPEC.md`, `WEB_FRAMEWORK_SPEC.md`, `IAM_CREDENTIAL_ENTRY_SPEC.md`

## 1. Purpose

SDKWork modules declare authoritative permission catalogs once. Consumer applications compose modules as building blocks and **inherit** those catalogs through composition manifests. Consumers **must not** re-declare dependency-module permission codes in local TypeScript constants, duplicated OpenAPI extensions, or ad-hoc admin menu filters.

By default, `permissionComposition.moduleCatalogRefs[]` is **derived** from consumer `contracts.sdkDependencies` using `APP_INTEGRATION_CONVENTIONS.md`. Consumers write `moduleCatalogRefs` only when narrowing or replacing inherited manifests through `composition.overrides.permissions`.

Consumers **may** declare:

- application-owned permissions for product/gateway domains they own;
- explicit **overrides** that narrow, remap, or supplement inherited catalogs;
- frontend **hints** derived from inherited metadata.

Server enforcement remains authoritative. UI hints never replace backend authorization.

## 2. Authority Layers

| Layer | Artifact | Owns |
| --- | --- | --- |
| L0 IMF module | `specs/iam.module.manifest.json` per module | `{domain}.{resource}.{action}` catalog, domain roles, OpenAPI authority bindings |
| L0 API contract | OpenAPI `x-sdkwork-permission`, `x-sdkwork-required-surface` | Operation-level required permission for each protected route |
| L1 app composition | app-surface `specs/component.spec.json` `contracts.permissionComposition` | Which module catalogs are inherited, bootstrap scope policy, allowed overrides |
| L2 runtime | `@sdkwork/iam-contracts`, gateway manifest policy, web framework | Effective permission scope on tokens, route enforcement |
| L3 feature UI | route classification, menu metadata, `can()` hints | UX only; must reference inherited codes, not invent parallel catalogs |

Forbidden:

- L3 feature packages defining standalone permission string tables for dependency-owned domains.
- L2 bootstrap hand-authoring full IAM/commerce permission matrices already owned by dependency modules.
- L1 manifests copying dependency OpenAPI permission lists instead of referencing module catalogs.

## 3. Inheritance Model

Effective permission metadata resolves in this order (later wins only where override is explicitly allowed):

```text
1. Platform kernel catalog (iam-kernel IMF manifest)
2. Enabled dependency module catalogs (commerce, models, drive, iam, …)
3. Application-owned module catalog (product/gateway domain)
4. permissionComposition.overrides[] (explicit only)
5. Runtime token/session permissionScope (issued by IAM; not redefined by UI)
```

Rules:

- Dependency module permissions are **inherited by reference** through `moduleCatalogRefs[]`. Consumers do not restate individual codes unless an override entry exists.
- Application-owned permissions live in the consumer's own `specs/iam.module.manifest.json`.
- OpenAPI operations on dependency-owned routes inherit `x-sdkwork-permission` from the dependency authority. Consumer OpenAPI overlays must not rewrite dependency permission codes unless the consumer truly owns the handler (see `dependency-api-surfaces.json` `productOwnedOperationOverrides`).

## 4. `permissionComposition` Manifest Section

Every client application root with modular admin/console/app surfaces should declare `contracts.permissionComposition` inside app-surface `specs/component.spec.json`.

```json
{
  "permissionComposition": {
    "inheritanceMode": "module-catalog-with-overrides",
    "applicationModule": {
      "manifestRef": "specs/iam.module.manifest.json"
    },
    "moduleCatalogRefs": [
      {
        "moduleId": "iam-kernel",
        "manifestRef": "../../../sdkwork-iam/specs/iam.module.manifest.json",
        "inheritPermissions": true,
        "inheritRoles": false
      },
      {
        "moduleId": "shop",
        "manifestRef": "../../../sdkwork-shop/specs/iam.module.manifest.json",
        "inheritPermissions": true,
        "inheritRoles": true
      }
    ],
    "bootstrapAccessTokenScope": {
      "inheritFrom": "sdkwork.app.config.json#backend.accessTokenPermissionScope",
      "supplement": [],
      "overrideReplace": false
    },
    "routePermissionHints": {
      "inheritFromOpenApi": true,
      "inheritFromModuleManifests": true,
      "overrides": []
    },
    "consumerPolicy": {
      "forbidLocalPermissionCatalogForDependencyDomains": true,
      "allowExplicitOverridesOnly": true,
      "allowFrontendHintsWithoutServerDuplication": true
    }
  }
}
```

Field rules:

| Field | Required | Meaning |
| --- | --- | --- |
| `inheritanceMode` | yes | Must be `module-catalog-with-overrides` |
| `applicationModule.manifestRef` | when app owns permissions | Relative path to consumer IMF manifest |
| `moduleCatalogRefs[]` | yes | Dependency catalogs inherited by reference |
| `moduleCatalogRefs[].inheritPermissions` | yes | When true, consumer treats catalog codes as available without local duplication |
| `bootstrapAccessTokenScope.inheritFrom` | recommended | Pointer to app manifest bootstrap scope |
| `bootstrapAccessTokenScope.supplement` | optional | Additional bootstrap-only codes; must use standard `{domain}.{resource}.{action}` format |
| `routePermissionHints.overrides[]` | optional | Explicit `{ routeId, requiredPermission }` replacements for UX hints only |
| `consumerPolicy.forbidLocalPermissionCatalogForDependencyDomains` | yes | Must be `true` for standard apps |

Override entry shape:

```json
{
  "kind": "permission-code-replacement",
  "from": "legacy:console",
  "to": "clawrouter.console.access",
  "scope": "bootstrap-dev-only",
  "reason": "Migrate legacy colon permission codes to PERMISSION_STANDARD_SPEC format"
}
```

Override kinds allowed:

- `permission-code-replacement` — alias/deprecation bridge only; server must accept both during migration window documented in `MIGRATION_SPEC.md`
- `route-hint-override` — frontend/menu hint only
- `bootstrap-scope-supplement` — adds codes to dev bootstrap access token scope only

Forbidden override kinds:

- Replacing dependency-owned backend enforcement with weaker local checks
- Blanket `*` grants in consumer manifests

## 5. Module Package Rules

Reusable modules (`MODULE_SPEC.md`) declare permissions once:

- IMF manifest when the module participates in catalog federation
- OpenAPI extensions on owned API authorities
- Optional `permissionCatalogProvider` for dynamic hints

Feature packages **must**:

- import permission helpers from `@sdkwork/iam-contracts` or module-owned contracts packages;
- reference inherited codes in route/menu metadata by code string only;
- avoid copying commerce/iam/models permission arrays into local `constants/permissions.ts`.

Feature packages **may**:

- declare route-level `requiredPermission` in local `component.spec.json` **only** when that route is owned by the feature module and the code exists in the module's IMF manifest or owning OpenAPI authority.

## 6. Bootstrap and Credential Entry

Bootstrap access token scope (`sdkwork.app.config.json` `backend.accessTokenPermissionScope`) is **not** a substitute for user session RBAC. It only gates credential-entry and pre-login SDK transport.

Rules:

- Bootstrap scope **inherits** from app manifest; `permissionComposition.bootstrapAccessTokenScope.supplement` may add dev-only codes.
- Bootstrap scope **must not** duplicate entire dependency module catalogs.
- Credential-entry transport follows `IAM_CREDENTIAL_ENTRY_SPEC.md`; permission inheritance does not change bootstrap JWT requirements on `credential_entry_public` routes.

## 7. Frontend Route and Menu Hints

Frontend route classification and admin menus **should** filter using inherited permission codes:

```text
effectiveRoutePermission =
  routePermissionHints.overrides[routeId]
  ?? OpenAPI x-sdkwork-permission for owned route
  ?? module manifest binding for reusable module route
```

Rules:

- Missing hint must not bypass server checks.
- Admin shell menus must not show routes whose required permission is absent from effective user `permissionScope`.
- Binary install-status probes are bootstrap gates only and **must not** replace per-route RBAC for dependency-owned admin modules.

## 8. Verification

Application roots **must** verify:

```bash
node tools/verify-repo.mjs --root <repo-root>
pnpm run iam:modules:validate   # when IMF enabled
```

Additional checks:

- `permissionComposition.moduleCatalogRefs[]` paths resolve
- No duplicate permission catalog files in feature packages for referenced dependency domains
- OpenAPI `x-sdkwork-permission` codes exist in referenced module catalog or application catalog
- Legacy non-standard permission codes have documented override replacements

## 9. Acceptance Checklist

- [ ] Dependency module permissions are inherited by reference, not copied into consumer packages.
- [ ] Consumer declares `contracts.permissionComposition` in app-surface `component.spec.json`.
- [ ] Application-owned permissions live in consumer `specs/iam.module.manifest.json`.
- [ ] Explicit overrides are listed in `permissionComposition`; no hidden local catalogs.
- [ ] Frontend route/menu hints reference inherited codes; server enforcement unchanged.
- [ ] Bootstrap access token scope remains minimal and standard-formatted.
