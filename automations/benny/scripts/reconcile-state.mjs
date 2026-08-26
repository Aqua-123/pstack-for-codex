#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { isIP } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const STATE_SCHEMA_VERSION = 1;
export const MARKER_SCHEMA_VERSION = 1;
export const EFFECT_SCHEMA_VERSION = 1;
export const TERMINAL_REPORT_STATES = new Set(["reconciled", "dead-lettered"]);
export const EFFECT_TYPES = new Set(["tracker-upsert", "thread-verdict", "evidence-post", "branch-create", "draft-pr"]);
export const AUTOMATIONS = Object.freeze([
  { key: "triage", name: "pstack-benny-triage", schedule: "every 5 minutes", status: "PAUSED" },
  { key: "reproduce", name: "pstack-benny-reproduce", schedule: "every 5 minutes", status: "PAUSED" },
]);

const REQUIRED_CAPABILITIES = Object.freeze([
  "slack.read", "slack.thread-reply", "slack.attachments", "tracker.read", "tracker.write",
  "repository.read", "repository.isolated-exec", "repository.network-deny", "draft-pr.create",
  "control.ui", "feature-map.approved", "state.atomic", "state.shared", "operator.approved",
]);

function hash(parts) {
  return createHash("sha256").update(parts.join("\0"), "utf8").digest("hex");
}

export function reportId({ workspaceId, teamId, channelId, rootTs }) {
  const workspace = workspaceId || teamId;
  if (![workspace, channelId, rootTs].every((value) => typeof value === "string" && value.trim())) {
    throw new Error("report identity requires workspace/team, channel, and root thread timestamp");
  }
  return `bny_${hash([workspace, channelId, rootTs])}`;
}

export function operationKey(id, effectType, version = EFFECT_SCHEMA_VERSION) {
  if (!/^bny_[a-f0-9]{64}$/.test(id)) throw new Error("invalid report_id");
  if (!EFFECT_TYPES.has(effectType)) throw new Error(`unsupported effect type: ${effectType}`);
  return `benny:v${version}:${effectType}:${id}`;
}

export function operationLookupKeys(id, effectType, version = EFFECT_SCHEMA_VERSION) {
  if (!Number.isInteger(version) || version < 1) throw new Error("invalid effect schema version");
  return Array.from({ length: version }, (_, index) => operationKey(id, effectType, version - index));
}

export function compareTuple(left, right) {
  const timestamp = Number(left.providerTs) - Number(right.providerTs);
  return timestamp || String(left.providerId).localeCompare(String(right.providerId));
}

export function initialState() {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    highWater: { providerTs: "0", providerId: "" },
    reports: {},
    deadLetters: {},
    automationIds: {},
    setupReceipt: null,
  };
}

function inside(candidate, parent) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function validateStateRoot(stateRoot, projectRoot, worktreeRoots = []) {
  if (!path.isAbsolute(stateRoot)) throw new Error("canonical state root must be absolute");
  if (!stateRoot.split(path.sep).includes(".codex") || !stateRoot.split(path.sep).includes("benny")) {
    throw new Error("canonical state root must be a user-owned .codex/benny location");
  }
  for (const root of [projectRoot, ...worktreeRoots].filter(Boolean)) {
    if (inside(stateRoot, root)) throw new Error("worktree-local Benny state is forbidden");
  }
  return path.resolve(stateRoot);
}

function assertSecretFree(value, pointer = "$") {
  if (value == null) return;
  if (typeof value === "string") {
    if (/\b(?:xox[baprs]-|gh[pousr]_|sk-[A-Za-z0-9]|AKIA[0-9A-Z]{12})/i.test(value)) {
      throw new Error(`credential-like value forbidden at ${pointer}`);
    }
    return;
  }
  if (Array.isArray(value)) return value.forEach((item, index) => assertSecretFree(item, `${pointer}[${index}]`));
  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (/(?:secret|token|password|credential|api[_-]?key)(?:$|_)/i.test(key) && child) {
        throw new Error(`credential field forbidden at ${pointer}.${key}`);
      }
      assertSecretFree(child, `${pointer}.${key}`);
    }
  }
}

export async function readState(stateRoot) {
  const stateFile = path.join(stateRoot, "state.json");
  const stat = await fs.lstat(stateFile).catch((error) => error.code === "ENOENT" ? null : Promise.reject(error));
  if (!stat) return initialState();
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Benny state must be a regular file");
  if ((stat.mode & 0o077) !== 0) throw new Error("Benny state permissions must be owner-only");
  const state = JSON.parse(await fs.readFile(stateFile, "utf8"));
  if (!state || Array.isArray(state) || typeof state !== "object") throw new Error("invalid Benny state");
  if (state.schemaVersion !== STATE_SCHEMA_VERSION) throw new Error("unsupported Benny state schema");
  const expectedKeys = new Set(["schemaVersion", "highWater", "reports", "deadLetters", "automationIds", "setupReceipt"]);
  if (Object.keys(state).some((key) => !expectedKeys.has(key))) throw new Error("invalid Benny state fields");
  if (!state.highWater || typeof state.highWater.providerTs !== "string" || !Number.isFinite(Number(state.highWater.providerTs)) || typeof state.highWater.providerId !== "string") {
    throw new Error("invalid Benny high-water mark");
  }
  for (const key of ["reports", "deadLetters", "automationIds"]) {
    if (!state[key] || Array.isArray(state[key]) || typeof state[key] !== "object") throw new Error(`invalid Benny ${key}`);
  }
  if (state.setupReceipt !== null && (Array.isArray(state.setupReceipt) || typeof state.setupReceipt !== "object")) throw new Error("invalid Benny setup receipt");
  assertSecretFree(state);
  return state;
}

export async function writeStateAtomic(stateRoot, state) {
  assertSecretFree(state);
  await fs.mkdir(stateRoot, { recursive: true, mode: 0o700 });
  await fs.chmod(stateRoot, 0o700);
  const target = path.join(stateRoot, "state.json");
  const temp = path.join(stateRoot, `.state.${process.pid}.${randomUUID()}.tmp`);
  await fs.writeFile(temp, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  await fs.rename(temp, target);
  await fs.chmod(target, 0o600);
}

function validLease(value) {
  return value && typeof value === "object"
    && /^[a-f0-9-]{36}$/i.test(value.ownerToken)
    && Number.isFinite(value.acquiredAt)
    && Number.isFinite(value.expiresAt)
    && value.expiresAt >= value.acquiredAt;
}

async function acquireLease(lock, ownerToken, leaseMs, now) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await fs.open(lock, "wx", 0o600);
      const acquiredAt = now();
      await handle.writeFile(`${JSON.stringify({ ownerToken, acquiredAt, expiresAt: acquiredAt + leaseMs })}\n`);
      await handle.sync();
      return handle;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const stat = await fs.lstat(lock);
      if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0) throw new Error("invalid Benny state lease");
      let observed;
      try { observed = JSON.parse(await fs.readFile(lock, "utf8")); } catch { throw new Error("invalid Benny state lease"); }
      if (!validLease(observed)) throw new Error("invalid Benny state lease");
      if (observed.expiresAt > now()) throw new Error("Benny state lease is already held");

      const stale = `${lock}.stale.${ownerToken}`;
      await fs.rename(lock, stale).catch((renameError) => {
        if (renameError.code !== "ENOENT") throw renameError;
      });
      const moved = await fs.readFile(stale, "utf8").then(JSON.parse).catch(() => null);
      if (!validLease(moved) || moved.ownerToken !== observed.ownerToken) {
        throw new Error("Benny state lease changed during stale recovery");
      }
      await fs.unlink(stale);
    }
  }
  throw new Error("Benny state lease is already held");
}

export async function withStateLease(stateRoot, callback, { leaseMs = 300_000, now = Date.now } = {}) {
  if (!Number.isFinite(leaseMs) || leaseMs <= 0) throw new Error("invalid Benny lease duration");
  await fs.mkdir(stateRoot, { recursive: true, mode: 0o700 });
  const lock = path.join(stateRoot, "state.lock");
  const ownerToken = randomUUID();
  const handle = await acquireLease(lock, ownerToken, leaseMs, now);
  try {
    const state = await readState(stateRoot);
    const result = await callback(state);
    await writeStateAtomic(stateRoot, state);
    return result;
  } finally {
    await handle.close();
    const held = await fs.readFile(lock, "utf8").then(JSON.parse).catch(() => null);
    if (held?.ownerToken === ownerToken) {
      await fs.unlink(lock).catch((error) => { if (error.code !== "ENOENT") throw error; });
    }
  }
}

export function activationBlockers(config) {
  const blockers = [];
  if (!config?.stateRoot) blockers.push("canonical-state-root-missing");
  if (!config?.approvedConfigHash || !/^[a-f0-9]{64}$/.test(config.approvedConfigHash)) blockers.push("approved-config-hash-missing");
  if (!config?.trustedTriageIdentity) blockers.push("trusted-triage-identity-missing");
  for (const capability of REQUIRED_CAPABILITIES) {
    if (config?.capabilities?.[capability] !== true) blockers.push(`capability:${capability}`);
  }
  for (const adapter of ["slack", "tracker", "repository", "draftPr", "control"]) {
    const entry = config?.adapters?.[adapter];
    if (!entry?.qualified) blockers.push(`adapter:${adapter}:unqualified`);
    if (entry?.writes && !["atomic-idempotency", "authoritative-lookup"].includes(entry.idempotency)) {
      blockers.push(`adapter:${adapter}:idempotency-unproven`);
    }
    if (!Array.isArray(entry?.credentialRefs) || entry.credentialRefs.some((ref) => !/^(?:env|keychain|secret-manager):[A-Za-z0-9_.:/-]+$/.test(ref))) {
      blockers.push(`adapter:${adapter}:credential-reference-invalid`);
    }
  }
  for (const canary of ["read-only", "test-channel-triage", "repro-only", "bounded-fix", "concurrent-race", "ambiguous-write"]) {
    if (config?.canaries?.[canary] !== "passed") blockers.push(`canary:${canary}:not-passed`);
  }
  return [...new Set(blockers)].sort();
}

export function automationDescriptors(config, existing = {}) {
  const blockers = activationBlockers(config);
  return AUTOMATIONS.map((descriptor) => ({
    ...descriptor,
    id: existing[descriptor.key] ?? null,
    status: "PAUSED",
    activationBlockers: blockers,
  }));
}

export function normalizeReport(raw, config) {
  const channelId = String(raw.channelId ?? "");
  const rootTs = String(raw.rootTs ?? raw.providerTs ?? "");
  if (channelId !== config.sourceChannelId) throw new Error("off-channel report rejected");
  if (raw.threadTs && String(raw.threadTs) !== rootTs) throw new Error("non-root report rejected");
  if (raw.workspaceId != null && String(raw.workspaceId) !== String(config.workspaceId ?? "")) throw new Error("workspace mismatch rejected");
  const normalized = {
    workspaceId: String(config.workspaceId ?? ""),
    channelId,
    rootTs,
    providerTs: String(raw.providerTs ?? rootTs),
    providerId: String(raw.providerId ?? raw.messageId ?? rootTs),
    authorId: String(raw.authorId ?? ""),
    text: truncateUtf8(String(raw.text ?? ""), config.maxTextBytes ?? 16_384),
    attachments: Array.isArray(raw.attachments) ? raw.attachments.slice(0, config.maxAttachments ?? 8).map((item) => ({
      url: String(item.url ?? ""), mime: String(item.mime ?? ""), size: Number(item.size ?? 0),
    })) : [],
  };
  normalized.reportId = reportId(normalized);
  return normalized;
}

function truncateUtf8(value, maxBytes) {
  if (!Number.isFinite(maxBytes) || maxBytes < 0) throw new Error("invalid byte limit");
  if (Buffer.byteLength(value, "utf8") <= maxBytes) return value;
  let result = "";
  let used = 0;
  for (const character of value) {
    const bytes = Buffer.byteLength(character, "utf8");
    if (used + bytes > maxBytes) break;
    result += character;
    used += bytes;
  }
  return result;
}

function ipv4Number(address) {
  return address.split(".").reduce((value, octet) => (value << 8) + Number(octet), 0) >>> 0;
}

function ipv4InCidr(value, base, prefix) {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (value & mask) === (ipv4Number(base) & mask);
}

function ipv6Number(address) {
  let source = address.toLowerCase().split("%")[0];
  if (source.includes(".")) {
    const boundary = source.lastIndexOf(":");
    const ipv4 = ipv4Number(source.slice(boundary + 1));
    source = `${source.slice(0, boundary)}:${(ipv4 >>> 16).toString(16)}:${(ipv4 & 0xffff).toString(16)}`;
  }
  const halves = source.split("::");
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const groups = halves.length === 2 ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right] : left;
  return groups.reduce((value, group) => (value << 16n) | BigInt(`0x${group || "0"}`), 0n);
}

function ipv6InCidr(value, base, prefix) {
  const shift = BigInt(128 - prefix);
  return (value >> shift) === (ipv6Number(base) >> shift);
}

function isNonGlobalAddress(address) {
  const kind = isIP(address);
  if (kind === 4) {
    const value = ipv4Number(address);
    return [
      ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
      ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
      ["192.88.99.0", 24], ["192.168.0.0", 16], ["192.175.48.0", 24], ["198.18.0.0", 15],
      ["198.51.100.0", 24], ["203.0.113.0", 24],
      ["224.0.0.0", 4], ["240.0.0.0", 4],
    ].some(([base, prefix]) => ipv4InCidr(value, base, prefix));
  }
  if (kind !== 6) return true;
  const mapped = address.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mapped) return isNonGlobalAddress(mapped[1]);
  const value = ipv6Number(address);
  const globalUnicast = (value >> 125n) === 1n;
  const protocolAssignments = ipv6InCidr(value, "2001::", 23);
  const documentation = ipv6InCidr(value, "2001:db8::", 32) || ipv6InCidr(value, "3fff::", 20);
  const segmentRouting = ipv6InCidr(value, "5f00::", 16);
  return !globalUnicast || protocolAssignments || documentation || segmentRouting;
}

export async function validateAttachment(input, policy, resolveHost = async () => []) {
  const attachment = typeof input === "string" ? { url: input } : input;
  if (attachment.size != null && (!Number.isFinite(attachment.size) || attachment.size < 0 || attachment.size > policy.maxBytes)) throw new Error("attachment size rejected");
  if (attachment.mime && !policy.allowedMime?.includes(attachment.mime)) throw new Error("attachment MIME rejected");
  if (attachment.archiveEntries != null && attachment.archiveEntries > policy.maxArchiveEntries) throw new Error("attachment archive entry limit exceeded");
  if (attachment.archiveExpandedBytes != null && attachment.archiveExpandedBytes > policy.maxArchiveExpandedBytes) throw new Error("attachment archive expansion limit exceeded");
  let current = new URL(attachment.url);
  for (let hop = 0; hop <= policy.maxRedirects; hop += 1) {
    if (current.protocol !== "https:") throw new Error("attachment scheme rejected");
    if (!policy.allowedDomains.includes(current.hostname)) throw new Error("attachment domain rejected");
    const addresses = await resolveHost(current.hostname);
    if (!addresses.length || addresses.some(isNonGlobalAddress)) throw new Error("attachment address rejected");
    const next = policy.redirects?.[current.href];
    if (!next) return { url: current.href, forwardCredentials: false, resolvedAddresses: [...addresses] };
    if (hop === policy.maxRedirects) throw new Error("attachment redirect limit exceeded");
    current = new URL(next);
  }
  throw new Error("attachment rejected");
}

export function validateTrustedMarker(marker, report, config) {
  if (!marker) return { status: "pending", reason: "marker-missing" };
  if (marker.schemaVersion !== MARKER_SCHEMA_VERSION || marker.kind !== "benny-verdict") return { status: "quarantined", reason: "marker-schema" };
  if (marker.channelId !== report.channelId || marker.rootTs !== report.rootTs) return { status: "quarantined", reason: "marker-coordinates" };
  if (marker.reportId !== report.reportId) return { status: "quarantined", reason: "marker-report-id" };
  const identities = new Set([config.trustedTriageIdentity, ...(config.migratedTriageIdentities ?? [])]);
  if (!identities.has(marker.authorId)) return { status: "quarantined", reason: "marker-identity" };
  if (!config.allowedVerdicts.includes(marker.verdict)) return { status: "quarantined", reason: "marker-verdict" };
  return { status: "accepted", verdict: marker.verdict };
}

export function validateTrustedMarkers(markers, report, config) {
  if (!Array.isArray(markers) || markers.length === 0) return { status: "pending", reason: "marker-missing" };
  const results = markers.map((marker) => validateTrustedMarker(marker, report, config));
  const accepted = results.filter((result) => result.status === "accepted");
  if (markers.length !== 1 || accepted.length !== 1) return { status: "quarantined", reason: "marker-conflict" };
  return accepted[0];
}

const EMAIL_SOURCE = String.raw`[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}`;
const PHONE_SOURCE = String.raw`(?:\+\d(?:[\s().-]*\d){7,}|\(\d{2,4}\)(?:[\s.-]*\d){5,}|\d{3}[-. ]\d{3}[-. ]\d{4})`;
const CREDENTIAL_SOURCE = String.raw`(?:xox[baprs]-[A-Za-z0-9-]+|gh[pousr]_[A-Za-z0-9]+|sk-[A-Za-z0-9]{10,}|AKIA[0-9A-Z]{12})`;

function containsSensitive(value) {
  return new RegExp(`${CREDENTIAL_SOURCE}|${EMAIL_SOURCE}|${PHONE_SOURCE}`, "i").test(value);
}

export function validateEffect(effect, config) {
  if (!effect || effect.schemaVersion !== EFFECT_SCHEMA_VERSION || !EFFECT_TYPES.has(effect.type)) throw new Error("invalid typed effect");
  if (effect.channelId && effect.channelId !== config.sourceChannelId && effect.channelId !== config.operationsChannelId) throw new Error("off-channel effect rejected");
  if (effect.channelId === config.sourceChannelId && effect.rootTs !== effect.sourceRootTs) throw new Error("source root post rejected");
  if (effect.repository && effect.repository !== config.repository) throw new Error("off-repository effect rejected");
  if (effect.operationKey !== operationKey(effect.reportId, effect.type)) throw new Error("operation key mismatch");
  const outbound = JSON.stringify(effect.payload ?? {});
  if (Buffer.byteLength(outbound, "utf8") > (config.maxOutboundBytes ?? 4096)) throw new Error("outbound budget exceeded");
  if (containsSensitive(outbound)) throw new Error("outbound privacy scan failed");
  const keys = Object.keys(effect.payload ?? {});
  const allowed = new Set(["summary", "verdict", "sourceUrl", "trackerUrl", "evidenceUrl", "title", "body", "branch", "base"]);
  if (keys.some((key) => !allowed.has(key))) throw new Error("outbound field not allowlisted");
  return effect;
}

export async function reconcileEffect(adapter, effect, config) {
  try {
    validateEffect(effect, config);
    for (const key of operationLookupKeys(effect.reportId, effect.type, effect.schemaVersion)) {
      const found = await adapter.lookup(key);
      if (found?.status === "confirmed") return { status: "confirmed", destinationId: found.destinationId, reconciled: true };
      if (found?.status !== "absent") return { status: "quarantined", reason: "ambiguous-destination-lookup" };
    }
    const result = await adapter.apply(effect);
    if (result?.status !== "confirmed") return { status: "quarantined", reason: "ambiguous-write" };
    return { status: "confirmed", destinationId: result.destinationId, reconciled: false };
  } catch (error) {
    if (/^(?:invalid typed effect|off-channel effect rejected|source root post rejected|off-repository effect rejected|operation key mismatch|outbound budget exceeded|outbound privacy scan failed|outbound field not allowlisted)$/.test(error.message)) {
      return { status: "quarantined", reason: "effect-validation-failed" };
    }
    if (["AUTH_REVOKED", "MISSING_SCOPE"].includes(error.code)) return { status: "blocked", reason: "adapter-authorization-lost" };
    return error.code === "AMBIGUOUS" ? { status: "quarantined", reason: "ambiguous-write" } : { status: "retry", reason: redactReason(error.message) };
  }
}

export function redactReason(reason) {
  return String(reason ?? "unknown failure")
    .replace(new RegExp(CREDENTIAL_SOURCE, "gi"), "[redacted]")
    .replace(new RegExp(EMAIL_SOURCE, "gi"), "[redacted]")
    .replace(new RegExp(PHONE_SOURCE, "gi"), "[redacted]")
    .slice(0, 256);
}

export function selectPollBatch(pages, state, { cutoff, overlapSeconds = 120, batchLimit = 50 }) {
  const floor = Math.max(0, Number(state.highWater.providerTs) - overlapSeconds);
  return pages.flat().filter((item) => {
    if (Number(item.providerTs) > Number(cutoff) || Number(item.providerTs) < floor) return false;
    if (compareTuple(item, state.highWater) > 0) return true;
    const id = reportId(item);
    const status = state.reports[id]?.status ?? (state.deadLetters[id] ? "dead-lettered" : "pending");
    return !TERMINAL_REPORT_STATES.has(status);
  })
    .sort(compareTuple).slice(0, batchLimit);
}

export async function collectFixedCutoffPages(fetchPage, { cutoff, maxPages = 20 }) {
  const pages = [];
  let cursor = null;
  for (let page = 0; page < maxPages; page += 1) {
    const result = await fetchPage({ cursor, cutoff });
    if (!result || !Array.isArray(result.items)) throw new Error("invalid polling page");
    pages.push(result.items);
    if (!result.nextCursor) return pages;
    cursor = result.nextCursor;
  }
  throw new Error("poll pagination limit exceeded");
}

export function retryDelaySeconds(attempt, { baseSeconds = 2, capSeconds = 60, retryLimit = 3 } = {}) {
  if (!Number.isInteger(attempt) || attempt < 1 || attempt > retryLimit) throw new Error("retry attempt outside bounded policy");
  return Math.min(capSeconds, baseSeconds * (2 ** (attempt - 1)));
}

export function validateSandboxReceipt(receipt) {
  if (receipt?.credentialsPresent !== false) throw new Error("repository sandbox contains credentials");
  if (receipt?.networkDefault !== "deny") throw new Error("repository sandbox must deny network by default");
  if (!Array.isArray(receipt.allowedHosts)) throw new Error("repository sandbox allowed hosts must be receipted");
  for (const host of receipt.allowedHosts) {
    if (!/^[a-z0-9.-]+$/i.test(host) || host === "localhost") throw new Error("invalid repository sandbox host");
  }
  return receipt;
}

export function advanceHighWater(state, ordered) {
  let next = state.highWater;
  for (const item of ordered) {
    const id = reportId(item);
    const status = state.reports[id]?.status ?? (state.deadLetters[id] ? "dead-lettered" : "pending");
    if (!TERMINAL_REPORT_STATES.has(status)) break;
    const tuple = { providerTs: String(item.providerTs), providerId: String(item.providerId) };
    if (compareTuple(tuple, next) > 0) next = tuple;
  }
  state.highWater = next;
  return next;
}

export function deadLetter(state, report, reason, now = new Date().toISOString()) {
  const id = report.reportId ?? reportId(report);
  const record = { reportId: id, reason: redactReason(reason), deadLetteredAt: now, attempts: state.reports[id]?.attempts ?? 0 };
  state.deadLetters[id] = record;
  state.reports[id] = { ...(state.reports[id] ?? {}), status: "dead-lettered", updatedAt: now };
  return record;
}

export function replayDeadLetter(state, id, now = new Date().toISOString()) {
  if (!/^bny_[a-f0-9]{64}$/.test(id)) throw new Error("invalid report_id");
  if (!state.deadLetters[id]) throw new Error("report_id is not dead-lettered");
  delete state.deadLetters[id];
  state.reports[id] = { ...(state.reports[id] ?? {}), status: "pending", replayRequestedAt: now };
  return state.reports[id];
}

export function purgeExpired(state, now, retentionDays) {
  const threshold = new Date(now).getTime() - retentionDays * 86_400_000;
  for (const [id, record] of Object.entries(state.deadLetters)) {
    if (new Date(record.deadLetteredAt).getTime() < threshold) {
      delete state.deadLetters[id];
      delete state.reports[id];
    }
  }
  return state;
}

async function main(argv) {
  if (argv[0] !== "status" || !argv[1]) throw new Error("usage: reconcile-state.mjs status <canonical-state-root>");
  const state = await readState(path.resolve(argv[1]));
  process.stdout.write(`${JSON.stringify({ highWater: state.highWater, reports: Object.keys(state.reports).length, deadLetters: Object.keys(state.deadLetters).length }, null, 2)}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
