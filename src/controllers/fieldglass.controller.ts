import { Request, Response, NextFunction } from "express";
import { TimeEntry } from "../models/TimeEntry";
import { Timesheet } from "../models/Timesheet";
import { TimesheetAuditLog } from "../models/TimesheetAuditLog";
import { LeaveBalance } from "../models/LeaveBalance";
import { ClientRateCard } from "../models/ClientRateCard";

// ─── GET /api/jobs/timesheets/:id/entries ───────────────────────────────────

export async function getTimeEntries(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const entries = await TimeEntry.find({
      timesheetId: req.params.id,
    })
      .sort({ entryDate: 1 })
      .lean();

    res.json({ data: entries });
  } catch (err) {
    next(err);
  }
}

// ─── PUT /api/jobs/timesheets/:id/entries ───────────────────────────────────
// Batch upsert daily hours for a timesheet (7 entries max, one per day)

export async function upsertTimeEntries(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const timesheet = await Timesheet.findById(req.params.id);
    if (!timesheet) {
      res.status(404).json({ error: "Timesheet not found" });
      return;
    }
    if (timesheet.status !== "draft") {
      res.status(400).json({ error: "Only DRAFT timesheets can be edited" });
      return;
    }

    const entries = req.body.entries as Array<{
      entryDate: string;
      dayOfWeek: string;
      regularHours?: number;
      overtimeHours?: number;
      ptoHours?: number;
      sickHours?: number;
      holidayHours?: number;
      notes?: string;
    }>;

    const savedEntries = [];
    for (const entry of entries) {
      const existing = await TimeEntry.findOne({
        timesheetId: timesheet._id,
        entryDate: new Date(entry.entryDate),
      });

      if (existing) {
        if (entry.regularHours !== undefined)
          existing.regularHours = entry.regularHours;
        if (entry.overtimeHours !== undefined)
          existing.overtimeHours = entry.overtimeHours;
        if (entry.ptoHours !== undefined) existing.ptoHours = entry.ptoHours;
        if (entry.sickHours !== undefined) existing.sickHours = entry.sickHours;
        if (entry.holidayHours !== undefined)
          existing.holidayHours = entry.holidayHours;
        if (entry.notes !== undefined) existing.notes = entry.notes;
        await existing.save(); // pre-save hook computes totalHours
        savedEntries.push(existing);
      } else {
        const created = await TimeEntry.create({
          timesheetId: timesheet._id,
          entryDate: new Date(entry.entryDate),
          dayOfWeek: entry.dayOfWeek,
          regularHours: entry.regularHours || 0,
          overtimeHours: entry.overtimeHours || 0,
          ptoHours: entry.ptoHours || 0,
          sickHours: entry.sickHours || 0,
          holidayHours: entry.holidayHours || 0,
          notes: entry.notes || "",
        });
        savedEntries.push(created);
      }
    }

    // Recompute timesheet totals from all entries
    const allEntries = await TimeEntry.find({
      timesheetId: timesheet._id,
    }).lean();

    timesheet.regularHours = allEntries.reduce(
      (sum, e) => sum + e.regularHours,
      0,
    );
    timesheet.overtimeHours = allEntries.reduce(
      (sum, e) => sum + e.overtimeHours,
      0,
    );
    timesheet.ptoHours = allEntries.reduce((sum, e) => sum + e.ptoHours, 0);
    timesheet.sickHours = allEntries.reduce((sum, e) => sum + e.sickHours, 0);
    timesheet.holidayHours = allEntries.reduce(
      (sum, e) => sum + e.holidayHours,
      0,
    );
    timesheet.totalHours = allEntries.reduce((sum, e) => sum + e.totalHours, 0);

    // Snapshot rates from rate card if available
    if (timesheet.companyId && timesheet.candidateId) {
      const rateCard = await ClientRateCard.findOne({
        companyId: timesheet.companyId,
        candidateId: timesheet.candidateId,
        isActive: true,
      }).lean();
      if (rateCard) {
        timesheet.payRate = rateCard.payRate;
        timesheet.billRate = rateCard.billRate;
        timesheet.estimatedPay = timesheet.totalHours * rateCard.payRate;
        timesheet.estimatedBill = timesheet.totalHours * rateCard.billRate;
        timesheet.estimatedMargin =
          timesheet.estimatedBill - timesheet.estimatedPay;
      }
    }

    await timesheet.save();

    // Audit log
    await TimesheetAuditLog.create({
      timesheetId: timesheet._id,
      action: "ENTRY_UPDATED",
      performedBy: req.user!.userId,
      newValue: JSON.stringify({
        totalHours: timesheet.totalHours,
        regularHours: timesheet.regularHours,
        overtimeHours: timesheet.overtimeHours,
      }),
    });

    res.json({ entries: savedEntries, timesheet });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/jobs/timesheets/:id/submit ───────────────────────────────────

export async function submitTimesheet(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const timesheet = await Timesheet.findById(req.params.id);
    if (!timesheet) {
      res.status(404).json({ error: "Timesheet not found" });
      return;
    }
    if (timesheet.status !== "draft") {
      res.status(400).json({ error: "Only DRAFT timesheets can be submitted" });
      return;
    }
    if (timesheet.totalHours === 0) {
      res.status(400).json({ error: "Cannot submit a timesheet with 0 hours" });
      return;
    }

    timesheet.status = "submitted";
    timesheet.submittedAt = new Date();
    await timesheet.save();

    await TimesheetAuditLog.create({
      timesheetId: timesheet._id,
      action: "SUBMITTED",
      performedBy: req.user!.userId,
    });

    res.json(timesheet);
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/jobs/timesheets/:id/approve ──────────────────────────────────

export async function approveTimesheet(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const timesheet = await Timesheet.findById(req.params.id);
    if (!timesheet) {
      res.status(404).json({ error: "Timesheet not found" });
      return;
    }
    if (timesheet.status !== "submitted") {
      res
        .status(400)
        .json({ error: "Only SUBMITTED timesheets can be approved" });
      return;
    }

    timesheet.status = "approved";
    timesheet.approvedBy = req.user!.userId;
    timesheet.approvedAt = new Date();
    await timesheet.save();

    await TimesheetAuditLog.create({
      timesheetId: timesheet._id,
      action: "APPROVED",
      performedBy: req.user!.userId,
    });

    // Deduct PTO/sick hours from leave balances
    if (timesheet.ptoHours > 0 || timesheet.sickHours > 0) {
      const year = new Date(timesheet.weekStart).getFullYear();
      if (timesheet.ptoHours > 0) {
        await LeaveBalance.findOneAndUpdate(
          {
            personId: timesheet.candidateId,
            leaveType: "PTO",
            year,
          },
          { $inc: { used: timesheet.ptoHours } },
        );
      }
      if (timesheet.sickHours > 0) {
        await LeaveBalance.findOneAndUpdate(
          {
            personId: timesheet.candidateId,
            leaveType: "SICK",
            year,
          },
          { $inc: { used: timesheet.sickHours } },
        );
      }
    }

    res.json(timesheet);
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/jobs/timesheets/:id/reject ───────────────────────────────────

export async function rejectTimesheet(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const timesheet = await Timesheet.findById(req.params.id);
    if (!timesheet) {
      res.status(404).json({ error: "Timesheet not found" });
      return;
    }
    if (timesheet.status !== "submitted") {
      res
        .status(400)
        .json({ error: "Only SUBMITTED timesheets can be rejected" });
      return;
    }

    const { reason } = req.body as { reason?: string };
    timesheet.status = "rejected";
    timesheet.rejectedBy = req.user!.userId;
    timesheet.rejectedAt = new Date();
    timesheet.rejectionNote = reason || "";
    await timesheet.save();

    await TimesheetAuditLog.create({
      timesheetId: timesheet._id,
      action: "REJECTED",
      performedBy: req.user!.userId,
      notes: reason || "",
    });

    // Return to draft so the submitter can fix and resubmit
    timesheet.status = "draft";
    await timesheet.save();

    res.json(timesheet);
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/jobs/timesheets/pending-approval ──────────────────────────────

export async function getPendingApprovals(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;
    const timesheets = await Timesheet.find({
      companyId,
      status: "submitted",
    })
      .sort({ submittedAt: -1 })
      .lean();

    res.json({ data: timesheets, total: timesheets.length });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/jobs/leave/balances/:personId ─────────────────────────────────

export async function getLeaveBalances(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const balances = await LeaveBalance.find({
      personId: req.params.personId,
      year,
    }).lean();
    res.json({ data: balances });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/jobs/leave/my-balances ────────────────────────────────────────
// Candidate views their own leave balances

export async function getMyLeaveBalances(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const balances = await LeaveBalance.find({
      personId: req.user!.userId,
      year,
    }).lean();
    res.json({ data: balances });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/jobs/leave/request ───────────────────────────────────────────
// Worker/Candidate requests PTO (creates a timesheet entry with PTO hours)

export async function requestLeave(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { leaveType, startDate, hours, notes } = req.body as {
      leaveType: string;
      startDate: string;
      hours: number;
      notes?: string;
    };

    const year = new Date(startDate).getFullYear();
    const balance = await LeaveBalance.findOne({
      personId: req.user!.userId,
      leaveType,
      year,
    });

    if (!balance) {
      res
        .status(400)
        .json({ error: `No ${leaveType} balance found for ${year}` });
      return;
    }

    // Save balance will recompute remaining via pre-save hook
    if (balance.remaining < hours) {
      res.status(400).json({
        error: `Insufficient ${leaveType} balance. Available: ${balance.remaining} hrs`,
      });
      return;
    }

    // Leave request is tracked; actual deduction happens on timesheet approval
    res.json({
      message:
        "Leave request noted. Add hours to your weekly timesheet for processing.",
      leaveType,
      requestedHours: hours,
      availableBalance: balance.remaining,
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/jobs/leave/balances ──────────────────────────────────────────
// Admin sets leave balances for a person

export async function setLeaveBalance(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;
    const { personId, personType, leaveType, year, totalAllotted, carryOver } =
      req.body as {
        personId: string;
        personType: string;
        leaveType: string;
        year: number;
        totalAllotted: number;
        carryOver?: number;
      };

    const balance = await LeaveBalance.findOneAndUpdate(
      { companyId, personId, leaveType, year },
      {
        companyId,
        personId,
        personType: personType || "WORKER",
        leaveType,
        year,
        totalAllotted,
        carryOver: carryOver || 0,
      },
      { upsert: true, new: true },
    );

    // Re-save to trigger pre-save hook for remaining calculation
    await balance.save();

    res.json(balance);
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/jobs/leave/calendar ───────────────────────────────────────────

export async function getLeaveCalendar(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;
    const { month, year } = req.query as { month?: string; year?: string };

    const targetYear = Number(year) || new Date().getFullYear();
    const targetMonth = Number(month) || new Date().getMonth() + 1;

    // Find timesheets in the target month that have PTO/sick hours
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0);

    const timesheets = await Timesheet.find({
      companyId,
      weekStart: { $gte: startDate, $lte: endDate },
      $or: [
        { ptoHours: { $gt: 0 } },
        { sickHours: { $gt: 0 } },
        { holidayHours: { $gt: 0 } },
      ],
    })
      .select(
        "candidateId candidateName weekStart ptoHours sickHours holidayHours",
      )
      .lean();

    res.json({ data: timesheets, month: targetMonth, year: targetYear });
  } catch (err) {
    next(err);
  }
}
