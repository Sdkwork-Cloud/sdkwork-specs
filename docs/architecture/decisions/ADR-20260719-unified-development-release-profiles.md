# ADR-20260719 Unified Development, Release, And Deployment Profiles

Status: accepted
Requirement: REQ-2026-0720
Owner: SDKWork platform
Date: 2026-07-19
Specs: `PNPM_SCRIPT_SPEC.md`, `APP_RUNTIME_TOPOLOGY_SPEC.md`, `RELEASE_SPEC.md`, `DEPLOYMENT_SPEC.md`, `GITHUB_WORKFLOW_SPEC.md`

## Context

SDKWork has one canonical deployment profile axis, `standalone|cloud`, but its
developer and operator command surfaces are incomplete. Bare development
commands can hide their selected profile, cloud development topology can start
local gateway processes, and release or deployment commands can omit the
fixed/supported profile binding that determines runtime and rollback behavior. Adding a
second remote/local axis would make runtime configuration contradictory.

## Decision

The existing deployment profile remains the only active API/runtime topology
axis. Artifact capability, target platform, client architecture, package
format, provider, ownership, and rollout are separate dimensions.

- `pnpm dev` delegates to `pnpm dev:standalone`.
- `dev:standalone` selects `standalone.development` and may start the local
  application deployment unit.
- `dev:cloud` selects `cloud.development`, starts only local developer-facing
  client surfaces, and consumes already deployed application/platform APIs.
- Standalone application HTTP uses the application API assembly and
  `sdkwork-api-<application-code>-standalone-gateway`. Cloud clients consume
  explicit deployed surface URLs. API assembly and cloud host ownership are
  superseded by `ADR-20260720-api-assembly-gateway-hosting`.
- Runtime instances select one profile. Runtime-configurable signed clients may
  declare `supportedDeploymentProfiles = [standalone, cloud]`; fixed service,
  gateway, worker, and container artifacts bind one profile.
- Runtime-configurable package ids use `dual` only as an artifact
  binding token. It is not accepted as a deployment profile.
- Release commands use `release:<phase>[:runtimeTarget]:<deploymentProfile>`.
- Runtime-configurable client releases use
  `release:<phase>:<runtimeTarget>:runtime-configurable`; package ids carry the
  single `dual` binding segment.
- Deployment commands use
  `deploy:<phase>:<deploymentProfile>[:provider]`.
- Packaging, publication, and deployment remain separate gates. Package and
  publish produce or register immutable artifacts; deploy applies an artifact
  to a lifecycle environment.
- Side-effecting publish/apply/rollback operations require explicit profile
  selection. Deployment also requires an explicit lifecycle environment.
- An application release matrix covers both profiles at application level
  when the application owns both architectures; individual runtime targets
  follow the manifest consistency matrix and do not invent invalid duplicate
  artifacts.

The implementation boundary is split into three cooperating components.
`sdkwork-app-topology` owns the local `sdkwork-app` facade and resolved topology
plans; `sdkwork-github-workflow` owns build, package, sign, SBOM, publication,
and reusable CI matrices; `sdkwork-specs/tools/deployctl.mjs` owns typed
deployment plans, immutable artifact evidence, apply, and rollback.
Artifact evidence is generated and verified by shared framework helpers, binds
the primary artifact path and bytes to version/source commit, and travels with
the package. Workflow artifact scopes separate publishable and non-deployable
outputs before aggregate Release selection.
Application roots keep only thin public aliases and private `_sdkwork:*` hooks
for language- and toolchain-specific commands.

## Alternatives

- Add `remote`, `local-api`, or `apiMode`: rejected because it duplicates the
  deployment profile and produces contradictory runtime state.
- Make bare `release` package, publish, and deploy: rejected because it bypasses
  verification, approval, and rollback gates.
- Bind every installed client to standalone because it is locally installed:
  rejected because installation location does not determine the API topology.
- Produce separate byte-identical client artifacts for standalone and cloud:
  rejected because endpoints belong to typed runtime bootstrap unless signing,
  entitlements, permissions, or store identity genuinely differ.
- Let cloud development fall back to localhost: rejected because it conceals
  missing cloud config and can test the wrong API contract.

## Consequences

- Existing application roots must add two deterministic development scripts
  and profile-aware release/deploy variants.
- `cloud.development` topology files must provide explicit remote surface URLs
  and disable local API/gateway autostart.
- Validators become stricter and require coordinated consumer migration.
- Release evidence and rollback plans are recorded separately per profile and
  runtime target even when both share one SemVer release.
- Client artifacts record a profile capability set, while each runtime session
  and deployment rollout still has one active profile.
- Topology contracts migrate from v4 to v5, deploy manifests from v1 to v2,
  and client package/workflow contracts add explicit profile binding.
- Operators retain explicit control over provider and environment selection.

## Verification

- `check-pnpm-script-standard.mjs` verifies entrypoints, delegation, phase
  order, profile coverage, and normalized command values.
- `check-topology-deployment-profiles.mjs` verifies required profile files and
  remote-only `cloud.development` orchestration.
- Workflow, manifest, deploy, release, and supply-chain validators verify
  package selection, environment approvals, artifact evidence, and rollback.
- Topology v5 and resolved runtime plans have repository-owned JSON schemas;
  deployctl consumes a verified artifact evidence document and performs atomic
  nginx replacement with test/reload restoration.

## Supersedes / Superseded By

Gateway composition and host-ownership clauses are superseded by
`ADR-20260720-api-assembly-gateway-hosting`; lifecycle and release decisions remain active.
