import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { EXPECTED_SKILL_COUNT, validatePlugin } from "../scripts/validate-plugin.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("skill resources resolve from an installed cache-like copy", async (context) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "pstack-installed-cache-"));
  context.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const installed = path.join(temporary, "pstack-for-codex", "0.1.0");
  await fs.cp(root, installed, {
    recursive: true,
    filter: (source) => !source.split(path.sep).includes(".git"),
  });

  const report = await validatePlugin(installed, { probeBun: true });
  assert.deepEqual(report.errors, []);
  assert.equal(report.inventory.discovered, EXPECTED_SKILL_COUNT);
  assert.match(report.capabilities.bun.status, /^(available|unavailable)$/);
  assert.equal(typeof report.capabilities.bun.detail, "string");
});

test("a missing installed resource fails with its owning skill", async (context) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "pstack-resource-test-"));
  context.after(() => fs.rm(temporary, { recursive: true, force: true }));
  await fs.cp(root, temporary, {
    recursive: true,
    filter: (source) => !source.split(path.sep).includes(".git"),
  });
  await fs.rm(path.join(temporary, "skills/architect/references/design-red-flags.md"));

  const report = await validatePlugin(temporary, { probeBun: false });
  assert.match(report.errors.join("\n"), /architect.*references\/design-red-flags\.md/);
});
