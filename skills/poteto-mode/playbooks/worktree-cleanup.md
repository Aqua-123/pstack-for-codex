Delegation, lifecycle, isolation, history, and capability fallbacks follow `../references/codex-agent-runtime.md`.

### Worktree and simulator cleanup

**You own the disk and the safety gate.** Prune merged or abandoned git worktrees and stale iOS simulators to reclaim space. Deletion is irreversible, so every step guards against deleting something in use or holding uncommitted work.

1. Snapshot and audit. Record `df -h /`, then run `scripts/worktree-audit.sh` (principle-build-the-lever). It reads exact paths from `git worktree list`, never hand-types or guesses them. It classifies each worktree by size, age, merge state, uncommitted work, and PR state. Supported task history may add last-use evidence when available, but absence is unknown rather than stale.
2. The bucket is advice, not permission. The pinned and active chats are the real artifact (principle-prove-it-works). Get that set from the user or sidebar and cross-check every candidate. The lever has marked `safe` a worktree the user had pinned, so the pinned set wins.
3. Verify usage before deleting. For every uncertain row, use supported task listing and history scoped to this project to determine whether an active or pinned task names the worktree. Read-only subagents may partition task IDs. If task history is unavailable or ambiguous, keep the worktree and report it for human review.
4. Pause on irreversible loss. `wip:N` is N tracked uncommitted edits. Show the diff and get a decision first, since removing a clean worktree is recoverable from its branch but uncommitted work is gone. `scratch:N` is untracked throwaway, safe to drop, but name the files. Per Autonomy, clean and merged and not-in-use proceeds; `wip` and in-use pause.
5. Prune the confirmed set. Per path, `git worktree remove --force <path>`; if the dir survives on ignored build artifacts, `rm -rf` it, then `git worktree prune`. Branch refs survive, so no commits are lost. Confirm with `df -h /` and re-list.
6. Simulators and other reclaimers. Simulators are usually the next-biggest win. `xcrun simctl --set testing delete all` (XCTestDevices clones), `xcrun simctl delete unavailable`, and `xcrun simctl runtime list` then `runtime delete <id>` for old runtimes. More when needed: Xcode `DerivedData` and `iOS DeviceSupport`, then package caches such as pnpm, uv, brew, or yarn. Clear only caches the user has explicitly put in scope. Never infer or delete application-support data.

This is the one playbook that deletes user state with no code review to catch a slip, so the gates above are the review.

**Reply:** `df -h /` before and after with space reclaimed, the worktrees pruned, and a one-line reason for each held back (in-use by which chat, or uncommitted work).
