# Prompting pstack

A good prompt states the outcome and the evidence that proves completion. It does not need a long method.

## Start with five fields

- Goal: what must become true.
- Finish check: the command, test, screenshot, stored value, or observed behavior that proves the goal.
- Known evidence: symptoms, paths, issue links, logs, or measurements that already matter.
- Constraints: behavior that must stay unchanged, allowed writes, and actions that need separate authority.
- Scope: the repository, branch, worktree, or artifact to use.

Use only the fields that improve the task. A short prompt with a strong finish check is better than a long prompt that prescribes an unverified solution.

## Load context before work

Ask the agent to read the relevant issue, task, decision log, or branch state. Ask it to restate the problem in its own words when the source is noisy. Old notes are evidence, not current truth, so the agent must compare them with the current artifact.

For investigation only, say that no code must change. For a resumed task, say what is complete and tell the agent not to repeat finished work.

## Design before planning

For uncertain product or interface work, ask for small prototypes or structurally different options first. Compare real outputs where possible. Ask for a plan only after the design is stable. Each plan step must end with a check.

## Follow up with short prompts

When the active task is clear, `do it`, `continue`, and `keep going until done` can be complete prompts. Start with `new task` when the subject changes. Invoke `$poteto-mode` again when no trusted session receipt proves that it remains active.

## Before you step away

- Give a finish condition that each iteration can check.
- Name the base branch and request a separate worktree when isolation matters.
- State whether commits are allowed. A request to continue does not authorize a push, pull request, merge, deployment, or external message.
- Request a decision log when you want an audit trail.
- Give a stop condition for credentials, product decisions, or repeated failure.
- Request a durable goal or thread heartbeat only when you want that lifecycle.

## Steer in one line

- Restate the goal: `The goal is to reproduce the bug. Do not fix it yet.`
- Name the proof: `Show the real command output, not only the build result.`
- Name the principle: `Apply Prove It Works.`

The next reply must state which decision changed because of the correction.
