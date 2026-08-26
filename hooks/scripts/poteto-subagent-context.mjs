#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { readActiveState, readHookInput } from "./poteto-mode-state.mjs";

export async function handleSubagentHook(input, options = {}) {
  if (input?.hook_event_name !== "SubagentStart" || input?.agent_type !== "pstack-poteto-agent") return null;
  const pluginData = options.pluginData ?? process.env.PLUGIN_DATA;
  const pluginRoot = options.pluginRoot ?? process.env.PLUGIN_ROOT;
  if (typeof pluginRoot !== "string" || pluginRoot.length === 0) return null;
  const state = await readActiveState({
    pluginData,
    sessionId: input.session_id,
    cwd: input.cwd,
    now: options.now,
    ttlMs: options.ttlMs,
  });
  if (!state) return null;
  const prompt = await fs.readFile(path.join(pluginRoot, "skills/poteto-mode/references/poteto-agent-prompt.md"), "utf8");
  return {
    hookSpecificOutput: {
      hookEventName: "SubagentStart",
      additionalContext: prompt,
    },
  };
}

async function main() {
  const output = await handleSubagentHook(await readHookInput());
  if (output) process.stdout.write(`${JSON.stringify(output)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch(() => {
    process.exitCode = 0;
  });
}
