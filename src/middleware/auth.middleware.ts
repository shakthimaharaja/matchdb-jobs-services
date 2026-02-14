import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface JwtUser {
  userId: string;
  email: string;
  userType: 'candidate' | 'vendor' | 'admin';
  plan: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    req.user = jwt.verify(token, env.JWT_SECRET) as JwtUser;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireVendor(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.user?.userType !== 'vendor') {
      res.status(403).json({ error: 'Vendor access required' });
      return;
    }
    next();
  });
}

export function requireCandidate(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.user?.userType !== 'candidate') {
      res.status(403).json({ error: 'Candidate access required' });
      return;
    }
    next();
  });
}
