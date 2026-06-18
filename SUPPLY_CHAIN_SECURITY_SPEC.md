# Supply Chain Security Standard

- Version: 1.0
- Scope: dependency integrity, build integrity, artifact signing, SBOM, provenance, attestations, release supply-chain evidence
- Related: `SECURITY_SPEC.md`, `PRIVACY_SPEC.md`, `DEPENDENCY_MANAGEMENT_SPEC.md`, `GITHUB_WORKFLOW_SPEC.md`, `APP_MANIFEST_SPEC.md`, `RELEASE_SPEC.md`, `QUALITY_GATE_SPEC.md`, `CODE_REVIEW_SPEC.md`, `SDK_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md`, `DOCUMENTATION_SPEC.md`, `TEST_SPEC.md`, `GOVERNANCE_SPEC.md`

This standard defines how SDKWork proves that source, dependencies, build steps, generated artifacts, and release artifacts are traceable and tamper-resistant. It aligns with NIST SSDF, SLSA, CycloneDX, SPDX, and in-toto concepts without requiring every repository to reach the same maturity level on day one.

## 1. Supply Chain Model

SDKWork supply-chain evidence covers:

```text
source -> dependencies -> build environment -> generated artifacts -> packaged artifacts -> published release
```

Rules:

- Source-controlled config must not contain secrets, private keys, or live credentials.
- Dependency versions and generator versions must be traceable.
- Build artifacts must trace to source revision, workflow run, toolchain, package target, and dependency refs.
- Generated SDK artifacts must trace to OpenAPI/proto/generator inputs.
- Release artifacts must include checksums and signing/SBOM/provenance evidence when required by release policy.

## 2. Dependency Integrity

Rules:

- Package managers should use lockfiles or equivalent reproducible dependency manifests.
- Dependency refs in workflow config must be pinned or validated as safe refs before checkout.
- Application workflow YAML must not hide dependency checkout logic outside `sdkwork.workflow.json` and the reusable workflow framework.
- Native build-tool dependency declarations, source/build dependency paths, release checkout refs, stale dependency cleanup, and dependency-owned SDK/API boundaries must follow `DEPENDENCY_MANAGEMENT_SPEC.md`.
- Dependencies with known critical vulnerabilities require remediation, mitigation, or an approved exception.
- New third-party runtime dependencies should have license, maintenance, security, and package-source review.

## 3. Build Integrity

Rules:

- Production builds must run in controlled CI/release environments or documented trusted build hosts.
- Build steps must not download and execute unauthenticated scripts as release authority.
- Build logs must not print tokens, API keys, private keys, signing credentials, or credential-bearing URLs.
- Toolchain versions should be declared through standard workflow/toolchain config.
- Build output must not include local override files, runtime databases, logs, caches, or user-private state.

## 4. SBOM And Provenance

Rules:

- SBOMs should use CycloneDX or SPDX.
- Provenance should use SLSA or in-toto-compatible attestations where tooling supports it.
- SBOM and provenance files are release evidence and must match the artifact version and package id.
- A package requiring `sbomRequired` must fail release validation when SBOM evidence is missing.
- A package requiring artifact attestations must fail release validation when provenance/attestation evidence is missing.

## 5. Signing And Checksums

Rules:

- Release artifacts should have immutable checksums.
- Signing keys must not be committed to source.
- Signing references may be stored in manifest or workflow config; private material belongs in secret managers or protected CI environments.
- When signing is required globally, target-level config must not disable signing without governance approval.
- Signature verification instructions should be documented for externally distributed artifacts.

### 5.1 Runtime Target Supply-Chain Evidence

Artifact evidence `MUST` match the package runtime target and distribution
channel.

| Runtime target class | Required evidence |
| --- | --- |
| `browser` and H5 web | Build provenance, asset checksums when packaged, public runtime config provenance, and CDN/edge publication trace. |
| `desktop` | Installer/app bundle checksum, OS signing or notarization evidence where applicable, update feed provenance, and bundled dependency inventory. |
| `tablet-*`, `capacitor-*`, `flutter-*`, native mobile | Platform signing/provisioning evidence, app-store/private track record, package checksum when directly distributed, and toolchain provenance. |
| `mini-program` | Upload identity, platform app id, package checksum when exported, review/release record, and platform key custody evidence. |
| `server` | Archive/service checksum, build provenance, SBOM, signing when required, and runtime config template provenance. |
| `container` | Immutable OCI digest or Docker-compatible image digest, SBOM/provenance, base image trace, and attestation when enabled. |
| `test-runner` | Workflow/test artifact provenance; no production signing claim. |

Rules:

- Docker-compatible image tags are not immutable evidence. Release records must
  store the digest used by the deployment or publication.
- Mobile, tablet, desktop, and mini program signing credentials `MUST` live in
  protected CI environments, platform key stores, or approved secret managers,
  not in source-controlled manifests, config, or package assets.
- Browser and H5 packages must not embed private SDK endpoints, auth tokens,
  API keys, or tenant-specific runtime config in static assets.

## 6. Generated Artifacts

Rules:

- Generated SDK output must be produced from approved generator inputs and recorded generator versions.
- Generated output must not be hand-edited outside approved custom extension points.
- Generated artifact provenance should identify the source OpenAPI/proto, generator command, generator version/ref, and output package.
- Consumers must not regenerate dependency-owned APIs into application-owned SDK families.

## 7. Review And Exceptions

Rules:

- Supply-chain exceptions require owner, reason, risk, expiry, and compensating control.
- Security-critical dependency or build-system changes require code review under `CODE_REVIEW_SPEC.md`.
- Release gate evidence under `QUALITY_GATE_SPEC.md` must include supply-chain evidence when artifacts are packaged or distributed.

## 8. Acceptance Checklist

- [ ] Dependency refs and lockfiles are traceable.
- [ ] Build environment and toolchains are declared.
- [ ] Generated artifacts trace to source contracts and generator inputs.
- [ ] Artifacts have checksums.
- [ ] Signing, SBOM, and provenance are present when required.
- [ ] Secrets are not committed or logged.
- [ ] Exceptions have owner, expiry, and compensating control.
