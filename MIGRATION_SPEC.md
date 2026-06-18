# Migration Standard

- Version: 1.0
- Scope: API migration, database migration, SDK migration, config migration, package migration, route migration, compatibility windows, rollback
- Related: `REQUIREMENTS_SPEC.md`, `ARCHITECTURE_DECISION_SPEC.md`, `QUALITY_GATE_SPEC.md`, `RELEASE_SPEC.md`, `GOVERNANCE_SPEC.md`, `API_SPEC.md`, `WEB_FRAMEWORK_SPEC.md`, `RPC_SPEC.md`, `RPC_SDK_WORKSPACE_SPEC.md`, `SDK_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md`, `DATABASE_SPEC.md`, `CONFIG_SPEC.md`, `ENVIRONMENT_SPEC.md`, `APPLICATION_SPEC.md`, `COMPONENT_SPEC.md`, `TEST_SPEC.md`, `DOCUMENTATION_SPEC.md`

This standard defines how SDKWork changes existing contracts without breaking consumers unexpectedly.

## 1. Migration Authority

Rules:

- API compatibility follows `API_SPEC.md`.
- RPC compatibility follows `RPC_SPEC.md`.
- SDK compatibility follows `SDK_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md`, and `RPC_SDK_WORKSPACE_SPEC.md` when RPC SDKs are touched.
- Database compatibility follows `DATABASE_SPEC.md`.
- Runtime config compatibility follows `CONFIG_SPEC.md` and `ENVIRONMENT_SPEC.md`.
- Package/component ownership follows `APPLICATION_SPEC.md`, `MODULE_SPEC.md`, and `COMPONENT_SPEC.md`.
- Breaking migrations require `GOVERNANCE_SPEC.md` approval.

## 2. Migration Plan

Required for non-trivial migration:

```yaml
id: MIG-2026-0001
owner: team-or-person
status: proposed | active | blocked | completed | rolled-back
requirement: REQ-2026-0001
type: api | rpc | sdk | database | config | package | route | release | mixed
scope:
  producers:
    - package-or-service
  consumers:
    - app-or-sdk-or-service
compatibility_window:
  starts_at: YYYY-MM-DD
  ends_at: YYYY-MM-DD
strategy: expand-contract | parallel-run | dual-write | adapter | cutover | no-compatibility-approved
rollback:
  supported: true
  steps:
    - concrete rollback step
verification:
  - command or checklist
```

Rules:

- The plan must name producers and consumers.
- Compatibility windows must have dates or release versions.
- No-compatibility migrations require explicit governance approval.
- Migration plans must not rely on hidden local conventions.

## 3. Strategies

| Strategy | Use |
| --- | --- |
| expand-contract | add new field/table/API/SDK surface while old surface remains valid |
| parallel-run | old and new paths run side by side until evidence supports cutover |
| dual-write | writes populate old and new storage/contracts during transition |
| adapter | compatibility wrapper maps old consumers to new implementation |
| cutover | move consumers after readiness checks |
| no-compatibility-approved | explicitly approved break with clear release communication |

Rules:

- Prefer expand-contract for API, SDK, and database changes.
- Contracting old fields, operations, tables, package names, route ids, or config keys happens only after consumers are migrated and evidence exists.
- Dual-write requires idempotency, reconciliation, and rollback behavior.
- Adapters must have removal dates.

## 4. Contract Migration

Rules:

- Deprecated API/RPC operations must be marked by the owning contract and documented for generated SDKs.
- RPC SDK migrations MUST name proto package, service, method, message, field, generated language package versions, affected consumers, compatibility window, and rollback or forward-fix plan.
- SDK aliases or compatibility facades must be marked deprecated and tied to removal criteria.
- Generated SDK output must not be edited by hand to create compatibility.
- Route ids and i18n keys should remain stable across client migrations unless a route migration plan exists.
- Public naming migrations require `NAMING_SPEC.md` and governance review.

### 4.1 HTTP Framework Migration

Rules:

- Repositories migrating from `sdkwork-platform-http-context-service` or other appbase-local HTTP context frameworks to `sdkwork-web-framework` must follow `WEB_FRAMEWORK_SPEC.md` and the framework migration guide at `../sdkwork-web-framework/docs/10-migration-from-appbase.md`.
- During migration, `AppRequestContext` may remain as a type alias for `WebRequestContext`, but new handlers, OpenAPI extensions, and documentation must use `WebRequestContext`.
- Migration plans must name affected route crates, API servers, appbase adapters, and verification commands before removing legacy HTTP context crates.

## 5. Data Migration

Rules:

- Database migrations must be forward-safe for the supported deployment profile
  and runtime target.
- Backfills must be idempotent and resumable.
- Tenant isolation, indexing, query shape, and audit requirements must be tested when data moves.
- Destructive data migrations require explicit owner approval, backup/restore evidence, and rollback or forward-fix plan.

## 6. Config And Release Migration

Rules:

- Config migrations must keep lifecycle environment, deployment profile, build
  mode, and runtime target separated.
- Old env/config keys must have compatibility aliases only when documented with removal dates.
- Release plans must describe when old and new contracts are accepted.
- Rollback must explain whether config, SDK, database, and artifacts roll back together or separately.

## 7. Acceptance Checklist

- [ ] Producers, consumers, strategy, compatibility window, and owner are named.
- [ ] Related specs and contracts are cited.
- [ ] Deprecated surfaces have removal criteria.
- [ ] Tests cover old path, new path, and cutover when applicable.
- [ ] Rollback or forward-fix plan is explicit.
- [ ] Release notes and documentation explain user/operator impact.
