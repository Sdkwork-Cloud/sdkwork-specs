# SDKWork Standards Documentation

## Audience Routing

| I am… | Read first | Then read |
| --- | --- | --- |
| Product or governance owner | [product/prd/PRD.md](product/prd/PRD.md) | [product/requirements/](product/requirements/) |
| Architect or standards maintainer | [architecture/tech/TECH_ARCHITECTURE.md](architecture/tech/TECH_ARCHITECTURE.md) | [architecture/decisions/](architecture/decisions/) |
| Standards contributor | [guides/developer/README.md](guides/developer/README.md) | root `README.md`, affected `*_SPEC.md` files |
| Release or governance reviewer | [architecture/tech/TECH_ARCHITECTURE.md](architecture/tech/TECH_ARCHITECTURE.md) | [engineering/reviews/](engineering/reviews/), [changelogs/](changelogs/) |
| Agent | [../AGENTS.md](../AGENTS.md) | [INDEX.yaml](INDEX.yaml), task matrix in [../README.md](../README.md) |

## Canon Documents

| Document | Path |
| --- | --- |
| Product and governance PRD | [product/prd/PRD.md](product/prd/PRD.md) |
| Technical architecture | [architecture/tech/TECH_ARCHITECTURE.md](architecture/tech/TECH_ARCHITECTURE.md) |

## Purpose

Human-readable documentation for the canonical `sdkwork-specs` standards repository. Machine rules remain in root `*_SPEC.md` files; this tree explains governance goals, standards architecture, and contributor workflows.

## Owner

SDKWork standards maintainers.

## Allowed Content

- Governance PRD, standards architecture, requirement records, ADRs, contributor guides, changelog evidence, and archived design notes.

## Forbidden Content

- Secrets, private customer data, copied root spec bodies that would drift from `*_SPEC.md`, or runtime state.

## Related Specs

- `DOCUMENTATION_SPEC.md`
- `SDKWORK_WORKSPACE_SPEC.md`
- `REQUIREMENTS_SPEC.md`
- `ARCHITECTURE_DECISION_SPEC.md`

## Verification

```bash
node tools/check-repository-docs-standard.mjs --root .
node tools/migrate-legacy-canon-paths.mjs --root .
```
