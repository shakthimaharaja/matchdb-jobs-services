import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface JwtUser {
  userId: string;
  email: string;
  userType: "candidate" | "employer" | "admin";
  plan: string;
  username: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtUser;
    }
  }
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    req.user = jwt.verify(token, env.JWT_SECRET) as JwtUser;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireEmployer(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  requireAuth(req, res, () => {
    if (req.user?.userType !== "employer") {
      res.status(403).json({ error: "Employer access required" });
      return;
    }
    next();
  });
}

export function requireCandidate(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  requireAuth(req, res, () => {
    if (req.user?.userType !== "candidate") {
      res.status(403).json({ error: "Candidate access required" });
      return;
    }
    next();
  });
}

// Legacy aliases — all check for employer userType
export const requireVendor = requireEmployer;
export const requireMarketer = requireEmployer;
