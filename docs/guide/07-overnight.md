# Run authorized overnight work

An overnight request changes the lifecycle of a task. It does not expand authority.

![A robot tends a workbench at night while a written checklist stays visible.](./images/overnight.jpg)

## Write an overnight contract

Name the goal, finish condition, checkout, allowed writes, and stop condition:

```text
$poteto-mode keep working overnight in a fresh worktree from <base>. Migrate every caller to the new parser. Done means the old-call scan is empty and the full test suite passes. Do not push, open a pull request, or merge. Stop on an external credential or product decision.
```

The worktree keeps the run separate from other checkouts. A decision log makes the morning review shorter:

```text
$show-me-your-work record the decisions for this run.
```

## Use supported lifecycle objects

Codex may use a durable goal and a thread heartbeat only because the request asks for continued overnight work. The workflow checkpoints progress through supported task tools. It does not keep a shell process alive with a sleep loop.

A scheduled task, recurring monitor, or separate user-owned task still needs an explicit request for that object. The phrase "overnight" does not authorize an external message, pull request, merge, deployment, or new repository.

## Audit the result

In the morning, inspect:

1. the finish-condition evidence.
2. the integrated diff and current branch.
3. `decisions.tsv` if the run created one.
4. the agent receipt, including missing lanes, fallbacks, and observed or unverified model pairs.
5. remaining processes, worktrees, and scratch outputs.

Treat every child report as a claim until the parent checks the artifact.

## Configure Benny separately

Benny is a polling automation pack, not an overnight shortcut. Use `$setup-benny` only when you intend to configure Slack, tracker, repository, control-adapter, and canonical-state integration.

Setup does not activate Benny. It can reconcile exactly two `PAUSED` project automations only after explicit authority. A later request is required to activate them after the six canaries pass. Polling may add up to one schedule interval of latency, and overlap windows can reread events. Destination idempotency prevents duplicate effects.

Next: [Steer with principle names](./08-principles.md).
