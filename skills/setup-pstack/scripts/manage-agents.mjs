#!/usr/bin/env node

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROLE_SPECS = [
  {
    name: "pstack-poteto-agent",
    template: "templates/codex-agents/pstack-poteto-agent.toml",
    prompt: "skills/poteto-mode/references/poteto-agent-prompt.md",
    capability: {
      sandbox: "inherited-unverified-at-setup",
      writable_scope: "parent-request-only",
      connectors: "inherited-parent-authority",
      skills: ["poteto-mode"],
      fallback: "generic-agent-with-portable-prompt-or-sequential-parent",
    },
  },
  {
    name: "pstack-comment-sicko",
    template: "templates/codex-agents/pstack-comment-sicko.toml",
    prompt: "skills/no-comments/references/comment-sicko-prompt.md",
    capability: {
      sandbox: "requested-read-only-unverified-until-runtime",
      writable_scope: "none",
      connectors: "prohibited-fail-closed-if-not-constrained",
      skills: ["how", "why"],
      fallback: "constrained-generic-agent-or-skip",
    },
  },
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function layer(scope, projectRoot, userHome) {
  if (scope === "project") {
    return {
      root: projectRoot,
      agentsDir: path.join(projectRoot, ".codex/agents"),
      receipt: path.join(projectRoot, ".codex/pstack-for-codex-agent-receipt.json"),
      relative: (file) => path.relative(projectRoot, file),
    };
  }
  if (scope === "user") {
    const codexRoot = path.join(userHome, ".codex");
    return {
      root: codexRoot,
      agentsDir: path.join(codexRoot, "agents"),
      receipt: path.join(codexRoot, "pstack-for-codex-agent-receipt.json"),
      relative: (file) => path.relative(codexRoot, file),
    };
  }
  throw new Error(`unsupported scope "${scope}"; expected project or user`);
}

async function listToml(directory, scope) {
  let filenames;
  try {
    filenames = await fs.readdir(directory);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const records = [];
  for (const filename of filenames.sort()) {
    if (!filename.endsWith(".toml")) continue;
    const file = path.join(directory, filename);
    const content = await fs.readFile(file, "utf8");
    const match = content.match(/^\s*name\s*=\s*(?:"((?:[^"\\]|\\.)*)"|'([^']*)')\s*(?:#.*)?$/m);
    if (!match) continue;
    records.push({ name: match[1] === undefined ? match[2] : JSON.parse(`"${match[1]}"`), file, scope });
  }
  return records;
}

export async function scanAgentNames({ projectRoot = process.cwd(), userHome = os.homedir() } = {}) {
  const records = [
    ...(await listToml(path.join(projectRoot, ".codex/agents"), "project")),
    ...(await listToml(path.join(userHome, ".codex/agents"), "user")),
  ];
  const byName = new Map();
  for (const record of records) {
    const matches = byName.get(record.name) ?? [];
    matches.push(record);
    byName.set(record.name, matches);
  }
  return {
    records,
    duplicates: [...byName.entries()]
      .filter(([, matches]) => matches.length > 1)
      .map(([name, matches]) => ({ name, files: matches.map((record) => record.file) })),
  };
}

export function resolveModelPolicy({ requested = null, observableModels = null } = {}) {
  if (!requested) return { status: "inherited", requested: null, resolved: null, toml: {} };
  if (!requested.model || !requested.reasoning_effort) {
    throw new Error("a model request must include both model and reasoning_effort");
  }
  if (observableModels === null) {
    return { status: "unverified-inheritance", requested, resolved: null, toml: {} };
  }
  const model = observableModels.find((candidate) => candidate.slug === requested.model);
  if (!model) throw new Error(`model "${requested.model}" is not in the observable model list`);
  const efforts = model.reasoning_efforts ?? [];
  if (!efforts.includes(requested.reasoning_effort)) {
    throw new Error(`model "${requested.model}" does not support reasoning effort "${requested.reasoning_effort}"`);
  }
  return {
    status: "verified-explicit",
    requested,
    resolved: { ...requested },
    toml: { model: requested.model, model_reasoning_effort: requested.reasoning_effort },
  };
}

async function readReceipt(file) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function expectedRolePaths(target) {
  return ROLE_SPECS.map((role) => target.relative(path.join(target.agentsDir, `${role.name}.toml`)));
}

function validateReceipt(receipt, scope, target) {
  if (!receipt) return;
  if (receipt.schema_version !== 1 || receipt.owner !== "pstack-for-codex/setup-pstack" || receipt.scope !== scope) {
    throw new Error("setup receipt has an unknown owner, schema, or scope; review it before continuing");
  }
  if (!Array.isArray(receipt.files)) throw new Error("setup receipt files must be an array");
  const expected = new Set(expectedRolePaths(target));
  const seen = new Set();
  for (const record of receipt.files) {
    if (!record || typeof record !== "object" || typeof record.path !== "string" || !/^[a-f0-9]{64}$/.test(record.sha256 ?? "")) {
      throw new Error("setup receipt contains an invalid path or SHA-256");
    }
    if (seen.has(record.path)) throw new Error(`setup receipt contains duplicate path "${record.path}"`);
    if (!expected.has(record.path)) throw new Error(`setup receipt contains unexpected path "${record.path}"`);
    seen.add(record.path);
  }
  const missing = [...expected].filter((expectedPath) => !seen.has(expectedPath));
  if (missing.length) throw new Error(`setup receipt is missing expected path(s): ${missing.join(", ")}`);
}

async function inspectOwnedFiles(receipt, target) {
  if (!receipt) return [];
  const recordsByPath = new Map((receipt?.files ?? []).map((record) => [record.path, record]));
  const diagnostics = [];
  for (const role of ROLE_SPECS) {
    const absolute = path.join(target.agentsDir, `${role.name}.toml`);
    const relativePath = target.relative(absolute);
    const record = recordsByPath.get(relativePath);
    try {
      const content = await fs.readFile(absolute);
      const actual = sha256(content);
      if (actual !== record.sha256) {
        diagnostics.push({ path: relativePath, status: "modified", expected_sha256: record.sha256, actual_sha256: actual });
      }
    } catch (error) {
      if (error.code === "ENOENT") {
        diagnostics.push({ path: relativePath, status: "missing", expected_sha256: record.sha256, actual_sha256: null });
      }
      else throw error;
    }
  }
  return diagnostics;
}

function renderTemplate(template, prompt, modelPolicy) {
  if (prompt.includes('"""')) throw new Error("portable prompt cannot contain a TOML multiline-string terminator");
  const modelLines = Object.entries(modelPolicy.toml)
    .map(([key, value]) => `${key} = ${JSON.stringify(value)}`)
    .join("\n");
  return template.replace("{{MODEL_CONFIG}}", modelLines).replace("{{PROMPT}}", prompt.trim());
}

export async function installAgents({
  pluginRoot,
  projectRoot = process.cwd(),
  userHome = os.homedir(),
  scope = "project",
  profile = {},
  observableModels = null,
} = {}) {
  if (!pluginRoot) throw new Error("pluginRoot is required");
  const target = layer(scope, projectRoot, userHome);
  const currentReceipt = await readReceipt(target.receipt);
  validateReceipt(currentReceipt, scope, target);
  const divergence = await inspectOwnedFiles(currentReceipt, target);
  if (divergence.length) {
    const summary = divergence.map(({ path: file, status }) => `${file} (${status})`).join(", ");
    throw new Error(
      `review required for divergent pstack-owned files: ${summary}; run uninstall to preserve changed files and archive the receipt`,
    );
  }

  const inventory = await scanAgentNames({ projectRoot, userHome });
  if (inventory.duplicates.length) {
    const duplicate = inventory.duplicates[0];
    throw new Error(`duplicate custom-agent name "${duplicate.name}" across: ${duplicate.files.join(", ")}`);
  }
  const ownedPaths = new Set((currentReceipt?.files ?? []).map((record) => path.resolve(target.root, record.path)));
  for (const role of ROLE_SPECS) {
    const collision = inventory.records.find(
      (record) => record.name === role.name && !ownedPaths.has(path.resolve(record.file)),
    );
    if (collision) throw new Error(`custom-agent name "${role.name}" is already owned by ${collision.file}`);
  }

  const rendered = [];
  for (const role of ROLE_SPECS) {
    const modelPolicy = resolveModelPolicy({ requested: profile[role.name] ?? null, observableModels });
    const [template, prompt] = await Promise.all([
      fs.readFile(path.join(pluginRoot, role.template), "utf8"),
      fs.readFile(path.join(pluginRoot, role.prompt), "utf8"),
    ]);
    const content = `${renderTemplate(template, prompt, modelPolicy).trim()}\n`;
    const file = path.join(target.agentsDir, `${role.name}.toml`);
    rendered.push({ role, modelPolicy, content, file, path: target.relative(file), sha256: sha256(content) });
  }

  await fs.mkdir(target.agentsDir, { recursive: true });
  for (const record of rendered) await fs.writeFile(record.file, record.content, { mode: 0o600 });
  const receipt = {
    schema_version: 1,
    owner: "pstack-for-codex/setup-pstack",
    scope,
    created_at: new Date().toISOString(),
    files: rendered.map(({ role, modelPolicy, path: relativePath, sha256: hash }) => ({
      path: relativePath,
      sha256: hash,
      template: role.template,
      prompt: role.prompt,
      capability: role.capability,
      model_policy: modelPolicy,
    })),
  };
  await fs.mkdir(path.dirname(target.receipt), { recursive: true });
  await fs.writeFile(target.receipt, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
  return { status: "installed", scope, receiptPath: target.relative(target.receipt), files: receipt.files };
}

export async function uninstallAgents({ projectRoot = process.cwd(), userHome = os.homedir(), scope = "project" } = {}) {
  const target = layer(scope, projectRoot, userHome);
  const receipt = await readReceipt(target.receipt);
  if (!receipt) return { status: "not-installed", scope, modified: [] };
  validateReceipt(receipt, scope, target);
  const divergence = await inspectOwnedFiles(receipt, target);
  const divergentPaths = new Set(divergence.map((record) => record.path));
  for (const role of ROLE_SPECS) {
    const absolute = path.join(target.agentsDir, `${role.name}.toml`);
    if (!divergentPaths.has(target.relative(absolute))) await fs.rm(absolute);
  }
  if (!divergence.length) {
    await fs.rm(target.receipt);
    return { status: "uninstalled", scope, modified: [] };
  }

  const archive = `${target.receipt}.preserved-${Date.now()}`;
  await fs.rename(target.receipt, archive);
  return {
    status: "uninstalled-with-preserved-files",
    scope,
    modified: divergence.map((record) => record.path),
    diagnostics: divergence,
    archivedReceipt: target.relative(archive),
    recovery: "Changed files were preserved and are no longer managed. Move or remove them before reinstalling, then delete the archived receipt after review.",
  };
}

async function main(argv) {
  const action = argv[0];
  const options = {};
  for (let index = 1; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith("--") || value === undefined) throw new Error(`invalid argument near "${flag ?? ""}"`);
    options[flag.slice(2)] = value;
  }
  const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const common = {
    pluginRoot,
    scope: options.scope ?? "project",
    projectRoot: path.resolve(options["project-root"] ?? process.cwd()),
    userHome: path.resolve(options["user-home"] ?? os.homedir()),
  };
  if (options.profile) common.profile = JSON.parse(await fs.readFile(options.profile, "utf8"));
  if (options.models) common.observableModels = JSON.parse(await fs.readFile(options.models, "utf8"));
  let result;
  if (action === "install") result = await installAgents(common);
  else if (action === "uninstall") result = await uninstallAgents(common);
  else if (action === "scan") result = await scanAgentNames(common);
  else throw new Error("usage: manage-agents.mjs <install|uninstall|scan> [--scope project|user] [--profile file] [--models file]");
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
