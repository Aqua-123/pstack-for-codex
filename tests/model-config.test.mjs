import assert from "node:assert/strict";
import test from "node:test";

import { resolveModelPolicy } from "../skills/setup-pstack/scripts/manage-agents.mjs";

test("unobservable model inventory inherits and labels the requested pair unverified", () => {
  const result = resolveModelPolicy({
    requested: { model: "gpt-future", reasoning_effort: "high" },
    observableModels: null,
  });
  assert.deepEqual(result, {
    status: "unverified-inheritance",
    requested: { model: "gpt-future", reasoning_effort: "high" },
    resolved: null,
    toml: {},
  });
});

test("observable model inventory validates the exact model and reasoning pair", () => {
  const observableModels = [
    { slug: "gpt-5.6-sol", reasoning_efforts: ["low", "medium", "high", "xhigh", "max", "ultra"] },
  ];
  assert.deepEqual(
    resolveModelPolicy({ requested: { model: "gpt-5.6-sol", reasoning_effort: "high" }, observableModels }),
    {
      status: "verified-explicit",
      requested: { model: "gpt-5.6-sol", reasoning_effort: "high" },
      resolved: { model: "gpt-5.6-sol", reasoning_effort: "high" },
      toml: { model: "gpt-5.6-sol", model_reasoning_effort: "high" },
    },
  );
  assert.throws(
    () => resolveModelPolicy({ requested: { model: "gpt-5.6-sol", reasoning_effort: "impossible" }, observableModels }),
    /does not support reasoning effort/,
  );
  assert.throws(
    () => resolveModelPolicy({ requested: { model: "missing", reasoning_effort: "high" }, observableModels }),
    /is not in the observable model list/,
  );
});

test("no requested pair inherits without pretending runtime resolution is observable", () => {
  assert.deepEqual(resolveModelPolicy({ requested: null, observableModels: [] }), {
    status: "inherited",
    requested: null,
    resolved: null,
    toml: {},
  });
});
