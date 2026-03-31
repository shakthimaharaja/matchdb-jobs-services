import { Router } from "express";
import { requirePermission } from "../middleware/rbac.middleware";
import {
  listVendors,
  createVendor,
  getVendor,
  updateVendor,
} from "../controllers/vendors.controller";

const router = Router();

// ═══ QUICKBOOKS — VENDOR MANAGEMENT ═══

router.get("/", requirePermission("vendors"), listVendors);
router.post("/", requirePermission("vendors"), createVendor);
router.get("/:id", requirePermission("vendors"), getVendor);
router.put("/:id", requirePermission("vendors"), updateVendor);

export default router;
