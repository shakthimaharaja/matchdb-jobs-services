/**
 * admin.routes.ts
 *
 * Company Admin endpoints:
 *  - Company onboarding & admin dashboard
 *  - Employee invitation (send, list, revoke)
 *  - Employee registration via token
 *  - User management (list, role change, status change)
 *  - Active users panel
 */
import { Router, Request, Response } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import {
  CompanyAdmin,
  PLAN_SEAT_LIMITS,
  type SubscriptionPlan,
} from "../models/CompanyAdmin";
import { EmployeeInvitation } from "../models/EmployeeInvitation";
import {
  CompanyUser,
  ROLE_PERMISSIONS,
  type UserRole,
} from "../models/CompanyUser";
import { requireAuth } from "../middleware/auth.middleware";
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
// POST /setup — One-time company admin onboarding
// ═══════════════════════════════════════════════════════════════════════════════

const setupSchema = z.object({
  companyName: z.string().min(1).max(200),
  adminName: z.string().min(1).max(100),
  subscriptionPlan: z.enum(["basic", "pro"]).default("basic"),
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
    const plan = body.subscriptionPlan as SubscriptionPlan;

    // Create company admin record
    const admin = await CompanyAdmin.create({
      companyId: new (
        await import("mongoose")
      ).default.Types.ObjectId().toString(),
      companyName: body.companyName,
      adminUserId: jwt.userId,
      adminEmail: jwt.email,
      adminName: body.adminName,
      subscriptionPlan: plan,
      seatLimit: PLAN_SEAT_LIMITS[plan],
      seatsUsed: 1, // admin counts as 1 seat
    });

    // Create the admin's CompanyUser record
    await CompanyUser.create({
      companyId: admin.companyId,
      userId: jwt.userId,
      email: jwt.email,
      fullName: body.adminName,
      role: "admin",
      permissions: ROLE_PERMISSIONS.admin,
      status: "active",
      onlineStatus: "online",
      joinedAt: new Date(),
    });

    res.status(201).json({
      companyId: admin.companyId,
      companyName: admin.companyName,
      subscriptionPlan: admin.subscriptionPlan,
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
        subscriptionPlan: admin.subscriptionPlan,
        seatLimit: admin.seatLimit,
        seatsUsed: admin.seatsUsed,
        activeUsers,
        pendingInvites,
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
  role: z
    .enum(["finance", "hr", "operations", "marketing", "viewer"])
    .default("viewer"),
});

router.post(
  "/invite",
  requireRole("admin"),
  requireSeatAvailable,
  async (req: Request, res: Response) => {
    try {
      const body = inviteSchema.parse(req.body);
      const { companyId } = req.companyUser!;

      // Check if user is already a member
      const existingUser = await CompanyUser.findOne({
        companyId,
        email: body.email,
      }).lean();
      if (existingUser) {
        res.status(409).json({ error: "User is already a company member" });
        return;
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
    await CompanyUser.create({
      companyId: invite.companyId,
      userId: body.userId,
      email: body.email,
      fullName: body.fullName,
      role,
      permissions: ROLE_PERMISSIONS[role] || [],
      status: "active",
      invitationId: invite._id,
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
  role: z.enum(["admin", "finance", "hr", "operations", "marketing", "viewer"]),
});

router.put(
  "/users/:id/role",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const { companyId } = req.companyUser!;
      const body = roleUpdateSchema.parse(req.body);
      const newRole = body.role as UserRole;

      const user = await CompanyUser.findOneAndUpdate(
        { _id: req.params.id, companyId },
        {
          $set: {
            role: newRole,
            permissions: ROLE_PERMISSIONS[newRole] || [],
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
  status: z.enum(["active", "inactive", "suspended"]),
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
      if (body.status === "inactive" || body.status === "suspended") {
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

export default router;
