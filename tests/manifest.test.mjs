import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { validateManifest, validateMarketplace } from "../scripts/validate-plugin.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("Codex manifest and repo marketplace expose the root plugin", async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(root, ".codex-plugin/plugin.json"), "utf8"));
  const marketplace = JSON.parse(await fs.readFile(path.join(root, ".agents/plugins/marketplace.json"), "utf8"));

  assert.deepEqual(await validateManifest(root, manifest), []);
  assert.deepEqual(await validateMarketplace(root, marketplace), []);
  assert.equal(manifest.name, "pstack-for-codex");
  assert.equal(manifest.skills, "./skills/");
  assert.equal(marketplace.plugins[0].source.path, "./");
  await assert.rejects(fs.stat(path.join(root, ".cursor-plugin/plugin.json")), { code: "ENOENT" });
});

test("manifest validation rejects unsupported fields and unsafe paths", async (context) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "pstack-manifest-test-"));
  context.after(() => fs.rm(temporary, { recursive: true, force: true }));
  await fs.mkdir(path.join(temporary, "skills"));

  const errors = await validateManifest(temporary, {
    name: "pstack-for-codex",
    version: "0.1.0",
    description: "test",
    skills: "../skills",
    agents: "./agents/",
  });
  assert.match(errors.join("\n"), /unsupported manifest field: agents/);
  assert.match(errors.join("\n"), /skills path must be \.\/skills\//);
});
