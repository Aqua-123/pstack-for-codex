# Refresh pstack to 0.15.42

Plugin 0.5.0 derives from pstack 0.15.42 at `bf0c7cd80abdbf7fe47b634978a7d1b4071f71a7`. The baseline is plugin 0.4.0 at pstack 0.15.24.

The refresh accounts for 560 upstream files: 412 additions, 70 changes, and 21 deletions. Of the additions, 408 are the `statechart` skill, 405 of them byte-identical. The other additions are three explicit-only skills, `create-formal-verification-skill`, `maintain-formal-verification-skill`, and `ketchup-video`, plus a Claude Code harness adapter recorded as provenance only.

## Decisions

- Remove the orch scripts with upstream. Orchestrate runs on supported Codex subagent surfaces, keeps program state in a notes file and decision trail, and allows one bounded retry per unit.
- Collapse `how`, `why`, and `interrogate` to one file each, as upstream did. Also delete the derived-only `how` critique files that upstream critique mode had left behind.
- Do not port host model defaults, Claude Code install text, or the setup defaults marker. Codex roles remain profile-based, and a configured model is a request, not evidence.
- Ship the statechart compiler and corpus unchanged so upstream tests run as written. Only `SKILL.md`, `references/render.md`, and the package name are adapted. The skill stops and reports checks as not run when Java, TLC, a TypeScript runtime, or network for the first install is missing.
- Leave `worktree-audit.sh` unchanged, because the upstream fix targets host transcript timestamps that the derived script never reads.

## Verification

`npm run verify:offline` passes. It covers the Node contracts, Bun behavior tests, the statechart offline lane, strict TypeScript checks, and the compatibility report. The statechart lane has 195 passing tests and 70 tests that skip without `TLA2TOOLS`. The render test needs network and is outside the offline gate.

`node scripts/import-upstream.mjs --source /path/to/plugins/pstack --verify-lock --dry-run` verifies 560 files.

Not run: the installed-plugin smoke (`npm run test:installed`), which needs the `codex` CLI. Also not run: the TLC-backed statechart tests and the statechart typecheck, which reports four errors in unchanged upstream code.
