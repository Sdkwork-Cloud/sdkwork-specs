# Client-Local SQLite Database Template

Purpose: canonical starter layout for an SDKWork native/client module that owns embedded SQLite data.

This template is separate from `templates/database/`. It does not implement or emulate an authoritative server database.

Usage:

1. Copy this directory to the owning client/native module as `database/`.
2. Replace `moduleId`, `serviceCode`, owner, and the client-local policy placeholders.
3. Choose `cache`, `offline-projection`, or `local-only` mode.
4. Add the first SQLite `.up.sql` migration required by the default `migrations-only` strategy.
5. Add a versioned sync contract before enabling offline mutation.
6. Validate the module with the client-local database contract tests from `TEST_SPEC.md`.

Related:

- `DATABASE_SPEC.md` sections 3.1, 3.2, 8.3, and 33.4
- `DATABASE_FRAMEWORK_SPEC.md` sections 5.2, 6, 7, and 13
- `MIGRATION_SPEC.md` section 4.5
