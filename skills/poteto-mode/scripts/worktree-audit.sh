#!/usr/bin/env bash
# Read-only worktree audit. It reports local Git and GitHub evidence only.
# Codex task use must be checked through supported task APIs by the caller;
# absence of task history is UNKNOWN and never makes a worktree safe to delete.
#
# Usage: worktree-audit.sh [repo-path]   (defaults to the current repo)
set -euo pipefail

repo_arg="${1:-$(git rev-parse --show-toplevel 2>/dev/null || true)}"
if [ -z "$repo_arg" ]; then
	printf 'not in a git repo; pass a repo path\n' >&2
	exit 1
fi
repo=$(git -C "$repo_arg" rev-parse --show-toplevel 2>/dev/null) || {
	printf 'not a git repository: %s\n' "$repo_arg" >&2
	exit 1
}
repo=$(cd "$repo" && pwd -P)

main_wt=$(git -C "$repo" worktree list --porcelain | sed -n 's/^worktree //p' | head -1)
if [ -z "$main_wt" ]; then
	printf 'git reported no main worktree for %s\n' "$repo" >&2
	exit 1
fi

default_ref=$(git -C "$repo" symbolic-ref --quiet refs/remotes/origin/HEAD 2>/dev/null || true)
if [ -z "$default_ref" ]; then
	for candidate in refs/remotes/origin/main refs/remotes/origin/master; do
		if git -C "$repo" show-ref --verify --quiet "$candidate"; then
			default_ref="$candidate"
			break
		fi
	done
fi
if [ -n "$default_ref" ]; then
	default_branch=${default_ref#refs/remotes/origin/}
	git -C "$repo" fetch origin "$default_branch" --quiet 2>/dev/null || \
		printf 'warn: could not refresh origin/%s; merged evidence may be stale\n' "$default_branch" >&2
else
	printf 'warn: no origin default branch; merged evidence is unknown\n' >&2
fi

prs=$(mktemp "${TMPDIR:-/tmp}/pstack-worktree-prs.XXXXXX")
trap 'rm -f -- "$prs"' EXIT
if [ "${PSTACK_SKIP_GITHUB:-0}" != "1" ] && command -v gh >/dev/null 2>&1; then
	(cd "$repo" && gh pr list --author "@me" --state all --limit 1000 \
		--json number,state,headRefName) > "$prs" 2>/dev/null || printf '[]\n' > "$prs"
else
	printf '[]\n' > "$prs"
fi

now=$(date +%s)
printf "SIZE\tAGE\tMERGED\tDIRTY\tREMOTE\tPR\tLAST_TASK_USE\tBUCKET\tWORKTREE\n"

git -C "$repo" worktree list --porcelain | sed -n 's/^worktree //p' | while IFS= read -r wt; do
	[ "$wt" = "$main_wt" ] && continue

	size=$(du -sh "$wt" 2>/dev/null | awk '{print $1}' || true)
	[ -n "$size" ] || size="?"
	head=$(git -C "$wt" rev-parse HEAD 2>/dev/null || true)
	head_ts=$(git -C "$wt" log -1 --format='%ct' HEAD 2>/dev/null || printf '0')
	if [ "$head_ts" -gt 0 ] 2>/dev/null; then age="$(( (now - head_ts) / 86400 ))d"; else age="?"; fi

	merged=unknown
	if [ -n "$default_ref" ] && [ -n "$head" ]; then
		git -C "$repo" merge-base --is-ancestor "$head" "$default_ref" 2>/dev/null && merged=YES || merged=no
	fi

	porcelain=$(git -C "$wt" status --porcelain 2>/dev/null || true)
	if [ -z "$porcelain" ]; then
		dirty=clean
	elif printf '%s\n' "$porcelain" | grep -qv '^??'; then
		dirty="wip:$(printf '%s\n' "$porcelain" | grep -cv '^??')"
	else
		dirty="scratch:$(printf '%s\n' "$porcelain" | grep -c '^??')"
	fi

	branch=$(git -C "$wt" symbolic-ref --quiet --short HEAD 2>/dev/null || true)
	if [ -z "$branch" ]; then
		remote=detached
	elif git -C "$repo" show-ref --verify --quiet "refs/remotes/origin/$branch"; then
		if [ "$(git -C "$wt" rev-parse "origin/$branch" 2>/dev/null || true)" = "$head" ]; then
			remote=pushed
		else
			remote="ahead$(git -C "$wt" rev-list --count "origin/$branch..HEAD" 2>/dev/null || printf '?')"
		fi
	else
		remote=no-remote
	fi

	pr="-"
	if [ -n "$branch" ] && command -v jq >/dev/null 2>&1; then
		pr=$(jq -r --arg b "$branch" '.[] | select(.headRefName==$b) | "#\(.number)/\(.state)"' "$prs" 2>/dev/null | head -1)
		[ -n "$pr" ] || pr="-"
	fi

	last_task_use=unknown
	case "$dirty" in
		wip:*) bucket=hold-wip ;;
		*)
			case "$pr" in
				*OPEN*) bucket=hold-open-pr ;;
				*) bucket=needs-task-check ;;
			esac
		;;
	esac

	printf "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n" \
		"$size" "$age" "$merged" "$dirty" "$remote" "$pr" \
		"$last_task_use" "$bucket" "$wt"
done | sort -t$'\t' -k1,1 -rh
