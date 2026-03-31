import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  Job,
  CandidateProfile,
  Application,
  PokeRecord,
  PokeLog,
  Company,
} from "../models";
import { getNextId } from "../models/Counter";
import {
  matchCandidateToJobs,
  matchJobsToCandidates,
} from "../services/matching.service";
import { sendPokeEmail } from "../services/sendgrid.service";
import { extractSkills } from "../services/skill-extractor.service";
import { AppError } from "../middleware/error.middleware";
import {
  toSnakeCase,
  toCamelCase,
  jobToJSON,
  profileToJSON,
  parsePagination,
} from "../utils";
import { JOB_POSTING_LIMITS, POKE_LIMITS } from "../constants";

// GET /api/jobs/count � lightweight count of active jobs
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

// GET /api/jobs/profiles-count � lightweight count of candidate profiles
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

// GET /api/jobs � active jobs, paginated for authenticated users
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
        data: data.map(jobToJSON),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } else {
      const jobs = await Job.find({ isActive: true })
        .sort({ createdAt: -1 })
        .lean();
      res.json(jobs.map(jobToJSON));
    }
  } catch (err) {
    next(err);
  }
}

// GET /api/jobs/profiles-public � public candidate profile listing (limited fields)
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
        CandidateProfile.find({})
          .select(selectFields)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        CandidateProfile.countDocuments(),
      ]);
      res.json({
        data: data.map(profileToJSON),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } else {
      const profiles = await CandidateProfile.find({})
        .select(selectFields)
        .sort({ createdAt: -1 })
        .lean();
      res.json(profiles.map(profileToJSON));
    }
  } catch (err) {
    next(err);
  }
}

// POST /api/jobs/create � vendor creates job
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
      description: z.string().min(10).max(10000),
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

    // -- Salary field validation --------------------------------------------
    if (body.salaryMin !== undefined && body.salaryMin < 0) {
      res.status(400).json({ error: "salaryMin must be non-negative" });
      return;
    }
    if (body.salaryMax !== undefined && body.salaryMax < 0) {
      res.status(400).json({ error: "salaryMax must be non-negative" });
      return;
    }
    if (
      body.salaryMin !== undefined &&
      body.salaryMax !== undefined &&
      body.salaryMin > body.salaryMax
    ) {
      res.status(400).json({ error: "salaryMin must not exceed salaryMax" });
      return;
    }
    if (
      body.payPerHour !== undefined &&
      (body.payPerHour < 0 || body.payPerHour > 10000)
    ) {
      res.status(400).json({ error: "payPerHour must be between 0 and 10000" });
      return;
    }

    // -- Job posting limit enforcement --------------------------------------
    const plan = req.user!.plan || "free";
    const jobLimit = JOB_POSTING_LIMITS[plan] ?? 0;
    if (Number.isFinite(jobLimit)) {
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

    // Resolve the poster's company (if any) for salary attribution tracking
    const posterCompany = await Company.findOne({
      marketerId: req.user!.userId,
    })
      .select("_id")
      .lean()
      .catch(() => null);

    const job = await Job.create({
      title: body.title,
      description: body.description || "",
      location: body.location || "",
      jobCountry: body.jobCountry,
      jobState: body.jobState || "",
      jobCity: body.jobCity || "",
      jobType: body.jobType || "contract",
      jobSubType: body.jobSubType || "",
      workMode: body.workMode || "",
      salaryMin: body.salaryMin ?? undefined,
      salaryMax: body.salaryMax ?? undefined,
      payPerHour: body.payPerHour ?? undefined,
      skillsRequired: mergedSkills,
      experienceRequired: body.experienceRequired ?? 0,
      recruiterName: body.recruiterName || "",
      recruiterPhone: body.recruiterPhone || "",
      vendorId: req.user!.userId,
      vendorEmail: req.user!.email,
      sourceUserId: req.user!.userId,
      sourceCompanyId: posterCompany?._id ?? undefined,
    });

    res.status(201).json(jobToJSON(job.toObject()));
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
    const job = await Job.findById(req.params.id).lean();
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    const count = await Application.countDocuments({
      jobId: req.params.id,
    });
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
    const job = await Job.findById(req.params.id).lean();
    if (!job?.isActive) {
      res.status(404).json({ error: "Job not found or inactive" });
      return;
    }

    try {
      const app = await Application.create({
        jobId: req.params.id,
        jobTitle: job.title,
        candidateId: req.user!.userId,
        candidateEmail: req.user!.email,
        coverLetter: (() => {
          const cl = req.body.coverLetter || req.body.cover_letter || "";
          if (cl && cl.length > 2000)
            throw Object.assign(
              new Error("Cover letter must not exceed 2000 characters"),
              { statusCode: 400 },
            );
          return cl;
        })(),
      });

      await Job.updateOne(
        { _id: req.params.id },
        { $inc: { applicationCount: 1 } },
      );

      res.status(201).json(profileToJSON(app.toObject()));
    } catch (e: any) {
      if (e.code === 11000) {
        res.status(409).json({ error: "Already applied to this job" });
        return;
      }
      throw e;
    }
  } catch (err) {
    next(err);
  }
}

// PATCH /api/jobs/:id/close � vendor closes (deactivates) their own job
export async function closeJob(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const job = await Job.findById(req.params.id).lean();
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    if (job.vendorId !== req.user!.userId) {
      res.status(403).json({ error: "Not authorized to close this job" });
      return;
    }
    const updated = await Job.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true },
    ).lean();
    const count = await Application.countDocuments({
      jobId: req.params.id,
    });
    const result = jobToJSON(updated);
    result.application_count = count;
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/jobs/:id/reopen � vendor re-activates their own closed job
export async function reopenJob(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const job = await Job.findById(req.params.id).lean();
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    if (job.vendorId !== req.user!.userId) {
      res.status(403).json({ error: "Not authorized to reopen this job" });
      return;
    }

    // -- Reopen limit enforcement -------------------------------------------
    const plan = req.user!.plan || "free";
    const jobLimit = JOB_POSTING_LIMITS[plan] ?? 0;
    if (Number.isFinite(jobLimit)) {
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

    const updated = await Job.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      { new: true },
    ).lean();
    const count = await Application.countDocuments({
      jobId: req.params.id,
    });
    const result = jobToJSON(updated);
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
    res.json(apps.map(profileToJSON));
  } catch (err) {
    next(err);
  }
}

// GET /api/jobs/vendor � vendor's own jobs (paginated)
export async function vendorJobs(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const where = { vendorId: req.user!.userId };
    const wantPaginated = req.query.page !== undefined;

    if (wantPaginated) {
      const { page, limit, skip } = parsePagination(req.query);
      const [data, total] = await Promise.all([
        Job.find(where).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Job.countDocuments(where),
      ]);
      res.json({
        data: data.map(jobToJSON),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } else {
      const jobs = await Job.find(where).sort({ createdAt: -1 }).lean();
      res.json(jobs.map(jobToJSON));
    }
  } catch (err) {
    next(err);
  }
}

// GET /api/jobs/profile � candidate profile
export async function getProfile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const profile = await CandidateProfile.findOne({
      candidateId: req.user!.userId,
    }).lean();
    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    res.json(profileToJSON(profile));
  } catch (err) {
    next(err);
  }
}

// POST /api/jobs/profile � create profile
export async function createProfile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rawVisibilityConfig = req.body.visibility_config;
    const incoming = toCamelCase(req.body);
    if (rawVisibilityConfig !== undefined) {
      incoming.visibilityConfig = rawVisibilityConfig;
    }

    if (!incoming.profileCountry) {
      res.status(400).json({ error: "Subscription country is required." });
      return;
    }

    try {
      const displayId = await getNextId("candidate");
      const profile = await CandidateProfile.create({
        ...incoming,
        displayId,
        candidateId: req.user!.userId,
        username: req.user!.username || "",
        email: req.user!.email,
        skills: incoming.skills || [],
      });
      res.status(201).json(profileToJSON(profile.toObject()));
    } catch (e: any) {
      if (e.code === 11000) {
        res
          .status(409)
          .json({ error: "Profile already exists. Use PUT to update." });
        return;
      }
      throw e;
    }
  } catch (err) {
    next(err);
  }
}

// -- Helpers for updateProfile --

function validateAppendOnlyFields(existing: any, incoming: any): string | null {
  const appendFields = [
    "resumeSummary",
    "resumeExperience",
    "resumeEducation",
    "resumeAchievements",
  ] as const;
  for (const field of appendFields) {
    const existingVal = existing[field] || "";
    const incomingVal = incoming[field] || "";
    if (incomingVal && existingVal && !incomingVal.startsWith(existingVal)) {
      return `Cannot modify existing content in ${field}. You may only append new content.`;
    }
  }
  return null;
}

function mergeVisibilityConfig(
  existingVis: Record<string, string[]>,
  incomingVis: Record<string, string[]>,
): Record<string, string[]> {
  const merged: Record<string, string[]> = {};
  for (const [type, subs] of Object.entries(existingVis)) {
    merged[type] = Array.isArray(subs) ? [...subs] : [];
  }
  for (const [type, subs] of Object.entries(incomingVis)) {
    if (merged[type] === undefined) {
      merged[type] = Array.isArray(subs) ? [...subs] : [];
    } else {
      merged[type] = Array.from(
        new Set([...merged[type], ...(Array.isArray(subs) ? subs : [])]),
      );
    }
  }
  return merged;
}

function buildLockedUpdateData(existing: any, incoming: any): any {
  // When profile is locked, ignore incoming visibilityConfig — only paid updates (via webhook) are allowed
  const mergedVis = existing.visibilityConfig || {};

  const fullResumeText = [
    incoming.resumeSummary || existing.resumeSummary || "",
    incoming.resumeExperience || existing.resumeExperience || "",
    incoming.resumeEducation || existing.resumeEducation || "",
    incoming.resumeAchievements || existing.resumeAchievements || "",
    incoming.bio || existing.bio || "",
    existing.currentRole || "",
  ].join(" ");
  const mergedSkills = Array.from(
    new Set([...existing.skills, ...extractSkills(fullResumeText)]),
  );

  return {
    phone: incoming.phone ?? existing.phone,
    location: incoming.location ?? existing.location,
    preferredJobType: incoming.preferredJobType ?? existing.preferredJobType,
    expectedHourlyRate:
      incoming.expectedHourlyRate === undefined
        ? existing.expectedHourlyRate
        : incoming.expectedHourlyRate,
    bio: incoming.bio ?? existing.bio,
    experienceYears: incoming.experienceYears ?? existing.experienceYears,
    resumeSummary: incoming.resumeSummary || existing.resumeSummary,
    resumeExperience: incoming.resumeExperience || existing.resumeExperience,
    resumeEducation: incoming.resumeEducation || existing.resumeEducation,
    resumeAchievements:
      incoming.resumeAchievements || existing.resumeAchievements,
    visibilityConfig: mergedVis,
    skills: mergedSkills,
  };
}

function buildNewProfileData(incoming: any): any {
  const resumeText = [
    incoming.resumeSummary || "",
    incoming.resumeExperience || "",
    incoming.resumeEducation || "",
    incoming.resumeAchievements || "",
    incoming.bio || "",
    incoming.currentRole || "",
  ].join(" ");
  return {
    ...incoming,
    skills: extractSkills(resumeText),
    profileLocked: true,
  };
}

// PUT /api/jobs/profile � create (first time) or update (append-only when locked)
export async function updateProfile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rawVisibilityConfig = req.body.visibility_config;
    const incoming = toCamelCase(req.body);
    if (rawVisibilityConfig !== undefined) {
      incoming.visibilityConfig = rawVisibilityConfig;
    }

    const existing = await CandidateProfile.findOne({
      candidateId: req.user!.userId,
    }).lean();

    let updateData: any;

    if (existing?.profileLocked) {
      const appendError = validateAppendOnlyFields(existing, incoming);
      if (appendError) {
        res.status(400).json({ error: appendError });
        return;
      }
      if (
        incoming.experienceYears != null &&
        incoming.experienceYears < existing.experienceYears
      ) {
        res.status(400).json({
          error: "Experience years can only be increased, not decreased.",
        });
        return;
      }
      updateData = buildLockedUpdateData(existing, incoming);
    } else {
      if (!incoming.profileCountry) {
        res.status(400).json({ error: "Subscription country is required." });
        return;
      }
      updateData = buildNewProfileData(incoming);
    }

    const profile = await CandidateProfile.findOneAndUpdate(
      { candidateId: req.user!.userId },
      {
        $set: {
          ...updateData,
          candidateId: req.user!.userId,
          username: req.user!.username || "",
          email: req.user!.email,
          skills: updateData.skills || [],
        },
      },
      { upsert: true, new: true },
    ).lean();
    res.json(profileToJSON(profile));
  } catch (err) {
    next(err);
  }
}

// DELETE /api/jobs/profile � permanently delete candidate profile
export async function deleteProfile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await CandidateProfile.findOne({
      candidateId: req.user!.userId,
    }).lean();
    if (!result) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    await CandidateProfile.deleteOne({
      candidateId: req.user!.userId,
    });
    res.json({ message: "Profile deleted successfully." });
  } catch (err) {
    next(err);
  }
}

// -- Helpers for candidateMatches --

function filterMatchesByCountry(
  allMatched: any[],
  candidateCountry: string,
): any[] {
  if (!candidateCountry) return allMatched;
  return allMatched.filter((m: any) => {
    const jobCountry = m.jobCountry || m.job_country || "";
    return jobCountry === candidateCountry;
  });
}

function filterMatchesByAllowedTypes(
  matches: any[],
  typesParam: string | undefined,
): any[] {
  if (!typesParam) return matches;
  const allowedTypes = new Set(
    typesParam.split(",").map((t: string) => t.trim()),
  );
  return matches.filter((m: any) => {
    const jt = m.jobType || m.job_type || "";
    return allowedTypes.has(jt);
  });
}

function applyQueryFilters(matched: any[], query: Record<string, any>): any[] {
  let result = matched;

  const filterTypeParam = query.filter_type as string | undefined;
  if (filterTypeParam) {
    result = result.filter(
      (m: any) => (m.jobType || m.job_type || "") === filterTypeParam,
    );
  }

  const subTypeParam = query.sub_type as string | undefined;
  if (subTypeParam) {
    result = result.filter(
      (m: any) => (m.jobSubType || m.job_sub_type || "") === subTypeParam,
    );
  }

  const workModeParam = query.work_mode as string | undefined;
  if (workModeParam) {
    result = result.filter(
      (m: any) => (m.workMode || m.work_mode || "") === workModeParam,
    );
  }

  const searchParam = query.search as string | undefined;
  if (searchParam) {
    const q = searchParam.trim().toLowerCase();
    result = result.filter((m: any) => {
      const title = (m.title || "").toLowerCase();
      const loc = (m.location || "").toLowerCase();
      const email = (m.vendorEmail || m.vendor_email || "").toLowerCase();
      return title.includes(q) || loc.includes(q) || email.includes(q);
    });
  }

  return result;
}

// GET /api/jobs/matches � ranked jobs for candidate (paginated)
export async function candidateMatches(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const profile = await CandidateProfile.findOne({
      candidateId: req.user!.userId,
    }).lean();
    if (!profile) {
      res.json(
        req.query.page === undefined
          ? []
          : { data: [], total: 0, page: 1, limit: 25, totalPages: 0 },
      );
      return;
    }

    const jobs = await Job.find({ isActive: true }).lean();
    const allMatched = matchCandidateToJobs(profile as any, jobs as any);

    const locationFiltered = filterMatchesByCountry(
      allMatched,
      profile.profileCountry || "",
    );
    let matched = filterMatchesByAllowedTypes(
      locationFiltered,
      req.query.types as string | undefined,
    );

    // -- Aggregate type/subtype counts --
    const typeCounts: Record<string, number> = {};
    const subTypeCounts: Record<string, Record<string, number>> = {};
    for (const m of matched) {
      const jt = m.jobType || m.job_type || "other";
      typeCounts[jt] = (typeCounts[jt] || 0) + 1;
      const jst = m.jobSubType || m.job_sub_type || "";
      if (jst) {
        if (!subTypeCounts[jt]) subTypeCounts[jt] = {};
        subTypeCounts[jt][jst] = (subTypeCounts[jt][jst] || 0) + 1;
      }
    }

    matched = applyQueryFilters(matched, req.query);

    const wantPaginated = req.query.page !== undefined;
    if (wantPaginated) {
      const { page, limit, skip } = parsePagination(req.query);
      const total = matched.length;
      const sliced = matched.slice(skip, skip + limit);

      res.json({
        data: sliced.map((m: any) => toSnakeCase({ ...m, id: m.id })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        typeCounts,
        subTypeCounts,
      });
    } else {
      res.json(matched.map((m: any) => toSnakeCase({ ...m, id: m.id })));
    }
  } catch (err) {
    next(err);
  }
}

// GET /api/jobs/vendor-candidates?job_id=xxx � ranked candidates for vendor (paginated)
export async function vendorCandidates(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { job_id } = req.query as { job_id?: string };

    const jobWhere: any = { vendorId: req.user!.userId, isActive: true };
    if (job_id) jobWhere._id = job_id;

    const jobs = await Job.find(jobWhere).lean();
    if (!jobs.length) {
      res.json(
        req.query.page === undefined
          ? []
          : { data: [], total: 0, page: 1, limit: 25, totalPages: 0 },
      );
      return;
    }

    // -- Location-based filtering --
    const jobCountries = new Set(
      jobs.map((j: any) => j.jobCountry || "").filter(Boolean),
    );

    const profileWhere: any = {};
    if (jobCountries.size > 0) {
      profileWhere.profileCountry = { $in: Array.from(jobCountries) };
    }

    const profiles = await CandidateProfile.find(profileWhere).lean();
    const matched = matchJobsToCandidates(jobs as any, profiles as any);

    const wantPaginated = req.query.page !== undefined;
    if (wantPaginated) {
      const { page, limit, skip } = parsePagination(req.query);
      const total = matched.length;
      const sliced = matched.slice(skip, skip + limit);
      res.json({
        data: sliced.map((m: any) => toSnakeCase({ ...m, id: m.id })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } else {
      res.json(matched.map((m: any) => toSnakeCase({ ...m, id: m.id })));
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
      target_id: z.string().min(1),
      target_vendor_id: z.string().optional(),
      is_email: z.boolean().default(false),
      sender_name: z.string().optional(),
      sender_email: z.string().optional(),
      pdf_attachment: z.string().optional(),
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

    // -- Once-per enforcement ----------------------------------------------
    const already = await PokeRecord.findOne({
      senderId: req.user!.userId,
      targetId: target_id,
      isEmail: is_email,
    }).lean();
    if (already) {
      const action = is_email ? "emailed" : "poked";
      const target =
        req.user!.userType === "employer" ? "candidate" : "job posting";
      res
        .status(409)
        .json({ error: `You have already ${action} this ${target}.` });
      return;
    }

    // -- Monthly poke limit enforcement ------------------------------------
    const plan = req.user!.plan || "free";
    const pokeLimit = POKE_LIMITS[plan] ?? 5;
    if (Number.isFinite(pokeLimit)) {
      const yearMonth = new Date().toISOString().slice(0, 7);
      // Check BEFORE incrementing to avoid race condition where two simultaneous
      // requests both pass the limit check and both get through
      const existing = await PokeLog.findOne({
        userId: req.user!.userId,
        yearMonth,
      }).lean();
      if (existing && existing.count >= pokeLimit) {
        res.status(429).json({
          error: `Monthly poke limit reached (${pokeLimit}/month on your ${plan} plan). Upgrade at /pricing to send more.`,
        });
        return;
      }
      await PokeLog.findOneAndUpdate(
        { userId: req.user!.userId, yearMonth },
        { $inc: { count: 1 } },
        { upsert: true },
      );
    }

    await sendPokeEmail({
      to: to_email,
      toName: to_name,
      fromName: sender_name || req.user!.userId,
      fromEmail: sender_email || req.user!.email,
      subjectContext: subject_context,
      emailBody: email_body,
      pdfAttachment: pdf_attachment,
      pdfFilename: `${to_name.replaceAll(/\s+/g, "_")}_resume.pdf`,
    });

    // -- Persist poke record -----------------------------------------------
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

// GET /api/jobs/pokes/sent � all pokes/emails the authenticated user has sent
export async function getPokesSent(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const skip = (page - 1) * limit;
    const records = await PokeRecord.find({ senderId: req.user!.userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    res.json(records.map((r) => toSnakeCase({ ...r, id: r._id })));
  } catch (err) {
    next(err);
  }
}

// GET /api/jobs/pokes/received � pokes/emails received by the authenticated user
export async function getPokesReceived(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    let records: any[];
    if (req.user!.userType === "employer") {
      const page = Math.max(Number(req.query.page) || 1, 1);
      const limit = Math.min(Number(req.query.limit) || 50, 100);
      const skip = (page - 1) * limit;
      records = await PokeRecord.find({
        targetVendorId: req.user!.userId,
        senderType: "candidate",
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
    } else {
      const page = Math.max(Number(req.query.page) || 1, 1);
      const limit = Math.min(Number(req.query.limit) || 50, 100);
      const skip = (page - 1) * limit;
      const profile = await CandidateProfile.findOne({
        candidateId: req.user!.userId,
      }).lean();
      if (!profile) {
        res.json([]);
        return;
      }
      records = await PokeRecord.find({
        targetId: profile._id,
        senderType: "vendor",
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
    }
    res.json(records.map((r) => toSnakeCase({ ...r, id: r._id })));
  } catch (err) {
    next(err);
  }
}

// GET /api/jobs/resume/:username � public profile view by username
export async function getProfileByUsername(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { username } = req.params;
    const profile = await CandidateProfile.findOne({
      username,
    }).lean();
    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    res.json(profileToJSON(profile));
  } catch (err) {
    next(err);
  }
}

// GET /api/jobs/resume/:username/download � download resume as plain-text file (auth required)
export async function downloadResume(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { username } = req.params;
    const profile = await CandidateProfile.findOne({
      username,
    }).lean();
    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    const now = new Date().toISOString().slice(0, 10);
    const skills = profile.skills?.join(", ") || "�";
    const rate = profile.expectedHourlyRate
      ? `$${profile.expectedHourlyRate}/hr`
      : "�";

    const lines = [
      "================================================================",
      "  MATCHDB CANDIDATE RESUME",
      "================================================================",
      `Profile URL : ${process.env.CLIENT_URL || "http://localhost:3000"}/resume/${profile.username}`,
      `Downloaded  : ${now}`,
      "",
      "PERSONAL INFORMATION",
      "--------------------",
      `Name        : ${profile.name || "�"}`,
      `Email       : ${profile.email || "�"}`,
      `Phone       : ${profile.phone || "�"}`,
      `Location    : ${profile.location || "�"}`,
      "",
      "PROFESSIONAL DETAILS",
      "--------------------",
      `Current Company : ${profile.currentCompany || "�"}`,
      `Current Role    : ${profile.currentRole || "�"}`,
      `Preferred Type  : ${profile.preferredJobType || "�"}`,
      `Expected Rate   : ${rate}`,
      `Experience      : ${profile.experienceYears || 0} years`,
      "",
      "SKILLS",
      "------",
      skills,
      "",
      "PROFESSIONAL SUMMARY",
      "--------------------",
      profile.resumeSummary || "�",
      "",
      "WORK EXPERIENCE",
      "---------------",
      profile.resumeExperience || "�",
      "",
      "EDUCATION",
      "---------",
      profile.resumeEducation || "�",
      "",
      "ACHIEVEMENTS & CERTIFICATIONS",
      "-----------------------------",
      profile.resumeAchievements || "�",
      "",
      "================================================================",
      `  Generated by MatchDB  |  ${process.env.CLIENT_URL || "http://localhost:3000"}`,
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
