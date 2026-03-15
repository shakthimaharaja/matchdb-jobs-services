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
  getMarketerCandidateDetail,
  removeMarketerCandidate,
  forwardOpening,
  getForwardedOpenings,
  inviteCandidate,
  forwardOpeningWithEmail,
  updateForwardedStatus,
  getCompanySummary,
} from "../controllers/marketer.controller";

const router = Router();

// Both routes require an active marketer session
router.get("/stats", requireMarketer, getMarketerStats);
router.get("/jobs", requireMarketer, getMarketerJobs);
router.get("/profiles", requireMarketer, getMarketerProfiles);

// Company management
router.post("/company", requireMarketer, registerCompany);
router.get("/company", requireMarketer, getMyCompany);
router.get("/company-summary", requireMarketer, getCompanySummary);

// Company candidate roster
router.post("/candidates", requireMarketer, addMarketerCandidate);
router.get("/candidates", requireMarketer, getMarketerCandidates);
router.get(
  "/candidates/:id/detail",
  requireMarketer,
  getMarketerCandidateDetail,
);
router.delete("/candidates/:id", requireMarketer, removeMarketerCandidate);
router.post("/candidates/:id/invite", requireMarketer, inviteCandidate);

// Forward openings
router.post("/forward", requireMarketer, forwardOpening);
router.post("/forward-with-email", requireMarketer, forwardOpeningWithEmail);
router.get("/forwarded", requireMarketer, getForwardedOpenings);
router.patch("/forwarded/:id/status", requireMarketer, updateForwardedStatus);

export default router;
