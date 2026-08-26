import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { EXPECTED_SKILL_COUNT, assessSkillCapacity, listSkillRecords, validatePlugin } from "../scripts/validate-plugin.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("all upstream skills are discoverable, unique, standard, and explicit-only", async () => {
  const records = await listSkillRecords(root);
  assert.equal(records.length, EXPECTED_SKILL_COUNT);
  assert.equal(new Set(records.map((record) => record.name)).size, EXPECTED_SKILL_COUNT);

  for (const record of records) {
    assert.deepEqual(Object.keys(record.frontmatter).sort(), ["description", "name"]);
    assert.match(record.name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(record.metadata.policy.products.join(","), "CODEX");
    assert.equal(record.metadata.policy.allow_implicit_invocation, false);
    assert.match(record.metadata.interface.default_prompt, new RegExp(`\\$${record.name}\\b`));
  }
});

test("capacity fallback is deterministic and never drops a skill", async () => {
  const report = await validatePlugin(root, { probeBun: false });
  const records = await listSkillRecords(root);
  assert.deepEqual(report.errors, []);
  assert.equal(report.inventory.discovered, records.length);
  assert.equal(report.inventory.capacity.evaluated, records.length);
  assert.equal(
    records.every((record) => `${report.plugin}:${record.name}`.length <= report.inventory.capacity.identityLimit),
    true,
  );
  assert.equal(report.inventory.capacity.status, "fits-with-normalized-aliases");
  assert.deepEqual(report.inventory.capacity.aliases, {
    "principle-migrate-callers-then-delete-legacy-apis": "principle-migrate-callers-delete-legacy-apis",
    "principle-separate-before-serializing-shared-state": "principle-separate-shared-state",
  });
  assert.equal(report.inventory.capacity.dropped.length, 0);
});

test("capacity results are computed from the plugin identity and discovered records", () => {
  const overLimitName = "x".repeat(65);
  const report = assessSkillCapacity("pstack-for-codex", [
    { directory: "long-upstream-name", name: "short-name" },
    { directory: overLimitName, name: overLimitName },
  ]);
  assert.equal(report.evaluated, 2);
  assert.equal(report.status, "exceeds-identity-limit");
  assert.deepEqual(report.aliases, { "long-upstream-name": "short-name" });
  assert.deepEqual(report.dropped, [overLimitName]);
});
