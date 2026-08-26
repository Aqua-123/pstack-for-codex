import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const scripts = join(root, "skills", "poteto-mode", "scripts");

test("Codex package identity is consistent", () => {
  const packageJson = JSON.parse(readFileSync(join(scripts, "package.json"), "utf8"));
  const lock = readFileSync(join(scripts, "bun.lock"), "utf8");
  assert.equal(packageJson.name, "@pstack-for-codex/poteto-mode-tools");
  assert.match(lock, /"name": "@pstack-for-codex\/poteto-mode-tools"/);
  assert.doesNotMatch(lock, /@cursor-skill/);
  const checker = readFileSync(join(scripts, "check-plan.mjs"), "utf8");
  assert.doesNotMatch(checker, /grok-4\.6-fast-xhigh|"\/goal"/);
  assert.match(checker, /configured fast profile/);
});

test("missing Bun fails before dependency state is created", async () => {
  const fixture = mkdtempSync(join(tmpdir(), "pstack-bun-preflight-"));
  const emptyPath = join(fixture, "empty-path");
  const packageDir = join(fixture, "scripts");
  mkdirSync(emptyPath);
  mkdirSync(packageDir);
  writeFileSync(join(packageDir, "package.json"), "{}\n");
  writeFileSync(join(packageDir, "bun.lock"), "{}\n");
  const bootstrapUrl = pathToFileURL(join(scripts, "bootstrap.ts")).href;
  const source = `
    import { ensureDependenciesInstalled } from ${JSON.stringify(bootstrapUrl)};
    try {
      ensureDependenciesInstalled({ scriptsDirectory: ${JSON.stringify(packageDir)} });
    } catch (error) {
      process.stderr.write(String(error.message) + "\\n");
      process.exit(23);
    }
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", source], {
    env: { ...process.env, PATH: emptyPath },
    encoding: "utf8",
  });
  assert.equal(result.status, 23);
  assert.match(result.stderr, /^Bun is required to run pstack-for-codex tools\./m);
  assert.equal(existsSync(join(packageDir, "node_modules")), false);
  rmSync(fixture, { recursive: true, force: true });
});

test("tool launchers report the same missing Bun preflight", () => {
  const fixture = mkdtempSync(join(tmpdir(), "pstack-bun-launchers-"));
  for (const launcher of [
    join(scripts, "orch", "orch"),
    join(scripts, "watch-pr", "watch-pr"),
  ]) {
    const result = spawnSync(launcher, ["--help"], {
      env: { ...process.env, PATH: fixture },
      encoding: "utf8",
    });
    assert.equal(result.status, 127);
    assert.equal(
      result.stderr,
      "Bun is required to run pstack-for-codex tools. Install Bun and retry.\n"
    );
  }
  assert.deepEqual(execFileSync("find", [fixture, "-mindepth", "1"], { encoding: "utf8" }), "");
  rmSync(fixture, { recursive: true, force: true });
});

test("worktree audit contains no private transcript lookup or delete command", () => {
  const source = readFileSync(join(scripts, "worktree-audit.sh"), "utf8");
  assert.doesNotMatch(source, /\.cursor|agent-transcripts|rm\s+-rf/);
  assert.match(source, /LAST_TASK_USE/);
});

test("worktree audit keeps nested and stale worktrees behind a task-use gate", () => {
  const fixture = mkdtempSync(join(tmpdir(), "pstack-worktree-audit-"));
  const repo = join(fixture, "repo with spaces");
  const nested = join(fixture, "nested", "worktree with spaces");
  mkdirSync(repo, { recursive: true });
  const git = (...args) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" });
  git("init", "--initial-branch=main");
  git("config", "user.name", "Pstack Test");
  git("config", "user.email", "pstack@example.invalid");
  writeFileSync(join(repo, "tracked.txt"), "baseline\n");
  git("add", "tracked.txt");
  git("commit", "-m", "baseline");
  mkdirSync(dirname(nested), { recursive: true });
  git("worktree", "add", "-b", "nested-work", nested);

  const script = join(scripts, "worktree-audit.sh");
  const first = execFileSync(script, [repo], {
    env: { ...process.env, PSTACK_SKIP_GITHUB: "1" },
    encoding: "utf8",
  });
  assert.match(first, /LAST_TASK_USE/);
  assert.match(first, /needs-task-check/);
  assert.match(first, new RegExp(nested.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(existsSync(nested), true);

  rmSync(nested, { recursive: true, force: true });
  const before = git("worktree", "list", "--porcelain");
  const second = execFileSync(script, [repo], {
    env: { ...process.env, PSTACK_SKIP_GITHUB: "1" },
    encoding: "utf8",
  });
  const after = git("worktree", "list", "--porcelain");
  assert.match(second, /needs-task-check/);
  assert.equal(after, before);
  assert.match(after, new RegExp(nested.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  rmSync(fixture, { recursive: true, force: true });
});

test("decision log rejects a directory target without modifying it", () => {
  const fixture = mkdtempSync(join(tmpdir(), "pstack-log-boundary-"));
  const script = join(root, "skills", "show-me-your-work", "scripts", "log.sh");
  const before = execFileSync("find", [fixture, "-maxdepth", "1", "-print"], { encoding: "utf8" });
  const result = spawnSync(script, [fixture, "phase", "decision", "why", "evidence", "result"], { encoding: "utf8" });
  const after = execFileSync("find", [fixture, "-maxdepth", "1", "-print"], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /log path must name a file/);
  assert.equal(after, before);
  rmSync(fixture, { recursive: true, force: true });
});
