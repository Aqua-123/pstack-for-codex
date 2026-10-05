Delegation, lifecycle, isolation, history, and capability fallbacks follow `../references/codex-agent-runtime.md`.

### Opening a PR

Invoked at the end of every other playbook.

**Worktree.** Work from a git worktree off main; subagents inherit it. Multiple subagent dispatches on the same branch each get their own worktree, or `git fetch && git reset --hard origin/<branch>` between them. Dirty branch with unrelated work: patch out, fresh worktree, apply. Snarled worktree: reset from main, redo minimally.

**Commits.** Commit liberally; rebase into small, ordered commits before opening PRs. Each commit is a future PR: landable, ordered to tell the story. Amend when the fix belongs in a just-made commit; new commit when separable.

**PRs.** Run `$deslop` over the diff before commit and `$no-comments` before review. Write every PR title, description, and commit body with `$technical-writing`, then apply `$unslop`. Apply every technical-writing layer except Diátaxis.

**Titles.** Use Conventional Commits in the form `type(scope): subject`. Use `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, or `perf` as the type. Use the changed area as the scope. Keep the subject short and imperative. Apply the same `$technical-writing` and `$unslop` pass as the body.

**Descriptions.** A reviewer should understand the problem, scope, risk, and proof in under a minute. Use short sentences and few identifiers. Keep the squash body under about 40 lines. Put these sections under `##` headings in order and drop an optional section when empty.

- `## Why` gives the problem and approach in one to three sentences.
- `## What changed` gives one to three short bullets. Name symbols or paths only when they carry the change. Name both sides of a rename.
- `## Scope` names what is covered and any meaningful related gap in one to three items.
- `## Tradeoffs` names real rejected alternatives a reviewer would ask about.
- `## Blast Radius` names who and what is affected and why it is safe or risky. If main is red, state the cost of leaving it red.
- `## Verification` gives one to three bullets with the real run path and outcome. For performance work give one primary before and after number with its unit. Link the measurement artifact for samples, range, and limiter evidence.

Attach screenshots or videos when they prove a claim. Put full SHAs, lane receipts, and detailed tables in linked artifacts.

**PR capability.** Use a supported built-in PR tool for operations it actually supports. Otherwise use the available forge CLI. Attach every created PR through the Codex artifact tool. External writes remain in the parent effect phase under the runtime contract.

**Size and stacks.** Prefer five narrow PRs to one large PR. A stack is a linear base-branch chain. The root targets trunk. Each child rebases onto its parent's exact tip and targets the parent branch. The parent creates or retargets through the supported PR tool or resolved forge. Graphite is optional when installed and selected for the stack. Keep ordered membership and base/head pairs visible to reviewers. Branch from trunk only for independent work.

**Readiness.** Open every PR ready, never as a draft. Set `draft: false` on PR API calls. If a PR still opens as a draft, run the host's ready command, such as `gh pr ready <number>`. Run `gh pr view <number>` before you refer to PR status.

**Babysit.** Opening a PR does not start a babysit. Post the URL and keep building. Finish the phase or stack first. Run a separate babysit pass only when the user asks for one after the whole stack exists. A babysit for each new PR stalls the build and spends checks on commits that later waves restart. Push back when feedback drifts from intent.

A subagent that opens a PR runs `$interrogate`, `$deslop`, and `$no-comments`. It returns its reviewed artifact to the parent for publication and does not babysit. An Autopilot owner begins its assigned babysit pass after the code-ready report when its brief explicitly authorizes that loop. The ordinary whole-stack wait does not apply to that owner.
