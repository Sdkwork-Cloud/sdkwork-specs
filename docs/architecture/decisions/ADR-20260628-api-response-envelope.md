# ADR: SdkWork HTTP Input And Output Wire Contract

- Status: Accepted
- Date: 2026-06-28
- Supersedes: interim `SdkWorkResponse` + `requestId` draft and string wire `code` tokens in the same ADR series
- Scope: `app-api`, `backend-api`, SDKWork-owned business `open-api`
- Authority: `API_SPEC.md` section 4.5 and sections 14–16, `SDK_SPEC.md` section 4.2

## Context

SDKWork HTTP APIs used multiple incompatible success-body shapes and mixed `requestId` / `traceId` correlation fields. Errors were sometimes returned as HTTP 2xx with legacy `success` flags. Early drafts also used string wire codes such as `ok` and `validation_error`.

Open-api had been described mainly as a security and prefix surface. Business open-api operations did not have an explicit input/output parity rule with app-api, which allowed envelope drift on external integration APIs.

## Decision

Adopt one SDKWork business wire contract for `app-api`, `backend-api`, and SDKWork-owned business `open-api`:

- **Input:** section 14 request bodies and section 14.1 list/search/command input, including `SdkWorkListQuery` and `q`.
- **Success output:** numeric `SdkWorkApiResponse` with `code: 0`, typed `data`, and server-owned `traceId`.
- **Error output:** HTTP 4xx/5xx `ProblemDetail` with numeric non-zero `code` and `traceId`.

Example success body:

```json
{
  "code": 0,
  "data": { "...typed payload..." },
  "traceId": "<server-uuid>"
}
```

Rules:

- Success `code` is numeric `int32` and `MUST` be `0` on HTTP 2xx JSON bodies. REST semantics remain on HTTP status (`201`, `202`, etc.).
- Error `code` is numeric non-zero on `ProblemDetail` with HTTP 4xx/5xx only. Platform codes follow `HTTP_status * 100 + sequence` (`40001`, `40101`, `40401`, …).
- Correlation uses `traceId` everywhere. Wire field `requestId` is removed.
- Response header `X-SdkWork-Trace-Id` echoes `traceId`.
- Vendor compatibility `open-api` routes that mirror upstream tool or provider wire (for example OpenAI `/v1/*`, Claude Code, Codex) `MAY` opt out only when every exempt operation declares `x-sdkwork-wire-protocol: external` and `x-sdkwork-external-protocol-id` per section 4.5.2.

SDK generation (`--standard-profile sdkwork-v3`) unwraps `data` by default, exposes typed numeric `ProblemDetail.code` / `traceId`, and requires frontend/backend service updates in the same migration window.

## Consequences

- OpenAPI authorities, framework serializers, SDK generator output, and `AGENTS.md` guidance must align on section 4.5 and sections 14–16.
- Legacy envelopes, string wire codes, and `requestId` are forbidden for L2+ business work.
- Workspace verification uses `tools/check-api-response-envelope.mjs`, which scans business `open-api` authorities and skips fully marked vendor compatibility authorities.

## Alternatives Rejected

- **Bare DTO responses:** no unified correlation, SDK unwrap, or result-code channel.
- **Legacy Plus/Appbase envelopes:** duplicate success/error channels and encourage HTTP 200 business failures.
- **Keeping `requestId`:** duplicates observability vocabulary already used by frontend specs and tracing systems.
- **String wire codes (`ok`, `validation_error`):** weaker SDK typing, inconsistent i18n keys, and divergence from errno-style industry practice.
- **Different open-api business wire from app-api:** creates duplicate SDK parsers, breaks external integrator expectations, and hides contract drift behind surface naming.
