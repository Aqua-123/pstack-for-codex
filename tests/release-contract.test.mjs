import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("the default release gate includes offline verification and the installed Codex smoke", async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
  assert.equal(manifest.scripts.test, "npm run verify:release");
  assert.equal(manifest.scripts.verify, "npm run verify:offline");
  assert.match(manifest.scripts["verify:release"], /npm run verify:offline/);
  assert.match(manifest.scripts["verify:release"], /npm run test:installed/);
  assert.match(manifest.scripts["test:installed"], /PSTACK_RUN_INSTALLED_SMOKE=1/);
});
