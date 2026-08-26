import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeRoots = ["skills", "hooks", "automations", "templates"];
const forbidden = [
  [/\.cursor(?:\/|\b)|\.cursor-plugin\//i, "legacy host filesystem contract"],
  [/\bCursor(?:'s)?\b/, "legacy host name"],
  [/\bagent-transcripts\b/i, "private transcript contract"],
  [/\bsubagent_type\b|\brun_in_background\b|\bAskQuestion\b/i, "legacy agent/tool schema"],
  [/(?:^|\s)\/(?:add-plugin|setup-pstack|poteto-mode|how|why|arena|swarm|interrogate|loop|automate)(?:\s|$)/im, "legacy slash command"],
  [/SendSlackMessage|cloud_base_branch|cloud-sleeper/i, "legacy external action contract"],
];

async function filesBelow(relative) {
  const files = [];
  async function visit(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (["node_modules", ".git"].includes(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile() && /\.(?:md|mjs|js|ts|tsx|sh|json|toml|yaml|yml)$/.test(entry.name)) files.push(absolute);
    }
  }
  await visit(path.join(root, relative));
  return files;
}

test("active plugin runtime contains no legacy host contracts", async () => {
  const findings = [];
  for (const runtimeRoot of runtimeRoots) {
    for (const file of await filesBelow(runtimeRoot)) {
      const source = await fs.readFile(file, "utf8");
      for (const [pattern, label] of forbidden) {
        if (pattern.test(source)) findings.push(`${path.relative(root, file)}: ${label}`);
      }
    }
  }
  assert.deepEqual(findings, []);
});

test("legacy input is confined to the declared provenance tooling", async () => {
  const importer = await fs.readFile(path.join(root, "scripts/import-upstream.mjs"), "utf8");
  const adaptation = await fs.readFile(path.join(root, "docs/codex-adaptation.md"), "utf8");
  assert.match(importer, /upstream/i);
  assert.match(adaptation, /original host/);
  assert.doesNotMatch(adaptation, /official Cursor or OpenAI project/i);
});
