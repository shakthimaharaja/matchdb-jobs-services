/**
 * poll-counts.service.ts
 *
 * Polling endpoint handler: GET /api/jobs/poll/counts
 * Returns { jobs, profiles, dailyNewJobs, vendors, marketers } counts with jitter for simulated activity.
 */
import type { Request, Response } from "express";
import { Job, CandidateProfile, VendorCompany, Company } from "../models";

let prevJobCount = -1;
let prevProfileCount = -1;

/** Returns a small random delta: −3 to +3, never 0 */
function jitter(): number {
  let d = 0;
  while (d === 0) d = Math.floor(Math.random() * 7) - 3;
  return d;
}

export async function getCounts(req: Request, res: Response): Promise<void> {
  try {
    // Use client timezone if provided, otherwise server local time
    const tz = typeof req.query.tz === "string" ? req.query.tz : undefined;
    let todayStart: Date;
    if (tz) {
      // Build "start of today" in the requested IANA timezone
      const now = new Date();
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(now);
      const y = parts.find((p) => p.type === "year")!.value;
      const m = parts.find((p) => p.type === "month")!.value;
      const d = parts.find((p) => p.type === "day")!.value;
      todayStart = new Date(`${y}-${m}-${d}T00:00:00`);
      // Offset to UTC: the local midnight in that timezone
      const offset =
        todayStart.getTime() - new Date(`${y}-${m}-${d}T00:00:00Z`).getTime();
      todayStart = new Date(todayStart.getTime() - offset);
    } else {
      todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
    }

    const [
      realJobs,
      realProfiles,
      dailyNewJobs,
      vendors,
      marketers,
      dailyNewProfiles,
      dailyNewVendors,
      dailyNewMarketers,
    ] = await Promise.all([
      Job.countDocuments({ isActive: true }),
      CandidateProfile.countDocuments(),
      Job.countDocuments({ isActive: true, created_at: { $gte: todayStart } }),
      VendorCompany.countDocuments(),
      Company.countDocuments(),
      CandidateProfile.countDocuments({ createdAt: { $gte: todayStart } }),
      VendorCompany.countDocuments({ createdAt: { $gte: todayStart } }),
      Company.countDocuments({ createdAt: { $gte: todayStart } }),
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

    res.json({
      jobs: displayJobs,
      profiles: displayProfiles,
      dailyNewJobs: Math.max(0, dailyNewJobs),
      vendors: Math.max(0, vendors),
      marketers: Math.max(0, marketers),
      dailyNewProfiles: Math.max(0, dailyNewProfiles),
      dailyNewVendors: Math.max(0, dailyNewVendors),
      dailyNewMarketers: Math.max(0, dailyNewMarketers),
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch counts" });
  }
}
