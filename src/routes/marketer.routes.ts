import { Router } from "express";
import { requireMarketer } from "../middleware/auth.middleware";
import {
  getMarketerStats,
  getMarketerJobs,
  getMarketerProfiles,
  registerCompany,
  getMyCompany,
  addMarketerCandidate,
  getMarketerCandidates,
  removeMarketerCandidate,
  forwardOpening,
  getForwardedOpenings,
} from "../controllers/marketer.controller";

const router = Router();

// Both routes require an active marketer session
router.get("/stats", requireMarketer, getMarketerStats);
router.get("/jobs", requireMarketer, getMarketerJobs);
router.get("/profiles", requireMarketer, getMarketerProfiles);

// Company management
router.post("/company", requireMarketer, registerCompany);
router.get("/company", requireMarketer, getMyCompany);

// Company candidate roster
router.post("/candidates", requireMarketer, addMarketerCandidate);
router.get("/candidates", requireMarketer, getMarketerCandidates);
router.delete("/candidates/:id", requireMarketer, removeMarketerCandidate);

// Forward openings
router.post("/forward", requireMarketer, forwardOpening);
router.get("/forwarded", requireMarketer, getForwardedOpenings);

export default router;
