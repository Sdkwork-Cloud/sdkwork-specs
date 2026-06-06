# Standards Governance

- Version: 1.0
- Scope: spec ownership, changes, exceptions, compatibility, migration
- Related: `SDKWORK_WORKSPACE_SPEC.md`, all specs

This document defines how SDKWork standards evolve without fragmenting across applications.

## 1. Authority

The root `specs/` directory is authoritative.

Rules:

- Local app standards may extend root standards, but must not contradict them.
- Repository/application `.sdkwork/` skills and plugins may automate or explain standards, but they
  must not become competing standards. They follow `SDKWORK_WORKSPACE_SPEC.md`.
- If two specs conflict, the more specific root spec wins for its domain.
- If root specs conflict, the conflict must be fixed before implementation continues.

## 2. Change Types

| Change type | Examples | Requirement |
| --- | --- | --- |
| Clarification | Better wording, examples | Review and update affected docs |
| Additive | New optional extension, new recommended module | Tests if executable behavior changes |
| Breaking | Rename operationId, change token header, change required DB field | Migration plan and explicit approval |
| Exception | Temporary legacy deviation | Exception record with owner and expiry |

## 3. Exception Record

Every exception must include:

```yaml
id: EX-2026-0001
spec: API_SPEC.md
rule: operationId dotted resource style
owner: team-name
reason: legacy generated SDK migration
risk: inconsistent SDK surface
expires_at: 2026-06-30
removal_plan: regenerate app SDK with sdkwork-v3 profile
```

## 4. Compatibility Rules

- API compatibility follows `API_SPEC.md`.
- Database compatibility follows `DATABASE_SPEC.md`.
- SDK compatibility follows `SDK_SPEC.md`.
- Domain naming and ownership follows `DOMAIN_SPEC.md`.
- Reusable module compatibility follows `MODULE_SPEC.md`.
- App manifest compatibility follows `APP_MANIFEST_SPEC.md`.
- Repository/application workspace compatibility follows `SDKWORK_WORKSPACE_SPEC.md`.
- UI architecture compatibility follows `UI_ARCHITECTURE_SPEC.md`, `APP_PC_ARCHITECTURE_SPEC.md`, `APP_PC_REACT_UI_SPEC.md`, `APP_MOBILE_REACT_UI_SPEC.md`, `APP_FLUTTER_UI_SPEC.md`, and `BACKEND_UI_SPEC.md`.
- Security rules cannot be weakened by local exception without explicit owner approval and compensating control.

UI architecture boundary exceptions are breaking architecture exceptions. They must include a migration plan back to the correct package family and SDK surface. In particular, new PC application packages may not omit the `pc` segment; PC user console modules may not be named as admin modules; PC internal admin modules may not be named as user console or app modules; backend/admin UI may not use a single catch-all backend package as an exception unless the record names every affected domain package that will receive the split before expiry.

## 5. Review Checklist

- [ ] Correct spec files were consulted.
- [ ] Repository/application `.sdkwork/` skills or plugins do not contradict root standards.
- [ ] Changes do not create conflicting standards.
- [ ] Any exception is documented with owner and expiry.
- [ ] Tooling or tests were updated when a standard becomes executable.
- [ ] AGENTS.md references still point to root `specs/`.
