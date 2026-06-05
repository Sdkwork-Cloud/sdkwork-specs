# SDKWork Drive Standard

- Version: 1.0
- Scope: SDKWork Drive, file storage, object storage providers, spaces, nodes, upload sessions, download grants, storage metadata, file/media lifecycle, Drive-backed `MediaResource` mapping, frontend upload services, generated Drive SDKs, database references, RPC storage-control contracts
- Related: `DOMAIN_SPEC.md`, `API_SPEC.md`, `RPC_SPEC.md`, `RUST_RPC_SPEC.md`, `DATABASE_SPEC.md`, `MEDIA_RESOURCE_SPEC.md`, `SDK_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md`, `FRONTEND_SPEC.md`, `SECURITY_SPEC.md`, `PRIVACY_SPEC.md`, `CONFIG_SPEC.md`, `DEPLOYMENT_SPEC.md`, `OBSERVABILITY_SPEC.md`, `EVENT_SPEC.md`, `TEST_SPEC.md`
- Canonical location: `specs/DRIVE_SPEC.md`
- Implementation family: `sdkwork-drive`

SDKWork Drive is the platform authority for files and object-storage-backed content. Application domains, including IM, commerce, knowledge base, AI studio, office, approval, and user profile modules, must use Drive for file storage instead of creating their own object storage tables, upload session state, provider registry, presign logic, local file stores, or media asset lifecycle.

`MediaResource` is the cross-domain representation of a usable media/file resource. Drive owns the storage lifecycle behind it. Business modules own only their business relation to a Drive resource and, when useful, a `MediaResource` snapshot for read models and transport.

## 1. Normative Language

The words `MUST`, `MUST NOT`, `SHOULD`, `SHOULD NOT`, and `MAY` are used with RFC-style meaning.

## 2. Ownership Boundary

Drive owns all platform file-storage responsibilities:

- Storage providers, provider capabilities, endpoint policy, bucket binding, credential references, health, and admin lifecycle.
- Object locators, object keys, versions, etags, checksums, content length, content type, provider metadata, and reconciliation.
- Spaces, folders, files, shortcuts, virtual references, node lifecycle, node versions, and content state.
- Upload sessions, idempotency, multipart upload state, upload grants, completion, abort, expiry, retry safety, and garbage collection.
- Download grants, signed URLs, range reads, CDN handoff, content disposition, and temporary delivery headers.
- File scanning, MIME validation, checksum verification, quarantine, retention, legal hold, lifecycle policy, and deletion.
- Quotas, usage accounting, audit events, operational metrics, traces, and storage provider error normalization.

Business domains own only business meaning:

- Which business aggregate references the file.
- The business role, for example `attachment`, `avatar`, `main_image`, `sku_image`, `invoice_document`, `voice`, `generated_output`, or `message_part`.
- Business ordering, display labels, alt text, moderation state, and domain-specific visibility.
- A stable reference to Drive, normally `drive_space_id`, `drive_node_id`, and `drive_uri`.
- A `MediaResource` snapshot when the domain needs a read-model projection or immutable message payload view.

Business domains `MUST NOT` own object storage lifecycle. They must not store provider credentials, bucket policy, object keys, upload part state, presigned URL state, S3/OSS/MinIO client configuration, or provider-specific deletion rules outside Drive.

## 3. Canonical Drive Model

Drive exposes a resource model above object storage. Consumers should reason about spaces and nodes, not buckets and keys.

| Concept | Owner | Purpose |
| --- | --- | --- |
| `DriveSpace` | Drive | Tenant-scoped storage namespace with owner, type, policy, lifecycle, and quota boundary. |
| `DriveNode` | Drive | File/folder/shortcut/virtual-reference resource addressable inside a space. |
| `DriveStorageProvider` | Drive | Configured object-storage backend such as local filesystem, S3-compatible storage, OSS, Azure Blob, or GCS. |
| `DriveStorageObject` | Drive | Storage fact for a concrete object or object version behind a file node. |
| `DriveUploadSession` | Drive | Idempotent upload lifecycle that reserves a target node/object and grants upload capability. |
| `DriveDownloadGrant` | Drive | Short-lived delivery authorization, usually backed by presigned provider URLs or trusted streaming. |

### 3.1 Space Types

Drive standard space types:

| Space type | Purpose | Standard owner binding |
| --- | --- | --- |
| `personal` | User-owned files and folders. | user subject |
| `team` | Organization/team shared files. | organization or team subject |
| `knowledge_base` | Files managed for knowledge ingestion, indexing, and retrieval. | knowledge-base aggregate |
| `ai_generated` | AI-generated artifacts, model outputs, edited media, and generated documents. | AI task, workspace, or generation scope |
| `app_upload` | Application-owned uploads such as chat attachments, product media, profile avatars, approval documents, and app manifests. | app id plus app resource type/id |

Specialized spaces must be represented by a Drive space profile table or equivalent Drive-owned metadata. Application modules must not create a separate storage root to bypass these profiles.

### 3.2 Node Types

Drive standard node types:

| Node type | Meaning |
| --- | --- |
| `file` | A resource with file content, metadata, and one or more storage object versions. |
| `folder` | A container for child nodes. |
| `shortcut` | A pointer to another Drive node without duplicating content. |
| `virtual_reference` | A logical resource projected from another system where Drive owns the reference policy but not necessarily original bytes. |

### 3.3 Upload Session States

Drive upload sessions use these states:

| State | Meaning |
| --- | --- |
| `created` | Session is reserved but no accepted upload progress is recorded. |
| `uploading` | Upload has started or at least one part/grant has been issued. |
| `completed` | Content is committed and the target node points to the resulting storage object/version. |
| `aborted` | Client or server canceled the upload and Drive must release temporary provider state. |
| `expired` | Session exceeded its expiry and cannot be completed. |

State transitions must be idempotent for the same `Idempotency-Key` and must reject conflicting retries.

### 3.4 Canonical URI

The stable external Drive URI is:

```text
drive://spaces/{spaceId}/nodes/{nodeId}
```

Rules:

- `drive_uri` is a stable reference to the Drive resource, not a delivery URL.
- `drive_uri` must not contain provider bucket names, object keys, credentials, or signed query strings.
- `drive_uri` is the preferred persisted reference when a domain stores only one string reference.
- A future content/object revision URI may be added by Drive, but business modules must still treat Drive as the authority for resolving it.

## 4. Storage Provider Contract

Drive provider adapters implement the `DriveObjectStore` contract. The standard provider kinds are:

- `local_filesystem`
- `s3_compatible`
- `azure_blob`
- `google_cloud_storage`
- `aliyun_oss`
- custom provider kinds owned by Drive provider extensions

The object-store contract includes:

- `put_object`
- `head_object`
- `delete_object`
- `create_multipart_upload`
- `presign_upload_part`
- `complete_multipart_upload`
- `abort_multipart_upload`
- `presign_download`
- `read_object_range`

Provider capabilities must be explicit:

- multipart upload
- presigned upload part
- presigned download
- range read
- server-side copy
- versioning

Rules:

- Provider credentials must be stored by reference and resolved only inside trusted Drive runtime composition.
- Provider-native errors must be normalized to Drive error kinds before crossing Drive service boundaries.
- Business services must not depend on provider-specific SDKs, provider bucket names, provider endpoints, or provider headers.
- Local filesystem storage is a Drive provider adapter for local/private mode. It is not a reason for app modules to write files directly.
- Presigned URLs are grants, not identity. They must expire and must never become persisted business state.

## 5. Database Contract

Drive database tables own storage facts. Business database tables own business references.

### 5.1 Drive-Owned Tables

The Drive schema owns these table families:

| Table | Responsibility |
| --- | --- |
| `drive_space` | Space identity, tenant, owner subject, space type, lifecycle, version, audit timestamps. |
| `drive_knowledge_space_profile` | Knowledge-base binding, ingestion policy, indexing policy, and knowledge-specific lifecycle. |
| `drive_ai_generation_space_profile` | AI generation scope, generated artifact retention policy, prompt/output retention policy. |
| `drive_app_upload_space_profile` | App upload binding by tenant, app id, app resource type/id, upload policy. |
| `drive_node` | Node identity, parent, node type, name, lifecycle, content state, version, audit timestamps. |
| `drive_storage_provider` | Provider kind, endpoint, bucket binding, credential reference, capabilities, status. |
| `drive_storage_object` | Concrete object/version facts: provider, bucket, object key, version, etag, checksum, size, content type, lifecycle. |
| `drive_upload_session` | Upload session identity, target space/node/object, idempotency key, state, expiry, policy. |
| `drive_upload_part` | Multipart part numbers, etags, size, checksum, state, and completion order when multipart is used. |
| `drive_download_grant` | Optional persisted audit/control record for signed download grants when policy requires it. |
| `drive_quota_usage` | Optional quota and usage accounting by tenant, space, provider, or policy scope. |

Drive implementation may split tables for performance, but the ownership boundary must not move into application modules.

### 5.2 Business Reference Tables

When a domain needs to attach Drive resources to business state, it should use a relation table shaped like this:

```text
<domain>_<entity>_drive_ref
  id
  tenant_id
  organization_id
  owner_type
  owner_id
  owner_version
  drive_role
  drive_space_id
  drive_node_id
  drive_uri
  media_kind
  media_source
  mime_type
  size_bytes
  checksum_algorithm
  checksum_value
  media_resource_snapshot
  resource_hash
  sort_order
  lifecycle_status
  retention_policy_code
  created_at
  updated_at
```

For media-specific domains, `drive_role` may be named `media_role`.

Rules:

- Business tables `MUST NOT` store `bucket`, `object_key`, provider endpoint, provider credential reference, or presigned URL as the source of truth.
- Business tables `MUST` reference Drive by `drive_space_id + drive_node_id` or by `drive_uri`.
- Business tables `MAY` store a `MediaResource` snapshot for read performance, immutable message history, or search projection, but Drive remains the storage authority.
- Business tables `MAY` store a Drive storage object id only when Drive exposes it as a stable public or internal reference. They must not store raw object keys to simulate that id.
- Cross-tenant sharing must be represented by Drive access policy or explicit business authorization. It must not be inferred from a shared URL.

## 6. HTTP API Contract

Drive APIs follow `API_SPEC.md` and use the standard prefixes:

- App API: `/app/v3/api/drive`
- Backend API: `/backend/v3/api/drive`

### 6.1 App API

The app API exposes user/application file workflows:

| Resource | Required operations |
| --- | --- |
| `/drive/spaces` | Create/list spaces allowed for the caller. |
| `/drive/nodes` | Create folders/files, list children, retrieve metadata, update names, move, delete according to policy. |
| `/drive/upload_sessions` | Create idempotent upload sessions. |
| `/drive/upload_sessions/{sessionId}/parts` | Reserve or retrieve upload part grants when multipart is supported. |
| `/drive/upload_sessions/{sessionId}/complete` | Complete an upload and return the Drive resource plus `MediaResource` mapping when applicable. |
| `/drive/upload_sessions/{sessionId}/abort` | Abort an upload session. |
| `/drive/nodes/{nodeId}/download_grants` | Create a short-lived download grant or delivery URL. |

### 6.2 Backend API

The backend API exposes operator and admin workflows:

| Resource | Required operations |
| --- | --- |
| `/drive/storage_providers` | Register, list, update, disable, and health-check providers. |
| `/drive/spaces` | Admin list, inspect, quota control, policy assignment. |
| `/drive/nodes` | Admin inspect and lifecycle actions. |
| `/drive/storage_objects` | Reconciliation, quarantine, retention, deletion, provider diagnostics. |
| `/drive/upload_sessions` | Inspect, expire, abort, or repair sessions. |
| `/drive/policies` | Upload, download, retention, scanning, and quota policies. |

Rules:

- Upload/file/object-storage APIs belong to Drive. A business API may initiate a domain command that internally calls Drive, but it must not define a parallel upload session or object lifecycle contract.
- API responses that expose application-usable files should return a Drive resource DTO and, when the file is media-like, a `MediaResource` built from the Drive mapping in this spec.
- Presigned URLs may appear only in Drive upload/download grant responses. Business DTOs must not include presigned URLs as persisted identity.
- Provider bucket/object details are allowed only in Drive backend/admin DTOs or internal diagnostic DTOs with proper authorization.
- OperationIds must use SDKWork resource style, for example `spaces.create`, `nodes.children.list`, `uploadSessions.create`, `uploadSessions.complete`, and `downloadGrants.create`.

## 7. RPC Contract

Drive RPC contracts follow `RPC_SPEC.md` and are peer adapters over the same Drive domain services used by HTTP.

Rules:

- Drive storage-control RPC may expose Drive-specific messages such as `DriveReference`, `DriveSpace`, `DriveNode`, `DriveUploadSession`, and `DriveDownloadGrant`.
- Business RPC services must use Drive references or `sdkwork.common.v1.MediaResource` for file/media payloads; they must not expose provider bucket/object identity unless they are Drive backend/internal services.
- Large file transfer should use Drive upload sessions, download grants, or range streaming. Business RPC services must not add ad hoc client streaming uploads unless Drive explicitly owns the stream.
- Drive RPC methods must map to equivalent HTTP operationIds where both surfaces exist.

Recommended common reference:

```proto
message DriveReference {
  string drive_uri = 1;
  string space_id = 2;
  string node_id = 3;
  string node_version = 4;
}
```

## 8. SDK Contract

Drive SDKs are generated from Drive OpenAPI/proto contracts and follow `SDK_SPEC.md`. Drive SDK workspace layout, OpenAPI authority file placement, derived generator inputs, and generated artifact placement follow `SDK_WORKSPACE_GENERATION_SPEC.md` as the subordinate detail standard.

Standard packages:

| Surface | Package |
| --- | --- |
| App HTTP SDK | `@sdkwork/drive-app-sdk` |
| Backend HTTP SDK | `@sdkwork/drive-backend-sdk` |
| App RPC SDK | `@sdkwork/drive-app-rpc-sdk` when RPC is enabled |
| Backend RPC SDK | `@sdkwork/drive-backend-rpc-sdk` when RPC is enabled |

Rules:

- Frontend upload services must use the generated Drive app SDK for upload sessions, completion, node metadata, and download grants.
- Backend/admin consoles must use the generated Drive backend SDK for provider, policy, quota, and diagnostic workflows.
- Business SDKs such as IM, commerce, user profile, or app manifest SDKs should receive Drive references or `MediaResource` payloads. They must not duplicate Drive upload operations.
- Consumers must not patch missing Drive SDK methods with raw HTTP, manual auth headers, direct provider SDK calls, or local generated-client forks. Fix Drive OpenAPI/proto and regenerate.

## 9. Frontend Upload Flow

Standard frontend flow:

```text
local File / picker asset
  -> Drive app SDK creates upload session
  -> UI uploads bytes through Drive grant or Drive streaming endpoint
  -> Drive app SDK completes upload
  -> Drive returns Drive resource + optional MediaResource
  -> business service submits Drive reference / MediaResource to business SDK
```

Rules:

- UI-local `File`, object URL previews, retry counters, and progress state are transient.
- Presigned upload/download URLs are service-local grants and must not enter business forms as identity.
- Business form state should carry `driveUri`, `driveSpaceId`, `driveNodeId`, or `MediaResource`, depending on the contract.
- Cache keys for persisted file/media resources should use `drive_uri`, `drive_node_id`, or `MediaResource.id`, not signed delivery URLs.
- Browser code must not construct provider object keys or call S3/OSS/MinIO SDKs directly.

## 10. Drive-Backed MediaResource Profile

`MEDIA_RESOURCE_SPEC.md` defines the `MediaResource` shape. This section defines the Drive-backed mapping.

Required mapping for SDKWork-owned object-storage resources:

| `MediaResource` field | Drive-backed value |
| --- | --- |
| `id` | Stable Drive node id, or a Drive media projection id if Drive exposes one. |
| `kind` | Derived from Drive content type, domain role, or explicit caller metadata. |
| `source` | `object_storage`. |
| `uri` | `drive://spaces/{spaceId}/nodes/{nodeId}`. |
| `objectBlobId` | Stable Drive storage object/version id when Drive exposes one; otherwise omit and rely on `uri` plus Drive metadata. |
| `fileName` | Drive node display name or original filename policy result. |
| `mimeType` | Drive content type after validation/sniffing. |
| `sizeBytes` | Drive content length as a JSON string. |
| `checksum` | Drive checksum, preferably SHA-256. |
| `url` | Optional short-lived delivery hint from Drive download grant. |
| `access` | Visibility and expiry derived from Drive policy and business authorization. |
| `metadata.drive` | Drive metadata such as `spaceId`, `nodeId`, `spaceType`, `nodeVersion`, and policy codes. |

Drive-backed example:

```json
{
  "id": "node_01HR6P7ZJQ4A7M2CKA9F0P6R7S",
  "kind": "image",
  "source": "object_storage",
  "uri": "drive://spaces/space_app_upload_01/nodes/node_01HR6P7ZJQ4A7M2CKA9F0P6R7S",
  "fileName": "demo.png",
  "mimeType": "image/png",
  "sizeBytes": "424242",
  "checksum": {
    "algorithm": "sha256",
    "value": "3f786850e387550fdab836ed7e6dc881de23001b"
  },
  "access": {
    "visibility": "tenant"
  },
  "metadata": {
    "drive": {
      "spaceId": "space_app_upload_01",
      "nodeId": "node_01HR6P7ZJQ4A7M2CKA9F0P6R7S",
      "spaceType": "app_upload",
      "nodeVersion": "1"
    }
  }
}
```

Rules:

- Business APIs must not require `bucketId` or `objectKey` in a Drive-backed `MediaResource`.
- Drive internal/admin APIs may expose bucket/object fields for operations and diagnostics, but those fields must not be copied into business state.
- `url` in a Drive-backed `MediaResource` is optional and temporary. Clients must use Drive download grants when a fresh URL is needed.
- AI-generated or edited media must include `ai` provenance in addition to Drive metadata.

## 11. Special Space Profiles

### 11.1 Knowledge Base

Knowledge-base files use `knowledge_base` spaces. Ingestion, parsing, chunking, embedding, index status, source document identity, and reindex policy must be attached to the Drive space profile or a knowledge-domain relation that references Drive. The knowledge domain must not store duplicate file bytes or object keys.

### 11.2 AI Generated

Generated images, audio, video, documents, model artifacts, and edited media use `ai_generated` spaces unless a product-specific app upload policy is explicitly selected. AI provenance belongs in `MediaResource.ai` and/or Drive-linked generation records. Provider URLs that expire must be imported into Drive or represented as provider assets with explicit refresh rules before becoming SDKWork-owned business state.

### 11.3 App Upload

Application uploads use `app_upload` spaces bound by `app_id`, `app_resource_type`, and `app_resource_id`. Examples include IM conversation attachments, product catalog media, user avatars, approval documents, app manifest screenshots, and exported reports.

## 12. Security And Privacy

Rules:

- Every Drive resource must be tenant-scoped.
- Authorization must be evaluated by Drive policy and the calling business context. A valid Drive node id alone is not authorization.
- Upload policy must define allowed MIME types, size limits, extension policy, checksum requirements, scanning rules, and retention.
- Drive must verify content length, checksum where supplied, and content type. File extension alone is not enough.
- Signed upload/download grants must be short-lived and auditable.
- Logs must not contain credentials, signed URL query strings, private headers, provider secrets, or raw user file content.
- File metadata may contain personal or sensitive data and must follow `PRIVACY_SPEC.md`.
- Public files still need owner, tenant, checksum, size, MIME type, lifecycle, and deletion policy.

## 13. Events And Observability

Drive events follow `EVENT_SPEC.md`. Standard event names should use the `drive.` prefix, for example:

- `drive.space.created`
- `drive.node.created`
- `drive.node.deleted`
- `drive.upload_session.created`
- `drive.upload_session.completed`
- `drive.object.quarantined`
- `drive.download_grant.created`

Observability follows `OBSERVABILITY_SPEC.md`:

- Trace Drive upload/session/download operations across SDK, API, Drive service, and provider adapter.
- Record provider latency, error kind, retry count, object size, grant expiry, and upload completion time.
- Do not emit high-cardinality object keys or signed URLs as metric labels.

## 14. Forbidden Technical Debt

New SDKWork code `MUST NOT` introduce:

- App-owned object blob tables such as `<app>_object_blob`, `<domain>_media_asset`, or `<domain>_upload_session` when the purpose is file storage lifecycle.
- App-owned storage provider registries or provider credential tables.
- App-owned presign services, direct S3/OSS/MinIO browser SDK flows, or hidden raw HTTP upload endpoints.
- Long-term `url`, `file_url`, `image_url`, `thumbnail_url`, `asset_url`, or `download_url` columns for SDKWork-owned files/media.
- Bucket/object key storage in arbitrary business JSON.
- Dual-write compatibility mirrors between old media tables and Drive for new unpublished applications.
- Business APIs that return provider bucket/object identity as normal application DTOs.
- Frontend services that bypass Drive SDK because a generated method is missing.

If a capability is missing in Drive, the standard fix is to add it to `sdkwork-drive`, update the Drive API/RPC contract, regenerate the Drive SDK, and then consume it from the business module.

## 15. Adoption Rules

New SDKWork applications and unpublished modules must adopt Drive directly with no compatibility layer.

When removing a legacy app-local storage implementation:

1. Delete app-local storage provider, upload session, media asset, and presign lifecycle ownership.
2. Create or reuse a Drive `app_upload`, `knowledge_base`, or `ai_generated` space.
3. Upload/import files into Drive and resolve `drive_space_id`, `drive_node_id`, and `drive_uri`.
4. Store only business relation rows and optional `MediaResource` snapshots in the business domain.
5. Update API/RPC/SDK/frontend contracts to use Drive references and `MediaResource`.
6. Delete bare URL and raw object-key fields from business persistence and DTOs.

Legacy compatibility is allowed only for already published external contracts with a documented governance exception. It is not allowed as a convenience for new SDKWork-owned work.

## 16. Review Checklist

- [ ] File/upload/object-storage lifecycle is owned by Drive.
- [ ] Business schemas store `drive_space_id`, `drive_node_id`, `drive_uri`, or `MediaResource` snapshots, not provider object keys.
- [ ] Upload session creation, completion, abort, and download grants use Drive APIs or Drive RPC.
- [ ] Frontend upload services use generated Drive SDKs and keep presigned URLs transient.
- [ ] Drive-backed `MediaResource` values use `uri = drive://spaces/{spaceId}/nodes/{nodeId}`.
- [ ] Provider credentials, bucket names, object keys, and signed URLs do not leak into business DTOs or persisted business state.
- [ ] AI-generated media and knowledge-base files use the correct Drive special space profile.
- [ ] Security review covers tenant isolation, authorization, MIME/size/checksum validation, scanning, retention, signed URL expiry, and logging.
- [ ] Observability records provider and upload lifecycle metrics without exposing secrets or high-cardinality signed URLs.
- [ ] Missing Drive capabilities are fixed in Drive contracts and generated SDKs, not patched with app-local storage code.
