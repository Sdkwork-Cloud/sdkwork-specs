# Developer Guide

1. Read [docs/README.md](../../README.md) and root [README.md](../../../README.md).
2. Read the Canon documents [product/prd/PRD.md](../../product/prd/PRD.md) and [architecture/tech/TECH_ARCHITECTURE.md](../../architecture/tech/TECH_ARCHITECTURE.md).
3. For new repositories, scaffold documentation with `node tools/bootstrap-repository-docs.mjs --root <repo>`.
4. Migrate retired flat Canon paths with `node tools/migrate-legacy-canon-paths.mjs --root <repo>`.
4. Update the affected `*_SPEC.md` files and validators under `tools/`.
5. Verify with `node tools/check-repository-docs-standard.mjs --root .`.
