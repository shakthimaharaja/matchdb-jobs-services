import { Request, Response, NextFunction } from "express";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { prisma } from "../config/prisma";

// ─── Marketer: Dashboard Stats ────────────────────────────────────────────────

/**
 * GET /api/jobs/marketer/stats
 * Returns aggregate counts for the marketer dashboard stat chips.
 */
export async function getMarketerStats(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const [
      totalProfiles,
      totalJobs,
      totalOpenJobs,
      totalClosedJobs,
      totalPlaced,
    ] = await Promise.all([
      prisma.candidateProfile.count(),
      prisma.job.count(),
      prisma.job.count({ where: { isActive: true } }),
      prisma.job.count({ where: { isActive: false } }),
      prisma.application.count({ where: { status: "hired" } }),
    ]);

    res.json({
      total_profiles: totalProfiles,
      total_jobs: totalJobs,
      total_open_jobs: totalOpenJobs,
      total_closed_jobs: totalClosedJobs,
      total_placed: totalPlaced,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/jobs/marketer/jobs
 * Returns paginated, searchable list of all active vendor job postings.
 *
 * Query params:
 *   page   (default 1)
 *   limit  (default 50, max 100)
 *   search (optional — matches title or skills)
 */
export async function getMarketerJobs(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50),
    );
    const search = String(req.query.search ?? "").trim();

    const where: any = { isActive: true };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
        { skillsRequired: { hasSome: [search] } },
      ];
    }

    const [total, docs] = await Promise.all([
      prisma.job.count({ where }),
      prisma.job.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // Aggregate poke + email counts for these jobs
    const jobIds = docs.map((j) => j.id);
    const pokeCounts = await prisma.pokeRecord.groupBy({
      by: ["targetId", "isEmail"],
      where: { targetId: { in: jobIds } },
      _count: { id: true },
    });
    const pokeMap: Record<string, { pokes: number; emails: number }> = {};
    for (const row of pokeCounts) {
      const id = row.targetId;
      if (!pokeMap[id]) pokeMap[id] = { pokes: 0, emails: 0 };
      if (row.isEmail) pokeMap[id].emails = row._count.id;
      else pokeMap[id].pokes = row._count.id;
    }

    const data = docs.map((j) => ({
      id: j.id,
      title: j.title,
      description: j.description ?? "",
      vendor_email: j.vendorEmail ?? "",
      recruiter_name: j.recruiterName ?? "",
      recruiter_phone: j.recruiterPhone ?? "",
      location: j.location ?? "",
      job_country: j.jobCountry ?? "",
      job_type: j.jobType ?? "",
      job_sub_type: j.jobSubType ?? "",
      work_mode: j.workMode ?? "",
      skills_required: j.skillsRequired ?? [],
      salary_min: j.salaryMin != null ? Number(j.salaryMin) : null,
      salary_max: j.salaryMax != null ? Number(j.salaryMax) : null,
      pay_per_hour: j.payPerHour != null ? Number(j.payPerHour) : null,
      experience_required: j.experienceRequired ?? 0,
      application_count: j.applicationCount ?? 0,
      poke_count: pokeMap[j.id]?.pokes ?? 0,
      email_count: pokeMap[j.id]?.emails ?? 0,
      is_active: j.isActive,
      created_at: j.createdAt?.toISOString() ?? "",
    }));

    res.json({ data, total, page, limit });
  } catch (err) {
    next(err);
  }
}

// ─── Marketer: All Candidate Profiles ────────────────────────────────────────

/**
 * GET /api/jobs/marketer/profiles
 * Returns paginated, searchable list of all candidate profiles.
 *
 * Query params:
 *   page   (default 1)
 *   limit  (default 50, max 100)
 *   search (optional — matches name, role, skills, or location)
 */
export async function getMarketerProfiles(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50),
    );
    const search = String(req.query.search ?? "").trim();

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { currentRole: { contains: search, mode: "insensitive" } },
        { currentCompany: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
        { skills: { hasSome: [search] } },
      ];
    }

    const selectFields = {
      id: true,
      name: true,
      email: true,
      phone: true,
      currentRole: true,
      currentCompany: true,
      preferredJobType: true,
      experienceYears: true,
      expectedHourlyRate: true,
      skills: true,
      location: true,
      resumeSummary: true,
      resumeExperience: true,
      resumeEducation: true,
      resumeAchievements: true,
      bio: true,
      createdAt: true,
    };

    const [total, docs] = await Promise.all([
      prisma.candidateProfile.count({ where }),
      prisma.candidateProfile.findMany({
        where,
        select: selectFields,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // Aggregate poke + email counts for these profiles
    const profileIds = docs.map((p) => p.id);
    const pokeCounts = await prisma.pokeRecord.groupBy({
      by: ["targetId", "isEmail"],
      where: { targetId: { in: profileIds } },
      _count: { id: true },
    });
    const pokeMap: Record<string, { pokes: number; emails: number }> = {};
    for (const row of pokeCounts) {
      const id = row.targetId;
      if (!pokeMap[id]) pokeMap[id] = { pokes: 0, emails: 0 };
      if (row.isEmail) pokeMap[id].emails = row._count.id;
      else pokeMap[id].pokes = row._count.id;
    }

    const data = docs.map((p) => ({
      id: p.id,
      name: p.name ?? "",
      email: p.email ?? "",
      phone: p.phone ?? "",
      current_role: p.currentRole ?? "",
      current_company: p.currentCompany ?? "",
      preferred_job_type: p.preferredJobType ?? "",
      experience_years: p.experienceYears ?? 0,
      expected_hourly_rate: p.expectedHourlyRate != null ? Number(p.expectedHourlyRate) : null,
      skills: p.skills ?? [],
      location: p.location ?? "",
      resume_summary: p.resumeSummary ?? "",
      resume_experience: p.resumeExperience ?? "",
      resume_education: p.resumeEducation ?? "",
      resume_achievements: p.resumeAchievements ?? "",
      bio: p.bio ?? "",
      poke_count: pokeMap[p.id]?.pokes ?? 0,
      email_count: pokeMap[p.id]?.emails ?? 0,
      created_at: p.createdAt?.toISOString() ?? "",
    }));

    res.json({ data, total, page, limit });
  } catch (err) {
    next(err);
  }
}

// ─── Company Registration ─────────────────────────────────────────────────────

/**
 * POST /api/jobs/marketer/company
 * Body: { name: string }
 * Creates (or returns existing) company for the logged-in marketer.
 */
export async function registerCompany(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { name } = req.body as { name?: string };
    if (!name || !name.trim()) {
      res.status(400).json({ error: "Company name is required" });
      return;
    }
    const marketerId = req.user!.userId;
    const marketerEmail = req.user!.email;

    // Upsert — one company per marketer
    let company = await prisma.company.findUnique({ where: { marketerId } });
    if (!company) {
      company = await prisma.company.create({
        data: { name: name.trim(), marketerId, marketerEmail },
      });
    }

    res.json({
      id: company.id,
      name: company.name,
      marketer_id: company.marketerId,
      marketer_email: company.marketerEmail,
      created_at: company.createdAt?.toISOString() ?? "",
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/jobs/marketer/company
 * Returns the marketer's company (if any).
 */
export async function getMyCompany(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const company = await prisma.company.findUnique({
      where: { marketerId: req.user!.userId },
    });
    if (!company) {
      res.json(null);
      return;
    }
    res.json({
      id: company.id,
      name: company.name,
      marketer_id: company.marketerId,
      marketer_email: company.marketerEmail,
      created_at: company.createdAt?.toISOString() ?? "",
    });
  } catch (err) {
    next(err);
  }
}

// ─── Public: list all companies ───────────────────────────────────────────────

/**
 * GET /api/jobs/companies
 * Returns all company names (no auth required — used in registration forms).
 */
export async function listCompanies(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const docs = await prisma.company.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    res.json(docs.map((d) => ({ id: d.id, name: d.name })));
  } catch (err) {
    next(err);
  }
}

// ─── Marketer Candidates (company roster) ────────────────────────────────────

/**
 * POST /api/jobs/marketer/candidates
 * Body: { candidateName: string, candidateEmail: string }
 */
export async function addMarketerCandidate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { candidateName, candidateEmail } = req.body as {
      candidateName?: string;
      candidateEmail?: string;
    };
    if (!candidateEmail || !candidateEmail.trim()) {
      res.status(400).json({ error: "Candidate email is required" });
      return;
    }

    const company = await prisma.company.findUnique({
      where: { marketerId: req.user!.userId },
    });
    if (!company) {
      res.status(400).json({ error: "Register your company first" });
      return;
    }

    try {
      const doc = await prisma.marketerCandidate.create({
        data: {
          companyId: company.id,
          marketerId: req.user!.userId,
          candidateId: "",
          candidateName: (candidateName || "").trim(),
          candidateEmail: candidateEmail.trim().toLowerCase(),
        },
      });

      res.status(201).json({
        id: doc.id,
        company_id: doc.companyId,
        candidate_name: doc.candidateName,
        candidate_email: doc.candidateEmail,
        created_at: doc.createdAt?.toISOString() ?? "",
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === "P2002") {
        res.status(409).json({ error: "Candidate already added to your company" });
        return;
      }
      throw e;
    }
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/jobs/marketer/candidates
 * Returns all candidates in the marketer's company.
 */
export async function getMarketerCandidates(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const company = await prisma.company.findUnique({
      where: { marketerId: req.user!.userId },
    });
    if (!company) {
      res.json([]);
      return;
    }

    const docs = await prisma.marketerCandidate.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: "desc" },
    });

    res.json(
      docs.map((d) => ({
        id: d.id,
        company_id: d.companyId,
        candidate_name: d.candidateName,
        candidate_email: d.candidateEmail,
        created_at: d.createdAt?.toISOString() ?? "",
      })),
    );
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/jobs/marketer/candidates/:id
 */
export async function removeMarketerCandidate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await prisma.marketerCandidate.deleteMany({
      where: {
        id: req.params.id,
        marketerId: req.user!.userId,
      },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ─── Forward Opening to Candidate ────────────────────────────────────────────

/**
 * POST /api/jobs/marketer/forward
 * Body: { candidateEmail: string, jobId: string, note?: string }
 */
export async function forwardOpening(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { candidateEmail, jobId, note } = req.body as {
      candidateEmail?: string;
      jobId?: string;
      note?: string;
    };

    if (!candidateEmail || !jobId) {
      res.status(400).json({ error: "candidateEmail and jobId are required" });
      return;
    }

    const company = await prisma.company.findUnique({
      where: { marketerId: req.user!.userId },
    });
    if (!company) {
      res.status(400).json({ error: "Register your company first" });
      return;
    }

    // Enforce: candidate MUST be in the marketer's company roster
    const mc = await prisma.marketerCandidate.findFirst({
      where: {
        companyId: company.id,
        candidateEmail: candidateEmail.trim().toLowerCase(),
      },
    });

    if (!mc) {
      res.status(403).json({
        error:
          'Candidate is not in your company roster. Add them in "Company Candidates" first.',
      });
      return;
    }

    const candidateName = mc.candidateName || candidateEmail.trim();

    // Get job details
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    try {
      const doc = await prisma.forwardedOpening.create({
        data: {
          marketerId: req.user!.userId,
          marketerEmail: req.user!.email,
          companyId: company.id,
          companyName: company.name,
          candidateEmail: candidateEmail.trim().toLowerCase(),
          candidateName,
          jobId: job.id,
          jobTitle: job.title,
          jobLocation: job.location,
          jobType: job.jobType,
          jobSubType: job.jobSubType,
          vendorEmail: job.vendorEmail,
          skillsRequired: job.skillsRequired,
          payPerHour: job.payPerHour ?? undefined,
          salaryMin: job.salaryMin ?? undefined,
          salaryMax: job.salaryMax ?? undefined,
          note: (note || "").trim(),
          status: "pending",
        },
      });

      res.status(201).json({
        id: doc.id,
        job_title: doc.jobTitle,
        candidate_email: doc.candidateEmail,
        status: doc.status,
        created_at: doc.createdAt?.toISOString() ?? "",
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === "P2002") {
        res.status(409).json({
          error: "This opening was already forwarded to this candidate",
        });
        return;
      }
      throw e;
    }
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/jobs/marketer/forwarded
 * Returns all forwarded openings from the marketer.
 */
export async function getForwardedOpenings(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const docs = await prisma.forwardedOpening.findMany({
      where: { marketerId: req.user!.userId },
      orderBy: { createdAt: "desc" },
    });

    res.json(
      docs.map((d) => ({
        id: d.id,
        candidate_email: d.candidateEmail,
        candidate_name: d.candidateName,
        job_id: d.jobId,
        job_title: d.jobTitle,
        job_location: d.jobLocation,
        job_type: d.jobType,
        job_sub_type: d.jobSubType,
        vendor_email: d.vendorEmail,
        skills_required: d.skillsRequired,
        pay_per_hour: d.payPerHour != null ? Number(d.payPerHour) : null,
        salary_min: d.salaryMin != null ? Number(d.salaryMin) : null,
        salary_max: d.salaryMax != null ? Number(d.salaryMax) : null,
        note: d.note,
        company_name: d.companyName,
        status: d.status,
        created_at: d.createdAt?.toISOString() ?? "",
      })),
    );
  } catch (err) {
    next(err);
  }
}

// ─── Candidate: Get forwarded openings by email ──────────────────────────────

/**
 * GET /api/jobs/candidate/forwarded
 * Returns forwarded openings for the logged-in candidate (matched by email).
 */
export async function getCandidateForwardedOpenings(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const email = req.user!.email.toLowerCase();
    const docs = await prisma.forwardedOpening.findMany({
      where: { candidateEmail: email },
      orderBy: { createdAt: "desc" },
    });

    res.json(
      docs.map((d) => ({
        id: d.id,
        marketer_email: d.marketerEmail,
        company_name: d.companyName,
        job_id: d.jobId,
        job_title: d.jobTitle,
        job_location: d.jobLocation,
        job_type: d.jobType,
        job_sub_type: d.jobSubType,
        vendor_email: d.vendorEmail,
        skills_required: d.skillsRequired,
        pay_per_hour: d.payPerHour != null ? Number(d.payPerHour) : null,
        salary_min: d.salaryMin != null ? Number(d.salaryMin) : null,
        salary_max: d.salaryMax != null ? Number(d.salaryMax) : null,
        note: d.note,
        status: d.status,
        created_at: d.createdAt?.toISOString() ?? "",
      })),
    );
  } catch (err) {
    next(err);
  }
}
