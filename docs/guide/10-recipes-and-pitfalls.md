# Recipes and pitfalls

Copy these prompts, then replace the nouns and finish conditions with your own.

For more examples, invoke `$poteto-help` and ask for a prompt for your task. The help skill reads its prompt guidance and returns one adapted example without starting the work.

![A robot follows a recipe card while avoiding marked hazards.](./images/recipes.jpg)

## Understand a subsystem

```text
$how trace cancellation from the API to the worker. Then use $why to explain the retry limit from available history.
```

## Sharpen a prompt before you send it

```text
$sharpen write the onboarding doc for the new billing service.
```

The agent names what an expert would do that you did not ask for, the raw material they would start from, their methods and tools, and an outside check that the result is right. It hands back your prompt rewritten to ask for that and does not do the task. Send the rewrite when it reads right. `$in-your-own-words` asks for a restatement of your goal alone, with no playbook.

## Compare a design

```text
$arena compare three isolated designs for this state machine. Judge them on illegal-state prevention, caller migration, and operational evidence. Do not edit production code.
```

## Review a branch

```text
$interrogate the whole branch against its stated intent. Do not change anything. No nitpicks unless a run shows an actual bug or regression.
```

Only findings a rerun proves survive. The report lists what each adversary dropped and why, and you can override either way.

## Fix a bug

```text
$poteto-mode reproduce the duplicate retry row, add the narrow regression check, fix the root cause, and verify the real command.
```

## Prove a property tests rarely reach

```text
$create-formal-verification-skill the retry queue. A message must never be delivered twice.
```

You get one property checked in every case within a stated scope, a counterexample in your code's terms if the code already breaks it, and a project skill the next agent runs on any change to that code.

## Catch up on a task you left running

```text
$ketchup
```

[`$ketchup`](../../skills/ketchup/SKILL.md) tells you in plain words what changed since your last message, then lists each call waiting on you with its pick, evidence, and risk. It changes nothing while it reports.

To watch the catch-up instead, invoke [`$ketchup-video`](../../skills/ketchup-video/SKILL.md). It renders a short subtitled video of slides outside the repository and lists the calls waiting on you as text under it. If the render fails, it says so and gives only the calls.

## Resume a branch

```text
$poteto-mode take over this branch. Read the decision log, verify what is complete, and continue. Do not repeat finished work.
```

## Plan after design

```text
$poteto-mode prototype several options for this interface and capture screenshots. Stop for design review. After approval, make a plan of small verifiable pull requests.
```

## Run bounded parallel checks

```text
$swarm inspect each package for direct legacy-client calls. Keep the workers read-only and return one deduplicated report.
```

## Configure dormant polling

```text
$setup-benny inspect the dormant Benny pack and list every activation blocker. Do not create automations or write externally.
```

## Avoid these mistakes

- Do not use slash-command syntax. Invoke installed skills as `$skill-name`.
- Do not assume that Poteto Mode persists. Without a trusted hook receipt, invoke it again on each turn.
- Do not send parallel writers into one checkout. Assign exclusive paths or separate worktrees.
- Do not claim model diversity from a requested profile. Report the served model only when a supported live surface exposes it.
- Do not treat optional connectors as installed. Detect them and follow the skill's declared fallback.
- Do not create goals, heartbeats, monitors, scheduled tasks, or separate tasks for ordinary work.
- Do not activate Benny during setup. Both canaries and separate activation authority are required.
- Do not store connector credentials in repository files, receipts, task prompts, or Benny state.
- Do not call a unit test proof of a UI or command behavior unless it exercises the changed artifact.
- Do not call a formal verification pass proof of the whole system. A pass covers the model or the bound it states.
- Do not list skills in order in a prompt. The playbook already sequences them. Name a skill only to override a default.
- Do not delete modified setup files. A receipt hash mismatch requires review.

Return to [the guide index](./README.md) or read the [Codex adaptation notes](../codex-adaptation.md).
