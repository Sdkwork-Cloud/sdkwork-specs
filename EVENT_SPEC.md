# Event And Async API Standard

- Version: 1.0
- Scope: domain events, outbox, webhooks, message queues, event streams, async contracts
- Related: `DATABASE_SPEC.md`, `DRIVE_SPEC.md`, `API_SPEC.md`, `OBSERVABILITY_SPEC.md`, `TEST_SPEC.md`

Events are contracts. They must be versioned and governed like HTTP APIs.

## 1. Event Contract Baseline

Rules:

- Event schemas `SHOULD` be described with AsyncAPI when event channels are public, cross-service, or SDK-relevant.
- Event envelopes `SHOULD` align with CloudEvents concepts where practical.
- Event payload schemas `MUST` be versioned and backward compatible unless a breaking event version is introduced.
- Events `MUST` include tenant context when tenant-owned data is involved.
- Drive file/storage lifecycle events use the `drive.` prefix and must expose Drive resource identity, not provider bucket/object keys or signed URLs.

## 2. Standard Envelope

```json
{
  "id": "evt_01",
  "type": "iam.user.created",
  "source": "iam-service",
  "specversion": "1.0",
  "time": "2026-05-11T00:00:00Z",
  "tenantId": "100001",
  "organizationId": "0",
  "subject": "user_01",
  "data": {}
}
```

Rules:

- `type` `MUST` be a stable dotted event type.
- `id` `MUST` be globally unique enough for deduplication.
- `time` `MUST` be ISO 8601 UTC.
- `data` `MUST` be schema-defined.
- Sensitive data `MUST NOT` be published unless explicitly required and protected.

## 3. Outbox And Delivery

Rules:

- Cross-service business events `SHOULD` use an outbox pattern or equivalent transactional publication.
- Consumers `MUST` be idempotent.
- Retry, dead-letter, and replay policies `MUST` be documented.
- Event ordering guarantees, if any, `MUST` be explicit.

## 4. Webhooks

Rules:

- Webhooks `MUST` be signed.
- Webhook delivery `MUST` include event ID, timestamp, signature, and retry metadata.
- Webhook schemas `MUST` reuse event schemas where possible.
- Webhook endpoints `SHOULD` support replay protection.

## 5. Acceptance Checklist

- [ ] Event type is stable and dotted.
- [ ] Event schema is versioned.
- [ ] Tenant context is included where required.
- [ ] Consumers are idempotent.
- [ ] Retry and dead-letter policy is documented.
- [ ] Sensitive fields are reviewed.
- [ ] Drive events expose `driveUri`/space/node identity and do not leak provider object keys, signed URLs, or credentials.
