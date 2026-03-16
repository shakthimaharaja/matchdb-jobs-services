/**
 * interviews.routes.ts
 *
 * Vendor sends interview/screening-call invites to candidates; candidates can
 * accept or decline.  A Google Meet link is auto-generated for every invite.
 *
 * Routes (all under /api/jobs/interviews):
 *   POST  /               vendor  — send invite (generates Meet link + email)
 *   GET   /sent           vendor  — list own sent invites
 *   GET   /received       candidate — list received invites
 *   PATCH /:id/respond    candidate — accept | decline
 */

import { Router, Request, Response } from "express";
import { InterviewInvite } from "../models";
import { requireVendor, requireCandidate } from "../middleware/auth.middleware";
import { sendInterviewInviteEmail } from "../services/sendgrid.service";
import { GOOGLE_MEET_BASE } from "../constants";

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Generate a Google Meet-style room code: abc-defg-hij */
function generateMeetLink(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  const seg = (n: number) =>
    Array.from({ length: n }, () => chars[Math.floor(Math.random() * 26)]).join(
      "",
    );
  return `${GOOGLE_MEET_BASE}/${seg(3)}-${seg(4)}-${seg(3)}`;
}

// ── Vendor routes ─────────────────────────────────────────────────────────────

/**
 * POST /api/jobs/interviews
 * Vendor sends a screening-call invite to a candidate.
 * Body: { candidateEmail, candidateName?, jobId?, jobTitle?, proposedAt?, message? }
 */
router.post("/", requireVendor, async (req: Request, res: Response) => {
  const { userId, email: vendorEmail, username: vendorName } = req.user!;

  const {
    candidateEmail,
    candidateName = "",
    jobId = "",
    jobTitle = "",
    proposedAt,
    message = "",
  } = req.body as {
    candidateEmail: string;
    candidateName?: string;
    jobId?: string;
    jobTitle?: string;
    proposedAt?: string;
    message?: string;
  };

  if (!candidateEmail) {
    res.status(400).json({ error: "candidateEmail is required" });
    return;
  }

  const meetLink = generateMeetLink();

  const invite = await InterviewInvite.create({
    vendorId: userId,
    vendorEmail: vendorEmail || "",
    vendorName: vendorName || vendorEmail?.split("@")[0] || "",
    candidateEmail,
    candidateName,
    jobId,
    jobTitle,
    meetLink,
    proposedAt: proposedAt ? new Date(proposedAt) : null,
    message,
    status: "pending",
  });

  // Fire-and-forget email (don't let email failure block the API response)
  sendInterviewInviteEmail({
    to: candidateEmail,
    toName: candidateName || candidateEmail.split("@")[0],
    fromName: vendorName || vendorEmail?.split("@")[0] || "Recruiter",
    fromEmail: vendorEmail || "",
    jobTitle: jobTitle || "Position",
    meetLink,
    proposedAt,
    message,
  }).catch((err) => {
    console.error("[interviews] email error:", err?.message ?? err);
  });

  res.status(201).json(invite.toObject());
});

/**
 * GET /api/jobs/interviews/sent
 * Vendor: list their own sent invites, newest first.
 */
router.get("/sent", requireVendor, async (req: Request, res: Response) => {
  const { userId } = req.user!;

  const invites = await InterviewInvite.find({ vendorId: userId })
    .sort({ createdAt: -1 })
    .lean();

  res.json({ data: invites, total: invites.length });
});

// ── Candidate routes ──────────────────────────────────────────────────────────

/**
 * GET /api/jobs/interviews/received
 * Candidate: list all invites received, newest first.
 */
router.get(
  "/received",
  requireCandidate,
  async (req: Request, res: Response) => {
    const { email } = req.user!;

    const invites = await InterviewInvite.find({ candidateEmail: email })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ data: invites, total: invites.length });
  },
);

/**
 * PATCH /api/jobs/interviews/:id/respond
 * Candidate accepts or declines an invite.
 * Body: { action: "accept" | "decline", note? }
 */
router.patch(
  "/:id/respond",
  requireCandidate,
  async (req: Request, res: Response) => {
    const { email } = req.user!;
    const { id } = req.params;
    const { action, note = "" } = req.body as {
      action: "accept" | "decline";
      note?: string;
    };

    if (action !== "accept" && action !== "decline") {
      res.status(400).json({ error: 'action must be "accept" or "decline"' });
      return;
    }

    const invite = await InterviewInvite.findOne({ _id: id }).lean();
    if (!invite) {
      res.status(404).json({ error: "Invite not found" });
      return;
    }
    if (invite.candidateEmail !== email) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    if (invite.status !== "pending") {
      res.status(409).json({ error: `Invite is already "${invite.status}"` });
      return;
    }

    const updated = await InterviewInvite.findOneAndUpdate(
      { _id: id },
      {
        $set: {
          status: action === "accept" ? "accepted" : "declined",
          respondedAt: new Date(),
          candidateNote: note,
        },
      },
      { new: true },
    ).lean();

    res.json(updated);
  },
);

export default router;
