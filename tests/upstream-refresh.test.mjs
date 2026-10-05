import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checker = path.join(root, "skills/poteto-mode/scripts/check-plan.mjs");

test("plan checker accepts inherited or concrete Codex roles and rejects missing roles and stale cadence", async (context) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "pstack-plan-refresh-"));
  context.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const playbook = await fs.readFile(path.join(root, "skills/poteto-mode/playbooks/multi-phase-plan.md"), "utf8");
  const plan = playbook.split("````markdown\n")[1].split("\n````")[0].replace(/<[^>]+>/g, "fixture");
  const fixture = path.join(temporary, "plan.md");
  async function run(content) {
    await fs.writeFile(fixture, content);
    return spawnSync(process.execPath, [checker, fixture], { encoding: "utf8" });
  }
  const inherited = await run(plan);
  assert.equal(inherited.status, 0, inherited.stderr);
  assert.match(inherited.stdout, /1 PR sections, 0 problems/);
  const concrete = await run(plan.replaceAll("the configured fast profile", "`gpt-6.1-sol`"));
  assert.equal(concrete.status, 0, concrete.stderr);
  const missing = await run(plan.replaceAll("the configured fast profile", "`<swarm workers model>`"));
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /model filled in/);
  const stale = await run(plan.replaceAll("hourly audit", "30-minute audit"));
  assert.equal(stale.status, 1);
  assert.match(stale.stderr, /hourly audit/);
});

test("decision log initializes an empty file and preserves prior rows on append", async (context) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "pstack-log-refresh-"));
  context.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const log = path.join(temporary, "decisions.tsv");
  const script = path.join(root, "skills/show-me-your-work/scripts/log.sh");
  await fs.writeFile(log, "");
  const first = spawnSync(script, [log, "start", "first", "reason", "artifact", "passed"], { encoding: "utf8" });
  assert.equal(first.status, 0, first.stderr);
  const original = await fs.readFile(log, "utf8");
  assert.equal(original.split("\n").filter(Boolean).length, 2);
  assert.equal(original.split("\n")[0], "ts\tphase\tdecision\twhy\tevidence\tresult");
  const next = spawnSync(script, [log, "check", "=unsafe\tcell", "line\nbreak", "artifact", "passed"], { encoding: "utf8" });
  assert.equal(next.status, 0, next.stderr);
  const current = await fs.readFile(log, "utf8");
  assert.equal(current.startsWith(original), true);
  assert.equal(current.split("\n").filter(Boolean).length, 3);
  assert.match(current, /'\=unsafe cell\tline break\tartifact\tpassed/);
});

test("refresh ledger pins every source delta and all four additions", async () => {
  const map = JSON.parse(await fs.readFile(path.join(root, "compatibility/pstack-map.json"), "utf8"));
  const previous = new Map(map.refresh.fromFiles.map((entry) => [entry.path, entry.sha256]));
  const lock = JSON.parse(await fs.readFile(path.join(root, "upstream.lock.json"), "utf8"));
  const current = new Map(lock.files.map((entry) => [entry.path, entry.sha256]));
  const changed = [...current].filter(([name, hash]) => previous.get(name) !== hash);
  assert.equal(changed.length, 56);
  assert.deepEqual(new Set(map.refreshDecisions.map((entry) => entry.path)), new Set(changed.map(([name]) => name)));
  assert.deepEqual(map.refreshDecisions.filter((entry) => entry.kind === "added").map((entry) => entry.path).sort(), [
    "skills/benchmark-checklist/SKILL.md",
    "skills/correct/SKILL.md",
    "skills/poteto-help/SKILL.md",
    "skills/principle-explain-the-number/SKILL.md",
  ]);
  for (const decision of map.refreshDecisions) {
    assert.equal(decision.oldSha256, previous.get(decision.path) ?? null);
    assert.equal(decision.newSha256, current.get(decision.path));
  }
});
