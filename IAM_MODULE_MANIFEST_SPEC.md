# IAM Module Manifest Standard

- Version: 1.0
- Scope: machine-readable IMF declarations for permissions, roles, directory templates, and module dependencies
- Related: `IAM_RBAC_FEDERATION_SPEC.md`, `IAM_DIRECTORY_TEMPLATE_SPEC.md`, `IAM_CATALOG_GOVERNANCE_SPEC.md`, `COMPONENT_SPEC.md`, `NAMING_SPEC.md`

Each IMF-capable module `MUST` publish:

```text
<module-root>/
  specs/iam.module.manifest.json
```

Applications may additionally ship:

```text
iam/registry/iam-registry.config.json
```

## 1. Top-Level Shape

```json
{
  "schemaVersion": 1,
  "kind": "sdkwork.iam.module",
  "moduleId": "iot",
  "catalogVersion": "1.0.0",
  "domain": "iot",
  "owner": "sdkwork-aiot",
  "displayName": "IoT Platform Module",
  "permissions": { "catalog": [], "openapiAuthorities": [] },
  "roles": {
    "domainStandardRoles": [],
    "roleGrantExtensions": [],
    "roleExclusions": []
  },
  "directory": {
    "organizationTemplates": [],
    "departmentTemplates": [],
    "positionTemplates": [],
    "membershipTemplates": []
  },
  "policyConditions": { "supportedAttributes": [] },
  "oauthScopeMappings": [],
  "dependencies": { "requiresModules": ["iam-kernel"] }
}
```

Rules:

- `moduleId` uses lower kebab-case.
- `domain` must match the permission code prefix for all permissions in the module.
- `catalogVersion` follows semantic versioning for catalog-breaking changes.
- `dependencies.requiresModules` must form an acyclic graph.

## 2. Permission Entries

```json
{
  "code": "iot.devices.read",
  "name": "Read IoT devices",
  "resource": "devices",
  "action": "read",
  "status": "active",
  "since": "1.0.0",
  "replacementCode": null
}
```

Rules:

- `code` format: `{domain}.{resource}.{action}`.
- `status`: `active`, `deprecated`, `retired`.
- `deprecated` entries must set `replacementCode` unless an approved governance exception exists.
- Retired permissions must not appear in new role grants.

## 3. Role Entries

### 3.1 Platform standard roles

Declared only in `iam-kernel`. Other modules must not redefine platform role codes.

### 3.2 Domain standard roles

```json
{
  "code": "iot_field_operator",
  "name": "IoT Field Operator",
  "surface": "organization",
  "scope": "organization",
  "standard": true,
  "assignable": true,
  "bindingPrincipalKind": "organization_membership",
  "permissionPatterns": ["iot.devices.read", "iot.commands.create"]
}
```

Rules:

- Domain role codes must be namespaced by the owning domain.
- `permissionPatterns` must expand only to permissions owned by the same module unless an approved cross-domain exception exists.

### 3.3 Role grant extensions

```json
{
  "roleCode": "org_operations",
  "patterns": ["iot.*"]
}
```

Rules:

- `roleCode` must reference a platform standard role or a domain standard role already discovered in the merged catalog.
- Patterns use the permission wildcard grammar from `PERMISSION_STANDARD_SPEC.md`.

## 4. Component Registration

`component.spec.json` `contracts` should include:

```json
"iamModuleManifest": "specs/iam.module.manifest.json"
```

## 5. Validation Rules

| Id | Rule |
| --- | --- |
| R1 | Namespace ownership: module owns only its `domain.*` permissions |
| R2 | No duplicate permission codes across merged modules |
| R3 | Grant patterns must expand against merged permission catalog |
| R4 | Directory refs must resolve |
| R5 | Directory graph must be acyclic |
| R6 | `requiresModules` order must be satisfiable |
| R7 | Disabled modules are excluded from seed materialization |
| R8 | OpenAPI permissions must be subset of manifest permissions |
