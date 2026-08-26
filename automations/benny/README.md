# Benny for Codex

Benny is two dormant local polling automations: one triages issue reports, the other reproduces accepted bugs and may open a draft pull request. Installation does not create or enable either automation.

Use the registered `$setup-benny` skill. It copies this pack to `.codex/automations/benny/`, keeps configuration under `.codex/benny/`, and places mutable state in a shared canonical user-owned directory outside scheduler worktrees. The setup receipt owns only copied files and automation IDs; configuration and state survive upgrade and uninstall by default.

Every report uses `report_id = sha256(workspace-or-team, channel, root-thread timestamp)`. Every external effect has a versioned operation key. Destination-side atomic idempotency or authoritative lookup is required; a local lease only serializes work and cannot prove an external write. Ambiguous writes are quarantined until lookup proves their outcome.

Polling uses provider timestamps, a fixed cutoff, full pagination, configurable overlap, and `(timestamp, provider ID)` ordering. Watermarks never advance past pending or quarantined reports. Dead letters contain only identifiers and redacted reasons and can be manually replayed by validated `report_id`.

Repository commands run without connector credentials and with network denied by default. Children can return typed effect proposals, but only the coordinator validates and executes an external write. Slack, tracker, repository, attachment, and model content is always untrusted data.

Before activation, pass read-only, test-channel triage, repro-only, bounded-fix, concurrent-race, and ambiguous-write canaries against the configured adapters and canonical state root. Until then both `pstack-benny-triage` and `pstack-benny-reproduce` stay paused.
