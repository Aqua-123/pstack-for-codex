#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import { replayDeadLetter, validateStateRoot, withStateLease } from "./reconcile-state.mjs";

export async function replayReport({ stateRoot, projectRoot, worktreeRoots = [], reportId }) {
  const root = validateStateRoot(path.resolve(stateRoot), path.resolve(projectRoot), worktreeRoots.map(path.resolve));
  return withStateLease(root, (state) => replayDeadLetter(state, reportId));
}

const REPLAY_FLAGS = new Set(["state-root", "project-root", "report-id"]);

export function parseReplayArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    const key = flag?.startsWith("--") ? flag.slice(2) : null;
    if (!key || !REPLAY_FLAGS.has(key) || key in values || !value || value.startsWith("--")) {
      throw new Error("usage: replay-report.mjs --state-root <absolute> --project-root <repo> --report-id <bny_...>");
    }
    values[key] = value;
  }
  if (Object.keys(values).length !== REPLAY_FLAGS.size) {
    throw new Error("usage: replay-report.mjs --state-root <absolute> --project-root <repo> --report-id <bny_...>");
  }
  return values;
}

async function main(argv) {
  const values = parseReplayArgs(argv);
  const result = await replayReport({ stateRoot: values["state-root"], projectRoot: values["project-root"], reportId: values["report-id"] });
  process.stdout.write(`${JSON.stringify({ status: result.status, reportId: values["report-id"] })}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
