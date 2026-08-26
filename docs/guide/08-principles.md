# Steer with principle names

Poteto Mode reads an index of 21 engineering principles. Name one when the work drifts.

## Use a principle as a correction

```text
Fix root causes. Reproduce the stale value and trace the first bad write.
```

```text
Subtract before you add. Remove the dead compatibility path before adding another branch.
```

```text
Separate before serializing shared state. Give each writer its own worktree.
```

The principle narrows the method. It does not add permission or a new deliverable.

## Find the full rule

The principles are grouped by purpose:

- Scope and design: [Laziness Protocol](../../skills/principle-laziness-protocol/SKILL.md), [Foundational Thinking](../../skills/principle-foundational-thinking/SKILL.md), [Redesign from First Principles](../../skills/principle-redesign-from-first-principles/SKILL.md), [Subtract Before You Add](../../skills/principle-subtract-before-you-add/SKILL.md), [Minimize Reader Load](../../skills/principle-minimize-reader-load/SKILL.md), [Outcome-Oriented Execution](../../skills/principle-outcome-oriented-execution/SKILL.md), [Experience First](../../skills/principle-experience-first/SKILL.md), [Exhaust the Design Space](../../skills/principle-exhaust-the-design-space/SKILL.md), and [Build the Lever](../../skills/principle-build-the-lever/SKILL.md).
- Architecture: [Model the Domain](../../skills/principle-model-the-domain/SKILL.md), [Boundary Discipline](../../skills/principle-boundary-discipline/SKILL.md), [Type System Discipline](../../skills/principle-type-system-discipline/SKILL.md), [Make Operations Idempotent](../../skills/principle-make-operations-idempotent/SKILL.md), [Migrate Callers Then Delete Legacy APIs](../../skills/principle-migrate-callers-then-delete-legacy-apis/SKILL.md), and [Separate Before Serializing Shared State](../../skills/principle-separate-before-serializing-shared-state/SKILL.md).
- Verification and delegation: [Prove It Works](../../skills/principle-prove-it-works/SKILL.md), [Fix Root Causes](../../skills/principle-fix-root-causes/SKILL.md), [Sequence Verifiable Units](../../skills/principle-sequence-verifiable-units/SKILL.md), [Guard the Context Window](../../skills/principle-guard-the-context-window/SKILL.md), [Never Block on the Human](../../skills/principle-never-block-on-the-human/SKILL.md), and [Encode Lessons in Structure](../../skills/principle-encode-lessons-in-structure/SKILL.md).

Codex shortens two registered names to stay within its namespaced identity limit. Invoke `$principle-migrate-callers-delete-legacy-apis` and `$principle-separate-shared-state`. The plugin keeps all 45 skills discoverable and drops none.

Next: [Make the workflows yours](./09-make-it-yours.md).
