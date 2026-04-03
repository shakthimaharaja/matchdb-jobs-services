import { Router } from "express";
import { requirePermission, requireRole } from "../middleware/rbac.middleware";
import {
  listPayPeriods,
  createPayPeriod,
  getPayPeriod,
  updatePayPeriod,
  submitPayPeriod,
  approvePayPeriod,
  processPayPeriod,
  voidPayPeriod,
  getPayStubs,
  getMyPayStubs,
} from "../controllers/payroll.controller";
import { requireCandidate } from "../middleware/auth.middleware";

const router = Router();

// ═══ ADP PAYROLL ROUTES ═══

// Pay periods — [ADMIN, MARKETER-ACCOUNTS]
router.get("/periods", requirePermission("payroll"), listPayPeriods);
router.post("/periods", requirePermission("payroll"), createPayPeriod);
router.get("/periods/:id", requirePermission("payroll"), getPayPeriod);
router.put("/periods/:id", requirePermission("payroll"), updatePayPeriod);
router.post(
  "/periods/:id/submit",
  requirePermission("payroll"),
  submitPayPeriod,
);
router.post("/periods/:id/approve", requireRole("admin"), approvePayPeriod);
router.post(
  "/periods/:id/process",
  requirePermission("payroll"),
  processPayPeriod,
);
router.post("/periods/:id/void", requireRole("admin"), voidPayPeriod);

// Pay stubs — employer views any person's stubs
router.get("/stubs/:personId", requirePermission("payroll"), getPayStubs);

// Candidate views their own pay stubs
router.get("/my-stubs", requireCandidate, getMyPayStubs);

export default router;
