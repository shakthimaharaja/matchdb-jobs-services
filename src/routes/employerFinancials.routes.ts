import { Router } from "express";
import { requireEmployer } from "../middleware/auth.middleware";
import { getEmployerFinancialSummary } from "../controllers/employerFinancials.controller";

const router = Router();

router.get("/summary", requireEmployer, getEmployerFinancialSummary);

export default router;
