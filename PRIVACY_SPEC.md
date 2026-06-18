# Privacy And Data Protection Standard

- Version: 1.0
- Scope: personal data, tenant data, data classification, consent, retention, export, deletion, residency
- Related: `SECURITY_SPEC.md`, `DATABASE_SPEC.md`, `DRIVE_SPEC.md`, `API_SPEC.md`, `EVENT_SPEC.md`, `OBSERVABILITY_SPEC.md`

This standard defines privacy and data protection requirements for SDKWork standalone/cloud deployments, customer-owned environments, and local runtime targets. It is not a legal policy; it is an engineering contract that makes privacy behavior explicit and testable.

## 1. Data Classification

Standard classes:

| Class | Meaning | Examples |
| --- | --- | --- |
| `public` | Safe to expose publicly | published marketplace listing |
| `internal` | Internal operational data | non-sensitive config |
| `tenant` | Tenant-owned business data | documents, projects, messages |
| `personal` | Identifies or relates to a person | email, phone, profile, device |
| `sensitive` | High-risk personal/security data | credentials, tokens, payment, private keys |
| `regulated` | Legal or contractual controls apply | financial, health, government data |

Rules:

- L2/L3 tables, API schemas, events, logs, and exports `SHOULD` declare data classification.
- Sensitive and regulated data `MUST` define storage, masking, logging, export, and deletion rules.
- Personal data fields `SHOULD` have a purpose and retention policy.

## 2. Collection And Consent

Rules:

- APIs `MUST` collect only fields required for the declared capability.
- Optional personal data `SHOULD` have an explicit product purpose.
- Consent-dependent features `MUST` record consent source, version, time, and withdrawal path.
- Children, payments, regulated industries, and cross-border data flows require product/legal review before L3 rollout.

## 3. Data Minimization In APIs And SDKs

Rules:

- Responses `MUST NOT` return password hashes, token secrets, private keys, verification codes, or provider refresh tokens.
- Current-user/session APIs `SHOULD` return only the fields needed by frontend bootstrap.
- List APIs `SHOULD` use summary DTOs and expose detail DTOs through retrieve endpoints.
- Generated SDK models must not make write-only sensitive fields readable.

## 4. Logs, Events, And Observability

Rules:

- Logs, traces, metrics, audit events, and security events `MUST NOT` include raw secrets or full sensitive payloads.
- Tenant/user IDs may be logged only when allowed by classification and deployment policy.
- Events carrying personal or sensitive data `MUST` have retention and consumer controls.
- Debug logging for sensitive flows must be disabled in production.

## 5. Retention, Export, And Deletion

Rules:

- Tenant and personal data `SHOULD` have retention rules.
- Drive-backed files, thumbnails, generated assets, object metadata, search indexes, previews, and download grants must be included in retention, export, deletion, and residency plans.
- User export/delete workflows `SHOULD` be defined for foundation IAM and profile data.
- Soft deletion must not be the only privacy deletion mechanism when hard deletion/anonymization is required.
- Backups, events, logs, caches, search indexes, and derived read models must be considered in deletion plans.

## 6. Residency And Deployment Mode

Rules:

- Standalone/cloud deployments and customer-owned environments `MUST`
  document where tenant data is stored and processed.
- Cross-region or cross-border synchronization `MUST` be explicit.
- Standalone/customer-owned runtime targets `SHOULD` avoid sending tenant data
  to SDKWork-hosted cloud services unless the user/operator opts in.
- Telemetry from standalone/customer-owned runtime targets must be configurable
  and privacy-safe.

## 7. Acceptance Checklist

- [ ] Data classes are documented for new L2/L3 schemas and APIs.
- [ ] Sensitive fields are write-only or redacted where appropriate.
- [ ] Logs/events do not expose secrets or full sensitive payloads.
- [ ] Retention/export/delete behavior is defined.
- [ ] Drive-backed files and derived media artifacts are covered by retention/export/delete/residency rules.
- [ ] Standalone/cloud and customer-owned data residency behavior is explicit.
