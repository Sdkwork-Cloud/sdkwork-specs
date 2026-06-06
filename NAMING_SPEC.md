# Naming Standard

- Version: 1.0
- Scope: domains, capabilities, repositories, applications, components, packages, SDK families, API authorities, route crates, database identifiers, files, and test names
- Related: `DOMAIN_SPEC.md`, `APPLICATION_SPEC.md`, `APP_PC_ARCHITECTURE_SPEC.md`, `COMPONENT_SPEC.md`, `MODULE_SPEC.md`, `API_SPEC.md`, `SDK_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md`, `DATABASE_SPEC.md`, `CODE_STYLE_SPEC.md`

This standard is the naming entrypoint for SDKWork. It indexes naming rules that are also governed by more specific specs. If this file conflicts with a more specific root spec, the more specific spec wins and this file must be updated.

## 1. General Rules

Rules:

- Names must describe ownership, domain, capability, and surface when those concepts matter.
- Use canonical domains from `DOMAIN_SPEC.md`.
- Do not invent aliases such as `identity` when the canonical domain is `iam`.
- New names use lowercase kebab-case for package and directory identifiers unless the language requires another convention.
- Public names must be stable enough for generated SDKs, package imports, tests, docs, and agent lookup.

## 2. Canonical Patterns

| Concept | Pattern | Example |
| --- | --- | --- |
| Product repository | `sdkwork-<product>` | `sdkwork-drive` |
| PC app package | `sdkwork-<product>-pc-<capability>` | `sdkwork-commerce-pc-product` |
| PC user console package | `sdkwork-<product>-pc-console-<capability>` | `sdkwork-commerce-pc-console-order` |
| PC internal admin package | `sdkwork-<product>-pc-admin-<capability>` | `sdkwork-commerce-pc-admin-audit` |
| Backend/admin React package | `@sdkwork/react-backend-<domain>` | `@sdkwork/react-backend-commerce` |
| Route crate package | `sdkwork-routes-<capability>-<surface>` | `sdkwork-routes-product-app-api` |
| Open API authority | `sdkwork-<domain>-open-api` | `sdkwork-im-open-api` |
| App API authority | `sdkwork-<domain>-app-api` | `sdkwork-commerce-app-api` |
| Backend API authority | `sdkwork-<domain>-backend-api` | `sdkwork-commerce-backend-api` |
| Public SDK family | `sdkwork-<domain>-sdk` | `sdkwork-im-sdk` |
| App SDK family | `sdkwork-<domain>-app-sdk` | `sdkwork-commerce-app-sdk` |
| Backend SDK family | `sdkwork-<domain>-backend-sdk` | `sdkwork-commerce-backend-sdk` |
| Component spec | `specs/component.spec.json` | `packages/foo/specs/component.spec.json` |
| App manifest | `sdkwork.app.config.json` | `apps/foo/sdkwork.app.config.json` |
| GitHub package id | `<platform>-<architecture>-<profile>-<format-token>`; Linux native packages use `linux-<distribution>-<architecture>-<profile>-<format-token>`; variant packages insert `<variant>` before `<format-token>` | `windows-x64-desktop-msi`, `linux-debian-x64-server-deb`, `container-x64-server-nvidia-cuda-tar-gz` |
| GitHub artifact name | `<artifact-prefix>-<package-id>` | `sdkwork-drive-android-arm64-mobile-aab` |
| Agent entrypoint | `AGENTS.md` | `AGENTS.md` |
| Tool compatibility shim | `<TOOL>.md` | `CLAUDE.md`, `GEMINI.md`, `CODEX.md` |

## 3. Language Naming

Rules:

- Rust packages use kebab-case; Rust modules and imports use snake_case.
- Java packages use lowercase dotted names under an approved SDKWork root; Java classes use PascalCase.
- TypeScript packages use kebab-case or approved scoped names; exported types/classes/components use PascalCase; functions and variables use camelCase.
- React hooks start with `use`.
- Database tables and columns use lowercase snake_case according to `DATABASE_SPEC.md`.

## 4. API And SDK Naming

Rules:

- Operation names and resource method trees follow `API_SPEC.md` and `SDK_SPEC.md`.
- SDK family names and API authority names must not be conflated.
- Route crates are source inputs, not SDK families and not OpenAPI authority directories.
- Generated package names must trace to the SDK family, not directly to the API authority.

## 4.1 Package Artifact Naming

Rules:

- GitHub workflow package ids use `<platform>-<architecture>-<profile>-<format-token>`.
- Linux native `deb` and `rpm` package ids use `linux-<distribution>-<architecture>-<profile>-<format-token>` because distribution families have different package metadata, dependencies, signing, repositories, and install validation.
- Package ids with a real variant use `<platform>-<architecture>-<profile>-<variant>-<format-token>`. Linux native variant packages use `linux-<distribution>-<architecture>-<profile>-<variant>-<format-token>`.
- Use the variant segment only when distinct releasable artifacts share the same platform, architecture, profile, and format. Examples include `cpu`, `nvidia-cuda`, and `amd-rocm` deployment bundles.
- GitHub workflow artifact names use `<artifact-prefix>-<package-id>`.
- `artifact-prefix` comes from `release.artifactPrefix` and normally matches `app.id` unless an application has a documented release-branding reason.
- `format-token` is the lowercase kebab token for the package format. Dots and other separators are normalized to hyphens, for example `tar.gz` becomes `tar-gz`.
- Valid Linux native package distributions are `debian` and `ubuntu` for `deb`, and `rhel`, `centos`, `fedora`, `opensuse`, and `suse` for `rpm`.
- Generic Linux archive formats such as `tar.gz`, `appimage`, `snap`, and `flatpak` do not include the distribution segment unless a more specific future standard defines one.
- Package ids and artifact names `MUST` use lowercase kebab tokens only. Do not use `service` as a package profile alias for `server`, and do not omit the format token.
- Variant values `MUST` use lowercase kebab tokens and must not be encoded into `architecture`, `profile`, or `format`.
- When an SDKWork application supports more than one surface, the `profile` segment distinguishes server, PC desktop, mobile, tablet, web, worker, and library packages.

Examples:

| Surface | Package id | Artifact name with `artifact-prefix: sdkwork-drive` |
| --- | --- | --- |
| Server Debian `.deb` | `linux-debian-x64-server-deb` | `sdkwork-drive-linux-debian-x64-server-deb` |
| Server Ubuntu `.deb` | `linux-ubuntu-arm64-server-deb` | `sdkwork-drive-linux-ubuntu-arm64-server-deb` |
| Server RHEL `.rpm` | `linux-rhel-x64-server-rpm` | `sdkwork-drive-linux-rhel-x64-server-rpm` |
| Desktop Fedora `.rpm` | `linux-fedora-x64-desktop-rpm` | `sdkwork-drive-linux-fedora-x64-desktop-rpm` |
| Server Linux archive | `linux-x64-server-tar-gz` | `sdkwork-drive-linux-x64-server-tar-gz` |
| Server container image | `container-arm64-server-oci` | `sdkwork-drive-container-arm64-server-oci` |
| CPU container bundle | `container-x64-server-cpu-tar-gz` | `sdkwork-drive-container-x64-server-cpu-tar-gz` |
| NVIDIA CUDA container bundle | `container-x64-server-nvidia-cuda-tar-gz` | `sdkwork-drive-container-x64-server-nvidia-cuda-tar-gz` |
| AMD ROCm container bundle | `container-x64-server-amd-rocm-tar-gz` | `sdkwork-drive-container-x64-server-amd-rocm-tar-gz` |
| PC desktop Windows installer | `windows-x64-desktop-msi` | `sdkwork-drive-windows-x64-desktop-msi` |
| PC desktop Windows bootstrapper | `windows-x64-desktop-exe` | `sdkwork-drive-windows-x64-desktop-exe` |
| PC desktop macOS bundle | `macos-arm64-desktop-dmg` | `sdkwork-drive-macos-arm64-desktop-dmg` |
| Phone Android app bundle | `android-arm64-mobile-aab` | `sdkwork-drive-android-arm64-mobile-aab` |
| Phone iOS app archive | `ios-universal-mobile-ipa` | `sdkwork-drive-ios-universal-mobile-ipa` |
| Tablet iPadOS app archive | `ipados-universal-tablet-ipa` | `sdkwork-drive-ipados-universal-tablet-ipa` |
| Tablet Windows package | `windows-tablet-x64-tablet-msix` | `sdkwork-drive-windows-tablet-x64-tablet-msix` |

## 5. Component Naming

Rules:

- `component.name` in `component.spec.json` must match the package/crate/module identity when one exists.
- `component.domain` must use a canonical domain.
- `component.capability` should be a small business or technical capability, not a catch-all such as `common`, `misc`, or `core` unless the owning spec approves it.
- Components that cross domains must document the composition reason and preserve domain-owned service boundaries.

## 6. Collision And Migration Rules

Rules:

- If two names differ only by legacy aliases, case, pluralization, or omitted surface, choose the canonical name and document migration.
- Compatibility wrappers may preserve old imports during migration, but new public contracts use canonical names.
- Breaking renames require `GOVERNANCE_SPEC.md` approval and migration notes.

## 7. Acceptance Checklist

- [ ] Domain and capability names are canonical.
- [ ] Package, route crate, SDK family, and API authority names follow the required patterns.
- [ ] Component manifests use matching names.
- [ ] Database identifiers follow `DATABASE_SPEC.md`.
- [ ] Any legacy alias has a migration or exception record.
