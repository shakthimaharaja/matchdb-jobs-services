import { Request, Response, NextFunction } from "express";
import {
  Job,
  Application,
  ProjectFinancial,
  CandidateProfile,
  Company,
} from "../models";

// ─── Helper ──────────────────────────────────────────────────────────────────
function toNum(v: unknown): number {
  return typeof v === "number" ? v : Number(v) || 0;
}

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface VendorFinancialCandidate {
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  currentRole: string;
  location: string;
  jobTitle: string;
  jobType: string;
  jobSubType: string;
  isActive: boolean;
  clientName: string;
  implementationPartner: string;
  marketerCompanyName: string;
  billRate: number;
  payRate: number;
  hoursWorked: number;
  totalBilled: number;
  totalPay: number;
  taxAmount: number;
  cashAmount: number;
  netPayable: number;
  amountPaid: number;
  amountPending: number;
  projectStart: string | null;
  projectEnd: string | null;
  status: string;
}

interface VendorClientPipeline {
  clientName: string;
  candidateCount: number;
  totalBilled: number;
  totalPaid: number;
  totalPending: number;
  totalHours: number;
}

// ─── GET /api/jobs/vendor/financials/summary ──────────────────────────────────
/**
 * Returns vendor financial summary:
 *  - All candidates placed through this vendor's jobs
 *  - Financial details per candidate-job pair
 *  - Aggregate totals
 *  - Client pipeline breakdown
 */
export async function getVendorFinancialSummary(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const vendorId = req.user!.userId;
    const vendorEmail = req.user!.email;

    // 1. All jobs posted by this vendor
    const jobs = await Job.find({ vendorId })
      .select(
        "_id title vendorEmail location jobType jobSubType isActive clientCompanyId",
      )
      .lean();

    if (jobs.length === 0) {
      res.json({
        candidates: [],
        clientPipeline: [],
        totals: {
          totalCandidates: 0,
          totalBilled: 0,
          totalPay: 0,
          totalHours: 0,
          totalCredited: 0,
          totalPending: 0,
        },
      });
      return;
    }

    const jobIds = jobs.map((j) => j._id);
    const jobMap = new Map(jobs.map((j) => [j._id, j]));

    // 2. All applications for these jobs
    const applications = await Application.find({
      jobId: { $in: jobIds },
    }).lean();

    if (applications.length === 0) {
      res.json({
        candidates: [],
        clientPipeline: [],
        totals: {
          totalCandidates: 0,
          totalBilled: 0,
          totalPay: 0,
          totalHours: 0,
          totalCredited: 0,
          totalPending: 0,
        },
      });
      return;
    }

    const appIds = applications.map((a) => a._id);

    // 3. Financial records for these applications
    const financials = await ProjectFinancial.find({
      applicationId: { $in: appIds },
    }).lean();
    const finByAppId = new Map(financials.map((f) => [f.applicationId, f]));

    // 4. Candidate profiles
    const candidateEmails = [
      ...new Set(applications.map((a) => a.candidateEmail.toLowerCase())),
    ];
    const profiles = await CandidateProfile.find({
      email: { $in: candidateEmails },
    })
      .select("email name currentRole location")
      .lean();
    const profileMap = new Map(profiles.map((p) => [p.email.toLowerCase(), p]));

    // 5. Marketer company names (from Company collection by marketerId)
    const marketerIds = [
      ...new Set(financials.map((f) => f.employerId).filter(Boolean)),
    ];
    const companies = marketerIds.length
      ? await Company.find({ adminUserId: { $in: marketerIds } })
          .select("adminUserId name")
          .lean()
      : [];
    const companyByMarketerId = new Map(
      companies.map((c) => [c.adminUserId, c.name]),
    );

    // 6. Build candidate rows
    const candidates: VendorFinancialCandidate[] = [];
    let totalBilled = 0;
    let totalPay = 0;
    let totalHours = 0;
    let totalCredited = 0;
    let totalPending = 0;

    // Client pipeline aggregation
    const clientAgg: Record<
      string,
      {
        count: number;
        billed: number;
        paid: number;
        pending: number;
        hours: number;
      }
    > = {};

    for (const app of applications) {
      const job = jobMap.get(app.jobId);
      if (!job) continue;

      const fin = finByAppId.get(app._id);
      const profile = profileMap.get(app.candidateEmail.toLowerCase());

      const billed = fin ? toNum(fin.totalBilled) : 0;
      const pay = fin ? toNum(fin.totalPay) : 0;
      const hours = fin ? toNum(fin.hoursWorked) : 0;
      const paid = fin ? toNum(fin.amountPaid) : 0;
      const pending = fin ? Math.max(0, toNum(fin.amountPending)) : 0;
      const clientName = fin?.clientName || "—";

      totalBilled += billed;
      totalPay += pay;
      totalHours += hours;
      totalCredited += paid;
      totalPending += pending;

      // Client pipeline
      const cKey = clientName || "Unknown";
      if (!clientAgg[cKey]) {
        clientAgg[cKey] = {
          count: 0,
          billed: 0,
          paid: 0,
          pending: 0,
          hours: 0,
        };
      }
      clientAgg[cKey].count++;
      clientAgg[cKey].billed += billed;
      clientAgg[cKey].paid += paid;
      clientAgg[cKey].pending += pending;
      clientAgg[cKey].hours += hours;

      candidates.push({
        candidateId: app.candidateId,
        candidateName:
          fin?.candidateName || profile?.name || app.candidateEmail,
        candidateEmail: app.candidateEmail,
        currentRole: profile?.currentRole || "",
        location: profile?.location || job.location || "",
        jobTitle: job.title,
        jobType: job.jobType,
        jobSubType: job.jobSubType || "",
        isActive: job.isActive,
        clientName,
        implementationPartner: fin?.implementationPartner || "—",
        marketerCompanyName: fin
          ? companyByMarketerId.get(fin.employerId) || "—"
          : "—",
        billRate: fin ? toNum(fin.billRate) : 0,
        payRate: fin ? toNum(fin.payRate) : 0,
        hoursWorked: hours,
        totalBilled: billed,
        totalPay: pay,
        taxAmount: fin ? toNum(fin.taxAmount) : 0,
        cashAmount: fin ? toNum(fin.cashAmount) : 0,
        netPayable: fin ? toNum(fin.netPayable) : 0,
        amountPaid: paid,
        amountPending: pending,
        projectStart: fin?.projectStart?.toISOString() ?? null,
        projectEnd: fin?.projectEnd?.toISOString() ?? null,
        status: fin?.status || "pending",
      });
    }

    // Build client pipeline
    const clientPipeline: VendorClientPipeline[] = Object.entries(clientAgg)
      .map(([name, agg]) => ({
        clientName: name,
        candidateCount: agg.count,
        totalBilled: agg.billed,
        totalPaid: agg.paid,
        totalPending: agg.pending,
        totalHours: agg.hours,
      }))
      .sort((a, b) => b.totalBilled - a.totalBilled);

    res.json({
      candidates,
      clientPipeline,
      totals: {
        totalCandidates: candidates.length,
        totalBilled,
        totalPay,
        totalHours,
        totalCredited,
        totalPending,
      },
    });
  } catch (err) {
    next(err);
  }
}
