# OpenAPI Shared Components

Canonical HTTP request/response schemas and governance extensions for SDKWork API authorities.

Copy or `$ref` these components into `apis/` and `sdks/*/openapi/` authorities per `API_SPEC.md` section 4.5 and sections 14–16.

## Schemas

| File | Schema |
| --- | --- |
| `schemas/sdkwork-api-response.yaml` | `SdkWorkApiResponse` (`code: 0`), `SdkWorkResourceData`, `SdkWorkPageData`, `SdkWorkCommandData`, `SdkWorkAsyncData` |
| `schemas/sdkwork-result-code.yaml` | `SdkWorkSuccessCode`, `SdkWorkPlatformErrorCode`, `SdkWorkDomainErrorCode`, `SdkWorkIntegrationErrorCode` |
| `schemas/sdkwork-list-query.yaml` | `SdkWorkListQuery`, `SdkWorkListQueryWithFilters` |
| `schemas/page-info.yaml` | `PageInfo` |
| `schemas/problem-detail.yaml` | `ProblemDetail` (numeric error `code`) |
| `schemas/field-error.yaml` | `FieldError` |

## Parameters

| File | Parameter |
| --- | --- |
| `parameters/query-parameters.yaml` | `PageQuery`, `PageSizeQuery`, `CursorQuery`, `SortQuery`, `SearchQuery`, time-range queries, `IdsQuery` |

## Wire Protocol Extensions

SDKWork-owned business operations on `app-api`, `backend-api`, and business `open-api` use the standard input/output contract from section 4.5.1. Vendor compatibility `open-api` operations that mirror upstream tool or provider wire use operation extensions instead of the shared envelope schemas:

```yaml
paths:
  /v1/chat/completions:
    post:
      x-sdkwork-api-surface: open-api
      x-sdkwork-wire-protocol: external
      x-sdkwork-external-protocol-id: openai-v1
```

Rules:

- Business operations omit `x-sdkwork-wire-protocol` or declare `x-sdkwork-wire-protocol: sdkwork-v3`.
- Vendor compatibility operations `MUST` declare both `x-sdkwork-wire-protocol: external` and `x-sdkwork-external-protocol-id`.
- Vendor compatibility operations `MUST NOT` mix `SdkWorkApiResponse` with upstream wire on the same operation.

## Contract Matrix

Operation input/output patterns are defined in `API_SPEC.md` section 4.5, section 14.1, section 15.4, and section 16.

Verification:

```bash
node tools/check-api-response-envelope.mjs --root <repo-root>
node tools/check-api-response-envelope.mjs --workspace <sdkwork-space-root>
```
