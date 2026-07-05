# SDK Family Manifest Standard

<!-- SDKWORK-SPEC: v1 -->

Authority for the single machine-readable contract at `sdks/<sdkFamily>/sdk-manifest.json`.

Related:

- `SDK_PACKAGE_NAMING_SPEC.md` — consumer vs transport naming
- `SDK_WORKSPACE_GENERATION_SPEC.md` — workspace layout and generation workflow
- `schemas/SDK_MANIFEST.schema.json` — JSON schema

## 1. Single SSOT per SDK family

Each HTTP/RPC SDK family **MUST** maintain one family-root manifest:

```text
sdks/<sdkFamilyStem>/sdk-manifest.json
```

This file is the **only** per-family metadata SSOT for:

- SDK naming (`packageName`, `transportPackageName`, `typescript.*`)
- Ownership (`sdkOwner`, `apiAuthority`, `generationInputSpec`, `authoritySpec`)
- Discovery (`discoverySurface`)
- Cross-SDK dependencies (`sdkDependencies`)
- Multi-language layout (`languages[]`)

Per-family `.sdkwork-assembly.json` is **retired**. Global ownership checks and composition resolution **MUST** read `sdk-manifest.json` first.

## 2. Repo-level assembly registry (exception)

Repository roots **MAY** keep `sdks/.sdkwork-assembly.json` when it orchestrates multiple surfaces for generation scripts (for example BirdCoder `surfaces[]`). That file is a **generation registry**, not a per-family SSOT, and **MUST NOT** duplicate fields already present in each family's `sdk-manifest.json`.

## 3. Required fields

### 3.1 Naming (TypeScript HTTP)

See `SDK_PACKAGE_NAMING_SPEC.md`. Required:

- `packageName` — `@sdkwork/<token>` (consumer)
- `transportPackageName` — `<sdkFamilyStem>-generated-typescript`
- `typescript.composedRoot`, `composedEntry`, `transportRoot`, `transportEntry`

### 3.2 Ownership

Required for families with `openapi/*.sdkgen.*` or `generated/server-openapi`:

- `sdkOwner`
- `apiAuthority`
- `generationInputSpec` (or `authoritySpec` for legacy readers)
- `discoverySurface` when the family exposes HTTP APIs
- `sdkDependencies` — explicit array (`[]` when none)

### 3.3 Languages

`languages[]` entries **MUST** use explicit naming fields for TypeScript:

| Field | TypeScript value |
| --- | --- |
| `consumerPackageName` | `@sdkwork/<token>` |
| `transportPackageName` | `<sdkFamilyStem>-generated-typescript` |

Do not overload `languages[].name` with `@sdkwork/*` when `packagePath` points at `generated/server-openapi`.

## 4. Migration from `.sdkwork-assembly.json`

```bash
node sdkwork-specs/tools/check-sdk-standard.mjs --workspace <root> --fix
```

`--fix` merges per-family assembly into manifest, normalizes TypeScript language naming, and deletes redundant per-family `.sdkwork-assembly.json` when ownership fields are present in the manifest.

## 5. Verification

```bash
node sdkwork-specs/tools/check-sdk-standard.mjs --workspace <root>
```

Violations:

- `missing-manifest-ownership` — generated family without ownership in manifest
- `legacy-per-family-assembly` — per-family `.sdkwork-assembly.json` still present after manifest merge
- Naming/layout violations from `SDK_PACKAGE_NAMING_SPEC.md`
