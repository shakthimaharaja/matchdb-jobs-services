/**
 * internal.routes.ts
 *
 * Routes for internal service-to-service communication.
 * Protected by the INTERNAL_API_KEY header — never exposed to the public.
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import { ingestJobs, ingestProfiles } from "../controllers/ingest.controller";
import { env } from "../config/env";

const router = Router();

function requireInternalKey(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers["x-internal-key"];
  if (!key || key !== env.INTERNAL_API_KEY) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

router.post("/ingest/jobs", requireInternalKey, ingestJobs);
router.post("/ingest/profiles", requireInternalKey, ingestProfiles);

export default router;
