# Design before implementation

Use design work when a change crosses boundaries or has several credible shapes. Skip it for a mechanical edit whose structure is already fixed.

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

The candidates need independent output directories or worktrees. The parent reads them, selects a base, integrates useful parts, and verifies the result. If independent agents are unavailable, `$arena` declares a sequential fallback or returns partial coverage.

## Cover separate slices with `$swarm`

```text
$swarm check every package for direct calls to the legacy client. One read-only slice per package.
```

Use `$swarm` when the work divides by package, file set, test group, or another independent boundary. Do not use it to make several writers share one checkout.

## Review the design with `$interrogate`

```text
$interrogate review this design for correctness, migration risk, operability, and unnecessary complexity.
```

`$interrogate` returns findings grouped by action and explains dismissals. Distinct model families are useful when observable, but installed model labels do not prove which model served a request. Reports mark unverified identity instead of claiming diversity.

Next: [Build and clean the change](./05-build-and-clean.md).
