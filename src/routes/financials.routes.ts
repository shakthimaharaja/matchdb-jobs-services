import { Router } from "express";
import { requireMarketer } from "../middleware/auth.middleware";
import {
  getStateTaxRates,
  getProjectFinancial,
  getCandidateFinancials,
  upsertProjectFinancial,
  deleteProjectFinancial,
  getFinancialSummary,
} from "../controllers/financials.controller";

const router = Router();

// All routes require marketer auth
router.get("/states", requireMarketer, getStateTaxRates);
router.get("/summary", requireMarketer, getFinancialSummary);
router.get("/candidate/:candidateId", requireMarketer, getCandidateFinancials);
router.get("/:applicationId", requireMarketer, getProjectFinancial);
router.post("/", requireMarketer, upsertProjectFinancial);
router.delete("/:applicationId", requireMarketer, deleteProjectFinancial);

export default router;
