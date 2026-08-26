import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const documentation = [
  "README.md",
  "UPSTREAM.md",
  "docs/codex-adaptation.md",
  "docs/guide/README.md",
  ...Array.from({ length: 10 }, (_, index) => `docs/guide/${String(index + 1).padStart(2, "0")}-${[
    "setup",
    "poteto-mode",
    "understand",
    "design",
    "build-and-clean",
    "verify-and-ship",
    "overnight",
    "principles",
    "make-it-yours",
    "recipes-and-pitfalls",
  ][index]}.md`),
];

function markdownTargets(content) {
  return [...content.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)].map((match) => match[1].trim().replace(/^<|>$/g, ""));
}

function headingSlug(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[`$]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

async function validateDocumentationLinks(packageRoot) {
  const failures = [];
  for (const relative of documentation) {
    const source = path.join(packageRoot, relative);
    const content = await fs.readFile(source, "utf8");
    for (const rawTarget of markdownTargets(content)) {
      if (!rawTarget || rawTarget.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(rawTarget)) continue;
      const [encodedPath, encodedAnchor] = rawTarget.split("#", 2);
      let targetPath;
      let anchor;
      try {
        targetPath = decodeURIComponent(encodedPath);
        anchor = encodedAnchor ? decodeURIComponent(encodedAnchor) : undefined;
      } catch {
        failures.push(`${relative}: invalid link encoding ${rawTarget}`);
        continue;
      }
      const resolved = path.resolve(path.dirname(source), targetPath || ".");
      if (resolved !== packageRoot && !resolved.startsWith(`${packageRoot}${path.sep}`)) {
        failures.push(`${relative}: link escapes package ${rawTarget}`);
        continue;
      }
      const stat = await fs.stat(resolved).catch(() => null);
      if (!stat) {
        failures.push(`${relative}: missing target ${rawTarget}`);
        continue;
      }
      if (anchor && stat.isFile() && resolved.endsWith(".md")) {
        const targetContent = await fs.readFile(resolved, "utf8");
        const slugs = new Set([...targetContent.matchAll(/^#{1,6}\s+(.+)$/gm)].map((match) => headingSlug(match[1])));
        if (!slugs.has(anchor.toLowerCase())) failures.push(`${relative}: missing heading ${rawTarget}`);
      }
    }
  }
  return failures;
}

test("documentation links and images resolve from an installed copy", async (context) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "pstack-docs-installed-"));
  context.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const installed = path.join(temporary, "pstack-for-codex", "0.1.0");
  await fs.cp(root, installed, {
    recursive: true,
    filter: (source) => !source.split(path.sep).some((part) => part === ".git" || part === "node_modules"),
  });

  assert.deepEqual(await validateDocumentationLinks(installed), []);
});

test("guide index includes all ten ordered pages", async () => {
  const index = await fs.readFile(path.join(root, "docs/guide/README.md"), "utf8");
  for (const relative of documentation.filter((file) => /^docs\/guide\/\d\d-/.test(file))) {
    assert.match(index, new RegExp(`\\(\\./${path.basename(relative).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)`));
  }
});

test("runtime documentation contains no legacy host instructions or unsupported claims", async () => {
  const runtimeDocs = documentation.filter((file) => file === "README.md" || file.startsWith("docs/guide/"));
  const forbidden = [
    ["legacy plugin command", /(?<![A-Za-z0-9._-])\/(?:add-plugin|setup-pstack|poteto-mode|how|why|arena|swarm|interrogate|loop|automate)(?:\b|\s)/i],
    ["legacy configuration path", /(?:~\/|\.)\.cursor\/|\.cursor-plugin\//i],
    ["model picker claim", /\bmodel picker\b/i],
    ["cloud agent claim", /\bcloud[- ]agent\b/i],
    ["legacy subagent contract", /\bsubagent_type\b/i],
    ["unsupported transcript claim", /\bprivate\s+(?:transcript|history)\b/i],
  ];

  const failures = [];
  for (const relative of runtimeDocs) {
    const content = await fs.readFile(path.join(root, relative), "utf8");
    for (const [name, pattern] of forbidden) {
      if (pattern.test(content)) failures.push(`${relative}: ${name}`);
    }
  }
  assert.deepEqual(failures, []);
});
