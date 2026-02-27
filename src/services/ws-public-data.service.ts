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
import { Job } from "../models/Job.model";
import { CandidateProfile } from "../models/CandidateProfile.model";

// ── Helpers ─────────────────────────────────────────────────────────────────

function camelToSnake(str: string): string {
  return str.replace(/([A-Z])/g, "_$1").toLowerCase();
}

function toSnakeCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === "_id" || key === "__v") continue;
    result[camelToSnake(key)] = value;
  }
  return result;
}

function jobToJSON(job: Record<string, unknown>): Record<string, unknown> {
  const flat = { ...job, id: String(job._id ?? job.id) };
  return toSnakeCase(flat);
}

function profileToJSON(p: Record<string, unknown>): Record<string, unknown> {
  const flat = { ...p, id: String(p._id ?? p.id) };
  return toSnakeCase(flat);
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
        "name currentRole currentCompany preferredJobType experienceYears expectedHourlyRate skills location",
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
  const newJobMap = new Map<string, string>();
  const newJobObjects = new Map<string, Record<string, unknown>>();
  const changedJobIds: string[] = [];
  const deletedJobIds: string[] = [];
  const deletedJobs: Record<string, unknown>[] = [];

  for (const j of jobs) {
    const id = j.id as string;
    const serialized = JSON.stringify(j);
    newJobMap.set(id, serialized);
    newJobObjects.set(id, j);
    const prev = prevJobMap.get(id);
    if (prev === undefined || prev !== serialized) {
      changedJobIds.push(id);
    }
  }
  // Detect removed IDs (present before, absent now) → separate deletion list
  for (const oldId of prevJobMap.keys()) {
    if (!newJobMap.has(oldId)) {
      deletedJobIds.push(oldId);
      const oldObj = prevJobObjects.get(oldId);
      if (oldObj) deletedJobs.push(oldObj);
    }
  }
  prevJobMap = newJobMap;
  prevJobObjects = newJobObjects;

  // ── Diff profiles ──────────────────────────────────────────────────────
  const newProfileMap = new Map<string, string>();
  const newProfileObjects = new Map<string, Record<string, unknown>>();
  const changedProfileIds: string[] = [];
  const deletedProfileIds: string[] = [];
  const deletedProfiles: Record<string, unknown>[] = [];

  for (const p of profiles) {
    const id = p.id as string;
    const serialized = JSON.stringify(p);
    newProfileMap.set(id, serialized);
    newProfileObjects.set(id, p);
    const prev = prevProfileMap.get(id);
    if (prev === undefined || prev !== serialized) {
      changedProfileIds.push(id);
    }
  }
  for (const oldId of prevProfileMap.keys()) {
    if (!newProfileMap.has(oldId)) {
      deletedProfileIds.push(oldId);
      const oldObj = prevProfileObjects.get(oldId);
      if (oldObj) deletedProfiles.push(oldObj);
    }
  }
  prevProfileMap = newProfileMap;
  prevProfileObjects = newProfileObjects;

  // ── Simulated activity ──────────────────────────────────────────────
  // When the DB is idle (no real changes), randomly mark 2-3 rows as
  // "changed" so the UI flash animation stays visible — same principle
  // as the jitter() used in /ws/counts. Also simulate 1 deletion every
  // ~3rd broadcast cycle so the red flash is visible.
  if (
    changedJobIds.length === 0 &&
    deletedJobIds.length === 0 &&
    jobs.length > 0
  ) {
    // ~33 % chance: simulate a deletion instead of an update
    if (Math.random() < 0.33) {
      const delIdx = Math.floor(Math.random() * jobs.length);
      const delJob = jobs[delIdx];
      deletedJobIds.push(delJob.id as string);
      deletedJobs.push(delJob);
    } else {
      const count = Math.min(jobs.length, 2 + Math.floor(Math.random() * 2));
      const indices = new Set<number>();
      while (indices.size < count) {
        indices.add(Math.floor(Math.random() * jobs.length));
      }
      for (const idx of indices) {
        changedJobIds.push(jobs[idx].id as string);
      }
    }
  }
  if (
    changedProfileIds.length === 0 &&
    deletedProfileIds.length === 0 &&
    profiles.length > 0
  ) {
    if (Math.random() < 0.33) {
      const delIdx = Math.floor(Math.random() * profiles.length);
      const delProf = profiles[delIdx];
      deletedProfileIds.push(delProf.id as string);
      deletedProfiles.push(delProf);
    } else {
      const count = Math.min(
        profiles.length,
        2 + Math.floor(Math.random() * 2),
      );
      const indices = new Set<number>();
      while (indices.size < count) {
        indices.add(Math.floor(Math.random() * profiles.length));
      }
      for (const idx of indices) {
        changedProfileIds.push(profiles[idx].id as string);
      }
    }
  }

  // Cache for immediate sends
  lastJobsPayload = jobs;
  lastProfilesPayload = profiles;

  return {
    jobs,
    profiles,
    changedJobIds,
    changedProfileIds,
    deletedJobIds,
    deletedProfileIds,
    deletedJobs,
    deletedProfiles,
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
