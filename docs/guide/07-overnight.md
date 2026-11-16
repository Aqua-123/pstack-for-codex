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

Pre-answer common authority questions. State whether commits are allowed and whether the run must stop before a push, pull request, merge, deployment, or external message. Name credentials and product decisions as stop conditions.

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

For a quick status instead of an audit, invoke [`$ketchup`](../../skills/ketchup/SKILL.md) in the task that ran the work. It reads only, and says in plain words what changed since your last message, with the screenshots and small diagrams the work produced. Then it lists each call waiting on you, such as a merge, an approval, or a choice between options, with its pick, the evidence, and the risk, so you can decide from the reply alone.

If the run cannot reach the finish condition after repeated evidence-based attempts, it must stop and record the blocker. Continued execution is not permission to hide failure or weaken the finish condition.

## Scale to a queue or a program

For a queue rather than one task, the [Autopilot-full](../../skills/poteto-mode/playbooks/autopilot-full.md) playbook gives each independent pull request one owner, and no owner merges on its own verdict. A swarm of fresh verifiers checks each code-ready head. A later rebase or minor fix gets one fresh verifier, and only new behavior or a large new diff calls the full swarm again. The clean verdict must match the merge-ready patch. Authorized hourly heartbeats append the queue log each tick and message only when state changes.

[Autopilot-stack](../../skills/poteto-mode/playbooks/autopilot-stack.md) is Autopilot-full without the merge. It leaves verified pull requests, each with its verdict, for you to review and land, and it stacks a pull request only on one it builds on. [Orchestrate](../../skills/poteto-mode/playbooks/orchestrate.md) is for a multi-day program under one standing coordinator task. The coordinator decides which agent does each piece of work, checks what each one produces, and never writes code itself. If one agent could finish the work in a session, the playbook routes you back to the overnight contract above.

Each of these playbooks needs explicit authority for every push, pull request, and merge it performs. An overnight request alone does not grant it.

## Configure Benny separately

Benny is a polling automation pack, not an overnight shortcut. Use `$setup-benny` only when you intend to configure Slack, tracker, repository, control-adapter, and canonical-state integration.

Setup does not activate Benny. It can reconcile exactly two `PAUSED` project automations only after explicit authority. A later request is required to activate them after the six canaries pass. Polling may add up to one schedule interval of latency, and overlap windows can reread events. Destination idempotency prevents duplicate effects.

Next: [Steer with principle names](./08-principles.md).
