import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const enabled = process.env.PSTACK_RUN_INSTALLED_SMOKE === "1";

function codex(args, codexHome, json = true) {
  let output;
  try {
    output = execFileSync("codex", args, {
      env: { ...process.env, CODEX_HOME: codexHome },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error("Codex CLI prerequisite is unavailable; the release gate fails closed", { cause: error });
    }
    throw error;
  }
  return json ? JSON.parse(output) : output.trim();
}

async function pathExists(target) {
  try {
    await fs.stat(target);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function filesBelow(target) {
  const result = [];
  async function visit(directory) {
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile()) result.push(absolute);
    }
  }
  await visit(target);
  return result;
}

test("clean Codex profile installs, validates, and tears down the complete plugin", { skip: !enabled }, async (context) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "pstack-installed-smoke-"));
  context.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const codexHome = path.join(temporary, "codex-home");
  const marketplaceRoot = path.join(temporary, "marketplace");
  const projectRoot = path.join(temporary, "project");
  const userHome = path.join(temporary, "user-home");
  const pluginSource = path.join(marketplaceRoot, "pstack-for-codex");
  await Promise.all([
    fs.mkdir(codexHome, { recursive: true }),
    fs.mkdir(projectRoot, { recursive: true }),
    fs.mkdir(userHome, { recursive: true }),
  ]);
  await fs.cp(root, pluginSource, {
    recursive: true,
    filter: (source) => !source.split(path.sep).some((part) => part === ".git" || part === "node_modules"),
  });
  const sourceManifest = JSON.parse(await fs.readFile(path.join(pluginSource, ".codex-plugin/plugin.json"), "utf8"));
  const pluginId = `${sourceManifest.name}@pstack-for-codex-local`;

  const version = codex(["--version"], codexHome, false);
  assert.match(version, /^codex-cli \d+\.\d+\.\d+/);
  context.diagnostic(`installed smoke Codex: ${version}; runtime skill index: unavailable offline; models: unverified/inherited; live connectors: not exercised`);

  const market = codex(["plugin", "marketplace", "add", pluginSource, "--json"], codexHome);
  assert.equal(market.marketplaceName, "pstack-for-codex-local");
  const available = codex(["plugin", "list", "--available", "--json"], codexHome);
  assert.deepEqual(available.available.map((entry) => entry.pluginId), [pluginId]);
  assert.equal(available.available[0].version, sourceManifest.version);

  const installation = codex(["plugin", "add", pluginId, "--json"], codexHome);
  assert.equal(installation.version, sourceManifest.version);
  const installedRoot = installation.installedPath;
  assert.equal(path.isAbsolute(installedRoot), true);
  assert.equal(await pathExists(installedRoot), true);
  assert.ok((await filesBelow(installedRoot)).length > 0);
  assert.ok(await pathExists(path.join(installedRoot, ".codex-plugin/plugin.json")));
  assert.equal(await pathExists(path.join(installedRoot, "node_modules")), false);
  assert.equal(await pathExists(path.join(installedRoot, ".git")), false);

  const validator = await import(`${pathToFileURL(path.join(installedRoot, "scripts/validate-plugin.mjs")).href}?smoke=${Date.now()}`);
  const validation = await validator.validatePlugin(installedRoot, { probeBun: true });
  assert.deepEqual(validation.errors, []);
  const records = await validator.listSkillRecords(installedRoot);
  assert.equal(validation.inventory.discovered, records.length);
  assert.equal(validation.inventory.capacity.evaluated, records.length);
  assert.equal(
    records.every((record) => `${validation.plugin}:${record.name}`.length <= validation.inventory.capacity.identityLimit),
    true,
  );
  assert.equal(validation.inventory.capacity.dropped.length, 0);
  assert.equal(records.every((record) => record.metadata.policy.allow_implicit_invocation === false), true);
  const representative = JSON.parse(await fs.readFile(path.join(installedRoot, "evals/cases/representative.yaml"), "utf8"));
  assert.deepEqual(
    new Set(representative.cases.map((entry) => entry.category)),
    new Set(["direct", "indirect", "incomplete-input", "negative-trigger", "unsupported-action", "setup", "hook", "connector-boundary"]),
  );
  assert.ok(await pathExists(path.join(installedRoot, "evals/rubrics/behavioral-parity.md")));

  const setup = await import(`${pathToFileURL(path.join(installedRoot, "skills/setup-pstack/scripts/manage-agents.mjs")).href}?smoke=${Date.now()}`);
  const projectInstall = await setup.installAgents({ pluginRoot: installedRoot, projectRoot, userHome, scope: "project" });
  assert.equal(projectInstall.files.length, 2);
  assert.equal((await setup.uninstallAgents({ projectRoot, userHome, scope: "project" })).status, "uninstalled");
  const userInstall = await setup.installAgents({ pluginRoot: installedRoot, projectRoot, userHome, scope: "user" });
  assert.equal(userInstall.files.length, 2);
  assert.equal((await setup.uninstallAgents({ projectRoot, userHome, scope: "user" })).status, "uninstalled");

  const hook = await import(`${pathToFileURL(path.join(installedRoot, "hooks/scripts/poteto-mode-state.mjs")).href}?smoke=${Date.now()}`);
  const status = await import(`${pathToFileURL(path.join(installedRoot, "scripts/poteto-hook-status.mjs")).href}?smoke=${Date.now()}`);
  const pluginData = path.join(temporary, "plugin-data");
  const input = { hook_event_name: "UserPromptSubmit", session_id: "smoke-a", cwd: projectRoot, prompt: "$poteto-mode verify" };
  assert.match((await hook.handleHook(input, { pluginData })).hookSpecificOutput.additionalContext, /sticky receipt/);
  assert.equal((await status.hookStatus({ pluginData, sessionId: "smoke-a", cwd: projectRoot })).status, "active");
  assert.equal(await hook.handleHook({ ...input, session_id: "smoke-b", prompt: "continue" }, { pluginData }), null);
  await hook.handleHook({ ...input, prompt: "disable $poteto-mode" }, { pluginData });
  assert.equal((await status.hookStatus({ pluginData, sessionId: "smoke-a", cwd: projectRoot })).status, "current-turn-only");

  const removed = codex(["plugin", "remove", pluginId, "--json"], codexHome);
  assert.equal(removed.pluginId, pluginId);
  assert.equal(await pathExists(installedRoot), false);
  codex(["plugin", "marketplace", "remove", "pstack-for-codex-local", "--json"], codexHome);
  const after = codex(["plugin", "list", "--available", "--json"], codexHome);
  assert.deepEqual(after, { installed: [], available: [] });
  assert.deepEqual(await filesBelow(path.join(codexHome, "plugins/cache/pstack-for-codex-local")), []);
  assert.equal(await pathExists(path.join(projectRoot, ".codex/pstack-for-codex-agent-receipt.json")), false);
  assert.equal(await pathExists(path.join(userHome, ".codex/pstack-for-codex-agent-receipt.json")), false);
});
