# Gemini CLI Entry

<!-- SDKWORK-GEMINI-SHIM: v1 -->

This file is a compatibility shim for Gemini CLI. The authoritative SDKWork agent entrypoint is `AGENTS.md` in this same directory.

This directory is the workspace `sdkwork-specs/` self-root; use local `README.md`, `SOUL.md`, and `*_SPEC.md` files directly from this directory.

Parent workspace standards alias: `../sdkwork-specs/README.md`.

Read in this order:

1. `AGENTS.md`
2. `SOUL.md`
3. `AGENTS_SPEC.md`
4. Task-specific files from `README.md`

Rules for Gemini CLI:

- Do not duplicate or override SDKWork rules in `GEMINI.md`.
- If `AGENTS.md` or `README.md` is missing, stop and report the unresolved path.
- For code changes, follow `CODE_STYLE_SPEC.md`, `NAMING_SPEC.md`, and only the language/framework spec for touched files.
- Keep tool-specific behavior local to the tool; SDKWork architecture, naming, API, SDK, security, and verification rules come from `AGENTS.md` and `README.md`.
