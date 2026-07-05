# SDKWork App Manifest Standard v3

- Version: 1.0
- Scope: app registration, app manifest, release metadata, install packages, media assets, platform_app projection
- Related: `SDKWORK_WORKSPACE_SPEC.md`, `NAMING_SPEC.md`, `APPLICATION_SPEC.md`, `IAM_APPLICATION_BOOTSTRAP_SPEC.md`, `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md`, `APP_PC_ARCHITECTURE_SPEC.md`, `APP_H5_ARCHITECTURE_SPEC.md`, `FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC.md`, `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md`, `ANDROID_APP_MOBILE_ARCHITECTURE_SPEC.md`, `IOS_APP_MOBILE_ARCHITECTURE_SPEC.md`, `HARMONY_APP_MOBILE_ARCHITECTURE_SPEC.md`, `CONFIG_SPEC.md`, `DEPENDENCY_MANAGEMENT_SPEC.md`, `DEPLOYMENT_SPEC.md`, `DRIVE_SPEC.md`, `MEDIA_RESOURCE_SPEC.md`, `SECURITY_SPEC.md`, `DOCUMENTATION_SPEC.md`

SDKWork App Manifest Standard v3 defines the canonical app configuration used by new applications under `apps/`. The standard is intentionally strict: new apps do not carry legacy compatibility branches, and every field is designed to map cleanly into `platform_app` while retaining enough metadata for professional multi-platform release operations.

## 1. Source Of Truth

Every registered application owns one manifest:

```text
<app-root>/sdkwork.app.config.json
```

The manifest must use:

```json
{
  "schemaVersion": 3,
  "kind": "sdkwork.app"
}
```

The schema lives at `apps/schemas/sdkwork.app.schema.v3.json`. The full example lives at `apps/examples/sdkwork.app.config.v3.full.example.json`. The examples file carries the version suffix only because it is a reusable reference; each real app directory must use the unsuffixed canonical filename above.

The same `<app-root>` `MUST` contain the source-controlled `.sdkwork/` workspace required by
`SDKWORK_WORKSPACE_SPEC.md`, including `.sdkwork/skills/` and `.sdkwork/plugins/`.

## 2. Design Principles

- `sdkwork.app.config.json` is the source of truth for registration, package distribution, update checks, and release governance.
- `.sdkwork/` is the source-controlled workspace metadata directory for the same application root. It stores local skills and plugins; it does not store manifest release payloads, runtime state, generated SDK transport output, or user-private data.
- `platform_app` is the database projection, not a second independent source.
- App icons, screenshots, and preview assets are governed data, not loose files. SDKWork-owned media bytes must be stored through Drive, represented as `MediaResource` where app APIs expose them, and projected into `platform_app.config.media`.
- Backend enum names are used verbatim. Do not invent aliases such as `DESKTOP_UBUNTU`; use `DESKTOP_LINUX` plus package metadata for the Linux distribution.
- Latest download resolution is a matrix query across version, channel, platform, architecture, and optional Linux distribution.
- Production release artifacts require immutable URLs or digests, checksums, signing metadata, and SBOM/provenance references.
- The manifest must never contain passwords, access tokens, API keys, private keys, or credentials.
- Source/build dependency checkout roots are governed by `DEPENDENCY_MANAGEMENT_SPEC.md` and `sdkwork.workflow.json`; app manifests must not carry machine-specific dependency source paths.
- App manifests must not become gateway catalogs. When an application or gateway manifest records
  dependency SDK/runtime references, those entries must point to existing SDKWork dependency
  declarations, component specs, SDK assembly metadata, and native build-tool evidence such as Cargo
  features or workspace dependencies. They must not duplicate a standalone list of gateway-served
  APIs as a second source of truth.

## 3. Top-Level Contract

```json
{
  "schemaVersion": 3,
  "kind": "sdkwork.app",
  "app": {},
  "backend": {},
  "runtime": {},
  "media": {},
  "publish": {},
  "environments": {},
  "artifacts": {},
  "release": {},
  "security": {},
  "devApp": {},
  "metadata": {}
}
```

Required sections are `app`, `backend`, `runtime`, `media`, `publish`, `environments`, `artifacts`, `release`, and `security`.

## 4. Identity

`app.key` is the immutable application key. It must be lower kebab-case and unique under `apps/`.

`app.name` maps to `platform_app.name`. Current backend upsert flows resolve apps by name, so it must be stable and must not be used as a marketing-only label.

`app.displayName` is the UI label. It can change without changing identity.

`app.officialWebsiteUrl` is the canonical public website for the application. It is required for every app, must be an HTTP/HTTPS URL, and is the default landing page used by SDKWork catalog surfaces, store marketing fallback fields, and `platform_app.config.standard.officialWebsiteUrl`. Do not use environment runtime URLs, CDN download URLs, or app-store listing URLs here. Those belong in `environments`, `artifacts.installConfig.packages[]`, and `publish.stores[]`.

`app.appType` must be one of the backend `PlusProjectType` values:

```text
NONE, SDK, PPT, APP_HTML, APP_VUE, APP_FLUTTER, APP_UNIAPP,
APP_REACT, APP_UNITY, VIDEO, POSTER
```

Identifiers:

| Field | Purpose |
| --- | --- |
| `packageName` | Android application id, for example `com.sdkwork.drive` |
| `bundleId` | iOS/macOS bundle identifier |
| `desktopAppId` | Desktop runtime identifier |
| `containerImage` | Server image repository name without mutable secret data |

## 5. Platform Taxonomy

The standard uses backend `PlusPlatform` values exactly:

| Family | Values |
| --- | --- |
| Web | `WEB`, `H5`, `H5_WEIXIN` |
| Mobile | `APP`, `APP_PLUS`, `APP_ANDROID`, `APP_IOS`, `APP_HARMONY` |
| Desktop | `DESKTOP`, `DESKTOP_WINDOWS`, `DESKTOP_MACOS`, `DESKTOP_LINUX` |
| Mini Program | `MP`, `MP_WEIXIN`, `MP_ALIPAY`, `MP_BAIDU`, `MP_TOUTIAO`, `MP_LARK`, `MP_QQ`, `MP_KUAISHOU`, `MP_JD`, `MP_360`, `MP_DINGTALK`, `MP_ALI` |
| Mini Game | `MP_WEIXIN_GAME`, `MP_QQ_GAME`, `MP_BAIDU_GAME`, `MP_TOUTIAO_GAME` |
| Quick App | `QUICKAPP`, `QUICKAPP_WEBVIEW`, `QUICKAPP_WEBVIEW_UNION`, `QUICKAPP_WEBVIEW_HUAWEI` |
| Operations | `ADMIN`, `CLI`, `API`, `OTHER` |

Ubuntu is represented as:

```json
{
  "platform": "DESKTOP_LINUX",
  "packageFormat": "DEB",
  "metadata": {
    "linux": {
      "distro": "ubuntu",
      "minVersion": "22.04"
    }
  }
}
```

## 6. Runtime

`runtime.family` classifies the app:

```text
web, mobile, desktop, server, cli, mini-program, library, plugin
```

`runtime.framework` is descriptive and should be specific, for example `react`, `react-tauri`, `react-h5`, `react-capacitor`, `flutter`, `android-native`, `ios-native`, `harmony-native`, `weixin-mini-program`, `multi-mini-program`, `electron`, `spring-boot`, `node-service`, `go-service`, or `rust-service`.

`runtime.defaultPlatform` and `runtime.defaultArchitecture` drive default latest download resolution and `platform_app.downloadUrl` projection.

`runtime.supportedDeploymentProfiles` declares which SDKWork application
deployment architectures the app supports:

```text
standalone, cloud
```

`runtime.defaultDeploymentProfile` selects the default profile used by local
tooling, package generation, and latest-download resolution when a caller does
not request one explicitly.

Rules:

- `runtime.supportedDeploymentProfiles` `MUST` be non-empty and every value
  `MUST` be `standalone` or `cloud`.
- `runtime.defaultDeploymentProfile` `MUST` be one of
  `runtime.supportedDeploymentProfiles`.
- App manifests `MUST NOT` use `saas`, `private`, `local`, `test`, `server`,
  `container`, `desktop`, `web`, `self-hosted`, or `cloud-hosted` as deployment
  profile values. `server`, `container`, `desktop`, browser, mobile, tablet,
  and mini-program concepts belong to `runtimeTarget` or package metadata.

### 6.1 Client Architecture Manifest Alignment

Client roots must keep manifest runtime metadata aligned with their root architecture standard.

| Root architecture | Runtime family | Runtime framework examples | Publish platform examples |
| --- | --- | --- | --- |
| PC browser/desktop/tablet root | `web` or `desktop` | `react`, `react-tauri` | `WEB`, `DESKTOP_WINDOWS`, `DESKTOP_MACOS`, `DESKTOP_LINUX` |
| H5/Capacitor application root | `mobile` | `react-h5`, `react-capacitor` | `H5`, `H5_WEIXIN`, `APP_IOS`, `APP_ANDROID` |
| Flutter mobile root | `mobile` | `flutter` | `APP_IOS`, `APP_ANDROID`, `APP_HARMONY` when supported |
| Mini program root | `mini-program` | `weixin-mini-program`, `alipay-mini-program`, `multi-mini-program` | `MP_WEIXIN`, `MP_ALIPAY`, `MP_DINGTALK`, `MP_LARK` |
| Native Android mobile root | `mobile` | `android-native` | `APP_ANDROID` |
| Native iOS mobile root | `mobile` | `ios-native` | `APP_IOS` |
| Native HarmonyOS mobile root | `mobile` | `harmony-native` | `APP_HARMONY` |

Rules:

- The application root selected in `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md` and the matching root architecture standard `MUST` match `runtime.family`, `runtime.framework`, `publish.platforms`, and `artifacts.installConfig.packages[]`.
- H5-only apps should use `runtime.family = "mobile"` and `runtime.framework = "react-h5"`. H5 plus Capacitor apps should use `runtime.framework = "react-capacitor"`.
- Flutter apps should use `runtime.family = "mobile"` and `runtime.framework = "flutter"`.
- Mini program apps should use `runtime.family = "mini-program"` and a platform-specific or multi-platform mini program framework value.
- Native Android apps should use `runtime.family = "mobile"` and `runtime.framework = "android-native"`.
- Native iOS apps should use `runtime.family = "mobile"` and `runtime.framework = "ios-native"`.
- Native HarmonyOS apps should use `runtime.family = "mobile"` and `runtime.framework = "harmony-native"`.
- Package ids and artifact names in the manifest follow `NAMING_SPEC.md`; source package names follow the matching architecture standard and are not copied into release package ids unless they are also the release artifact identity.
- `publish.platforms` must list only actually supported platforms. Do not list `APP_IOS`, `APP_ANDROID`, `APP_HARMONY`, or `MP_*` values just because the source architecture could support them later.

## 7. Media Assets

Every app must define governed product media. These assets support the SDKWork app catalog, registration UI, App Store Connect, Google Play Console, desktop download pages, and future app-preview surfaces.

```json
{
  "media": {
    "icons": {
      "primary": {},
      "platform": []
    },
    "screenshots": [],
    "previews": []
  }
}
```

`media.icons.primary` is the canonical SDKWork app icon. It should be a 1024 x 1024 PNG with no embedded secrets or environment-specific URLs. It projects to `platform_app.iconUrl`.

`media.icons.platform[]` stores platform-specific icon variants. Use it for Google Play 512 x 512 icons, Apple App Store 1024 x 1024 icons, desktop taskbar or dock variants, and other catalog-specific variants. It may be empty for desktop-only, server-only, and web-only apps that do not need store-specific icon variants.

`media.screenshots[]` stores actual product screenshots. A screenshot must show the app itself, not a marketing-only banner. Each screenshot records platform, locale, device class, display type, dimensions, format, caption, sort order, and optional accessibility text in metadata.

`media.previews[]` stores feature graphics, preview images, and preview videos. This is where Google Play feature graphics and Apple app preview videos live.

Common media asset fields:

| Field | Purpose |
| --- | --- |
| `id` | Immutable unique asset id within the manifest |
| `type` | `ICON`, `SCREENSHOT`, `PREVIEW_IMAGE`, `PREVIEW_VIDEO`, `FEATURE_GRAPHIC` |
| `purpose` | Release purpose such as `PRIMARY`, `STORE_LISTING`, `CATALOG_SCREENSHOT`, `STORE_APP_PREVIEW` |
| `url` | HTTP/HTTPS delivery URL for published/store-facing projection; SDKWork-owned source files remain Drive-backed |
| `driveUri` | Stable Drive reference for SDKWork-owned media source when the asset is uploaded or managed by SDKWork |
| `resource` | Optional `MediaResource` snapshot for SDKWork-owned media source |
| `platform` | Backend `PlusPlatform` value |
| `storePlatform` | Optional store value, currently `GOOGLE_PLAY` or `APPLE_APP_STORE` |
| `locale` | BCP 47 locale such as `en-US` or `zh-CN` |
| `deviceClass` | Device class such as `ANDROID_PHONE`, `IPHONE`, `IPAD`, `DESKTOP`, `BROWSER` |
| `displayType` | Store or catalog display profile, such as `IPHONE_6_9` or `DESKTOP_16_10` |
| `width`, `height` | Pixel dimensions |
| `format` | `PNG`, `JPG`, `JPEG`, `WEBP`, `MP4`, or `MOV` |
| `fileSizeBytes` | File size for governance and upload limits |
| `durationSeconds` | Preview video duration |
| `alphaChannel` | Whether the image/video contains transparency |
| `caption` | Short human-readable caption |
| `sortOrder` | Display order inside the same platform/locale group |
| `enabled` | Whether the asset participates in projection |
| `metadata` | Non-secret extra data such as `altText`, `orientation`, codec, safe area |

Rules:

- New SDKWork-owned app media assets should carry `driveUri` or `resource` as the stable source identity.
- `url` is allowed for public store-facing projection and external marketplace URLs, but it must not replace Drive identity for SDKWork-owned uploaded assets.
- Manifest tooling that uploads or imports media must use Drive APIs/SDKs from `DRIVE_SPEC.md`.

## 8. Store Media Rules

The validator encodes the practical parts of current store submission rules:

| Store | Asset | Rule |
| --- | --- | --- |
| Google Play | icon | 512 x 512, 32-bit PNG with alpha channel, 1 MB or smaller |
| Google Play | feature graphic | 1024 x 500 |
| Google Play | screenshots | At least 2 screenshots; PNG/JPEG/WebP, no alpha channel, 320-3840 px per side, max aspect ratio 2:1 |
| Apple App Store | icon | 1024 x 1024, no alpha channel |
| Apple App Store | screenshots | At least 1 screenshot; must match accepted display profiles such as `IPHONE_6_9`, `IPHONE_6_7`, `IPHONE_6_5`, `IPAD_13`, `IPAD_12_9`; `IPHONE_6_9` accepts current 6.9-inch sizes such as 1260 x 2736, 1290 x 2796, and 1320 x 2868 plus landscape variants |
| Apple App Store | preview video | At most 3 videos per platform/displayType/locale; must match accepted preview dimensions for the same display profile; duration is validated when provided |

For Apple screenshots, keep the platform enum as `APP_IOS` and put the device screen class in `displayType`. Do not create platform aliases such as `APP_IOS_IPHONE_6_9`.

## 9. Publish And platform_app Projection

The standard projects to `platform_app` as follows:

| Manifest | platform_app |
| --- | --- |
| `app.name` | `name` |
| `app.description` | `description` |
| `release.currentVersion` or channel latest | `version` |
| `environments[env].accessUrl` | `accessUrl` |
| `publish.status` | `status` |
| `app.appType` | `appType` |
| `media.icons.primary.url` | `iconUrl` |
| `media` | `config.media` |
| `app.officialWebsiteUrl` | `config.standard.officialWebsiteUrl`, `config.publish.officialWebsiteUrl` |
| `publish.platforms` | `platforms.platforms` |
| `publish.installPlatforms` | `installPlatforms.platforms` |
| `publish.installSkill` | `installSkill` |
| `artifacts.installConfig` | `installConfig` |
| `release.notes` | `releaseNotes` |
| `app.identifiers.packageName` | `packageName` |
| `app.identifiers.bundleId` | `bundleId` |
| default market or download landing URL | `storeUrl` |
| latest default direct package URL | `downloadUrl` |
| `publish.stores` | `config.publish.stores` |

Package-level metadata is projected into `installConfig.metadata.packageMetadataById` so `platform_app.installConfig.packages` stays aligned with the backend `AppInstallPackage` object.

## 10. Package Matrix

`artifacts.installConfig.packages[]` is the core distribution matrix.

Required fields:

```json
{
  "id": "windows-x64-standalone-desktop-msi",
  "name": "SDKWork Drive Windows x64 MSI",
  "sourceType": "BINARY_URL",
  "packageFormat": "MSI",
  "platform": "DESKTOP_WINDOWS",
  "architecture": "x64",
  "deploymentProfile": "standalone",
  "runtimeTarget": "desktop",
  "url": "https://cdn.sdkwork.com/...",
  "checksumAlgorithm": "SHA-256",
  "checksum": "...",
  "sizeBytes": 104857600,
  "enabled": true
}
```

Allowed source types:

```text
GIT_REPOSITORY, BINARY_URL, APP_STORE, CONTAINER_IMAGE, MINI_PROGRAM,
WEB_URL, SCRIPT
```

Allowed package formats:

```text
SOURCE_CODE, JAR, WAR, ZIP, TAR_GZ, APK, AAB, IPA, EXE, MSI, DMG,
APPIMAGE, DEB, RPM, DOCKER_IMAGE, MINI_PROGRAM_PACKAGE, OTHER
```

Package ids must follow `NAMING_SPEC.md`:

| Package type | Package id example | Source type | Package format | Platform |
| --- | --- | --- | --- | --- |
| Browser web URL | `web-universal-cloud-browser-web-url` | `WEB_URL` | `OTHER` | `WEB` |
| H5 mobile URL | `h5-universal-cloud-mobile-web-url` | `WEB_URL` | `OTHER` | `H5` |
| WeChat H5 URL | `h5-weixin-universal-cloud-mobile-web-url` | `WEB_URL` | `OTHER` | `H5_WEIXIN` |
| Standalone server archive | `linux-x64-standalone-server-tar-gz` | `BINARY_URL` | `TAR_GZ` | `API` or `OTHER` |
| Standalone or cloud container image | `container-x64-cloud-container-oci` | `CONTAINER_IMAGE` | `DOCKER_IMAGE` | `API` or `OTHER` |
| Windows desktop installer | `windows-x64-standalone-desktop-msi` | `BINARY_URL` | `MSI` | `DESKTOP_WINDOWS` |
| macOS desktop image | `macos-arm64-standalone-desktop-dmg` | `BINARY_URL` | `DMG` | `DESKTOP_MACOS` |
| iPadOS tablet app | `ipados-universal-standalone-tablet-ipa` | `BINARY_URL` or `APP_STORE` | `IPA` or `OTHER` when the store owns the final artifact | `APP_IOS` |
| Android tablet app | `android-tablet-arm64-standalone-tablet-aab` | `BINARY_URL` or `APP_STORE` | `AAB`, `APK`, or `OTHER` when the store owns the final artifact | `APP_ANDROID` |
| Capacitor iOS mobile app | `ios-universal-standalone-mobile-ipa` | `BINARY_URL` or `APP_STORE` | `IPA` or `OTHER` when the store owns the final artifact | `APP_IOS` |
| Capacitor Android mobile app | `android-arm64-standalone-mobile-aab` | `BINARY_URL` or `APP_STORE` | `AAB`, `APK`, or `OTHER` when the store owns the final artifact | `APP_ANDROID` |
| Flutter iOS mobile app | `ios-universal-standalone-mobile-ipa` | `BINARY_URL` or `APP_STORE` | `IPA` or `OTHER` when the store owns the final artifact | `APP_IOS` |
| Flutter Android mobile app | `android-arm64-standalone-mobile-aab` | `BINARY_URL` or `APP_STORE` | `AAB`, `APK`, or `OTHER` when the store owns the final artifact | `APP_ANDROID` |
| Android mobile app bundle | `android-arm64-standalone-mobile-aab` | `BINARY_URL` or `APP_STORE` | `AAB`, `APK`, or `OTHER` when the store owns the final artifact | `APP_ANDROID` |
| iOS mobile app archive | `ios-universal-standalone-mobile-ipa` | `BINARY_URL` or `APP_STORE` | `IPA` or `OTHER` when the store owns the final artifact | `APP_IOS` |
| Harmony mobile app package | `harmony-arm64-standalone-mobile-other` | `BINARY_URL` or `APP_STORE` | `OTHER` until a backend package format enum for Harmony package artifacts is available; metadata must state the HAP/APP artifact kind | `APP_HARMONY` |
| WeChat mini program package | `mp-weixin-universal-cloud-mini-program-mini-program-package` | `MINI_PROGRAM` | `MINI_PROGRAM_PACKAGE` | `MP_WEIXIN` |

The package id profile segment is an artifact taxonomy segment, not
`deploymentProfile` and not `runtime.family`. Standard package profiles are
`browser`, `desktop`, `mobile`, `tablet`, `mini-program`, `server`,
`container`, `worker`, `library`, and test-only profiles such as `test`. If a
manifest stores an explicit package profile in metadata, it `MUST` match the
profile segment parsed from the package id.

Desktop packages must declare `architecture`. Recommended values are `x64`, `arm64`, `universal`, `all`, or `any`.

Container packages must use an immutable OCI reference or digest-bearing URL.

Rules:

- Every deployable package entry `MUST` declare `deploymentProfile` and
  `runtimeTarget`.
- Package `deploymentProfile` values `MUST` be included in
  `runtime.supportedDeploymentProfiles`.
- Package ids for deployable artifacts `MUST` include the deployment profile
  segment as required by `GITHUB_WORKFLOW_SPEC.md`.
- Package metadata `MUST NOT` treat `server`, `container`, `desktop`, mobile,
  tablet, browser, or mini-program as deployment profiles.
- Docker-compatible images use `runtimeTarget = "container"`. `docker` may
  appear in `packageFormat = "DOCKER_IMAGE"` and operator documentation only,
  not as a runtime target or deployment profile.
- Example rows that share a package id represent alternative implementation
  architectures for the same platform/package shape. One manifest `MUST NOT`
  declare duplicate package ids; if one app ships multiple releasable artifacts
  for the same platform, architecture, deployment profile, profile, and format,
  it must use an explicit package variant as defined by `GITHUB_WORKFLOW_SPEC.md`.

### 10.1 Package Runtime Consistency Matrix

Manifest validators `MUST` enforce package consistency between backend
platform enums, SDKWork deployment metadata, and runtime target vocabulary from
`CONFIG_SPEC.md`.

| Package/platform class | Required runtime target | Deployment profile rule | Package profile rule |
| --- | --- | --- | --- |
| `WEB`, `H5`, `H5_WEIXIN` web URL/static package | `browser` | Usually `cloud`; `standalone` requires a documented local/offline/private bundle | `browser` or `mobile` according to root architecture. |
| `DESKTOP_WINDOWS`, `DESKTOP_MACOS`, `DESKTOP_LINUX` | `desktop` | `standalone` | `desktop`. |
| iPadOS/Android tablet native package | `tablet-ipados` or `tablet-android` | `standalone` for packaged tablet apps | `tablet`. |
| Capacitor mobile package | `capacitor-ios` or `capacitor-android` | `standalone` | `mobile`. |
| Flutter mobile package | `flutter-ios` or `flutter-android` | `standalone` | `mobile`. |
| Native Android/iOS/Harmony package | `android-native`, `ios-native`, or `harmony-native` | `standalone` | `mobile`. |
| `MP_*` mini program package | `mini-program` | Usually `cloud`; `standalone` requires documented platform-local/private distribution | `mini-program`. |
| Server archive/service package | `server` | `standalone` or `cloud` depending artifact role | `server`. |
| Container or Docker-compatible image | `container` | `standalone` for single-container units; `cloud` for orchestrated images/bundles | `container`. |
| Test-only package or fixture | `test-runner` | Not production deployable | `test` or equivalent test-only profile. |

Rules:

- The package id profile segment may stay broad, such as `mobile`, while
  `runtimeTarget` and `runtime.framework` carry the exact implementation
  architecture. Do not multiply package id profiles into
  `flutter-mobile`, `capacitor-mobile`, or native-specific variants unless two
  releasable artifacts would otherwise collide.
- A package entry whose platform, package format, runtime target, deployment
  profile, or runtime framework contradicts this matrix `MUST` fail manifest
  validation.

## 11. Latest Download Resolution

Latest download is not a single field. It is resolved from:

```text
release.latest[channel]
release.notes[].packageIds
artifacts.installConfig.packages[]
requested platform
requested architecture
requested Linux distribution
```

Resolution order:

1. Select version from `release.latest[channel]`.
2. Select the matching release note.
3. Restrict packages by `release.notes[].packageIds`.
4. Score exact platform above family platform.
5. Score exact architecture above `universal`, `all`, or `any`.
6. For `DESKTOP_LINUX`, prefer matching `metadata.linux.distro`.
7. Prefer the manifest `defaultPackageId` only when platform and architecture scores do not distinguish candidates.

`platform_app.downloadUrl` is only the default direct-download fallback. It is not the complete cross-platform download catalog.

## 12. Release

Versions must use SemVer three-part form:

```text
MAJOR.MINOR.PATCH[-pre][+build]
```

Release channels:

```text
DEV, INTERNAL, ALPHA, BETA, RC, STABLE, HOTFIX, LTS
```

Each manifest must contain exactly one `release.notes[].current=true` entry.

Each release note must list concrete `packageIds`; every package id must exist in `artifacts.installConfig.packages[]`.

`forceUpdate` and `minSupportedVersion` control update behavior. Use `forceUpdate=true` only for security or protocol-breaking releases.

## 13. Market Releases

Store rollout data lives in `release.notes[].metadata.marketReleases[]`.

```json
{
  "releaseVersion": "3.2.0",
  "marketId": "GOOGLE_PLAY",
  "track": "PRODUCTION",
  "status": "STAGED_ROLLOUT",
  "rolloutPercent": 25,
  "countries": ["US", "CN", "JP"],
  "storeUrl": "https://play.google.com/store/apps/details?id=com.sdkwork.drive",
  "minSupportedVersion": "3.0.0",
  "forceUpdate": false,
  "effectiveFrom": "2026-05-07T00:00:00Z"
}
```

`publish.stores[]` is app-listing readiness metadata. `marketReleases[]` is version-specific rollout metadata.

## 14. Security

Production manifests must set:

```json
{
  "checksumRequired": true,
  "signatureRequired": true,
  "sbomRequired": true
}
```

Direct binary, web package, container, Git, and mini-program packages must carry checksums when `checksumRequired` is true. App Store packages may omit checksum because the store controls the final signed artifact.

Recommended external standards:

| Area | Standard |
| --- | --- |
| Versioning | SemVer 2.0.0 |
| Web app metadata | W3C Web App Manifest |
| Container image | OCI Image Specification |
| SBOM | CycloneDX or SPDX |
| Provenance | SLSA or in-toto |
| Artifact signing | platform signing, Sigstore, GPG, Authenticode, Apple notarization |

## 15. Validation

Run:

```bash
node apps/scripts/validate-sdkwork-app-standard-v3.mjs --config apps/examples/sdkwork.app.config.v3.full.example.json
```

Machine-readable output:

```bash
node apps/scripts/validate-sdkwork-app-standard-v3.mjs --config apps/examples/sdkwork.app.config.v3.full.example.json --json
```

Validate every real app manifest discovered under `apps/`:

```bash
node apps/scripts/initialize-sdkwork-app-standard-v3.mjs --validate-existing
```

Initialize or migrate every real app manifest to v3:

```bash
node apps/scripts/initialize-sdkwork-app-standard-v3.mjs --force
```

Export the registration-ready `platform_app` projection bundle:

```bash
node apps/scripts/initialize-sdkwork-app-standard-v3.mjs --export-platform-app
```

The validator enforces:

- strict standard version and kind
- backend enum names
- SemVer versions
- valid default package id
- package id uniqueness
- valid supported/default deployment profiles
- package deploymentProfile/runtimeTarget consistency
- package runtime target/platform/package format consistency from the matrix in
  this standard
- required media icons, screenshots, and preview assets
- store-grade icon, screenshot, and preview dimensions
- desktop architecture
- client runtime family/framework alignment with the selected PC, H5, Flutter, mini program, Android native, iOS native, or Harmony native root architecture
- mobile identifiers
- H5, Capacitor, Flutter, mini program, Android native, iOS native, and Harmony native package/platform consistency
- release package references
- checksum requirements
- HTTP/HTTPS URLs for binary, store, web, and mini-program delivery
- OCI digest rules for server images
- secret-key rejection in metadata and dev sections
- strict unknown-field rejection to prevent schema drift
- global `app.key` uniqueness across discovered app configs before batch export

Schema and examples must stay aligned with validator behavior:

- `apps/schemas/sdkwork.app.schema.v3.json` `MUST` declare the exact
  `deploymentProfile` and `runtimeTarget` vocabularies used by this standard.
- Manifest examples `MUST` include at least one package target for every
  supported app mode family the example claims: browser, desktop, server,
  container/Docker-compatible, mobile, tablet, mini program, and test-only
  fixtures when present.
- The validator, schema, full example, initializer, and platform_app export
  projection `MUST` be updated in the same change whenever this package matrix
  changes.

## 16. New App Checklist

- [ ] Create `sdkwork.app.config.json` from the v3 full example.
- [ ] Create `.sdkwork/README.md`, `.sdkwork/skills/README.md`, and `.sdkwork/plugins/README.md` for the same app root.
- [ ] Choose one immutable `app.key`.
- [ ] Use backend enum names exactly.
- [ ] Fill platform and package matrix before registration.
- [ ] Choose supported deployment profiles and one default deployment profile.
- [ ] Add primary icon, store icons, screenshots, and preview assets.
- [ ] Add checksums for every direct package.
- [ ] Add package metadata for signing, OS requirements, and server health checks.
- [ ] Add at least one current release note and one default channel.
- [ ] Declare non-empty `backend.accessTokenPermissionScope` for IAM bootstrap.
- [ ] Run the validator.
- [ ] Register the application template and provision the tenant application through `@sdkwork/iam-application-bootstrap` per `IAM_APPLICATION_BOOTSTRAP_SPEC.md`.
- [ ] Expose `admin:bootstrap:app` (or approved equivalent) and keep bootstrap scripts thin.
- [ ] Run `check-iam-application-bootstrap-standard.mjs` before merge.
