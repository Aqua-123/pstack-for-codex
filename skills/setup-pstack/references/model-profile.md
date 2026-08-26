# Codex agent model and capability profile

Codex custom agents are standalone TOML files in project `.codex/agents/` or user `~/.codex/agents/`. The TOML `name` field, not the filename, owns identity. Skill `agents/openai.yaml` files provide UI and invocation metadata only.

## Role matrix

| Role | Writable scope | Sandbox policy | Connector posture | Skill posture | Model policy | Fallback |
| --- | --- | --- | --- | --- | --- | --- |
| `pstack-poteto-agent` | Inherits the live parent request; setup does not grant writes | Inherits the live runtime so setup cannot broaden authority | Inherits, but use remains limited to the parent request | Must read `poteto-mode`; portable prompt is authoritative | Inherit by default; install an explicit pair only after an observable model list validates both values | Include `poteto-agent-prompt.md` in a generic-agent task; use the parent sequentially when agents are unavailable |
| `pstack-comment-sicko` | None | Explicit `read-only` default; live parent restrictions may narrow it further | Prohibited by prompt; setup does not claim it can prove connector isolation | May use `how` and `why` for read-only investigation | Inherit by default; install an explicit pair only after validation | Use the portable prompt in a deliberately constrained generic agent; otherwise skip and report the missing isolation |

Custom-agent defaults never prove the served model, effort, effective sandbox, connector set, or skill availability. A setup receipt describes written configuration only. Runtime receipts must come from an observable Codex surface.

## Model resolution

- No requested pair: omit `model` and `model_reasoning_effort`; both inherit.
- Requested pair plus an observable model list: require an exact model match and require the effort in that model's advertised effort set before writing both fields.
- Requested pair without an observable model list: record `unverified-inheritance`, omit both TOML fields, and show the requested pair only as unverified intent.
- Missing entitlement or unsupported pair: stop without changing profiles. Do not silently select a substitute.

Panel workflows must report reduced diversity when inheritance or unavailable profiles collapse distinct requested roles onto the same observable model. They must not invent a served-model receipt.

## Ownership receipt

Setup records scope, relative path, SHA-256, template source, requested model policy, and configuration-resolution status. Upgrade and uninstall may replace or remove a file only while its current hash matches the receipt. A mismatch requires human review and leaves the file and receipt intact.
