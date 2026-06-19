# SDKWork Standards Tools

This directory contains executable validators for SDKWork standards.

Rules:

- Tools in this directory are standards-owned and product-neutral.
- Application repositories may call these tools through thin `package.json` scripts.
- `check-pnpm-script-standard.mjs` validates root scripts, package-local
  script names and command values, default `dev:browser`/`dev:desktop`
  PostgreSQL + `unified-process` + standalone resolution, action-first runtime
  target command names, retired deployment flags, and active Markdown/AGENTS
  plus command-bearing JSON examples against `PNPM_SCRIPT_SPEC.md`.
- `check-agent-workflow-standard.mjs` validates repository/application
  `AGENTS.md` dynamic progressive loading, compatibility shims, relative
  `sdkwork-specs` links, `sdkwork.workflow.json` package target metadata, and
  thin `.github/workflows/package.yml` reusable workflow integration against
  `AGENTS_SPEC.md` and `GITHUB_WORKFLOW_SPEC.md`.
- Tools must not embed application-specific secrets, local paths, or product behavior.
