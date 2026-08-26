#!/usr/bin/env node

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CLASSIFICATIONS = new Set([
  "preserved",
  "adapted",
  "replaced",
  "provenance-only",
]);

export function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

export async function inventoryDirectory(root) {
  const entries = [];

  async function visit(directory) {
    const children = await fs.readdir(directory, { withFileTypes: true });
    children.sort((left, right) => left.name.localeCompare(right.name));
    for (const child of children) {
      if (child.name === ".git") continue;
      const absolute = path.join(directory, child.name);
      if (child.isSymbolicLink()) {
        throw new Error(`Refusing symlink in upstream inventory: ${absolute}`);
      }
      if (child.isDirectory()) {
        await visit(absolute);
        continue;
      }
      if (!child.isFile()) continue;
      const content = await fs.readFile(absolute);
      entries.push({
        path: path.relative(root, absolute).split(path.sep).join("/"),
        sha256: sha256(content),
        bytes: content.byteLength,
      });
    }
  }

  await visit(root);
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

function classificationFor(upstreamPath) {
  if (upstreamPath === ".cursor-plugin/plugin.json") {
    return {
      classification: "replaced",
      derivedPath: ".codex-plugin/plugin.json",
      preservedInvariants: [
        "pstack-for-codex identity and semantic version remain explicit",
        "the complete skill surface remains declared",
        "license and source attribution remain discoverable",
      ],
      validations: ["manifest", "installed-plugin"],
    };
  }
  if (upstreamPath === "agents/comment-sicko.md") {
    return {
      classification: "adapted",
      derivedPath: "skills/no-comments/references/comment-sicko-prompt.md",
      preservedInvariants: ["the comment-review persona remains portable and explicitly invoked"],
      validations: ["agent-template", "skill-behavior"],
    };
  }
  if (upstreamPath === "agents/poteto-agent.md") {
    return {
      classification: "adapted",
      derivedPath: "skills/poteto-mode/references/poteto-agent-prompt.md",
      preservedInvariants: ["the Poteto persona remains scoped to Poteto work"],
      validations: ["agent-template", "skill-behavior"],
    };
  }

  const binary = /\.(?:jpe?g|png|gif|webp)$/i.test(upstreamPath);
  const foundational = upstreamPath === "LICENSE" || upstreamPath === ".gitignore";
  if (binary || foundational) {
    return {
      classification: "preserved",
      derivedPath: upstreamPath,
      preservedInvariants: [
        upstreamPath === "LICENSE"
          ? "the upstream MIT license text remains intact"
          : "the upstream artifact remains byte-identical",
      ],
      validations: ["upstream-hash"],
    };
  }

  let invariant = "the upstream workflow intent remains available through Codex-native contracts";
  let validation = "content-adaptation";
  if (upstreamPath.startsWith("automations/benny/")) {
    invariant = "Benny behavior remains traceable and dormant until its safety gates pass";
    validation = "benny-behavior";
  } else if (upstreamPath.startsWith("docs/")) {
    invariant = "the guide topic remains covered with verified Codex instructions";
    validation = "documentation";
  } else if (upstreamPath.startsWith("skills/")) {
    invariant = "the skill or supporting resource preserves its user-visible purpose";
    validation = "skill-behavior";
  } else if (upstreamPath === "README.md") {
    invariant = "installation and workflow documentation describe the derived Codex fork";
    validation = "documentation";
  }
  return {
    classification: "adapted",
    derivedPath: upstreamPath,
    preservedInvariants: [invariant],
    validations: [validation],
  };
}

export function buildLock(files, source) {
  return {
    schemaVersion: 1,
    source: {
      repository: source.repository,
      subdirectory: source.subdirectory,
      commit: source.commit,
      version: source.version,
      retrievedAt: source.retrievedAt,
      license: "MIT",
      licenseFile: "LICENSE",
    },
    inventory: { fileCount: files.length, hashAlgorithm: "sha256" },
    files,
  };
}

export function buildCompatibilityMap(lock) {
  return {
    schemaVersion: 1,
    upstream: {
      repository: lock.source.repository,
      subdirectory: lock.source.subdirectory,
      commit: lock.source.commit,
      version: lock.source.version,
    },
    classifications: [...CLASSIFICATIONS],
    entries: lock.files.map((file) => ({
      upstreamPath: file.path,
      upstreamSha256: file.sha256,
      ...classificationFor(file.path),
    })),
  };
}

export function validateCompatibility(lock, map, upstreamFiles, derived = {}) {
  const errors = [];
  const lockByPath = new Map(lock.files.map((file) => [file.path, file]));
  const mapByPath = new Map();

  if (lock.inventory?.fileCount !== lock.files.length) {
    errors.push(`lock inventory count ${lock.inventory?.fileCount} does not match ${lock.files.length} files`);
  }
  for (const entry of map.entries) {
    if (mapByPath.has(entry.upstreamPath)) errors.push(`duplicate map entry: ${entry.upstreamPath}`);
    mapByPath.set(entry.upstreamPath, entry);
    const locked = lockByPath.get(entry.upstreamPath);
    if (!locked) errors.push(`map path is not locked: ${entry.upstreamPath}`);
    if (locked && locked.sha256 !== entry.upstreamSha256) {
      errors.push(`map hash differs from lock: ${entry.upstreamPath}`);
    }
    if (!CLASSIFICATIONS.has(entry.classification)) {
      errors.push(`invalid classification for ${entry.upstreamPath}: ${entry.classification}`);
    }
    if (entry.classification !== "provenance-only" && !entry.derivedPath) {
      errors.push(`missing derivedPath: ${entry.upstreamPath}`);
    }
    if (!Array.isArray(entry.preservedInvariants) || entry.preservedInvariants.length === 0) {
      errors.push(`missing preserved invariants: ${entry.upstreamPath}`);
    }
    if (!Array.isArray(entry.validations) || entry.validations.length === 0) {
      errors.push(`missing validation cases: ${entry.upstreamPath}`);
    }
    if (entry.refreshDisposition && (
      typeof entry.refreshDisposition.disposition !== "string"
      || entry.refreshDisposition.disposition.trim() === ""
      || typeof entry.refreshDisposition.rationale !== "string"
      || entry.refreshDisposition.rationale.trim() === ""
    )) {
      errors.push(`incomplete refresh disposition: ${entry.upstreamPath}`);
    }
  }
  for (const locked of lock.files) {
    if (!mapByPath.has(locked.path)) errors.push(`unclassified locked path: ${locked.path}`);
  }

  const deltas = [];
  if (upstreamFiles) {
    const newByPath = new Map(upstreamFiles.map((file) => [file.path, file]));
    for (const file of upstreamFiles) {
      const entry = mapByPath.get(file.path);
      if (!entry) {
        deltas.push({ path: file.path, kind: "added", review: "required" });
      } else if (entry.upstreamSha256 !== file.sha256) {
        const reviewed = entry.refreshDisposition?.upstreamSha256 === file.sha256;
        deltas.push({ path: file.path, kind: "changed", review: reviewed ? "recorded" : "required" });
      }
    }
    for (const entry of map.entries) {
      if (!newByPath.has(entry.upstreamPath)) {
        const reviewed = entry.refreshDisposition?.upstreamSha256 === null;
        deltas.push({ path: entry.upstreamPath, kind: "deleted-or-renamed", review: reviewed ? "recorded" : "required" });
      }
    }
    for (const delta of deltas.filter((item) => item.review === "required")) {
      errors.push(`upstream ${delta.kind} requires an explicit compatibility disposition: ${delta.path}`);
    }
  }
  const derivedDeltas = [];
  if (derived.currentFiles) {
    const currentByPath = new Map(derived.currentFiles.map((file) => [file.path, file]));
    const baseByPath = new Map((derived.baseFiles ?? []).map((file) => [file.path, file]));
    const upstreamDeltaByPath = new Map(deltas.map((delta) => [delta.path, delta]));
    for (const entry of map.entries) {
      if (!entry.derivedPath) continue;
      const current = currentByPath.get(entry.derivedPath);
      const base = baseByPath.get(entry.derivedPath);
      let kind = current ? "present" : "missing";
      if (derived.baseFiles) {
        if (!base && current) kind = "added";
        else if (base && !current) kind = "deleted";
        else if (base && current && base.sha256 !== current.sha256) kind = "changed";
        else kind = "unchanged";
      }
      const upstreamDelta = upstreamDeltaByPath.get(entry.upstreamPath);
      derivedDeltas.push({
        upstreamPath: entry.upstreamPath,
        path: entry.derivedPath,
        kind,
        conflict: Boolean(upstreamDelta && ["added", "changed", "deleted"].includes(kind)),
      });
    }
  }
  return { errors, deltas, derivedDeltas };
}

export function renderReport(lock, map, result) {
  const counts = Object.fromEntries([...CLASSIFICATIONS].map((name) => [name, 0]));
  for (const entry of map.entries) counts[entry.classification] += 1;
  const lines = [
    "# pstack compatibility report",
    "",
    "> Generated by `scripts/generate-compatibility-report.mjs`; edit `compatibility/pstack-map.json`, not this file.",
    "",
    `- Upstream: \`${lock.source.repository}/tree/${lock.source.commit}/${lock.source.subdirectory}\``,
    `- Version: \`${lock.source.version}\``,
    `- Locked files: ${lock.files.length}`,
    `- Classified files: ${map.entries.length}`,
    `- Status: ${result.errors.length === 0 ? "complete" : "blocked"}`,
    "",
    "## Classification summary",
    "",
    "| Classification | Files |",
    "|---|---:|",
    ...[...CLASSIFICATIONS].map((name) => `| ${name} | ${counts[name]} |`),
    "",
    "## Upstream refresh delta",
    "",
  ];
  if (result.deltas.length === 0) lines.push("No candidate upstream snapshot was supplied, or it matches the lock.");
  else {
    lines.push("| Upstream path | Change | Review |", "|---|---|---|");
    for (const delta of result.deltas) lines.push(`| \`${delta.path}\` | ${delta.kind} | ${delta.review} |`);
  }
  if (result.derivedDeltas.length) {
    lines.push("", "## Derived-tree delta", "", "| Upstream path | Codex path | Change | Conflict |", "|---|---|---|---|");
    for (const delta of result.derivedDeltas.filter((item) => item.kind !== "unchanged")) {
      lines.push(`| \`${delta.upstreamPath}\` | \`${delta.path}\` | ${delta.kind} | ${delta.conflict ? "review required" : "no"} |`);
    }
    if (result.derivedDeltas.every((item) => item.kind === "unchanged")) lines.push("| — | — | unchanged | no |");
  }
  lines.push("", "## Path inventory", "", "| Upstream path | Classification | Codex path | Validation |", "|---|---|---|---|");
  for (const entry of map.entries) {
    lines.push(`| \`${entry.upstreamPath}\` | ${entry.classification} | ${entry.derivedPath ? `\`${entry.derivedPath}\`` : "—"} | ${entry.validations.join(", ")} |`);
  }
  if (result.errors.length) {
    lines.push("", "## Blocking findings", "", ...result.errors.map((error) => `- ${error}`));
  }
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const result = { check: false, initialize: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") result.check = true;
    else if (arg === "--initialize") result.initialize = true;
    else if (arg.startsWith("--")) result[arg.slice(2)] = argv[++index];
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  return result;
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const root = path.resolve(args.root ?? process.cwd());
  const lockPath = path.resolve(root, args.lock ?? "upstream.lock.json");
  const mapPath = path.resolve(root, args.map ?? "compatibility/pstack-map.json");
  const outputPath = path.resolve(root, args.output ?? "compatibility/report.md");

  if (args.initialize) {
    if (!args["source-dir"] || !args.commit || !args.version || !args["retrieved-at"]) {
      throw new Error("--initialize requires --source-dir, --commit, --version, and --retrieved-at");
    }
    const files = await inventoryDirectory(path.resolve(args["source-dir"]));
    const lock = buildLock(files, {
      repository: args.repository ?? "https://github.com/cursor/plugins",
      subdirectory: args.subdirectory ?? "pstack",
      commit: args.commit,
      version: args.version,
      retrievedAt: args["retrieved-at"],
    });
    await writeJson(lockPath, lock);
    await writeJson(mapPath, buildCompatibilityMap(lock));
  }

  const lock = JSON.parse(await fs.readFile(lockPath, "utf8"));
  const map = JSON.parse(await fs.readFile(mapPath, "utf8"));
  const upstreamFiles = args["upstream-dir"]
    ? await inventoryDirectory(path.resolve(args["upstream-dir"]))
    : undefined;
  const currentFiles = args["derived-dir"]
    ? await inventoryDirectory(path.resolve(args["derived-dir"]))
    : undefined;
  const baseFiles = args["base-derived-dir"]
    ? await inventoryDirectory(path.resolve(args["base-derived-dir"]))
    : undefined;
  const result = validateCompatibility(lock, map, upstreamFiles, { currentFiles, baseFiles });
  const report = renderReport(lock, map, result);

  if (args.check) {
    const existing = await fs.readFile(outputPath, "utf8").catch(() => "");
    if (!args["upstream-dir"] && existing !== report) result.errors.push(`generated report is stale: ${path.relative(root, outputPath)}`);
  } else {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, report);
  }
  if (result.errors.length) throw new Error(result.errors.join("\n"));
  return { lock, map, result, report };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
