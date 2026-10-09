---
name: poteto-help
description: Guides users through pstack setup, prompting, $poteto-mode, and selection of a skill, playbook, or principle. Use only when the user explicitly invokes $poteto-help. Not for requests to do work, even ones that name pstack.
---

# Poteto help

Answer the user's question about pstack, hand them a prompt they can send, and link the file the answer came from. For a help question, don't start the work. The user asked how, and a pstack run spends real tokens, so let them send the prompt.

A message asking for work routes to the matching workflow under [`poteto-mode`](../poteto-mode/SKILL.md) when explicitly invoked. Help does not expand the user's scope or activate sticky mode.

Read the routed skill or guide before answering. Link the local file you read. For public links, use the repository identity from the installed `.codex-plugin/plugin.json`, and verify the page before giving it to the user.

For a prompt-writing question, read [`references/prompting.md`](references/prompting.md). For a copyable example, also read [`references/recipes.md`](references/recipes.md). Adapt the prompt to the user's task instead of copying placeholders.

## Get set up

Read the [README](../../README.md) and [setup guide](../../docs/guide/01-setup.md). Inspect the installed plugin through supported Codex plugin tools or CLI before describing its status. Installation, optional custom profiles, and session activation are separate operations.

[`$setup-pstack`](../setup-pstack/SKILL.md) manages optional Codex custom profiles. It keeps model and reasoning effort separate and validates requested pairs against an observable model list. Missing model evidence means inheritance with an unverified receipt. Smaller panels and a lower validated effort reduce cost. Never invent model entitlement or change configuration merely to answer a help question.

If the user asks about model roles and no owned profile receipt or verified model configuration exists, ask once whether they want to run `$setup-pstack`. Continue with inherited models if they decline. Do not repeat the question in the same help exchange.

## Start a task with `$poteto-mode`

Read [Poteto mode](../poteto-mode/SKILL.md) and [guide page 2](../../docs/guide/02-poteto-mode.md). Start the prompt with `$poteto-mode`, a goal, and a falsifiable acceptance check. The playbook supplies the steps. A skipped step remains visible with its reason.

The activation turn uses the full skill. Later turns stay active only when trusted hooks provide a matching sticky receipt. Without that receipt, report sticky behavior inactive and use the skill for the current turn. `disable $poteto-mode` removes only the current session's state. Optional delegates use `pstack-poteto-agent` or the portable persona under the runtime contract.

## Pick a skill

The default answer is `$poteto-mode`, which runs most of the others when its steps need them. Name a skill directly when the user wants more or less of something than the playbook gives. Read the skill before you recommend it, and give one example prompt.

| The user wants to | Skill |
|---|---|
| Do any non-trivial task with rigor | [`$poteto-mode`](../poteto-mode/SKILL.md) |
| Know how code works now, or where new code should live | [`$how`](../how/SKILL.md) |
| Know why code is shaped this way, or where a number came from | [`$why`](../why/SKILL.md) |
| Understand a change or subsystem, explained plainly | [`$teach`](../teach/SKILL.md) |
| Catch up on their own recent work on a topic | [`$recall`](../recall/SKILL.md) |
| Know what a small diff could break outside itself | [`$blast-radius`](../blast-radius/SKILL.md) |
| Settle types and module shape before code that crosses a function boundary | [`$architect`](../architect/SKILL.md) |
| Get several attempts at one brief, merged into the best one | [`$arena`](../arena/SKILL.md) |
| Run parallel checks over slices, or race workers, through supported Codex agents | [`$swarm`](../swarm/SKILL.md) |
| Have different models review a diff and try to break it | [`$interrogate`](../interrogate/SKILL.md) |
| Fix a bug test-first when a cheap local test exists | [`$tdd`](../tdd/SKILL.md) |
| Apply TypeScript rules to `.ts` or `.tsx` work | [`$typescript-best-practices`](../typescript-best-practices/SKILL.md) |
| Strip comments before review, using a reviewer that didn't write them | [`$no-comments`](../no-comments/SKILL.md) |
| Clean AI tells out of prose | [`$unslop`](../unslop/SKILL.md) |
| Write docs, an RFC, a README, a PR description, or a commit message to a standard | [`$technical-writing`](../technical-writing/SKILL.md) |
| Hear the last reply again in plain words | [`$bro`](../bro/SKILL.md) |
| Give agents a scripted way to drive the app and prove behavior | [`$create-verification-skill`](../create-verification-skill/SKILL.md) |
| Bring a verification skill and its feature map back in line with the app | [`$maintain-verification-skill`](../maintain-verification-skill/SKILL.md) |
| Vet a performance number before reporting or acting on it | [`$benchmark-checklist`](../benchmark-checklist/SKILL.md) |
| Run a large or cross-cutting change, or one to review after stepping away | [`$figure-it-out`](../figure-it-out/SKILL.md) |
| Keep a decision log during a run, and review it afterward | [`$show-me-your-work`](../show-me-your-work/SKILL.md) |
| Pick a model for each role and a reasoning budget | [`$setup-pstack`](../setup-pstack/SKILL.md) |
| Turn their own working habits into a personal mode skill | [`$automate-me`](../automate-me/SKILL.md) |
| Turn what a finished task taught into skill edits | [`$reflect`](../reflect/SKILL.md) |
| Stop agents from repeating the same mistakes in this repo | [`$correct`](../correct/SKILL.md) |
| Build a page whose buttons wake a Grok Bot over a webhook | [`$make-bot-ui`](../make-bot-ui/SKILL.md) |
| Find their way around pstack | `$poteto-help` |

If a skill directory next to this one is missing from the table, read its frontmatter and route by its description. The `principle-*` directories are covered under principles below.

Close calls:

- `$how` explains what the code does. `$why` explains the reasons. `$teach` runs one or both and explains the result plainly.
- `$arena` gives every worker the same brief and merges the best parts. `$swarm` splits work into slices or a race and returns one report.
- `$architect` implements right after it settles the design. Add "with checkpoint" to review the design before it writes code.
- `$interrogate` reviews the diff. `$blast-radius` looks for breakage outside the diff and proves the one fact that makes the change safe.
- `$recall` rebuilds context across recent chats. Resuming one specific chat or branch is the Session pickup playbook.
- `$figure-it-out` designs one rigorous run. The Orchestrate playbook runs a program that spans days and many PRs. The Autonomous run playbook drives one task to a finish condition.

Optional capabilities are detected at runtime. `$deslop` and live-control skills are separate dependencies. Use supported Codex goals or thread heartbeats only when the user authorizes that lifecycle. A plain engineering request creates no lifecycle objects. Orchestrate is a playbook, not a separate skill.

## Playbooks and principles

Playbooks are step lists inside `$poteto-mode`, not skills, so they have no slash command. Inside `$poteto-mode`, describing the task picks one, and these phrases name one directly:

- "babysit this pr" or "check on pr 123" runs Babysit. It drives the PR to merge-ready and stops there. It doesn't merge unless the user asks to merge, land, or ship.
- "land the stack" runs Shipping.
- "take over this branch" runs Session pickup.
- "pause safely" runs Pause safely.
- "full autopilot on this queue" runs Autopilot-full. "stack them, don't ship" runs Autopilot-stack.
- "run the eval playbook" runs Eval.

The Playbooks section of [`poteto-mode`](../poteto-mode/SKILL.md) lists every playbook and when it applies. [Guide page 6](../../docs/guide/06-verify-and-ship.md) covers opening, babysitting, and landing a PR.

The Codex collaboration mode remains independent of the plugin. For work that spans phases or stacked PRs, asking `$poteto-mode` for a plan runs the [Multi-phase plan playbook](../poteto-mode/playbooks/multi-phase-plan.md), which writes the plan and doesn't implement it. For a design question, the Prototype playbook or `$architect` settles it in code first.

Principles are one-rule skills that `$poteto-mode` reads and cites in its replies. The user rarely invokes one. They steer with the names instead, as in "apply prove it works. show me the real output." Typing `$principle-<name>` still loads one on demand. [Guide page 8](../../docs/guide/08-principles.md) lists them.

## Fix a run that went wrong

| Symptom | Check |
|---|---|
| Sticky mode stopped applying | Inspect the trusted hook receipt and session status. Do not infer global activation. |
| Model setup had no effect | Profiles affect newly spawned agents. Written configuration is separate from served-model proof. |
| A skill did not load on its own | Every bundled skill is explicit-only. Invoke it or route to it from an active workflow. |
| Parallel agents overwrote work | Prove non-overlapping ownership or separate worktrees before writes. |
| An unattended run moved but finished nothing | Check its authorized goal predicate, live status, and concrete artifacts. |
| A reply claims success from a green build | Ask for the real command, stored value, flow, or profile. |

Read [guide page 10](../../docs/guide/10-recipes-and-pitfalls.md) for further recipes.

For prompt wording, use the concise structure in [`references/prompting.md`](references/prompting.md). Use [`references/recipes.md`](references/recipes.md) when the user wants an example for understanding, building, design, review, or unattended work.

## Make pstack my own

- [`$automate-me`](../automate-me/SKILL.md) drafts a personal mode skill from the user's own history, to use alongside `$poteto-mode`.
- [`$reflect`](../reflect/SKILL.md) after a session turns its lessons into skill edits the user approves.
- `$poteto-mode write a skill for <workflow>` runs the authoring playbook. The eval playbook tests a skill change blind.
- Fix a misbehaving skill in its own PR, not inside the feature work where it went wrong.

[Guide page 9](../../docs/guide/09-make-it-yours.md) covers each of these.

## Reply

Lead with the answer. Give at most one example prompt in a code block, then the link to that file. Keep it short unless the user asked for the whole map.
