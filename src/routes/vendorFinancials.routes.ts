import { Router } from "express";
import { requireVendor } from "../middleware/auth.middleware";
import { getVendorFinancialSummary } from "../controllers/vendorFinancials.controller";

const router = Router();

router.get("/summary", requireVendor, getVendorFinancialSummary);

export default router;
