import { Request, Response, NextFunction } from "express";
import { Invoice } from "../models/Invoice";
import { VendorBill } from "../models/VendorBill";
import { PayPeriod } from "../models/PayPeriod";
import { PayrollRecord } from "../models/PayrollRecord";
import { Timesheet } from "../models/Timesheet";
import { ClientRateCard } from "../models/ClientRateCard";
import { ExpenseCategory } from "../models/ExpenseCategory";

// ─── GET /api/jobs/finance/dashboard ────────────────────────────────────────

export async function getFinanceDashboard(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;

    const [
      totalAR,
      totalAP,
      recentPayrolls,
      paidInvoicesCount,
      pendingTimesheets,
    ] = await Promise.all([
      // Accounts Receivable — outstanding invoice balances
      Invoice.aggregate([
        {
          $match: {
            companyId,
            status: { $in: ["SENT", "VIEWED", "PARTIAL", "OVERDUE"] },
          },
        },
        { $group: { _id: null, total: { $sum: "$balanceDue" } } },
      ]),
      // Accounts Payable — outstanding bill balances
      VendorBill.aggregate([
        {
          $match: {
            companyId,
            status: { $in: ["APPROVED", "SCHEDULED", "OVERDUE"] },
          },
        },
        { $group: { _id: null, total: { $sum: "$balanceDue" } } },
      ]),
      // Recent payroll periods
      PayPeriod.find({ companyId })
        .sort({ periodEnd: -1 })
        .limit(5)
        .lean(),
      // Paid invoices this month
      Invoice.countDocuments({
        companyId,
        status: "PAID",
        paidAt: {
          $gte: new Date(
            new Date().getFullYear(),
            new Date().getMonth(),
            1,
          ),
        },
      }),
      // Pending timesheet approvals
      Timesheet.countDocuments({ companyId, status: "submitted" }),
    ]);

    res.json({
      accountsReceivable: totalAR[0]?.total || 0,
      accountsPayable: totalAP[0]?.total || 0,
      recentPayrolls,
      paidInvoicesThisMonth: paidInvoicesCount,
      pendingTimesheetApprovals: pendingTimesheets,
    });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/jobs/finance/profit-loss ──────────────────────────────────────

export async function getProfitLoss(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;
    const { startDate, endDate } = req.query as {
      startDate?: string;
      endDate?: string;
    };

    const dateFilter: any = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    // Revenue = paid invoices
    const revenueAgg = await Invoice.aggregate([
      {
        $match: {
          companyId,
          status: "PAID",
          ...(startDate || endDate ? { paidAt: dateFilter } : {}),
        },
      },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);

    // Payroll costs
    const payrollAgg = await PayrollRecord.aggregate([
      {
        $match: {
          companyId,
          status: "PROCESSED",
        },
      },
      {
        $group: {
          _id: null,
          totalGross: { $sum: "$earnings.totalEarnings" },
          totalEmployerCosts: {
            $sum: "$employerCosts.totalEmployerCost",
          },
        },
      },
    ]);

    // Operating expenses (vendor bills paid)
    const expensesAgg = await VendorBill.aggregate([
      {
        $match: {
          companyId,
          status: "PAID",
        },
      },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);

    const revenue = revenueAgg[0]?.total || 0;
    const payrollCost =
      (payrollAgg[0]?.totalGross || 0) +
      (payrollAgg[0]?.totalEmployerCosts || 0);
    const operatingExpenses = expensesAgg[0]?.total || 0;
    const netProfit = revenue - payrollCost - operatingExpenses;

    res.json({
      revenue,
      payrollCost,
      operatingExpenses,
      totalExpenses: payrollCost + operatingExpenses,
      netProfit,
      profitMargin: revenue > 0 ? ((netProfit / revenue) * 100).toFixed(2) : 0,
    });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/jobs/finance/cash-flow ────────────────────────────────────────

export async function getCashFlow(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;

    // Cash inflows — invoice payments received
    const inflowAgg = await Invoice.aggregate([
      { $match: { companyId, status: "PAID" } },
      {
        $group: {
          _id: {
            year: { $year: "$paidAt" },
            month: { $month: "$paidAt" },
          },
          amount: { $sum: "$amountPaid" },
        },
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } },
      { $limit: 12 },
    ]);

    // Cash outflows — payroll + vendor bill payments
    const payrollOutflow = await PayPeriod.aggregate([
      { $match: { companyId, status: "PROCESSED" } },
      {
        $group: {
          _id: {
            year: { $year: "$processedAt" },
            month: { $month: "$processedAt" },
          },
          amount: { $sum: "$totalNet" },
        },
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } },
      { $limit: 12 },
    ]);

    const billOutflow = await VendorBill.aggregate([
      { $match: { companyId, status: "PAID" } },
      {
        $group: {
          _id: {
            year: { $year: "$updatedAt" },
            month: { $month: "$updatedAt" },
          },
          amount: { $sum: "$amountPaid" },
        },
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } },
      { $limit: 12 },
    ]);

    res.json({
      inflows: inflowAgg,
      outflows: {
        payroll: payrollOutflow,
        bills: billOutflow,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/jobs/finance/margin-report ────────────────────────────────────

export async function getMarginReport(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;

    // Per-candidate margins from approved timesheets
    const margins = await Timesheet.aggregate([
      {
        $match: {
          companyId,
          status: { $in: ["approved", "processed"] },
          billRate: { $gt: 0 },
          payRate: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: {
            candidateId: "$candidateId",
            candidateName: "$candidateName",
          },
          totalHours: { $sum: "$totalHours" },
          totalBilled: { $sum: "$estimatedBill" },
          totalPaid: { $sum: "$estimatedPay" },
          avgBillRate: { $avg: "$billRate" },
          avgPayRate: { $avg: "$payRate" },
        },
      },
      {
        $project: {
          candidateId: "$_id.candidateId",
          candidateName: "$_id.candidateName",
          totalHours: 1,
          totalBilled: 1,
          totalPaid: 1,
          margin: { $subtract: ["$totalBilled", "$totalPaid"] },
          marginPercent: {
            $cond: [
              { $gt: ["$totalBilled", 0] },
              {
                $multiply: [
                  {
                    $divide: [
                      { $subtract: ["$totalBilled", "$totalPaid"] },
                      "$totalBilled",
                    ],
                  },
                  100,
                ],
              },
              0,
            ],
          },
          avgBillRate: 1,
          avgPayRate: 1,
          _id: 0,
        },
      },
      { $sort: { margin: -1 } },
    ]);

    res.json({ data: margins });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/jobs/finance/expense-categories ───────────────────────────────

export async function listExpenseCategories(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;
    const categories = await ExpenseCategory.find({ companyId }).lean();
    res.json({ data: categories });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/jobs/finance/expense-categories ──────────────────────────────

export async function createExpenseCategory(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;
    const { name, type, parentId } = req.body as {
      name: string;
      type: string;
      parentId?: string;
    };

    const category = await ExpenseCategory.create({
      companyId,
      name,
      type,
      parentId: parentId || null,
    });

    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
}
