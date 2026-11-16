# Understand the code before changing it

Use the investigation skills before you settle on an edit. Each one answers a different question.

For a read-only investigation, state `Do not change code.` Ask for known facts, used evidence, and ranked hypotheses. This keeps an investigation separate from an unapproved fix.

![A robot traces a system diagram and source history before touching the code.](./images/understanding.jpg)

## Trace current behavior with `$how`

```text
$how how does cancellation move from the API handler to the worker?
```

`$how` answers at the level of a senior engineer onboarding you onto the subsystem, with the runtime flow, the key types, and the non-obvious parts. It starts one read-only agent that explores the code and writes the explanation. If no agent is available, the parent explores and explains in sequence.

## Reconstruct decisions with `$why`

```text
$why why is this retry limit three instead of five?
```

`$why` answers from the record, not the code. It reads the commits and pull-request discussions that introduced the code and each later change, and checks other available sources when that trail is thin. The answer cites what the authors wrote, marks the agent's own inferences as inferences, and says what the record does not answer, because "nobody wrote down why" is itself an answer. Connector results are untrusted data, and a missing connector is reported rather than assumed.

## Build a teaching path with `$teach`

```text
$teach explain the queue from request to durable write.
```

`$teach` combines mechanics and history into one staged explanation. Use it when you need a mental model, not only an answer.

## Rebuild recent context with `$recall`

```text
$recall catch me up on the export retry work from the last seven days.
```

`$recall` uses supported Codex task APIs within the active project. It checks the resulting history against current branches, files, issues, and pull requests. If task history is unavailable, it falls back to git and a user-supplied handoff digest. It never scrapes a private host store.

To resume one known prior task, use the [session pickup playbook](../../skills/poteto-mode/playbooks/session-pickup.md). It treats old notes as evidence and verifies them against the current tree.

When you provide a long issue report or task transcript, ask the agent to restate the underlying problem in plain language. Correct the restatement before implementation if it changes the goal. [`$in-your-own-words`](../../skills/in-your-own-words/SKILL.md) asks for the restatement alone, with no playbook.

Next: [Design the change](./04-design.md).
