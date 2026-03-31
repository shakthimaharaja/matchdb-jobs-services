import { Request, Response, NextFunction } from "express";
import {
  Job,
  CandidateProfile,
  Application,
  PokeRecord,
  Company,
  EmployerCandidate,
  ForwardedOpening,
  CompanyInvite,
  ProjectFinancial,
  ClientCompany,
  VendorCompany,
} from "../models";
import { sendPokeEmail } from "../services/sendgrid.service";
import { toNum } from "../utils";

// --- Employer: Dashboard Stats ------------------------------------------------

/**
 * GET /api/jobs/employer/stats
 * Returns aggregate counts for the employer dashboard stat chips.
 */
export async function getEmployerStats(
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
      CandidateProfile.countDocuments(),
      Job.countDocuments(),
      Job.countDocuments({ isActive: true }),
      Job.countDocuments({ isActive: false }),
      Application.countDocuments({ status: "hired" }),
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
 * GET /api/jobs/employer/jobs
 * Returns paginated, searchable list of all active vendor job postings.
 *
 * Query params:
 *   page   (default 1)
 *   limit  (default 50, max 100)
 *   search (optional Ã¯Â¿Â½ matches title or skills)
 */
export async function getEmployerJobs(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rawPage = typeof req.query.page === "string" ? req.query.page : "1";
    const rawLimit =
      typeof req.query.limit === "string" ? req.query.limit : "50";
    const page = Math.max(1, Number.parseInt(rawPage, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(rawLimit, 10) || 50),
    );
    const search = (
      typeof req.query.search === "string" ? req.query.search : ""
    ).trim();

    const where: any = { isActive: true };
    if (search) {
      const escaped = search.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = new RegExp(escaped, "i");

      // Find matching client/vendor company IDs so we can search jobs by company
      const [matchingClients, matchingVendors] = await Promise.all([
        ClientCompany.find({ name: { $regex: rx } })
          .select("_id")
          .lean(),
        VendorCompany.find({ name: { $regex: rx } })
          .select("_id")
          .lean(),
      ]);
      const ccIds = matchingClients.map((c) => c._id);
      const vcIds = matchingVendors.map((v) => v._id);

      const orClauses: any[] = [
        { title: { $regex: rx } },
        { location: { $regex: rx } },
        { skillsRequired: search },
      ];
      if (ccIds.length) orClauses.push({ clientCompanyId: { $in: ccIds } });
      if (vcIds.length) orClauses.push({ vendorCompanyId: { $in: vcIds } });
      where.$or = orClauses;
    }

    // Build client/vendor company name lookup maps
    const [allClients, allVendors] = await Promise.all([
      ClientCompany.find().select("_id name").lean(),
      VendorCompany.find().select("_id name").lean(),
    ]);
    const ccNameMap: Record<string, string> = {};
    for (const c of allClients) ccNameMap[c._id] = c.name;
    const vcNameMap: Record<string, string> = {};
    for (const v of allVendors) vcNameMap[v._id] = v.name;

    const [total, docs] = await Promise.all([
      Job.countDocuments(where),
      Job.find(where)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    // Aggregate poke + email counts for these jobs
    const jobIds = docs.map((j) => j._id);
    const pokeCounts = await PokeRecord.aggregate([
      { $match: { targetId: { $in: jobIds } } },
      {
        $group: {
          _id: { targetId: "$targetId", isEmail: "$isEmail" },
          count: { $sum: 1 },
        },
      },
    ]);
    const pokeMap: Record<string, { pokes: number; emails: number }> = {};
    for (const row of pokeCounts) {
      const id = row._id.targetId;
      if (!pokeMap[id]) pokeMap[id] = { pokes: 0, emails: 0 };
      if (row._id.isEmail) pokeMap[id].emails = row.count;
      else pokeMap[id].pokes = row.count;
    }

    const data = docs.map((j) => ({
      id: j._id,
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
      salary_min: j.salaryMin == null ? null : Number(j.salaryMin),
      salary_max: j.salaryMax == null ? null : Number(j.salaryMax),
      pay_per_hour: j.payPerHour == null ? null : Number(j.payPerHour),
      experience_required: j.experienceRequired ?? 0,
      application_count: j.applicationCount ?? 0,
      poke_count: pokeMap[j._id]?.pokes ?? 0,
      email_count: pokeMap[j._id]?.emails ?? 0,
      is_active: j.isActive,
      client_company_id: j.clientCompanyId ?? "",
      client_company_name: j.clientCompanyId
        ? (ccNameMap[j.clientCompanyId] ?? "")
        : "",
      vendor_company_id: j.vendorCompanyId ?? "",
      vendor_company_name: j.vendorCompanyId
        ? (vcNameMap[j.vendorCompanyId] ?? "")
        : "",
      created_at: j.createdAt?.toISOString() ?? "",
    }));

    res.json({ data, total, page, limit });
  } catch (err) {
    next(err);
  }
}

// --- Employer: All Candidate Profiles ----------------------------------------

/**
 * GET /api/jobs/employer/profiles
 * Returns paginated, searchable list of all candidate profiles.
 *
 * Query params:
 *   page   (default 1)
 *   limit  (default 50, max 100)
 *   search (optional Ã¯Â¿Â½ matches name, role, skills, or location)
 */
export async function getEmployerProfiles(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rawPage = typeof req.query.page === "string" ? req.query.page : "1";
    const rawLimit =
      typeof req.query.limit === "string" ? req.query.limit : "50";
    const page = Math.max(1, Number.parseInt(rawPage, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(rawLimit, 10) || 50),
    );
    const search = (
      typeof req.query.search === "string" ? req.query.search : ""
    ).trim();

    const where: any = {};
    if (search) {
      const escaped = search.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = new RegExp(escaped, "i");
      where.$or = [
        { name: { $regex: rx } },
        { currentRole: { $regex: rx } },
        { currentCompany: { $regex: rx } },
        { location: { $regex: rx } },
        { skills: search },
      ];
    }

    const selectFields =
      "name email phone currentRole currentCompany preferredJobType experienceYears expectedHourlyRate skills location resumeSummary resumeExperience resumeEducation resumeAchievements bio createdAt";

    const [total, docs] = await Promise.all([
      CandidateProfile.countDocuments(where),
      CandidateProfile.find(where)
        .select(selectFields)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    // Aggregate poke + email counts for these profiles
    const profileIds = docs.map((p) => p._id);
    const pokeCounts = await PokeRecord.aggregate([
      { $match: { targetId: { $in: profileIds } } },
      {
        $group: {
          _id: { targetId: "$targetId", isEmail: "$isEmail" },
          count: { $sum: 1 },
        },
      },
    ]);
    const pokeMap: Record<string, { pokes: number; emails: number }> = {};
    for (const row of pokeCounts) {
      const id = row._id.targetId;
      if (!pokeMap[id]) pokeMap[id] = { pokes: 0, emails: 0 };
      if (row._id.isEmail) pokeMap[id].emails = row.count;
      else pokeMap[id].pokes = row.count;
    }

    const data = docs.map((p) => ({
      id: p._id,
      name: p.name ?? "",
      email: p.email ?? "",
      phone: p.phone ?? "",
      current_role: p.currentRole ?? "",
      current_company: p.currentCompany ?? "",
      preferred_job_type: p.preferredJobType ?? "",
      experience_years: p.experienceYears ?? 0,
      expected_hourly_rate:
        p.expectedHourlyRate == null ? null : Number(p.expectedHourlyRate),
      skills: p.skills ?? [],
      location: p.location ?? "",
      resume_summary: p.resumeSummary ?? "",
      resume_experience: p.resumeExperience ?? "",
      resume_education: p.resumeEducation ?? "",
      resume_achievements: p.resumeAchievements ?? "",
      bio: p.bio ?? "",
      poke_count: pokeMap[p._id]?.pokes ?? 0,
      email_count: pokeMap[p._id]?.emails ?? 0,
      created_at: p.createdAt?.toISOString() ?? "",
    }));

    res.json({ data, total, page, limit });
  } catch (err) {
    next(err);
  }
}

// --- Company Registration -----------------------------------------------------

/**
 * POST /api/jobs/employer/company
 * Body: { name: string }
 * Creates (or returns existing) company for the logged-in employer.
 * In the new architecture, company creation goes through admin/setup.
 * This endpoint creates a minimal company if one doesn't exist yet
 * (backward-compat / first-time employer access).
 */
export async function registerCompany(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { name } = req.body as { name?: string };
    const trimmedName = name?.trim() || "";
    if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 100) {
      res.status(400).json({ error: "Company name must be 2-100 characters" });
      return;
    }
    const userId = req.user!.userId;
    const userEmail = req.user!.email;

    // Look up via CompanyUser first
    const { CompanyUser } = await import("../models/CompanyUser");
    const cu = await CompanyUser.findOne({ userId, status: "active" }).lean();
    let company: any = cu
      ? await Company.findById(cu.companyId).lean()
      : await Company.findOne({ adminUserId: userId }).lean();

    if (!company) {
      company = (
        await Company.create({
          name: trimmedName,
          adminUserId: userId,
          adminEmail: userEmail,
        })
      ).toObject();
    }

    res.json({
      id: company._id,
      name: company.name,
      uid: company.adminUserId,
      employer_email: company.adminEmail,
      created_at: company.createdAt?.toISOString() ?? "",
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/jobs/employer/company
 * Returns the employer's company (if any).
 */
export async function getMyCompany(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { CompanyUser } = await import("../models/CompanyUser");
    const cu = await CompanyUser.findOne({
      userId: req.user!.userId,
      status: "active",
    }).lean();

    const company = cu
      ? await Company.findById(cu.companyId).lean()
      : await Company.findOne({ adminUserId: req.user!.userId }).lean();

    if (!company) {
      res.json(null);
      return;
    }
    res.json({
      id: company._id,
      name: company.name,
      uid: company.adminUserId,
      employer_email: company.adminEmail,
      created_at: company.createdAt?.toISOString() ?? "",
    });
  } catch (err) {
    next(err);
  }
}

// --- Public: list all companies -----------------------------------------------

/**
 * GET /api/jobs/companies
 * Returns all company names (no auth required Ã¯Â¿Â½ used in registration forms).
 */
export async function listCompanies(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const docs = await Company.find({})
      .select("_id name")
      .sort({ name: 1 })
      .lean();
    res.json(docs.map((d) => ({ id: d._id, name: d.name })));
  } catch (err) {
    next(err);
  }
}

// --- Marketer Candidates (company roster) ------------------------------------

/**
 * POST /api/jobs/employer/candidates
 * Body: { candidateName: string, candidateEmail: string }
 */
export async function addEmployerCandidate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { candidateName, candidateEmail } = req.body as {
      candidateName?: string;
      candidateEmail?: string;
    };
    if (!candidateEmail?.trim()) {
      res.status(400).json({ error: "Candidate email is required" });
      return;
    }

    const company = await Company.findOne({
      employerId: req.user!.userId,
    }).lean();
    if (!company) {
      res.status(400).json({ error: "Register your company first" });
      return;
    }

    try {
      const doc = await EmployerCandidate.create({
        companyId: company._id,
        employerId: req.user!.userId,
        candidateId: "",
        candidateName: (candidateName || "").trim(),
        candidateEmail: candidateEmail.trim().toLowerCase(),
      });

      res.status(201).json({
        id: doc._id,
        company_id: doc.companyId,
        candidate_name: doc.candidateName,
        candidate_email: doc.candidateEmail,
        created_at: doc.createdAt?.toISOString() ?? "",
      });
    } catch (e: any) {
      if (e.code === 11000) {
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
 * GET /api/jobs/employer/candidates
 * Returns all candidates in the marketer's company with poke/email counts.
 */
export async function getEmployerCandidates(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const company = await Company.findOne({
      employerId: req.user!.userId,
    }).lean();
    if (!company) {
      res.json([]);
      return;
    }

    const docs = await EmployerCandidate.find({ companyId: company._id })
      .sort({ createdAt: -1 })
      .lean();

    // Look up candidate profiles by email to get profile IDs for poke counts
    const emails = docs.map((d) => d.candidateEmail.toLowerCase());
    const profiles = await CandidateProfile.find({
      email: { $in: emails },
    })
      .select(
        "_id email candidateId name currentRole skills experienceYears location",
      )
      .lean();
    const profileByEmail: Record<string, (typeof profiles)[0]> = {};
    for (const p of profiles) {
      profileByEmail[p.email.toLowerCase()] = p;
    }

    // Aggregate poke + email counts for these candidates (by profile ID or candidateId)
    const targetIds = profiles
      .map((p) => p._id)
      .concat(profiles.map((p) => p.candidateId))
      .filter(Boolean);
    const pokeCounts = targetIds.length
      ? await PokeRecord.aggregate([
          { $match: { targetId: { $in: targetIds } } },
          {
            $group: {
              _id: { targetId: "$targetId", isEmail: "$isEmail" },
              count: { $sum: 1 },
            },
          },
        ])
      : [];
    const pokeMap: Record<string, { pokes: number; emails: number }> = {};
    for (const row of pokeCounts) {
      const id = row._id.targetId;
      if (!pokeMap[id]) pokeMap[id] = { pokes: 0, emails: 0 };
      if (row._id.isEmail) pokeMap[id].emails += row.count;
      else pokeMap[id].pokes += row.count;
    }

    res.json(
      docs.map((d) => {
        const prof = profileByEmail[d.candidateEmail.toLowerCase()];
        const pid = prof?._id ?? "";
        const cid = prof?.candidateId ?? "";
        const pokes = (pokeMap[pid]?.pokes ?? 0) + (pokeMap[cid]?.pokes ?? 0);
        const emailCt =
          (pokeMap[pid]?.emails ?? 0) + (pokeMap[cid]?.emails ?? 0);
        return {
          id: d._id,
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
 * GET /api/jobs/employer/company-summary
 * Returns company-wide aggregated data for all candidates:
 *  - Per-candidate financial totals
 *  - All projects with financials, client info, start/end dates
 *  - Job domain / role distribution
 */
export async function getCompanySummary(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const company = await Company.findOne({
      employerId: req.user!.userId,
    }).lean();
    if (!company) {
      res.json({
        candidates: [],
        projects: [],
        domainCounts: [],
        totals: {
          totalBilled: 0,
          totalPay: 0,
          netPayable: 0,
          amountPaid: 0,
          amountPending: 0,
          hoursWorked: 0,
          taxAmount: 0,
          cashAmount: 0,
        },
      });
      return;
    }

    // 1. All roster candidates
    const roster = await EmployerCandidate.find({ companyId: company._id })
      .sort({ createdAt: -1 })
      .lean();

    // 2. Matching profiles
    const emails = roster.map((r) => r.candidateEmail.toLowerCase());
    const profiles = await CandidateProfile.find({
      email: { $in: emails },
    })
      .select(
        "_id email candidateId name currentRole skills experienceYears location currentCompany",
      )
      .lean();
    const profileByEmail: Record<string, (typeof profiles)[0]> = {};
    for (const p of profiles) profileByEmail[p.email.toLowerCase()] = p;

    // 3. All financials for this marketer
    const allFinancials = await ProjectFinancial.find({
      employerId: req.user!.userId,
    }).lean();
    const finByAppId = new Map(allFinancials.map((f) => [f.applicationId, f]));

    // 4. All applications for these candidates
    const candidateIds = profiles
      .map((p) => p.candidateId)
      .filter((id): id is string => Boolean(id));
    const applications = candidateIds.length
      ? await Application.find({ candidateId: { $in: candidateIds } })
          .sort({ createdAt: -1 })
          .lean()
      : [];

    // Fetch jobs for these applications
    const appJobIds = [
      ...new Set(applications.map((a) => a.jobId).filter(Boolean)),
    ];
    const appJobs = appJobIds.length
      ? await Job.find({ _id: { $in: appJobIds } })
          .select(
            "_id title vendorEmail location jobType jobSubType payPerHour salaryMin salaryMax isActive",
          )
          .lean()
      : [];
    const jobMap = new Map(appJobs.map((j) => [j._id, j]));

    // Map candidateId -> email for lookup
    const cidToEmail: Record<string, string> = {};
    for (const p of profiles) cidToEmail[p.candidateId] = p.email.toLowerCase();

    // 5. Build per-candidate financial totals
    const candFinTotals: Record<
      string,
      {
        totalBilled: number;
        totalPay: number;
        netPayable: number;
        amountPaid: number;
        amountPending: number;
        hoursWorked: number;
        projectCount: number;
        activeProjects: number;
      }
    > = {};

    // 6. Build projects array & domain counts
    const domainMap: Record<string, number> = {};
    const projectsOut: any[] = [];

    for (const a of applications) {
      const email = cidToEmail[a.candidateId] ?? "";
      const rosterEntry = roster.find(
        (r) => r.candidateEmail.toLowerCase() === email,
      );
      const prof = profileByEmail[email];
      const fin = finByAppId.get(a._id);
      const aJob = jobMap.get(a.jobId);

      // Aggregate per-candidate
      if (!candFinTotals[email]) {
        candFinTotals[email] = {
          totalBilled: 0,
          totalPay: 0,
          netPayable: 0,
          amountPaid: 0,
          amountPending: 0,
          hoursWorked: 0,
          projectCount: 0,
          activeProjects: 0,
        };
      }
      const ct = candFinTotals[email];
      ct.projectCount++;
      if (aJob?.isActive) ct.activeProjects++;
      if (fin) {
        ct.totalBilled += toNum(fin.totalBilled);
        ct.totalPay += toNum(fin.totalPay);
        ct.netPayable += toNum(fin.netPayable);
        ct.amountPaid += toNum(fin.amountPaid);
        ct.amountPending += toNum(fin.amountPending);
        ct.hoursWorked += toNum(fin.hoursWorked);
      }

      // Domain count Ã¢â‚¬â€ use job title or role
      const domain = prof?.currentRole || aJob?.title || "Unknown";
      domainMap[domain] = (domainMap[domain] || 0) + 1;

      // Project row
      projectsOut.push({
        applicationId: a._id,
        candidateId: rosterEntry?._id ?? "",
        candidateName: rosterEntry?.candidateName ?? prof?.name ?? "",
        candidateEmail: email,
        jobTitle: aJob?.title ?? a.jobTitle,
        vendorEmail: aJob?.vendorEmail ?? "",
        vendorCompanyName: fin?.vendorCompanyName ?? "",
        vendorCompanyId: fin?.vendorCompanyId ?? "",
        clientName: fin?.clientName ?? "",
        clientCompanyId: fin?.clientCompanyId ?? aJob?.clientCompanyId ?? "",
        implementationPartner: fin?.implementationPartner ?? "",
        pocName: fin?.pocName ?? "",
        pocEmail: fin?.pocEmail ?? "",
        location: aJob?.location ?? "",
        jobType: aJob?.jobType ?? "",
        jobSubType: aJob?.jobSubType ?? "",
        isActive: aJob?.isActive ?? false,
        appliedAt: a.createdAt?.toISOString() ?? "",
        financials: fin
          ? {
              billRate: toNum(fin.billRate),
              payRate: toNum(fin.payRate),
              hoursWorked: toNum(fin.hoursWorked),
              projectStart: fin.projectStart?.toISOString() ?? null,
              projectEnd: fin.projectEnd?.toISOString() ?? null,
              stateCode: fin.stateCode,
              totalBilled: toNum(fin.totalBilled),
              totalPay: toNum(fin.totalPay),
              netPayable: toNum(fin.netPayable),
              amountPaid: toNum(fin.amountPaid),
              amountPending: toNum(fin.amountPending),
            }
          : null,
      });
    }

    // 7. Build candidates array
    const candidatesOut = roster.map((r) => {
      const email = r.candidateEmail.toLowerCase();
      const prof = profileByEmail[email];
      const ft = candFinTotals[email];
      return {
        id: r._id,
        candidateName: r.candidateName,
        candidateEmail: r.candidateEmail,
        inviteStatus: r.inviteStatus,
        currentRole: prof?.currentRole ?? "",
        location: prof?.location ?? "",
        currentCompany: prof?.currentCompany ?? "",
        skills: prof?.skills ?? [],
        experienceYears: prof?.experienceYears ?? 0,
        projectCount: ft?.projectCount ?? 0,
        activeProjects: ft?.activeProjects ?? 0,
        totalBilled: ft?.totalBilled ?? 0,
        totalPay: ft?.totalPay ?? 0,
        netPayable: ft?.netPayable ?? 0,
        amountPaid: ft?.amountPaid ?? 0,
        amountPending: ft?.amountPending ?? 0,
        hoursWorked: ft?.hoursWorked ?? 0,
      };
    });

    // 8. Grand totals
    const grandTotals = {
      totalBilled: 0,
      totalPay: 0,
      netPayable: 0,
      amountPaid: 0,
      amountPending: 0,
      hoursWorked: 0,
      taxAmount: 0,
      cashAmount: 0,
    };
    for (const f of allFinancials) {
      grandTotals.totalBilled += toNum(f.totalBilled);
      grandTotals.totalPay += toNum(f.totalPay);
      grandTotals.netPayable += toNum(f.netPayable);
      grandTotals.amountPaid += toNum(f.amountPaid);
      grandTotals.amountPending += toNum(f.amountPending);
      grandTotals.hoursWorked += toNum(f.hoursWorked);
      grandTotals.taxAmount += toNum(f.taxAmount);
      grandTotals.cashAmount += toNum(f.cashAmount);
    }

    // 9. Domain counts sorted descending
    const domainCounts = Object.entries(domainMap)
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count);

    res.json({
      candidates: candidatesOut,
      projects: projectsOut,
      domainCounts,
      totals: grandTotals,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/jobs/employer/candidates/:id/detail
 * Returns a QuickBooks-style detail view for a single company candidate.
 */
export async function getEmployerCandidateDetail(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const company = await Company.findOne({
      employerId: req.user!.userId,
    }).lean();
    if (!company) {
      res.status(400).json({ error: "No company registered" });
      return;
    }

    const mc = await EmployerCandidate.findOne({
      _id: req.params.id,
      companyId: company._id,
    }).lean();
    if (!mc) {
      res.status(404).json({ error: "Candidate not found in your roster" });
      return;
    }

    // Look up full profile
    const profile = await CandidateProfile.findOne({
      email: mc.candidateEmail.toLowerCase(),
    }).lean();

    // Get all applications (projects) for this candidate
    const applications = profile?.candidateId
      ? await Application.find({ candidateId: profile.candidateId })
          .sort({ createdAt: -1 })
          .lean()
      : [];

    // Separate job lookup
    const appJobIds = [...new Set(applications.map((a) => a.jobId))];
    const appJobs = appJobIds.length
      ? await Job.find({ _id: { $in: appJobIds } })
          .select(
            "title vendorEmail location jobType jobSubType payPerHour salaryMin salaryMax isActive createdAt",
          )
          .lean()
      : [];
    const jobMap = new Map(appJobs.map((j) => [j._id, j]));

    // Get financials for this candidate under this marketer
    const financials = profile?.candidateId
      ? await ProjectFinancial.find({
          employerId: req.user!.userId,
          candidateId: profile.candidateId,
        })
          .sort({ createdAt: -1 })
          .lean()
      : [];

    // Build a map of applicationId ? financial for quick lookup
    const financialMap = new Map(financials.map((f) => [f.applicationId, f]));

    // Get forwarded openings for this candidate from this marketer
    const forwarded = await ForwardedOpening.find({
      employerId: req.user!.userId,
      candidateEmail: mc.candidateEmail.toLowerCase(),
    })
      .sort({ createdAt: -1 })
      .lean();

    // Get poke/email records received
    const targetIds = [profile?._id, profile?.candidateId].filter(
      (x): x is string => Boolean(x),
    );
    const pokeRecords = targetIds.length
      ? await PokeRecord.find({ targetId: { $in: targetIds } })
          .sort({ createdAt: -1 })
          .limit(50)
          .lean()
      : [];

    res.json({
      roster: {
        id: mc._id,
        candidate_name: mc.candidateName,
        candidate_email: mc.candidateEmail,
        invite_status: mc.inviteStatus,
        invite_sent_at: mc.inviteSentAt?.toISOString() ?? null,
        created_at: mc.createdAt?.toISOString() ?? "",
      },
      profile: profile
        ? {
            id: profile._id,
            candidate_id: profile.candidateId,
            name: profile.name,
            email: profile.email,
            phone: profile.phone,
            current_company: profile.currentCompany,
            current_role: profile.currentRole,
            preferred_job_type: profile.preferredJobType,
            expected_hourly_rate:
              profile.expectedHourlyRate == null
                ? null
                : Number(profile.expectedHourlyRate),
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
        const fin = financialMap.get(a._id);
        const aJob = jobMap.get(a.jobId);
        return {
          id: a._id,
          job_id: a.jobId,
          job_title: aJob?.title ?? a.jobTitle,
          vendor_email: aJob?.vendorEmail ?? "",
          location: aJob?.location ?? "",
          job_type: aJob?.jobType ?? "",
          job_sub_type: aJob?.jobSubType ?? "",
          pay_per_hour:
            aJob?.payPerHour == null ? null : Number(aJob.payPerHour),
          salary_min: aJob?.salaryMin == null ? null : Number(aJob.salaryMin),
          salary_max: aJob?.salaryMax == null ? null : Number(aJob.salaryMax),
          status: a.status,
          is_active: aJob?.isActive ?? false,
          applied_at: a.createdAt?.toISOString() ?? "",
          financials: fin
            ? {
                id: fin._id,
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
        id: f._id,
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
        id: p._id,
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
 * DELETE /api/jobs/employer/candidates/:id
 */
export async function removeEmployerCandidate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await EmployerCandidate.deleteMany({
      _id: req.params.id,
      employerId: req.user!.userId,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// --- Forward Opening to Candidate --------------------------------------------

/**
 * POST /api/jobs/employer/forward
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

    const company = await Company.findOne({
      employerId: req.user!.userId,
    }).lean();
    if (!company) {
      res.status(400).json({ error: "Register your company first" });
      return;
    }

    // Enforce: candidate MUST be in the marketer's company roster
    const mc = await EmployerCandidate.findOne({
      companyId: company._id,
      candidateEmail: candidateEmail.trim().toLowerCase(),
    }).lean();

    if (!mc) {
      res.status(403).json({
        error:
          'Candidate is not in your company roster. Add them in "Company Candidates" first.',
      });
      return;
    }

    const candidateName = mc.candidateName || candidateEmail.trim();

    // Get job details
    const job = await Job.findOne({ _id: jobId }).lean();
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    try {
      const doc = await ForwardedOpening.create({
        employerId: req.user!.userId,
        employerEmail: req.user!.email,
        companyId: company._id,
        companyName: company.name,
        candidateEmail: candidateEmail.trim().toLowerCase(),
        candidateName,
        jobId: job._id,
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
      });

      res.status(201).json({
        id: doc._id,
        job_title: doc.jobTitle,
        candidate_email: doc.candidateEmail,
        status: doc.status,
        created_at: doc.createdAt?.toISOString() ?? "",
      });
    } catch (e) {
      if ((e as any).code === 11000) {
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
 * GET /api/jobs/employer/forwarded
 * Returns all forwarded openings from the marketer.
 */
export async function getForwardedOpenings(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const docs = await ForwardedOpening.find({ employerId: req.user!.userId })
      .sort({ createdAt: -1 })
      .lean();

    res.json(
      docs.map((d) => ({
        id: d._id,
        candidate_email: d.candidateEmail,
        candidate_name: d.candidateName,
        job_id: d.jobId,
        job_title: d.jobTitle,
        job_location: d.jobLocation,
        job_type: d.jobType,
        job_sub_type: d.jobSubType,
        vendor_email: d.vendorEmail,
        skills_required: d.skillsRequired,
        pay_per_hour: d.payPerHour == null ? null : Number(d.payPerHour),
        salary_min: d.salaryMin == null ? null : Number(d.salaryMin),
        salary_max: d.salaryMax == null ? null : Number(d.salaryMax),
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

// --- Candidate: Get forwarded openings by email ------------------------------

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
    const docs = await ForwardedOpening.find({ candidateEmail: email })
      .sort({ createdAt: -1 })
      .lean();

    res.json(
      docs.map((d) => ({
        id: d._id,
        employer_email: d.employerEmail,
        company_name: d.companyName,
        job_id: d.jobId,
        job_title: d.jobTitle,
        job_location: d.jobLocation,
        job_type: d.jobType,
        job_sub_type: d.jobSubType,
        vendor_email: d.vendorEmail,
        skills_required: d.skillsRequired,
        pay_per_hour: d.payPerHour == null ? null : Number(d.payPerHour),
        salary_min: d.salaryMin == null ? null : Number(d.salaryMin),
        salary_max: d.salaryMax == null ? null : Number(d.salaryMax),
        note: d.note,
        status: d.status,
        created_at: d.createdAt?.toISOString() ?? "",
      })),
    );
  } catch (err) {
    next(err);
  }
}

// --- Invite candidate via email -----------------------------------------------

/**
 * POST /api/jobs/employer/candidates/:id/invite
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
    const employerId = req.user!.userId;

    const company = await Company.findOne({ adminUserId: employerId }).lean();
    if (!company) {
      res.status(400).json({ error: "Register your company first" });
      return;
    }

    const mc = await EmployerCandidate.findOne({ _id: id, employerId }).lean();
    if (!mc) {
      res.status(404).json({ error: "Candidate not found in your roster" });
      return;
    }

    // Create or upsert invite
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days
    const invite = await CompanyInvite.findOneAndUpdate(
      { companyId: company._id, candidateEmail: mc.candidateEmail },
      {
        $set: {
          offerNote: (offerNote || "").trim(),
          status: "pending",
          expiresAt,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          companyId: company._id,
          companyName: company.name,
          employerId,
          employerEmail: req.user!.email,
          candidateEmail: mc.candidateEmail,
          candidateName: mc.candidateName,
        },
      },
      { upsert: true, new: true },
    ).lean();

    // Update roster entry with invite status
    await EmployerCandidate.updateOne(
      { _id: mc._id },
      {
        $set: {
          inviteStatus: "invited",
          inviteToken: invite.token,
          inviteSentAt: new Date(),
        },
      },
    );

    // Send invite email via SendGrid (dev: logs to console)
    const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
    const inviteLink = `${clientUrl}/invite/${invite.token}`;

    const noteBlock = offerNote
      ? `Note from your recruiter:\n"${offerNote}"\n\n`
      : "";

    await sendPokeEmail({
      to: mc.candidateEmail,
      toName: mc.candidateName || mc.candidateEmail,
      fromName: `${company.name} (via MatchDB)`,
      fromEmail: req.user!.email,
      subjectContext: `You're invited to join ${company.name} on MatchDB`,
      emailBody: `Hi ${mc.candidateName || "there"},\n\n${company.name} has invited you to join their team on MatchDB.\n\n${noteBlock}Click the link below to accept and create your profile:\n${inviteLink}\n\nThis invite expires in 14 days.\n\nBest regards,\nThe MatchDB Team`,
    }).catch((err) => console.error("[Invite Email] Send failed:", err));

    res.json({
      id: invite._id,
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

// --- Public: verify invite token ----------------------------------------------

/**
 * GET /api/jobs/invite/:token
 * Public Ã¯Â¿Â½ verifies an invite token and returns the offer details.
 */
export async function verifyInvite(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { token } = _req.params;
    const invite = await CompanyInvite.findOne({ token }).lean();

    if (!invite) {
      res.status(404).json({ error: "Invite not found" });
      return;
    }

    if (invite.status === "accepted") {
      res.json({
        status: "already_accepted",
        invite: {
          id: invite._id,
          company_id: invite.companyId,
          company_name: invite.companyName,
          employer_email: invite.employerEmail,
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
          id: invite._id,
          company_id: invite.companyId,
          company_name: invite.companyName,
          employer_email: invite.employerEmail,
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
        id: invite._id,
        company_id: invite.companyId,
        company_name: invite.companyName,
        employer_email: invite.employerEmail,
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
 * Candidate accepts the invite Ã¯Â¿Â½ links their profile to the company.
 */
export async function acceptInvite(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { token } = req.params;
    const invite = await CompanyInvite.findOne({ token }).lean();

    if (invite?.status !== "pending" || invite.expiresAt < new Date()) {
      res.status(400).json({ error: "Invalid or expired invite" });
      return;
    }

    // Mark invite as accepted
    await CompanyInvite.updateOne(
      { _id: invite._id },
      { $set: { status: "accepted" } },
    );

    // Update roster entry
    await EmployerCandidate.updateMany(
      {
        companyId: invite.companyId,
        candidateEmail: invite.candidateEmail,
      },
      {
        $set: {
          inviteStatus: "accepted",
          candidateId: req.user?.userId || "",
        },
      },
    );

    // If candidate has a profile, link it to the company
    if (req.user?.userId) {
      await CandidateProfile.updateMany(
        { candidateId: req.user!.userId },
        {
          $set: {
            companyId: invite.companyId,
            companyName: invite.companyName,
          },
        },
      );
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

// --- Company search (fuzzy for dropdown) --------------------------------------

/**
 * GET /api/jobs/companies/search?q=foo
 * Public Ã¯Â¿Â½ fuzzy search for company names (for candidate registration dropdown).
 */
export async function searchCompanies(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const q = (typeof req.query.q === "string" ? req.query.q : "").trim();
    if (!q) {
      res.json([]);
      return;
    }

    const escaped = q.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(escaped, "i");
    const docs = await Company.find({ name: { $regex: rx } })
      .select("_id name")
      .sort({ name: 1 })
      .limit(20)
      .lean();

    res.json(docs.map((d) => ({ id: d._id, name: d.name })));
  } catch (err) {
    next(err);
  }
}

// --- Forward opening WITH email notification ----------------------------------

/**
 * POST /api/jobs/employer/forward-with-email
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

    const company = await Company.findOne({
      employerId: req.user!.userId,
    }).lean();
    if (!company) {
      res.status(400).json({ error: "Register your company first" });
      return;
    }

    const mc = await EmployerCandidate.findOne({
      companyId: company._id,
      candidateEmail: candidateEmail.trim().toLowerCase(),
    }).lean();

    if (!mc) {
      res.status(403).json({
        error:
          'Candidate is not in your company roster. Add them in "Company Candidates" first.',
      });
      return;
    }

    const job = await Job.findOne({ _id: jobId }).lean();
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    try {
      const doc = await ForwardedOpening.create({
        employerId: req.user!.userId,
        employerEmail: req.user!.email,
        companyId: company._id,
        companyName: company.name,
        candidateEmail: candidateEmail.trim().toLowerCase(),
        candidateName: mc.candidateName || candidateEmail.trim(),
        jobId: job._id,
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
      });

      // Send email notification to candidate
      let comp = "Competitive";
      if (job.payPerHour) {
        comp = `$${Number(job.payPerHour).toFixed(0)}/hr`;
      } else if (job.salaryMin || job.salaryMax) {
        comp = `$${((Number(job.salaryMin) || Number(job.salaryMax)) / 1000).toFixed(0)}k`;
      }

      const subTypeSuffix = job.jobSubType ? ` / ${job.jobSubType}` : "";
      const recruiterNote = note ? `Recruiter's note:\n"${note}"\n\n` : "";
      const skillsList = (job.skillsRequired || []).join(", ");

      await sendPokeEmail({
        to: candidateEmail.trim().toLowerCase(),
        toName: mc.candidateName || candidateEmail,
        fromName: `${company.name} (via MatchDB)`,
        fromEmail: req.user!.email,
        subjectContext: `Job Opening: ${job.title} Ã¯Â¿Â½ ${job.location || "Remote"}`,
        emailBody: `Hi ${mc.candidateName || "there"},\n\nYour recruiter at ${company.name} has shared a job opening with you:\n\nTitle: ${job.title}\nLocation: ${job.location || "Remote"}\nType: ${job.jobType}${subTypeSuffix}\nCompensation: ${comp}\nSkills: ${skillsList}\n\n${recruiterNote}Log in to MatchDB to view details and apply.\n\nBest regards,\nThe MatchDB Team`,
      }).catch((err) => console.error("[Forward Email] Send failed:", err));

      res.status(201).json({
        id: doc._id,
        job_title: doc.jobTitle,
        candidate_email: doc.candidateEmail,
        status: doc.status,
        email_sent: true,
        created_at: doc.createdAt?.toISOString() ?? "",
      });
    } catch (e) {
      if ((e as any).code === 11000) {
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

// --- Update forwarded opening status ------------------------------------------

/**
 * PATCH /api/jobs/employer/forwarded/:id/status
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

    const doc = await ForwardedOpening.updateMany(
      { _id: id, employerId: req.user!.userId },
      { $set: { status } },
    );

    if (doc.modifiedCount === 0) {
      res.status(404).json({ error: "Forwarded opening not found" });
      return;
    }

    res.json({ ok: true, status });
  } catch (err) {
    next(err);
  }
}

// --- Candidate: My Detail (self-view) -----------------------------------------

/**
 * GET /api/jobs/candidate/my-detail
 * Returns the full detail view for the logged-in candidate Ã¯Â¿Â½ same structure
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
    const profile = await CandidateProfile.findOne({ email }).lean();

    // Applications (projects) Ã¢â‚¬â€ separate job + financials lookups
    const applications = profile?.candidateId
      ? await Application.find({ candidateId: profile.candidateId })
          .sort({ createdAt: -1 })
          .lean()
      : [];

    const appJobIds = [...new Set(applications.map((a) => a.jobId))];
    const appJobs = appJobIds.length
      ? await Job.find({ _id: { $in: appJobIds } })
          .select(
            "title vendorEmail location jobType jobSubType payPerHour salaryMin salaryMax isActive createdAt",
          )
          .lean()
      : [];
    const jobMap = new Map(appJobs.map((j) => [j._id, j]));

    const appIds = applications.map((a) => a._id);
    const allFinancials = appIds.length
      ? await ProjectFinancial.find({ applicationId: { $in: appIds } })
          .sort({ createdAt: -1 })
          .lean()
      : [];
    const finByAppId: Record<string, any[]> = {};
    for (const f of allFinancials) {
      if (!finByAppId[f.applicationId]) {
        finByAppId[f.applicationId] = [];
      }
      finByAppId[f.applicationId].push(f);
    }

    // Forwarded openings from ALL marketers
    const forwarded = await ForwardedOpening.find({ candidateEmail: email })
      .sort({ createdAt: -1 })
      .lean();

    // Poke / email activity sent TO this candidate
    const targetIds = [profile?._id, profile?.candidateId].filter(
      Boolean,
    ) as string[];
    const pokeRecords = targetIds.length
      ? await PokeRecord.find({ targetId: { $in: targetIds } })
          .sort({ createdAt: -1 })
          .limit(100)
          .lean()
      : [];

    // Marketer roster entries that include this candidate Ã¢â‚¬â€ separate company lookup
    const rosterEntries = await EmployerCandidate.find({
      candidateEmail: email,
    }).lean();
    const companyIds = [...new Set(rosterEntries.map((r) => r.companyId))];
    const companies = companyIds.length
      ? await Company.find({ _id: { $in: companyIds } })
          .select("_id name")
          .lean()
      : [];
    const companyMap = new Map(companies.map((c) => [c._id, c]));

    // Count forwarded openings per marketer for the summary
    const forwardedCountByMarketer = forwarded.reduce<Record<string, number>>(
      (acc, f) => {
        acc[f.employerId] = (acc[f.employerId] ?? 0) + 1;
        return acc;
      },
      {},
    );

    res.json({
      profile: profile
        ? {
            id: profile._id,
            candidate_id: profile.candidateId,
            name: profile.name,
            email: profile.email,
            phone: profile.phone,
            current_company: profile.currentCompany,
            current_role: profile.currentRole,
            preferred_job_type: profile.preferredJobType,
            expected_hourly_rate:
              profile.expectedHourlyRate == null
                ? null
                : Number(profile.expectedHourlyRate),
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
        const aJob = jobMap.get(a.jobId);
        const fins = finByAppId[a._id] ?? [];
        return {
          id: a._id,
          job_id: a.jobId,
          job_title: aJob?.title ?? a.jobTitle,
          vendor_email: aJob?.vendorEmail ?? "",
          location: aJob?.location ?? "",
          job_type: aJob?.jobType ?? "",
          job_sub_type: aJob?.jobSubType ?? "",
          pay_per_hour:
            aJob?.payPerHour == null ? null : Number(aJob.payPerHour),
          salary_min: aJob?.salaryMin == null ? null : Number(aJob.salaryMin),
          salary_max: aJob?.salaryMax == null ? null : Number(aJob.salaryMax),
          status: a.status,
          is_active: aJob?.isActive ?? false,
          applied_at: a.createdAt?.toISOString() ?? "",
          financials: fins.map((fin: any) => ({
            id: fin._id,
            uid: fin.employerId,
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
        };
      }),
      forwarded_openings: forwarded.map((f) => ({
        id: f._id,
        job_id: f.jobId,
        job_title: f.jobTitle,
        job_location: f.jobLocation,
        job_type: f.jobType,
        job_sub_type: f.jobSubType,
        vendor_email: f.vendorEmail,
        employer_email: f.employerEmail,
        company_name: f.companyName,
        status: f.status,
        note: f.note,
        created_at: f.createdAt?.toISOString() ?? "",
      })),
      vendor_activity: pokeRecords.map((p) => ({
        id: p._id,
        sender_email: p.senderEmail,
        sender_name: p.senderName,
        sender_type: p.senderType,
        is_email: p.isEmail,
        subject: p.subject,
        job_title: p.jobTitle ?? "",
        created_at: p.createdAt?.toISOString() ?? "",
      })),
      marketer_info: rosterEntries.map((mc) => ({
        id: mc._id,
        uid: mc.employerId,
        company_id: mc.companyId,
        company_name: companyMap.get(mc.companyId)?.name ?? "",
        invite_status: mc.inviteStatus,
        invite_sent_at: mc.inviteSentAt?.toISOString() ?? null,
        forwarded_count: forwardedCountByMarketer[mc.employerId] ?? 0,
        created_at: mc.createdAt?.toISOString() ?? "",
      })),
    });
  } catch (err) {
    next(err);
  }
}

// --- Client Companies --------------------------------------------------------

export async function getClientCompanies(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const docs = await ClientCompany.find({ employerId: req.user!.userId })
      .sort({ name: 1 })
      .lean();
    res.json(docs.map((d) => ({ id: d._id, name: d.name })));
  } catch (err) {
    next(err);
  }
}

// --- Vendor Companies --------------------------------------------------------

export async function getVendorCompanies(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const docs = await VendorCompany.find({ employerId: req.user!.userId })
      .sort({ name: 1 })
      .lean();
    res.json(docs.map((d) => ({ id: d._id, name: d.name })));
  } catch (err) {
    next(err);
  }
}
