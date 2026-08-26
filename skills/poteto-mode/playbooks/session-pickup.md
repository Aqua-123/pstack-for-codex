Delegation, lifecycle, isolation, history, and capability fallbacks follow `../references/codex-agent-runtime.md`.

### Session pickup

**You own the resume point. Read the prior trail, don't redo it.** For "take over this", "resume this conversation", "continue from this task", "you're taking over", "pick up where X left off", a Codex task link or handoff digest, or a pushed branch.

A pickup is inheritance. The prior agent already paid the cost of reading the code, running the repros, making the design choices. Redoing loses the bias check and burns context. Resist the urge to re-derive; read.

1. Locate the prior trail through supported Codex task APIs, a task link, a user-supplied handoff digest, or a pushed branch. Scope task reads to the active project. For a long history, use a read-only subagent and keep the reduced timeline in the parent. If task APIs are unavailable, use git and pull-request state plus the digest. Never search a private history store.
2. Reconstruct operational state. The branch and worktree, what already landed (`git log`, `git diff` against the base), the open todos, the decisions made. The prior trail is authoritative input. Resist the bias to re-derive it.
3. Diff done vs pending. Compare what shipped against what was planned, name the resume point, do not re-run the prior repro or redo completed work. A "let me verify from scratch" pass is the tell that you're treating the trail as untrustworthy when it's actually authoritative.
4. Route the remaining work to the matching playbook and pick the verdict: continue the execution, ship a finished recommendation, ratify or override a prior conclusion, or postmortem a failed run. The pickup playbook ends here; the routed playbook owns the rest.
5. Verify the inherited claims against the original goal on the real artifact (the **principle-prove-it-works** skill). A passing prior self-report is not the proof.

**Reply:** where the prior agent stopped, what you inherited vs redid (ideally nothing redone), the resume point, and the outcome.
