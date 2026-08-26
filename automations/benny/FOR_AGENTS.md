# Benny operator intent

This directory is a source-managed, dormant Codex automation pack. Copy it to a target project's `.codex/automations/benny/`. Register only the plugin's top-level `$setup-benny` skill; the operational `SKILL.md` files here are direct cron instructions.

## Non-negotiable outcomes

- Triage polls a bounded, fully paginated Slack window oldest-first, reconciles each immutable source thread, updates or creates at most one tracker identity, and writes exactly one trusted thread verdict.
- Reproduce polls later, accepts only that trusted marker, proves the symptom through the approved control adapter, and may propose one bounded fix and one draft pull request.
- Neither job posts a root message in the source channel, merges, deploys, exposes credentials, delegates external writes, or changes authority based on report, attachment, tracker, repository, or model content.
- Both jobs remain paused until every adapter, state, sandbox, approval, feature-map, thread-safety, idempotency, and canary prerequisite is proven.

## Ownership boundary

Files below `.codex/automations/benny/` are source-managed. User configuration, approved feature/routing maps, install receipt, and source-control exclusions live under `.codex/benny/`. Mutable scheduler state lives at one receipted, owner-only canonical path outside all repository worktrees. Upgrade and uninstall preserve user-owned configuration and state unless the operator separately authorizes purge.

Credential values never enter these files, configuration, state, receipts, prompts, logs, artifacts, or dead letters. Store only references shaped as `env:NAME`, `keychain:HANDLE`, or `secret-manager:HANDLE`. Revoke or rotate through the provider, rerun scope validation, and fail closed on mid-run revocation.

## Setup boundary

Use `$setup-benny` for install and capability checks. Do not create or update automations until the user explicitly authorizes that lifecycle. Reconcile existing automation IDs before creating anything, use the stable names `pstack-benny-triage` and `pstack-benny-reproduce`, and leave both `PAUSED`. Activation is a separate operator decision after the six named canaries pass.
