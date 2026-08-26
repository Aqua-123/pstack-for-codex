#!/usr/bin/env node

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const EXPECTED_SKILL_COUNT = 45;
export const SKILL_IDENTITY_LIMIT = 64;
const MANIFEST_FIELDS = new Set([
  "name",
  "version",
  "description",
  "author",
  "homepage",
  "repository",
  "license",
  "keywords",
  "skills",
  "interface",
]);

function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed.startsWith('"') || trimmed.startsWith("'")) {
    if (trimmed.startsWith('"')) return JSON.parse(trimmed);
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  return trimmed;
}

export function parseFrontmatter(content, source = "SKILL.md") {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error(`${source}: missing or unclosed YAML frontmatter`);
  const frontmatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!field) throw new Error(`${source}: unsupported frontmatter syntax: ${line}`);
    frontmatter[field[1]] = parseScalar(field[2]);
  }
  return { frontmatter, body: content.slice(match[0].length) };
}

function parseSkillMetadata(content, source) {
  const result = { interface: {}, policy: { products: [] } };
  let section;
  let subsection;
  for (const [index, line] of content.split(/\r?\n/).entries()) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const top = line.match(/^([a-z_]+):\s*$/);
    if (top) {
      section = top[1];
      subsection = undefined;
      continue;
    }
    const field = line.match(/^  ([a-z_]+):\s*(.*)$/);
    if (field) {
      if (!section) throw new Error(`${source}:${index + 1}: field without section`);
      if (field[2] === "") {
        subsection = field[1];
      } else {
        result[section] ??= {};
        result[section][field[1]] = parseScalar(field[2]);
        subsection = undefined;
      }
      continue;
    }
    const item = line.match(/^    -\s+(.+)$/);
    if (item && section && subsection) {
      result[section] ??= {};
      result[section][subsection] ??= [];
      result[section][subsection].push(parseScalar(item[1]));
      continue;
    }
    throw new Error(`${source}:${index + 1}: unsupported metadata syntax`);
  }
  return result;
}

async function immediateDirectories(directory) {
  const children = await fs.readdir(directory, { withFileTypes: true });
  return children.filter((child) => child.isDirectory() && !child.name.startsWith(".")).map((child) => child.name).sort();
}

export async function listSkillRecords(root) {
  const skillsRoot = path.join(root, "skills");
  const records = [];
  for (const directory of await immediateDirectories(skillsRoot)) {
    const skillPath = path.join(skillsRoot, directory, "SKILL.md");
    const metadataPath = path.join(skillsRoot, directory, "agents/openai.yaml");
    const content = await fs.readFile(skillPath, "utf8");
    const { frontmatter, body } = parseFrontmatter(content, path.relative(root, skillPath));
    const metadata = parseSkillMetadata(
      await fs.readFile(metadataPath, "utf8"),
      path.relative(root, metadataPath),
    );
    records.push({ directory, skillPath, metadataPath, frontmatter, body, metadata, name: frontmatter.name });
  }
  return records;
}

export async function validateManifest(root, manifest) {
  const errors = [];
  for (const field of Object.keys(manifest)) {
    if (!MANIFEST_FIELDS.has(field)) errors.push(`unsupported manifest field: ${field}`);
  }
  if (manifest.name !== "pstack-for-codex") errors.push("manifest name must be pstack-for-codex");
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version ?? "")) errors.push("manifest version must be semver");
  if (typeof manifest.description !== "string" || !manifest.description.trim()) errors.push("manifest description is required");
  if (manifest.skills !== "./skills/") errors.push("skills path must be ./skills/");
  if (manifest.skills === "./skills/") {
    const stat = await fs.stat(path.join(root, "skills")).catch(() => null);
    if (!stat?.isDirectory()) errors.push("declared skills directory is missing");
  }
  const ui = manifest.interface;
  if (!ui || typeof ui !== "object" || Array.isArray(ui)) errors.push("manifest interface is required");
  else {
    for (const field of ["displayName", "shortDescription", "longDescription", "developerName"]) {
      if (typeof ui[field] !== "string" || !ui[field].trim()) errors.push(`manifest interface.${field} is required`);
    }
    if (ui.category !== "Developer Tools") errors.push("manifest interface.category must be Developer Tools");
  }
  return errors;
}

export async function validateMarketplace(root, marketplace) {
  const errors = [];
  if (typeof marketplace.name !== "string" || !marketplace.name.trim()) errors.push("marketplace name is required");
  if (!Array.isArray(marketplace.plugins) || marketplace.plugins.length !== 1) {
    errors.push("repo marketplace must contain exactly one plugin");
    return errors;
  }
  const entry = marketplace.plugins[0];
  if (entry.name !== "pstack-for-codex") errors.push("marketplace plugin name must be pstack-for-codex");
  if (entry.source?.source !== "local" || entry.source?.path !== "./") {
    errors.push("marketplace source must be the repo root (./)");
  }
  if (entry.policy?.installation !== "AVAILABLE") errors.push("marketplace installation policy must be AVAILABLE");
  if (entry.policy?.authentication !== "ON_INSTALL") errors.push("marketplace authentication policy must be ON_INSTALL");
  if (entry.category !== "Developer Tools") errors.push("marketplace category must be Developer Tools");
  const manifest = await fs.stat(path.join(root, ".codex-plugin/plugin.json")).catch(() => null);
  if (!manifest?.isFile()) errors.push("marketplace source does not resolve to a plugin manifest");
  return errors;
}

async function markdownFiles(root) {
  const files = [];
  async function visit(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(target);
      else if (entry.isFile() && entry.name.endsWith(".md")) files.push(target);
    }
  }
  await visit(root);
  return files.sort();
}

async function validateResources(root, records) {
  const errors = [];
  const pluginRoot = `${path.resolve(root)}${path.sep}`;
  for (const record of records) {
    const skillRoot = path.dirname(record.skillPath);
    for (const file of await markdownFiles(skillRoot)) {
      const content = await fs.readFile(file, "utf8");
      const links = content.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g);
      for (const match of links) {
        let target = match[1].trim().replace(/^<|>$/g, "").split(/\s+["']/)[0].split("#")[0];
        if (!target || /^(?:[a-z][a-z0-9+.-]*:|#)/i.test(target)) continue;
        if (!/^(?:\.\.?\/|references\/|playbooks\/|scripts\/|assets\/)/.test(target) && !/\.[A-Za-z0-9]+$/.test(target)) continue;
        try { target = decodeURIComponent(target); } catch { errors.push(`${record.name}: invalid resource URI ${target}`); continue; }
        const resolved = path.resolve(path.dirname(file), target);
        if (resolved !== path.resolve(root) && !resolved.startsWith(pluginRoot)) {
          errors.push(`${record.name}: resource escapes plugin root: ${target}`);
          continue;
        }
        const stat = await fs.stat(resolved).catch(() => null);
        if (!stat) errors.push(`${record.name}: missing resource ${target} from ${path.relative(root, file)}`);
      }
    }
  }
  return errors;
}

export async function probeBunCapability() {
  return new Promise((resolve) => {
    const child = spawn("bun", ["--version"], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => resolve({ status: "unavailable", detail: error.code === "ENOENT" ? "bun is not installed" : error.message }));
    child.on("exit", (code) => resolve(code === 0
      ? { status: "available", detail: `bun ${stdout.trim()}` }
      : { status: "unavailable", detail: stderr.trim() || `bun exited ${code}` }));
  });
}

export function assessSkillCapacity(pluginName, records) {
  const aliases = Object.fromEntries(
    records
      .filter((record) => record.directory !== record.name)
      .map((record) => [record.directory, record.name])
      .sort(([left], [right]) => left.localeCompare(right)),
  );
  const dropped = records
    .filter((record) => `${pluginName}:${record.name}`.length > SKILL_IDENTITY_LIMIT)
    .map((record) => record.name)
    .sort();
  return {
    identityLimit: SKILL_IDENTITY_LIMIT,
    evaluated: records.length,
    status: dropped.length === 0 ? "fits-with-normalized-aliases" : "exceeds-identity-limit",
    aliases,
    dropped,
  };
}

export async function validatePlugin(root, options = {}) {
  const resolvedRoot = path.resolve(root);
  const errors = [];
  const manifestPath = path.join(resolvedRoot, ".codex-plugin/plugin.json");
  const marketplacePath = path.join(resolvedRoot, ".agents/plugins/marketplace.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const marketplace = JSON.parse(await fs.readFile(marketplacePath, "utf8"));
  errors.push(...await validateManifest(resolvedRoot, manifest));
  errors.push(...await validateMarketplace(resolvedRoot, marketplace));
  if (await fs.stat(path.join(resolvedRoot, ".cursor-plugin/plugin.json")).catch(() => null)) {
    errors.push("runtime Cursor manifest must be removed");
  }

  let records = [];
  try { records = await listSkillRecords(resolvedRoot); } catch (error) { errors.push(error.message); }
  if (records.length !== EXPECTED_SKILL_COUNT) errors.push(`expected ${EXPECTED_SKILL_COUNT} skills, found ${records.length}`);
  const names = new Set();
  for (const record of records) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.name ?? "")) errors.push(`${record.directory}: invalid standard skill name: ${record.name}`);
    if (names.has(record.name)) errors.push(`duplicate skill name: ${record.name}`);
    names.add(record.name);
    if (typeof record.frontmatter.description !== "string" || !record.frontmatter.description.trim()) errors.push(`${record.name}: description is required`);
    if ((record.frontmatter.description?.length ?? 0) > 1024) errors.push(`${record.name}: description exceeds 1024 characters`);
    const unexpected = Object.keys(record.frontmatter).filter((field) => !["name", "description"].includes(field));
    for (const field of unexpected) errors.push(`${record.name}: unsupported skill frontmatter field: ${field}`);
    if (!record.body.trim()) errors.push(`${record.name}: skill body is empty`);
    if (`${manifest.name}:${record.name}`.length > SKILL_IDENTITY_LIMIT) errors.push(`${record.name}: namespaced identity exceeds ${SKILL_IDENTITY_LIMIT} characters`);
    if (!record.metadata.interface?.display_name) errors.push(`${record.name}: interface.display_name is required`);
    if (!record.metadata.interface?.short_description) errors.push(`${record.name}: interface.short_description is required`);
    if (!record.metadata.interface?.default_prompt?.includes(`$${record.name}`)) errors.push(`${record.name}: default_prompt must explicitly invoke $${record.name}`);
    if (record.metadata.policy?.allow_implicit_invocation !== false) errors.push(`${record.name}: implicit invocation must remain disabled`);
    if (record.metadata.policy?.products?.join(",") !== "CODEX") errors.push(`${record.name}: policy.products must be CODEX-only`);
  }
  errors.push(...await validateResources(resolvedRoot, records));

  const bun = options.probeBun === false
    ? { status: "not-probed", detail: "Bun probe disabled by caller" }
    : await probeBunCapability();
  return {
    status: errors.length ? "invalid" : "valid",
    plugin: manifest.name,
    errors,
    inventory: {
      expected: EXPECTED_SKILL_COUNT,
      discovered: records.length,
      capacity: assessSkillCapacity(manifest.name, records),
    },
    capabilities: { bun },
  };
}

function parseArgs(argv) {
  const options = { root: process.cwd(), probeBun: true, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--root") options.root = argv[++index];
    else if (argv[index] === "--no-bun-probe") options.probeBun = false;
    else if (argv[index] === "--json") options.json = true;
    else throw new Error(`Unexpected argument: ${argv[index]}`);
  }
  return options;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const report = await validatePlugin(options.root, options);
  console.log(JSON.stringify(report, null, 2));
  if (report.errors.length) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
