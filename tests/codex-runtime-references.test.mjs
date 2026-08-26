import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = path.join(root, "skills");

const FORBIDDEN_RUNTIME_PATTERNS = [
  [/\.cursor(?:\/|\b)/i, "Cursor filesystem path"],
  [/\bCursor(?:'s)?\b/i, "Cursor host claim"],
  [/\bagent-transcripts\b/i, "private transcript store"],
  [/\bTask\s+(?:tool|call|subagent)/i, "Cursor Task recipe"],
  [/`Task`|\bsubagent_type\b|\bcloud_base_branch\b|`environment:\s*"(?:cloud|local)"`|`readonly`:\s*(?:true|false)/i, "non-Codex agent schema"],
  [/\bAskQuestion\b/i, "Cursor question tool"],
  [/\brun_in_background\b/i, "Cursor background flag"],
  [/\bcloud[- ]agent\b/i, "Cursor cloud-agent recipe"],
  [/(?:terminal\s+)?\/loop\b|cloud-sleeper|monitored-shell[^\n]*sleep/i, "unsupported loop mechanic"],
  [/supported Codex task history\/?|supported task history\//i, "invented task-history path"],
  [/\bcreate-skill\b|`mcps\/`/i, "non-Codex skill or connector discovery"],
  [/\b(?:claude-fable-5-thinking-max|grok-4\.6-fast-xhigh|claude-opus-5-thinking-xhigh|gpt-5\.6-sol-max)\b/i, "combined model slug"],
];

// These are external GitHub review identities accepted as untrusted input, not
// host-runtime dependencies. Keep the list narrow and explicit.
const LEGACY_REVIEW_AUTHOR_ALLOWLIST = new Map([
  ["poteto-mode/references/bugbot-triage.md", [/\bBugbot\b/g]],
  ["poteto-mode/playbooks/babysit.md", [/\bBugbot\b/g, /\bbugbot\b/g]],
  ["poteto-mode/playbooks/autopilot-full.md", [/\bBugbot\b/g]],
  ["poteto-mode/playbooks/autopilot-stack.md", [/\bBugbot\b/g]],
  ["poteto-mode/playbooks/multi-phase-plan.md", [/\bBugbot\b/g]],
]);

async function markdownFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(absolute);
    return entry.isFile() && entry.name.endsWith(".md") ? [absolute] : [];
  }));
  return nested.flat();
}

test("all skill runtime instructions use the central Codex contract", async () => {
  const files = await markdownFiles(skillsRoot);
  const failures = [];

  for (const file of files) {
    const relative = path.relative(skillsRoot, file);
    let content = await fs.readFile(file, "utf8");
    for (const allowed of LEGACY_REVIEW_AUTHOR_ALLOWLIST.get(relative) ?? []) {
      content = content.replace(allowed, "LEGACY_REVIEW_AUTHOR");
    }
    for (const [pattern, label] of FORBIDDEN_RUNTIME_PATTERNS) {
      if (pattern.test(content)) failures.push(`${relative}: ${label}`);
    }
  }

  assert.deepEqual(failures, []);
});

test("representative behavior fixtures declare authority, fallback, and proof", async () => {
  const fixtureRoot = path.join(root, "tests", "skill-behavior");
  const fixtures = (await fs.readdir(fixtureRoot)).filter((name) => name.endsWith(".yaml"));
  assert.deepEqual(fixtures.sort(), [
    "capability-fallbacks.yaml",
    "lifecycle-authority.yaml",
    "orchestration.yaml",
    "recall.yaml",
  ]);

  for (const fixture of fixtures) {
    const content = await fs.readFile(path.join(fixtureRoot, fixture), "utf8");
    assert.match(content, /authority:/);
    assert.match(content, /expected:/);
    assert.match(content, /proof:/);
  }
});

test("all playbooks and orchestrated skills cite the runtime contract", async () => {
  const playbookRoot = path.join(skillsRoot, "poteto-mode", "playbooks");
  for (const file of await markdownFiles(playbookRoot)) {
    assert.match(await fs.readFile(file, "utf8"), /codex-agent-runtime\.md/, path.relative(root, file));
  }

  const orchestrated = [
    "architect", "arena", "automate-me", "blast-radius", "create-verification-skill",
    "figure-it-out", "how", "interrogate", "maintain-verification-skill", "no-comments",
    "recall", "reflect", "show-me-your-work", "swarm", "why",
  ];
  for (const name of orchestrated) {
    const file = path.join(skillsRoot, name, "SKILL.md");
    assert.match(await fs.readFile(file, "utf8"), /codex-agent-runtime\.md/, name);
  }
});
