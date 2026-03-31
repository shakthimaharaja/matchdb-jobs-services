/**
 * timesheets.routes.ts
 *
 * Candidate creates / saves week timesheets; employer approves them.
 *
 * Routes (all under /api/jobs/timesheets):
 *   GET    /                    candidate Ã¢â‚¬â€ list own timesheets
 *   POST   /                    candidate Ã¢â‚¬â€ upsert draft timesheet
 *   PATCH  /:id/submit          candidate Ã¢â‚¬â€ submit (only on/after Saturday)
 *   GET    /pending             employer  Ã¢â‚¬â€ list submitted timesheets from roster
 *   PATCH  /:id/approve         employer  Ã¢â‚¬â€ approve
 *   PATCH  /:id/reject          employer  Ã¢â‚¬â€ reject
 */

import { Router, Request, Response, NextFunction } from "express";
import { Timesheet, EmployerCandidate, Company } from "../models";
import {
  requireCandidate,
  requireEmployer,
} from "../middleware/auth.middleware";

const router = Router();

// Ã¢â€â‚¬Ã¢â€â‚¬ Helpers Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

/** Monday 00:00:00 UTC of the week containing the given date */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay(); // 0=Sun
  const daysToMonday = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - daysToMonday);
  return d;
}

/** Friday 23:59:59 UTC of the same week */
function getWeekEnd(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setUTCDate(d.getUTCDate() + 4);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

/** Whether today >= Saturday of the week (i.e. week is done and submittable) */
function isSubmittable(weekStart: Date): boolean {
  const saturday = new Date(weekStart);
  saturday.setUTCDate(weekStart.getUTCDate() + 5);
  saturday.setUTCHours(0, 0, 0, 0);
  return new Date() >= saturday;
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Candidate routes Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

/**
 * GET /api/jobs/timesheets
 * Returns all timesheets for the logged-in candidate, newest first.
 */
router.get(
  "/",
  requireCandidate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.user!;
      const pageParam =
        typeof req.query.page === "string" ? req.query.page : "1";
      const limitParam =
        typeof req.query.limit === "string" ? req.query.limit : "25";
      const page = Math.max(1, Number.parseInt(pageParam, 10));
      const limit = Math.min(50, Math.max(1, Number.parseInt(limitParam, 10)));

      const [timesheets, total] = await Promise.all([
        Timesheet.find({ candidateId: userId })
          .sort({ weekStart: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Timesheet.countDocuments({ candidateId: userId }),
      ]);

      res.json({ data: timesheets, total, page, limit });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/jobs/timesheets
 * Create or update a draft timesheet for a specific week.
 * Body: { weekStart: ISO string, entries: [{date, day, hoursWorked, notes}] }
 *
 * If a timesheet already exists for that week:
 *   - draft Ã¢â€ â€™ update allowed
 *   - submitted/approved/rejected Ã¢â€ â€™ 409 conflict
 */
router.post(
  "/",
  requireCandidate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, email } = req.user!;

      const {
        weekStart: weekStartInput,
        entries,
        candidateName,
      } = req.body as {
        weekStart: string;
        entries: {
          date: string;
          day: string;
          hoursWorked: number;
          notes?: string;
        }[];
        candidateName?: string;
      };

      if (!weekStartInput || !Array.isArray(entries) || entries.length === 0) {
        res.status(400).json({ error: "weekStart and entries are required" });
        return;
      }

      const weekStart = getWeekStart(new Date(weekStartInput));
      const weekEnd = getWeekEnd(weekStart);
      const totalHours = entries.reduce(
        (sum, e) => sum + Number(e.hoursWorked || 0),
        0,
      );

      // Look up employer/company relationship (accepted invite)
      let employerId = "";
      let employerEmail = "";
      let companyId = "";
      let companyName = "";

      const roster = await EmployerCandidate.findOne({
        candidateEmail: email,
        inviteStatus: "accepted",
      })
        .sort({ createdAt: -1 })
        .lean();
      if (roster) {
        const comp = await Company.findOne({ _id: roster.companyId })
          .select("name adminEmail")
          .lean();
        employerId = roster.employerId;
        employerEmail = comp?.adminEmail || "";
        companyId = roster.companyId;
        companyName = comp?.name || "";
      }

      // Check existing
      const existing = await Timesheet.findOne({
        candidateId: userId,
        weekStart,
      }).lean();

      if (existing && existing.status !== "draft") {
        res.status(409).json({
          error: `Cannot edit a timesheet with status "${existing.status}"`,
        });
        return;
      }

      const upserted = await Timesheet.findOneAndUpdate(
        { candidateId: userId, weekStart },
        {
          $set: {
            candidateName: candidateName || existing?.candidateName || "",
            employerId,
            employerEmail,
            companyId,
            companyName,
            weekEnd,
            entries,
            totalHours,
          },
          $setOnInsert: {
            candidateId: userId,
            candidateEmail: email,
            weekStart,
            status: "draft",
          },
        },
        { upsert: true, new: true },
      ).lean();

      res.json(upserted);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /api/jobs/timesheets/:id/submit
 * Submit a draft timesheet. Only allowed on Saturday or later.
 */
router.patch(
  "/:id/submit",
  requireCandidate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.user!;
      const { id } = req.params;

      const ts = await Timesheet.findOne({ _id: id }).lean();
      if (!ts) {
        res.status(404).json({ error: "Timesheet not found" });
        return;
      }
      if (ts.candidateId !== userId) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      if (ts.status !== "draft") {
        res.status(409).json({ error: `Timesheet is already "${ts.status}"` });
        return;
      }
      if (!isSubmittable(ts.weekStart)) {
        res.status(400).json({
          error:
            "Timesheet can only be submitted on Saturday or later (after the week ends)",
        });
        return;
      }

      const updated = await Timesheet.findOneAndUpdate(
        { _id: id },
        { $set: { status: "submitted", submittedAt: new Date() } },
        { new: true },
      ).lean();
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

// Ã¢â€â‚¬Ã¢â€â‚¬ employer routes Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

/**
 * GET /api/jobs/timesheets/pending
 * Employer: list submitted timesheets from their roster candidates.
 */
router.get(
  "/pending",
  requireEmployer,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.user!;
      const status =
        typeof req.query.status === "string" ? req.query.status : "submitted";

      // Find roster candidates for this employer
      const rosterEmails = await EmployerCandidate.find({ employerId: userId })
        .select("candidateEmail")
        .lean();
      const emails = rosterEmails.map((r) => r.candidateEmail);

      const filter: any = { candidateEmail: { $in: emails } };
      if (status !== "all") filter.status = status;

      const timesheets = await Timesheet.find(filter)
        .sort({ status: 1, weekStart: -1 })
        .lean();

      res.json({ data: timesheets, total: timesheets.length });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /api/jobs/timesheets/:id/approve
 * employer approves a submitted timesheet.
 */
router.patch(
  "/:id/approve",
  requireEmployer,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.user!;
      const { id } = req.params;
      const { notes } = req.body as { notes?: string };

      const ts = await Timesheet.findOne({ _id: id }).lean();
      if (!ts) {
        res.status(404).json({ error: "Timesheet not found" });
        return;
      }
      if (ts.employerId !== userId) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      if (ts.status !== "submitted") {
        res.status(409).json({
          error: `Cannot approve a timesheet with status "${ts.status}"`,
        });
        return;
      }

      const updated = await Timesheet.findOneAndUpdate(
        { _id: id },
        {
          $set: {
            status: "approved",
            approvedAt: new Date(),
            approverNotes: notes || "",
          },
        },
        { new: true },
      ).lean();
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /api/jobs/timesheets/:id/reject
 * employer rejects a submitted timesheet (returns it to draft for correction).
 */
router.patch(
  "/:id/reject",
  requireEmployer,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.user!;
      const { id } = req.params;
      const { notes } = req.body as { notes?: string };

      const ts = await Timesheet.findOne({ _id: id }).lean();
      if (!ts) {
        res.status(404).json({ error: "Timesheet not found" });
        return;
      }
      if (ts.employerId !== userId) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      if (ts.status !== "submitted") {
        res.status(409).json({
          error: `Cannot reject a timesheet with status "${ts.status}"`,
        });
        return;
      }

      const updated = await Timesheet.findOneAndUpdate(
        { _id: id },
        {
          $set: {
            status: "draft",
            approverNotes: notes || "",
            submittedAt: null,
          },
        },
        { new: true },
      ).lean();
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
