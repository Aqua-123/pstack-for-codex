# Design before implementation

Use design work when a change crosses boundaries or has several credible shapes. Skip it for a mechanical edit whose structure is already fixed.

When the user experience is uncertain, request small prototypes before a plan. Compare screenshots, recordings, command transcripts, or other real outputs. After the design is stable, make each plan step end with a check.

![Several robots draft separate bridge designs while a reviewer compares them.](./images/design.jpg)

## Settle boundaries with `$architect`

```text
$architect design the cancellation state and API before changing callers.
```

`$architect` grounds the request in current callers and types. It can compare isolated sketches, agree on one shape, and implement against the chosen design. A bad foundational shape is discarded instead of patched around.

## Compare attempts with `$arena`

```text
$arena produce three parser designs from this brief. Keep each candidate isolated and judge them against migration cost and failure handling.
```

The candidates need independent output directories or worktrees. A read-only judge from a different model vendor than the parent scores every candidate against a rubric. When no judge from another vendor can run, the parent skips the judge, picks the base itself, and says so. A configured model is a request, not proof, so when no supported surface reports the parent's served model, the report says the vendor check did not run. The parent reads every candidate, selects a base, integrates useful parts, and verifies the result. If independent agents are unavailable, `$arena` declares a sequential fallback or returns partial coverage.

## Cover separate slices with `$swarm`

```text
$swarm check every package for direct calls to the legacy client. One read-only slice per package.
```

Use `$swarm` when the work divides by package, file set, test group, or another independent boundary. Do not use it to make several writers share one checkout.

## Try to break the change with `$interrogate`

```text
$interrogate the whole branch, skeptically. Report only failures you can reproduce against its stated intent. Do not change anything.
```

`$interrogate` gives the change and its intent to several adversaries, and each tries to break it with a run against the real code, such as a failing test, a repro script, or command output. Adversaries find different failures. A finding survives only when rerunning its command shows a failure that breaks the intent. The report lists every verified finding with the adversaries that found it, then what each adversary dropped and why. It applies nothing.

Read the Dropped list too. You can override the verdict. Adversaries use validated configured profiles or inherit the parent model. Installed model labels do not prove which model served a request, so reports mark unverified identity instead of claiming diversity.

Don't spend adversaries on an abstract plan. `$interrogate` drops every finding a run does not prove, so a plan with no code behind it gives them little to break. Let prototypes settle the open questions, then interrogate what got built.

For an unfamiliar package or interface, a short usage tutorial can be a design artifact. It exposes awkward call sites before implementation commits the repository to the shape.

Next: [Build and clean the change](./05-build-and-clean.md).
