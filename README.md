# pstack for Codex

`pstack-for-codex` is a Codex-native derivative of [pstack](https://github.com/cursor/plugins/tree/main/pstack). It packages deliberate engineering workflows as 45 explicit-only skills and 23 Poteto Mode playbooks.

Use `$poteto-mode` for a substantial engineering task. It selects a playbook, records the work as verifiable steps, and invokes narrower skills when the steps need them. The parent task keeps authority for integration, external writes, commits, pushes, and the final result.

## Install

This public repository is a Codex marketplace. Install it directly from GitHub:

```bash
codex plugin marketplace add Aqua-123/pstack-for-codex
codex plugin add pstack-for-codex@pstack-for-codex-local
```

For a local checkout, replace `Aqua-123/pstack-for-codex` with its absolute path. Confirm the installed plugin:

```bash
codex plugin list --json
```

Codex CLI `0.146.0` does not expose an offline runtime skill-index command. The release suite validates the skill catalog from the installed artifact; start a new task to exercise prompt-time skill discovery.

All 45 skills require explicit invocation. Codex stores their full identities under the `pstack-for-codex` namespace. In a prompt, invoke a skill with its registered `$name`:

```text
$poteto-mode add a --json flag to this command. Keep text output byte-identical. Verify both modes.
```

Start a new task after installation so Codex reloads the plugin catalog. See [Set up pstack](./docs/guide/01-setup.md) for the complete walkthrough.

## Optional agent profiles

The skills work without custom agent profiles. Use `$setup-pstack` only when you want to install the two optional profiles:

- `pstack-poteto-agent` for implementation and orchestration.
- `pstack-comment-sicko` for read-only comment review.

Setup writes either project profiles under `.codex/agents/` or user profiles under `~/.codex/agents/`. It records file hashes in a receipt and refuses to overwrite files owned by someone else. An explicit `model` and `reasoning_effort` pair is accepted only when a supported Codex model-list surface proves the pair. Otherwise the profile inherits the parent model and the receipt records that the requested pair is unverified.

Read [Agent setup and model evidence](./docs/codex-adaptation.md#agent-setup-and-model-evidence) before changing profiles.

## Use the skills

`$poteto-mode` is the main entry point:

```text
$poteto-mode this retry path creates duplicate rows. Reproduce it first, fix the root cause, and verify the real behavior.
```

The other skills are useful when you want one specific operation:

| Skill | Use it for |
|---|---|
| [`$how`](./skills/how/SKILL.md) | Trace how a subsystem works. |
| [`$why`](./skills/why/SKILL.md) | Reconstruct why code reached its current shape from available evidence. |
| [`$recall`](./skills/recall/SKILL.md) | Rebuild recent project context through supported task history and live state. |
| [`$architect`](./skills/architect/SKILL.md) | Settle types, callers, and module boundaries before implementation. |
| [`$arena`](./skills/arena/SKILL.md) | Compare isolated attempts at the same brief. |
| [`$swarm`](./skills/swarm/SKILL.md) | Cover independent slices or races and aggregate the result. |
| [`$interrogate`](./skills/interrogate/SKILL.md) | Run a skeptical, multi-lens review of a diff. |
| [`$tdd`](./skills/tdd/SKILL.md) | Reproduce a bug with a failing test before fixing it. |
| [`$no-comments`](./skills/no-comments/SKILL.md) | Review comments and remove ones that do not earn their place. |
| [`$unslop`](./skills/unslop/SKILL.md) | Remove vague or machine-shaped prose. |
| [`$show-me-your-work`](./skills/show-me-your-work/SKILL.md) | Keep a reviewable `decisions.tsv` trail. |
| [`$setup-benny`](./skills/setup-benny/SKILL.md) | Inspect or configure the dormant Benny polling pack. |

Browse the [complete skill directory](./skills/) or read the [pstack guide](./docs/guide/README.md).

## Runtime boundaries

Codex agents may share one filesystem. Read-only work can share a checkout. Parallel writers need exclusive file ownership, separate worktrees, or separate output directories. When safe isolation is unavailable, pstack runs the work serially.

The active user request is the authority boundary. A child cannot add an external write, destination, credential, repository, or lifecycle object. Goals, heartbeats, scheduled tasks, monitors, and separate user-owned tasks are created only when the user requests that lifecycle or gives an equivalent terminal condition such as an overnight run.

Hooks can keep Poteto Mode active across later turns only after Codex trusts the plugin hook source. Without trusted hook evidence, `$poteto-mode` still works for the current turn and reports `current-turn-only`. Say `disable $poteto-mode` to clear the session state.

Optional connectors and control tools are detected at run time. A missing capability triggers the fallback declared by the skill. Work stops when that capability is required for correctness or credential isolation.

## Benny stays paused

[Benny](./automations/benny/README.md) is an optional polling pack for issue triage and reproduction. Installation does not create or activate an automation. `$setup-benny` copies the pack into a target project only after explicit authority.

The two stable automation names are `pstack-benny-triage` and `pstack-benny-reproduce`. Setup creates or updates them only when the user asks, and it leaves both `PAUSED`. Activation needs a separate request after all six canaries pass. Polling is not event delivery, so work can begin up to one schedule interval after a source change.

## Develop and verify

The metadata and resource validator requires Node.js. The legacy orchestrator and watch-PR scripts require [Bun](https://bun.sh/).

```bash
node scripts/validate-plugin.mjs --json
node --test tests/*.test.mjs
cd skills/poteto-mode/scripts
bun install --frozen-lockfile
bun test orch watch-pr
bun run typecheck
```

The validator reports Bun as an optional capability. Skills that depend on the Bun scripts must stop or declare their fallback when Bun is unavailable.

## Update or remove

Refresh the configured Git marketplace, then reinstall from the refreshed snapshot:

```bash
codex plugin marketplace upgrade pstack-for-codex-local
codex plugin remove pstack-for-codex@pstack-for-codex-local
codex plugin add pstack-for-codex@pstack-for-codex-local
```

Remove the plugin and its marketplace registration with:

```bash
codex plugin remove pstack-for-codex@pstack-for-codex-local
codex plugin marketplace remove pstack-for-codex-local
```

Plugin removal does not delete project or user files created by `$setup-pstack` or `$setup-benny`. Use those skills to inspect receipts and remove only unchanged, owned files. Benny configuration and mutable state survive uninstall unless the user separately authorizes a purge.

## Origin and maintenance

This repository contains only the modified Codex version. It does not publish a raw upstream branch or snapshot commit, and the delivered checkout does not keep an upstream remote.

[NOTICE](./NOTICE), [`upstream.lock.json`](./upstream.lock.json), and the [compatibility map](./compatibility/pstack-map.json) record the source commit, license, file hashes, and migration status. [UPSTREAM.md](./UPSTREAM.md) explains how maintainers refresh that evidence through a temporary local source checkout.

See [Codex adaptation notes](./docs/codex-adaptation.md) for the behavioral changes and current limits.

## License

MIT. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
