#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_TTL_MS, STATE_SCHEMA, projectFingerprint, readActiveState, statePaths } from "../hooks/scripts/poteto-mode-state.mjs";

export async function hookStatus({ pluginData, sessionId, cwd, now = Date.now(), ttlMs = DEFAULT_TTL_MS }) {
  const targets = statePaths(pluginData, sessionId);
  const fingerprint = projectFingerprint(cwd);
  if (!targets || !fingerprint) return { status: "current-turn-only", reason: "stable-session-context-unavailable" };
  const state = await readActiveState({ pluginData, sessionId, cwd, now, ttlMs });
  if (!state) return { status: "current-turn-only", reason: "inactive-or-invalid-state" };
  let receipt;
  try {
    receipt = JSON.parse(await fs.readFile(targets.receipt, "utf8"));
  } catch {
    return { status: "current-turn-only", reason: "trusted-hook-receipt-missing" };
  }
  const timestamp = Date.parse(receipt?.lastHookAt ?? "");
  if (
    receipt?.schema !== STATE_SCHEMA ||
    receipt?.projectFingerprint !== fingerprint ||
    !Number.isFinite(timestamp) ||
    now - timestamp > ttlMs
  ) {
    return { status: "current-turn-only", reason: "trusted-hook-receipt-invalid" };
  }
  return { status: "active", reason: "trusted-hook-receipt-present", lastHookAt: receipt.lastHookAt };
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    if (!["--plugin-data", "--session-id", "--cwd"].includes(name) || argv[index + 1] === undefined) return null;
    values[name.slice(2).replaceAll("-", "_")] = argv[index + 1];
  }
  return values;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = args
    ? await hookStatus({ pluginData: args.plugin_data ?? process.env.PLUGIN_DATA, sessionId: args.session_id, cwd: args.cwd ?? process.cwd() })
    : { status: "current-turn-only", reason: "invalid-arguments" };
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (result.status !== "active") process.exitCode = 2;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
