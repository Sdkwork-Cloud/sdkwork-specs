# SDK Package Naming Standard

<!-- SDKWORK-SPEC: v1 -->

Authority for HTTP TypeScript SDK consumer vs transport naming, physical layout, workspace registration, and machine verification.

Related specs:

- `SDK_SPEC.md` — SDK generation and multi-language naming
- `SDK_WORKSPACE_GENERATION_SPEC.md` — generation layout and ownership boundaries
- `SDK_MANIFEST_SPEC.md` - family-root SDK metadata SSOT
- `APP_SDK_INTEGRATION_SPEC.md` section 9 — application consumer import rules

## 1. Three Naming Roles

Every SDK family `MUST` declare exactly three names. Names are computed from the SDK family directory stem; hand-editing generated transport names to consumer scoped names is forbidden.

| Role | Field | Formula | Example |
| --- | --- | --- | --- |
| SDK family stem | `sdkFamilyStem` | Directory name under `sdks/` | `sdkwork-course-app-sdk`, `clawrouter-app-sdk` |
| Consumer npm name | `packageName` / `consumerPackageName` in family-root `sdk-manifest.json`; `name` in `*-typescript/package.json` | `@sdkwork/<token>` where `<token>` is `sdkFamilyStem` with optional `sdkwork-` prefix removed | `@sdkwork/course-app-sdk` |
| Transport internal id | `transportPackageName` in family-root `sdk-manifest.json`; `name` in `generated/server-openapi/package.json` | `<sdkFamilyStem>-generated-typescript` | `sdkwork-course-app-sdk-generated-typescript` |

### 1.1 File ownership matrix (read this first)

The same SDK family intentionally uses **two different `package.json#name` values in two different directories**. This is not a rename drift; they are different packages:

| Physical file | `name` MUST be | Example | Who may import |
| --- | --- | --- | --- |
| `sdks/<family>/<family>-typescript/package.json` | `@sdkwork/<token>` (consumer) | `@sdkwork/birdcoder-backend-sdk` | Applications, `pnpm-workspace.yaml`, Vite alias, `dependencies` |
| `sdks/<family>/<family>-typescript/generated/server-openapi/package.json` | `<sdkFamilyStem>-generated-typescript` (transport) | `sdkwork-birdcoder-backend-sdk-generated-typescript` | Composed `src/index.ts` re-export only; **never** workspace link or app import |

**Common mistake:** setting both files to `@sdkwork/birdcoder-backend-sdk`, or "fixing" transport back to the consumer name after alignment. That breaks the single consumer package model and causes endless flip-flop between `check-sdk-standard --fix` and `sdkgen generate`.

### 1.2 `sdkgen` CLI semantics (`sdkwork-v3`)

| CLI flag | Meaning | Written to |
| --- | --- | --- |
| `--name` / `--sdk-name` | SDK family stem | `sdkwork-sdk.json#name`, directory layout |
| `--package-name` | **Consumer** npm name (`@sdkwork/*`) | `sdkwork-sdk.json#consumerPackageName` and composed metadata only |
| *(derived, no flag)* | Transport npm name | `generated/server-openapi/package.json#name`, `sdkwork-sdk.json#transportPackageName` |

Rules for `@sdkwork/sdk-generator` / `sdkgen` with `--standard-profile sdkwork-v3`:

- `MUST` derive transport name as `<sdkFamilyStem>-generated-typescript` from `--name`.
- `MUST NOT` copy `--package-name` into `generated/server-openapi/package.json#name`.
- `MUST` emit both `consumerPackageName` and `transportPackageName` in `sdkwork-sdk.json`.
- Legacy `sdkwork-sdk.json#packageName` equals `transportPackageName` for idempotent readers only.

### 1.3 Family-root `sdk-manifest.json` (replaces per-family assembly)

Per-family `.sdkwork-assembly.json` is **retired**. All ownership, discovery, dependency, and naming metadata lives in `sdks/<sdkFamily>/sdk-manifest.json`. See `SDK_MANIFEST_SPEC.md`.

For TypeScript HTTP SDK families in `sdk-manifest.json`:

| Field | Value |
| --- | --- |
| `packageName` / `consumerPackageName` | `@sdkwork/<token>` |
| `transportPackageName` | `<sdkFamilyStem>-generated-typescript` |
| `languages[]` where `language === "typescript"` → `consumerPackageName` | `@sdkwork/<token>` |
| Same entry → `transportPackageName` | `<sdkFamilyStem>-generated-typescript` |

Repo-level `sdks/.sdkwork-assembly.json` (multi-surface generation registry) **MAY** remain; it must not duplicate per-family manifest fields.

Do not overload `languages[].name` with `@sdkwork/*` when `packagePath` points at `generated/server-openapi`.

Rules:

- **B (consumer)** is the only name application, feature, shell, service, bootstrap, contract-test, Vite alias, and workspace `dependencies` code may import.
- **C (transport)** is generator/build ownership only. It `MUST NOT` use an `@sdkwork/` scope. It `MUST NOT` appear in consumer imports or workspace `dependencies`.
- **`sdkwork-sdk.json#packageName`** is retired. Generator output `MUST` use `transportPackageName` and `consumerPackageName` instead.

## 2. Single Consumer Package Model

Each TypeScript SDK family exposes one workspace package:

```text
sdks/<sdkFamilyStem>/
  sdk-manifest.json
  <sdkFamilyStem>-typescript/                 ← workspace package (consumer)
    package.json                              name = @sdkwork/...
    src/index.ts                              composed facade (sdkgen template or approved custom)
    src/domains/index.ts                      optional subpath export
    generated/server-openapi/                 ← NOT a workspace package
      package.json                            name = <sdkFamilyStem>-generated-typescript
      sdkwork-sdk.json                        transportPackageName + consumerPackageName
      src/                                    generator-owned
      custom/                                 generator-owned build scaffold
```

Hard rules:

- `generated/server-openapi/` `MUST NOT` be listed in any `pnpm-workspace.yaml`.
- Consumer `package.json` `exports` `MUST NOT` expose `./generated` to applications. Transport is reachable only through composed `src/**` re-exports.
- Composed `src/**` `MAY` import only from `../generated/**` within the same `*-typescript` root.

Claw Router federated domains:

| Consumer import | Composed entry |
| --- | --- |
| `@sdkwork/clawrouter-app-sdk` | `src/index.ts` |
| `@sdkwork/clawrouter-app-sdk/domains` | `src/domains/index.ts` |
| `@sdkwork/clawrouter-backend-sdk/domains` | `src/domains/index.ts` |

Domain transport lives under `generated/domains/server-openapi/` inside the same family; standalone `*-domain-transport-typescript` roots are forbidden.

## 3. Family-Root `sdk-manifest.json` (SSOT)

Each SDK family `MUST` maintain `sdks/<sdkFamilyStem>/sdk-manifest.json`.

Required naming fields:

```json
{
  "schemaVersion": 1,
  "sdkFamily": "sdkwork-course-app-sdk",
  "packageName": "@sdkwork/course-app-sdk",
  "transportPackageName": "sdkwork-course-app-sdk-generated-typescript",
  "typescript": {
    "composedRoot": "sdkwork-course-app-sdk-typescript",
    "composedEntry": "sdkwork-course-app-sdk-typescript/src/index.ts",
    "transportRoot": "sdkwork-course-app-sdk-typescript/generated/server-openapi",
    "transportEntry": "sdkwork-course-app-sdk-typescript/generated/server-openapi/src/index.ts"
  }
}
```

Existing ownership fields (`sdkOwner`, `apiAuthority`, `generationInputSpec`, `sdkDependencies`, …) remain authoritative per `SDK_WORKSPACE_GENERATION_SPEC.md`.

Tooling, workspace registration, alias maps, and integration contract tests `MUST` read naming paths from this manifest instead of inferring alternate paths.

## 4. Forbidden Legacy Patterns

Permanently forbidden in consumer code and workspace metadata:

- `@sdkwork/commerce-app-sdk`, `@sdkwork/commerce-backend-sdk`
- `@sdkwork/clawrouter-*-domain-transport-sdk`
- `sdkwork-*-generated-typescript` as consumer import
- `@sdk/` or `@sdk/composed/` shorthand aliases
- deep imports into `generated/server-openapi/src/*` from consumers when a composed facade exists
- registering `generated/server-openapi` in `pnpm-workspace.yaml`
- assigning `@sdkwork/*` to generated transport `package.json#name`

## 5. Verification

```bash
node sdkwork-specs/tools/check-sdk-standard.mjs --workspace <workspace-root>
node sdkwork-specs/tools/check-sdk-standard.mjs --workspace <workspace-root> --fix
```

`--fix` materializes missing manifests and composed packages, aligns transport metadata, removes forbidden workspace entries, rewrites consumer alias paths (excluding `sdk-manifest.json` and `sdkwork-sdk.json`), and re-runs consumer import checks. `alignSdkStandard` runs last so manifest transport paths are not overwritten.

Merge gate: `check-sdk-standard` `MUST` report zero violations across `sdkwork-space`.

## 6. Stop flip-flop between `@sdkwork/*` and `*-generated-typescript`

If you see transport `package.json#name` alternating between `@sdkwork/birdcoder-backend-sdk` and `sdkwork-birdcoder-backend-sdk-generated-typescript`, the root cause is almost always:

1. **Legacy generator or script** wrote `--package-name` (consumer) into `generated/server-openapi/package.json#name`.
2. **`check-sdk-standard --fix`** corrected transport back to `*-generated-typescript`.
3. **Regeneration** (`sdkgen`, repo `generate:sdk:*`, or custom family generator) ran again with the legacy behavior.

Permanent fix (in order):

1. Upgrade to workspace `@sdkwork/sdk-generator` with `sdkwork-v3` transport derivation (consumer `--package-name` never becomes transport `package.json#name`).
2. Update repo generate scripts to pass consumer name only as `--package-name`; never hand-set transport `package.json#name`.
3. Run `node sdkwork-specs/tools/check-sdk-standard.mjs --workspace <root> --fix` once after regeneration.
4. Do **not** hand-edit transport `package.json#name` to `@sdkwork/*`; edit OpenAPI/generator/assembly instead and regenerate.

Authority: `APP_SDK_INTEGRATION_SPEC.md` section 9, `SDK_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md`.
