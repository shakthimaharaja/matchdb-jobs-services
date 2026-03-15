/**
 * timesheets.routes.ts
 *
 * Candidate creates / saves week timesheets; marketer approves them.
 *
 * Routes (all under /api/jobs/timesheets):
 *   GET    /                    candidate — list own timesheets
 *   POST   /                    candidate — upsert draft timesheet
 *   PATCH  /:id/submit          candidate — submit (only on/after Saturday)
 *   GET    /pending             marketer  — list submitted timesheets from roster
 *   PATCH  /:id/approve         marketer  — approve
 *   PATCH  /:id/reject          marketer  — reject
 */

import { Router, Request, Response } from "express";
import { prisma } from "../config/prisma";
import { requireCandidate, requireMarketer } from "../middleware/auth.middleware";

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Candidate routes ──────────────────────────────────────────────────────────

/**
 * GET /api/jobs/timesheets
 * Returns all timesheets for the logged-in candidate, newest first.
 */
router.get("/", requireCandidate, async (req: Request, res: Response) => {
  const { userId } = req.user!;
  const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || "25"), 10)));

  const [timesheets, total] = await Promise.all([
    prisma.timesheet.findMany({
      where: { candidateId: userId },
      orderBy: { weekStart: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.timesheet.count({ where: { candidateId: userId } }),
  ]);

  res.json({ data: timesheets, total, page, limit });
});

/**
 * POST /api/jobs/timesheets
 * Create or update a draft timesheet for a specific week.
 * Body: { weekStart: ISO string, entries: [{date, day, hoursWorked, notes}] }
 *
 * If a timesheet already exists for that week:
 *   - draft → update allowed
 *   - submitted/approved/rejected → 409 conflict
 */
router.post("/", requireCandidate, async (req: Request, res: Response) => {
  const { userId, email } = req.user!;

  const { weekStart: weekStartInput, entries, candidateName } = req.body as {
    weekStart: string;
    entries: { date: string; day: string; hoursWorked: number; notes?: string }[];
    candidateName?: string;
  };

  if (!weekStartInput || !Array.isArray(entries) || entries.length === 0) {
    res.status(400).json({ error: "weekStart and entries are required" });
    return;
  }

  const weekStart = getWeekStart(new Date(weekStartInput));
  const weekEnd = getWeekEnd(weekStart);
  const totalHours = entries.reduce((sum, e) => sum + Number(e.hoursWorked || 0), 0);

  // Look up marketer/company relationship (accepted invite)
  let marketerId = "";
  let marketerEmail = "";
  let companyId = "";
  let companyName = "";

  const roster = await prisma.marketerCandidate.findFirst({
    where: { candidateEmail: email, inviteStatus: "accepted" },
    include: { company: true },
    orderBy: { createdAt: "desc" },
  });
  if (roster) {
    marketerId = roster.marketerId;
    marketerEmail = roster.company?.marketerEmail || "";
    companyId = roster.companyId;
    companyName = roster.company?.name || "";
  }

  // Check existing
  const existing = await prisma.timesheet.findUnique({
    where: { candidateId_weekStart: { candidateId: userId, weekStart } },
  });

  if (existing && existing.status !== "draft") {
    res.status(409).json({
      error: `Cannot edit a timesheet with status "${existing.status}"`,
    });
    return;
  }

  const upserted = await prisma.timesheet.upsert({
    where: { candidateId_weekStart: { candidateId: userId, weekStart } },
    create: {
      candidateId: userId,
      candidateEmail: email,
      candidateName: candidateName || "",
      marketerId,
      marketerEmail,
      companyId,
      companyName,
      weekStart,
      weekEnd,
      entries,
      totalHours,
      status: "draft",
    },
    update: {
      candidateName: candidateName || existing?.candidateName || "",
      marketerId,
      marketerEmail,
      companyId,
      companyName,
      weekEnd,
      entries,
      totalHours,
    },
  });

  res.json(upserted);
});

/**
 * PATCH /api/jobs/timesheets/:id/submit
 * Submit a draft timesheet. Only allowed on Saturday or later.
 */
router.patch("/:id/submit", requireCandidate, async (req: Request, res: Response) => {
  const { userId } = req.user!;
  const { id } = req.params;

  const ts = await prisma.timesheet.findUnique({ where: { id } });
  if (!ts) { res.status(404).json({ error: "Timesheet not found" }); return; }
  if (ts.candidateId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }
  if (ts.status !== "draft") {
    res.status(409).json({ error: `Timesheet is already "${ts.status}"` });
    return;
  }
  if (!isSubmittable(ts.weekStart)) {
    res.status(400).json({
      error: "Timesheet can only be submitted on Saturday or later (after the week ends)",
    });
    return;
  }

  const updated = await prisma.timesheet.update({
    where: { id },
    data: { status: "submitted", submittedAt: new Date() },
  });
  res.json(updated);
});

// ── Marketer routes ───────────────────────────────────────────────────────────

/**
 * GET /api/jobs/timesheets/pending
 * Marketer: list submitted timesheets from their roster candidates.
 */
router.get("/pending", requireMarketer, async (req: Request, res: Response) => {
  const { userId } = req.user!;
  const status = String(req.query.status || "submitted");

  // Find roster candidates for this marketer
  const rosterEmails = await prisma.marketerCandidate.findMany({
    where: { marketerId: userId },
    select: { candidateEmail: true },
  });
  const emails = rosterEmails.map((r) => r.candidateEmail);

  const timesheets = await prisma.timesheet.findMany({
    where: {
      candidateEmail: { in: emails },
      ...(status === "all" ? {} : { status }),
    },
    orderBy: [{ status: "asc" }, { weekStart: "desc" }],
  });

  res.json({ data: timesheets, total: timesheets.length });
});

/**
 * PATCH /api/jobs/timesheets/:id/approve
 * Marketer approves a submitted timesheet.
 */
router.patch("/:id/approve", requireMarketer, async (req: Request, res: Response) => {
  const { userId } = req.user!;
  const { id } = req.params;
  const { notes } = req.body as { notes?: string };

  const ts = await prisma.timesheet.findUnique({ where: { id } });
  if (!ts) { res.status(404).json({ error: "Timesheet not found" }); return; }
  if (ts.marketerId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }
  if (ts.status !== "submitted") {
    res.status(409).json({ error: `Cannot approve a timesheet with status "${ts.status}"` });
    return;
  }

  const updated = await prisma.timesheet.update({
    where: { id },
    data: { status: "approved", approvedAt: new Date(), approverNotes: notes || "" },
  });
  res.json(updated);
});

/**
 * PATCH /api/jobs/timesheets/:id/reject
 * Marketer rejects a submitted timesheet (returns it to draft for correction).
 */
router.patch("/:id/reject", requireMarketer, async (req: Request, res: Response) => {
  const { userId } = req.user!;
  const { id } = req.params;
  const { notes } = req.body as { notes?: string };

  const ts = await prisma.timesheet.findUnique({ where: { id } });
  if (!ts) { res.status(404).json({ error: "Timesheet not found" }); return; }
  if (ts.marketerId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }
  if (ts.status !== "submitted") {
    res.status(409).json({ error: `Cannot reject a timesheet with status "${ts.status}"` });
    return;
  }

  const updated = await prisma.timesheet.update({
    where: { id },
    data: { status: "draft", approverNotes: notes || "", submittedAt: null },
  });
  res.json(updated);
});

export default router;
