/**
 * ws-public-data.service.ts
 *
 * WebSocket endpoint: /ws/public-data
 *
 * On every new client connection → immediately sends the current snapshot.
 * Every 30 seconds → queries MongoDB for active jobs & profiles,
 * diffs against the previous snapshot, and broadcasts the full dataset
 * along with arrays of changed IDs so the UI can flash those rows.
 */
import { WebSocketServer, WebSocket } from "ws";
import { Job, CandidateProfile } from "../models";

// ── Helpers ─────────────────────────────────────────────────────────────────

function camelToSnake(str: string): string {
  return str.replaceAll(/([A-Z])/g, "_$1").toLowerCase();
}

function toSnakeCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[camelToSnake(key)] = value;
  }
  return result;
}

function jobToJSON(job: Record<string, unknown>): Record<string, unknown> {
  return toSnakeCase({ ...job, id: job._id });
}

function profileToJSON(p: Record<string, unknown>): Record<string, unknown> {
  return toSnakeCase({ ...p, id: p._id });
}

// ── State ───────────────────────────────────────────────────────────────────

let wss: WebSocketServer | null = null;

/** Stringified snapshot per record id — used for diffing */
let prevJobMap = new Map<string, string>();
let prevProfileMap = new Map<string, string>();

/** Cached payloads so we can send immediately on new connections */
let lastJobsPayload: Record<string, unknown>[] = [];
let lastProfilesPayload: Record<string, unknown>[] = [];

/** Previous-cycle parsed objects keyed by id — used to send deleted row data */
let prevJobObjects = new Map<string, Record<string, unknown>>();
let prevProfileObjects = new Map<string, Record<string, unknown>>();

const BROADCAST_INTERVAL_MS = 30_000;
const MAX_ROWS = 25;

// ── Diff helper ─────────────────────────────────────────────────────────────

interface DiffResult {
  newMap: Map<string, string>;
  newObjects: Map<string, Record<string, unknown>>;
  changedIds: string[];
  deletedIds: string[];
  deletedItems: Record<string, unknown>[];
}

function diffRecords(
  items: Record<string, unknown>[],
  prevMap: Map<string, string>,
  prevObjects: Map<string, Record<string, unknown>>,
): DiffResult {
  const newMap = new Map<string, string>();
  const newObjects = new Map<string, Record<string, unknown>>();
  const changedIds: string[] = [];
  const deletedIds: string[] = [];
  const deletedItems: Record<string, unknown>[] = [];

  for (const item of items) {
    const id = item.id as string;
    const serialized = JSON.stringify(item);
    newMap.set(id, serialized);
    newObjects.set(id, item);
    const prev = prevMap.get(id);
    if (prev === undefined || prev !== serialized) {
      changedIds.push(id);
    }
  }
  for (const oldId of prevMap.keys()) {
    if (!newMap.has(oldId)) {
      deletedIds.push(oldId);
      const oldObj = prevObjects.get(oldId);
      if (oldObj) deletedItems.push(oldObj);
    }
  }

  return { newMap, newObjects, changedIds, deletedIds, deletedItems };
}

// ── Simulated activity helper ───────────────────────────────────────────────

function simulateActivity(
  items: Record<string, unknown>[],
  changedIds: string[],
  deletedIds: string[],
  deletedItems: Record<string, unknown>[],
): void {
  if (changedIds.length > 0 || deletedIds.length > 0 || items.length === 0)
    return;
  if (Math.random() < 0.33) {
    const delIdx = Math.floor(Math.random() * items.length);
    const delItem = items[delIdx];
    deletedIds.push(delItem.id as string);
    deletedItems.push(delItem);
  } else {
    const count = Math.min(items.length, 2 + Math.floor(Math.random() * 2));
    const indices = new Set<number>();
    while (indices.size < count) {
      indices.add(Math.floor(Math.random() * items.length));
    }
    for (const idx of indices) {
      changedIds.push(items[idx].id as string);
    }
  }
}

// ── Core ────────────────────────────────────────────────────────────────────

async function fetchSnapshot(): Promise<{
  jobs: Record<string, unknown>[];
  profiles: Record<string, unknown>[];
  changedJobIds: string[];
  changedProfileIds: string[];
  deletedJobIds: string[];
  deletedProfileIds: string[];
  deletedJobs: Record<string, unknown>[];
  deletedProfiles: Record<string, unknown>[];
}> {
  const [rawJobs, rawProfiles] = await Promise.all([
    Job.find({ isActive: true }).sort({ createdAt: -1 }).limit(MAX_ROWS).lean(),
    CandidateProfile.find()
      .select(
        "_id name currentRole currentCompany preferredJobType experienceYears expectedHourlyRate skills location",
      )
      .sort({ createdAt: -1 })
      .limit(MAX_ROWS)
      .lean(),
  ]);

  const jobs = rawJobs.map((j) =>
    jobToJSON(j as unknown as Record<string, unknown>),
  );
  const profiles = rawProfiles.map((p) =>
    profileToJSON(p as unknown as Record<string, unknown>),
  );

  // ── Diff jobs ──────────────────────────────────────────────────────────
  const jobDiff = diffRecords(jobs, prevJobMap, prevJobObjects);
  prevJobMap = jobDiff.newMap;
  prevJobObjects = jobDiff.newObjects;

  // ── Diff profiles ──────────────────────────────────────────────────────
  const profileDiff = diffRecords(profiles, prevProfileMap, prevProfileObjects);
  prevProfileMap = profileDiff.newMap;
  prevProfileObjects = profileDiff.newObjects;

  // ── Simulated activity ─────────────────────────────────────────────────
  simulateActivity(
    jobs,
    jobDiff.changedIds,
    jobDiff.deletedIds,
    jobDiff.deletedItems,
  );
  simulateActivity(
    profiles,
    profileDiff.changedIds,
    profileDiff.deletedIds,
    profileDiff.deletedItems,
  );

  // Cache for immediate sends
  lastJobsPayload = jobs;
  lastProfilesPayload = profiles;

  return {
    jobs,
    profiles,
    changedJobIds: jobDiff.changedIds,
    changedProfileIds: profileDiff.changedIds,
    deletedJobIds: jobDiff.deletedIds,
    deletedProfileIds: profileDiff.deletedIds,
    deletedJobs: jobDiff.deletedItems,
    deletedProfiles: profileDiff.deletedItems,
  };
}

function broadcast(payload: string): void {
  if (!wss) return;
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Trigger an immediate broadcast to all connected /ws/public-data clients.
 * Called by the ingest controller after new jobs/profiles are written to DB.
 */
export async function triggerPublicDataBroadcast(): Promise<void> {
  if (!wss || wss.clients.size === 0) return;
  try {
    const snapshot = await fetchSnapshot();
    broadcast(JSON.stringify(snapshot));
  } catch {
    // silently skip on DB errors
  }
}

export function createPublicDataWebSocket(): WebSocketServer {
  wss = new WebSocketServer({ noServer: true });

  console.log("[WS] Public-data WebSocket ready (noServer) — /ws/public-data");

  // Seed cache on startup
  fetchSnapshot().catch(() => {});

  // On new connection → send the latest snapshot immediately (no changed/deleted IDs)
  wss.on("connection", (ws: WebSocket) => {
    const welcome = JSON.stringify({
      jobs: lastJobsPayload,
      profiles: lastProfilesPayload,
      changedJobIds: [],
      changedProfileIds: [],
      deletedJobIds: [],
      deletedProfileIds: [],
      deletedJobs: [],
      deletedProfiles: [],
    });
    ws.send(welcome);
  });

  // Broadcast loop — every 30 seconds
  setInterval(async () => {
    if (!wss || wss.clients.size === 0) return;
    try {
      const snapshot = await fetchSnapshot();
      broadcast(JSON.stringify(snapshot));
    } catch {
      // silently skip on DB errors
    }
  }, BROADCAST_INTERVAL_MS);

  return wss;
}
