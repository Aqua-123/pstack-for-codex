import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  advanceHighWater, collectFixedCutoffPages, deadLetter, initialState, operationKey, readState, reconcileEffect, replayDeadLetter,
  operationLookupKeys, reportId, retryDelaySeconds, selectPollBatch, validateStateRoot, withStateLease, writeStateAtomic,
} from "../automations/benny/scripts/reconcile-state.mjs";
import { parseReplayArgs } from "../automations/benny/scripts/replay-report.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pages = JSON.parse(await fs.readFile(path.join(root, "tests/fixtures/benny/poll-pages.json"), "utf8"));
const effectConfig = { sourceChannelId: "C1", operationsChannelId: "C-OPS", repository: "org/repo", maxOutboundBytes: 4096 };

function effect(report, type = "tracker-upsert") {
  return { schemaVersion: 1, type, reportId: report.reportId, operationKey: operationKey(report.reportId, type), repository: "org/repo", payload: { summary: "bounded", sourceUrl: "https://slack.example/thread" } };
}

test("polling fully combines pages, uses provider ordering, cutoff, overlap, and batch limits", () => {
  const state = initialState();
  state.highWater = { providerTs: "100", providerId: "m-0" };
  const selected = selectPollBatch(pages, state, { cutoff: "100.5", overlapSeconds: 2, batchLimit: 3 });
  assert.deepEqual(selected.map((item) => item.providerId), ["m-old", "m-a", "m-b"]);
});

test("terminal overlap does not starve reports beyond the batch limit", () => {
  const items = Array.from({ length: 7 }, (_, index) => ({ workspaceId: "W1", channelId: "C1", rootTs: String(100 + index), providerTs: String(100 + index), providerId: `m-${index}` }));
  const state = initialState();
  const first = selectPollBatch([items], state, { cutoff: "200", overlapSeconds: 200, batchLimit: 3 });
  for (const item of first) state.reports[reportId(item)] = { status: "reconciled" };
  advanceHighWater(state, first);
  assert.deepEqual(selectPollBatch([items], state, { cutoff: "200", overlapSeconds: 200, batchLimit: 3 }).map((item) => item.providerId), ["m-3", "m-4", "m-5"]);
});

test("fixed-cutoff pagination fails closed on a mid-page error", async () => {
  const calls = [];
  const fetched = await collectFixedCutoffPages(async ({ cursor, cutoff }) => {
    calls.push({ cursor, cutoff });
    return cursor ? { items: pages[1], nextCursor: null } : { items: pages[0], nextCursor: "page-2" };
  }, { cutoff: "100.5" });
  assert.equal(fetched.length, 2);
  assert.ok(calls.every((call) => call.cutoff === "100.5"));
  await assert.rejects(() => collectFixedCutoffPages(async ({ cursor }) => {
    if (cursor) throw new Error("provider failed mid-page");
    return { items: pages[0], nextCursor: "page-2" };
  }, { cutoff: "100.5" }), /mid-page/);
});

test("watermark stops before pending or quarantined work and can pass a dead letter", () => {
  const selected = selectPollBatch(pages, initialState(), { cutoff: "100.5", overlapSeconds: 200, batchLimit: 10 });
  const state = initialState();
  const ids = selected.map(reportId);
  state.reports[ids[0]] = { status: "reconciled" };
  state.reports[ids[1]] = { status: "pending" };
  state.reports[ids[2]] = { status: "reconciled" };
  assert.deepEqual(advanceHighWater(state, selected), { providerTs: "99.9", providerId: "m-old" });
  deadLetter(state, { ...selected[1], reportId: ids[1] }, "poison");
  assert.deepEqual(advanceHighWater(state, selected), { providerTs: "100.000002", providerId: "m-b" });
});

test("destination lookup makes retry after a partial or ambiguous write effect-once", async () => {
  const report = { reportId: reportId({ workspaceId: "W1", channelId: "C1", rootTs: "1" }) };
  const writes = new Map();
  let first = true;
  const adapter = {
    lookup: async (key) => writes.has(key) ? { status: "confirmed", destinationId: writes.get(key) } : { status: "absent" },
    apply: async (proposal) => {
      writes.set(proposal.operationKey, "TRACK-1");
      if (first) { first = false; const error = new Error("timeout after commit"); error.code = "AMBIGUOUS"; throw error; }
      throw new Error("duplicate apply must not run");
    },
  };
  assert.equal((await reconcileEffect(adapter, effect(report), effectConfig)).status, "quarantined");
  const retry = await reconcileEffect(adapter, effect(report), effectConfig);
  assert.deepEqual(retry, { status: "confirmed", destinationId: "TRACK-1", reconciled: true });
  assert.equal(writes.size, 1);
});

test("effect version lookup checks current then historical keys before applying", async () => {
  const id = reportId({ workspaceId: "W1", channelId: "C1", rootTs: "versioned" });
  assert.deepEqual(operationLookupKeys(id, "tracker-upsert", 3), [
    operationKey(id, "tracker-upsert", 3), operationKey(id, "tracker-upsert", 2), operationKey(id, "tracker-upsert", 1),
  ]);
});

test("overlapping polls create at most one tracker, verdict, and draft pull request", async () => {
  const report = { reportId: reportId({ workspaceId: "W1", channelId: "C1", rootTs: "5" }) };
  const stores = new Map();
  const adapter = {
    lookup: async (key) => stores.has(key) ? { status: "confirmed", destinationId: stores.get(key) } : { status: "absent" },
    apply: async (proposal) => {
      assert.equal(stores.has(proposal.operationKey), false);
      const id = `destination-${stores.size + 1}`;
      stores.set(proposal.operationKey, id);
      return { status: "confirmed", destinationId: id };
    },
  };
  for (const type of ["tracker-upsert", "thread-verdict", "draft-pr"]) {
    const proposal = { ...effect(report, type), ...(type === "thread-verdict" ? { channelId: "C1", rootTs: "5", sourceRootTs: "5" } : {}) };
    await reconcileEffect(adapter, proposal, effectConfig);
    const second = await reconcileEffect(adapter, proposal, effectConfig);
    assert.equal(second.reconciled, true);
  }
  assert.equal(stores.size, 3);
});

test("retry backoff is bounded and credential revocation stops instead of retrying", async () => {
  assert.deepEqual([1, 2, 3].map((attempt) => retryDelaySeconds(attempt, { baseSeconds: 10, capSeconds: 15, retryLimit: 3 })), [10, 15, 15]);
  assert.throws(() => retryDelaySeconds(4), /bounded/);
  const report = { reportId: reportId({ workspaceId: "W1", channelId: "C1", rootTs: "4" }) };
  const adapter = {
    lookup: async () => ({ status: "absent" }),
    apply: async () => { const error = new Error("revoked xoxb-secret-material"); error.code = "AUTH_REVOKED"; throw error; },
  };
  assert.deepEqual(await reconcileEffect(adapter, effect(report), effectConfig), { status: "blocked", reason: "adapter-authorization-lost" });
});

test("lookup failures are classified and invalid effects are quarantined", async () => {
  const report = { reportId: reportId({ workspaceId: "W1", channelId: "C1", rootTs: "lookup" }) };
  const lookupError = new Error("temporary tracker failure");
  lookupError.code = "ETIMEDOUT";
  assert.deepEqual(await reconcileEffect({ lookup: async () => { throw lookupError; } }, effect(report), effectConfig), { status: "retry", reason: "temporary tracker failure" });
  assert.deepEqual(await reconcileEffect({ lookup: async () => ({ status: "absent" }) }, { ...effect(report), repository: "evil/repo" }, effectConfig), { status: "quarantined", reason: "effect-validation-failed" });
});

test("canonical owner-only state is atomic and a local lease rejects a race", async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "benny-state-"));
  const project = path.join(base, "project");
  const stateRoot = path.join(base, ".codex", "benny", "shared-state");
  await fs.mkdir(project);
  validateStateRoot(stateRoot, project, [path.join(project, "worktree")]);
  await writeStateAtomic(stateRoot, initialState());
  assert.equal((await fs.stat(stateRoot)).mode & 0o077, 0);
  assert.equal((await fs.stat(path.join(stateRoot, "state.json"))).mode & 0o077, 0);
  let release;
  const held = withStateLease(stateRoot, async () => new Promise((resolve) => { release = resolve; }));
  while (!release) await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(() => withStateLease(stateRoot, async () => {}), /already held/);
  release();
  await held;
  assert.equal((await readState(stateRoot)).schemaVersion, 1);
  assert.throws(() => validateStateRoot(path.join(project, ".codex", "benny", "state"), project), /worktree-local/);
});

test("an expired validated lease is recovered while malformed and fresh leases fail closed", async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "benny-lease-"));
  const stateRoot = path.join(base, ".codex", "benny", "state");
  await fs.mkdir(stateRoot, { recursive: true, mode: 0o700 });
  const lock = path.join(stateRoot, "state.lock");
  const expired = { ownerToken: "11111111-1111-4111-8111-111111111111", acquiredAt: 100, expiresAt: 200 };
  await fs.writeFile(lock, JSON.stringify(expired), { mode: 0o600 });
  await withStateLease(stateRoot, (state) => { state.automationIds.recovered = "yes"; }, { now: () => 300, leaseMs: 100 });
  assert.equal((await readState(stateRoot)).automationIds.recovered, "yes");

  await fs.writeFile(lock, JSON.stringify({ ...expired, expiresAt: 500 }), { mode: 0o600 });
  await assert.rejects(() => withStateLease(stateRoot, async () => {}, { now: () => 300 }), /already held/);
  await fs.writeFile(lock, "{}", { mode: 0o600 });
  await assert.rejects(() => withStateLease(stateRoot, async () => {}, { now: () => 600 }), /invalid Benny state lease/);
});

test("state reads reject symlinks, loose permissions, unsupported schemas, and malformed shapes", async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "benny-read-"));
  const rootA = path.join(base, "a");
  await fs.mkdir(rootA);
  const target = path.join(base, "target.json");
  await fs.writeFile(target, JSON.stringify(initialState()), { mode: 0o600 });
  await fs.symlink(target, path.join(rootA, "state.json"));
  await assert.rejects(() => readState(rootA), /regular file/);

  const rootB = path.join(base, "b");
  await fs.mkdir(rootB);
  await fs.writeFile(path.join(rootB, "state.json"), JSON.stringify(initialState()), { mode: 0o644 });
  await assert.rejects(() => readState(rootB), /owner-only/);
  await fs.chmod(path.join(rootB, "state.json"), 0o600);
  await fs.writeFile(path.join(rootB, "state.json"), JSON.stringify({ ...initialState(), schemaVersion: 999 }));
  await assert.rejects(() => readState(rootB), /unsupported/);
  await fs.writeFile(path.join(rootB, "state.json"), JSON.stringify({ ...initialState(), unexpected: true }));
  await assert.rejects(() => readState(rootB), /fields/);
  await fs.writeFile(path.join(rootB, "state.json"), "not json");
  await assert.rejects(() => readState(rootB), /JSON/);
});

test("dead letters continue processing and manual replay is validated and non-destructive", () => {
  const state = initialState();
  const id = reportId({ workspaceId: "W1", channelId: "C1", rootTs: "3" });
  deadLetter(state, { reportId: id }, "bad xoxb-secret-material");
  assert.doesNotMatch(state.deadLetters[id].reason, /xoxb-/);
  replayDeadLetter(state, id);
  assert.equal(state.reports[id].status, "pending");
  assert.equal(state.deadLetters[id], undefined);
  assert.throws(() => replayDeadLetter(state, "invalid"), /invalid report_id/);
});

test("manual replay CLI rejects unknown, duplicate, and value-less flags", () => {
  const valid = ["--state-root", "/tmp/.codex/benny/state", "--project-root", "/tmp/project", "--report-id", `bny_${"a".repeat(64)}`];
  assert.deepEqual(parseReplayArgs(valid), {
    "state-root": "/tmp/.codex/benny/state",
    "project-root": "/tmp/project",
    "report-id": `bny_${"a".repeat(64)}`,
  });
  assert.throws(() => parseReplayArgs([...valid, "--unknown", "value"]), /usage:/);
  assert.throws(() => parseReplayArgs([...valid, "--report-id", "duplicate"]), /usage:/);
  assert.throws(() => parseReplayArgs(["--state-root", "--project-root", "/tmp/project"]), /usage:/);
});
