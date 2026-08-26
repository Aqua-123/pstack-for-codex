import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildCompatibilityMap,
  buildLock,
  renderReport,
  sha256,
  validateCompatibility,
} from "../scripts/generate-compatibility-report.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("every locked upstream path has one complete compatibility entry", async () => {
  const lock = JSON.parse(await fs.readFile(path.join(root, "upstream.lock.json"), "utf8"));
  const map = JSON.parse(await fs.readFile(path.join(root, "compatibility/pstack-map.json"), "utf8"));
  const result = validateCompatibility(lock, map);
  assert.deepEqual(result.errors, []);
  assert.equal(map.entries.length, 156);
  assert.equal(new Set(map.entries.map((entry) => entry.upstreamPath)).size, 156);
});

test("new upstream files block promotion until classified", () => {
  const fixture = fixtureContract();
  const result = validateCompatibility(fixture.lock, fixture.map, [
    fixture.lock.files[0],
    { path: "new.md", sha256: sha256("new\n"), bytes: 4 },
  ]);
  assert.match(result.errors.join("\n"), /upstream added requires an explicit compatibility disposition: new.md/);
});

test("deleted or renamed upstream files require a reviewed disposition", () => {
  const fixture = fixtureContract();
  const blocked = validateCompatibility(fixture.lock, fixture.map, []);
  assert.match(blocked.errors.join("\n"), /deleted-or-renamed.*alpha.md/);

  fixture.map.entries[0].refreshDisposition = {
    upstreamSha256: null,
    disposition: "retained-as-codex-adaptation",
    rationale: "Codex still requires the derived behavior",
  };
  const reviewed = validateCompatibility(fixture.lock, fixture.map, []);
  assert.deepEqual(reviewed.errors, []);
  assert.equal(reviewed.deltas[0].review, "recorded");
});

test("changed upstream and derived paths are reported without modifying the derived tree", () => {
  const fixture = fixtureContract();
  const baseDerived = [{ path: "alpha.md", sha256: sha256("Codex v1\n"), bytes: 9 }];
  const currentDerived = [{ path: "alpha.md", sha256: sha256("Codex v2\n"), bytes: 9 }];
  const before = JSON.stringify(currentDerived);
  const candidate = [{ path: "alpha.md", sha256: sha256("upstream v2\n"), bytes: 12 }];
  const blocked = validateCompatibility(fixture.lock, fixture.map, candidate, {
    baseFiles: baseDerived,
    currentFiles: currentDerived,
  });
  const report = renderReport(fixture.lock, fixture.map, blocked);
  assert.match(report, /alpha\.md.*changed.*required/);
  assert.match(report, /alpha\.md.*alpha\.md.*changed.*review required/);
  assert.equal(JSON.stringify(currentDerived), before);

  fixture.map.entries[0].refreshDisposition = {
    upstreamSha256: candidate[0].sha256,
    disposition: "manual-three-way-review",
    rationale: "retain the Codex behavior while reviewing the upstream change",
  };
  assert.deepEqual(validateCompatibility(fixture.lock, fixture.map, candidate).errors, []);
});

function fixtureContract() {
  const files = [{ path: "alpha.md", sha256: sha256("upstream v1\n"), bytes: 12 }];
  const lock = buildLock(files, {
    repository: "https://example.test/upstream",
    subdirectory: "pstack",
    commit: "a".repeat(40),
    version: "1.0.0",
    retrievedAt: "2026-08-26",
  });
  return { lock, map: buildCompatibilityMap(lock) };
}
