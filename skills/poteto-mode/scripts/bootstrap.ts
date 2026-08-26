import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const defaultScriptsDirectory = dirname(fileURLToPath(import.meta.url));

export interface DependencyBootstrapOptions {
  readonly scriptsDirectory?: string;
  readonly env?: NodeJS.ProcessEnv;
}

function resolveBunExecutable(env: NodeJS.ProcessEnv): string {
  const executable = basename(process.execPath).toLowerCase();
  const candidate = executable === "bun" || executable === "bun.exe"
    ? process.execPath
    : "bun";
  const probe = spawnSync(candidate, ["--version"], {
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (probe.error !== undefined || probe.status !== 0) {
    throw new Error(
      "Bun is required to run pstack-for-codex tools. Install Bun and retry."
    );
  }
  return candidate;
}

function currentInstallKey(scriptsDirectory: string): string {
  return createHash("sha256")
    .update(readFileSync(join(scriptsDirectory, "package.json")))
    .update("\0")
    .update(readFileSync(join(scriptsDirectory, "bun.lock")))
    .digest("hex");
}

export function ensureDependenciesInstalled(
  options: DependencyBootstrapOptions = {}
): void {
  const scriptsDirectory = options.scriptsDirectory ?? defaultScriptsDirectory;
  const env = options.env ?? process.env;
  const bun = resolveBunExecutable(env);
  const nodeModulesDirectory = join(scriptsDirectory, "node_modules");
  const commanderPackagePath = join(
    nodeModulesDirectory,
    "commander",
    "package.json"
  );
  const installKeyPath = join(
    nodeModulesDirectory,
    ".poteto-mode-tools-install-key"
  );
  const installKey = currentInstallKey(scriptsDirectory);
  if (
    existsSync(commanderPackagePath) &&
    existsSync(installKeyPath) &&
    readFileSync(installKeyPath, "utf8").trim() === installKey
  ) {
    return;
  }

  const result = spawnSync(bun, ["install", "--frozen-lockfile"], {
    cwd: scriptsDirectory,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error !== undefined || result.status !== 0) {
    process.stdout.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    throw new Error(
      `bun install --frozen-lockfile exited with status ${result.status ?? "unavailable"}`
    );
  }
  if (!existsSync(commanderPackagePath)) {
    throw new Error(
      "bun install --frozen-lockfile completed without installing commander"
    );
  }

  writeFileSync(installKeyPath, `${installKey}\n`);

  const restarted = spawnSync(bun, process.argv.slice(1), {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
  });
  process.exit(restarted.status ?? 1);
}
