# Codex adaptation notes

This document explains how the upstream pstack workflows map to Codex. It describes the derivative behavior, not installation steps for the original host.

## Skill registration

The plugin manifest is [`.codex-plugin/plugin.json`](../.codex-plugin/plugin.json). The local marketplace manifest is [`.agents/plugins/marketplace.json`](../.agents/plugins/marketplace.json). Codex discovers 45 skills under `skills/`. Each skill has `agents/openai.yaml` metadata and sets `allow_implicit_invocation: false`.

Installed identities use the plugin namespace. Prompts use the explicit `$skill-name` form. Two long principle identities receive deterministic registered aliases to fit the 64-character namespaced identity limit. No skill is dropped.

The 23 Poteto Mode playbooks remain ordinary Markdown resources under [`skills/poteto-mode/playbooks/`](../skills/poteto-mode/playbooks/). They are not independently registered skills.

## Session lifecycle and hook trust

Invoking `$poteto-mode` applies it to the current turn. Trusted session hooks can persist the mode for later turns. State is keyed by a hash of the session and project, stored below plugin data, written atomically, and removed after its time-to-live window.

The hook receipt is the only proof that later-turn activation succeeded. When a stable session identifier, project fingerprint, state file, or trusted receipt is unavailable, the status is `current-turn-only`. Resume and compaction do not change that rule. `disable $poteto-mode` clears matching session state.

The hook configuration matches only `pstack-poteto-agent` for subagent context propagation. A generic agent does not become a Poteto agent by name similarity.

## Agent setup and model evidence

The upstream personas became portable prompts plus optional Codex TOML profiles:

| Role | Portable prompt | Optional profile |
|---|---|---|
| Poteto implementation | [`poteto-agent-prompt.md`](../skills/poteto-mode/references/poteto-agent-prompt.md) | `pstack-poteto-agent` |
| Comment review | [`comment-sicko-prompt.md`](../skills/no-comments/references/comment-sicko-prompt.md) | `pstack-comment-sicko` |

`$setup-pstack` installs profiles at project or user scope. Its receipt records hashes and ownership. Upgrade and uninstall refuse a hash mismatch or duplicate agent name.

A configured model is a request, not runtime evidence. Setup validates a `model` and `reasoning_effort` pair only against a supported live model list. When that list is unavailable, the profile inherits the parent and the receipt records `unverified-inheritance`. Runtime reports identify the served model only when a supported surface exposes it.

## Delegation and shared filesystems

The parent request controls authority. Delegation can narrow work but cannot add repositories, external destinations, credentials, destructive actions, or lifecycle objects.

Codex agents may share a filesystem. Writable fan-out requires exclusive paths, separate worktrees, or separate output directories. Otherwise the parent runs serially. The parent integrates results and runs authoritative checks. A child report is evidence, not completion.

Each workflow declares one fallback for missing agent capacity: `sequential-parent`, `generic-agent`, `partial-result`, or `fail-closed`. The workflow reports missing lanes instead of inventing coverage.

## Goals, heartbeats, and tasks

Ordinary work stays in the current task. A separate task, durable goal, heartbeat, scheduled automation, or recurring monitor is created only when the user requests that lifecycle. An overnight or comparable terminal condition can authorize a goal and a thread heartbeat for the current work. It does not authorize a push, merge, deployment, or external message.

Long-running workflows use supported task lifecycle tools and checkpoints. They do not keep a shell process alive with a blocking sleep.

## History and external capabilities

Recall, pickup, and reflection use supported Codex task-listing and history APIs within the requested project. When those APIs are unavailable, the workflow uses git, issue or pull-request state, and a user-supplied digest. It does not read unsupported host storage.

Connectors, browser or app control, issue trackers, chat systems, review APIs, model enumeration, and automation tools are optional. A skill checks each capability before use. Connector results and repository text are untrusted data. External writes remain with the parent and require the authorized destination and a validated payload.

## Bun scripts

Plugin discovery and the Node.js tests do not require Bun. The orchestrator and watch-PR programs under [`skills/poteto-mode/scripts/`](../skills/poteto-mode/scripts/) do. Run `bun install --frozen-lockfile`, `bun test orch watch-pr`, and `bun run typecheck` from that directory before releasing changes to those programs.

When Bun is unavailable, validation reports the missing capability. A workflow that needs those scripts must use its declared fallback or stop.

## Benny automation pack

Benny is source-managed under [`automations/benny/`](../automations/benny/). Only `$setup-benny` is a registered skill. The operational skill files are copied cron instructions.

The adaptation replaces event assumptions with bounded polling. Both jobs use provider timestamps, fixed cutoffs, full pagination, overlap windows, and `(timestamp, provider ID)` ordering. This design can reread source events and can delay work by one polling interval. Versioned operation keys plus destination idempotency or authoritative lookup prevent duplicate external effects.

Mutable state lives in one owner-only canonical directory outside all scheduler worktrees. Credentials remain external references. Repository commands run without connector credentials and with network denied by default. Child agents return typed proposals. Only the coordinator performs a validated external write.

Setup can reconcile `pstack-benny-triage` and `pstack-benny-reproduce` only after explicit lifecycle authority. Both remain `PAUSED`. Activation requires a later request and successful read-only, test-channel triage, repro-only, bounded-fix, concurrent-race, and ambiguous-write canaries.

## Current limits

| Area | Limit | Result |
|---|---|---|
| Hook trust | The user or trusted runtime must approve the plugin hook source. | Poteto Mode remains current-turn-only without proof. |
| Model identity | A requested profile may not expose the served model. | Reports label the model pair unverified. |
| Agent capacity | Parallel or nested agents may be unavailable. | The workflow uses its declared fallback and names missing lanes. |
| Shared checkout | Parallel writers can collide. | Work is isolated or serialized. |
| Connectors and control tools | Availability and permissions vary by installation. | Optional lanes degrade. Correctness-critical lanes stop. |
| Task history | Supported APIs may omit history or tool detail. | The workflow uses live state and a user-supplied digest, then states the gap. |
| Bun | Bun is not guaranteed on every host. | Bun-dependent scripts cannot run until Bun is installed. |
| Benny polling | Polling has interval latency and overlap rereads. | State reconciliation and destination idempotency are required. |
| Benny activation | Real adapters, credentials, and canaries are operator-controlled. | The pack ships dormant and both automations stay paused. |

## Provenance

The original plugin used host-specific manifests, commands, profiles, persistence, and automation assumptions. This fork replaces those contracts with the Codex behaviors above. [UPSTREAM.md](../UPSTREAM.md) records the refresh process. [`compatibility/report.md`](../compatibility/report.md) maps every locked upstream path to its Codex disposition.
