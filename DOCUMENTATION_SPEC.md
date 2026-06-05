# Documentation Standard

- Version: 1.0
- Scope: module README, API examples, architecture decisions, runbooks, changelogs, spec references
- Related: all specs

This standard defines the documentation required for reusable SDKWork capabilities. Documentation must make a module installable and operable by another application without reading its internals.

## 1. Documentation Source Rules

Rules:

- Root `specs/` is the source of truth for standards.
- App-local docs may extend root standards, but must link back to the relevant root spec.
- API examples `MUST` match the OpenAPI contract and generated SDK method shape.
- Database docs `MUST` match migrations/entities/schema contracts.
- Generated documentation `MUST` identify the generator and source contract.

## 2. Required Module README

Every reusable module `MUST` have a README with:

- Capability and domain.
- Package type and architecture support.
- Public exports.
- Required SDK client surface.
- Initialization/configuration example.
- SaaS/private/local deployment notes.
- Security and tenant assumptions.
- Extension points.
- Verification command.
- Owner and status.

Template:

```md
# <module-name>

Domain: iam
Capability: sessions
Package type: service
Status: standard

## Public API
## Required SDK Surface
## Configuration
## SaaS/Private/Local Behavior
## Security
## Extension Points
## Verification
```

## 3. API Documentation

Rules:

- API docs `MUST` be generated from or checked against OpenAPI.
- SDK examples `MUST` use resource-style calls such as `client.auth.sessions.create(body)`.
- Error examples `MUST` use `application/problem+json`.
- Auth examples `MUST` show both `Authorization: Bearer <auth_token>` and `Access-Token: <access_token>` for protected APIs.
- Backend API docs `MUST NOT` show login/session creation endpoints.

## 4. Architecture Decisions

Reusable foundation changes `SHOULD` record decisions when they affect:

- domain boundary or naming.
- API path, operationId, or schema shape.
- database table prefix or ownership.
- security model.
- SDK generator behavior.
- Java/Rust parity.
- deployment mode switching.

Decision records should include context, decision, alternatives, consequences, and verification.

## 5. Runbooks

L3 foundation domains `MUST` have operational runbooks for:

- token/key rotation.
- tenant isolation incident response.
- migration rollback.
- provider outage when integrations are involved.
- rate-limit/quota incidents.
- audit log investigation.

Runbooks `SHOULD` include signals, dashboards, commands, rollback steps, and escalation owner.

## 6. Changelog

Rules:

- API, SDK, database, and module contract changes `MUST` be recorded.
- Breaking changes `MUST` include migration instructions or explicit no-compatibility approval.
- SDK generator version and OpenAPI version `SHOULD` be recorded for SDK releases.
- Spec changes `SHOULD` reference affected validation tooling.

## 7. Acceptance Checklist

- [ ] Root specs are linked from local docs.
- [ ] Module README includes public API, SDK surface, config, security, and verification.
- [ ] API examples match OpenAPI and generated SDK.
- [ ] Operationally critical modules include runbooks.
- [ ] Contract changes have changelog entries.
