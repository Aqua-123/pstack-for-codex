# Recipes and pitfalls

Copy these prompts, then replace the nouns and finish conditions with your own.

![A robot follows a recipe card while avoiding marked hazards.](./images/recipes.jpg)

## Understand a subsystem

```text
$how trace cancellation from the API to the worker. Then use $why to explain the retry limit from available history.
```

## Compare a design

```text
$arena compare three isolated designs for this state machine. Judge them on illegal-state prevention, caller migration, and operational evidence. Do not edit production code.
```

## Review a branch

```text
$interrogate review this branch against its stated intent. Report actionable findings with file evidence and explain every dismissal.
```

## Fix a bug

```text
$poteto-mode reproduce the duplicate retry row, add the narrow regression check, fix the root cause, and verify the real command.
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
- Do not delete modified setup files. A receipt hash mismatch requires review.

Return to [the guide index](./README.md) or read the [Codex adaptation notes](../codex-adaptation.md).
