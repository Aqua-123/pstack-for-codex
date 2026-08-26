import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  CLEANUP_CONCURRENCY,
  DEFAULT_TTL_MS,
  STATE_SCHEMA,
  classifyPrompt,
  collectExpired,
  handleHook,
  projectFingerprint,
  readActiveState,
  removeStateAndReceipt,
  statePaths,
} from "../hooks/scripts/poteto-mode-state.mjs";
import { handleSubagentHook } from "../hooks/scripts/poteto-subagent-context.mjs";
import { hookStatus } from "../scripts/poteto-hook-status.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = path.join(root, "tests/fixtures/hooks");

async function fixture(t) {
  const pluginData = await fs.mkdtemp(path.join(os.tmpdir(), "pstack-poteto-hooks-"));
  t.after(() => fs.rm(pluginData, { recursive: true, force: true }));
  const load = async (name) => JSON.parse(await fs.readFile(path.join(fixtureRoot, name), "utf8"));
  return { pluginData, load };
}

test("hook manifest uses current Codex events and exact Poteto matcher", async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(root, "hooks/hooks.json"), "utf8"));
  assert.deepEqual(Object.keys(manifest.hooks).sort(), ["SessionEnd", "SessionStart", "SubagentStart", "UserPromptSubmit"]);
  assert.equal(manifest.hooks.SessionStart[0].matcher, "resume|compact");
  assert.equal(manifest.hooks.SubagentStart[0].matcher, "^pstack-poteto-agent$");
  assert.match(manifest.hooks.UserPromptSubmit[0].hooks[0].command, /\$PLUGIN_ROOT/);
  assert.equal("matcher" in manifest.hooks.UserPromptSubmit[0], false);
});

test("only a leading explicit invocation activates and the disable phrase is exact", () => {
  assert.equal(classifyPrompt("$poteto-mode build it"), "activate");
  assert.equal(classifyPrompt("  $poteto-mode\ncontinue"), "activate");
  assert.equal(classifyPrompt("disable $poteto-mode"), "disable");
  assert.equal(classifyPrompt("Disable $poteto-mode."), "disable");
  assert.equal(classifyPrompt("disable $poteto-mode now"), "inactive");
  assert.equal(classifyPrompt("please disable $poteto-mode"), "inactive");
  assert.equal(classifyPrompt("I mentioned $poteto-mode casually"), "inactive");
  assert.equal(classifyPrompt("`$poteto-mode` is the invocation"), "inactive");
  assert.equal(classifyPrompt("poteto mode please"), "inactive");
});

test("activation is session isolated and later turns survive resume and compaction", async (t) => {
  const { pluginData, load } = await fixture(t);
  const activation = await load("activate.json");
  const receipt = await handleHook(activation, { pluginData, now: 1_000 });
  assert.match(receipt.hookSpecificOutput.additionalContext, /sticky receipt/);

  const later = await handleHook(await load("later-turn.json"), { pluginData, now: 2_000 });
  assert.match(later.hookSpecificOutput.additionalContext, /active for this session/);
  const concurrent = await handleHook({ ...activation, session_id: "thr_other", prompt: "continue" }, { pluginData, now: 2_000 });
  assert.equal(concurrent, null);

  const compactContinuation = await handleHook({
    ...activation,
    hook_event_name: "SessionStart",
    source: "compact",
  }, { pluginData, now: 3_000 });
  assert.match(compactContinuation.hookSpecificOutput.additionalContext, /active for this resumed or compacted session/);
  assert.equal((compactContinuation.hookSpecificOutput.additionalContext.match(/Poteto Mode/g) ?? []).length, 1);

  const resumed = await handleHook({
    ...activation,
    hook_event_name: "SessionStart",
    source: "resume",
  }, { pluginData, now: 4_000 });
  assert.match(resumed.hookSpecificOutput.additionalContext, /active for this resumed/);
});

test("concurrent activation writes remain atomic and task-local", async (t) => {
  const { pluginData, load } = await fixture(t);
  const activation = await load("activate.json");
  const inputs = Array.from({ length: 30 }, (_, index) => ({
    ...activation,
    session_id: `thr_concurrent_${index % 3}`,
    turn_id: `turn_${index}`,
  }));
  await Promise.all(inputs.map((input, index) => handleHook(input, { pluginData, now: 10_000 + index })));
  for (let index = 0; index < 3; index += 1) {
    const targets = statePaths(pluginData, `thr_concurrent_${index}`);
    const state = JSON.parse(await fs.readFile(targets.state, "utf8"));
    assert.equal(state.schema, STATE_SCHEMA);
    assert.equal(state.active, true);
  }
  const files = await fs.readdir(path.join(pluginData, "poteto-mode/sessions"));
  assert.equal(files.some((name) => name.endsWith(".tmp")), false);
});

test("explicit opt-out removes this session and its delegate context", async (t) => {
  const { pluginData, load } = await fixture(t);
  await handleHook(await load("activate.json"), { pluginData, now: 1_000 });
  await handleHook(await load("disable.json"), { pluginData, now: 2_000 });
  assert.equal(await handleHook(await load("later-turn.json"), { pluginData, now: 3_000 }), null);
  assert.equal(await handleSubagentHook(await load("poteto-subagent.json"), {
    pluginData,
    pluginRoot: root,
    now: 3_000,
  }), null);
});

test("opt-out removes authority state before its ancillary receipt and propagates failure", async () => {
  const removed = [];
  const failure = Object.assign(new Error("receipt unavailable"), { code: "EIO" });
  await assert.rejects(
    removeStateAndReceipt({ state: "authority.json", receipt: "receipt.json" }, async (target) => {
      removed.push(target);
      if (target === "receipt.json") throw failure;
    }),
    failure,
  );
  assert.deepEqual(removed, ["authority.json", "receipt.json"]);
});

test("only the exact Poteto delegate receives portable context", async (t) => {
  const { pluginData, load } = await fixture(t);
  await handleHook(await load("activate.json"), { pluginData, now: 1_000 });
  const generic = await handleSubagentHook(await load("generic-subagent.json"), { pluginData, pluginRoot: root, now: 2_000 });
  assert.equal(generic, null);
  const poteto = await handleSubagentHook(await load("poteto-subagent.json"), { pluginData, pluginRoot: root, now: 2_000 });
  assert.match(poteto.hookSpecificOutput.additionalContext, /Poteto agent prompt/);
  assert.match(poteto.hookSpecificOutput.additionalContext, /Do not infer write/);
});

test("session end is advisory and keeps resumable state", async (t) => {
  const { pluginData, load } = await fixture(t);
  const activation = await load("activate.json");
  await handleHook(activation, { pluginData, now: 1_000 });
  await handleHook({ ...activation, hook_event_name: "SessionEnd", reason: "other" }, { pluginData, now: 2_000 });
  const resumed = await handleHook({ ...activation, prompt: "continue after resume" }, { pluginData, now: 3_000 });
  assert.match(resumed.hookSpecificOutput.additionalContext, /active for this session/);
});

test("malformed identifiers fail closed while unusual safe identities are hashed", async (t) => {
  const { pluginData, load } = await fixture(t);
  const activation = await load("activate.json");
  assert.equal(await handleHook({ ...activation, session_id: "" }, { pluginData }), null);
  assert.equal(await handleHook({ ...activation, session_id: "x".repeat(513) }, { pluginData }), null);
  assert.equal(await handleHook({ ...activation, cwd: "bad\0cwd" }, { pluginData }), null);
  await handleHook({ ...activation, session_id: "../../unexpected/new:id" }, { pluginData, now: 1_000 });
  const targets = statePaths(pluginData, "../../unexpected/new:id");
  assert.match(targets.state, /[a-f0-9]{64}\.json$/);
  assert.equal(path.dirname(targets.state), path.join(pluginData, "poteto-mode/sessions"));
  assert.equal((await readActiveState({ pluginData, sessionId: "../../unexpected/new:id", cwd: activation.cwd, now: 2_000 }))?.active, true);
});

test("stale schema and TTL state are collected without global fallback", async (t) => {
  const { pluginData, load } = await fixture(t);
  const activation = await load("activate.json");
  const targets = statePaths(pluginData, activation.session_id);
  await fs.mkdir(path.dirname(targets.state), { recursive: true });
  await fs.writeFile(targets.state, JSON.stringify({ schema: 0, active: true, updatedAt: new Date(1_000).toISOString() }));
  assert.equal(await handleHook({ ...activation, prompt: "continue" }, { pluginData, now: 2_000 }), null);
  await assert.rejects(fs.stat(targets.state), { code: "ENOENT" });

  await handleHook(activation, { pluginData, now: 10_000 });
  assert.equal(await handleHook({ ...activation, prompt: "continue" }, {
    pluginData,
    now: 10_000 + DEFAULT_TTL_MS + 1,
  }), null);
});

test("definitively malformed state is deleted", async (t) => {
  const { pluginData, load } = await fixture(t);
  const activation = await load("activate.json");
  const targets = statePaths(pluginData, activation.session_id);
  await fs.mkdir(path.dirname(targets.state), { recursive: true });
  await fs.writeFile(targets.state, "{not-json\n");

  assert.equal(await readActiveState({
    pluginData,
    sessionId: activation.session_id,
    cwd: activation.cwd,
    now: 2_000,
  }), null);
  await assert.rejects(fs.stat(targets.state), { code: "ENOENT" });
});

test("transient cleanup read errors retain persisted state and propagate", async () => {
  const removed = [];
  const failure = Object.assign(new Error("temporary read failure"), { code: "EIO" });
  const fileSystem = {
    async readdir(directory) {
      return directory.endsWith("sessions")
        ? [{ name: "state.json", isFile: () => true }]
        : [];
    },
    async readFile() {
      throw failure;
    },
    async rm(target) {
      removed.push(target);
    },
  };

  await assert.rejects(
    collectExpired("/plugin-data", 10_000, DEFAULT_TTL_MS, { fileSystem }),
    failure,
  );
  assert.deepEqual(removed, []);
});

test("expired-state cleanup bounds concurrent filesystem reads", async () => {
  const entryCount = CLEANUP_CONCURRENCY * 3;
  let activeReads = 0;
  let maximumReads = 0;
  const removed = [];
  const fileSystem = {
    async readdir(directory) {
      if (!directory.endsWith("sessions")) return [];
      return Array.from({ length: entryCount }, (_, index) => ({
        name: `${index}.json`,
        isFile: () => true,
      }));
    },
    async readFile() {
      activeReads += 1;
      maximumReads = Math.max(maximumReads, activeReads);
      await new Promise((resolve) => setImmediate(resolve));
      activeReads -= 1;
      return JSON.stringify({ schema: STATE_SCHEMA, updatedAt: new Date(0).toISOString() });
    },
    async rm(target) {
      removed.push(target);
    },
  };

  await collectExpired("/plugin-data", DEFAULT_TTL_MS + 1, DEFAULT_TTL_MS, { fileSystem });
  assert.equal(maximumReads, CLEANUP_CONCURRENCY);
  assert.equal(removed.length, entryCount);
});

test("a project fingerprint mismatch never leaks activation", async (t) => {
  const { pluginData, load } = await fixture(t);
  const activation = await load("activate.json");
  await handleHook(activation, { pluginData, now: 1_000 });
  assert.equal(await handleHook({ ...activation, cwd: "/workspace/project-b", prompt: "continue" }, { pluginData, now: 2_000 }), null);
  const original = await readActiveState({ pluginData, sessionId: activation.session_id, cwd: activation.cwd, now: 2_000 });
  assert.equal(original.active, true);
  assert.notEqual(projectFingerprint(activation.cwd), projectFingerprint("/workspace/project-b"));
});

test("status requires both active state and a current trusted-hook receipt", async (t) => {
  const { pluginData, load } = await fixture(t);
  const activation = await load("activate.json");
  assert.deepEqual(await hookStatus({ pluginData, sessionId: activation.session_id, cwd: activation.cwd, now: 1_000 }), {
    status: "current-turn-only",
    reason: "inactive-or-invalid-state",
  });
  await handleHook(activation, { pluginData, now: 2_000 });
  assert.equal((await hookStatus({ pluginData, sessionId: activation.session_id, cwd: activation.cwd, now: 3_000 })).status, "active");
  await fs.rm(statePaths(pluginData, activation.session_id).receipt);
  assert.deepEqual(await hookStatus({ pluginData, sessionId: activation.session_id, cwd: activation.cwd, now: 3_000 }), {
    status: "current-turn-only",
    reason: "trusted-hook-receipt-missing",
  });
});

test("inactive and malformed hook input produce no output or state", async (t) => {
  const { pluginData, load } = await fixture(t);
  const activation = await load("activate.json");
  const before = process.hrtime.bigint();
  assert.equal(await handleHook({ ...activation, prompt: "we can discuss poteto mode later" }, { pluginData }), null);
  assert.equal(await handleHook(null, { pluginData }), null);
  const elapsedMs = Number(process.hrtime.bigint() - before) / 1e6;
  assert.ok(elapsedMs < 100, `inactive path took ${elapsedMs.toFixed(2)}ms`);
  await assert.rejects(fs.stat(path.join(pluginData, "poteto-mode")), { code: "ENOENT" });
});
