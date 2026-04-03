import { Request, Response, NextFunction } from "express";
import { PayPeriod } from "../models/PayPeriod";
import { PayrollRecord } from "../models/PayrollRecord";
import { PayStub } from "../models/PayStub";
import { Timesheet } from "../models/Timesheet";
import { CompanyUser } from "../models/CompanyUser";

// ─── GET /api/jobs/payroll/periods ───────────────────────────────────────────

export async function listPayPeriods(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;
    const { status, page = "1", limit = "20" } = req.query;
    const filter: Record<string, unknown> = { companyId };
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [data, total] = await Promise.all([
      PayPeriod.find(filter)
        .sort({ periodStart: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      PayPeriod.countDocuments(filter),
    ]);

    res.json({ data, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/jobs/payroll/periods ──────────────────────────────────────────

export async function createPayPeriod(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;
    const { periodStart, periodEnd, frequency } = req.body as {
      periodStart: string;
      periodEnd: string;
      frequency: string;
    };

    const period = await PayPeriod.create({
      companyId,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      frequency: frequency || "BIWEEKLY",
      status: "DRAFT",
      createdBy: req.user!.userId,
    });

    res.status(201).json(period);
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/jobs/payroll/periods/:id ───────────────────────────────────────

export async function getPayPeriod(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;
    const period = await PayPeriod.findOne({
      _id: req.params.id,
      companyId,
    }).lean();
    if (!period) {
      res.status(404).json({ error: "Pay period not found" });
      return;
    }

    // Include payroll records for this period
    const records = await PayrollRecord.find({
      payPeriodId: period._id,
    }).lean();

    res.json({ ...period, records });
  } catch (err) {
    next(err);
  }
}

// ─── PUT /api/jobs/payroll/periods/:id ───────────────────────────────────────

export async function updatePayPeriod(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;
    const period = await PayPeriod.findOne({
      _id: req.params.id,
      companyId,
    });
    if (!period) {
      res.status(404).json({ error: "Pay period not found" });
      return;
    }
    if (period.status !== "DRAFT") {
      res.status(400).json({ error: "Only DRAFT pay periods can be edited" });
      return;
    }

    const { periodStart, periodEnd, frequency } = req.body;
    if (periodStart) period.periodStart = new Date(periodStart);
    if (periodEnd) period.periodEnd = new Date(periodEnd);
    if (frequency) period.frequency = frequency;
    await period.save();

    res.json(period);
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/jobs/payroll/periods/:id/submit ──────────────────────────────

export async function submitPayPeriod(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;
    const period = await PayPeriod.findOne({
      _id: req.params.id,
      companyId,
    });
    if (!period) {
      res.status(404).json({ error: "Pay period not found" });
      return;
    }
    if (period.status !== "DRAFT") {
      res
        .status(400)
        .json({ error: "Only DRAFT pay periods can be submitted" });
      return;
    }

    // Step 2: Pull approved timesheets for the period range and generate records
    const timesheets = await Timesheet.find({
      companyId,
      status: "approved",
      weekStart: { $gte: period.periodStart, $lte: period.periodEnd },
      payrollRecordId: { $in: ["", null] },
    }).lean();

    let totalGross = 0;
    let totalNet = 0;

    for (const ts of timesheets) {
      const grossPay = (ts.totalHours || 0) * (ts.payRate || 0);
      const record = await PayrollRecord.create({
        payPeriodId: period._id,
        companyId,
        payeeId: ts.candidateId,
        payeeType: "CANDIDATE",
        regularHours: ts.regularHours || 0,
        overtimeHours: ts.overtimeHours || 0,
        ptoHours: ts.ptoHours || 0,
        grossPay: grossPay,
        totalDeductions: 0,
        netPay: grossPay,
        status: "DRAFT",
        timesheetIds: [ts._id],
      });

      // Link timesheet to payroll record
      await Timesheet.updateOne(
        { _id: ts._id },
        { payrollRecordId: record._id },
      );

      totalGross += grossPay;
      totalNet += grossPay;
    }

    period.status = "IN_REVIEW";
    period.totalGross = totalGross;
    period.totalDeductions = 0;
    period.totalNet = totalNet;
    period.employeeCount = timesheets.length;
    await period.save();

    res.json(period);
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/jobs/payroll/periods/:id/approve ─────────────────────────────

export async function approvePayPeriod(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;
    const period = await PayPeriod.findOne({
      _id: req.params.id,
      companyId,
    });
    if (!period) {
      res.status(404).json({ error: "Pay period not found" });
      return;
    }
    if (period.status !== "IN_REVIEW") {
      res
        .status(400)
        .json({ error: "Only IN_REVIEW pay periods can be approved" });
      return;
    }

    period.status = "APPROVED";
    period.approvedBy = req.user!.userId;
    period.approvedAt = new Date();
    await period.save();

    res.json(period);
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/jobs/payroll/periods/:id/process ─────────────────────────────

export async function processPayPeriod(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;
    const period = await PayPeriod.findOne({
      _id: req.params.id,
      companyId,
    });
    if (!period) {
      res.status(404).json({ error: "Pay period not found" });
      return;
    }
    if (period.status !== "APPROVED") {
      res
        .status(400)
        .json({ error: "Only APPROVED pay periods can be processed" });
      return;
    }

    // Mark all records as PROCESSED and generate pay stubs
    const records = await PayrollRecord.find({ payPeriodId: period._id });
    for (const record of records) {
      record.status = "PROCESSED";
      record.paymentDate = new Date();
      await record.save();

      // Generate pay stub
      const stubCount = await PayStub.countDocuments({ companyId });
      await PayStub.create({
        payrollRecordId: record._id,
        payeeId: record.payeeId,
        payeeType: record.payeeType,
        companyId,
        payPeriodId: period._id,
        stubNumber: `PS-${String(stubCount + 1).padStart(6, "0")}`,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        grossPay: record.grossPay,
        totalDeductions: record.totalDeductions,
        netPay: record.netPay,
      });
    }

    period.status = "PROCESSED";
    period.processedAt = new Date();
    period.processedBy = req.user!.userId;
    await period.save();

    // Mark linked timesheets as processed
    const recordIds = records.map((r) => r._id);
    const allTimesheetIds = records.flatMap((r) => r.timesheetIds || []);
    if (allTimesheetIds.length) {
      await Timesheet.updateMany(
        { _id: { $in: allTimesheetIds } },
        { status: "processed" },
      );
    }

    res.json(period);
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/jobs/payroll/periods/:id/void ────────────────────────────────

export async function voidPayPeriod(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;
    const period = await PayPeriod.findOne({
      _id: req.params.id,
      companyId,
    });
    if (!period) {
      res.status(404).json({ error: "Pay period not found" });
      return;
    }
    if (period.status === "PROCESSED") {
      res.status(400).json({ error: "Processed pay periods cannot be voided" });
      return;
    }

    period.status = "VOIDED";
    await period.save();

    // Void all records
    await PayrollRecord.updateMany(
      { payPeriodId: period._id },
      { status: "VOIDED" },
    );

    res.json(period);
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/jobs/payroll/stubs/:personId ──────────────────────────────────

export async function getPayStubs(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const stubs = await PayStub.find({
      payeeId: req.params.personId,
    })
      .sort({ periodEnd: -1 })
      .lean();

    res.json({ data: stubs });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/jobs/payroll/my-stubs ─────────────────────────────────────────
// Candidate views their own pay stubs

export async function getMyPayStubs(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const stubs = await PayStub.find({
      payeeId: req.user!.userId,
    })
      .sort({ periodEnd: -1 })
      .lean();

    res.json({ data: stubs });
  } catch (err) {
    next(err);
  }
}
