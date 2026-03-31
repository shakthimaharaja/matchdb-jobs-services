/**
 * rbac.middleware.ts
 *
 * Role-Based Access Control middleware for the Employer portal.
 *
 * Roles: admin, manager, vendor, marketer (scoped by department).
 * Works with requireAuth chain and adds:
 *   - resolveCompanyUser  → attaches company context
 *   - requireRole(...)    → checks the user's company role
 *   - requirePermission(...) → checks granular permission strings
 *   - requireSeatAvailable → blocks if company worker limit is reached
 */
import { Request, Response, NextFunction } from "express";
import {
  CompanyUser,
  ROLE_PERMISSIONS,
  resolveRoleKey,
  type UserRole,
} from "../models/CompanyUser";
import { CompanyAdmin } from "../models/CompanyAdmin";
import { SubscriptionPlan } from "../models/SubscriptionPlan";
import { requireAuth, type JwtUser } from "./auth.middleware";

// Extend the Request to include company context after middleware runs
declare global {
  namespace Express {
    interface Request {
      companyUser?: {
        companyId: string;
        role: UserRole;
        department: string | null;
        permissions: string[];
        companyUserId: string;
      };
    }
  }
}

/**
 * Resolves the calling user's company context (companyId, role, permissions).
 * Must be called after requireAuth so req.user is populated.
 * Attaches req.companyUser for downstream middleware/handlers.
 */
export function resolveCompanyUser(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  requireAuth(req, res, async () => {
    try {
      const jwt = req.user as JwtUser;

      const cu = await CompanyUser.findOne({
        userId: jwt.userId,
        status: "active",
      }).lean();

      if (!cu) {
        res.status(403).json({ error: "No active company membership found" });
        return;
      }

      const roleKey = resolveRoleKey(cu.role, cu.department);
      req.companyUser = {
        companyId: cu.companyId,
        role: cu.role,
        department: cu.department ?? null,
        permissions:
          cu.permissions.length > 0
            ? cu.permissions
            : ROLE_PERMISSIONS[roleKey] || [],
        companyUserId: cu._id,
      };

      next();
    } catch (err) {
      res.status(500).json({ error: "Failed to resolve company user" });
    }
  });
}

/**
 * Factory: require the calling user to have one of the specified roles.
 * Usage: requireRole("admin", "manager")
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    resolveCompanyUser(req, res, () => {
      if (!req.companyUser || !roles.includes(req.companyUser.role)) {
        res.status(403).json({
          error: "Forbidden: insufficient role",
          required: roles,
          actual: req.companyUser?.role,
        });
        return;
      }
      next();
    });
  };
}

/**
 * Factory: require the calling user to have ALL specified permission strings.
 * Usage: requirePermission("finance", "candidates")
 */
export function requirePermission(...perms: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    resolveCompanyUser(req, res, () => {
      if (!req.companyUser) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      const userPerms = req.companyUser.permissions;
      const hasAll = perms.every((p) => userPerms.includes(p));

      if (!hasAll) {
        res.status(403).json({
          error: "Forbidden: missing permissions",
          required: perms,
        });
        return;
      }
      next();
    });
  };
}

/**
 * Middleware: block the request if the company has reached its worker limit
 * (based on subscription plan). Used before creating new employee invitations.
 */
export function requireSeatAvailable(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  resolveCompanyUser(req, res, async () => {
    try {
      if (!req.companyUser) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      const admin = await CompanyAdmin.findOne({
        companyId: req.companyUser.companyId,
      }).lean();

      if (!admin) {
        res.status(404).json({ error: "Company admin record not found" });
        return;
      }

      // If a plan is assigned, check against plan limits
      if (admin.subscriptionPlanId) {
        const plan = await SubscriptionPlan.findById(
          admin.subscriptionPlanId,
        ).lean();
        if (plan && plan.maxWorkers !== null) {
          if (admin.seatsUsed >= plan.maxWorkers) {
            res.status(403).json({
              error: "Worker limit reached",
              seatsUsed: admin.seatsUsed,
              maxWorkers: plan.maxWorkers,
              planName: plan.name,
              message: `Your ${plan.name} plan allows ${plan.maxWorkers} workers. Please upgrade to add more team members.`,
            });
            return;
          }
        }
      } else if (admin.seatsUsed >= admin.seatLimit) {
        // Fallback to static seatLimit if no plan assigned
        res.status(403).json({
          error: "Seat limit reached",
          seatsUsed: admin.seatsUsed,
          seatLimit: admin.seatLimit,
          message: `Your plan allows ${admin.seatLimit} seats. Please upgrade to add more employees.`,
        });
        return;
      }

      next();
    } catch (err) {
      res.status(500).json({ error: "Failed to check seat availability" });
    }
  });
}
