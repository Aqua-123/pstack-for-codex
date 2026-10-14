# Prompts worth copying

Replace the placeholders with real paths, skills, and finish checks.

## Understand

- `$poteto-mode read <thread>. restate the underlying issue in your own words, in plain english.`
- `/in-your-own-words <long or messy ask>`
- `/sharpen <your task>`
- `$poteto-mode investigate why <symptom>. give me what we know, what data you used, and your best hypotheses. don't change any code yet.`
- `use $how to understand <subsystem>. then use $why to find out why it broke recently.`
- `/recall my work on <topic> from last week, then read <issue>.`
- `/teach me why you implemented it this way and not <other way>. what did you trade off?`
- `$poteto-mode take over this branch. read the decision log, find what's done, and continue. don't redo finished work.`

## Build

- Bug: `$poteto-mode reproduce <symptom> first. Then fix the root cause and verify the real behavior.`
- Bug in an app: `$poteto-mode reproduce this with $verify-<app>. If it also occurs on the base branch, fix it and provide the required visual proof.`
- Bug with a low-cost test: `$poteto-mode reproduce <bug>. If a low-cost test can exercise it, use $tdd. Then fix and rerun it.`
- Feature: `$poteto-mode add <behavior>. Keep <current output> byte-identical. Verify both.`
- Refactor: `$poteto-mode move <code> into one module with no behavior change. Record the current output first and prove it is unchanged.`
- Performance: `$poteto-mode <operation> takes <time> on <fixture>. Trace it, fix the measured cause, and show before and after results.`

## Design and plan

- `$poteto-mode prototype several options for <feature>. Capture outputs for comparison.`
- `$poteto-mode we need <feature>. Use $architect first and answer open questions with prototypes. Stop for design review before implementation.`
- `$poteto-mode write a short usage tutorial for <new package> first. Then use $teach to compare it with the current package.`
- `$arena give a second opinion on this task and its current approach.`
- `$poteto-mode turn this design into a plan of small, verifiable pull requests. Give each pull request its own checks.`

## Review and ship

- `$interrogate review the complete branch. Do not change code. Report real bugs or regressions, and explain dismissals.`
- `$swarm check each package under <directory> with its check script. Use one read-only worker for each package and return one report.`
- `$poteto-mode prepare the pull request with small ordered commits and evidence in the description.`
- `$poteto-mode babysit pull request <number> until it is merge-ready. Do not merge it.`
- `$poteto-mode land the stack.` Use this only when you authorize the landing action.

## Away and back

- `$poteto-mode keep working in a separate worktree from <base>. Done means <checks>. Keep a decision log. Commits are allowed, but do not push or open a pull request. Stop for credentials or a product decision.`
- `$show-me-your-work summarize the unattended run. Start with the Attention section.`
- `$poteto-mode full autopilot on this queue. Each item is independent.`
- `$poteto-mode process these changes as a stack, but do not land it.`
- `$reflect capture the reusable lesson. Show proposed skill edits for approval.`
- `$bro` restates the last reply in plain language.
