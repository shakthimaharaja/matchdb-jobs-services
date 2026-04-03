import { Router } from "express";
import { requirePermission } from "../middleware/rbac.middleware";
import {
  getFinanceDashboard,
  getProfitLoss,
  getCashFlow,
  getMarginReport,
  listExpenseCategories,
  createExpenseCategory,
} from "../controllers/finance.controller";

const router = Router();

// ═══ QUICKBOOKS — FINANCIAL REPORTS & DASHBOARD ═══

router.get(
  "/dashboard",
  requirePermission("financial_reports"),
  getFinanceDashboard,
);
router.get(
  "/profit-loss",
  requirePermission("financial_reports"),
  getProfitLoss,
);
router.get("/cash-flow", requirePermission("cash_flow"), getCashFlow);
router.get(
  "/margin-report",
  requirePermission("margin_tracking"),
  getMarginReport,
);
router.get(
  "/expense-categories",
  requirePermission("financial_reports"),
  listExpenseCategories,
);
router.post(
  "/expense-categories",
  requirePermission("financial_reports"),
  createExpenseCategory,
);

export default router;
