---
name: setup-benny-pack
description: Direct instructions for validating a copied Benny pack. This file is dormant and is not a registered plugin skill.
---

# Validate the copied Benny pack

Use the registered `$setup-benny` skill as the authority. Confirm this file is at `.codex/automations/benny/skills/setup-benny/SKILL.md`, configuration is outside the copied pack under `.codex/benny/`, and mutable state is in one absolute, shared, owner-only canonical directory outside all worktrees.

Validate every field in `../../templates/configuration.example.yaml`. Credential entries are external references only. Record least-privilege scopes, config and operational-file hashes, source-managed file hashes, atomic-state proof, allowed network hosts, retention, canaries, stable automation IDs, and activation blockers in `.codex/benny/setup-receipt.json` without secret values.

Reconcile exactly two stable automation names only after explicit user authorization. Update stored IDs rather than duplicating them and force both descriptors to `PAUSED`. Do not activate either job from this file.
