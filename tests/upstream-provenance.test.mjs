import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { importUpstream } from "../scripts/import-upstream.mjs";
import { inventoryDirectory, sha256 } from "../scripts/generate-compatibility-report.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("lock records the pinned source and exactly 156 unique SHA-256 entries", async () => {
  const lock = JSON.parse(await fs.readFile(path.join(root, "upstream.lock.json"), "utf8"));
  assert.equal(lock.source.repository, "https://github.com/cursor/plugins");
  assert.equal(lock.source.subdirectory, "pstack");
  assert.equal(lock.source.commit, "bdf7aa355337897f167153e05069aca505dae17c");
  assert.equal(lock.source.version, "0.14.3");
  assert.equal(lock.source.license, "MIT");
  assert.equal(lock.inventory.fileCount, 156);
  assert.equal(lock.files.length, 156);
  assert.equal(new Set(lock.files.map((file) => file.path)).size, 156);
  for (const file of lock.files) assert.match(file.sha256, /^[a-f0-9]{64}$/);
});

test("local import verifies hashes and refuses to overwrite a destination", async (context) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "pstack-import-test-"));
  context.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const source = path.join(temporary, "source");
  const destination = path.join(temporary, "snapshot");
  await fs.mkdir(source);
  await fs.writeFile(path.join(source, "alpha.md"), "alpha\n");
  const lockPath = path.join(temporary, "lock.json");
  await fs.writeFile(lockPath, JSON.stringify({ files: [{ path: "alpha.md", sha256: sha256("alpha\n") }] }));

  const dryRun = await importUpstream({ source, lock: lockPath, output: destination, dryRun: true });
  assert.equal(dryRun.fileCount, 1);
  await assert.rejects(fs.stat(destination), { code: "ENOENT" });

  await importUpstream({ source, lock: lockPath, output: destination, dryRun: false });
  assert.deepEqual(await inventoryDirectory(destination), await inventoryDirectory(source));
  await assert.rejects(
    importUpstream({ source, output: destination, dryRun: false }),
    /Refusing to overwrite existing output/,
  );
});

test("a hash mismatch blocks import before it creates output", async (context) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "pstack-import-mismatch-"));
  context.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const source = path.join(temporary, "source");
  const destination = path.join(temporary, "snapshot");
  await fs.mkdir(source);
  await fs.writeFile(path.join(source, "alpha.md"), "changed\n");
  const lockPath = path.join(temporary, "lock.json");
  await fs.writeFile(lockPath, JSON.stringify({ files: [{ path: "alpha.md", sha256: sha256("original\n") }] }));
  await assert.rejects(importUpstream({ source, lock: lockPath, output: destination }), /changed: alpha.md/);
  await assert.rejects(fs.stat(destination), { code: "ENOENT" });
});
