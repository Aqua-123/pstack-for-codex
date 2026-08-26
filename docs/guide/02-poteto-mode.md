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

## Understand session state

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
