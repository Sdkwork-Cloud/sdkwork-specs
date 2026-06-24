# Documentation Templates

Scaffolds for repository Canon documentation defined by `DOCUMENTATION_SPEC.md` section 2.

Bootstrap a full `docs/` skeleton into a repository root:

```bash
node ../sdkwork-specs/tools/bootstrap-repository-docs.mjs --root . --application-code <application-code> --owner <team>
```

Migrate retired flat Canon paths into directories:

```bash
node ../sdkwork-specs/tools/migrate-legacy-canon-paths.mjs --root .
```

Canon directories copied by the bootstrap tool:

- `product/prd/PRD.md`
- `product/prd/README.md`
- `architecture/tech/TECH_ARCHITECTURE.md`
- `architecture/tech/README.md`
- `INDEX.yaml`

Ensure root `README.md` and `AGENTS.md` link to `docs/README.md`, `docs/product/prd/PRD.md`, and `docs/architecture/tech/TECH_ARCHITECTURE.md`.
