import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { installAgents, scanAgentNames } from "../skills/setup-pstack/scripts/manage-agents.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function fixture(t) {
  const temporary = await fs.mkdtemp(path.join(process.env.TMPDIR ?? "/tmp", "pstack-agents-"));
  t.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const projectRoot = path.join(temporary, "project");
  const userHome = path.join(temporary, "home");
  await fs.mkdir(projectRoot, { recursive: true });
  await fs.mkdir(userHome, { recursive: true });
  return { projectRoot, userHome };
}

test("portable prompt assets replace the legacy top-level personas", async () => {
  await assert.rejects(fs.stat(path.join(root, "agents/poteto-agent.md")), { code: "ENOENT" });
  await assert.rejects(fs.stat(path.join(root, "agents/comment-sicko.md")), { code: "ENOENT" });

  const poteto = await fs.readFile(path.join(root, "skills/poteto-mode/references/poteto-agent-prompt.md"), "utf8");
  const comments = await fs.readFile(path.join(root, "skills/no-comments/references/comment-sicko-prompt.md"), "utf8");
  assert.match(poteto, /Read the `poteto-mode` skill's `SKILL\.md` in full/);
  assert.match(comments, /Yes\.\.\. Ha ha ha\.\.\. Yes!/);
});

test("project-scoped templates render supported Codex agent TOML", async (t) => {
  const { projectRoot, userHome } = await fixture(t);
  const result = await installAgents({ pluginRoot: root, projectRoot, userHome, scope: "project" });

  assert.equal(result.status, "installed");
  assert.equal(result.files.length, 2);
  for (const file of result.files) {
    assert.match(file.path, /^\.codex\/agents\/pstack-/);
    const content = await fs.readFile(path.join(projectRoot, file.path), "utf8");
    assert.match(content, /^name = "pstack-/m);
    assert.match(content, /^description = /m);
    assert.match(content, /^developer_instructions = """/m);
    assert.doesNotMatch(content, /\{\{PROMPT\}\}/);
  }
  const commentProfile = await fs.readFile(
    path.join(projectRoot, ".codex/agents/pstack-comment-sicko.toml"),
    "utf8",
  );
  assert.match(commentProfile, /^sandbox_mode = "read-only"$/m);
  assert.match(commentProfile, /Do not use connectors or external network tools/);
});

test("duplicate TOML names are detected across project and user layers regardless of filename", async (t) => {
  const { projectRoot, userHome } = await fixture(t);
  await fs.mkdir(path.join(projectRoot, ".codex/agents"), { recursive: true });
  await fs.mkdir(path.join(userHome, ".codex/agents"), { recursive: true });
  await fs.writeFile(path.join(projectRoot, ".codex/agents/first.toml"), "name = 'same-name'\n");
  await fs.writeFile(path.join(userHome, ".codex/agents/completely-different.toml"), 'name = "same-name"\n');

  const inventory = await scanAgentNames({ projectRoot, userHome });
  assert.equal(inventory.duplicates.length, 1);
  assert.equal(inventory.duplicates[0].name, "same-name");
  await assert.rejects(
    installAgents({ pluginRoot: root, projectRoot, userHome, scope: "project" }),
    /duplicate custom-agent name "same-name"/,
  );
});

test("an existing differently named file with a pstack agent name is never overwritten", async (t) => {
  const { projectRoot, userHome } = await fixture(t);
  await fs.mkdir(path.join(userHome, ".codex/agents"), { recursive: true });
  const unrelated = path.join(userHome, ".codex/agents/my-local-agent.toml");
  await fs.writeFile(unrelated, 'name = "pstack-poteto-agent"\ndeveloper_instructions = "mine"\n');

  await assert.rejects(
    installAgents({ pluginRoot: root, projectRoot, userHome, scope: "project" }),
    /custom-agent name "pstack-poteto-agent" is already owned by/,
  );
  assert.match(await fs.readFile(unrelated, "utf8"), /mine/);
});

test("a model pair is rendered only after the observable list validates it", async (t) => {
  const { projectRoot, userHome } = await fixture(t);
  const requested = { model: "gpt-5.6-sol", reasoning_effort: "high" };
  const result = await installAgents({
    pluginRoot: root,
    projectRoot,
    userHome,
    scope: "project",
    profile: { "pstack-poteto-agent": requested },
    observableModels: [{ slug: "gpt-5.6-sol", reasoning_efforts: ["high"] }],
  });
  const content = await fs.readFile(
    path.join(projectRoot, ".codex/agents/pstack-poteto-agent.toml"),
    "utf8",
  );
  assert.match(content, /^model = "gpt-5\.6-sol"$/m);
  assert.match(content, /^model_reasoning_effort = "high"$/m);
  const policy = result.files.find((file) => file.path.endsWith("pstack-poteto-agent.toml")).model_policy;
  assert.equal(policy.status, "verified-explicit");
  assert.deepEqual(policy.resolved, requested);
});
