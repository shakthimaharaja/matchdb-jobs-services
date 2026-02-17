import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Job } from "../models/Job.model";
import { Application } from "../models/Application.model";
import { CandidateProfile } from "../models/CandidateProfile.model";
import {
  matchCandidateToJobs,
  matchJobsToCandidates,
} from "../services/matching.service";
import { sendPokeEmail } from "../services/sendgrid.service";
import { AppError } from "../middleware/error.middleware";

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

// GET /api/jobs — all active jobs
export async function listJobs(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const jobs = await Job.find({ isActive: true }).sort({ createdAt: -1 });
    res.json(jobs.map(jobToJSON));
  } catch (err) {
    next(err);
  }
}

// GET /api/jobs/profiles-public — public candidate profile listing (limited fields)
export async function listPublicProfiles(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const profiles = await CandidateProfile.find()
      .select('name currentRole currentCompany preferredJobType experienceYears skills location')
      .sort({ createdAt: -1 });
    res.json(profiles.map(profileToJSON));
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
      jobType: z
        .enum(["full_time", "part_time", "contract", "remote", "internship"])
        .optional(),
      jobSubType: z.string().optional(),
      salaryMin: z.number().optional(),
      salaryMax: z.number().optional(),
      payPerHour: z.number().optional(),
      skillsRequired: z.array(z.string()).optional(),
      experienceRequired: z.number().optional(),
      recruiterName: z.string().optional(),
      recruiterPhone: z.string().optional(),
    });

    const body = schema.parse(incoming);
    const job = await Job.create({
      ...body,
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

// GET /api/jobs/my-applications
export async function myApplications(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const apps = await Application.find({ candidateId: req.user!.userId }).sort(
      { createdAt: -1 },
    );
    res.json(apps.map(profileToJSON));
  } catch (err) {
    next(err);
  }
}

// GET /api/jobs/vendor — vendor's own jobs
export async function vendorJobs(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const jobs = await Job.find({ vendorId: req.user!.userId }).sort({
      createdAt: -1,
    });
    res.json(jobs.map(jobToJSON));
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

    const incoming = toCamelCase(req.body);
    const profile = await CandidateProfile.create({
      ...incoming,
      candidateId: req.user!.userId,
      email: req.user!.email,
    });
    res.status(201).json(profileToJSON(profile));
  } catch (err) {
    next(err);
  }
}

// PUT /api/jobs/profile — update profile
export async function updateProfile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const incoming = toCamelCase(req.body);
    const profile = await CandidateProfile.findOneAndUpdate(
      { candidateId: req.user!.userId },
      { ...incoming, candidateId: req.user!.userId },
      { new: true, upsert: true, runValidators: true },
    );
    res.json(profileToJSON(profile));
  } catch (err) {
    next(err);
  }
}

// GET /api/jobs/matches — ranked jobs for candidate
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
      res.json([]);
      return;
    }

    const jobs = await Job.find({ isActive: true });
    const matched = matchCandidateToJobs(profile, jobs);
    // Convert matched results to snake_case
    res.json(
      matched.map((m: any) => {
        const obj = typeof m.toObject === "function" ? m.toObject() : m;
        const flat = { ...obj, id: obj._id?.toString() || obj.id };
        return toSnakeCase(flat);
      }),
    );
  } catch (err) {
    next(err);
  }
}

// GET /api/jobs/vendor-candidates?job_id=xxx — ranked candidates for vendor
export async function vendorCandidates(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { job_id } = req.query as { job_id?: string };

    const jobQuery: any = { vendorId: req.user!.userId, isActive: true };
    if (job_id) jobQuery._id = job_id;

    const jobs = await Job.find(jobQuery);
    if (!jobs.length) {
      res.json([]);
      return;
    }

    const profiles = await CandidateProfile.find({});
    const matched = matchJobsToCandidates(jobs, profiles);
    // Convert matched results to snake_case
    res.json(
      matched.map((m: any) => {
        const obj = typeof m.toObject === "function" ? m.toObject() : m;
        const flat = { ...obj, id: obj._id?.toString() || obj.id };
        return toSnakeCase(flat);
      }),
    );
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
    });
    const { to_email, to_name, subject_context } = schema.parse(req.body);

    await sendPokeEmail({
      to: to_email,
      toName: to_name,
      fromName: req.user!.userId,
      fromEmail: req.user!.email,
      subjectContext: subject_context,
    });

    res.json({ message: `Poke sent to ${to_name} successfully.` });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0]?.message });
      return;
    }
    next(err);
  }
}
