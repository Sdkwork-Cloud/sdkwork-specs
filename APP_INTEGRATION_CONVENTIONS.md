# App Integration Conventions

- Version: 1.0
- Scope: convention-over-configuration rules for dependency integration, consumer composition, deployment wiring, permission inheritance, and composition resolver contracts
- Related: `APP_COMPOSITION_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, `APP_PERMISSION_COMPOSITION_SPEC.md`, `APP_RUNTIME_TOPOLOGY_SPEC.md`, `APPLICATION_GATEWAY_SPEC.md`, `DEPENDENCY_MANAGEMENT_SPEC.md`, `COMPONENT_SPEC.md`, `ENVIRONMENT_SPEC.md`, `SDK_SPEC.md`, `TEST_SPEC.md`, `MIGRATION_SPEC.md`

This standard defines how SDKWork applications integrate dependency capabilities without re-declaring API contracts, permission catalogs, or mount matrices in every consumer repository. Consumers declare **which** SDK families they compose; dependencies own **how** those capabilities behave.

## 1. Design Goal

Rules:

- Dependencies configure API, auth, permission, and mount semantics once.
- Consumers add a dependency by declaring `sdkDependencies` and native build-tool workspace membership.
- Deployment profiles answer only where traffic terminates, not what permissions a route requires.
- Overrides are explicit, narrow, and optional.
- Missing integration evidence must fail before user traffic, not at first 401/404.
- Each dependency must behave as a composable building block: SDK facade, route manifest, OpenAPI authority, permission manifest, and runtime defaults remain owned by the dependency and are consumed by reference.

Forbidden:

- Consumer-side copies of dependency permission code tables.
- Consumer-side parallel `dependency-api-surfaces.json` as a hand-maintained second source of truth outside an approved migration exception.
- Silent fallback from platform dependency SDK base URLs to application same-origin URLs.
- Treating assembly crate linkage as permission configuration.

## 2. Three-Layer Contract Model

| Layer | Owner | Authority files | Consumer writes |
| --- | --- | --- | --- |
| L0 Dependency integration defaults | Dependency repository / SDK family | SDK family `sdk-manifest.json`, dependency `component.spec.json#integration`, `iam.module.manifest.json`, route `gateway_mount` exports, and application `sdkwork.app.config.json#sdkDependencies` | Nothing |
| L1 Consumer composition | Consumer application core package | `*-core/specs/component.spec.json#contracts.sdkDependencies`, `composition.overrides` | Dependency list + optional overrides only |
| L2 Deployment wiring | Consumer repository | `specs/topology.spec.json`, `configs/topology/*.env` | Profile, bind, public URL only |

Consumer application roots should converge on three authoritative files:

1. `sdkwork.app.config.json` — application identity and bootstrap scope for owned capabilities.
2. `specs/topology.spec.json` — deployment profile and connectivity planes.
3. `*-core/specs/component.spec.json` — `sdkDependencies` and `composition.overrides`.

Everything else must be derived by the composition resolver or owned by the dependency.

## 3. Convention Registry

### 3.1 SDK family naming conventions

| Pattern | Surface | Default prefix | Default credential mode | Default plane |
| --- | --- | --- | --- | --- |
| `sdkwork-<domain>-app-sdk` | `app-api` | `/app/v3/api` | `authenticated-app-api` | `platform` when domain is `iam`; otherwise inherit consumer archetype |
| `sdkwork-<domain>-backend-sdk` | `backend-api` | `/backend/v3/api` | `authenticated-backend-admin` | `platform` when domain is `iam`; otherwise inherit consumer archetype |
| `sdkwork-<domain>-sdk` without `app`/`backend` suffix | `open-api` | from SDK family `sdk-manifest.json#discoverySurface.apiPrefix` | from OpenAPI `security` | `application` |
| `@sdkwork/<domain>-sdk` composed npm alias | same as underlying SDK family workspace | same as underlying family | same as underlying family | same as underlying family |

Resolver rules:

- Prefer SDK family `sdk-manifest.json#discoverySurface` over guessed prefixes.
- Never invent `/app/v3/<domain>` prefixes for IM-style open APIs.
- Product-owned SDK families for the consumer application use the consumer `application.public-ingress` plane unless an explicit override exists.

### 3.2 Runtime mode conventions

| Evidence | Default runtime mode |
| --- | --- |
| Consumer gateway assembly links dependency route crate with public `gateway_mount` under the active `standalone` profile | `same-origin-embedded` |
| Dependency `integration.defaultRuntimeMode=platform-gateway` | `external-via-platform-gateway` |
| Migration-only `dependency-api-surfaces.json` entry with `runtimeIntegration.mode=external-service` and `mountCoverage.status=not-mounted` | `external-via-platform-gateway` |
| No mount export and no platform gateway serving the surface | unresolved; resolver must fail |

Rules:

- `route manifest`, OpenAPI path inventory, and SDK family manifest metadata are not executable mounts.
- Demo/mock/sample routers never satisfy `same-origin-embedded`.
- External platform dependencies must not fall back to application same-origin base URLs.

### 3.3 Permission inheritance conventions

Rules:

- Every `sdkDependencies[]` entry with a resolvable domain `MUST` inherit that dependency's `iam.module.manifest.json` by convention path unless `composition.overrides.permissions` replaces it.
- Consumers `MUST NOT` restate dependency permission codes in local TypeScript tables, menu filters, or duplicated OpenAPI overlays.
- `permissionComposition.moduleCatalogRefs[]` is derived from `sdkDependencies` by default.
- `composition.overrides.permissions[]` is the only supported consumer-side permission delta.

Default manifest resolution:

```text
sdkwork-<domain>-{app,backend}-sdk -> <dependency-repo>/specs/iam.module.manifest.json
                                   or <dependency-repo>/iam/modules/<module>/iam.module.manifest.json
```

When multiple module manifests exist, the dependency `component.spec.json#integration.permissionManifest` wins.

### 3.4 Environment derivation conventions

Rules:

- Product-owned SDK base URLs come from `application.public-ingress`.
- Platform dependency SDK base URLs come from `platform.api-gateway`.
- In browser dev, product-owned SDKs may use same-origin relative prefixes when Vite proxies to application ingress.
- Platform dependency SDKs must use absolute platform gateway origins when `runtimeMode=external-via-platform-gateway`, even in `standalone` profiles.
- `composition.overrides.integrations.<sdkWorkspace>.baseUrl` is the only consumer JSON override for dependency SDK base URLs.

Forbidden:

- Setting `VITE_SDKWORK_APPBASE_*` from application same-origin fallbacks when IAM is `external-via-platform-gateway`.
- Using retired `PORTAL_PUBLIC_SDK_BASE_URL` as the only platform root key in new work.

## 4. Consumer `composition.overrides`

`contracts.composition.overrides` is the single optional override object on consumer core `component.spec.json`.

```json
{
  "contracts": {
    "sdkDependencies": [
      { "workspace": "sdkwork-iam-app-sdk", "surface": "app-api", "credentialMode": "authenticated-app-api" }
    ],
    "composition": {
      "overrides": {
        "integrations": {
          "sdkwork-iam-app-sdk": {
            "baseUrl": "https://tenant.example.com/platform"
          }
        },
        "permissions": [
          {
            "kind": "permission-code-replacement",
            "from": "legacy:console",
            "to": "clawrouter.console.access",
            "scope": "bootstrap-dev-only"
          }
        ]
      }
    }
  }
}
```

Rules:

- `composition.overrides.integrations` may override base URL or runtime mode only.
- `composition.overrides.permissions` follows `APP_PERMISSION_COMPOSITION_SPEC.md` override kinds.
- Absent overrides mean full convention resolution.

## 5. Dependency `integration` Block

Dependency SDK family or repository application components should declare defaults once:

```json
{
  "integration": {
    "defaultConnectivityPlane": "platform",
    "defaultRuntimeMode": "platform-gateway",
    "permissionManifest": "specs/iam.module.manifest.json",
    "mountExport": "crates/sdkwork-routes-iam-app-api::gateway_mount"
  }
}
```

Rules:

- `integration` belongs to the dependency owner, not the consumer.
- Consumers reference the SDK family through `sdkDependencies`; they do not fork the block.
- `mountExport` is evidence only; consumer gateway assembly still owns actual linkage.

## 6. Composition Resolver

The workspace tool `node sdkwork-specs/tools/resolve-composition.mjs --root <repo>` is the machine contract for derived integration facts.

Resolver inputs:

1. consumer core `component.spec.json#contracts.sdkDependencies`
2. `contracts.composition.overrides`
3. `specs/topology.spec.json` active profile
4. dependency SDK family `sdk-manifest.json`, dependency `component.spec.json#integration`, and application `sdkwork.app.config.json#sdkDependencies` when resolvable from workspace siblings
5. migration-only legacy `specs/dependency-api-surfaces.json` when present under an approved exception

Resolver outputs:

```json
{
  "schemaVersion": 1,
  "kind": "sdkwork.composition.resolved",
  "integrations": [],
  "permissions": { "inheritedManifests": [] },
  "env": {},
  "requiresPlatformGatewayProcess": false,
  "issues": []
}
```

Rules:

- Generated output path: `generated/composition.resolved.json` at repository root.
- Hand-editing generated output is forbidden.
- Dev orchestration, bootstrap, and verification must consume resolver output or call the library directly.
- `check-composition-resolver.mjs` fails on unresolved external dependencies, forbidden same-origin fallbacks, and missing permission manifest inheritance.

## 7. Assembly Introduction Workflow

When a consumer adds a dependency through gateway assembly or core `sdkDependencies`:

1. Add sibling workspace path once at repository root.
2. Add Cargo workspace dependency or pnpm `workspace:*` package dependency.
3. Add one `sdkDependencies[]` entry on the relevant core package.
4. Add or derive `contracts.permissionComposition` so dependency module catalogs are inherited by reference.
5. Mount dependency route crates only through gateway assembly or an approved external platform gateway.
6. Run `node sdkwork-specs/tools/resolve-composition.mjs --root <repo>`.
7. Run `node sdkwork-specs/tools/check-composition-resolver.mjs --root <repo>`.
8. Run `node sdkwork-specs/tools/check-permission-composition.mjs --root <repo>`.
9. Run `node sdkwork-specs/tools/check-route-path-collisions.mjs --root <repo>`.

Consumers must not:

- copy dependency permission catalogs;
- add dependency-owned routes to application OpenAPI authorities;
- create a new consumer-side dependency surface manifest;
- hand-author per-SDK `VITE_*` defaults in dev scripts.
- reuse common URL paths that are already registered by another module on the same surface/listener.

## 8. Migration

Transitional rules:

- Existing consumer `specs/dependency-api-surfaces.json` files are resolver input only while an approved migration exception names owner, expiry, and removal plan.
- New and pre-launch consumers must not add hand-maintained `dependency-api-surfaces.json`; they must use `sdkDependencies`, `composition.overrides`, topology specs, and resolver output.
- Legacy files must be removed before release once resolver-generated output covers the same facts. Pre-launch release gates must treat remaining legacy files as blocking debt.
- `PORTAL_PUBLIC_SDK_BASE_URL` remains readable only inside a documented migration window and must not be required for new integrations.

Authority: `MIGRATION_SPEC.md` section on product/application composition migration.

## 9. Verification

Required commands:

```bash
node sdkwork-specs/tools/resolve-composition.mjs --root <repo>
node sdkwork-specs/tools/check-composition-resolver.mjs --root <repo>
node sdkwork-specs/tools/check-permission-composition.mjs --root <repo>
node sdkwork-specs/tools/check-route-path-collisions.mjs --root <repo>
node sdkwork-specs/tools/verify-repo.mjs --root <repo>
node --test sdkwork-specs/tools/check-composition-resolver.test.mjs
```

Acceptance:

- [ ] Consumer adds a dependency with one `sdkDependencies` entry and no permission redeclaration.
- [ ] Resolver derives prefixes, planes, runtime modes, and permission manifest refs.
- [ ] Dev/bootstrap does not silently map platform dependencies to application same-origin URLs.
- [ ] Overrides are explicit and limited to `composition.overrides`.
- [ ] Permission composition and route path collision checks pass for the repository.
- [ ] Legacy consumer dependency surface files trend to zero.
