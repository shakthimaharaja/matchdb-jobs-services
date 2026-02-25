import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Job } from "../models/Job.model";
import { Application } from "../models/Application.model";
import { CandidateProfile } from "../models/CandidateProfile.model";
import { PokeLog } from "../models/PokeLog.model";
import { PokeRecord } from "../models/PokeRecord.model";
import {
  matchCandidateToJobs,
  matchJobsToCandidates,
} from "../services/matching.service";
import { sendPokeEmail } from "../services/sendgrid.service";
import { extractSkills } from "../services/skill-extractor.service";
import { AppError } from "../middleware/error.middleware";

// ─── Plan Limit Tables ────────────────────────────────────────────────────────

const JOB_POSTING_LIMITS: Record<string, number> = {
  free: 0,
  basic: 5,
  pro: 10,
  pro_plus: 20,
  enterprise: Infinity,
};

const POKE_LIMITS: Record<string, number> = {
  free: 5,
  basic: 25,
  pro: 50,
  pro_plus: Infinity,
  enterprise: Infinity,
};

// Converts camelCase keys to snake_case for frontend consumption
function camelToSnake(str: string): string {
  return str.replace(/([A-Z])/g, "_$1").toLowerCase();
}

function toSnakeCase(obj: any): any {
  if (Array.isArray(obj)) return obj.map(toSnakeCase);
  if (obj && typeof obj === "object" && !(obj instanceof Date)) {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === "_id" || key === "__v") continue;
      result[camelToSnake(key)] = toSnakeCase(value);
    }
    return result;
  }
  return obj;
}

// Converts snake_case keys to camelCase for Mongoose
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function toCamelCase(obj: any): any {
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  if (obj && typeof obj === "object" && !(obj instanceof Date)) {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[snakeToCamel(key)] = toCamelCase(value);
    }
    return result;
  }
  return obj;
}

function jobToJSON(job: any) {
  const obj = job.toObject ? job.toObject() : job;
  const flat = { ...obj, id: obj._id?.toString() || obj.id };
  return toSnakeCase(flat);
}

function profileToJSON(p: any) {
  const obj = p.toObject ? p.toObject() : p;
  const flat = { ...obj, id: obj._id?.toString() || obj.id };
  return toSnakeCase(flat);
}

// Pagination helper — parses page/limit from query string
function parsePagination(query: any): {
  page: number;
  limit: number;
  skip: number;
} {
  const page = Math.max(1, parseInt(query.page as string, 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(query.limit as string, 10) || 25),
  );
  return { page, limit, skip: (page - 1) * limit };
}

// GET /api/jobs/count — lightweight count of active jobs
export async function countJobs(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const count = await Job.countDocuments({ isActive: true });
    res.json({ count });
  } catch (err) {
    next(err);
  }
}

// GET /api/jobs/profiles-count — lightweight count of candidate profiles
export async function countProfiles(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const count = await CandidateProfile.countDocuments();
    res.json({ count });
  } catch (err) {
    next(err);
  }
}

// GET /api/jobs — active jobs, paginated for authenticated users
// Public (no page param) → returns all; with ?page=1&limit=25 → paginated envelope
export async function listJobs(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const wantPaginated = req.query.page !== undefined;

    if (wantPaginated) {
      const { page, limit, skip } = parsePagination(req.query);
      const [data, total] = await Promise.all([
        Job.find({ isActive: true })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Job.countDocuments({ isActive: true }),
      ]);
      res.json({
        data: data.map((j: any) => jobToJSON({ ...j, toObject: () => j })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } else {
      // Public / legacy — return flat array (no pagination)
      const jobs = await Job.find({ isActive: true })
        .sort({ createdAt: -1 })
        .lean();
      res.json(jobs.map((j: any) => jobToJSON({ ...j, toObject: () => j })));
    }
  } catch (err) {
    next(err);
  }
}

// GET /api/jobs/profiles-public — public candidate profile listing (limited fields)
// Public (no page param) → returns all; with ?page=1&limit=25 → paginated envelope
export async function listPublicProfiles(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const selectFields =
      "name currentRole currentCompany preferredJobType experienceYears expectedHourlyRate skills location";
    const wantPaginated = req.query.page !== undefined;

    if (wantPaginated) {
      const { page, limit, skip } = parsePagination(req.query);
      const [data, total] = await Promise.all([
        CandidateProfile.find()
          .select(selectFields)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        CandidateProfile.countDocuments(),
      ]);
      res.json({
        data: data.map((p: any) => profileToJSON({ ...p, toObject: () => p })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } else {
      const profiles = await CandidateProfile.find()
        .select(selectFields)
        .sort({ createdAt: -1 })
        .lean();
      res.json(
        profiles.map((p: any) => profileToJSON({ ...p, toObject: () => p })),
      );
    }
  } catch (err) {
    next(err);
  }
}

// POST /api/jobs/create — vendor creates job
export async function createJob(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Accept snake_case from frontend, convert to camelCase for Mongoose
    const incoming = toCamelCase(req.body);
    const schema = z.object({
      title: z.string().min(2),
      description: z.string().min(10),
      location: z.string().optional(),
      jobCountry: z.string().min(2, "Country is required for job posting"),
      jobState: z.string().optional(),
      jobCity: z.string().optional(),
      jobType: z
        .enum(["full_time", "part_time", "contract", "internship"])
        .optional(),
      jobSubType: z.string().optional(),
      workMode: z.enum(["remote", "onsite", "hybrid", ""]).optional(),
      salaryMin: z.number().optional(),
      salaryMax: z.number().optional(),
      payPerHour: z.number().optional(),
      skillsRequired: z.array(z.string()).optional(),
      experienceRequired: z.number().optional(),
      recruiterName: z.string().optional(),
      recruiterPhone: z.string().optional(),
    });

    const body = schema.parse(incoming);

    // ── Job posting limit enforcement ──────────────────────────────────────
    const plan = req.user!.plan || "free";
    const jobLimit = JOB_POSTING_LIMITS[plan] ?? 0;
    if (isFinite(jobLimit)) {
      const activeCount = await Job.countDocuments({
        vendorId: req.user!.userId,
        isActive: true,
      });
      if (activeCount >= jobLimit) {
        const err: AppError = new Error(
          jobLimit === 0
            ? "Job posting requires a paid vendor subscription. Please upgrade at /pricing."
            : `Your ${plan} plan allows up to ${jobLimit} active job postings. Close an existing posting or upgrade your plan.`,
        );
        err.statusCode = 403;
        return next(err);
      }
    }

    // Extract skills from title + description and merge with any manually listed skills
    const textToExtract = `${body.title} ${body.description}`;
    const extractedSkills = extractSkills(textToExtract);
    const mergedSkills = Array.from(
      new Set([...extractedSkills, ...(body.skillsRequired || [])]),
    );

    const job = await Job.create({
      ...body,
      skillsRequired: mergedSkills,
      vendorId: req.user!.userId,
      vendorEmail: req.user!.email,
    });

    res.status(201).json(jobToJSON(job));
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0]?.message });
      return;
    }
    next(err);
  }
}

// GET /api/jobs/:id
export async function getJob(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    const count = await Application.countDocuments({ jobId: req.params.id });
    const result = jobToJSON(job);
    result.application_count = count;
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// POST /api/jobs/:id/apply
export async function applyToJob(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const job = await Job.findById(req.params.id);
    if (!job || !job.isActive) {
      res.status(404).json({ error: "Job not found or inactive" });
      return;
    }

    const existing = await Application.findOne({
      jobId: req.params.id,
      candidateId: req.user!.userId,
    });
    if (existing) {
      res.status(409).json({ error: "Already applied to this job" });
      return;
    }

    const app = await Application.create({
      jobId: req.params.id,
      jobTitle: job.title,
      candidateId: req.user!.userId,
      candidateEmail: req.user!.email,
      coverLetter:
        (req.body as any).coverLetter || (req.body as any).cover_letter || "",
    });

    res.status(201).json(profileToJSON(app));
  } catch (err) {
    next(err);
  }
}

// PATCH /api/jobs/:id/close — vendor closes (deactivates) their own job
export async function closeJob(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    if (job.vendorId?.toString() !== req.user!.userId) {
      res.status(403).json({ error: "Not authorized to close this job" });
      return;
    }
    job.isActive = false;
    await job.save();
    const count = await Application.countDocuments({ jobId: job._id });
    const result = jobToJSON(job);
    result.application_count = count;
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/jobs/:id/reopen — vendor re-activates their own closed job
export async function reopenJob(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    if (job.vendorId?.toString() !== req.user!.userId) {
      res.status(403).json({ error: "Not authorized to reopen this job" });
      return;
    }

    // ── Reopen limit enforcement (same cap as createJob) ───────────────────
    const plan = req.user!.plan || "free";
    const jobLimit = JOB_POSTING_LIMITS[plan] ?? 0;
    if (isFinite(jobLimit)) {
      const activeCount = await Job.countDocuments({
        vendorId: req.user!.userId,
        isActive: true,
      });
      if (activeCount >= jobLimit) {
        const err: AppError = new Error(
          jobLimit === 0
            ? "Job posting requires a paid vendor subscription. Please upgrade at /pricing."
            : `Your ${plan} plan allows up to ${jobLimit} active job postings. Close another posting first or upgrade your plan.`,
        );
        err.statusCode = 403;
        return next(err);
      }
    }

    job.isActive = true;
    await job.save();
    const count = await Application.countDocuments({ jobId: job._id });
    const result = jobToJSON(job);
    result.application_count = count;
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// GET /api/jobs/my-applications
export async function myApplications(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const apps = await Application.find({ candidateId: req.user!.userId })
      .sort({ createdAt: -1 })
      .lean();
    res.json(apps.map((a: any) => profileToJSON({ ...a, toObject: () => a })));
  } catch (err) {
    next(err);
  }
}

// GET /api/jobs/vendor — vendor's own jobs
// GET /api/jobs/vendor — vendor's own jobs (paginated)
export async function vendorJobs(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const filter = { vendorId: req.user!.userId };
    const wantPaginated = req.query.page !== undefined;

    if (wantPaginated) {
      const { page, limit, skip } = parsePagination(req.query);
      const [data, total] = await Promise.all([
        Job.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Job.countDocuments(filter),
      ]);
      res.json({
        data: data.map((j: any) => jobToJSON({ ...j, toObject: () => j })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } else {
      const jobs = await Job.find(filter).sort({ createdAt: -1 }).lean();
      res.json(jobs.map((j: any) => jobToJSON({ ...j, toObject: () => j })));
    }
  } catch (err) {
    next(err);
  }
}

// GET /api/jobs/profile — candidate profile
export async function getProfile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const profile = await CandidateProfile.findOne({
      candidateId: req.user!.userId,
    });
    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    res.json(profileToJSON(profile));
  } catch (err) {
    next(err);
  }
}

// POST /api/jobs/profile — create profile
export async function createProfile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const existing = await CandidateProfile.findOne({
      candidateId: req.user!.userId,
    });
    if (existing) {
      res
        .status(409)
        .json({ error: "Profile already exists. Use PUT to update." });
      return;
    }

    // Preserve raw visibility_config before camelCase conversion
    const rawVisibilityConfig = (req.body as any).visibility_config;
    const incoming = toCamelCase(req.body);
    if (rawVisibilityConfig !== undefined) {
      incoming.visibilityConfig = rawVisibilityConfig;
    }

    // Require profileCountry (subscription country) for new profiles
    if (!incoming.profileCountry) {
      res.status(400).json({ error: "Subscription country is required." });
      return;
    }

    const profile = await CandidateProfile.create({
      ...incoming,
      candidateId: req.user!.userId,
      username: req.user!.username || "",
      email: req.user!.email,
    });
    res.status(201).json(profileToJSON(profile));
  } catch (err) {
    next(err);
  }
}

// PUT /api/jobs/profile — create (first time) or update (append-only when locked)
export async function updateProfile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Preserve raw visibility_config before camelCase conversion (inner keys are job type values like "full_time")
    const rawVisibilityConfig = (req.body as any).visibility_config;
    const incoming = toCamelCase(req.body);
    if (rawVisibilityConfig !== undefined) {
      incoming.visibilityConfig = rawVisibilityConfig;
    }

    const existing = await CandidateProfile.findOne({
      candidateId: req.user!.userId,
    });

    let updateData: any;

    if (existing && existing.profileLocked) {
      // ── Append-only resume fields: incoming must start with existing text ──
      const appendFields = [
        "resumeSummary",
        "resumeExperience",
        "resumeEducation",
        "resumeAchievements",
      ] as const;
      for (const field of appendFields) {
        const existingVal = (existing as any)[field] || "";
        const incomingVal = incoming[field] || "";
        if (
          incomingVal &&
          existingVal &&
          !incomingVal.startsWith(existingVal)
        ) {
          res.status(400).json({
            error: `Cannot modify existing content in ${field}. You may only append new content.`,
          });
          return;
        }
      }

      // ── Experience years: can only increase ──
      if (
        incoming.experienceYears != null &&
        incoming.experienceYears < existing.experienceYears
      ) {
        res.status(400).json({
          error: "Experience years can only be increased, not decreased.",
        });
        return;
      }

      // ── Visibility config: union-merge (append-only — types/sub-types can be added, never removed) ──
      const existingVis: Record<string, string[]> =
        (existing.visibilityConfig as any) || {};
      const incomingVis: Record<string, string[]> =
        incoming.visibilityConfig || {};
      const mergedVis: Record<string, string[]> = {};
      for (const [type, subs] of Object.entries(existingVis)) {
        mergedVis[type] = Array.isArray(subs) ? [...subs] : [];
      }
      for (const [type, subs] of Object.entries(incomingVis)) {
        if (!mergedVis[type]) {
          mergedVis[type] = Array.isArray(subs) ? [...subs] : [];
        } else {
          mergedVis[type] = Array.from(
            new Set([...mergedVis[type], ...(Array.isArray(subs) ? subs : [])]),
          );
        }
      }

      // ── Re-extract skills from full resume text & union with existing ──
      const fullResumeText = [
        incoming.resumeSummary || existing.resumeSummary || "",
        incoming.resumeExperience || existing.resumeExperience || "",
        incoming.resumeEducation || existing.resumeEducation || "",
        incoming.resumeAchievements || existing.resumeAchievements || "",
        incoming.bio || existing.bio || "",
        existing.currentRole || "",
      ].join(" ");
      const newSkills = extractSkills(fullResumeText);
      const mergedSkills = Array.from(
        new Set([...existing.skills, ...newSkills]),
      );

      updateData = {
        phone: incoming.phone ?? existing.phone,
        location: incoming.location ?? existing.location,
        preferredJobType:
          incoming.preferredJobType ?? existing.preferredJobType,
        expectedHourlyRate:
          incoming.expectedHourlyRate !== undefined
            ? incoming.expectedHourlyRate
            : existing.expectedHourlyRate,
        bio: incoming.bio ?? existing.bio,
        experienceYears: incoming.experienceYears ?? existing.experienceYears,
        resumeSummary: incoming.resumeSummary || existing.resumeSummary,
        resumeExperience:
          incoming.resumeExperience || existing.resumeExperience,
        resumeEducation: incoming.resumeEducation || existing.resumeEducation,
        resumeAchievements:
          incoming.resumeAchievements || existing.resumeAchievements,
        visibilityConfig: mergedVis,
        skills: mergedSkills,
      };
    } else {
      // First-time creation — require profileCountry
      if (!incoming.profileCountry) {
        res.status(400).json({ error: "Subscription country is required." });
        return;
      }
      // Extract skills from resume text and lock the profile
      const resumeText = [
        incoming.resumeSummary || "",
        incoming.resumeExperience || "",
        incoming.resumeEducation || "",
        incoming.resumeAchievements || "",
        incoming.bio || "",
        incoming.currentRole || "",
      ].join(" ");
      const extractedSkills = extractSkills(resumeText);
      updateData = {
        ...incoming,
        skills: extractedSkills,
        profileLocked: true,
      };
    }

    const profile = await CandidateProfile.findOneAndUpdate(
      { candidateId: req.user!.userId },
      { ...updateData, candidateId: req.user!.userId },
      { new: true, upsert: true, runValidators: true },
    );
    res.json(profileToJSON(profile));
  } catch (err) {
    next(err);
  }
}

// DELETE /api/jobs/profile — permanently delete candidate profile
export async function deleteProfile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await CandidateProfile.findOneAndDelete({
      candidateId: req.user!.userId,
    });
    if (!result) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    res.json({ message: "Profile deleted successfully." });
  } catch (err) {
    next(err);
  }
}

// GET /api/jobs/matches — ranked jobs for candidate (paginated)
export async function candidateMatches(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const profile = await CandidateProfile.findOne({
      candidateId: req.user!.userId,
    });
    if (!profile) {
      res.json(
        req.query.page !== undefined
          ? { data: [], total: 0, page: 1, limit: 25, totalPages: 0 }
          : [],
      );
      return;
    }

    const jobs = await Job.find({ isActive: true }).lean();
    const allMatched = matchCandidateToJobs(profile, jobs as any);

    // ── Location-based filtering ──
    // Candidates only see jobs from their subscription country (strict match)
    const candidateCountry = (profile as any).profileCountry || "";
    const locationFiltered = candidateCountry
      ? allMatched.filter((m: any) => {
          const obj = typeof m.toObject === "function" ? m.toObject() : m;
          const jobCountry = obj.jobCountry || obj.job_country || "";
          // Strict match: only show jobs whose country matches the candidate's subscription country
          return jobCountry === candidateCountry;
        })
      : allMatched;

    // Filter by allowed types if specified (from membership config)
    const typesParam = req.query.types as string | undefined;
    const allowedTypes = typesParam
      ? typesParam.split(",").map((t: string) => t.trim())
      : null;
    const matched = allowedTypes
      ? locationFiltered.filter((m: any) => {
          const obj = typeof m.toObject === "function" ? m.toObject() : m;
          const jt = obj.jobType || obj.job_type || "";
          return allowedTypes.includes(jt);
        })
      : locationFiltered;

    const wantPaginated = req.query.page !== undefined;
    if (wantPaginated) {
      const { page, limit, skip } = parsePagination(req.query);
      const total = matched.length;
      const sliced = matched.slice(skip, skip + limit);

      // Aggregate type/subtype counts from the FULL matched set
      const typeCounts: Record<string, number> = {};
      const subTypeCounts: Record<string, Record<string, number>> = {};
      for (const m of matched) {
        const obj = typeof m.toObject === "function" ? m.toObject() : m;
        const jt = obj.jobType || obj.job_type || "other";
        typeCounts[jt] = (typeCounts[jt] || 0) + 1;
        const jst = obj.jobSubType || obj.job_sub_type || "";
        if (jst) {
          if (!subTypeCounts[jt]) subTypeCounts[jt] = {};
          subTypeCounts[jt][jst] = (subTypeCounts[jt][jst] || 0) + 1;
        }
      }

      res.json({
        data: sliced.map((m: any) => {
          const obj = typeof m.toObject === "function" ? m.toObject() : m;
          const flat = { ...obj, id: obj._id?.toString() || obj.id };
          return toSnakeCase(flat);
        }),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        typeCounts,
        subTypeCounts,
      });
    } else {
      // Convert matched results to snake_case
      res.json(
        matched.map((m: any) => {
          const obj = typeof m.toObject === "function" ? m.toObject() : m;
          const flat = { ...obj, id: obj._id?.toString() || obj.id };
          return toSnakeCase(flat);
        }),
      );
    }
  } catch (err) {
    next(err);
  }
}

// GET /api/jobs/vendor-candidates?job_id=xxx — ranked candidates for vendor (paginated)
export async function vendorCandidates(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { job_id } = req.query as { job_id?: string };

    const jobQuery: any = { vendorId: req.user!.userId, isActive: true };
    if (job_id) jobQuery._id = job_id;

    const jobs = await Job.find(jobQuery).lean();
    if (!jobs.length) {
      res.json(
        req.query.page !== undefined
          ? { data: [], total: 0, page: 1, limit: 25, totalPages: 0 }
          : [],
      );
      return;
    }

    // ── Location-based filtering: only show candidates whose profileCountry matches job country ──
    // Collect the set of countries from the vendor's active jobs being queried
    const jobCountries = new Set(
      jobs.map((j: any) => j.jobCountry || "").filter(Boolean),
    );

    // Filter candidates by location: candidate's profileCountry must match at least one job's country
    const profileFilter: any = {};
    if (jobCountries.size > 0) {
      profileFilter.profileCountry = { $in: Array.from(jobCountries) };
    }

    const profiles = await CandidateProfile.find(profileFilter).lean();
    const matched = matchJobsToCandidates(jobs as any, profiles as any);

    const wantPaginated = req.query.page !== undefined;
    if (wantPaginated) {
      const { page, limit, skip } = parsePagination(req.query);
      const total = matched.length;
      const sliced = matched.slice(skip, skip + limit);
      res.json({
        data: sliced.map((m: any) => {
          const obj = typeof m.toObject === "function" ? m.toObject() : m;
          const flat = { ...obj, id: obj._id?.toString() || obj.id };
          return toSnakeCase(flat);
        }),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } else {
      // Convert matched results to snake_case
      res.json(
        matched.map((m: any) => {
          const obj = typeof m.toObject === "function" ? m.toObject() : m;
          const flat = { ...obj, id: obj._id?.toString() || obj.id };
          return toSnakeCase(flat);
        }),
      );
    }
  } catch (err) {
    next(err);
  }
}

// POST /api/jobs/poke
export async function poke(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const schema = z.object({
      to_email: z.string().email(),
      to_name: z.string().min(1),
      subject_context: z.string().min(1),
      email_body: z.string().optional(),
      target_id: z.string().min(1), // candidateProfileId | jobId
      target_vendor_id: z.string().optional(), // vendorId of job (when candidate sends)
      is_email: z.boolean().default(false),
      sender_name: z.string().optional(),
      sender_email: z.string().optional(),
      pdf_attachment: z.string().optional(), // base64 PDF (candidate resume)
      job_id: z.string().optional(),
      job_title: z.string().optional(),
    });
    const {
      to_email,
      to_name,
      subject_context,
      email_body,
      target_id,
      target_vendor_id,
      is_email,
      sender_name,
      sender_email,
      pdf_attachment,
      job_id,
      job_title,
    } = schema.parse(req.body);

    // ── Once-per enforcement ──────────────────────────────────────────────
    const already = await PokeRecord.findOne({
      senderId: req.user!.userId,
      targetId: target_id,
      isEmail: is_email,
    });
    if (already) {
      const action = is_email ? "emailed" : "poked";
      const target =
        req.user!.userType === "vendor" ? "candidate" : "job posting";
      res
        .status(409)
        .json({ error: `You have already ${action} this ${target}.` });
      return;
    }

    // ── Monthly poke limit enforcement ────────────────────────────────────
    const plan = req.user!.plan || "free";
    const pokeLimit = POKE_LIMITS[plan] ?? 5;
    if (isFinite(pokeLimit)) {
      const yearMonth = new Date().toISOString().slice(0, 7);
      const log = await PokeLog.findOneAndUpdate(
        { userId: req.user!.userId, yearMonth },
        { $inc: { count: 1 } },
        { upsert: true, new: true },
      );
      if (log.count > pokeLimit) {
        await PokeLog.updateOne(
          { userId: req.user!.userId, yearMonth },
          { $inc: { count: -1 } },
        );
        res.status(429).json({
          error: `Monthly poke limit reached (${pokeLimit}/month on your ${plan} plan). Upgrade at /pricing to send more.`,
        });
        return;
      }
    }

    await sendPokeEmail({
      to: to_email,
      toName: to_name,
      fromName: sender_name || req.user!.userId,
      fromEmail: sender_email || req.user!.email,
      subjectContext: subject_context,
      emailBody: email_body,
      pdfAttachment: pdf_attachment,
      pdfFilename: `${to_name.replace(/\s+/g, "_")}_resume.pdf`,
    });

    // ── Persist poke record ───────────────────────────────────────────────
    await PokeRecord.create({
      senderId: req.user!.userId,
      senderName: sender_name || "",
      senderEmail: sender_email || req.user!.email,
      senderType: req.user!.userType as "vendor" | "candidate",
      targetId: target_id,
      targetVendorId: target_vendor_id,
      targetEmail: to_email,
      targetName: to_name,
      subject: subject_context,
      isEmail: is_email,
      jobId: job_id,
      jobTitle: job_title,
    });

    res.json({
      message: `${is_email ? "Email" : "Poke"} sent to ${to_name} successfully.`,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0]?.message });
      return;
    }
    next(err);
  }
}

// GET /api/jobs/pokes/sent — all pokes/emails the authenticated user has sent
export async function getPokesSent(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const records = await PokeRecord.find({ senderId: req.user!.userId })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json(
      records.map((r: any) => toSnakeCase({ ...r, id: r._id.toString() })),
    );
  } catch (err) {
    next(err);
  }
}

// GET /api/jobs/pokes/received — pokes/emails received by the authenticated user
export async function getPokesReceived(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    let records: any[];
    if (req.user!.userType === "vendor") {
      // Vendor receives = candidate pokes to vendor's job postings
      records = await PokeRecord.find({
        targetVendorId: req.user!.userId,
        senderType: "candidate",
      })
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();
    } else {
      // Candidate receives = vendor pokes to this candidate's profile
      const profile = await CandidateProfile.findOne({
        candidateId: req.user!.userId,
      });
      if (!profile) {
        res.json([]);
        return;
      }
      records = await PokeRecord.find({
        targetId: profile._id.toString(),
        senderType: "vendor",
      })
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();
    }
    res.json(
      records.map((r: any) => toSnakeCase({ ...r, id: r._id.toString() })),
    );
  } catch (err) {
    next(err);
  }
}

// GET /api/jobs/resume/:username — public profile view by username
export async function getProfileByUsername(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { username } = req.params;
    const profile = await CandidateProfile.findOne({ username });
    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    // Return full profile (public view — resume sections included)
    res.json(profileToJSON(profile));
  } catch (err) {
    next(err);
  }
}

// GET /api/jobs/resume/:username/download — download resume as plain-text file (auth required)
export async function downloadResume(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { username } = req.params;
    const profile = await CandidateProfile.findOne({ username });
    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    const now = new Date().toISOString().slice(0, 10);
    const skills = profile.skills?.join(", ") || "—";
    const rate = profile.expectedHourlyRate
      ? `$${profile.expectedHourlyRate}/hr`
      : "—";

    const lines = [
      "================================================================",
      "  MATCHDB CANDIDATE RESUME",
      "================================================================",
      `Profile URL : http://localhost:3000/resume/${profile.username}`,
      `Downloaded  : ${now}`,
      "",
      "PERSONAL INFORMATION",
      "--------------------",
      `Name        : ${profile.name || "—"}`,
      `Email       : ${profile.email || "—"}`,
      `Phone       : ${profile.phone || "—"}`,
      `Location    : ${profile.location || "—"}`,
      "",
      "PROFESSIONAL DETAILS",
      "--------------------",
      `Current Company : ${profile.currentCompany || "—"}`,
      `Current Role    : ${profile.currentRole || "—"}`,
      `Preferred Type  : ${profile.preferredJobType || "—"}`,
      `Expected Rate   : ${rate}`,
      `Experience      : ${profile.experienceYears || 0} years`,
      "",
      "SKILLS",
      "------",
      skills,
      "",
      "PROFESSIONAL SUMMARY",
      "--------------------",
      profile.resumeSummary || "—",
      "",
      "WORK EXPERIENCE",
      "---------------",
      profile.resumeExperience || "—",
      "",
      "EDUCATION",
      "---------",
      profile.resumeEducation || "—",
      "",
      "ACHIEVEMENTS & CERTIFICATIONS",
      "-----------------------------",
      profile.resumeAchievements || "—",
      "",
      "================================================================",
      "  Generated by MatchDB  |  http://localhost:3000",
      "================================================================",
    ].join("\n");

    const filename = `resume-${username}-${now}.txt`;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(lines);
  } catch (err) {
    next(err);
  }
}
