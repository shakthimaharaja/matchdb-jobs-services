import { Router } from "express";
import { requirePermission, requireRole } from "../middleware/rbac.middleware";
import {
  listBills,
  createBill,
  getBill,
  updateBill,
  approveBill,
  payBill,
  getBillAging,
} from "../controllers/bills.controller";

const router = Router();

// ═══ QUICKBOOKS — VENDOR BILL MANAGEMENT ═══

// Aging report — must be BEFORE /:id routes
router.get("/aging", requirePermission("bills"), getBillAging);

router.get("/", requirePermission("bills"), listBills);
router.post("/", requirePermission("bills"), createBill);
router.get("/:id", requirePermission("bills"), getBill);
router.put("/:id", requirePermission("bills"), updateBill);
router.post("/:id/approve", requireRole("admin"), approveBill);
router.post("/:id/pay", requirePermission("bills"), payBill);

export default router;
