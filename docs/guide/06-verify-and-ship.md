# Verify and ship

Verification must exercise the artifact that changed. A compiler pass proves types. It does not prove a UI flow, network side effect, or command transcript. This page covers the finish condition, a project verification skill, formal verification of a property tests rarely reach, review, and authorized shipping.

![A robot checks a built machine while another records the result.](./images/verification.jpg)

## State the finish condition

```text
$poteto-mode fix the retry duplicate. Done means the regression test passes and the real command writes one row after an interrupted retry.
```

The parent reruns authoritative checks after integrating child work. A child summary is evidence, not completion.

Match each claim to its proof. A type check supports a type claim. A focused test supports the exercised behavior. A screenshot or recording supports the visible state it shows. None of these alone proves an unrelated runtime or deployment claim.

## Create a project verification skill

If the repository lacks a repeatable real-surface check, ask:

```text
$create-verification-skill create a project skill that launches this CLI, drives one mapped command, captures a transcript, and cleans up.
```

The generated skill lives under `.agents/skills/verify-<app>/`. It contains launch, health, drive, evidence, and cleanup instructions, a helpers section for any script it ships, and a feature map. The generator runs one mapped feature end to end before handing the skill over, then confirms that the evidence survived the cleanup.

Use `$maintain-verification-skill` to compare an existing verification skill with the current app. It edits only proven drift and reruns affected live checks. It never edits product code. If the live pass catches a product regression, it reports the regression instead of hiding it with a doc edit.

## Prove a property with a formal verification skill

A verification skill proves the paths you drive. Some bugs live on paths nobody drives: two retries that overlap, a lock that expires mid-write, or a state change that arrives out of order. Tests rarely reach those cases. For code where such a bug is costly, ask:

```text
$create-formal-verification-skill the job lease and retry logic. A job must never run twice at once.
```

[`$create-formal-verification-skill`](../../skills/create-formal-verification-skill/SKILL.md) can also pick the target itself: a promise the code makes, where a break harms users and tests rarely reach the case that breaks it. It picks the strongest target, not the easiest to verify.

The question picks the tool. Whether events can happen in a bad order suits a model checker over a small model of the design, and TLA+ is the default for that in any language. Whether the code behaves for every input suits a verifier that runs on the code. If no verifier runs on your language, the agent says so and tests the real code with generated inputs, not a hand-written model of the function. A property that must hold at every size can need a proof. The agent tells you which tool it chose and why. A check whose tool could not be installed or run is reported as not run, never as a pass.

It verifies one property and shows that property failing on a broken variant of the code, because a check you have never seen fail proves nothing. When the current code already breaks the property, you get the counterexample as a short sequence of steps in your code's terms. The property stays as stated, so the finding stays a finding. Product code does not change unless you ask.

The generator writes a project-local skill under `.agents/skills/`. It tells the next agent whether a change touches the verified code, how to run the check with one command, and how to tell a real bug from a modeling error. Before handing it over, the generator follows that skill once on a scratch change that breaks the property, and the check must catch it. The handoff says what was verified, with which tool and bounds, what the check found, and what it does not cover. A pass covers the model or the bound, not the whole system.

The skill also records which code each check covers and the commit where the check last matched it. Merges and refactors can leave the check passing on a description of code that no longer exists. After them, invoke [`$maintain-formal-verification-skill`](../../skills/maintain-formal-verification-skill/SKILL.md). It updates the verification from the code, reruns it, shows that each updated check can still fail, and says whether each failure is drift in the verification or a bug in the code.

## Show the behavior as a statechart

A counterexample in model terms convinces an engineer. The person who owns the behavior needs to see it in their own terms:

```text
$statechart what the user sees when they edit a note offline
```

[`$statechart`](../../skills/statechart/SKILL.md) checks a TLA+ model and draws a Mermaid statechart of what the user sees from it, so the picture and the checked model cannot drift apart. The reader's rules, such as "you never see Synced while you're offline", become invariants. The chart marks each state that breaks a rule, and the report gives the shortest path to it in the reader's words. Before the handoff, the agent reproduces each bug path in the real code, so a modeling error does not reach the reader as a bug.

The skill works in a scratch folder outside the repository. It needs a TypeScript runtime and the TLA+ tools. Its first run may install them, which needs network access. If those tools cannot run, the model is unchecked, and the report must say so.

## Review the diff

Run the repository checks, inspect `git diff --check`, and use `$interrogate` for a skeptical review when the risk warrants it. Keep unsupported or trust-dependent checks visible as blockers or deferred operator gates.

## Open or merge only with authority

The [opening-a-PR playbook](../../skills/poteto-mode/playbooks/opening-a-pr.md) prepares a focused branch and pull request. The [babysit playbook](../../skills/poteto-mode/playbooks/babysit.md) watches authorized review and CI work. The [shipping playbook](../../skills/poteto-mode/playbooks/shipping.md) verifies a stack before an authorized landing action.

These playbooks do not infer permission to commit, push, open a pull request, merge, or deploy. State the allowed repository and action in the request. The parent validates the remote and branch immediately before a write.

Before a pull request is ready, compare its current head with the recorded verification result. If the patch changed after verification, rerun the affected checks. Read dropped or dismissed findings as well as accepted ones.

Next: [Run authorized overnight work](./07-overnight.md).
