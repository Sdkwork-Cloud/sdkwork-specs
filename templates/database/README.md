# Database Lifecycle Template

Purpose: canonical starter layout for SDKWork application database lifecycle assets.

Owner: `sdkwork-specs` maintainers.

Related:

- `DATABASE_FRAMEWORK_SPEC.md`
- `DATABASE_SPEC.md`
- `../sdkwork-database/specs/DATABASE_FRAMEWORK_STANDARD.md` (when present)

Usage:

1. Copy this directory to an application root as `database/`.
2. Replace `moduleId`, `serviceCode`, and `tablePrefix`.
3. Author `contract/schema.yaml` before migrations.
4. Register `DefaultDatabaseModule` or a custom SPI module at service bootstrap.

Verification:

```bash
pnpm run db:validate
pnpm run db:drift:check
```
