/**
 * rbac.middleware.ts
 *
 * Role-Based Access Control middleware for the Company Admin system.
 * Works with the existing requireAuth chain and adds:
 *   - requireRole(...)   → checks the user's company role
 *   - requirePermission(...) → checks granular permission strings
 *   - requireSeatAvailable → blocks if company seat limit is reached
 */
import { Request, Response, NextFunction } from "express";
import {
  CompanyUser,
  ROLE_PERMISSIONS,
  type UserRole,
} from "../models/CompanyUser";
import { CompanyAdmin } from "../models/CompanyAdmin";
import { requireAuth, type JwtUser } from "./auth.middleware";

// Extend the Request to include company context after middleware runs
declare global {
  namespace Express {
    interface Request {
      companyUser?: {
        companyId: string;
        role: UserRole;
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

      req.companyUser = {
        companyId: cu.companyId,
        role: cu.role,
        permissions:
          cu.permissions.length > 0
            ? cu.permissions
            : ROLE_PERMISSIONS[cu.role] || [],
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
 * Usage: requireRole("admin", "marketing")
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
 * Factory: require the calling user to have a specific permission string.
 * Usage: requirePermission("invite:candidate")
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
 * Middleware: block the request if the company has reached its seat limit.
 * Used before creating new employee invitations.
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

      if (admin.seatsUsed >= admin.seatLimit) {
        res.status(403).json({
          error: "Seat limit reached",
          seatsUsed: admin.seatsUsed,
          seatLimit: admin.seatLimit,
          subscriptionPlan: admin.subscriptionPlan,
          message: `Your ${admin.subscriptionPlan} plan allows ${admin.seatLimit} seats. Please upgrade to add more employees.`,
        });
        return;
      }

      next();
    } catch (err) {
      res.status(500).json({ error: "Failed to check seat availability" });
    }
  });
}
