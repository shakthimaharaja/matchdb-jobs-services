/**
 * poll-public-data.service.ts
 *
 * Polling endpoint handler: GET /api/jobs/poll/public-data
 * Returns jobs + profiles snapshot with diff arrays (changedIds, deletedIds)
 * so the UI can flash changed/deleted rows just like the old WebSocket version.
 */
import type { Request, Response } from "express";
import { Job, CandidateProfile } from "../models";
import { jobToJSON, profileToJSON } from "../utils";
import { WS_MAX_ROWS } from "../constants";

// ── State ───────────────────────────────────────────────────────────────────

/** Stringified snapshot per record id — used for diffing */
let prevJobMap = new Map<string, string>();
let prevProfileMap = new Map<string, string>();

/** Previous-cycle parsed objects keyed by id — used to send deleted row data */
let prevJobObjects = new Map<string, Record<string, unknown>>();
let prevProfileObjects = new Map<string, Record<string, unknown>>();

const MAX_ROWS = WS_MAX_ROWS;

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

// ── Handler ─────────────────────────────────────────────────────────────────

export async function getPublicData(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    const [rawJobs, rawProfiles] = await Promise.all([
      Job.find({ isActive: true })
        .sort({ createdAt: -1 })
        .limit(MAX_ROWS)
        .lean(),
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
    const profileDiff = diffRecords(
      profiles,
      prevProfileMap,
      prevProfileObjects,
    );
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

    res.json({
      jobs,
      profiles,
      changedJobIds: jobDiff.changedIds,
      changedProfileIds: profileDiff.changedIds,
      deletedJobIds: jobDiff.deletedIds,
      deletedProfileIds: profileDiff.deletedIds,
      deletedJobs: jobDiff.deletedItems,
      deletedProfiles: profileDiff.deletedItems,
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch public data" });
  }
}
