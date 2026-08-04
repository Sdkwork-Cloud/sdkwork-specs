# Technical Debt: App SDK Consumer Imports

Status: **closed** (2026-07-04)

Authority: `SDK_PACKAGE_NAMING_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md` section 9, `SDK_SPEC.md` package naming table, `AGENTS_SPEC.md` section 2.

## Standard (required)

Application consumers import scoped composed facades only:

```typescript
import { createClient, type SdkworkAppClient } from '@sdkwork/iam-app-sdk';
import type { SdkworkBackendClient } from '@sdkwork/iam-backend-sdk'; // backend-admin only
import { createClient as createCloudRouterDomainsClient } from '@sdkwork/cloudrouter-app-sdk/domains';
```

Generator transport names (`sdkwork-*-generated-typescript`, retired `cloudrouter-*-domain-transport-generated-typescript`) are build artifacts under `sdks/**/generated/**` and must not appear in `apps/` or `packages/` imports, Vite aliases, tsconfig paths, or `package.json` dependency keys.

Composed SDK facades (`sdks/**/**-typescript/src/**`) may re-export only from `../generated/**` or `../../generated/domains/**` within the same SDK family root.

Verification (permanent):

```bash
node sdkwork-specs/tools/check-sdk-standard.mjs --workspace .
node sdkwork-specs/tools/check-app-sdk-consumer-imports.mjs --workspace .
```

## Retired packages

| Retired consumer import | Replacement |
| --- | --- |
| `@sdkwork/commerce-app-sdk` | `@sdkwork/cloudrouter-app-sdk/domains` |
| `@sdkwork/commerce-backend-sdk` | `@sdkwork/cloudrouter-backend-sdk/domains` |
| `@sdkwork/cloudrouter-app-domain-transport-sdk` | `@sdkwork/cloudrouter-app-sdk/domains` |
| `@sdkwork/cloudrouter-backend-domain-transport-sdk` | `@sdkwork/cloudrouter-backend-sdk/domains` |
| `sdkwork-commerce-app-sdk-generated-typescript` | `@sdkwork/cloudrouter-app-sdk/domains` |
| `sdkwork-commerce-backend-sdk-generated-typescript` | `@sdkwork/cloudrouter-backend-sdk/domains` |
| `cloudrouter-*-domain-transport-typescript` sibling SDK family roots | `cloudrouter-*-sdk-typescript/generated/domains/server-openapi` |

## Completed migration

- Workspace consumer imports rewritten to scoped `@sdkwork/*-app-sdk`, `@sdkwork/*-backend-sdk`, and `@sdkwork/cloudrouter-*-sdk/domains`.
- Cloud Router domain transport relocated from standalone `*-domain-transport-typescript` trees into `cloudrouter-*-sdk-typescript/generated/domains/server-openapi/`.
- Composed `./domains` subpath exports on `@sdkwork/cloudrouter-app-sdk` and `@sdkwork/cloudrouter-backend-sdk`.
- **139** `AGENTS.md` files updated with mandatory `## App SDK Consumer Imports` (IAM canonical examples).
- Permanent check: `check-app-sdk-consumer-imports.mjs`.
- Retired one-time migration scripts: `align-app-sdk-consumer-imports.mjs`, `align-agents-app-sdk-consumer-import-standard.mjs`.

## Remaining generator-metadata debt (non-blocking)

| Area | Debt | Notes |
| --- | --- | --- |
| Legacy duplicate `*-typescript` roots under one SDK family | Retired `sdkwork-agent-*-typescript` duplicates in `sdkwork-agents` | Check fails with `legacy-duplicate-typescript-root` until removed |
| OpenAPI `x-sdkwork-sdk-family` on domain transport authorities | Still records historical `cloudrouter-*-domain-transport` stem | Update on next SDK regeneration pass |
| Family-root `sdk-manifest.json` discovery | Multi-surface generation | Family metadata lives in one manifest and generation scripts discover manifests directly |
| Mall repository | Physical `sdkwork-mall/sdks/sdkwork-commerce-*` generator families | Ownership artifacts; guarded by `check-commerce-debt.mjs` |

## Agent rule

Do not add new imports of `sdkwork-*-generated-typescript`, `@sdkwork/commerce-*`, or `@sdkwork/cloudrouter-*-domain-transport-sdk` in application code. Use IAM as the reference pattern and run `check-app-sdk-consumer-imports.mjs` before claiming SDK integration work is complete.
