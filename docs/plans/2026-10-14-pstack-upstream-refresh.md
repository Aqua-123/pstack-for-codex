# Refresh pstack to 0.15.24

Plugin 0.4.0 derives from pstack 0.15.24 at `1e5c90a4b6f249917bd21fe361b3a2a7deb741b8`. The baseline is the merged Codex plugin 0.3.1, which already incorporates both earlier refreshes.

The refresh accounts for 169 upstream files. There are 82 modified paths and five additions. Three additions are explicit-only skills, `in-your-own-words`, `ketchup`, and `sharpen`. The other additions are a host manifest mapped to the Codex manifest and plan-fence regression tests.

## Decisions

- Build the Lever selects three-way source comparison and the existing provenance importer. The compatibility ledger records every delta and its disposition.
- Prove It Works requires the full release gate, source hash verification, clean installation and teardown, and comparison of the active installed artifact against the reviewed commit.
- Preserve the Codex runtime contract, supported task-history reads, parent-owned external effects, profile inheritance, and explicit-only skill metadata. Upstream host instructions do not establish Codex capabilities.
- Keep forge-neutral stack discovery. Request up to 1000 PR rows and reject a full result at that bound rather than silently recording an incomplete stack. This is a bounded completeness check, not unbounded pagination.
- Reject incomplete or repeated review-thread cursors rather than omit unresolved threads or loop indefinitely.
- Use a 30-second Bun test timeout. The new forge fixture exercises multiple subprocesses and exceeded five seconds on a busy machine. Assertions and coverage remain intact.

## Verification

Run `npm run verify:release` for the Node contracts, Bun behavior tests, strict TypeScript checks, compatibility report, and clean installed-plugin smoke test.

Run `node scripts/import-upstream.mjs --source /path/to/plugins/pstack --verify-lock --dry-run` against the exact source checkout. It must verify 169 files.

Independent read-only review found the pagination gaps and merge leftovers above. The parent fixed them and reran the authoritative release checks. Comment review removed six lines across three blocks and made the local trunk fallback explicit in its function name.

Machine installation is separate from repository validation. Inspect every active Codex configuration and installed profile receipt. Historical repository checkouts and recovery backups are not active installations.
