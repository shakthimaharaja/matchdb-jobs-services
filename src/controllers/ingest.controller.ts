/**
 * ingest.controller.ts
 *
 * Internal API called by matchdb-data-collection-mono after successful uploads.
 * Maps MongoDB (data-collection) field names → Prisma PostgreSQL schema.
 * Skips records already present (dedup by email for profiles, title+company+location for jobs).
 * After insert → triggers immediate /ws/public-data broadcast + SSE data_changed event.
 */
import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import { prisma } from "../config/prisma";
import { triggerPublicDataBroadcast } from "../services/ws-public-data.service";
import { broadcastSSEEvent } from "../services/sse.service";
import { env } from "../config/env";

// ── Field mappers ────────────────────────────────────────────────────────────

interface CollectionJob {
  title: string;
  description?: string;
  company?: string;
  location?: string;
  job_type?: string;
  job_subtype?: string;
  work_mode?: string;
  salary_min?: number;
  salary_max?: number;
  pay_per_hour?: number;
  skills_required?: string[];
  experience_required?: number;
  recruiter_name?: string;
  recruiter_email?: string;
  recruiter_phone?: string;
  uploaded_by?: string; // data-collection user who submitted the job
}

interface CollectionProfile {
  name: string;
  email: string;
  phone?: string;
  location?: string;
  current_company?: string;
  current_role?: string;
  preferred_job_type?: string;
  expected_hourly_rate?: number;
  experience_years?: number;
  skills?: string[];
  bio?: string;
  resume_summary?: string;
  resume_experience?: string;
  resume_education?: string;
  resume_achievements?: string;
}

function mapJobRecord(r: CollectionJob) {
  return {
    vendorId: env.SYSTEM_VENDOR_ID,
    vendorEmail: env.SYSTEM_VENDOR_EMAIL,
    recruiterName: r.recruiter_name ?? "",
    recruiterPhone: r.recruiter_phone ?? "",
    title: r.title,
    description: r.description ?? "",
    location: r.location ?? "",
    jobType: r.job_type ?? "full_time",
    jobSubType: r.job_subtype ?? "",
    workMode: r.work_mode ?? "",
    salaryMin: r.salary_min != null ? r.salary_min : undefined,
    salaryMax: r.salary_max != null ? r.salary_max : undefined,
    payPerHour: r.pay_per_hour != null ? r.pay_per_hour : undefined,
    skillsRequired: Array.isArray(r.skills_required) ? r.skills_required : [],
    experienceRequired: r.experience_required ?? 0,
    isActive: true,
    // Map the data-collection uploader for salary attribution
    sourceUserId: r.uploaded_by ? String(r.uploaded_by) : null,
  };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function mapProfileRecord(r: CollectionProfile) {
  const candidateId = randomUUID();
  const username = `${slugify(r.name)}-${candidateId.slice(0, 6)}`;
  return {
    candidateId,
    username,
    name: r.name,
    email: r.email,
    phone: r.phone ?? "",
    currentCompany: r.current_company ?? "",
    currentRole: r.current_role ?? "",
    preferredJobType: r.preferred_job_type ?? "",
    expectedHourlyRate: r.expected_hourly_rate != null ? r.expected_hourly_rate : undefined,
    experienceYears: r.experience_years ?? 0,
    skills: Array.isArray(r.skills) ? r.skills : [],
    location: r.location ?? "",
    bio: r.bio ?? "",
    resumeSummary: r.resume_summary ?? "",
    resumeExperience: r.resume_experience ?? "",
    resumeEducation: r.resume_education ?? "",
    resumeAchievements: r.resume_achievements ?? "",
  };
}

// ── Handlers ─────────────────────────────────────────────────────────────────

/**
 * POST /api/internal/ingest/jobs
 * Body: { records: CollectionJob[] }
 */
export async function ingestJobs(req: Request, res: Response): Promise<void> {
  const records: CollectionJob[] = req.body?.records ?? [];
  if (!Array.isArray(records) || records.length === 0) {
    res.status(400).json({ error: "records array required" });
    return;
  }

  let inserted = 0;
  let skipped = 0;

  for (const r of records) {
    if (!r.title) { skipped++; continue; }

    // Dedup: skip if same title+company+location already exists for system vendor
    const existing = await prisma.job.findFirst({
      where: {
        vendorId: env.SYSTEM_VENDOR_ID,
        title: { equals: r.title, mode: "insensitive" },
        location: { equals: r.location ?? "", mode: "insensitive" },
      },
      select: { id: true },
    });
    if (existing) { skipped++; continue; }

    await prisma.job.create({ data: mapJobRecord(r) });
    inserted++;
  }

  // Fire-and-forget broadcasts — don't block the HTTP response
  if (inserted > 0) {
    triggerPublicDataBroadcast().catch(() => {});
    broadcastSSEEvent("data_changed", {
      type: "jobs",
      inserted,
      timestamp: Date.now(),
    });
    console.log(`[Ingest] Jobs: inserted=${inserted} skipped=${skipped}`);
  }

  res.json({ inserted, skipped });
}

/**
 * POST /api/internal/ingest/profiles
 * Body: { records: CollectionProfile[] }
 */
export async function ingestProfiles(req: Request, res: Response): Promise<void> {
  const records: CollectionProfile[] = req.body?.records ?? [];
  if (!Array.isArray(records) || records.length === 0) {
    res.status(400).json({ error: "records array required" });
    return;
  }

  let inserted = 0;
  let skipped = 0;

  for (const r of records) {
    if (!r.name || !r.email) { skipped++; continue; }

    // Dedup: skip if same email already has a profile
    const existing = await prisma.candidateProfile.findFirst({
      where: { email: { equals: r.email.toLowerCase(), mode: "insensitive" } },
      select: { id: true },
    });
    if (existing) { skipped++; continue; }

    await prisma.candidateProfile.create({ data: mapProfileRecord(r) });
    inserted++;
  }

  if (inserted > 0) {
    triggerPublicDataBroadcast().catch(() => {});
    broadcastSSEEvent("data_changed", {
      type: "profiles",
      inserted,
      timestamp: Date.now(),
    });
    console.log(`[Ingest] Profiles: inserted=${inserted} skipped=${skipped}`);
  }

  res.json({ inserted, skipped });
}
