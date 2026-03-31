import { Request, Response, NextFunction } from "express";
import { Application, ProjectFinancial } from "../models";

// â”€â”€â”€ US State Tax Rates (2024â€“2025 approximate top marginal income tax rates) â”€
// States with no income tax: AK, FL, NV, NH, SD, TN, TX, WA, WY
// Source: compiled from public state tax authority data

const US_STATE_TAX: Record<string, { name: string; taxPct: number }> = {
  AL: { name: "Alabama", taxPct: 5 },
  AK: { name: "Alaska", taxPct: 0 },
  AZ: { name: "Arizona", taxPct: 2.5 },
  AR: { name: "Arkansas", taxPct: 4.4 },
  CA: { name: "California", taxPct: 13.3 },
  CO: { name: "Colorado", taxPct: 4.4 },
  CT: { name: "Connecticut", taxPct: 6.99 },
  DE: { name: "Delaware", taxPct: 6.6 },
  FL: { name: "Florida", taxPct: 0 },
  GA: { name: "Georgia", taxPct: 5.49 },
  HI: { name: "Hawaii", taxPct: 11 },
  ID: { name: "Idaho", taxPct: 5.8 },
  IL: { name: "Illinois", taxPct: 4.95 },
  IN: { name: "Indiana", taxPct: 3.05 },
  IA: { name: "Iowa", taxPct: 5.7 },
  KS: { name: "Kansas", taxPct: 5.7 },
  KY: { name: "Kentucky", taxPct: 4 },
  LA: { name: "Louisiana", taxPct: 4.25 },
  ME: { name: "Maine", taxPct: 7.15 },
  MD: { name: "Maryland", taxPct: 5.75 },
  MA: { name: "Massachusetts", taxPct: 5 },
  MI: { name: "Michigan", taxPct: 4.25 },
  MN: { name: "Minnesota", taxPct: 9.85 },
  MS: { name: "Mississippi", taxPct: 5 },
  MO: { name: "Missouri", taxPct: 4.95 },
  MT: { name: "Montana", taxPct: 6.75 },
  NE: { name: "Nebraska", taxPct: 5.84 },
  NV: { name: "Nevada", taxPct: 0 },
  NH: { name: "New Hampshire", taxPct: 0 },
  NJ: { name: "New Jersey", taxPct: 10.75 },
  NM: { name: "New Mexico", taxPct: 5.9 },
  NY: { name: "New York", taxPct: 10.9 },
  NC: { name: "North Carolina", taxPct: 4.5 },
  ND: { name: "North Dakota", taxPct: 2.5 },
  OH: { name: "Ohio", taxPct: 3.5 },
  OK: { name: "Oklahoma", taxPct: 4.75 },
  OR: { name: "Oregon", taxPct: 9.9 },
  PA: { name: "Pennsylvania", taxPct: 3.07 },
  RI: { name: "Rhode Island", taxPct: 5.99 },
  SC: { name: "South Carolina", taxPct: 6.4 },
  SD: { name: "South Dakota", taxPct: 0 },
  TN: { name: "Tennessee", taxPct: 0 },
  TX: { name: "Texas", taxPct: 0 },
  UT: { name: "Utah", taxPct: 4.65 },
  VT: { name: "Vermont", taxPct: 8.75 },
  VA: { name: "Virginia", taxPct: 5.75 },
  WA: { name: "Washington", taxPct: 0 },
  WV: { name: "West Virginia", taxPct: 6.5 },
  WI: { name: "Wisconsin", taxPct: 7.65 },
  WY: { name: "Wyoming", taxPct: 0 },
  DC: { name: "District of Columbia", taxPct: 10.75 },
};

// â”€â”€â”€ Helper: compute derived financial fields â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function computeFinancials(input: {
  billRate: number;
  payRate: number;
  hoursWorked: number;
  stateTaxPct: number;
  cashPct: number;
  amountPaid: number;
}) {
  const totalBilled = input.billRate * input.hoursWorked;
  const totalPay = input.payRate * input.hoursWorked;
  const taxAmount = (totalPay * input.stateTaxPct) / 100;
  const cashAmount = (totalPay * input.cashPct) / 100;
  const netPayable = totalPay - taxAmount - cashAmount;
  const amountPending = netPayable - input.amountPaid;

  return {
    totalBilled,
    totalPay,
    taxAmount,
    cashAmount,
    netPayable,
    amountPending,
  };
}

// â”€â”€â”€ GET /api/jobs/marketer/financials/states â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Returns the list of US states with their tax rates.
 */
export async function getStateTaxRates(
  _req: Request,
  res: Response,
): Promise<void> {
  const states = Object.entries(US_STATE_TAX).map(([code, info]) => ({
    code,
    name: info.name,
    taxPct: info.taxPct,
  }));
  states.sort((a, b) => a.name.localeCompare(b.name));
  res.json(states);
}

// â”€â”€â”€ GET /api/jobs/marketer/financials/:applicationId â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Get the financial record for a specific application (by marketer).
 */
export async function getProjectFinancial(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const record = await ProjectFinancial.findOne({
      applicationId: req.params.applicationId,
      employerId: req.user!.userId,
    }).lean();

    if (!record) {
      res.json(null);
      return;
    }

    res.json(formatFinancial(record));
  } catch (err) {
    next(err);
  }
}

// â”€â”€â”€ GET /api/jobs/marketer/financials/candidate/:candidateId â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Get all financial records for a candidate under this marketer.
 */
export async function getCandidateFinancials(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const records = await ProjectFinancial.find({
      employerId: req.user!.userId,
      candidateId: req.params.candidateId,
    })
      .sort({ createdAt: -1 })
      .lean();

    // Enrich with application + job info
    const applicationIds = records.map((r) => r.applicationId);
    const applications = await Application.find({
      _id: { $in: applicationIds },
    })
      .select("_id jobTitle status jobId")
      .lean();

    const { Job } = await import("../models");
    const jobIds = applications.map((a) => a.jobId).filter(Boolean);
    const jobs = await Job.find({ _id: { $in: jobIds } })
      .select("_id title vendorEmail location jobType jobSubType isActive")
      .lean();
    const jobMap = new Map(jobs.map((j) => [j._id, j]));
    const appMap = new Map(applications.map((a) => [a._id, a]));

    res.json(
      records.map((r) => {
        const app = appMap.get(r.applicationId);
        const job = app?.jobId ? jobMap.get(app.jobId) : null;
        return {
          ...formatFinancial(r),
          job_title: job?.title ?? app?.jobTitle ?? "",
          vendor_email: job?.vendorEmail ?? "",
          location: job?.location ?? "",
          job_type: job?.jobType ?? "",
          job_sub_type: job?.jobSubType ?? "",
          is_active: job?.isActive ?? false,
          application_status: app?.status ?? "",
        };
      }),
    );
  } catch (err) {
    next(err);
  }
}

// â”€â”€â”€ POST /api/jobs/marketer/financials â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Create or update financial data for an application.
 * Body: {
 *   applicationId, candidateId?, candidateEmail?,
 *   billRate, payRate, hoursWorked, projectStart?, projectEnd?,
 *   stateCode, cashPct, amountPaid, notes?
 * }
 */
export async function upsertProjectFinancial(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const {
      applicationId,
      candidateId,
      candidateEmail,
      billRate,
      payRate,
      hoursWorked,
      projectStart,
      projectEnd,
      stateCode,
      cashPct,
      amountPaid,
      notes,
      clientName,
      vendorCompanyName,
      implementationPartner,
      pocName,
      pocEmail,
    } = req.body as {
      applicationId: string;
      candidateId?: string;
      candidateEmail?: string;
      billRate: number;
      payRate: number;
      hoursWorked: number;
      projectStart?: string;
      projectEnd?: string;
      stateCode: string;
      cashPct: number;
      amountPaid: number;
      notes?: string;
      clientName?: string;
      vendorCompanyName?: string;
      implementationPartner?: string;
      pocName?: string;
      pocEmail?: string;
    };

    if (!applicationId) {
      res.status(400).json({ error: "applicationId is required" });
      return;
    }

    // Validate the application exists
    const app = await Application.findById(applicationId).lean();
    if (!app) {
      res.status(404).json({ error: "Application not found" });
      return;
    }

    // Look up state tax rate
    const stateUpper = (stateCode || "").toUpperCase().trim();
    const stateInfo = US_STATE_TAX[stateUpper];
    const stateTaxPct = stateInfo?.taxPct ?? 0;

    const computed = computeFinancials({
      billRate: Number(billRate) || 0,
      payRate: Number(payRate) || 0,
      hoursWorked: Number(hoursWorked) || 0,
      stateTaxPct,
      cashPct: Number(cashPct) || 0,
      amountPaid: Number(amountPaid) || 0,
    });

    const data = {
      candidateId: candidateId || app.candidateId,
      candidateEmail: candidateEmail || app.candidateEmail,
      billRate: Number(billRate) || 0,
      payRate: Number(payRate) || 0,
      hoursWorked: Number(hoursWorked) || 0,
      projectStart: projectStart ? new Date(projectStart) : null,
      projectEnd: projectEnd ? new Date(projectEnd) : null,
      stateCode: stateUpper,
      stateTaxPct,
      cashPct: Number(cashPct) || 0,
      totalBilled: computed.totalBilled,
      totalPay: computed.totalPay,
      taxAmount: computed.taxAmount,
      cashAmount: computed.cashAmount,
      netPayable: computed.netPayable,
      amountPaid: Number(amountPaid) || 0,
      amountPending: computed.amountPending,
      notes: notes ?? "",
      clientName: clientName ?? "",
      vendorCompanyName: vendorCompanyName ?? "",
      implementationPartner: implementationPartner ?? "",
      pocName: pocName ?? "",
      pocEmail: pocEmail ?? "",
    };

    const record = await ProjectFinancial.findOneAndUpdate(
      { applicationId, employerId: req.user!.userId },
      { $set: { ...data, applicationId, employerId: req.user!.userId } },
      { upsert: true, new: true },
    ).lean();

    res.json(formatFinancial(record));
  } catch (err) {
    next(err);
  }
}

// â”€â”€â”€ DELETE /api/jobs/marketer/financials/:applicationId â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function deleteProjectFinancial(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await ProjectFinancial.deleteMany({
      applicationId: req.params.applicationId,
      employerId: req.user!.userId,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// â”€â”€â”€ GET /api/jobs/marketer/financials/summary â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Returns aggregate financial summary across all projects for this marketer.
 */
export async function getFinancialSummary(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const [agg] = await ProjectFinancial.aggregate([
      { $match: { employerId: req.user!.userId } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalBilled: { $sum: "$totalBilled" },
          totalPay: { $sum: "$totalPay" },
          taxAmount: { $sum: "$taxAmount" },
          cashAmount: { $sum: "$cashAmount" },
          netPayable: { $sum: "$netPayable" },
          amountPaid: { $sum: "$amountPaid" },
          amountPending: { $sum: "$amountPending" },
          hoursWorked: { $sum: "$hoursWorked" },
        },
      },
    ]);

    res.json({
      count: agg?.count ?? 0,
      totalBilled: agg?.totalBilled ?? 0,
      totalPay: agg?.totalPay ?? 0,
      taxAmount: agg?.taxAmount ?? 0,
      cashAmount: agg?.cashAmount ?? 0,
      netPayable: agg?.netPayable ?? 0,
      amountPaid: agg?.amountPaid ?? 0,
      amountPending: agg?.amountPending ?? 0,
      hoursWorked: agg?.hoursWorked ?? 0,
    });
  } catch (err) {
    next(err);
  }
}

// â”€â”€â”€ Helper to format Decimal to number â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function formatFinancial(r: any) {
  return {
    id: r._id,
    applicationId: r.applicationId,
    employerId: r.employerId,
    candidateId: r.candidateId,
    candidateEmail: r.candidateEmail,
    billRate: toNum(r.billRate),
    payRate: toNum(r.payRate),
    hoursWorked: toNum(r.hoursWorked),
    projectStart: r.projectStart?.toISOString?.() ?? r.projectStart ?? null,
    projectEnd: r.projectEnd?.toISOString?.() ?? r.projectEnd ?? null,
    stateCode: r.stateCode,
    stateTaxPct: toNum(r.stateTaxPct),
    cashPct: toNum(r.cashPct),
    totalBilled: toNum(r.totalBilled),
    totalPay: toNum(r.totalPay),
    taxAmount: toNum(r.taxAmount),
    cashAmount: toNum(r.cashAmount),
    netPayable: toNum(r.netPayable),
    amountPaid: toNum(r.amountPaid),
    amountPending: toNum(r.amountPending),
    notes: r.notes,
    clientName: r.clientName ?? "",
    vendorCompanyName: r.vendorCompanyName ?? "",
    implementationPartner: r.implementationPartner ?? "",
    pocName: r.pocName ?? "",
    pocEmail: r.pocEmail ?? "",
    createdAt: r.createdAt?.toISOString?.() ?? r.createdAt ?? "",
    updatedAt: r.updatedAt?.toISOString?.() ?? r.updatedAt ?? "",
  };
}

function toNum(v: number | null | undefined): number {
  if (v == null) return 0;
  return Number(v);
}
