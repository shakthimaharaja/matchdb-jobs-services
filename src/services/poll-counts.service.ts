/**
 * poll-counts.service.ts
 *
 * Polling endpoint handler: GET /api/jobs/poll/counts
 * Returns { jobs, profiles } counts with jitter for simulated activity.
 */
import type { Request, Response } from "express";
import { Job, CandidateProfile } from "../models";

let prevJobCount = -1;
let prevProfileCount = -1;

/** Returns a small random delta: −3 to +3, never 0 */
function jitter(): number {
  let d = 0;
  while (d === 0) d = Math.floor(Math.random() * 7) - 3;
  return d;
}

export async function getCounts(_req: Request, res: Response): Promise<void> {
  try {
    const [realJobs, realProfiles] = await Promise.all([
      Job.countDocuments({ isActive: true }),
      CandidateProfile.countDocuments(),
    ]);

    let displayJobs = realJobs;
    let displayProfiles = realProfiles;

    if (realJobs === prevJobCount) {
      displayJobs = Math.max(1, realJobs + jitter());
    }
    if (realProfiles === prevProfileCount) {
      displayProfiles = Math.max(1, realProfiles + jitter());
    }

    prevJobCount = realJobs;
    prevProfileCount = realProfiles;

    res.json({ jobs: displayJobs, profiles: displayProfiles });
  } catch {
    res.status(500).json({ error: "Failed to fetch counts" });
  }
}
