# REQ-2026-0720 API Assembly And Gateway Hosting

Status: in-progress
Owner: SDKWork platform
Date: 2026-07-20
Source: platform

## Problem

Application repositories currently mix API composition with runtime gateway
identity. Some application development runners start or package the platform
`sdkwork-api-cloud-gateway`, gateway hosts duplicate route/service/repository
dependencies, and the existing `gateway-assembly` name makes reusable API
capability composition appear owned by a gateway process.

## Goals

- Give every application one host-neutral `sdkwork-api-<application-code>-assembly`.
- Assemble all application-owned app-api, backend-api, and open-api routes once.
- Make `sdkwork-api-<application-code>-standalone-gateway` the application HTTP
  host used by `pnpm dev`.
- Make `sdkwork-api-cloud-gateway` a platform-owned cloud host that consumes
  assemblies without reverse application dependencies.
- Remove application cloud-gateway startup, config, topology, dependency, and
  packaging debt.
- Enforce thin gateway hosts and identical API contracts in both profiles.
- Keep client and composition contracts surface-oriented so they never request
  or identify a local platform gateway process.
- Remove the parallel `integration.foundationApiGateway` component contract;
  use topology surfaces, SDK dependency declarations, and dependency runtime
  availability as their respective authorities.

## Non-Goals

- Changing HTTP paths, operation contracts, SDK family ownership, or auth semantics.
- Adding a third deployment profile.
- Moving non-HTTP edge, realtime, or device protocols into the cloud HTTP gateway.
- Bulk-editing application repositories as part of the standards change.

## Acceptance Criteria

- `API_ASSEMBLY_SPEC.md` is the assembly authority and is indexed by `README.md`.
- Gateway, naming, topology, deployment, component, pnpm, migration, test, and
  quality standards use the new dependency direction and identities.
- New schema/tooling materializes and validates `sdkwork.api.assembly`.
- Application boundary checks reject active `sdkwork-api-cloud-gateway`
  dependencies, startup, config, topology ownership, and packaging.
- Old gateway-assembly and application-cloud-gateway identities remain only in
  migration records, compatibility input, and negative tests.
- Composition output uses `external-via-platform-surface` and
  `requiresPlatformApiSurface`; gateway-implementation field names are
  migration input only.
- Application component specs do not emit `integration.foundationApiGateway`;
  the boundary checker reports it as migration debt.
- A read-only workspace audit reports consumer migration debt without modifying
  application roots.

## Trace

- Decision: `ADR-20260720-api-assembly-gateway-hosting`
- Migration: `MIG-2026-0720-api-assembly-gateway-hosting`
- Specs: `API_ASSEMBLY_SPEC.md`, `APPLICATION_GATEWAY_SPEC.md`,
  `APP_RUNTIME_TOPOLOGY_SPEC.md`, `NAMING_SPEC.md`, `PNPM_SCRIPT_SPEC.md`,
  `COMPONENT_SPEC.md`, `MIGRATION_SPEC.md`, `TEST_SPEC.md`

## Verification

```text
node --test tools/validate-api-assembly.test.mjs
node --test tools/check-application-cloud-gateway-boundary.test.mjs
node tools/audit-api-assembly-workspace.mjs --workspace ..
git diff --check
```
