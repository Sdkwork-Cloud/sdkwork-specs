# Database Lifecycle Template

Purpose: canonical PostgreSQL authoritative-server starter layout for SDKWork application database lifecycle assets.

Owner: `sdkwork-specs` maintainers.

Related:

- `DATABASE_FRAMEWORK_SPEC.md`
- `DATABASE_SPEC.md`
- `../sdkwork-database/specs/DATABASE_FRAMEWORK_STANDARD.md` (when present)

Usage:

1. Copy this directory to an application root as `database/`.
2. Replace `moduleId`, `serviceCode`, and `tablePrefix`.
3. Keep `databaseRole: "authoritative-server"`, `engines: ["postgres"]`, and `defaultEngine: "postgres"`.
4. Author the PostgreSQL `contract/schema.yaml`, then add the first PostgreSQL `.up.sql` migration required by the default `migrations-only` strategy.
5. Use `templates/database-client-local/` in the owning client/native module only when a separate SQLite client-local requirement exists.
6. Register `DefaultDatabaseModule` or a custom SPI module at service bootstrap.

Verification:

```bash
pnpm run db:validate
pnpm run db:drift:check
```
