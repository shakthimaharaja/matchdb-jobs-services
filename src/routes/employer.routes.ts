import { Router } from "express";
import { requireEmployer } from "../middleware/auth.middleware";
import {
  getEmployerStats,
  getEmployerJobs,
  getEmployerProfiles,
  registerCompany,
  getMyCompany,
  addEmployerCandidate,
  getEmployerCandidates,
  getEmployerCandidateDetail,
  removeEmployerCandidate,
  forwardOpening,
  getForwardedOpenings,
  inviteCandidate,
  forwardOpeningWithEmail,
  updateForwardedStatus,
  getCompanySummary,
  getClientCompanies,
  getVendorCompanies,
} from "../controllers/employer.controller";

const router = Router();

// All routes require an active employer session
router.get("/stats", requireEmployer, getEmployerStats);
router.get("/jobs", requireEmployer, getEmployerJobs);
router.get("/profiles", requireEmployer, getEmployerProfiles);

// Company management
router.post("/company", requireEmployer, registerCompany);
router.get("/company", requireEmployer, getMyCompany);
router.get("/company-summary", requireEmployer, getCompanySummary);

// Client & vendor company lookups
router.get("/client-companies", requireEmployer, getClientCompanies);
router.get("/vendor-companies", requireEmployer, getVendorCompanies);

// Company candidate roster
router.post("/candidates", requireEmployer, addEmployerCandidate);
router.get("/candidates", requireEmployer, getEmployerCandidates);
router.get(
  "/candidates/:id/detail",
  requireEmployer,
  getEmployerCandidateDetail,
);
router.delete("/candidates/:id", requireEmployer, removeEmployerCandidate);
router.post("/candidates/:id/invite", requireEmployer, inviteCandidate);

// Forward openings
router.post("/forward", requireEmployer, forwardOpening);
router.post("/forward-with-email", requireEmployer, forwardOpeningWithEmail);
router.get("/forwarded", requireEmployer, getForwardedOpenings);
router.patch("/forwarded/:id/status", requireEmployer, updateForwardedStatus);

export default router;
