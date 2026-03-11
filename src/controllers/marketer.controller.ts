import { Request, Response, NextFunction } from "express";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { prisma } from "../config/prisma";
import { sendPokeEmail } from "../services/sendgrid.service";

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
      expected_hourly_rate:
        p.expectedHourlyRate != null ? Number(p.expectedHourlyRate) : null,
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
        res
          .status(409)
          .json({ error: "Candidate already added to your company" });
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
 * Returns all candidates in the marketer's company with poke/email counts.
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

    // Look up candidate profiles by email to get profile IDs for poke counts
    const emails = docs.map((d) => d.candidateEmail.toLowerCase());
    const profiles = await prisma.candidateProfile.findMany({
      where: { email: { in: emails } },
      select: {
        id: true,
        email: true,
        candidateId: true,
        name: true,
        currentRole: true,
        skills: true,
        experienceYears: true,
        location: true,
      },
    });
    const profileByEmail: Record<string, (typeof profiles)[0]> = {};
    for (const p of profiles) {
      profileByEmail[p.email.toLowerCase()] = p;
    }

    // Aggregate poke + email counts for these candidates (by profile ID or candidateId)
    const targetIds = profiles
      .map((p) => p.id)
      .concat(profiles.map((p) => p.candidateId))
      .filter(Boolean);
    const pokeCounts = targetIds.length
      ? await prisma.pokeRecord.groupBy({
          by: ["targetId", "isEmail"],
          where: { targetId: { in: targetIds } },
          _count: { id: true },
        })
      : [];
    const pokeMap: Record<string, { pokes: number; emails: number }> = {};
    for (const row of pokeCounts) {
      const id = row.targetId;
      if (!pokeMap[id]) pokeMap[id] = { pokes: 0, emails: 0 };
      if (row.isEmail) pokeMap[id].emails += row._count.id;
      else pokeMap[id].pokes += row._count.id;
    }

    res.json(
      docs.map((d) => {
        const prof = profileByEmail[d.candidateEmail.toLowerCase()];
        const pid = prof?.id ?? "";
        const cid = prof?.candidateId ?? "";
        const pokes = (pokeMap[pid]?.pokes ?? 0) + (pokeMap[cid]?.pokes ?? 0);
        const emailCt =
          (pokeMap[pid]?.emails ?? 0) + (pokeMap[cid]?.emails ?? 0);
        return {
          id: d.id,
          company_id: d.companyId,
          candidate_name: d.candidateName,
          candidate_email: d.candidateEmail,
          invite_status: d.inviteStatus,
          invite_sent_at: d.inviteSentAt?.toISOString() ?? null,
          poke_count: pokes,
          email_count: emailCt,
          current_role: prof?.currentRole ?? "",
          skills: prof?.skills ?? [],
          experience_years: prof?.experienceYears ?? 0,
          location: prof?.location ?? "",
          created_at: d.createdAt?.toISOString() ?? "",
        };
      }),
    );
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/jobs/marketer/candidates/:id/detail
 * Returns a QuickBooks-style detail view for a single company candidate.
 */
export async function getMarketerCandidateDetail(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const company = await prisma.company.findUnique({
      where: { marketerId: req.user!.userId },
    });
    if (!company) {
      res.status(400).json({ error: "No company registered" });
      return;
    }

    const mc = await prisma.marketerCandidate.findFirst({
      where: { id: req.params.id, companyId: company.id },
    });
    if (!mc) {
      res.status(404).json({ error: "Candidate not found in your roster" });
      return;
    }

    // Look up full profile
    const profile = await prisma.candidateProfile.findFirst({
      where: { email: mc.candidateEmail.toLowerCase() },
    });

    // Get all applications (projects) for this candidate
    const applications = profile?.candidateId
      ? await prisma.application.findMany({
          where: { candidateId: profile.candidateId },
          include: {
            job: {
              select: {
                id: true,
                title: true,
                vendorEmail: true,
                location: true,
                jobType: true,
                jobSubType: true,
                payPerHour: true,
                salaryMin: true,
                salaryMax: true,
                isActive: true,
                createdAt: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        })
      : [];

    // Get financials for this candidate under this marketer
    const financials = profile?.candidateId
      ? await prisma.projectFinancial.findMany({
          where: {
            marketerId: req.user!.userId,
            candidateId: profile.candidateId,
          },
          orderBy: { createdAt: "desc" },
        })
      : [];

    // Build a map of applicationId → financial for quick lookup
    const financialMap = new Map(financials.map((f) => [f.applicationId, f]));

    // Get forwarded openings for this candidate from this marketer
    const forwarded = await prisma.forwardedOpening.findMany({
      where: {
        marketerId: req.user!.userId,
        candidateEmail: mc.candidateEmail.toLowerCase(),
      },
      orderBy: { createdAt: "desc" },
    });

    // Get poke/email records received
    const targetIds = [profile?.id, profile?.candidateId].filter(
      Boolean,
    ) as string[];
    const pokeRecords = targetIds.length
      ? await prisma.pokeRecord.findMany({
          where: { targetId: { in: targetIds } },
          orderBy: { createdAt: "desc" },
          take: 50,
        })
      : [];

    res.json({
      roster: {
        id: mc.id,
        candidate_name: mc.candidateName,
        candidate_email: mc.candidateEmail,
        invite_status: mc.inviteStatus,
        invite_sent_at: mc.inviteSentAt?.toISOString() ?? null,
        created_at: mc.createdAt?.toISOString() ?? "",
      },
      profile: profile
        ? {
            id: profile.id,
            candidate_id: profile.candidateId,
            name: profile.name,
            email: profile.email,
            phone: profile.phone,
            current_company: profile.currentCompany,
            current_role: profile.currentRole,
            preferred_job_type: profile.preferredJobType,
            expected_hourly_rate:
              profile.expectedHourlyRate != null
                ? Number(profile.expectedHourlyRate)
                : null,
            experience_years: profile.experienceYears,
            skills: profile.skills,
            location: profile.location,
            bio: profile.bio,
            resume_summary: profile.resumeSummary,
            resume_experience: profile.resumeExperience,
            resume_education: profile.resumeEducation,
            resume_achievements: profile.resumeAchievements,
          }
        : null,
      projects: applications.map((a) => {
        const fin = financialMap.get(a.id);
        return {
          id: a.id,
          job_id: a.jobId,
          job_title: a.job?.title ?? a.jobTitle,
          vendor_email: a.job?.vendorEmail ?? "",
          location: a.job?.location ?? "",
          job_type: a.job?.jobType ?? "",
          job_sub_type: a.job?.jobSubType ?? "",
          pay_per_hour:
            a.job?.payPerHour != null ? Number(a.job.payPerHour) : null,
          salary_min: a.job?.salaryMin != null ? Number(a.job.salaryMin) : null,
          salary_max: a.job?.salaryMax != null ? Number(a.job.salaryMax) : null,
          status: a.status,
          is_active: a.job?.isActive ?? false,
          applied_at: a.createdAt?.toISOString() ?? "",
          financials: fin
            ? {
                id: fin.id,
                billRate: Number(fin.billRate),
                payRate: Number(fin.payRate),
                hoursWorked: Number(fin.hoursWorked),
                projectStart: fin.projectStart?.toISOString() ?? null,
                projectEnd: fin.projectEnd?.toISOString() ?? null,
                stateCode: fin.stateCode,
                stateTaxPct: Number(fin.stateTaxPct),
                cashPct: Number(fin.cashPct),
                totalBilled: Number(fin.totalBilled),
                totalPay: Number(fin.totalPay),
                taxAmount: Number(fin.taxAmount),
                cashAmount: Number(fin.cashAmount),
                netPayable: Number(fin.netPayable),
                amountPaid: Number(fin.amountPaid),
                amountPending: Number(fin.amountPending),
                notes: fin.notes,
              }
            : null,
        };
      }),
      forwarded_openings: forwarded.map((f) => ({
        id: f.id,
        job_id: f.jobId,
        job_title: f.jobTitle,
        job_location: f.jobLocation,
        job_type: f.jobType,
        job_sub_type: f.jobSubType,
        vendor_email: f.vendorEmail,
        status: f.status,
        note: f.note,
        created_at: f.createdAt?.toISOString() ?? "",
      })),
      vendor_activity: pokeRecords.map((p) => ({
        id: p.id,
        sender_email: p.senderEmail,
        sender_name: p.senderName,
        sender_type: p.senderType,
        is_email: p.isEmail,
        subject: p.subject,
        job_title: p.jobTitle ?? "",
        created_at: p.createdAt?.toISOString() ?? "",
      })),
    });
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

// ─── Invite candidate via email ───────────────────────────────────────────────

/**
 * POST /api/jobs/marketer/candidates/:id/invite
 * Sends an invite email to a candidate in the marketer's roster.
 * Creates a CompanyInvite record with a unique token.
 */
export async function inviteCandidate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const { offerNote } = req.body as { offerNote?: string };
    const marketerId = req.user!.userId;

    const company = await prisma.company.findUnique({
      where: { marketerId },
    });
    if (!company) {
      res.status(400).json({ error: "Register your company first" });
      return;
    }

    const mc = await prisma.marketerCandidate.findFirst({
      where: { id, marketerId },
    });
    if (!mc) {
      res.status(404).json({ error: "Candidate not found in your roster" });
      return;
    }

    // Create or upsert invite
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days
    const invite = await prisma.companyInvite.upsert({
      where: {
        companyId_candidateEmail: {
          companyId: company.id,
          candidateEmail: mc.candidateEmail,
        },
      },
      create: {
        companyId: company.id,
        companyName: company.name,
        marketerId,
        marketerEmail: req.user!.email,
        candidateEmail: mc.candidateEmail,
        candidateName: mc.candidateName,
        offerNote: (offerNote || "").trim(),
        status: "pending",
        expiresAt,
      },
      update: {
        offerNote: (offerNote || "").trim(),
        status: "pending",
        expiresAt,
        updatedAt: new Date(),
      },
    });

    // Update roster entry with invite status
    await prisma.marketerCandidate.update({
      where: { id: mc.id },
      data: {
        inviteStatus: "invited",
        inviteToken: invite.token,
        inviteSentAt: new Date(),
      },
    });

    // Send invite email via SendGrid (dev: logs to console)
    const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
    const inviteLink = `${clientUrl}/invite/${invite.token}`;

    await sendPokeEmail({
      to: mc.candidateEmail,
      toName: mc.candidateName || mc.candidateEmail,
      fromName: `${company.name} (via MatchDB)`,
      fromEmail: req.user!.email,
      subjectContext: `You're invited to join ${company.name} on MatchDB`,
      emailBody: `Hi ${mc.candidateName || "there"},\n\n${company.name} has invited you to join their team on MatchDB.\n\n${offerNote ? `Note from your recruiter:\n"${offerNote}"\n\n` : ""}Click the link below to accept and create your profile:\n${inviteLink}\n\nThis invite expires in 14 days.\n\nBest regards,\nThe MatchDB Team`,
    }).catch((err) => console.error("[Invite Email] Send failed:", err));

    res.json({
      id: invite.id,
      token: invite.token,
      candidate_email: invite.candidateEmail,
      status: invite.status,
      invite_link: inviteLink,
      expires_at: invite.expiresAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

// ─── Public: verify invite token ──────────────────────────────────────────────

/**
 * GET /api/jobs/invite/:token
 * Public — verifies an invite token and returns the offer details.
 */
export async function verifyInvite(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { token } = _req.params;
    const invite = await prisma.companyInvite.findUnique({
      where: { token },
    });

    if (!invite) {
      res.status(404).json({ error: "Invite not found" });
      return;
    }

    if (invite.status === "accepted") {
      res.json({
        status: "already_accepted",
        invite: {
          id: invite.id,
          company_id: invite.companyId,
          company_name: invite.companyName,
          marketer_email: invite.marketerEmail,
          candidate_email: invite.candidateEmail,
          candidate_name: invite.candidateName,
          offer_note: invite.offerNote,
          status: invite.status,
          token: invite.token,
          expires_at: invite.expiresAt.toISOString(),
          created_at: invite.createdAt.toISOString(),
        },
      });
      return;
    }

    if (invite.status === "expired" || invite.expiresAt < new Date()) {
      res.json({
        status: "expired",
        invite: {
          id: invite.id,
          company_id: invite.companyId,
          company_name: invite.companyName,
          marketer_email: invite.marketerEmail,
          candidate_email: invite.candidateEmail,
          candidate_name: invite.candidateName,
          offer_note: invite.offerNote,
          status: "expired",
          token: invite.token,
          expires_at: invite.expiresAt.toISOString(),
          created_at: invite.createdAt.toISOString(),
        },
      });
      return;
    }

    res.json({
      status: "valid",
      invite: {
        id: invite.id,
        company_id: invite.companyId,
        company_name: invite.companyName,
        marketer_email: invite.marketerEmail,
        candidate_email: invite.candidateEmail,
        candidate_name: invite.candidateName,
        offer_note: invite.offerNote,
        status: invite.status,
        token: invite.token,
        expires_at: invite.expiresAt.toISOString(),
        created_at: invite.createdAt.toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/jobs/invite/:token/accept
 * Candidate accepts the invite — links their profile to the company.
 */
export async function acceptInvite(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { token } = req.params;
    const invite = await prisma.companyInvite.findUnique({
      where: { token },
    });

    if (
      !invite ||
      invite.status !== "pending" ||
      invite.expiresAt < new Date()
    ) {
      res.status(400).json({ error: "Invalid or expired invite" });
      return;
    }

    // Mark invite as accepted
    await prisma.companyInvite.update({
      where: { id: invite.id },
      data: { status: "accepted" },
    });

    // Update roster entry
    await prisma.marketerCandidate.updateMany({
      where: {
        companyId: invite.companyId,
        candidateEmail: invite.candidateEmail,
      },
      data: {
        inviteStatus: "accepted",
        candidateId: req.user?.userId || "",
      },
    });

    // If candidate has a profile, link it to the company
    if (req.user?.userId) {
      await prisma.candidateProfile.updateMany({
        where: { candidateId: req.user.userId },
        data: {
          companyId: invite.companyId,
          companyName: invite.companyName,
        },
      });
    }

    res.json({
      ok: true,
      company_id: invite.companyId,
      company_name: invite.companyName,
    });
  } catch (err) {
    next(err);
  }
}

// ─── Company search (fuzzy for dropdown) ──────────────────────────────────────

/**
 * GET /api/jobs/companies/search?q=foo
 * Public — fuzzy search for company names (for candidate registration dropdown).
 */
export async function searchCompanies(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const q = String(req.query.q ?? "").trim();
    if (!q) {
      res.json([]);
      return;
    }

    const docs = await prisma.company.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 20,
    });

    res.json(docs.map((d) => ({ id: d.id, name: d.name })));
  } catch (err) {
    next(err);
  }
}

// ─── Forward opening WITH email notification ──────────────────────────────────

/**
 * POST /api/jobs/marketer/forward-with-email
 * Body: { candidateEmail, jobId, note? }
 * Forwards a job opening to a candidate AND sends an email notification.
 */
export async function forwardOpeningWithEmail(
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
          candidateName: mc.candidateName || candidateEmail.trim(),
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

      // Send email notification to candidate
      const comp = job.payPerHour
        ? `$${Number(job.payPerHour).toFixed(0)}/hr`
        : job.salaryMin || job.salaryMax
          ? `$${((Number(job.salaryMin) || Number(job.salaryMax)) / 1000).toFixed(0)}k`
          : "Competitive";

      await sendPokeEmail({
        to: candidateEmail.trim().toLowerCase(),
        toName: mc.candidateName || candidateEmail,
        fromName: `${company.name} (via MatchDB)`,
        fromEmail: req.user!.email,
        subjectContext: `Job Opening: ${job.title} — ${job.location || "Remote"}`,
        emailBody: `Hi ${mc.candidateName || "there"},\n\nYour recruiter at ${company.name} has shared a job opening with you:\n\nTitle: ${job.title}\nLocation: ${job.location || "Remote"}\nType: ${job.jobType}${job.jobSubType ? ` / ${job.jobSubType}` : ""}\nCompensation: ${comp}\nSkills: ${(job.skillsRequired || []).join(", ")}\n\n${note ? `Recruiter's note:\n"${note}"\n\n` : ""}Log in to MatchDB to view details and apply.\n\nBest regards,\nThe MatchDB Team`,
      }).catch((err) => console.error("[Forward Email] Send failed:", err));

      res.status(201).json({
        id: doc.id,
        job_title: doc.jobTitle,
        candidate_email: doc.candidateEmail,
        status: doc.status,
        email_sent: true,
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

// ─── Update forwarded opening status ──────────────────────────────────────────

/**
 * PATCH /api/jobs/marketer/forwarded/:id/status
 * Body: { status: "applied" | "hired" | "declined" }
 */
export async function updateForwardedStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const { status } = req.body as { status?: string };
    const validStatuses = [
      "pending",
      "applied",
      "hired",
      "declined",
      "rejected",
    ];

    if (!status || !validStatuses.includes(status)) {
      res
        .status(400)
        .json({ error: `Status must be one of: ${validStatuses.join(", ")}` });
      return;
    }

    const doc = await prisma.forwardedOpening.updateMany({
      where: { id, marketerId: req.user!.userId },
      data: { status },
    });

    if (doc.count === 0) {
      res.status(404).json({ error: "Forwarded opening not found" });
      return;
    }

    res.json({ ok: true, status });
  } catch (err) {
    next(err);
  }
}

// ─── Candidate: My Detail (self-view) ─────────────────────────────────────────

/**
 * GET /api/jobs/candidate/my-detail
 * Returns the full detail view for the logged-in candidate — same structure
 * as the marketer's candidate detail but:
 *  - NOT scoped to a single marketer (all financials from all marketers)
 *  - marketer_info: roster entries linking this candidate to marketers
 */
export async function getCandidateMyDetail(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const email = req.user!.email.toLowerCase();

    // Profile
    const profile = await prisma.candidateProfile.findFirst({
      where: { email },
    });

    // Applications (projects) with ALL financials across all marketers
    const applications = profile?.candidateId
      ? await prisma.application.findMany({
          where: { candidateId: profile.candidateId },
          include: {
            job: {
              select: {
                id: true,
                title: true,
                vendorEmail: true,
                location: true,
                jobType: true,
                jobSubType: true,
                payPerHour: true,
                salaryMin: true,
                salaryMax: true,
                isActive: true,
                createdAt: true,
              },
            },
            financials: { orderBy: { createdAt: "desc" } },
          },
          orderBy: { createdAt: "desc" },
        })
      : [];

    // Forwarded openings from ALL marketers
    const forwarded = await prisma.forwardedOpening.findMany({
      where: { candidateEmail: email },
      orderBy: { createdAt: "desc" },
    });

    // Poke / email activity sent TO this candidate
    const targetIds = [profile?.id, profile?.candidateId].filter(
      Boolean,
    ) as string[];
    const pokeRecords = targetIds.length
      ? await prisma.pokeRecord.findMany({
          where: { targetId: { in: targetIds } },
          orderBy: { createdAt: "desc" },
          take: 100,
        })
      : [];

    // Marketer roster entries that include this candidate
    const rosterEntries = await prisma.marketerCandidate.findMany({
      where: { candidateEmail: email },
      include: {
        company: { select: { id: true, name: true } },
      },
    });

    // Count forwarded openings per marketer for the summary
    const forwardedCountByMarketer = forwarded.reduce<Record<string, number>>(
      (acc, f) => {
        acc[f.marketerId] = (acc[f.marketerId] ?? 0) + 1;
        return acc;
      },
      {},
    );

    res.json({
      profile: profile
        ? {
            id: profile.id,
            candidate_id: profile.candidateId,
            name: profile.name,
            email: profile.email,
            phone: profile.phone,
            current_company: profile.currentCompany,
            current_role: profile.currentRole,
            preferred_job_type: profile.preferredJobType,
            expected_hourly_rate:
              profile.expectedHourlyRate != null
                ? Number(profile.expectedHourlyRate)
                : null,
            experience_years: profile.experienceYears,
            skills: profile.skills,
            location: profile.location,
            bio: profile.bio,
            resume_summary: profile.resumeSummary,
            resume_experience: profile.resumeExperience,
            resume_education: profile.resumeEducation,
            resume_achievements: profile.resumeAchievements,
          }
        : null,
      projects: applications.map((a) => ({
        id: a.id,
        job_id: a.jobId,
        job_title: a.job?.title ?? a.jobTitle,
        vendor_email: a.job?.vendorEmail ?? "",
        location: a.job?.location ?? "",
        job_type: a.job?.jobType ?? "",
        job_sub_type: a.job?.jobSubType ?? "",
        pay_per_hour:
          a.job?.payPerHour != null ? Number(a.job.payPerHour) : null,
        salary_min: a.job?.salaryMin != null ? Number(a.job.salaryMin) : null,
        salary_max: a.job?.salaryMax != null ? Number(a.job.salaryMax) : null,
        status: a.status,
        is_active: a.job?.isActive ?? false,
        applied_at: a.createdAt?.toISOString() ?? "",
        financials: a.financials.map((fin) => ({
          id: fin.id,
          marketer_id: fin.marketerId,
          billRate: Number(fin.billRate),
          payRate: Number(fin.payRate),
          hoursWorked: Number(fin.hoursWorked),
          projectStart: fin.projectStart?.toISOString() ?? null,
          projectEnd: fin.projectEnd?.toISOString() ?? null,
          stateCode: fin.stateCode,
          stateTaxPct: Number(fin.stateTaxPct),
          cashPct: Number(fin.cashPct),
          totalBilled: Number(fin.totalBilled),
          totalPay: Number(fin.totalPay),
          taxAmount: Number(fin.taxAmount),
          cashAmount: Number(fin.cashAmount),
          netPayable: Number(fin.netPayable),
          amountPaid: Number(fin.amountPaid),
          amountPending: Number(fin.amountPending),
          notes: fin.notes,
        })),
      })),
      forwarded_openings: forwarded.map((f) => ({
        id: f.id,
        job_id: f.jobId,
        job_title: f.jobTitle,
        job_location: f.jobLocation,
        job_type: f.jobType,
        job_sub_type: f.jobSubType,
        vendor_email: f.vendorEmail,
        marketer_email: f.marketerEmail,
        company_name: f.companyName,
        status: f.status,
        note: f.note,
        created_at: f.createdAt?.toISOString() ?? "",
      })),
      vendor_activity: pokeRecords.map((p) => ({
        id: p.id,
        sender_email: p.senderEmail,
        sender_name: p.senderName,
        sender_type: p.senderType,
        is_email: p.isEmail,
        subject: p.subject,
        job_title: p.jobTitle ?? "",
        created_at: p.createdAt?.toISOString() ?? "",
      })),
      marketer_info: rosterEntries.map((mc) => ({
        id: mc.id,
        marketer_id: mc.marketerId,
        company_id: mc.companyId,
        company_name: mc.company?.name ?? "",
        invite_status: mc.inviteStatus,
        invite_sent_at: mc.inviteSentAt?.toISOString() ?? null,
        forwarded_count: forwardedCountByMarketer[mc.marketerId] ?? 0,
        created_at: mc.createdAt?.toISOString() ?? "",
      })),
    });
  } catch (err) {
    next(err);
  }
}
