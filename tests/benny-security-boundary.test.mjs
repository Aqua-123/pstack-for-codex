import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  activationBlockers, initialState, normalizeReport, operationKey, reconcileEffect, redactReason, reportId, validateAttachment,
  validateEffect, validateSandboxReceipt, validateTrustedMarker, validateTrustedMarkers, writeStateAtomic,
} from "../automations/benny/scripts/reconcile-state.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const malicious = JSON.parse(await fs.readFile(path.join(root, "tests/fixtures/benny/malicious-report.json"), "utf8"));

test("untrusted report fields cannot change destination, repository, credentials, or authority", () => {
  const config = { sourceChannelId: "C1", workspaceId: "W1", maxTextBytes: 128, maxAttachments: 1 };
  const report = normalizeReport(malicious, config);
  assert.equal(report.channelId, "C1");
  assert.equal(report.repository, undefined);
  assert.equal(report.credential, undefined);
  assert.equal(report.attachments.length, 1);
  assert.ok(report.text.length <= 128);
  assert.equal(report.workspaceId, "W1");
  assert.throws(() => normalizeReport({ ...malicious, workspaceId: "W-EVIL" }, config), /workspace mismatch/);
});

test("report text truncation honors UTF-8 byte boundaries", () => {
  const report = normalizeReport({ channelId: "C1", rootTs: "1", providerTs: "1", text: "😀😀a" }, { sourceChannelId: "C1", workspaceId: "W1", maxTextBytes: 5 });
  assert.equal(report.text, "😀");
  assert.equal(Buffer.byteLength(report.text, "utf8"), 4);
});

test("trusted markers require exact coordinates, recomputed ID, verdict, and approved identity", () => {
  const report = normalizeReport(malicious, { sourceChannelId: "C1", workspaceId: "W1" });
  const config = { trustedTriageIdentity: "U-TRIAGE", migratedTriageIdentities: [], allowedVerdicts: ["bug", "performance"] };
  const marker = { schemaVersion: 1, kind: "benny-verdict", reportId: report.reportId, workspaceId: "W1", channelId: "C1", rootTs: "200.1", authorId: "U-TRIAGE", verdict: "bug" };
  assert.equal(validateTrustedMarker(marker, report, config).status, "accepted");
  assert.equal(validateTrustedMarker({ ...marker, authorId: "U-WRONG" }, report, config).reason, "marker-identity");
  assert.equal(validateTrustedMarker({ ...marker, reportId: reportId({ workspaceId: "W1", channelId: "C1", rootTs: "other" }) }, report, config).reason, "marker-report-id");
  assert.equal(validateTrustedMarker(null, report, config).status, "pending");
  assert.equal(validateTrustedMarkers([marker, { ...marker, verdict: "performance" }], report, config).reason, "marker-conflict");
});

test("attachments reject unsafe schemes, domains, redirects, and resolved private addresses", async () => {
  const policy = { allowedDomains: ["files.example.invalid"], allowedMime: ["image/png"], maxBytes: 1024, maxRedirects: 1, maxArchiveEntries: 3, maxArchiveExpandedBytes: 4096, redirects: {} };
  await assert.rejects(() => validateAttachment("file:///etc/passwd", policy), /scheme/);
  await assert.rejects(() => validateAttachment("https://evil.invalid/a", policy, async () => ["93.184.216.34"]), /domain/);
  await assert.rejects(() => validateAttachment("https://files.example.invalid/a", policy, async () => ["127.0.0.1"]), /address/);
  for (const address of ["0.0.0.0", "10.0.0.1", "100.64.0.1", "169.254.1.1", "192.0.2.1", "198.51.100.2", "203.0.113.2", "224.0.0.1", "::", "::1", "::ffff:127.0.0.1", "fc00::1", "fe80::1", "ff02::1", "2001:db8::1"]) {
    await assert.rejects(() => validateAttachment("https://files.example.invalid/a", policy, async () => [address]), /address/, address);
  }
  const safe = await validateAttachment("https://files.example.invalid/a", policy, async () => ["93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946"]);
  assert.equal(safe.forwardCredentials, false);
  assert.deepEqual(safe.resolvedAddresses, ["93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946"]);
  const redirectPolicy = { ...policy, redirects: { "https://files.example.invalid/a": "https://evil.invalid/b" } };
  await assert.rejects(() => validateAttachment("https://files.example.invalid/a", redirectPolicy, async () => ["93.184.216.34"]), /domain/);
  await assert.rejects(() => validateAttachment({ url: "https://files.example.invalid/a", mime: "application/zip", size: 10 }, policy, async () => ["93.184.216.34"]), /MIME/);
  await assert.rejects(() => validateAttachment({ url: "https://files.example.invalid/a", mime: "image/png", size: 2048 }, policy, async () => ["93.184.216.34"]), /size/);
  await assert.rejects(() => validateAttachment({ url: "https://files.example.invalid/a", mime: "image/png", size: 10, archiveExpandedBytes: 5000 }, policy, async () => ["93.184.216.34"]), /expansion/);
});

test("repository execution requires credential-free default-deny network proof", () => {
  assert.deepEqual(validateSandboxReceipt({ credentialsPresent: false, networkDefault: "deny", allowedHosts: ["registry.example.invalid"] }).networkDefault, "deny");
  assert.throws(() => validateSandboxReceipt({ credentialsPresent: true, networkDefault: "deny", allowedHosts: [] }), /credentials/);
  assert.throws(() => validateSandboxReceipt({ credentialsPresent: false, networkDefault: "allow", allowedHosts: [] }), /deny network/);
  assert.throws(() => validateSandboxReceipt({ credentialsPresent: false, networkDefault: "deny", allowedHosts: ["localhost"] }), /invalid/);
});

test("typed coordinator effects reject root posts, off-scope targets, credentials, contacts, and extra fields", () => {
  const id = reportId({ workspaceId: "W1", channelId: "C1", rootTs: "2" });
  const config = { sourceChannelId: "C1", operationsChannelId: "C-OPS", repository: "org/repo", maxOutboundBytes: 512 };
  const base = { schemaVersion: 1, type: "thread-verdict", reportId: id, operationKey: operationKey(id, "thread-verdict"), channelId: "C1", rootTs: "2", sourceRootTs: "2", payload: { verdict: "bug", sourceUrl: "https://slack.example/thread" } };
  assert.equal(validateEffect(base, config), base);
  assert.throws(() => validateEffect({ ...base, rootTs: "" }, config), /root post/);
  assert.throws(() => validateEffect({ ...base, channelId: "C-EVIL" }, config), /off-channel/);
  assert.throws(() => validateEffect({ ...base, payload: { body: "contact me at person@example.com" } }, config), /privacy/);
  assert.throws(() => validateEffect({ ...base, payload: { body: "ghp_abcdefghijklmnopqrstuvwxyz" } }, config), /privacy/);
  assert.throws(() => validateEffect({ ...base, payload: { rawReport: "data" } }, config), /not allowlisted/);
  assert.equal(validateEffect({ ...base, payload: { body: "build 2026-08-26 09:14:22 id 123456789" } }, config).type, "thread-verdict");
  assert.throws(() => validateEffect({ ...base, payload: { body: "😀😀" } }, { ...config, maxOutboundBytes: 10 }), /budget/);
});

test("effect validation is classified and redaction removes every sensitive value", async () => {
  const id = reportId({ workspaceId: "W1", channelId: "C1", rootTs: "privacy" });
  const invalid = { schemaVersion: 1, type: "tracker-upsert", reportId: id, operationKey: operationKey(id, "tracker-upsert"), repository: "evil/repo", payload: { summary: "x" } };
  assert.deepEqual(await reconcileEffect({ lookup: async () => ({ status: "absent" }) }, invalid, { sourceChannelId: "C1", repository: "org/repo" }), { status: "quarantined", reason: "effect-validation-failed" });
  const reason = redactReason("xoxb-first person@example.com ghp_abcdefghijklmnopqrstuvwxyz second@example.org +1 212 555 0100");
  assert.doesNotMatch(reason, /xoxb-|ghp_|@|212 555/);
  assert.equal(reason.match(/\[redacted\]/g)?.length, 5);
});

test("every missing capability or adapter proof is a fail-closed activation blocker", () => {
  const blockers = activationBlockers({ adapters: {}, capabilities: {}, canaries: {} });
  for (const expected of ["canonical-state-root-missing", "capability:repository.network-deny", "adapter:slack:unqualified", "canary:ambiguous-write:not-passed"]) {
    assert.ok(blockers.includes(expected), expected);
  }
});

test("state persistence rejects credential fields and secret-shaped values", async () => {
  const state = initialState();
  state.setupReceipt = { credentialRefs: ["env:BENNY_SLACK_TOKEN"], token: "should-not-persist" };
  await assert.rejects(() => writeStateAtomic("/tmp/.codex/benny/security-test", state), /credential field/);
  const valueState = initialState();
  valueState.setupReceipt = { note: "xoxb-secret-material" };
  await assert.rejects(() => writeStateAtomic("/tmp/.codex/benny/security-test", valueState), /credential-like/);
});
