# Release Standard

- Version: 1.0
- Scope: release trains, versioning, release candidates, artifacts, signing, SBOM, provenance, changelog, staged rollout, rollback, release evidence
- Related: `APP_MANIFEST_SPEC.md`, `GITHUB_WORKFLOW_SPEC.md`, `DEPLOYMENT_SPEC.md`, `CONFIG_SPEC.md`, `ENVIRONMENT_SPEC.md`, `QUALITY_GATE_SPEC.md`, `MIGRATION_SPEC.md`, `SUPPLY_CHAIN_SECURITY_SPEC.md`, `DOCUMENTATION_SPEC.md`, `SECURITY_SPEC.md`, `PRIVACY_SPEC.md`, `OBSERVABILITY_SPEC.md`, `TEST_SPEC.md`, `GOVERNANCE_SPEC.md`

This standard defines how SDKWork applications, services, SDKs, and reusable packages become releasable artifacts.

## 1. Release Authority

Rules:

- Application identity, package targets, media, install metadata, and release notes are governed by `APP_MANIFEST_SPEC.md`.
- GitHub packaging and deployment automation follows `GITHUB_WORKFLOW_SPEC.md`.
- Runtime and deployment behavior follows `DEPLOYMENT_SPEC.md`, `CONFIG_SPEC.md`, and `ENVIRONMENT_SPEC.md`.
- Supply-chain evidence follows `SUPPLY_CHAIN_SECURITY_SPEC.md`.
- A release is not valid without release gate evidence from `QUALITY_GATE_SPEC.md`.

## 2. Release Types

| Type | Use |
| --- | --- |
| Development build | internal validation, no production claims |
| Release candidate | complete candidate awaiting final validation |
| Production release | customer/operator-facing artifact or deployment |
| Hotfix | urgent correction with narrowed scope and explicit rollback |
| SDK release | generated or composed SDK package release |
| Standard release | root standard version/change publication |

Rules:

- Production releases must be reproducible enough to trace source, config, dependency refs, build workflow, and artifact evidence.
- Production releases must record whether each deployable artifact or rollout
  uses `deploymentProfile = standalone` or `deploymentProfile = cloud`, and the
  `runtimeTarget` it serves.
- Hotfixes must still satisfy security, generated SDK, migration, and rollback rules for touched surfaces.
- SDK releases must trace to OpenAPI/proto/generator inputs and generated output boundaries.

## 3. Versioning

Rules:

- Released artifacts must have a stable version before packaging.
- Version resolution must be consistent across manifest, workflow matrix, lifecycle env, changelog, package names, and published artifacts.
- Public API, SDK, database, manifest, and package breaking changes must include migration or explicit no-compatibility approval.
- Version tags should be immutable after publication. If a tag must be replaced, governance approval and release notes must explain the correction.

## 4. Release Evidence

Production release evidence should include:

- requirement ids or release scope.
- release version, tag, commit, workflow run, deployment profile, runtime
  target, and package targets.
- manifest validation.
- build and test output.
- artifact names, checksums, and storage locations.
- signing evidence where required.
- SBOM and provenance where required.
- migration plan and status when relevant.
- rollout and rollback plan for each deployment profile and runtime target.
- release notes and user/operator impact.
- post-release smoke checks and monitoring signals.

Rules:

- Release notes must not be stale or copied from a mismatched version.
- Release artifacts must not contain secrets, private keys, local env overrides, or user-private runtime state.
- Release artifacts must not encode retired deployment profile values such as
  `saas`, `private`, `local`, `server`, `container`, or `desktop`; `server`,
  `container`, and `desktop` are runtime targets only.
- Store submissions and private distribution records are release evidence, not replacement for source-controlled release metadata.

### 4.1 Runtime Target Release Evidence

Release records `MUST` describe evidence by runtime target, not only by product
version.

| Runtime target class | Required release evidence | Rollback expectation |
| --- | --- | --- |
| `browser` / H5 web | Static asset or web URL package id, asset checksums when packaged, public runtime config version, CDN/edge host, cache invalidation plan | Previous asset version or host route can be restored without changing API contracts. |
| `desktop` | Installer/app bundle package id, OS/signing evidence, update channel, user data compatibility notes | Previous installer/update channel can be restored; user data migrations are reversible or forward-fix approved. |
| `tablet-ipados`, `tablet-android` | Tablet package id, signing/store/private distribution evidence, large-screen target metadata | Store/private rollout can be paused or reverted according to platform constraints. |
| `capacitor-*`, `flutter-*`, native mobile | App package id, signing/provisioning evidence, store/private track, minimum supported version, staged rollout status | Store rollout can be halted, superseded, or force-updated with documented user impact. |
| `mini-program` | Platform package id, platform app id, upload/review/release record, platform version, subpackage evidence | Platform release can be rolled back, disabled, or superseded according to platform rules. |
| `server` | Archive/service package id, runtime config version, database/Redis compatibility, service health checks | Previous service package/config can be restored or forward-fix plan is approved. |
| `container` | Image/bundle package id, immutable digest, SBOM/provenance, orchestration manifest/chart version, probes | Previous digest/manifest can be redeployed and data migrations are covered. |
| `test-runner` | Test artifact id or workflow run evidence only | Not a production rollback target. |

Rules:

- A release that includes more than one runtime target `MUST` record evidence
  and rollback for each target separately.
- Client runtime releases `MUST` name the SDK/API surface versions they expect
  and the minimum compatible backend/runtime version when compatibility matters.
- Container/Docker-compatible releases `MUST` record immutable image digests;
  mutable tags are convenience labels, not release identity.

## 5. Rollout And Rollback

Rules:

- Risky releases should use staged rollout, limited tenant exposure, feature flags, or canary deployment when supported.
- Rollback must identify which deployment-profile-specific artifacts, runtime
  target packages, database migrations, config changes, SDK versions, and
  feature flags are reversible.
- A migration that cannot be rolled back must have a forward-fix plan and explicit approval.
- Rollout must define monitoring signals and stop conditions.

## 6. Release Freeze

Rules:

- Release candidates may enter freeze when only release blockers, documentation corrections, and approved hotfixes are allowed.
- Scope changes during freeze require owner approval and renewed release gate evidence.
- Freeze does not waive security or migration checks.

## 7. Post-Release

Rules:

- Production releases should record smoke test results, incident links, rollout status, and known issues.
- If a release causes incident response, the release record must link to the incident and follow-up actions.
- Release evidence should be retained according to `DOCUMENTATION_SPEC.md` and the repository retention policy.

## 8. Acceptance Checklist

- [ ] Release scope, version, tag, deployment profile, runtime target, and artifacts are known.
- [ ] Manifest, workflow, config, deployment profiles, runtime targets, and deployment targets are validated.
- [ ] Tests and quality gate evidence are recorded.
- [ ] Signing, SBOM, and provenance are present when required.
- [ ] Migration, rollout, rollback, and monitoring plans are present when relevant.
- [ ] Release notes match the version and artifact set.
