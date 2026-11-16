# Route work through `$poteto-mode`

`$poteto-mode` matches the request to one of 23 playbooks and tracks the selected steps. It invokes other skills only when those steps need them.

![A dispatcher routes robots toward bug fix, feature, and investigation gates.](./images/router.jpg)

## Give it an outcome

State the goal, known constraints, and a checkable finish condition:

```text
$poteto-mode users receive two notifications after a retry. Reproduce it, fix the root cause, and verify one notification remains.
```

Use `new task` when the subject changes:

```text
$poteto-mode new task. Explain why the cache survives logout. Do not edit code.
```

The second prompt routes to a read-only investigation because the authority boundary forbids edits.

A useful prompt has an outcome, a finish check, relevant evidence, constraints, and a clear scope. You do not need to prescribe the implementation. If the source report is noisy, ask Poteto Mode to restate the issue before it proposes work. For the restatement alone, with no playbook, invoke [`$in-your-own-words`](../../skills/in-your-own-words/SKILL.md). It restates what the agent thinks your goals are and what problem you are trying to solve.

When you are unsure whether a prompt is aimed right, invoke [`$sharpen`](../../skills/sharpen/SKILL.md) on it before you send it:

```text
$sharpen write a migration guide for the v2 config format.
```

The agent says what a top professional would do that you did not ask for, the rawest material they would start from, the methods and tools they would use, and what other than you or the agent would show the result is right. Then it rewrites your prompt to ask for exactly that, deeper but not bigger. The rewrite asks the agent to prototype any choice an experiment can settle, and it leaves product and preference choices to you. `$sharpen` does not do the task. Read the rewrite, then send it, for example with `$poteto-mode`.

Do not list skills in order in your prompt, such as "use `$architect`, then `$arena`, then `$interrogate`". The playbook already sequences them. Name a skill only to override a specific choice.

Short follow-ups such as `continue` work when the active task is clear. Use `new task` when the subject changes. Use `$poteto-help` when you want a prompt drafted without starting the task.

## Understand session state

Start the prompt with `$poteto-mode`, `$pstack-for-codex:poteto-mode`, or the Codex skill chip. The chip serializes as a Markdown link with either exact label and a normalized absolute local path ending in `/skills/poteto-mode/SKILL.md`. Quoted examples, casual mentions, and links to other skills do not activate the mode.

The explicit invocation always applies to the current turn. Trusted hooks can persist Poteto Mode for later turns in the same session. The hook state is keyed by session and project, expires, and does not authorize new actions.

When hook trust or stable session context is unavailable, the mode reports `current-turn-only`. Invoke `$poteto-mode` again on a later turn. Do not assume that a prior activation survived a resume or compaction without a healthy receipt.

Disable the session state with:

```text
disable $poteto-mode
```

## Isolate parallel writers

Codex agents can share a filesystem. Before parallel writes, give each agent exclusive files, a separate worktree, or a separate output directory. If none is safe, ask Poteto Mode to run serially.

```text
$poteto-mode compare two parser designs. Put each disposable candidate in its own output directory. Do not edit production code.
```

The parent integrates the winner and runs the authoritative checks.

## Expect visible fallbacks

A playbook declares what happens when a custom profile, subagent, connector, control tool, or history API is unavailable. The common fallbacks are sequential parent work, a generic agent with a portable prompt, a labeled partial result, or a closed stop. Poteto Mode does not silently drop a lane.

Next: [Understand the code](./03-understand.md).

Use [`$poteto-help`](../../skills/poteto-help/SKILL.md) for a usage question. Cross-turn activation requires the trusted session receipt. Installation and casual mentions do not activate the mode.
