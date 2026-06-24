# SDKWork Application Deploy Standard

- Version: 1.1
- Scope: per-application deployment manifest, install layouts, adaptive Web, Nginx site generation, client package release orchestration
- Related: `SDKWORK_WORKSPACE_SPEC.md`, `NAMING_SPEC.md`, `RUNTIME_DIRECTORY_SPEC.md`, `APP_RUNTIME_TOPOLOGY_SPEC.md`, `DEPLOYMENT_SPEC.md`, `NGINX_SPEC.md`, `APP_MANIFEST_SPEC.md`, `GITHUB_WORKFLOW_SPEC.md`, `RELEASE_SPEC.md`, `CONFIG_SPEC.md`, `API_SPEC.md`, `PNPM_SCRIPT_SPEC.md`

This standard defines the single deployment contract for each SDKWork application repository. Deploy tools and SDKWork Deploy Server consume `deployments/deploy.yaml` together with existing app, topology, workflow, and API contracts.

## 1. Goals

- One file per application: `deployments/deploy.yaml`.
- Convention over configuration: paths, API prefixes, and Nginx filenames are inferred.
- Two production install layouts: source-tree and binary-package.
- Adaptive Web on one domain: desktop browsers use `-pc`; mobile browsers use `-h5`; missing surfaces fall back in plan phase.
- No `routes` section: HTTP API prefixes come from `apiSurfaces` and OpenAPI; WebSocket paths come from topology.
- Nginx is the public data plane: one domain maps to one `{domain}.conf` under `NGINX_SPEC.md`.

## 2. Standard Files

Each deployable application repository MUST contain:

```text
<repository-root>/
  sdkwork.app.config.json
  specs/topology.spec.json
  sdkwork.workflow.json
  deployments/
    deploy.yaml
```

Optional:

```text
deployments/templates/
deployments/nginx/
```

Workspace root `sdkwork-space/` MUST NOT define a workspace-wide deployment manifest.

## 3. Identity

Deploy resolves three identifiers:

| Field | Example (IM) | Authority | Use |
| --- | --- | --- | --- |
| `appId` | `sdkwork-im` | repository directory name and `topology.spec.json` `appId` | source-tree paths, surface directory names |
| `runtimeCode` | `im` | `topology.database.appPrefix` (`SDKWORK_IM` → `im`) | `/etc/sdkwork/`, `/usr/lib/sdkwork/`, `/usr/share/sdkwork/` |
| `app.key` | `chat` | `sdkwork.app.config.json` | PlusApp / IAM only; MUST NOT be used for deploy paths |

Rules:

- `appId` MUST NOT be truncated.
- `appId`, repository directory name, and `topology.appId` MUST match.
- Deploy MUST NOT derive `runtimeCode` from `app.key`.

## 4. Install Layouts

`install.layout` selects production filesystem semantics.

| Layout | Meaning | Web prod root (PC) | Web prod root (H5) | Binary prod path |
| --- | --- | --- | --- | --- |
| `source-tree` | Source install; mirrors repository tree | `/usr/share/sdkwork-space/{appId}/apps/{appId}-pc/dist/` | `/usr/share/sdkwork-space/{appId}/apps/{appId}-h5/dist/` | `/usr/share/sdkwork-space/{appId}/target/release/{binary}` |
| `binary-package` | Traditional package install per `RUNTIME_DIRECTORY_SPEC` | `/usr/share/sdkwork/{runtimeCode}/web/pc/` | `/usr/share/sdkwork/{runtimeCode}/web/h5/` | `/usr/lib/sdkwork/{runtimeCode}/{binary}` |

Development always uses `{repoRoot}` with the same relative paths as the repository.

Config, data, logs for both layouts:

```text
/etc/sdkwork/{runtimeCode}/
/var/lib/sdkwork/{runtimeCode}/
/var/log/sdkwork/{runtimeCode}/
/run/sdkwork/{runtimeCode}/
```

Default inference when `install.layout` is omitted:

- `deployctl plan --dev`: no host install; use `{repoRoot}`.
- workflow targets with `deb` or `rpm`: `binary-package`.
- workflow targets with repository-structure archives: `source-tree`.
- otherwise: `binary-package`.

## 5. Surface Paths

Surface root:

```text
apps/{appId}-{client-arch}/
```

Web dist:

```text
apps/{appId}-{client-arch}/dist/
```

Mini program WeChat output:

```text
apps/{appId}-mini-program/dist/weixin/
```

## 6. Manifest Contract

Format: YAML. Schema: `schemas/sdkwork.deploy.schema.v1.json`. Version field: `version: 1`.

### 6.1 Simple mode

```yaml
version: 1
profile: cloud.split-services.production

install:
  layout: binary-package

expose: []
packages: []
overrides: {}
```

### 6.2 Multi-profile mode

When `profiles` exists, root-level `profile`, `install`, `expose`, `packages`, and `overrides` MUST be absent. Use `defaultProfile`.

```yaml
version: 1
defaultProfile: cloud.split-services.production

profiles:
  cloud.split-services.production:
    install:
      layout: binary-package
    expose: []
    packages: []
    overrides: {}
```

## 7. expose

Each item declares one public domain and one Nginx site file.

### 7.1 Nginx site file

For `domain: im.sdkwork.com`:

```text
/etc/nginx/sites-enabled/sdkwork/im.sdkwork.com.conf
```

Staging default:

```text
target/nginx/sites-enabled/sdkwork/im.sdkwork.com.conf
```

TLS default:

```text
/opt/certs/letsencrypt/live/{certName}/fullchain.pem
/opt/certs/letsencrypt/live/{certName}/privkey.pem
```

### 7.2 Fields

```yaml
expose:
  - domain: im.sdkwork.com
    tls: sdkwork.com
    mode: web+api
    web: adaptive
    aliases: []
    apiPathStyle: full-prefix
```

| Field | Required | Default | Notes |
| --- | --- | --- | --- |
| `domain` | yes | — | full hostname; conf file stem |
| `tls` | no | prod managed; dev `off` | certificate directory name |
| `mode` | no | `web+api` | `web`, `api`, `web+api` |
| `web` | when Web served | — | `adaptive`, `pc`, `h5`, `[pc, h5]` |
| `aliases` | no | `[]` | extra `server_name` values |
| `apiPathStyle` | no | `full-prefix` | only for `mode: api`; `strip-prefix` optional |

Constraints:

- `mode: api` MUST NOT include `web`.
- `mode: web` MUST NOT expose API locations unless overridden in `overrides.nginx`.
- production MUST NOT use `tls: off` unless `overrides.allowInsecureTls: true`.

There is NO `routes` section.

## 8. Adaptive Web

`web: adaptive` or `web: [pc, h5]` selects PC/H5 by request headers on path `/`.

Detection order:

1. `overrides.web.rules`
2. `Sec-CH-UA-Mobile: ?1`
3. default mobile User-Agent regex
4. default desktop → `pc`

Default mobile User-Agent regex:

```text
(Mobile|Android|iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini|MicroMessenger|HuaweiBrowser|HarmonyOS|UCBrowser|Quark)
```

iPad defaults to `pc` unless `overrides.web.tablet: h5`.

Plan folding:

| Repository state | web mode |
| --- | --- |
| pc and h5 exist | `adaptive` |
| pc only | `collapse-pc` |
| h5 only | `collapse-h5` |
| neither | validate FAIL |

Nginx adaptive rendering MUST use snippet `include` files. Variable `root` with SPA `try_files` in a single location is forbidden in v1.

Surfaces referenced by `expose.web` are built and deployed automatically and MUST NOT appear in `packages`.

## 9. API and WebSocket Inference

API location prefixes are inferred in this order:

1. `sdkwork.app.config.json` `apiSurfaces[].apiPrefix`
2. `apis/**` OpenAPI path prefixes

WebSocket path:

- `topology.surfaces.application.public-ingress.websocketPath`
- emitted only on domains mapped to `application.public-ingress`

### 9.1 Per-domain API surfaces

When `topology.cloudPublicHosts` maps a public hostname to a topology surface, Nginx MUST filter API locations to that surface:

| `cloudPublicHosts` surface | Allowed `apiSurfaces[].kind` |
| --- | --- |
| `application.public-ingress` | `app-api`, `backend-api`, `open-api`, `unknown` |
| `application.app-http` | `app-api` |
| `application.backend-http` | `backend-api` |
| `operations.control-ingress` | `backend-api` |
| `platform.api-gateway` | `open-api`, `platform-api`, `unknown` |

When no mapping exists for a domain, tools default to `application.public-ingress`.

### 9.2 Upstream resolution

Upstream bind resolution order for each topology surface:

1. `overrides.proxy.upstreams[surfaceId]`
2. profile env value for `topology.surfaces[surfaceId].bindEnv`
3. `overrides.proxy.bind` (public ingress only)
4. `topology.defaults.gatewayBind`

Rules:

- Nginx MUST proxy to resolved upstream listen addresses, not filesystem binary paths.
- Bind values such as `0.0.0.0:3900` MUST normalize to `http://127.0.0.1:3900` for `proxy_pass`.
- Tools MUST NOT emit placeholder upstreams such as `127.0.0.1:8080`.

Health locations SHOULD be generated when upstream exposes `/healthz` and `/readyz`.

## 10. packages

Declares client artifacts not hosted by `expose.web`.

```yaml
packages:
  - flutter-mobile
  - harmony-mobile
  - mini-program-weixin
  - desktop-windows
  - desktop-macos
```

Allowed names:

| Name | Repository focus |
| --- | --- |
| `flutter-mobile` | `apps/{appId}-flutter-mobile/` |
| `harmony-mobile` | `apps/{appId}-harmony-mobile/` |
| `android-mobile` | `apps/{appId}-android-mobile/` |
| `ios-mobile` | `apps/{appId}-ios-mobile/` |
| `mini-program-weixin` | `apps/{appId}-mini-program/dist/weixin/` |
| `mini-program-alipay` | `apps/{appId}-mini-program/dist/alipay/` |
| `desktop-windows` | workflow desktop target |
| `desktop-macos` | workflow desktop target |
| `desktop-linux` | workflow desktop target |

`pc` and `h5` MUST NOT appear in `packages`.

Package IDs, signing, and workflow targets come from `sdkwork.app.config.json` and `sdkwork.workflow.json`.

## 11. overrides

Optional exceptions only:

```yaml
overrides:
  allowInsecureTls: false
  install:
    layout: source-tree
  proxy:
    bind: 127.0.0.1:18079
    upstreams:
      application: http://127.0.0.1:18079
      platform: http://127.0.0.1:3900
  web:
    tablet: pc
    rules:
      - userAgentRegex: iPad
        surface: h5
    cdn:
      enabled: false
  nginx:
    siteFile: /etc/nginx/sites-enabled/sdkwork/im.sdkwork.com.conf
    clientMaxBodySize: 1100m
    snippets: []
  packages:
    flutter-mobile:
      skip: true
```

Secrets MUST use `secret://` references. Plaintext secrets in deploy.yaml are forbidden.

## 12. Tooling

Repositories SHOULD expose:

```text
deploy:validate
deploy:plan
deploy:nginx:render
```

Implementation:

```text
node ../sdkwork-specs/tools/deployctl.mjs validate --root .
node ../sdkwork-specs/tools/deployctl.mjs plan --root . [--dev]
node ../sdkwork-specs/tools/deployctl.mjs nginx render --root . --domain <domain>
node ../sdkwork-specs/tools/deployctl.mjs nginx apply --root . --domain <domain>
node ../sdkwork-specs/tools/deployctl.mjs init --root .
```

Production nginx reload is gated by `SDKWORK_DEPLOY_NGINX_RELOAD=true` and uses `SDKWORK_DEPLOY_NGINX_RELOAD_CMD` (default `nginx -s reload`).

### 12.1 Deploy Server orchestration

Deploy API Server publishes nginx through site `runtimeConfig.sdkworkDeploy` bindings:

```json
{
  "sdkworkDeploy": {
    "appRoot": "/usr/share/sdkwork-space/sdkwork-im",
    "domain": "im.sdkwork.com",
    "profileId": "cloud.split-services.production",
    "siteFile": "/etc/nginx/sites-enabled/sdkwork/im.sdkwork.com.conf"
  }
}
```

Rules:

- `appRoot` MUST contain `deployments/deploy.yaml`.
- `domain` MAY be omitted when the site primary domain is registered in Deploy DB.
- `POST /backend/v3/api/nginx/configs/{configId}/deploy` MUST validate config content, then:
  1. when orchestration is enabled (default), run `deployctl nginx apply --root {appRoot} --domain {domain}`
  2. otherwise write validated DB content to `{siteFile}` with backup and optional reload
- Orchestration is disabled only when `SDKWORK_DEPLOY_ORCHESTRATE_NGINX=false`.
- `deployctl` path resolves from `SDKWORK_DEPLOY_DEPLOYCTL`, `SDKWORK_DEPLOY_SPEC_ROOT`, or `{SDKWORK_DEPLOY_APP_ROOT}/../sdkwork-specs/tools/deployctl.mjs`.

Nginx lifecycle:

```text
plan → render → nginx -t → deploy → reload → health-check → rollback previous conf on failure
```

## 13. Validation Rules

| Id | Rule |
| --- | --- |
| V1 | `appId` equals repository directory and topology `appId` |
| V2 | `runtimeCode` derivable from topology |
| V3 | `profiles` and root-level expose/packages are mutually exclusive |
| V4 | `mode: api` forbids `web` |
| V5 | adaptive requires pc or h5 surface root |
| V6 | `install.layout` is `source-tree` or `binary-package` |
| V7 | binary-package web roots MUST NOT use `/usr/share/sdkwork-space/` |
| V8 | source-tree web roots MUST NOT use `/usr/share/sdkwork/{runtimeCode}/web/` |
| V9 | site file equals `/etc/nginx/sites-enabled/sdkwork/{domain}.conf` |
| V10 | packages MUST NOT list `pc` or `h5` |
| V11 | production tls MUST NOT be `off` without `overrides.allowInsecureTls` |
| V12 | no plaintext secrets |
| V13 | apiSurfaces/OpenAPI prefix conflict fails validation |
| V14 | per-domain API locations MUST match `cloudPublicHosts` surface filter |
| V15 | nginx render MUST resolve upstreams from profile env or topology defaults; no placeholder ports |
| V16 | deploy manifest MUST validate against `schemas/sdkwork.deploy.schema.v1.json` structural rules |

## 14. Examples

See `examples/deploy/`.

## 15. Acceptance Checklist

- [x] `deployments/deploy.yaml` exists for deployable applications.
- [x] `deploy:validate` passes in `pnpm check`.
- [x] `deployctl plan` prints appId, runtimeCode, layout, nginx site file, web roots, upstreams.
- [x] generated nginx uses `/etc/nginx/sites-enabled/sdkwork/{domain}.conf`.
- [x] adaptive web uses snippet includes, not variable root SPA fallback.
- [x] source-tree and binary-package roots match this spec.
- [x] multi-domain API filtering follows `cloudPublicHosts`.
- [x] nginx validate/reload hooks are security-gated for production operations.
- [x] Deploy API Server orchestrates remote `nginx apply` across registered application roots.
