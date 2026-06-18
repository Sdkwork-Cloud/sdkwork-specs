# SDKWork RPC And gRPC Standard

- Version: 1.0
- Baseline: gRPC over HTTP/2, Protocol Buffers proto3, SDKWork v3 operation semantics
- Scope: cross-language RPC contracts, Rust services, Java/Rust parity services, generated RPC clients, service-to-service calls, internal deployment APIs, local desktop host RPC
- Related: `API_SPEC.md`, `DATABASE_SPEC.md`, `DRIVE_SPEC.md`, `MEDIA_RESOURCE_SPEC.md`, `SDK_SPEC.md`, `RPC_SDK_WORKSPACE_SPEC.md`, `DOMAIN_SPEC.md`, `IAM_SPEC.md`, `SECURITY_SPEC.md`, `OBSERVABILITY_SPEC.md`, `TEST_SPEC.md`, `RUST_RPC_SPEC.md`
- Canonical location: `specs/RPC_SPEC.md`

This document defines the language-neutral RPC standard for SDKWork. It adds a gRPC/protobuf contract layer for direct use by Rust, Java, Go, Python, TypeScript, Dart, C#, and other language runtimes without replacing the existing HTTP/OpenAPI app API and backend API standards.

The standard architecture is dual-protocol: HTTP/OpenAPI and gRPC/protobuf are peer adapters over the same domain runtime, service, command/query, port, idempotency, transaction, storage, security, and observability contracts. A new RPC implementation MUST NOT create a second business implementation or bypass existing service/runtime abstractions.

## 1. Normative Language

The words `MUST`, `MUST NOT`, `SHOULD`, `SHOULD NOT`, and `MAY` use RFC-style meaning.

| Term | Meaning |
| --- | --- |
| `MUST` | Required. A contract that violates this rule is not SDKWork-standard. |
| `MUST NOT` | Forbidden. Do not bypass this with local convention. |
| `SHOULD` | Strong recommendation. Deviation requires a documented reason. |
| `SHOULD NOT` | Strong negative recommendation. Deviation requires a documented reason. |
| `MAY` | Optional capability decided by product, compliance, deployment, or compatibility needs. |

## 2. Standard Levels

| Level | Name | Minimum bar |
| --- | --- | --- |
| L0 | Legacy Bridge | Existing local interfaces have a migration map to canonical RPC contracts. |
| L1 | Portable Core | proto3 files compile, generated clients work in at least Rust and one non-Rust language, unary methods expose stable request/response messages. |
| L2 | Service Ready | Metadata auth, deadlines, standard errors, health checks, reflection in non-production or approved private environments, contract tests, idempotency for writes. |
| L3 | Enterprise Grade | mTLS, least-privilege authorization, audit, OpenTelemetry traces/metrics, breaking-change gates, generated multi-language SDK release manifest, formal deprecation windows. |

New IAM, commerce, payment, billing, membership, wallet, admin, and storage-control RPC surfaces `MUST` target L2. Security-sensitive, money-moving, operator-facing, and cross-service production RPC surfaces `SHOULD` target L3.

## 3. Source Of Truth

The `.proto` contract is the source of truth for RPC. Rust structs, Java classes, TypeScript interfaces, SQL models, HTTP routes, generated code, and README examples are implementation details unless they match the proto contract.

Required artifacts:

| Artifact | Requirement |
| --- | --- |
| Proto package | `syntax = "proto3";`, canonical package name, explicit imports, stable messages, stable service methods, stable field numbers. |
| RPC manifest | Domain, surface, package, service, method, operationId mapping, auth level, idempotency requirement, streaming mode, owner, compatibility level. |
| Generated clients | Generated from proto, never hand-edited, versioned with proto source and generator version. |
| Contract tests | Proto lint, breaking-change check, Rust server/client smoke test, at least one non-Rust generation check for public RPC packages. |
| Changelog | Breaking, additive, deprecated, and removed services/methods/messages/fields. |
| Exception register | Any non-standard metadata, field type, package name, auth model, or streaming behavior. |

Rules:

- RPC contracts `MUST` be reviewed as public or semi-public API contracts, not as private Rust implementation details.
- Existing HTTP operationIds `MUST` remain the semantic bridge between HTTP/OpenAPI and gRPC/protobuf for shared appbase operations.
- A gRPC method `MUST` map to exactly one SDKWork operation id unless it is a documented composition method. Composition methods must list all child operationIds.
- A service implementation `MUST` call the same runtime/service/port boundary used by HTTP or Tauri adapters.
- RPC adapters `MUST NOT` call SQLx repositories, database pools, HTTP routers, or Tauri commands directly.

## 3.1 RPC SDK Generation Boundary

RPC SDK package layout, RPC SDK family naming, proto generation workspace, language output placement, SDKWork RPC generation manifests, and `sdkgen --protocol rpc` verification are governed by `RPC_SDK_WORKSPACE_SPEC.md`.

Rules:

- RPC SDKs `MUST` be generated from proto contracts and the SDKWork RPC manifest.
- RPC SDK generation `MUST NOT` hand-edit generated protobuf output.
- RPC SDK generation is additive to existing OpenAPI HTTP SDK generation. Existing `sdkgen generate` commands without an explicit RPC protocol remain HTTP/OpenAPI generation.
- Missing RPC client capability `MUST` be fixed by updating proto contracts and the RPC manifest, then regenerating.

## 4. Protocol Profile

SDKWork standard RPC uses:

| Concern | Standard |
| --- | --- |
| Transport | gRPC over HTTP/2. |
| IDL | Protocol Buffers proto3. |
| Default method kind | Unary request/response. |
| Streaming | Allowed only when the domain explicitly needs events, logs, progress, realtime state, or large incremental transfer. |
| Browser usage | gRPC-Web is optional and must be explicitly enabled per app. Normal frontend UI continues to use generated HTTP SDKs unless a product explicitly selects gRPC-Web. |
| Gateway | JSON/HTTP gateway MAY be generated for internal compatibility, but it MUST NOT replace `API_SPEC.md` OpenAPI source-of-truth for HTTP app/backend APIs. |
| Health | Use standard gRPC health checking. |
| Reflection | SHOULD be enabled only in standalone development and controlled internal operations. It MUST be disabled or access-controlled in public production. |

Rules:

- Unary methods are the default because they map cleanly to existing SDKWork operationIds, idempotency, transactions, and generated client surfaces.
- Client streaming and bidirectional streaming require a documented backpressure, cancellation, auth, audit, and retry policy.
- Long-running commands SHOULD return an operation/job resource or use server streaming for progress; they MUST NOT hold a transaction open while waiting on external providers.
- Every client call SHOULD set a deadline. Server implementations MUST observe cancellation.

## 5. Surfaces

SDKWork RPC has the same app/backend separation as HTTP plus an internal-only surface for host and service operations.

| Surface | Proto package segment | Audience | Auth |
| --- | --- | --- | --- |
| App RPC | `app.v3` | Product clients, desktop/mobile hosts, standalone/cloud app clients | App auth/session token model. |
| Backend RPC | `backend.v3` | Admin consoles, operator tooling, backend SDKs | Backend/operator token or service identity. |
| Internal RPC | `internal.v1` or `internal.v3` | Service-to-service, local host, migration/runtime orchestration | mTLS or explicit standalone/internal trust boundary. |
| Common RPC | `common.v1` | Shared messages only, no business service ownership | No direct app endpoint. |

Rules:

- Login, register, refresh, logout, OAuth session, password reset, current user, QR auth, and verification-code RPC methods `MUST` live in app RPC only. Verification-code RPCs are messaging-owned and must align with the messaging app API operationIds.
- Backend RPC `MUST NOT` expose auth/session login methods.
- Internal RPC `MUST NOT` be reachable from public app clients.
- App and backend RPC packages MUST preserve the same semantic separation as `/app/v3/api` and `/backend/v3/api`.

## 6. Package Naming

Proto package names use this grammar:

```text
sdkwork.<domain>.<surface>.v<major>
sdkwork.<domain>.internal.v<major>
sdkwork.common.v<major>
```

Examples:

```proto
package sdkwork.iam.app.v3;
package sdkwork.iam.backend.v3;
package sdkwork.commerce.app.v3;
package sdkwork.commerce.backend.v3;
package sdkwork.foundation.internal.v1;
package sdkwork.common.v1;
```

File paths mirror package names:

```text
proto/sdkwork/common/v1/context.proto
proto/sdkwork/iam/app/v3/session_service.proto
proto/sdkwork/iam/backend/v3/user_admin_service.proto
proto/sdkwork/commerce/app/v3/checkout_service.proto
proto/sdkwork/commerce/backend/v3/payment_admin_service.proto
```

Rules:

- Package names `MUST` be lowercase dot-separated segments.
- Proto file names `MUST` be lowercase snake_case.
- Domain segment `MUST` come from `DOMAIN_SPEC.md`.
- Version segment `v3` aligns with SDKWork app/backend API v3. Common/internal packages MAY use `v1` when they do not expose product API version semantics.
- A package `MUST NOT` mix app and backend services.
- Generated language package options must be explicit, for example `go_package`, `java_package`, `csharp_namespace`, and Rust module layout through the Rust build.

## 7. Service Naming

Services use PascalCase and end with `Service`.

| Service type | Pattern | Example |
| --- | --- | --- |
| App business service | `<Resource>Service` | `CheckoutService`, `WalletService` |
| App auth/current service | `<Capability>Service` | `SessionService`, `CurrentUserService` |
| Backend admin service | `<Resource>AdminService` | `UserAdminService`, `PaymentAdminService` |
| Internal runtime service | `<Capability>RuntimeService` or `<Capability>ControlService` | `RuntimeManifestService`, `MigrationControlService` |
| Query-only service | `<Resource>QueryService` | `CatalogQueryService` |

Rules:

- Service names SHOULD match bounded context and operational ownership.
- A service should contain cohesive methods over one aggregate, workflow, or admin surface.
- A service MUST NOT become a catch-all such as `CommerceService` when bounded context services are clearer.
- Backend admin services MUST include `AdminService` unless the service is explicitly read-only reporting or audit.

## 8. Method Naming And OperationIds

RPC method names use PascalCase verbs and stable nouns. They map to SDKWork dotted operationIds.

| operationId action | RPC method verb |
| --- | --- |
| `create` | `Create<Resource>` |
| `retrieve` | `Retrieve<Resource>` |
| `list` | `List<ResourcePlural>` |
| `update` | `Update<Resource>` |
| `delete` | `Delete<Resource>` |
| `refresh` | `Refresh<Resource>` |
| `revoke` | `Revoke<Resource>` |
| `cancel` | `Cancel<Resource>` |
| `close` | `Close<Resource>` |
| `submit` | `Submit<Resource>` |
| `verify` | `Verify<Resource>` |
| `grant` | `Grant<Resource>` |
| `release` | `Release<Resource>` |
| `adjust` | `Adjust<Resource>` |
| `publish` | `Publish<Resource>` |
| `archive` | `Archive<Resource>` |
| `replay` | `Replay<Resource>` |

Example:

```proto
service CheckoutService {
  rpc CreateCheckoutSession(CreateCheckoutSessionRequest)
      returns (CreateCheckoutSessionResponse);

  rpc RetrieveCheckoutSession(RetrieveCheckoutSessionRequest)
      returns (RetrieveCheckoutSessionResponse);

  rpc CreateCheckoutSessionQuote(CreateCheckoutSessionQuoteRequest)
      returns (CreateCheckoutSessionQuoteResponse);

  rpc CreateCheckoutSessionOrder(CreateCheckoutSessionOrderRequest)
      returns (CreateCheckoutSessionOrderResponse);
}
```

Operation mapping:

| RPC method | operationId |
| --- | --- |
| `CreateCheckoutSession` | `checkout.sessions.create` |
| `RetrieveCheckoutSession` | `checkout.sessions.retrieve` |
| `CreateCheckoutSessionQuote` | `checkout.sessions.quotes.create` |
| `CreateCheckoutSessionOrder` | `checkout.sessions.orders.create` |

Rules:

- Every RPC method `MUST` have an `operationId` mapping in the RPC manifest.
- Method names `MUST` avoid HTTP vocabulary such as `Post`, `Get`, `Patch`, or `Endpoint`.
- Method names `MUST NOT` include path parameter names unless the parameter disambiguates a nested resource.
- Method names SHOULD stay stable even if HTTP paths change.

## 9. Message Naming

Every RPC method uses a dedicated request and response message:

```proto
rpc CreateOrder(CreateOrderRequest) returns (CreateOrderResponse);
```

Rules:

- Request messages `MUST` end with `Request`.
- Response messages `MUST` end with `Response`.
- Shared entity messages MAY be reused across methods only when they are stable domain views, not accidental transport DTOs.
- Field names use `snake_case`.
- Request messages SHOULD contain business input fields only; auth, tenant, request id, trace id, idempotency key, deadline, and caller context belong in metadata unless the business model needs them as data.
- Response messages SHOULD include the direct resource/result field and optional common metadata, not a generic `body_json` field for public RPC.
- Internal adapter-level methods MAY use `body_json` only for compatibility with an existing runtime dispatch contract and must be hidden behind typed public service methods.

## 10. Type Mapping

| SDKWork logical type | Proto type | Notes |
| --- | --- | --- |
| external id, uuid, business_no | `string` | Preferred for cross-language public contracts. |
| internal int64 id | `int64` or `string` | Public/gateway-safe APIs SHOULD use `string`; trusted internal RPC MAY use `int64`. |
| decimal/money amount | `string` or `sdkwork.common.v1.Decimal` | Do not use floating point for money. |
| currency | `string` | ISO code or configured token symbol. |
| timestamp/instant | `google.protobuf.Timestamp` | Boundary adapters may render ISO 8601 UTC for JSON. |
| date | `google.type.Date` or `string` | Use `string` if the language/tooling set does not standardize `google.type.Date`. |
| boolean | `bool` | Avoid tri-state bool; use enum or optional wrapper when needed. |
| enum | `enum` | Must include `*_UNSPECIFIED = 0`. |
| JSON extension | `google.protobuf.Struct` | Avoid for core fields. |
| binary | `bytes` | Use Drive upload sessions, Drive download grants, Drive-owned streaming, or storage references for large files. Use `sdkwork.common.v1.MediaResource` for persisted or shareable media references. |
| repeated list | `repeated T` | Use pagination for unbounded lists. |

Rules:

- Money, decimal, and token amounts `MUST NOT` use `float` or `double`.
- Enums `MUST` reserve zero for unspecified/unknown and use uppercase snake case values.
- Removed fields `MUST` be marked `reserved` by number and name.
- Field numbers `1` to `15` SHOULD be used for high-frequency fields.
- Field numbers `19000` to `19999` are reserved for SDKWork internal extensions and must not be used by business schemas.

## 11. Common Messages

Common messages live under `sdkwork.common.v1` and are imported by business packages.

Required common files:

```text
proto/sdkwork/common/v1/context.proto
proto/sdkwork/common/v1/error.proto
proto/sdkwork/common/v1/pagination.proto
proto/sdkwork/common/v1/money.proto
proto/sdkwork/common/v1/media.proto
proto/sdkwork/common/v1/audit.proto
proto/sdkwork/common/v1/idempotency.proto
proto/sdkwork/common/v1/runtime.proto
```

Standard common message set:

| Message | Purpose |
| --- | --- |
| `AppContext` | Tenant, organization, user, session, app, environment, deployment profile, runtime target, surface profile. |
| `CallerContext` | Actor/service identity and auth level for backend/internal calls. |
| `PageRequest` | Page size, cursor, sort, filters for list methods. |
| `PageResponse` | Next cursor, total count policy, list metadata. |
| `Money` | Decimal amount string and currency. |
| `Decimal` | Decimal string with precision/scale metadata when required. |
| `MediaResource` | Stable image, video, audio, voice, document, archive, object-storage, provider-asset, or generated-media reference. |
| `MediaAccess` | Visibility and expiry semantics for media delivery. |
| `MediaAiProvenance` | Provider, model, task, moderation, and provenance metadata for generated or edited media. |
| `DriveReference` | Optional common reference for Drive-backed files when a service needs space/node identity in addition to `MediaResource`. |
| `RequestMetadata` | Request id, trace id, idempotency key, request hash, client version. |
| `ResponseMetadata` | Request id, trace id, server time, warnings, deprecation notices. |
| `SdkworkError` | Code, message, retryability, trace id, field violations, resource identity. |
| `FieldViolation` | Validation target, description, rule. |
| `RuntimeCapability` | Runtime capability name, version, enabled flag. |
| `RpcServiceManifest` | Service, method, operationId, auth, owner, version, compatibility. |

Public methods SHOULD use metadata headers for request metadata and include `ResponseMetadata` only when clients need stable response-side details.

Media rules:

- RPC fields that represent images, videos, audio, voice, documents, archives, generated media, product media, upload results, or object-storage backed files `MUST` use `sdkwork.common.v1.MediaResource` or `repeated sdkwork.common.v1.MediaResource` in SDKWork-owned business services.
- SDKWork-owned file upload, download, provider, object lifecycle, and storage-control RPC belongs to Drive services governed by `DRIVE_SPEC.md`. Business RPC services attach Drive references or `MediaResource`; they must not define parallel upload-session or object-store protocols.
- Field names should describe the business role, for example `avatar`, `cover`, `thumbnail`, `poster`, `video`, `audio`, `file`, `document`, `asset`, `main_image`, `gallery_image`, `detail_image`, or `sku_image`. Do not append `media` when the message type already declares `MediaResource`.
- Provider adapter services MAY expose provider-native `url`, `uri`, `image_url`, `audio_url`, or `video_url` fields, but domain services must normalize provider media to `MediaResource`.
- Large file transfer should use Drive upload sessions, Drive download grants, Drive references, or explicit Drive-owned streaming. Do not send large product videos, generated media, or document files as unary `bytes`.

## 12. Metadata

SDKWork RPC metadata keys use lowercase ASCII. The following metadata keys are standard:

| Metadata key | Required when | Meaning |
| --- | --- | --- |
| `authorization` | Authenticated calls | `Bearer <auth_token>`. |
| `access-token` | SDKWork app/backend token calls | Canonical SDKWork access token. |
| `x-request-id` | All non-trivial calls | Caller or gateway request id. |
| `traceparent` | Distributed tracing | W3C trace context. |
| `idempotency-key` | Write commands | Retry-safe write identity. |
| `x-request-hash` | Idempotent writes | Stable hash of canonical request payload. |
| `x-sdkwork-client-version` | Generated client calls | SDK package/client version. |

Rules:

- Application clients authenticate with `authorization` and `access-token`; they MUST NOT send raw tenant/user context metadata.
- Backend/internal callers that require tenant context MUST use service tokens, API key lookup, or an internal typed context object, not caller-supplied tenant metadata.
- Metadata keys `MUST` be validated before request body handling.
- Servers MUST reject any context metadata that attempts to override token-derived or server-resolved context.

## 13. Auth And Authorization

Rules:

- App RPC uses the same dual-token model as SDKWork HTTP SDKs.
- Backend RPC uses backend/operator identity, service identity, or a documented internal token model.
- Internal RPC SHOULD use mTLS for service identity in production and private deployments.
- Method authorization MUST be enforced at the service/runtime boundary, not only in client SDKs.
- Login/session methods MUST NOT be exposed on backend RPC.
- Reflection and health endpoints MUST have environment-specific access control. Health may expose serving status broadly in private deployments; reflection should be restricted.

## 14. Error Mapping

RPC errors use gRPC status codes plus SDKWork error detail metadata/messages.

| SDKWork error kind | gRPC status |
| --- | --- |
| `validation` | `INVALID_ARGUMENT` |
| `unauthenticated` | `UNAUTHENTICATED` |
| `unauthorized` | `PERMISSION_DENIED` |
| `not_found` | `NOT_FOUND` |
| `conflict` | `ALREADY_EXISTS` or `ABORTED` depending on domain semantics. |
| `invalid_state` | `FAILED_PRECONDITION` |
| `unsupported_capability` | `UNIMPLEMENTED` or `FAILED_PRECONDITION`. |
| `rate_limited` | `RESOURCE_EXHAUSTED` |
| `deadline` | `DEADLINE_EXCEEDED` |
| `canceled` | `CANCELLED` |
| `provider_unavailable` | `UNAVAILABLE` |
| `storage` | `INTERNAL` unless a user-correctable precondition is known. |
| `unknown` | `UNKNOWN` only when no better classification exists. |

Rules:

- Public clients MUST NOT depend on raw server exception strings.
- Validation errors SHOULD include field violations.
- Retryable errors MUST declare retryability through SDKWork error detail or response metadata.
- Internal logs may include storage/provider details; client errors must be safe for the caller audience.

## 15. Idempotency, Retry, Deadline, And Cancellation

Rules:

- Create/update/submit/pay/refund/recharge/grant/revoke/adjust/replay/fulfill commands `MUST` declare idempotency policy.
- Idempotent write methods `MUST` require `idempotency-key` unless the method is naturally idempotent and documented.
- Clients SHOULD use bounded retries only for retryable status codes and only when the method idempotency policy allows it.
- Servers MUST observe deadlines and cancellation.
- Server implementations MUST NOT keep database transactions open across network calls to third-party providers.

## 16. Streaming

Allowed streaming patterns:

| Pattern | Method kind | Examples |
| --- | --- | --- |
| Progress updates | Server streaming | Migration progress, report generation, long-running import. |
| Audit/log tailing | Server streaming | Operator audit event stream. |
| Realtime state | Server or bidirectional streaming | Chat, collaborative editing, device state. |
| Batch upload | Client streaming | Large import when Drive upload sessions or Drive object storage are not appropriate, or when Drive owns the streaming method. |

Rules:

- Streaming methods require an explicit cancellation, heartbeat, backpressure, auth refresh, and audit policy.
- Bidirectional streaming is not allowed for normal CRUD-style operations.
- Streaming response messages MUST include sequence id or cursor when clients may resume.

## 17. Contract Versioning

Rules:

- Additive fields and methods are allowed when field numbers are unique and generated clients stay compatible.
- Removing or renaming services, methods, messages, fields, enum values, or packages is breaking.
- Changing field type, label, meaning, required behavior, or auth policy is breaking.
- Deleted field numbers and names MUST be reserved.
- A new major package version is required for intentional breaking changes, for example `sdkwork.commerce.app.v4`.
- Deprecation windows MUST be recorded in the RPC manifest and changelog.

## 18. SDK Generation

Generated RPC clients MUST be reproducible from:

- proto source version
- generation tool version
- language target
- package name
- module namespace
- feature flags
- runtime dependency versions

Standard target packages:

| Language | Package naming pattern |
| --- | --- |
| Rust generated proto | `sdkwork_<domain>_rpc_proto` |
| Rust typed client facade | `sdkwork_<domain>_rpc_client` or inside `sdkwork_<domain>_rpc` |
| TypeScript | `@sdkwork/<sdk-family-stem>-rpc-sdk` |
| Java/Kotlin | `com.sdkwork.<domain>.rpc` |
| Go | `github.com/sdkwork/<domain>-rpc-go` or repo-approved module |
| Python | `sdkwork_<domain>_rpc` |
| Dart/Flutter | `sdkwork_<domain>_rpc` |
| C# | `Sdkwork.<Domain>.Rpc` |

Rules:

- Generated output MUST NOT be hand-edited.
- Missing client capability MUST be fixed by updating proto and regenerating.
- SDK README examples MUST show metadata/auth setup and at least one unary call.
- Generated clients SHOULD expose deadlines, cancellation, metadata injection, and typed errors.
- The SDK family stem MUST match sibling HTTP SDK families for the same capability line. For example,
  `sdkwork-im-sdk`, `sdkwork-im-app-sdk`, and `sdkwork-im-backend-sdk` imply
  `sdkwork-im-rpc-sdk`, even when proto packages use `sdkwork.communication.*`.

## 19. Standard Proto Repository Layout

Recommended shared contract layout:

```text
packages/common/rpc/sdkwork-rpc-contracts/
  proto/sdkwork/common/v1/*.proto
  proto/sdkwork/foundation/internal/v1/*.proto
  buf.yaml
  buf.gen.yaml
  README.md

packages/common/iam/sdkwork-iam-rpc-contracts/
  proto/sdkwork/iam/app/v3/*.proto
  proto/sdkwork/iam/backend/v3/*.proto
  buf.yaml
  buf.gen.yaml
  README.md

packages/common/commerce/sdkwork-commerce-rpc-contracts/
  proto/sdkwork/commerce/app/v3/*.proto
  proto/sdkwork/commerce/backend/v3/*.proto
  buf.yaml
  buf.gen.yaml
  README.md
```

Rules:

- Cross-domain common messages belong in `sdkwork-rpc-contracts`.
- Business-domain proto contracts belong in their owning domain contract package.
- Generated language outputs MAY live in `sdks/` or language-specific package folders, but the proto source stays canonical.

## 20. Standard Service Catalog

This catalog defines the first SDKWork RPC service split. The method lists are the target standard surface; implementation may phase them in, but new RPC design should follow this catalog instead of inventing new service names.

### 20.1 Common And Runtime Services

| Package | Service | Surface | Methods |
| --- | --- | --- | --- |
| `sdkwork.common.v1` | shared messages only | common | No business RPC service. |
| `sdkwork.foundation.internal.v1` | `RuntimeManifestService` | internal | `RetrieveRuntimeManifest`, `ListRuntimeCapabilities`, `ListRpcServices`, `RetrieveRpcServiceManifest`. |
| `sdkwork.foundation.internal.v1` | `MigrationControlService` | internal/backend | `PreflightMigrations`, `ListMigrationPlans`, `ApplyMigrationPlan`, `RetrieveMigrationStatus`, `WatchMigrationProgress`. |
| `sdkwork.foundation.internal.v1` | `StorageContractService` | internal/backend | `ListTableContracts`, `RetrieveTableContract`, `ValidateStorageContract`. |
| `grpc.health.v1` | `Health` | common/internal | `Check`, `Watch`. |
| `grpc.reflection.v1alpha` or approved version | `ServerReflection` | dev/private | Standard reflection methods. |

### 20.2 IAM App RPC Services

Package: `sdkwork.iam.app.v3`

| Service | Methods | operationIds |
| --- | --- | --- |
| `SessionService` | `CreateSession`, `RetrieveCurrentSession`, `UpdateCurrentSession`, `DeleteCurrentSession`, `RefreshSession` | `sessions.create`, `sessions.current.retrieve`, `sessions.current.update`, `sessions.current.delete`, `sessions.refresh` |
| `VerificationService` | `CreateVerificationCode`, `VerifyVerificationCode` | `messaging.verificationCodes.create`, `messaging.verificationCodes.verify` |
| `PasswordRecoveryService` | `CreatePasswordResetRequest`, `CreatePasswordReset` | `passwordResetRequests.create`, `passwordResets.create` |
| `RegistrationService` | `CreateRegistration` | `registrations.create` |
| `OAuthSessionService` | `CreateOAuthAuthorizationUrl`, `CreateOAuthSession` | `oauth.authorizationUrls.create`, `oauth.sessions.create` |
| `QrAuthService` | `CreateQrAuthSession`, `RetrieveQrAuthSession`, `CreateQrAuthSessionScan`, `CreateQrAuthSessionPassword` | `qrAuth.sessions.create`, `qrAuth.sessions.retrieve`, `qrAuth.sessions.scans.create`, `qrAuth.sessions.passwords.create` |
| `CurrentUserService` | `RetrieveCurrentUser` | `users.current.retrieve` |

### 20.3 IAM Backend RPC Services

Package: `sdkwork.iam.backend.v3`

| Service | Methods | operationIds |
| --- | --- | --- |
| `TenantAdminService` | `CreateTenant`, `ListTenants`, `RetrieveTenant`, `UpdateTenant`, `DeleteTenant`, `CreateTenantMember`, `ListTenantMembers`, `UpdateTenantMember`, `DeleteTenantMember` | `tenants.create`, `tenants.list`, `tenants.retrieve`, `tenants.update`, `tenants.delete`, `tenants.members.create`, `tenants.members.list`, `tenants.members.update`, `tenants.members.delete` |
| `OrganizationAdminService` | `CreateOrganization`, `ListOrganizations`, `RetrieveOrganizationTree`, `RetrieveOrganization`, `UpdateOrganization`, `DeleteOrganization`, `CreateOrganizationMember`, `ListOrganizationMembers`, `UpdateOrganizationMember`, `DeleteOrganizationMember` | `organizations.create`, `organizations.list`, `organizations.tree.retrieve`, `organizations.retrieve`, `organizations.update`, `organizations.delete`, `organizations.members.create`, `organizations.members.list`, `organizations.members.update`, `organizations.members.delete` |
| `UserAdminService` | `CreateUser`, `ListUsers`, `RetrieveUser`, `UpdateUser`, `DeleteUser`, `ListUserRoles`, `CreateUserRole`, `DeleteUserRole` | `users.create`, `users.list`, `users.retrieve`, `users.update`, `users.delete`, `users.roles.list`, `users.roles.create`, `users.roles.delete` |
| `RoleAdminService` | `CreateRole`, `ListRoles`, `RetrieveRole`, `UpdateRole`, `DeleteRole`, `ListRolePermissions`, `CreateRolePermission`, `DeleteRolePermission` | `roles.create`, `roles.list`, `roles.retrieve`, `roles.update`, `roles.delete`, `roles.permissions.list`, `roles.permissions.create`, `roles.permissions.delete` |
| `PermissionAdminService` | `CreatePermission`, `ListPermissions`, `RetrievePermission`, `UpdatePermission`, `DeletePermission` | `permissions.create`, `permissions.list`, `permissions.retrieve`, `permissions.update`, `permissions.delete` |
| `PolicyAdminService` | `CreatePolicy`, `ListPolicies`, `RetrievePolicy`, `UpdatePolicy`, `DeletePolicy` | `policies.create`, `policies.list`, `policies.retrieve`, `policies.update`, `policies.delete` |
| `ApiKeyAdminService` | `ListApiKeys`, `RevokeApiKey` | `apiKeys.list`, `apiKeys.revoke` |
| `IamAuditService` | `ListSecurityEvents`, `ListAuditEvents` | `securityEvents.list`, `auditEvents.list` |

### 20.4 Commerce App RPC Services

Package: `sdkwork.commerce.app.v3`

| Service | Methods | operationIds |
| --- | --- | --- |
| `AccountService` | `RetrieveCurrentAccountSummary` | `accounts.current.summary.retrieve` |
| `AddressService` | `ListAddresses`, `CreateAddress`, `UpdateAddress`, `DeleteAddress`, `CreateDefaultAddressSelection` | `addresses.list`, `addresses.create`, `addresses.update`, `addresses.delete`, `addresses.defaultSelection.create` |
| `CartService` | `RetrieveCurrentCart`, `CreateCartItem`, `UpdateCartItem`, `DeleteCartItem` | `cart.current.retrieve`, `cart.items.create`, `cart.items.update`, `cart.items.delete` |
| `CatalogQueryService` | `ListCatalogCategories`, `RetrieveCatalogCategory`, `ListCatalogAttributes`, `ListCatalogProducts`, `RetrieveCatalogProduct`, `RetrieveCatalogSku`, `RetrieveCatalogSkuPrices`, `ListCatalogSpus`, `RetrieveCatalogSpu` | `catalog.categories.list`, `catalog.categories.retrieve`, `catalog.attributes.list`, `catalog.products.list`, `catalog.products.retrieve`, `catalog.skus.retrieve`, `catalog.skus.prices.retrieve`, `catalog.spus.list`, `catalog.spus.retrieve` |
| `CheckoutService` | `CreateCheckoutSession`, `RetrieveCheckoutSession`, `CreateCheckoutSessionQuote`, `CreateCheckoutSessionOrder` | `checkout.sessions.create`, `checkout.sessions.retrieve`, `checkout.sessions.quotes.create`, `checkout.sessions.orders.create` |
| `CouponService` | `ListCoupons`, `CreateCouponClaim`, `CreateCouponRedemption` | `coupons.list`, `coupons.claims.create`, `coupons.redemptions.create` |
| `OrderService` | `ListOrders`, `RetrieveOrder`, `CreateOrder`, `PayOrder`, `CancelOrder`, `RetrieveOrderStatistics`, `RetrieveOrderStatus`, `RetrieveOrderPaymentSuccess`, `ListOrderEvents`, `CreateOrderCancellation` | `orders.list`, `orders.retrieve`, `orders.create`, `orders.pay`, `orders.cancel`, `orders.statistics.retrieve`, `orders.status.retrieve`, `orders.paymentSuccess.retrieve`, `orders.events.list`, `orders.cancellations.create` |
| `PaymentService` | `ListPaymentMethods`, `CreatePaymentIntent`, `CreatePayment`, `ClosePayment`, `ListPaymentRecords`, `RetrievePaymentRecord`, `RetrievePaymentStatistics`, `RetrievePaymentIntent`, `CreatePaymentIntentAttempt`, `RetrievePaymentAttempt` | `payments.methods.list`, `payments.intents.create`, `payments.create`, `payments.close`, `payments.records.list`, `payments.records.retrieve`, `payments.statistics.retrieve`, `payments.intents.retrieve`, `payments.intents.attempts.create`, `payments.attempts.retrieve` |
| `RefundService` | `ListRefunds`, `CreateRefund`, `RetrieveRefund` | `refunds.list`, `refunds.create`, `refunds.retrieve` |
| `FulfillmentService` | `ListFulfillments`, `RetrieveFulfillment` | `fulfillments.list`, `fulfillments.retrieve` |
| `ShipmentService` | `RetrieveShipment` | `shipments.retrieve` |
| `RechargeService` | `ListRechargePackages`, `CreateRechargeOrder`, `RetrieveRechargeOrder`, `ListRechargeOrders`, `CancelRechargeOrder` | `recharges.packages.list`, `recharges.orders.create`, `recharges.orders.retrieve`, `recharges.orders.list`, `recharges.orders.cancel` |
| `WalletService` | `RetrieveWalletOverview`, `ListWalletAccounts`, `RetrieveWalletAccount`, `ListWalletLedgerEntries`, `RetrieveWalletLedgerEntry`, `ListWalletTransactions`, `RetrieveWalletTransaction`, `RetrieveWalletTokens`, `RetrieveWalletExchangeRate`, `ListWalletPointExchangeRules` | `wallet.overview.retrieve`, `wallet.accounts.list`, `wallet.accounts.retrieve`, `wallet.ledgerEntries.list`, `wallet.ledgerEntries.retrieve`, `wallet.transactions.list`, `wallet.transactions.retrieve`, `wallet.tokens.retrieve`, `wallet.exchangeRate.retrieve`, `wallet.points.exchangeRules.list` |
| `MembershipService` | `RetrieveCurrentMembership`, `ListMembershipPlans`, `ListMembershipBenefits`, `RetrieveCurrentMembershipStatus`, `ListMembershipPackageGroups`, `RetrieveMembershipPackageGroup`, `ListMembershipPackageGroupPackages`, `ListMembershipPackages`, `RetrieveMembershipPackage`, `CreateMembershipPurchase`, `RenewMembershipPurchase`, `UpgradeMembershipPurchase`, `RetrieveMembershipPointsBalance`, `ListMembershipPointsHistory`, `CreateMembershipDailyReward`, `RetrieveMembershipDailyRewardStatus`, `RetrieveMembershipPrivilegeUsage`, `CreateMembershipPrivilegeSpeedUp` | `memberships.current.retrieve`, `memberships.plans.list`, `memberships.benefits.list`, `memberships.current.status.retrieve`, `memberships.packageGroups.list`, `memberships.packageGroups.retrieve`, `memberships.packageGroups.packages.list`, `memberships.packages.list`, `memberships.packages.retrieve`, `memberships.purchases.create`, `memberships.purchases.renew`, `memberships.purchases.upgrade`, `memberships.points.balance.retrieve`, `memberships.points.history.list`, `memberships.points.dailyRewards.create`, `memberships.points.dailyRewards.status.retrieve`, `memberships.privileges.usage.retrieve`, `memberships.privileges.speedUps.create` |
| `InvoiceService` | `ListInvoices`, `RetrieveInvoice`, `CreateInvoice`, `UpdateInvoice`, `SubmitInvoice`, `CancelInvoice`, `ListInvoiceItems`, `ListMyInvoices`, `ListInvoiceTitles`, `RetrieveInvoiceStatistics` | `invoices.list`, `invoices.retrieve`, `invoices.create`, `invoices.update`, `invoices.submit`, `invoices.cancel`, `invoices.items.list`, `invoices.mine.list`, `invoices.titles.list`, `invoices.statistics.retrieve` |

### 20.5 Commerce Backend RPC Services

Package: `sdkwork.commerce.backend.v3`

| Service | Methods | operationIds |
| --- | --- | --- |
| `CatalogAdminService` | `ListManagedCatalogCategories`, `CreateCatalogCategory`, `UpdateCatalogCategory`, `DeleteCatalogCategory`, `ListCatalogProducts`, `CreateCatalogProduct`, `UpdateCatalogProduct`, `ListManagedCatalogSpus`, `CreateCatalogSpu`, `UpdateCatalogSpu`, `PublishCatalogSpu`, `ArchiveCatalogSpu`, `ListCatalogSkus`, `CreateCatalogSku`, `UpdateCatalogSku`, `ListManagedCatalogAttributes`, `CreateCatalogAttribute`, `ListCatalogPriceLists`, `CreateCatalogPriceList`, `UpdateCatalogPriceList` | `catalog.categories.management.list`, `catalog.categories.create`, `catalog.categories.update`, `catalog.categories.delete`, `catalog.products.list`, `catalog.products.create`, `catalog.products.update`, `catalog.spus.management.list`, `catalog.spus.create`, `catalog.spus.update`, `catalog.spus.publish`, `catalog.spus.archive`, `catalog.skus.list`, `catalog.skus.create`, `catalog.skus.update`, `catalog.attributes.management.list`, `catalog.attributes.create`, `catalog.priceLists.list`, `catalog.priceLists.create`, `catalog.priceLists.update` |
| `InventoryAdminService` | `ListInventoryStocks`, `AdjustInventoryStock`, `ListInventoryReservations`, `ReleaseInventoryReservation`, `ListInventoryLedger`, `ListInventoryLedgerEntries` | `inventory.stocks.list`, `inventory.stocks.adjust`, `inventory.reservations.list`, `inventory.reservations.release`, `inventory.ledger.list`, `inventory.ledgerEntries.list` |
| `OrderAdminService` | `ListOrders`, `ListManagedOrders`, `RetrieveManagedOrder`, `CancelManagedOrder`, `CloseManagedOrder`, `ListOrderEvents` | `orders.list`, `orders.management.list`, `orders.management.retrieve`, `orders.management.cancel`, `orders.management.close`, `orders.events.list` |
| `PaymentAdminService` | `ListPaymentProviderAccounts`, `CreatePaymentProviderAccount`, `UpdatePaymentProviderAccount`, `ListManagedPaymentMethods`, `CreatePaymentMethod`, `ListPaymentChannels`, `CreatePaymentChannel`, `ListPaymentRouteRules`, `CreatePaymentRouteRule`, `UpdatePaymentRouteRule`, `DeletePaymentRouteRule`, `ListPaymentIntents`, `ListPaymentAttempts`, `ListPaymentWebhookEvents`, `ListPaymentWebhooks`, `RetrievePaymentWebhook`, `ReplayPaymentWebhook`, `ListPaymentReconciliationRuns`, `CreatePaymentReconciliationRun` | `payments.providerAccounts.list`, `payments.providerAccounts.create`, `payments.providerAccounts.update`, `payments.methods.management.list`, `payments.methods.create`, `payments.channels.list`, `payments.channels.create`, `payments.routeRules.list`, `payments.routeRules.create`, `payments.routeRules.update`, `payments.routeRules.delete`, `payments.intents.list`, `payments.attempts.list`, `payments.webhookEvents.list`, `payments.webhooks.list`, `payments.webhooks.retrieve`, `payments.webhooks.replay`, `payments.reconciliationRuns.list`, `payments.reconciliationRuns.create` |
| `RefundAdminService` | `ListRefunds`, `ListManagedRefunds`, `RetrieveManagedRefund`, `RetrieveRefund`, `CreateRefundApproval`, `ListRefundAttempts`, `CreateRefundAttempt` | `refunds.list`, `refunds.management.list`, `refunds.management.retrieve`, `refunds.retrieve`, `refunds.approvals.create`, `refunds.attempts.list`, `refunds.attempts.create` |
| `FulfillmentAdminService` | `ListManagedFulfillments`, `CreateFulfillment`, `RetrieveManagedFulfillment`, `CreateFulfillmentShipment`, `UpdateFulfillmentShipment`, `CreateFulfillmentTrackingEvent`, `ListShipments` | `fulfillments.management.list`, `fulfillments.create`, `fulfillments.management.retrieve`, `fulfillments.shipments.create`, `fulfillments.shipments.update`, `fulfillments.trackingEvents.create`, `shipments.list` |
| `MembershipAdminService` | `ListManagedMembershipPlans`, `CreateMembershipPlan`, `UpdateMembershipPlan`, `DeleteMembershipPlan`, `ListMembershipPackages`, `CreateMembershipPackage`, `UpdateMembershipPackage`, `DeleteMembershipPackage`, `ListMembershipPackageGroups`, `CreateMembershipPackageGroup`, `UpdateMembershipPackageGroup`, `DeleteMembershipPackageGroup`, `ListMembershipMembers`, `UpdateMembershipMember`, `ListManagedMembershipEntitlements`, `GrantMembershipEntitlement`, `RevokeMembershipEntitlement` | `memberships.plans.management.list`, `memberships.plans.create`, `memberships.plans.update`, `memberships.plans.delete`, `memberships.packages.list`, `memberships.packages.create`, `memberships.packages.update`, `memberships.packages.delete`, `memberships.packageGroups.list`, `memberships.packageGroups.create`, `memberships.packageGroups.update`, `memberships.packageGroups.delete`, `memberships.members.list`, `memberships.members.update`, `memberships.entitlements.management.list`, `memberships.entitlements.grant`, `memberships.entitlements.revoke` |
| `RechargeAdminService` | `ListManagedRechargePackages`, `CreateRechargePackage`, `UpdateRechargePackage`, `ListManagedRechargeOrders` | `recharges.packages.management.list`, `recharges.packages.create`, `recharges.packages.update`, `recharges.orders.management.list` |
| `WalletAdminService` | `ListManagedWalletAccounts`, `CreateWalletAdjustment`, `ListWalletLedger`, `ListWalletLedgerEntries`, `ListWalletExchangeRules` | `wallet.accounts.management.list`, `wallet.adjustments.create`, `wallet.ledger.list`, `wallet.ledgerEntries.list`, `wallet.exchangeRules.list` |
| `CouponAdminService` | `ListManagedCouponTemplates`, `CreateCouponTemplate`, `UpdateCouponTemplate`, `ListCouponCodes`, `CreateCouponCode`, `ListCouponRedemptions` | `coupons.templates.management.list`, `coupons.templates.create`, `coupons.templates.update`, `coupons.codes.list`, `coupons.codes.create`, `coupons.redemptions.list` |
| `InvoiceAdminService` | `ListManagedInvoices`, `RetrieveManagedInvoice`, `ListInvoiceTitles`, `CreateInvoiceIssuance`, `CreateInvoiceVoid` | `invoices.management.list`, `invoices.management.retrieve`, `invoices.titles.list`, `invoices.issuance.create`, `invoices.voids.create` |
| `CommerceAuditService` | `ListAuditLogs`, `ListCommerceEvents` | `audit.logs.list`, `audit.commerceEvents.list` |
| `CommerceReportService` | `ListUsageStatements`, `RetrievePaymentReconciliation`, `ListOrderRevenue`, `ListRefundReports`, `RetrieveCommerceOverview`, `ListSalesReports`, `ListPaymentReconciliationReports` | `commerceReports.usageStatements.list`, `commerceReports.paymentReconciliation.retrieve`, `commerceReports.orderRevenue.list`, `commerceReports.refunds.list`, `reports.commerceOverview.retrieve`, `reports.sales.list`, `reports.paymentReconciliation.list` |

## 21. Proto Example

```proto
syntax = "proto3";

package sdkwork.commerce.app.v3;

import "sdkwork/common/v1/money.proto";
import "sdkwork/common/v1/pagination.proto";
import "sdkwork/common/v1/runtime.proto";
import "google/protobuf/timestamp.proto";

option java_package = "com.sdkwork.commerce.app.v3";
option java_multiple_files = true;
option go_package = "github.com/sdkwork/commerce-rpc-go/sdkwork/commerce/app/v3;commerceappv3";

service WalletService {
  rpc RetrieveWalletOverview(RetrieveWalletOverviewRequest)
      returns (RetrieveWalletOverviewResponse);

  rpc ListWalletTransactions(ListWalletTransactionsRequest)
      returns (ListWalletTransactionsResponse);
}

message RetrieveWalletOverviewRequest {}

message RetrieveWalletOverviewResponse {
  WalletOverview overview = 1;
  sdkwork.common.v1.ResponseMetadata metadata = 15;
}

message ListWalletTransactionsRequest {
  sdkwork.common.v1.PageRequest page = 1;
  string wallet_account_id = 2;
}

message ListWalletTransactionsResponse {
  repeated WalletTransaction transactions = 1;
  sdkwork.common.v1.PageResponse page = 2;
  sdkwork.common.v1.ResponseMetadata metadata = 15;
}

message WalletOverview {
  string account_id = 1;
  sdkwork.common.v1.Money cash_balance = 2;
  string points_balance = 3;
  google.protobuf.Timestamp updated_at = 4;
}

message WalletTransaction {
  string transaction_id = 1;
  string transaction_type = 2;
  sdkwork.common.v1.Money amount = 3;
  string status = 4;
  google.protobuf.Timestamp created_at = 5;
}
```

## 22. Verification

Every RPC contract change `MUST` verify:

- [ ] Proto files compile.
- [ ] Proto lint passes.
- [ ] Breaking-change check passes against the previous released proto set.
- [ ] RPC manifest contains every service/method/operationId mapping.
- [ ] Generated Rust code compiles.
- [ ] At least one non-Rust generated client compiles for public RPC packages.
- [ ] Unary server/client smoke tests pass.
- [ ] Auth metadata, deadlines, cancellation, idempotency, and error mapping are tested.
- [ ] Health check and reflection behavior match environment policy.
- [ ] HTTP/OpenAPI operationId parity is preserved for shared operations.

## 23. External Baselines

- gRPC core concepts: https://grpc.io/docs/what-is-grpc/core-concepts/
- gRPC status codes: https://grpc.io/docs/guides/status-codes/
- gRPC health checking: https://grpc.io/docs/guides/health-checking/
- gRPC server reflection: https://grpc.io/docs/guides/reflection/
- Protocol Buffers best practices: https://protobuf.dev/best-practices/dos-donts/
- Protocol Buffers style guide: https://protobuf.dev/programming-guides/style/
- Buf lint and breaking-change workflow: https://buf.build/docs/lint/overview/
