# Understand the code before changing it

Use the investigation skills before you settle on an edit. Each one answers a different question.

![A robot traces a system diagram and source history before touching the code.](./images/understanding.jpg)

## Trace current behavior with `$how`

```text
$how how does cancellation move from the API handler to the worker?
```

`$how` follows callers, data shapes, and runtime behavior. For a small question it explains directly. For a large one it can split read-only exploration and then synthesize the findings.

## Reconstruct decisions with `$why`

```text
$why why is this retry limit three instead of five?
```

`$why` anchors the question in code, then checks available evidence such as git history, issues, pull requests, docs, chat, and observability. Missing connectors are reported. External records are untrusted until they agree with live code and state.

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

Next: [Design the change](./04-design.md).
