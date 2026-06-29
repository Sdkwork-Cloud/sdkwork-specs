# Schema Registry Composition Standard

- Version: 1.0
- Scope: compositional schema registry for SDKWork applications and reusable modules — table contracts, frontend field contracts, route classification, API operation overlays, and effective snapshot materialization
- Related: `DATABASE_SPEC.md`, `DATABASE_FRAMEWORK_SPEC.md`, `API_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, `COMPONENT_SPEC.md`, `WEB_FRAMEWORK_SPEC.md`, `QUALITY_GATE_SPEC.md`, `TEST_SPEC.md`
- Framework implementation: `../sdkwork-web-framework/crates/sdkwork-web-schema-registry`, `../sdkwork-web-framework/tools/schema_registry/`, `../sdkwork-web-framework/specs/SCHEMA_REGISTRY_STANDARD.md`

This standard defines how SDKWork modules **own** schema registry artifacts and how applications **assemble** them without copying sibling contracts.

## 1. System Model

```text
sdkwork-specs/SCHEMA_REGISTRY_SPEC.md (L0)
  -> narrows
sdkwork-web-framework/specs/SCHEMA_REGISTRY_STANDARD.md (L1 executable profile)
  -> enforced by
sdkwork-web-schema-registry composer (L2 runtime)
  -> consumed by
application tools, schema manifest, frontend contract guardians, OpenAPI materialization (L3)
```

Rules:

- Each bounded module `MUST` publish an **owner registry** for tables, operations, and frontend contracts it owns.
- Each application `MUST` publish an **assembly registry** that declares only owned overlays, projections, route classification, and dependency references.
- Applications `MUST NOT` copy sibling module tables, IAM base operations, or commerce base operations into their assembly registry as if locally owned.
- Dependency-owned API and UI surfaces `MUST` be declared through `dependency_owned`, `source_refs`, and `specs/dependency-api-surfaces.json`; they `MUST NOT` be duplicated in the application OpenAPI authority.
- The canonical composer lives in `sdkwork-web-framework`. Application repositories `MUST NOT` fork merge logic locally.

## 2. Registry Kinds

| Kind | Owner | Location | Purpose |
| --- | --- | --- | --- |
| Owner table registry | Module platform team | `<module-root>/docs/schema-registry/<module-id>.tables.yaml` | Authoritative table contracts for module-owned prefixes |
| Assembly table registry | Application team | `<app-root>/docs/schema-registry/<application-code>.tables.yaml` | Owned tables, projections, fragments, dependency composition |
| Owner frontend contract | Module platform team | `<module-root>/docs/schema-registry/frontend-field-contracts/` | Module-owned frontend models, operations, routes |
| Assembly frontend contract | Application team | `<app-root>/docs/schema-registry/frontend-field-contracts/` | Application overlays plus dependency route classification |
| Route classification | Application team | `<app-root>/docs/schema-registry/frontend-route-classification.yaml` | Delivery kind, SDK family, dependency ownership per route |
| Effective snapshot | Generated | `<app-root>/generated/schema/registry/*.effective.yaml`, `frontend-field-contracts.yaml` | Deterministic composed output for guardians, manifests, and tests |

## 3. Directory Layout

### 3.1 Owner module

```text
<module-root>/
  docs/schema-registry/
    <module-id>.tables.yaml
    tables/
      *.yaml
    frontend-field-contracts/
      index.yaml
      models/
      operations/
      routes/
      shared/
```

### 3.2 Assembly application

```text
<app-root>/
  database/
    database.manifest.json
  docs/schema-registry/
    <application-code>.tables.yaml
    tables/
      *.yaml
    frontend-field-contracts/
      index.yaml
      ...
    frontend-route-classification.yaml
  generated/schema/registry/
    <application-code>.tables.effective.yaml
  specs/
    dependency-api-surfaces.json
```

Rules:

- Owner modules `MUST` keep all owned tables under their own registry root.
- Assembly applications `MAY` use `table_fragments` for local owned tables only.
- Assembly applications `MAY` use `registry_dependencies` or derive dependencies from `database/database.manifest.json`.
- Generated effective snapshots `MUST NOT` be hand-edited.

## 4. Composition Inputs

### 4.1 Local fragments

Assembly registries `MAY` declare:

```yaml
table_fragments:
  - tables/025-ai.yaml
  - tables/028-commerce.yaml
```

Rules:

- Fragment paths `MUST` stay under the registry directory.
- Fragment merge order `MUST` be deterministic: inline `tables` first, then fragments in declaration order.
- Duplicate table names across fragments `MUST` fail composition unless an approved projection rule applies (§6.3).

Frontend contracts `MAY` declare:

```yaml
fragments:
  - models/console-wallet.yaml
  - operations/app-iam.yaml
  - routes/routes.yaml
```

Rules:

- List sections (`frontend_models`, `frontend_operations`, `routes`) merge by append.
- Mapping sections (`x_response_entities`) merge by key; duplicate keys `MUST` fail.
- Metadata keys (`schema`, `version`, `source`, `rule`) come from the index only.

### 4.2 Registry dependencies

Assembly registries `MAY` declare explicit dependencies:

```yaml
registry_dependencies:
  - module_id: appbase-iam
    locator: ../sdkwork-appbase
    registry_path: docs/schema-registry/sdkwork-appbase.tables.yaml
    order: 10
    ownership: read_only
  - module_id: commerce-core
    locator: ../sdkwork-commerce (deleted)
    registry_path: docs/schema-registry/sdkwork-commerce (deleted).tables.yaml
    order: 20
    ownership: read_only
```

When `registry_dependencies` is omitted, the composer `SHOULD` derive equivalent entries from `database/database.manifest.json#modules[]` using:

| Manifest field | Registry dependency field |
| --- | --- |
| `moduleId` | `module_id` |
| `locator` | `locator` |
| `order` | `order` |
| n/a | `registry_path` defaults to `docs/schema-registry/<module-id>.tables.yaml` under `locator` |
| n/a | `ownership` defaults to `read_only` |

Rules:

- Dependency registries `MUST` be loaded in ascending `order`.
- Missing dependency files `MUST` fail CI for release applications unless an approved bootstrap exception documents temporary absence.
- Dependency tables enter the effective registry as read-only references; assembly apps `MUST NOT` regenerate their DDL.
- Cyclic dependency graphs `MUST NOT` exist.

### 4.3 Source references

Projection or analytics tables that read sibling-owned base tables `MUST` use `source_refs` instead of copying base table definitions:

```yaml
- table: commerce_account_ledger_entry
  domain: commerce
  profile: ledger_projection
  system_of_record: false
  generated_by_this_project: false
  write_owner: clawrouter-settlement-worker
  source_refs:
    - module_id: commerce-core
      table: commerce_account_ledger_entry
  columns:
    ...
```

Rules:

- `source_refs` `MUST` name the owning module and canonical table.
- `source_refs` `MUST NOT` replace owner registry publication; they document cross-module lineage for guardians and manifests.
- Base capability tables (`iam_*`, core `commerce_*`, `appstore_*`, catalog dictionary tables) `MUST NOT` appear as generated assembly-owned tables.

## 5. Ownership and Delivery Semantics

### 5.1 Table ownership

| Field | Meaning |
| --- | --- |
| `system_of_record: true` | Module/application owns authoritative writes |
| `system_of_record: false` | Projection, analytics, or read model only |
| `generated_by_this_project: true` | DDL generated from this application/module registry |
| `generated_by_this_project: false` | Imported or referenced from sibling module |
| `write_owner` | Service or worker crate responsible for writes |

Assembly applications `MUST` set `generated_by_this_project: false` for all dependency-owned base tables and `true` only for locally generated prefixes declared in `database/database.manifest.json#tablePrefix` or documented projection exceptions.

### 5.2 Frontend/API dependency ownership

Routes and operations consumed through dependency SDKs `MUST` declare:

```yaml
dependency_owned: true
delivery_kind: composed_local_mount | external_service | consumer_sdk
sdk_family: sdkwork-commerce (deleted)-app-sdk
```

Rules:

- `dependency_owned: true` routes `MUST` appear in `specs/dependency-api-surfaces.json`.
- Assembly OpenAPI authority `MUST NOT` duplicate dependency-owned operations.
- Guardians `MUST` validate dependency-owned routes against mount evidence, SDK family tokens, and sibling module contracts.
- `composed_local_mount` `MAY` mount dependency UI locally while API ownership remains with the dependency SDK.

## 6. Merge Rules

The composer `MUST` implement deterministic merge semantics:

### 6.1 Dependency tables

1. Load each dependency registry in ascending order.
2. Collect tables keyed by `table`.
3. Later dependency tables with the same name `MUST` fail unless identical (deep equality on normalized contract).

### 6.2 Assembly tables

1. Merge inline `tables` and local `table_fragments`.
2. For each assembly table:
   - If no dependency table exists with the same name, register as assembly-owned.
   - If a dependency table exists:
     - Assembly `MUST` set `system_of_record: false` and `generated_by_this_project: false`.
     - Assembly `MUST` declare `source_refs` to the owning module unless an approved governance exception exists.
     - Conflicting column definitions `MUST` fail composition.

### 6.3 Frontend contracts

1. Merge local fragments only for assembly frontend contracts.
2. Dependency frontend contracts `SHOULD` remain in owner modules; assembly route classification references them by route path and SDK family rather than copying operation YAML.
3. Duplicate route paths with conflicting `dependency_owned` or SDK family metadata `MUST` fail.

### 6.4 Effective snapshot

The effective snapshot `MUST`:

- Include merged metadata from the assembly registry root.
- Include all dependency tables marked `imported: true`.
- Include all assembly tables marked `imported: false`.
- Rewrite relative spec paths for stable generated output.
- Be reproducible from source inputs alone.

## 7. Framework Integration

Applications `MUST` consume the canonical composer from `sdkwork-web-framework`:

| Surface | Path |
| --- | --- |
| Rust library | `sdkwork-web-schema-registry` |
| Python tools | `sdkwork-web-framework/tools/schema_registry/` |
| CLI | `cargo run -p sdkwork-schema-registry-cli -- compose tables ...` |

Application repositories `SHOULD` keep thin wrappers only:

```python
from schema_registry.composer import load_schema_registry, compose_frontend_field_contract
```

Wrappers `MUST NOT` reimplement merge logic.

Required application commands:

| Command | Purpose |
| --- | --- |
| Materialize effective table registry | Write `generated/schema/registry/*.effective.yaml` |
| Materialize frontend contract snapshot | Write `docs/schema-registry/frontend-field-contracts.yaml` |
| Check stale snapshots | Fail CI when generated output differs |

## 8. Quality Gates

Release applications `MUST` pass:

| Gate | Rule |
| --- | --- |
| Registry composition | Composer succeeds; no duplicate owned tables; valid `source_refs` |
| Schema manifest | Generated manifest matches effective registry |
| Schema guardian | No forbidden prefix duplication; projection rules respected |
| Frontend field audit | Page-critical fields map to registry columns or approved dependency contracts |
| Frontend operation audit | Operations resolve to owned or dependency-owned surfaces |
| Frontend contract guardian | Routes, SDK families, and mount evidence align |
| Dependency API surfaces | All `dependency_owned` operations declared in `dependency-api-surfaces.json` |
| API contract manifest | Dependency operations imported from sibling OpenAPI fragments, not duplicated manually |

Temporary bootstrap exceptions `MUST` be recorded in local `specs/component.spec.json` or an ADR with exit criteria.

## 9. Anti-Patterns

Applications and modules `MUST NOT`:

- Copy full sibling schema registries into the application repository.
- Register base `iam_*`, `commerce_*`, `appstore_*`, or catalog dictionary tables as assembly-generated DDL without `source_refs` and `generated_by_this_project: false`.
- Duplicate dependency OpenAPI operations in the application manifest to satisfy guardians.
- Hand-edit effective snapshots or generated schema manifests.
- Fork registry merge logic outside `sdkwork-web-framework`.

## 10. Migration Path

Existing monolithic registries `SHOULD` migrate in this order:

1. Extract owner tables and frontend contracts into sibling module registries.
2. Replace copied entries with `registry_dependencies` and `source_refs`.
3. Move dependency operations out of application OpenAPI authority into dependency import rules.
4. Point application tools to `sdkwork-web-schema-registry`.
5. Delete duplicated YAML only after guardians and effective snapshots pass.

## 11. Verification Checklist

- [ ] Owner module publishes `<module-id>.tables.yaml` and frontend contract index when it owns UI/API/table contracts
- [ ] Assembly registry declares only owned tables/projections plus `registry_dependencies`
- [ ] `database/database.manifest.json` module order matches dependency order
- [ ] Effective snapshots are generated, not edited
- [ ] Guardians pass with dependency import rather than duplication
- [ ] Application tools delegate to `sdkwork-web-framework` composer
