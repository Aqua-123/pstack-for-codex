#!/usr/bin/env node

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inventoryDirectory } from "./generate-compatibility-report.mjs";

function parseArgs(argv) {
  const result = { dryRun: false, verifyLock: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") result.dryRun = true;
    else if (arg === "--verify-lock") result.verifyLock = true;
    else if (arg.startsWith("--")) result[arg.slice(2)] = argv[++index];
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  return result;
}

async function run(command, args, cwd) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)));
  });
}

async function assertSafeOutput(output, cwd) {
  const resolved = path.resolve(output);
  if (resolved === path.parse(resolved).root || resolved === cwd) {
    throw new Error(`Refusing unsafe output directory: ${resolved}`);
  }
  const stat = await fs.stat(resolved).catch((error) => error.code === "ENOENT" ? null : Promise.reject(error));
  if (stat) throw new Error(`Refusing to overwrite existing output: ${resolved}`);
  return resolved;
}

async function copyTree(source, destination, files) {
  await fs.mkdir(destination, { recursive: false });
  for (const file of files) {
    const sourceFile = path.join(source, ...file.path.split("/"));
    const destinationFile = path.join(destination, ...file.path.split("/"));
    await fs.mkdir(path.dirname(destinationFile), { recursive: true });
    await fs.copyFile(sourceFile, destinationFile, fs.constants.COPYFILE_EXCL);
    const mode = (await fs.stat(sourceFile)).mode & 0o777;
    await fs.chmod(destinationFile, mode);
  }
}

export async function importUpstream(options) {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const output = options.output ? await assertSafeOutput(options.output, cwd) : null;
  if (!options.source) throw new Error("--source is required");

  let temporary;
  let sourceRoot;
  const local = await fs.stat(path.resolve(options.source)).catch(() => null);
  try {
    if (local?.isDirectory()) {
      sourceRoot = path.resolve(options.source);
    } else {
      if (!options.commit) throw new Error("--commit is required for a repository source");
      temporary = await fs.mkdtemp(path.join(os.tmpdir(), "pstack-upstream-"));
      await run("git", ["clone", "--filter=blob:none", "--no-checkout", options.source, temporary], cwd);
      await run("git", ["-C", temporary, "sparse-checkout", "set", options.subdirectory ?? "pstack"], cwd);
      await run("git", ["-C", temporary, "checkout", "--detach", options.commit], cwd);
      sourceRoot = path.join(temporary, options.subdirectory ?? "pstack");
    }

    const files = await inventoryDirectory(sourceRoot);
    if (options.lock) {
      const lock = JSON.parse(await fs.readFile(path.resolve(options.lock), "utf8"));
      const expected = new Map(lock.files.map((file) => [file.path, file.sha256]));
      const actual = new Map(files.map((file) => [file.path, file.sha256]));
      const mismatches = [];
      for (const [file, hash] of expected) {
        if (!actual.has(file)) mismatches.push(`missing: ${file}`);
        else if (actual.get(file) !== hash) mismatches.push(`changed: ${file}`);
      }
      for (const file of actual.keys()) if (!expected.has(file)) mismatches.push(`added: ${file}`);
      if (mismatches.length) throw new Error(`Snapshot does not match lock:\n${mismatches.join("\n")}`);
    }
    if (!options.dryRun) {
      if (!output) throw new Error("--output is required unless --dry-run is used");
      await copyTree(sourceRoot, output, files);
    }
    return { fileCount: files.length, output, dryRun: options.dryRun };
  } finally {
    if (temporary) await fs.rm(temporary, { recursive: true, force: true });
  }
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const result = await importUpstream({
    cwd: process.cwd(),
    source: args.source,
    commit: args.commit,
    subdirectory: args.subdirectory,
    output: args.output,
    lock: args.lock ?? (args.verifyLock ? "upstream.lock.json" : undefined),
    dryRun: args.dryRun,
  });
  console.log(`${result.dryRun ? "Verified" : "Imported"} ${result.fileCount} files${result.output ? ` at ${result.output}` : ""}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
