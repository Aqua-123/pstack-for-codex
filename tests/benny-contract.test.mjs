import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { activationBlockers, automationDescriptors } from "../automations/benny/scripts/reconcile-state.mjs";
import { EXPECTED_SKILL_COUNT, listSkillRecords } from "../scripts/validate-plugin.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function qualifiedConfig() {
  const adapters = Object.fromEntries(["slack", "tracker", "repository", "draftPr", "control"].map((name) => [name, {
    qualified: true,
    writes: ["slack", "tracker", "draftPr"].includes(name),
    idempotency: "authoritative-lookup",
    credentialRefs: [`env:BENNY_${name.toUpperCase()}`],
  }]));
  const capabilities = Object.fromEntries([
    "slack.read", "slack.thread-reply", "slack.attachments", "tracker.read", "tracker.write",
    "repository.read", "repository.isolated-exec", "repository.network-deny", "draft-pr.create",
    "control.ui", "feature-map.approved", "state.atomic", "state.shared", "operator.approved",
  ].map((key) => [key, true]));
  const canaries = Object.fromEntries(["read-only", "test-channel-triage", "repro-only", "bounded-fix", "concurrent-race", "ambiguous-write"].map((key) => [key, "passed"]));
  return { stateRoot: "/Users/operator/.codex/benny/state/repo", approvedConfigHash: "a".repeat(64), trustedTriageIdentity: "U1", adapters, capabilities, canaries };
}

test("only setup-benny is registered and the inventory includes it", async () => {
  const records = await listSkillRecords(root);
  assert.equal(EXPECTED_SKILL_COUNT, 45);
  assert.equal(records.length, 45);
  assert.equal(records.filter((record) => record.name === "setup-benny").length, 1);
  assert.equal(records.some((record) => record.name === "benny-triage-poll"), false);
  assert.equal(records.some((record) => record.name === "benny-reproduce-poll"), false);
});

test("Benny operational pack is Codex-only and dormant", async () => {
  const files = [
    "automations/benny/FOR_AGENTS.md", "automations/benny/README.md",
    "automations/benny/templates/triage-automation-prompt.md",
    "automations/benny/templates/reproduce-automation-prompt.md",
  ];
  for (const file of files) {
    const content = await fs.readFile(path.join(root, file), "utf8");
    assert.doesNotMatch(content, /\.cursor\/|Cursor automation|\/automate|SendSlackMessage/);
    assert.match(content, /PAUSED|paused/);
  }
  const descriptors = JSON.parse(await fs.readFile(path.join(root, "automations/benny/templates/automations.json"), "utf8"));
  assert.deepEqual(descriptors.map(({ name, status }) => ({ name, status })), [
    { name: "pstack-benny-triage", status: "PAUSED" },
    { name: "pstack-benny-reproduce", status: "PAUSED" },
  ]);
});

test("automation reconciliation preserves stable IDs and never unpauses", () => {
  const config = qualifiedConfig();
  assert.deepEqual(activationBlockers(config), []);
  const first = automationDescriptors(config);
  assert.deepEqual(first.map((item) => item.id), [null, null]);
  const updated = automationDescriptors(config, { triage: "cron-1", reproduce: "cron-2" });
  assert.deepEqual(updated.map((item) => item.id), ["cron-1", "cron-2"]);
  assert.ok(updated.every((item) => item.status === "PAUSED"));
});

test("setup names source-managed, user-owned, retention, credential, and canary boundaries", async () => {
  const setup = await fs.readFile(path.join(root, "skills/setup-benny/SKILL.md"), "utf8");
  for (const phrase of [".codex/automations/benny/", ".codex/benny/", "owner-only", "Preserve user configuration", "credential", "read-only", "ambiguous-write", "PAUSED"]) {
    assert.match(setup, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
});
