# Refresh pstack for Codex to upstream 0.15.10

The fork now provides 52 explicit-only skills. Upstream pstack 0.15.10 adds workflow help, recurring-error correction, benchmark checks, and Explain the Number. The refresh also strengthens verification rounds and preserves Codex authority, profiles, hooks, and installation behavior.

## Workflow and acceptance

Figure it out governs this mechanical migration. The authoring-a-skill playbook and skill-creator govern modified skill prose. Architecture exploration is skipped because the inventory and compatibility table already define the migration shape. Independent parent review and release checks follow implementation.

- [x] Read the Principles section of poteto-mode in full.
- [x] Phase A. Frame the falsifiable predicate and quantify the source delta.
- [x] Phase B. Design the workflow around the existing inventory and validation tools.
- [x] Phase C. Run the loop on reviewed source changes and focused executable checks.
- [x] Phase D. Keep the audit trail with evidence pointers.
- [x] Phase E. Verify the local artifact and hand back for parent review.

The authoring steps remain explicit.

1. Use the skill-creator skill for authoring SKILL.md files.
2. Validate the skill. Frontmatter has name and description, referenced files exist, and cross-skill links resolve.
3. Test cases if structural. Skip if subjective.
4. Run Opening a PR. The parent owns publication for this run.

The acceptance predicate requires 162 exact source inventory entries, one disposition for every source delta, all 52 skills discoverable with Codex metadata, and passing offline release checks. The parent separately verifies clean installation, the actual machine upgrade, and representative installed skill behavior. Local contract checks do not prove every possible model response.

## Data and throughput

The data shape is the existing source path inventory plus compatibility entries. Each changed path records its previous and current hash, disposition, rationale, invariant, and validation. There are 52 modified paths and four additions. There are no deletions or renames.

Source diffs against the previous locked SHA supply the changes. Clean source hunks merge into existing Codex adaptations. Conflicting host assumptions receive a semantic port or an explicit retained-policy disposition. One writer owns this worktree. The parent owns authoritative review, commits, push, pull request, and machine configuration.

The throughput checkpoint uses the existing import and compatibility tools rather than introducing another refresh framework. The changed plan checker and new refresh tests are rerunnable proof. Bulk provenance comes from inventories; a maintainer reviews the 56 path decisions in the generated compatibility report.

## Decisions that affect behavior

- Model the Domain keeps refresh state in the existing inventory and disposition table instead of scattered flags.
- Build the Lever uses the plan checker, compatibility generator, and executable refresh tests as reviewable commands.
- Prove It Works requires exact candidate hashes and exercises the plan checker and log helper through their CLI interfaces.
- Upstream model-family defaults remain replaced by validated Codex model and effort pairs. Requested budget names do not prove entitlement.
- Every skill remains explicit-only. Help answers usage questions without starting work. Correction does not authorize a repository-wide sweep merely because a user points out one mistake.
- PR and stack operations use supported capabilities. Graphite is optional. Shipping prepares and lands only the current verified bottom PR, then reconciles membership before continuing.
- Code-ready rounds now require live proof, gates, and at least two focused independent review lanes. Fix rounds preserve the merge base and carry every proven defect forward.
- Shipping may retain a lane only after comparing two old builds with one new build and judging each difference. Dev-server results always rerun.
- Authorized hourly audits record every tick and message only previously unreported tracked changes. Replacement remains bounded by the Codex runtime contract.
- Audit logs preserve prior rows and use run boundaries. Corrections supersede rows instead of erasing them.

## Rerun the evidence

From the repository root, run:

```bash
npm run verify:offline
node --test tests/upstream-refresh.test.mjs
node scripts/import-upstream.mjs \
  --source https://github.com/cursor/plugins \
  --subdirectory pstack \
  --commit 4e5b1cf2ccb0ea3716f08c8ee0a5856b5ab93536 \
  --verify-lock --dry-run
```

The offline result is 99 Node tests, 54 Bun tests, strict TypeScript checks, and a clean compatibility report. Focused tests exercise concrete and inherited model lane names, reject missing names and stale audit cadence, initialize an empty log, preserve rows on append, and verify all four added paths against the exact 56-path delta.

The [compatibility report](../../compatibility/report.md) records all source dispositions. The [decision trail](./2026-10-05-pstack-upstream-refresh-decisions.tsv) records this implementation run. Parent review and installed machine evidence remain separate receipts.
