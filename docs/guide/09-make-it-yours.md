# Make the workflows yours

Project skills belong under `.agents/skills/`. They remain separate from the installed plugin, so a plugin upgrade does not overwrite them.

## Draft a personal mode

```text
$automate-me create a project mode from my stated preferences and the supported recent task history for this repository.
```

`$automate-me` uses supported Codex task APIs when available. If those APIs are unavailable, it asks for a digest or skips history mining and states the gap. It never searches unsupported host storage.

The draft goes to `.agents/skills/<handle>-mode/` or an existing project category. Review the draft before any commit or pull request. `$automate-me` does not gain push authority from the authoring request.

## Capture a lesson with `$reflect`

```text
$reflect review this task for a reusable workflow correction.
```

`$reflect` collects the current task through supported history or a bounded digest. It presents accepted, rejected, and backlog findings before editing a skill. The user must approve any skill edit because the change affects later tasks.

## Create a focused skill

Use the installed `skill-creator` when available, or ask Codex to follow the repository's skill-authoring requirements. Keep the skill explicit-only unless you have a clear reason for automatic invocation. Add `agents/openai.yaml`, use relative resource paths, and test from an installed cache-like copy.

Two kinds of skill have their own generators. A skill that must drive your app and prove behavior is a verification skill, so use [`$create-verification-skill`](../../skills/create-verification-skill/SKILL.md) and [`$maintain-verification-skill`](../../skills/maintain-verification-skill/SKILL.md). A skill that checks a property of your code with a model checker, a proof, or another verifier is a formal verification skill, so use [`$create-formal-verification-skill`](../../skills/create-formal-verification-skill/SKILL.md) and [`$maintain-formal-verification-skill`](../../skills/maintain-formal-verification-skill/SKILL.md). [Verify and ship](./06-verify-and-ship.md#prove-a-property-with-a-formal-verification-skill) covers both kinds.

Use `$technical-writing` for documentation and `$unslop` for the final prose pass. Use the [authoring-a-skill playbook](../../skills/poteto-mode/playbooks/authoring-a-skill.md) when the change needs a full plan and evaluation.

Use `$correct` when the same mistake has at least two examples. Prefer an architecture, type, lint, test, or tool constraint over a prose reminder. Use `$benchmark-checklist` before you preserve or publish a performance number.

## Keep provenance separate

Do not edit [`upstream.lock.json`](../../upstream.lock.json) to describe a local customization. The lock records the imported source. Put derivative behavior in the compatibility map, tests, and adaptation notes. [UPSTREAM.md](../../UPSTREAM.md) covers refreshes.

Next: [Use the recipes and avoid the pitfalls](./10-recipes-and-pitfalls.md).
