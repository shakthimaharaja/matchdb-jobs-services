/**
 * candidateInvite.routes.ts
 *
 * Candidate Invitation & Payment-Gated Registration Flow:
 *  - Admin/Marketing sends a candidate invitation
 *  - Candidate validates token, creates account, completes payment
 *  - Stripe webhook activates the account
 *  - Admin/Marketing can track and manage all invited candidates
 */
import { Router, Request, Response } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { CandidateInvitation } from "../models/CandidateInvitation";
import { CandidateUser } from "../models/CandidateUser";
import { CandidatePlan } from "../models/CandidatePlan";
import { CompanyAdmin } from "../models/CompanyAdmin";
import {
  requireRole,
  requirePermission,
  resolveCompanyUser,
} from "../middleware/rbac.middleware";
import {
  sendCandidateInviteEmail,
  sendCandidateWelcomeEmail,
  sendCandidatePaymentFailedEmail,
} from "../services/email-templates.service";

const router = Router();

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

// ═══════════════════════════════════════════════════════════════════════════════
// POST /invite — Send candidate invitation (Admin + Marketing only)
// ═══════════════════════════════════════════════════════════════════════════════

const inviteSchema = z.object({
  candidateName: z.string().max(100).default(""),
  candidateEmail: z.string().email(),
  jobTitle: z.string().max(200).default(""),
  candidatePlan: z.string().min(1), // plan _id
  personalNote: z.string().max(1000).default(""),
});

router.post(
  "/invite",
  requirePermission("invite:candidate"),
  async (req: Request, res: Response) => {
    try {
      const body = inviteSchema.parse(req.body);
      const { companyId, role } = req.companyUser!;

      // Validate the plan exists and belongs to this company
      const plan = await CandidatePlan.findOne({
        _id: body.candidatePlan,
        companyId,
        isActive: true,
      }).lean();

      if (!plan) {
        res.status(400).json({ error: "Invalid candidate plan" });
        return;
      }

      const admin = await CompanyAdmin.findOne({ companyId }).lean();
      if (!admin) {
        res.status(404).json({ error: "Company not found" });
        return;
      }

      // Revoke any existing pending invite for same email
      await CandidateInvitation.updateMany(
        {
          companyId,
          candidateEmail: body.candidateEmail,
          status: { $in: ["pending", "payment_pending"] },
        },
        { $set: { status: "revoked" } },
      );

      // Create invitation
      const invite = await CandidateInvitation.create({
        companyId,
        companyName: admin.companyName,
        invitedByUserId: req.user!.userId,
        invitedByName: admin.adminName || req.user!.email,
        invitedByRole: role as "admin" | "marketing",
        candidateName: body.candidateName,
        candidateEmail: body.candidateEmail,
        candidatePlan: plan.tier,
        candidatePlanName: plan.planName,
        jobTitle: body.jobTitle,
        personalNote: body.personalNote,
      });

      // Send invitation email
      const registerUrl = `${CLIENT_URL}/candidate/register?token=${invite.token}`;
      sendCandidateInviteEmail({
        to: body.candidateEmail,
        candidateName: body.candidateName,
        companyName: admin.companyName,
        inviterName: admin.adminName || req.user!.email,
        planName: plan.planName,
        personalNote: body.personalNote,
        registerUrl,
      }).catch((e) => console.error("[candidate invite email]", e));

      res.status(201).json({
        id: invite._id,
        candidateEmail: invite.candidateEmail,
        candidateName: invite.candidateName,
        plan: invite.candidatePlanName,
        status: invite.status,
        tokenExpiresAt: invite.tokenExpiresAt,
      });
    } catch (err: any) {
      if (err.name === "ZodError") {
        res
          .status(400)
          .json({ error: "Validation failed", details: err.errors });
        return;
      }
      console.error("[candidate/invite]", err);
      res.status(500).json({ error: "Failed to send candidate invitation" });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// GET /invite/verify/:token — Token validation (public, no auth)
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/invite/verify/:token", async (req: Request, res: Response) => {
  try {
    const invite = await CandidateInvitation.findOne({
      token: req.params.token,
    }).lean();

    if (!invite) {
      res.status(404).json({ valid: false, error: "Invitation not found" });
      return;
    }

    // Auto-expire if past expiry
    if (invite.status === "pending" && invite.tokenExpiresAt < new Date()) {
      await CandidateInvitation.updateOne(
        { _id: invite._id },
        { $set: { status: "expired" } },
      );
      res.status(410).json({ valid: false, error: "Invitation has expired" });
      return;
    }

    if (invite.status === "revoked") {
      res
        .status(410)
        .json({ valid: false, error: "Invitation has been revoked" });
      return;
    }

    if (invite.status === "active") {
      res
        .status(410)
        .json({ valid: false, error: "Invitation has already been used" });
      return;
    }

    // Valid: pending or payment_pending
    res.json({
      valid: true,
      candidateName: invite.candidateName,
      candidateEmail: invite.candidateEmail,
      companyName: invite.companyName,
      planName: invite.candidatePlanName,
      plan: invite.candidatePlan,
      status: invite.status,
    });
  } catch (err) {
    console.error("[candidate/verify]", err);
    res.status(500).json({ error: "Failed to verify token" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /register/:token — Candidate account creation (pre-payment)
// ═══════════════════════════════════════════════════════════════════════════════

const registerSchema = z.object({
  fullName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(30).default(""),
  password: z.string().min(8), // will be handled by shell auth
});

router.post("/register/:token", async (req: Request, res: Response) => {
  try {
    const body = registerSchema.parse(req.body);

    const invite = await CandidateInvitation.findOne({
      token: req.params.token,
      status: "pending",
    });

    if (!invite) {
      res.status(404).json({ error: "Invalid or expired invitation token" });
      return;
    }

    if (invite.tokenExpiresAt < new Date()) {
      invite.status = "expired";
      await invite.save();
      res.status(410).json({ error: "Invitation has expired" });
      return;
    }

    // Verify email matches invitation
    if (invite.candidateEmail.toLowerCase() !== body.email.toLowerCase()) {
      res.status(403).json({ error: "Email does not match the invitation" });
      return;
    }

    // Check if candidate account already exists
    const existing = await CandidateUser.findOne({ email: body.email }).lean();
    if (existing) {
      res.status(409).json({ error: "Candidate account already exists" });
      return;
    }

    // Create candidate user in PENDING state
    const candidateUser = await CandidateUser.create({
      companyId: invite.companyId,
      invitationId: invite._id,
      fullName: body.fullName,
      email: body.email,
      phone: body.phone,
      candidatePlan: invite.candidatePlan,
      status: "pending", // not active until payment
    });

    // Move invitation to payment_pending
    invite.status = "payment_pending";
    invite.registeredAt = new Date();
    await invite.save();

    res.status(201).json({
      candidateUserId: candidateUser._id,
      companyId: invite.companyId,
      companyName: invite.companyName,
      plan: invite.candidatePlan,
      planName: invite.candidatePlanName,
      status: "payment_pending",
      message: "Account created. Complete payment to activate.",
    });
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json({ error: "Validation failed", details: err.errors });
      return;
    }
    if (err.code === 11000) {
      res.status(409).json({ error: "Candidate account already exists" });
      return;
    }
    console.error("[candidate/register]", err);
    res.status(500).json({ error: "Failed to register candidate" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /payment/session — Create Stripe checkout session
// ═══════════════════════════════════════════════════════════════════════════════

const paymentSchema = z.object({
  candidateUserId: z.string().min(1),
  planId: z.string().min(1), // CandidatePlan._id
});

router.post("/payment/session", async (req: Request, res: Response) => {
  try {
    const body = paymentSchema.parse(req.body);

    const candidate = await CandidateUser.findById(body.candidateUserId);
    if (!candidate || candidate.status !== "pending") {
      res
        .status(404)
        .json({ error: "Candidate not found or already activated" });
      return;
    }

    const plan = await CandidatePlan.findById(body.planId).lean();
    if (!plan || !plan.stripePriceId) {
      res
        .status(400)
        .json({ error: "Invalid plan or Stripe price not configured" });
      return;
    }

    // Dynamically import stripe (it's in shell-services, so we use the env key)
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(
      process.env.STRIPE_SECRET_KEY || "sk_test_placeholder",
      {
        apiVersion: "2023-10-16" as any,
      },
    );

    const mode = plan.billingCycle === "one-time" ? "payment" : "subscription";

    const session = await stripe.checkout.sessions.create({
      mode: mode as any,
      customer_email: candidate.email,
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      metadata: {
        candidateUserId: candidate._id,
        invitationId: candidate.invitationId,
        companyId: candidate.companyId,
      },
      success_url: `${CLIENT_URL}/candidate/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${CLIENT_URL}/candidate/payment/failed?candidate_id=${candidate._id}`,
    });

    // Store the session ID on the invitation
    await CandidateInvitation.updateOne(
      { _id: candidate.invitationId },
      { $set: { paymentSessionId: session.id } },
    );

    res.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json({ error: "Validation failed", details: err.errors });
      return;
    }
    console.error("[candidate/payment/session]", err);
    res.status(500).json({ error: "Failed to create payment session" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /payment/webhook — Stripe webhook handler
// ═══════════════════════════════════════════════════════════════════════════════

router.post("/payment/webhook", async (req: Request, res: Response) => {
  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(
      process.env.STRIPE_SECRET_KEY || "sk_test_placeholder",
      {
        apiVersion: "2023-10-16" as any,
      },
    );

    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_CANDIDATE_WEBHOOK_SECRET || "";

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch {
      res.status(400).json({ error: "Webhook signature verification failed" });
      return;
    }

    if (
      event.type === "checkout.session.completed" ||
      event.type === "payment_intent.succeeded"
    ) {
      const session = event.data.object as any;
      const meta = session.metadata || {};
      const candidateUserId = meta.candidateUserId;
      const invitationId = meta.invitationId;

      if (candidateUserId) {
        // Activate candidate
        await CandidateUser.updateOne(
          { _id: candidateUserId },
          {
            $set: {
              status: "active",
              paymentStatus: "paid",
              activatedAt: new Date(),
              subscriptionId: session.subscription || "",
              stripeCustomerId: session.customer || "",
            },
          },
        );

        // Update invitation
        await CandidateInvitation.updateOne(
          { _id: invitationId },
          {
            $set: {
              status: "active",
              paymentStatus: "paid",
              paidAt: new Date(),
              paymentSessionId: session.id,
            },
          },
        );

        // Send welcome email
        const candidate = await CandidateUser.findById(candidateUserId).lean();
        const invite = await CandidateInvitation.findById(invitationId).lean();
        if (candidate && invite) {
          sendCandidateWelcomeEmail({
            to: candidate.email,
            candidateName: candidate.fullName,
            companyName: invite.companyName,
            planName: invite.candidatePlanName,
            dashboardUrl: `${CLIENT_URL}/candidate/dashboard`,
          }).catch((e) => console.error("[welcome email]", e));
        }
      }
    }

    if (event.type === "payment_intent.payment_failed") {
      const intent = event.data.object as any;
      const meta = intent.metadata || {};
      const candidateUserId = meta.candidateUserId;
      const invitationId = meta.invitationId;

      if (candidateUserId) {
        await CandidateUser.updateOne(
          { _id: candidateUserId },
          { $set: { paymentStatus: "failed" } },
        );
        await CandidateInvitation.updateOne(
          { _id: invitationId },
          { $set: { paymentStatus: "failed" } },
        );

        const candidate = await CandidateUser.findById(candidateUserId).lean();
        if (candidate) {
          sendCandidatePaymentFailedEmail({
            to: candidate.email,
            candidateName: candidate.fullName,
            retryUrl: `${CLIENT_URL}/candidate/payment/failed?candidate_id=${candidate._id}`,
          }).catch((e) => console.error("[payment failed email]", e));
        }
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error("[candidate/webhook]", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /all — List all candidates under the company (Admin + Marketing)
// ═══════════════════════════════════════════════════════════════════════════════

router.get(
  "/all",
  requirePermission("candidates:view"),
  async (req: Request, res: Response) => {
    try {
      const { companyId } = req.companyUser!;

      // Auto-expire old invitations
      await CandidateInvitation.updateMany(
        {
          companyId,
          status: "pending",
          tokenExpiresAt: { $lt: new Date() },
        },
        { $set: { status: "expired" } },
      );

      const invitations = await CandidateInvitation.find({ companyId })
        .sort({ createdAt: -1 })
        .lean();

      // Enrich with candidate user data where available
      const candidateEmails = invitations.map((i) => i.candidateEmail);
      const candidateUsers = await CandidateUser.find({
        companyId,
        email: { $in: candidateEmails },
      }).lean();

      const userMap = new Map(candidateUsers.map((u) => [u.email, u]));

      // Summary counts
      const counts = {
        total: invitations.length,
        pending: invitations.filter((i) => i.status === "pending").length,
        paymentPending: invitations.filter(
          (i) => i.status === "payment_pending",
        ).length,
        active: invitations.filter((i) => i.status === "active").length,
        expired: invitations.filter((i) => i.status === "expired").length,
        revoked: invitations.filter((i) => i.status === "revoked").length,
      };

      res.json({
        counts,
        candidates: invitations.map((inv) => {
          const user = userMap.get(inv.candidateEmail);
          return {
            id: inv._id,
            candidateName: inv.candidateName,
            candidateEmail: inv.candidateEmail,
            plan: inv.candidatePlanName,
            planTier: inv.candidatePlan,
            jobTitle: inv.jobTitle,
            invitedBy: inv.invitedByName,
            invitedByRole: inv.invitedByRole,
            status: inv.status,
            paymentStatus: inv.paymentStatus,
            createdAt: inv.createdAt,
            registeredAt: inv.registeredAt,
            paidAt: inv.paidAt,
            tokenExpiresAt: inv.tokenExpiresAt,
            candidateUserId: user?._id || null,
            candidateStatus: user?.status || null,
          };
        }),
      });
    } catch (err) {
      console.error("[candidate/all]", err);
      res.status(500).json({ error: "Failed to load candidates" });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// GET /:id — View single candidate profile
// ═══════════════════════════════════════════════════════════════════════════════

router.get(
  "/:id",
  requirePermission("candidates:view"),
  async (req: Request, res: Response) => {
    try {
      const { companyId } = req.companyUser!;
      const user = await CandidateUser.findOne({
        _id: req.params.id,
        companyId,
      }).lean();

      if (!user) {
        res.status(404).json({ error: "Candidate not found" });
        return;
      }

      const invite = await CandidateInvitation.findById(
        user.invitationId,
      ).lean();

      res.json({
        ...user,
        companyName: invite?.companyName || "",
        planName: invite?.candidatePlanName || "",
        invitedBy: invite?.invitedByName || "",
        invitedAt: invite?.createdAt || null,
      });
    } catch (err) {
      console.error("[candidate/:id]", err);
      res.status(500).json({ error: "Failed to load candidate" });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// PUT /invite/:id/revoke — Revoke a candidate invitation
// ═══════════════════════════════════════════════════════════════════════════════

router.put(
  "/invite/:id/revoke",
  requirePermission("candidates:manage"),
  async (req: Request, res: Response) => {
    try {
      const { companyId } = req.companyUser!;
      const inv = await CandidateInvitation.findOneAndUpdate(
        {
          _id: req.params.id,
          companyId,
          status: { $in: ["pending", "payment_pending"] },
        },
        { $set: { status: "revoked" } },
        { new: true },
      );

      if (!inv) {
        res
          .status(404)
          .json({ error: "Invitation not found or already completed" });
        return;
      }

      res.json({ id: inv._id, status: inv.status });
    } catch (err) {
      console.error("[candidate/revoke]", err);
      res.status(500).json({ error: "Failed to revoke invitation" });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// POST /invite/:id/resend — Resend candidate invitation (new token)
// ═══════════════════════════════════════════════════════════════════════════════

router.post(
  "/invite/:id/resend",
  requirePermission("invite:candidate"),
  async (req: Request, res: Response) => {
    try {
      const { companyId } = req.companyUser!;

      const oldInvite = await CandidateInvitation.findOne({
        _id: req.params.id,
        companyId,
      });

      if (!oldInvite) {
        res.status(404).json({ error: "Invitation not found" });
        return;
      }

      // Revoke old
      oldInvite.status = "revoked";
      await oldInvite.save();

      // Create new invitation with same details
      const newInvite = await CandidateInvitation.create({
        companyId: oldInvite.companyId,
        companyName: oldInvite.companyName,
        invitedByUserId: req.user!.userId,
        invitedByName: oldInvite.invitedByName,
        invitedByRole: oldInvite.invitedByRole,
        candidateName: oldInvite.candidateName,
        candidateEmail: oldInvite.candidateEmail,
        candidatePlan: oldInvite.candidatePlan,
        candidatePlanName: oldInvite.candidatePlanName,
        jobTitle: oldInvite.jobTitle,
        personalNote: oldInvite.personalNote,
      });

      // Send email
      const registerUrl = `${CLIENT_URL}/candidate/register?token=${newInvite.token}`;
      sendCandidateInviteEmail({
        to: newInvite.candidateEmail,
        candidateName: newInvite.candidateName,
        companyName: newInvite.companyName,
        inviterName: newInvite.invitedByName,
        planName: newInvite.candidatePlanName,
        personalNote: newInvite.personalNote,
        registerUrl,
      }).catch((e) => console.error("[resend invite email]", e));

      res.status(201).json({
        id: newInvite._id,
        candidateEmail: newInvite.candidateEmail,
        status: newInvite.status,
        tokenExpiresAt: newInvite.tokenExpiresAt,
      });
    } catch (err) {
      console.error("[candidate/resend]", err);
      res.status(500).json({ error: "Failed to resend invitation" });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// Candidate Plan Management (Admin only)
// ═══════════════════════════════════════════════════════════════════════════════

const planSchema = z.object({
  planName: z.string().min(1).max(100),
  tier: z.enum(["basic", "standard", "premium"]),
  price: z.number().min(0),
  currency: z.string().max(3).default("USD"),
  billingCycle: z.enum(["monthly", "yearly", "one-time"]).default("monthly"),
  features: z.array(z.string()).default([]),
  stripePriceId: z.string().default(""),
  isActive: z.boolean().default(true),
});

router.post(
  "/plans",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const body = planSchema.parse(req.body);
      const { companyId } = req.companyUser!;

      const plan = await CandidatePlan.create({ ...body, companyId });
      res.status(201).json(plan);
    } catch (err: any) {
      if (err.name === "ZodError") {
        res
          .status(400)
          .json({ error: "Validation failed", details: err.errors });
        return;
      }
      console.error("[candidate/plans]", err);
      res.status(500).json({ error: "Failed to create plan" });
    }
  },
);

router.get(
  "/plans",
  resolveCompanyUser,
  async (req: Request, res: Response) => {
    try {
      const { companyId } = req.companyUser!;
      const plans = await CandidatePlan.find({ companyId })
        .sort({ price: 1 })
        .lean();
      res.json(plans);
    } catch (err) {
      console.error("[candidate/plans]", err);
      res.status(500).json({ error: "Failed to load plans" });
    }
  },
);

router.put(
  "/plans/:id",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const { companyId } = req.companyUser!;
      const body = planSchema.partial().parse(req.body);

      const plan = await CandidatePlan.findOneAndUpdate(
        { _id: req.params.id, companyId },
        { $set: body },
        { new: true },
      );

      if (!plan) {
        res.status(404).json({ error: "Plan not found" });
        return;
      }
      res.json(plan);
    } catch (err: any) {
      if (err.name === "ZodError") {
        res
          .status(400)
          .json({ error: "Validation failed", details: err.errors });
        return;
      }
      console.error("[candidate/plans/:id]", err);
      res.status(500).json({ error: "Failed to update plan" });
    }
  },
);

export default router;
