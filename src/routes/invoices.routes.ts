import { Router } from "express";
import { requirePermission } from "../middleware/rbac.middleware";
import {
  listInvoices,
  createInvoice,
  getInvoice,
  updateInvoice,
  sendInvoice,
  recordInvoicePayment,
  getInvoiceAging,
  generateInvoiceFromTimesheets,
} from "../controllers/invoices.controller";

const router = Router();

// ═══ QUICKBOOKS — INVOICE MANAGEMENT ═══

// Aging report — must be BEFORE /:id routes
router.get("/aging", requirePermission("invoices"), getInvoiceAging);

// Generate invoice line items from approved timesheets
router.post(
  "/generate-from-timesheets",
  requirePermission("invoices"),
  generateInvoiceFromTimesheets,
);

router.get("/", requirePermission("invoices"), listInvoices);
router.post("/", requirePermission("invoices"), createInvoice);
router.get("/:id", requirePermission("invoices"), getInvoice);
router.put("/:id", requirePermission("invoices"), updateInvoice);
router.post("/:id/send", requirePermission("invoices"), sendInvoice);
router.post(
  "/:id/record-payment",
  requirePermission("invoices"),
  recordInvoicePayment,
);

export default router;
