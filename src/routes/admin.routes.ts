/**
 * admin.routes.ts
 *
 * Company Admin endpoints:
 *  - Company onboarding (expanded with full company details)
 *  - Admin dashboard
 *  - Employee invitation (send, list, revoke)
 *  - Employee registration via token
 *  - User management (list, role change, status change)
 *  - Active users panel
 *  - Subscription plan management
 */
import { Router, Request, Response } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { CompanyAdmin } from "../models/CompanyAdmin";
import { Company } from "../models/Company";
import { EmployeeInvitation } from "../models/EmployeeInvitation";
import {
  CompanyUser,
  ROLE_PERMISSIONS,
  resolveRoleKey,
  type UserRole,
  type MarketerDepartment,
} from "../models/CompanyUser";
import { SubscriptionPlan, DEFAULT_PLANS } from "../models/SubscriptionPlan";
import { requireAuth } from "../middleware/auth.middleware";
import { getNextId } from "../models/Counter";
import {
  requireRole,
  requirePermission,
  requireSeatAvailable,
  resolveCompanyUser,
} from "../middleware/rbac.middleware";
import { sendEmployeeInviteEmail } from "../services/email-templates.service";

const router = Router();

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

// ═══════════════════════════════════════════════════════════════════════════════
// GET /plans — List available subscription plans
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/plans", async (_req: Request, res: Response) => {
  try {
    // Ensure default plans exist (idempotent upsert)
    for (const p of DEFAULT_PLANS) {
      await SubscriptionPlan.updateOne(
        { slug: p.slug },
        { $setOnInsert: p },
        { upsert: true },
      );
    }
    const plans = await SubscriptionPlan.find({ isActive: true })
      .sort({ priceMonthly: 1 })
      .lean();
    res.json(plans);
  } catch (err) {
    console.error("[admin/plans]", err);
    res.status(500).json({ error: "Failed to load plans" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /setup — One-time company admin onboarding
// ═══════════════════════════════════════════════════════════════════════════════

const addressSchema = z.object({
  street: z.string().max(200).default(""),
  city: z.string().max(100).default(""),
  state: z.string().max(100).default(""),
  zip: z.string().max(20).default(""),
  country: z.string().max(100).default("US"),
});

const setupSchema = z.object({
  // Admin details
  adminName: z.string().min(1).max(100),
  adminPhone: z.string().max(20).default(""),
  adminDesignation: z.string().max(100).default(""),
  // Company details
  companyName: z.string().min(1).max(200),
  companyLegalName: z.string().max(200).default(""),
  ein: z.string().max(20).default(""),
  companyAddress: addressSchema.default({}),
  companyPhone: z.string().max(20).default(""),
  companyEmail: z.string().email().optional().or(z.literal("")),
  companyWebsite: z.string().max(255).default(""),
  industry: z.string().max(100).default(""),
  companySize: z.string().max(20).default(""),
  // Subscription
  subscriptionPlanSlug: z.string().default("starter"),
});

router.post("/setup", requireAuth, async (req: Request, res: Response) => {
  try {
    const jwt = req.user!;

    // Check if admin already exists
    const existing = await CompanyAdmin.findOne({
      adminUserId: jwt.userId,
    }).lean();
    if (existing) {
      res
        .status(409)
        .json({ error: "Admin account already exists for this user" });
      return;
    }

    const body = setupSchema.parse(req.body);

    // Resolve the subscription plan
    const plan = await SubscriptionPlan.findOne({
      slug: body.subscriptionPlanSlug,
      isActive: true,
    }).lean();

    const companyId = new (
      await import("mongoose")
    ).default.Types.ObjectId().toString();

    // Generate unique display IDs
    const companyDisplayId = await getNextId("company");
    const adminWorkerId = await getNextId("worker");

    // Create Company record
    await Company.create({
      _id: companyId,
      displayId: companyDisplayId,
      name: body.companyName,
      legalName: body.companyLegalName,
      ein: body.ein,
      address: body.companyAddress,
      phone: body.companyPhone,
      email: body.companyEmail || "",
      website: body.companyWebsite,
      industry: body.industry,
      companySize: body.companySize,
      adminUserId: jwt.userId,
      adminEmail: jwt.email,
      subscriptionPlanId: plan?._id ?? null,
      subscriptionStatus: plan ? "active" : "none",
      billingCycle: "monthly",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    // Create company admin record
    const admin = await CompanyAdmin.create({
      companyId,
      companyName: body.companyName,
      adminUserId: jwt.userId,
      adminEmail: jwt.email,
      adminName: body.adminName,
      subscriptionPlanId: plan?._id ?? null,
      seatLimit: plan?.maxWorkers ?? 3,
      seatsUsed: 1, // admin counts as 1 seat
    });

    // Create the admin's CompanyUser record
    await CompanyUser.create({
      companyId,
      userId: jwt.userId,
      workerId: adminWorkerId,
      email: jwt.email,
      fullName: body.adminName,
      phone: body.adminPhone,
      designation: body.adminDesignation,
      role: "admin",
      department: null,
      permissions: ROLE_PERMISSIONS.admin,
      status: "active",
      onlineStatus: "online",
      joinedAt: new Date(),
    });

    res.status(201).json({
      companyId,
      companyName: body.companyName,
      subscriptionPlan: plan
        ? { id: plan._id, name: plan.name, slug: plan.slug }
        : null,
      seatLimit: admin.seatLimit,
      seatsUsed: admin.seatsUsed,
    });
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json({ error: "Validation failed", details: err.errors });
      return;
    }
    console.error("[admin/setup]", err);
    res.status(500).json({ error: "Failed to set up company admin" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /dashboard — Admin dashboard info (seats, plan, user count)
// ═══════════════════════════════════════════════════════════════════════════════

router.get(
  "/dashboard",
  resolveCompanyUser,
  async (req: Request, res: Response) => {
    try {
      const { companyId } = req.companyUser!;
      const admin = await CompanyAdmin.findOne({ companyId }).lean();
      if (!admin) {
        res.status(404).json({ error: "Company not found" });
        return;
      }

      const company = await Company.findById(companyId).lean();
      const plan = admin.subscriptionPlanId
        ? await SubscriptionPlan.findById(admin.subscriptionPlanId).lean()
        : null;

      const activeUsers = await CompanyUser.countDocuments({
        companyId,
        status: "active",
      });
      const pendingInvites = await EmployeeInvitation.countDocuments({
        companyId,
        status: "pending",
      });

      res.json({
        companyId: admin.companyId,
        companyName: admin.companyName,
        company: company
          ? {
              name: company.name,
              legalName: company.legalName,
              industry: company.industry,
              companySize: company.companySize,
              logoUrl: company.logoUrl,
            }
          : null,
        subscriptionPlan: plan
          ? {
              id: plan._id,
              name: plan.name,
              slug: plan.slug,
              maxJobPostings: plan.maxJobPostings,
              maxCandidates: plan.maxCandidates,
              maxWorkers: plan.maxWorkers,
              priceMonthly: plan.priceMonthly,
            }
          : null,
        seatLimit: plan?.maxWorkers ?? admin.seatLimit,
        seatsUsed: admin.seatsUsed,
        activeUsers,
        pendingInvites,
        role: req.companyUser!.role,
        department: req.companyUser!.department,
        permissions: req.companyUser!.permissions,
      });
    } catch (err) {
      console.error("[admin/dashboard]", err);
      res.status(500).json({ error: "Failed to load dashboard" });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// POST /invite — Send employee invitation
// ═══════════════════════════════════════════════════════════════════════════════

const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().max(100).default(""),
  role: z.enum(["vendor", "marketer", "manager", "admin"]).default("vendor"),
  department: z
    .enum(["accounts", "immigration", "placement"])
    .optional()
    .nullable(),
});

router.post(
  "/invite",
  requireRole("admin"),
  requireSeatAvailable,
  async (req: Request, res: Response) => {
    try {
      const body = inviteSchema.parse(req.body);
      const { companyId } = req.companyUser!;

      // Validate: marketer role requires a department
      if (body.role === "marketer" && !body.department) {
        res.status(400).json({
          error: "Department is required for marketer role",
        });
        return;
      }

      // Check if user is already a member
      const existingUser = await CompanyUser.findOne({
        companyId,
        email: body.email,
      }).lean();
      if (existingUser) {
        res.status(409).json({ error: "User is already a company member" });
        return;
      }

      // If inviting an admin, check extra admin billing
      if (body.role === "admin") {
        const adminCount = await CompanyUser.countDocuments({
          companyId,
          role: "admin",
          status: "active",
        });
        if (adminCount >= 1) {
          // More than 1 admin → charge extra
          await Company.updateOne(
            { _id: companyId },
            { $inc: { extraAdminCount: 1 } },
          );
        }
      }

      // Invalidate any existing pending invite for this email
      await EmployeeInvitation.updateMany(
        { companyId, inviteeEmail: body.email, status: "pending" },
        { $set: { status: "revoked" } },
      );

      // Create new invitation
      const admin = await CompanyAdmin.findOne({ companyId }).lean();
      const invite = await EmployeeInvitation.create({
        companyId,
        invitedByAdminId: req.user!.userId,
        inviteeEmail: body.email,
        inviteeName: body.name,
        assignedRole: body.role,
        assignedDepartment: body.role === "marketer" ? body.department : null,
      });

      // Send email
      const registerUrl = `${CLIENT_URL}/register?token=${invite.token}`;
      sendEmployeeInviteEmail({
        to: body.email,
        inviteeName: body.name,
        companyName: admin?.companyName || "",
        adminName: admin?.adminName || "",
        role: body.role,
        registerUrl,
      }).catch((e) => console.error("[invite email]", e));

      res.status(201).json({
        id: invite._id,
        email: invite.inviteeEmail,
        name: invite.inviteeName,
        role: invite.assignedRole,
        status: invite.status,
        expiresAt: invite.expiresAt,
        token: invite.token,
      });
    } catch (err: any) {
      if (err.name === "ZodError") {
        res
          .status(400)
          .json({ error: "Validation failed", details: err.errors });
        return;
      }
      console.error("[admin/invite]", err);
      res.status(500).json({ error: "Failed to send invitation" });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// GET /invitations — List all employee invitations
// ═══════════════════════════════════════════════════════════════════════════════

router.get(
  "/invitations",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const { companyId } = req.companyUser!;

      // Auto-expire old invitations
      await EmployeeInvitation.updateMany(
        { companyId, status: "pending", expiresAt: { $lt: new Date() } },
        { $set: { status: "expired" } },
      );

      const invitations = await EmployeeInvitation.find({ companyId })
        .sort({ createdAt: -1 })
        .lean();

      res.json(
        invitations.map((inv) => ({
          id: inv._id,
          email: inv.inviteeEmail,
          name: inv.inviteeName,
          role: inv.assignedRole,
          status: inv.status,
          expiresAt: inv.expiresAt,
          createdAt: inv.createdAt,
          usedAt: inv.usedAt,
        })),
      );
    } catch (err) {
      console.error("[admin/invitations]", err);
      res.status(500).json({ error: "Failed to load invitations" });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// PUT /invitations/:id/revoke — Revoke an invitation
// ═══════════════════════════════════════════════════════════════════════════════

router.put(
  "/invitations/:id/revoke",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const { companyId } = req.companyUser!;
      const inv = await EmployeeInvitation.findOneAndUpdate(
        { _id: req.params.id, companyId, status: "pending" },
        { $set: { status: "revoked" } },
        { new: true },
      );
      if (!inv) {
        res.status(404).json({ error: "Invitation not found or already used" });
        return;
      }
      res.json({ id: inv._id, status: inv.status });
    } catch (err) {
      console.error("[admin/revoke]", err);
      res.status(500).json({ error: "Failed to revoke invitation" });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// POST /register/:token — Accept invitation & register as employee
// ═══════════════════════════════════════════════════════════════════════════════

const registerSchema = z.object({
  fullName: z.string().min(1).max(100),
  userId: z.string().min(1), // from shell auth (user must already have a shell account)
  email: z.string().email(),
});

router.post("/register/:token", async (req: Request, res: Response) => {
  try {
    const body = registerSchema.parse(req.body);

    const invite = await EmployeeInvitation.findOne({
      token: req.params.token,
      status: "pending",
    });

    if (!invite) {
      res.status(404).json({ error: "Invalid or expired invitation token" });
      return;
    }

    // Check expiration
    if (invite.expiresAt < new Date()) {
      invite.status = "expired";
      await invite.save();
      res.status(410).json({ error: "Invitation has expired" });
      return;
    }

    // Verify email matches
    if (invite.inviteeEmail.toLowerCase() !== body.email.toLowerCase()) {
      res.status(403).json({ error: "Email does not match the invitation" });
      return;
    }

    // Create CompanyUser
    const role = invite.assignedRole as UserRole;
    const dept = (invite as any)
      .assignedDepartment as MarketerDepartment | null;
    const roleKey = resolveRoleKey(role, dept);
    const workerId = await getNextId("worker");
    await CompanyUser.create({
      companyId: invite.companyId,
      userId: body.userId,
      workerId,
      email: body.email,
      fullName: body.fullName,
      role,
      department: dept,
      permissions: ROLE_PERMISSIONS[roleKey] || [],
      status: "active",
      invitationId: invite._id,
      invitedBy: invite.invitedByAdminId,
      joinedAt: new Date(),
    });

    // Mark invitation as accepted
    invite.status = "accepted";
    invite.usedAt = new Date();
    await invite.save();

    // Increment seats used
    await CompanyAdmin.updateOne(
      { companyId: invite.companyId },
      { $inc: { seatsUsed: 1 } },
    );

    res.status(201).json({
      message: "Registration complete",
      companyId: invite.companyId,
      role,
    });
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json({ error: "Validation failed", details: err.errors });
      return;
    }
    if (err.code === 11000) {
      res
        .status(409)
        .json({ error: "User already registered with this company" });
      return;
    }
    console.error("[admin/register]", err);
    res.status(500).json({ error: "Failed to register" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /users — List all company users (Admin only)
// ═══════════════════════════════════════════════════════════════════════════════

router.get(
  "/users",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const { companyId } = req.companyUser!;
      const { role, status, search } = req.query;

      const filter: Record<string, any> = { companyId };
      if (role && role !== "all") filter.role = role;
      if (status && status !== "all") filter.status = status;
      if (search) {
        const rgx = new RegExp(String(search), "i");
        filter.$or = [{ fullName: rgx }, { email: rgx }];
      }

      const users = await CompanyUser.find(filter)
        .sort({ joinedAt: -1 })
        .lean();

      res.json(
        users.map((u) => ({
          id: u._id,
          userId: u.userId,
          email: u.email,
          fullName: u.fullName,
          role: u.role,
          permissions: u.permissions,
          status: u.status,
          onlineStatus: u.onlineStatus,
          lastLoginAt: u.lastLoginAt,
          lastActiveAt: u.lastActiveAt,
          joinedAt: u.joinedAt,
        })),
      );
    } catch (err) {
      console.error("[admin/users]", err);
      res.status(500).json({ error: "Failed to load users" });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// PUT /users/:id/role — Update user role
// ═══════════════════════════════════════════════════════════════════════════════

const roleUpdateSchema = z.object({
  role: z.enum(["admin", "manager", "vendor", "marketer"]),
  department: z
    .enum(["accounts", "immigration", "placement"])
    .optional()
    .nullable(),
});

router.put(
  "/users/:id/role",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const { companyId } = req.companyUser!;
      const body = roleUpdateSchema.parse(req.body);
      const newRole = body.role as UserRole;
      const dept =
        newRole === "marketer"
          ? (body.department as MarketerDepartment | null)
          : null;

      if (newRole === "marketer" && !dept) {
        res.status(400).json({
          error: "Department is required for marketer role",
        });
        return;
      }

      const roleKey = resolveRoleKey(newRole, dept);

      // Handle admin count for billing
      const target = await CompanyUser.findOne({
        _id: req.params.id,
        companyId,
      }).lean();
      if (target) {
        // If changing TO admin, increment extra admin count
        if (newRole === "admin" && target.role !== "admin") {
          const adminCount = await CompanyUser.countDocuments({
            companyId,
            role: "admin",
            status: "active",
          });
          if (adminCount >= 1) {
            await Company.updateOne(
              { _id: companyId },
              { $inc: { extraAdminCount: 1 } },
            );
          }
        }
        // If changing FROM admin, decrement extra admin count
        if (target.role === "admin" && newRole !== "admin") {
          await Company.updateOne(
            { _id: companyId, extraAdminCount: { $gt: 0 } },
            { $inc: { extraAdminCount: -1 } },
          );
        }
      }

      const user = await CompanyUser.findOneAndUpdate(
        { _id: req.params.id, companyId },
        {
          $set: {
            role: newRole,
            department: dept,
            permissions: ROLE_PERMISSIONS[roleKey] || [],
          },
        },
        { new: true },
      );

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json({
        id: user._id,
        role: user.role,
        department: user.department,
        permissions: user.permissions,
      });
    } catch (err: any) {
      if (err.name === "ZodError") {
        res
          .status(400)
          .json({ error: "Validation failed", details: err.errors });
        return;
      }
      console.error("[admin/users/role]", err);
      res.status(500).json({ error: "Failed to update role" });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// PUT /users/:id/status — Activate / Deactivate / Suspend user
// ═══════════════════════════════════════════════════════════════════════════════

const statusUpdateSchema = z.object({
  status: z.enum(["active", "deactivated"]),
});

router.put(
  "/users/:id/status",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const { companyId } = req.companyUser!;
      const body = statusUpdateSchema.parse(req.body);

      // Prevent admin from deactivating themselves
      if (
        req.params.id === req.companyUser!.companyUserId &&
        body.status !== "active"
      ) {
        res.status(400).json({ error: "Cannot deactivate your own account" });
        return;
      }

      const user = await CompanyUser.findOneAndUpdate(
        { _id: req.params.id, companyId },
        { $set: { status: body.status } },
        { new: true },
      );

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      // Adjust seat count
      if (body.status === "deactivated") {
        await CompanyAdmin.updateOne(
          { companyId, seatsUsed: { $gt: 0 } },
          { $inc: { seatsUsed: -1 } },
        );
      }

      res.json({
        id: user._id,
        status: user.status,
      });
    } catch (err: any) {
      if (err.name === "ZodError") {
        res
          .status(400)
          .json({ error: "Validation failed", details: err.errors });
        return;
      }
      console.error("[admin/users/status]", err);
      res.status(500).json({ error: "Failed to update status" });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// GET /users/active — Live active users list
// ═══════════════════════════════════════════════════════════════════════════════

router.get(
  "/users/active",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const { companyId } = req.companyUser!;

      // Mark users as "away" if they haven't been active in 5 min, "offline" if 15 min
      const now = new Date();
      const awayThreshold = new Date(now.getTime() - 5 * 60 * 1000);
      const offlineThreshold = new Date(now.getTime() - 15 * 60 * 1000);

      await CompanyUser.updateMany(
        {
          companyId,
          onlineStatus: "online",
          lastActiveAt: { $lt: awayThreshold },
        },
        { $set: { onlineStatus: "away" } },
      );
      await CompanyUser.updateMany(
        {
          companyId,
          onlineStatus: { $in: ["online", "away"] },
          lastActiveAt: { $lt: offlineThreshold },
        },
        { $set: { onlineStatus: "offline" } },
      );

      const users = await CompanyUser.find({
        companyId,
        status: "active",
      })
        .sort({ onlineStatus: 1, lastActiveAt: -1 })
        .lean();

      const totalOnline = users.filter(
        (u) => u.onlineStatus === "online",
      ).length;
      const totalAway = users.filter((u) => u.onlineStatus === "away").length;

      res.json({
        totalActive: users.length,
        totalOnline,
        totalAway,
        users: users.map((u) => ({
          id: u._id,
          fullName: u.fullName,
          email: u.email,
          role: u.role,
          onlineStatus: u.onlineStatus,
          lastLoginAt: u.lastLoginAt,
          lastActiveAt: u.lastActiveAt,
        })),
      });
    } catch (err) {
      console.error("[admin/users/active]", err);
      res.status(500).json({ error: "Failed to load active users" });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// POST /heartbeat — Update user's online status (called via polling)
// ═══════════════════════════════════════════════════════════════════════════════

router.post(
  "/heartbeat",
  resolveCompanyUser,
  async (req: Request, res: Response) => {
    try {
      await CompanyUser.updateOne(
        { _id: req.companyUser!.companyUserId },
        {
          $set: {
            onlineStatus: "online",
            lastActiveAt: new Date(),
          },
        },
      );
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: "Heartbeat failed" });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// GET /subscription/usage — Current usage vs plan limits
// ═══════════════════════════════════════════════════════════════════════════════

router.get(
  "/subscription/usage",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const { companyId } = req.companyUser!;
      const admin = await CompanyAdmin.findOne({ companyId }).lean();
      if (!admin) {
        res.status(404).json({ error: "Company not found" });
        return;
      }

      const plan = admin.subscriptionPlanId
        ? await SubscriptionPlan.findById(admin.subscriptionPlanId).lean()
        : null;

      const company = await Company.findById(companyId).lean();

      // Count current usage
      const { Job } = await import("../models/index");
      const activeJobPostings = await Job.countDocuments({
        vendorId: { $in: await CompanyUser.distinct("userId", { companyId }) },
        isActive: true,
      });

      const { EmployerCandidate } = await import("../models/index");
      const totalCandidates = await EmployerCandidate.countDocuments({
        employerId: {
          $in: await CompanyUser.distinct("userId", { companyId }),
        },
      });

      const activeWorkers = await CompanyUser.countDocuments({
        companyId,
        status: "active",
      });

      const adminCount = await CompanyUser.countDocuments({
        companyId,
        role: "admin",
        status: "active",
      });

      res.json({
        plan: plan
          ? { name: plan.name, slug: plan.slug }
          : { name: "None", slug: "none" },
        usage: {
          jobPostings: activeJobPostings,
          candidates: totalCandidates,
          workers: activeWorkers,
          adminCount,
        },
        limits: {
          maxJobPostings: plan?.maxJobPostings ?? 0,
          maxCandidates: plan?.maxCandidates ?? 0,
          maxWorkers: plan?.maxWorkers ?? 0,
        },
        billing: {
          extraAdminCount: company?.extraAdminCount ?? 0,
          extraAdminFee: plan?.extraAdminFee ?? 20,
          billingCycle: company?.billingCycle ?? "monthly",
        },
      });
    } catch (err) {
      console.error("[admin/subscription/usage]", err);
      res.status(500).json({ error: "Failed to load usage" });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// PUT /subscription/select — Admin selects or upgrades a plan
// ═══════════════════════════════════════════════════════════════════════════════

const selectPlanSchema = z.object({
  planSlug: z.string().min(1),
  billingCycle: z.enum(["monthly", "yearly"]).default("monthly"),
});

router.put(
  "/subscription/select",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const { companyId } = req.companyUser!;
      const body = selectPlanSchema.parse(req.body);

      const plan = await SubscriptionPlan.findOne({
        slug: body.planSlug,
        isActive: true,
      }).lean();
      if (!plan) {
        res.status(404).json({ error: "Plan not found" });
        return;
      }

      await Company.updateOne(
        { _id: companyId },
        {
          $set: {
            subscriptionPlanId: plan._id,
            subscriptionStatus: "active",
            billingCycle: body.billingCycle,
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(
              Date.now() +
                (body.billingCycle === "yearly" ? 365 : 30) *
                  24 *
                  60 *
                  60 *
                  1000,
            ),
          },
        },
      );

      await CompanyAdmin.updateOne(
        { companyId },
        {
          $set: {
            subscriptionPlanId: plan._id,
            seatLimit: plan.maxWorkers ?? 999,
          },
        },
      );

      res.json({
        plan: { id: plan._id, name: plan.name, slug: plan.slug },
        billingCycle: body.billingCycle,
        status: "active",
      });
    } catch (err: any) {
      if (err.name === "ZodError") {
        res
          .status(400)
          .json({ error: "Validation failed", details: err.errors });
        return;
      }
      console.error("[admin/subscription/select]", err);
      res.status(500).json({ error: "Failed to select plan" });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// GET /company — Company details
// ═══════════════════════════════════════════════════════════════════════════════

router.get(
  "/company",
  requirePermission("company_settings"),
  async (req: Request, res: Response) => {
    try {
      const company = await Company.findById(req.companyUser!.companyId).lean();
      if (!company) {
        res.status(404).json({ error: "Company not found" });
        return;
      }
      res.json(company);
    } catch (err) {
      console.error("[admin/company]", err);
      res.status(500).json({ error: "Failed to load company" });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// PUT /company — Update company details (Admin only)
// ═══════════════════════════════════════════════════════════════════════════════

const companyUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  legalName: z.string().max(200).optional(),
  ein: z.string().max(20).optional(),
  address: addressSchema.optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional().or(z.literal("")),
  website: z.string().max(255).optional(),
  industry: z.string().max(100).optional(),
  companySize: z.string().max(20).optional(),
});

router.put(
  "/company",
  requirePermission("company_settings"),
  async (req: Request, res: Response) => {
    try {
      const body = companyUpdateSchema.parse(req.body);
      const company = await Company.findByIdAndUpdate(
        req.companyUser!.companyId,
        { $set: body },
        { new: true },
      );
      if (!company) {
        res.status(404).json({ error: "Company not found" });
        return;
      }

      // Sync company name to admin record if changed
      if (body.name) {
        await CompanyAdmin.updateOne(
          { companyId: company._id },
          { $set: { companyName: body.name } },
        );
      }

      res.json(company);
    } catch (err: any) {
      if (err.name === "ZodError") {
        res
          .status(400)
          .json({ error: "Validation failed", details: err.errors });
        return;
      }
      console.error("[admin/company]", err);
      res.status(500).json({ error: "Failed to update company" });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// GET /me — Current user's company context (role, permissions, department)
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/me", resolveCompanyUser, async (req: Request, res: Response) => {
  try {
    const cu = await CompanyUser.findById(
      req.companyUser!.companyUserId,
    ).lean();
    if (!cu) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const company = await Company.findById(cu.companyId).lean();

    res.json({
      companyUserId: cu._id,
      companyId: cu.companyId,
      companyName: company?.name ?? "",
      userId: cu.userId,
      email: cu.email,
      fullName: cu.fullName,
      role: cu.role,
      department: cu.department,
      permissions: req.companyUser!.permissions,
      status: cu.status,
    });
  } catch (err) {
    console.error("[admin/me]", err);
    res.status(500).json({ error: "Failed to load user context" });
  }
});

export default router;
