import { Router } from "express";
import {
  requirePermission,
  requireRole,
} from "../middleware/rbac.middleware";
import { requireCandidate } from "../middleware/auth.middleware";
import {
  getTimeEntries,
  upsertTimeEntries,
  submitTimesheet,
  approveTimesheet,
  rejectTimesheet,
  getPendingApprovals,
  getLeaveBalances,
  getMyLeaveBalances,
  requestLeave,
  setLeaveBalance,
  getLeaveCalendar,
} from "../controllers/fieldglass.controller";

const router = Router();

// ═══ FIELDGLASS — ENHANCED TIMESHEET ROUTES ═══

// Pending approvals — must be BEFORE /:id
router.get(
  "/pending-approval",
  requirePermission("timesheet_approve"),
  getPendingApprovals,
);

// Daily time entries
router.get("/:id/entries", getTimeEntries);
router.put("/:id/entries", upsertTimeEntries);

// Timesheet lifecycle (these are used by both candidates and employers)
router.post("/:id/submit", submitTimesheet);
router.post(
  "/:id/approve",
  requirePermission("timesheet_approve"),
  approveTimesheet,
);
router.post(
  "/:id/reject",
  requirePermission("timesheet_approve"),
  rejectTimesheet,
);

// ═══ FIELDGLASS — LEAVE MANAGEMENT ═══

// Candidate views own leave
router.get("/leave/my-balances", requireCandidate, getMyLeaveBalances);
router.post("/leave/request", requireCandidate, requestLeave);

// Employer manages leave
router.get(
  "/leave/balances/:personId",
  requirePermission("leave_management"),
  getLeaveBalances,
);
router.post(
  "/leave/balances",
  requirePermission("leave_management"),
  setLeaveBalance,
);
router.get(
  "/leave/calendar",
  requirePermission("leave_management"),
  getLeaveCalendar,
);

export default router;
