import { Request, Response, NextFunction } from "express";
import { VendorBill } from "../models/VendorBill";
import { VendorBillPayment } from "../models/VendorBillPayment";

// ─── GET /api/jobs/bills ────────────────────────────────────────────────────

export async function listBills(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;
    const { status, vendorId, page = "1", limit = "20" } = req.query;
    const filter: any = { companyId };
    if (status) filter.status = status;
    if (vendorId) filter.vendorId = vendorId;

    const skip = (Number(page) - 1) * Number(limit);
    const [data, total] = await Promise.all([
      VendorBill.find(filter)
        .sort({ billDate: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      VendorBill.countDocuments(filter),
    ]);

    res.json({ data, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/jobs/bills ───────────────────────────────────────────────────

export async function createBill(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;
    const body = req.body as {
      vendorId: string;
      billDate: string;
      dueDate: string;
      category?: string;
      description?: string;
      totalAmount: number;
      attachmentUrl?: string;
    };

    // Generate bill number
    const count = await VendorBill.countDocuments({ companyId });
    const billNumber = `BILL-${String(count + 1).padStart(6, "0")}`;

    const bill = await VendorBill.create({
      companyId,
      vendorId: body.vendorId,
      billNumber,
      billDate: new Date(body.billDate),
      dueDate: new Date(body.dueDate),
      category: body.category || "",
      description: body.description || "",
      totalAmount: body.totalAmount,
      amountPaid: 0,
      balanceDue: body.totalAmount,
      status: "PENDING",
      attachmentUrl: body.attachmentUrl || "",
      createdBy: req.user!.userId,
    });

    res.status(201).json(bill);
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/jobs/bills/:id ────────────────────────────────────────────────

export async function getBill(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;
    const bill = await VendorBill.findOne({
      _id: req.params.id,
      companyId,
    }).lean();
    if (!bill) {
      res.status(404).json({ error: "Bill not found" });
      return;
    }

    const payments = await VendorBillPayment.find({
      billId: bill._id,
    }).lean();

    res.json({ ...bill, payments });
  } catch (err) {
    next(err);
  }
}

// ─── PUT /api/jobs/bills/:id ────────────────────────────────────────────────

export async function updateBill(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;
    const bill = await VendorBill.findOne({
      _id: req.params.id,
      companyId,
    });
    if (!bill) {
      res.status(404).json({ error: "Bill not found" });
      return;
    }
    if (!["PENDING"].includes(bill.status)) {
      res.status(400).json({ error: "Only PENDING bills can be edited" });
      return;
    }

    const { vendorId, billDate, dueDate, category, description, totalAmount } =
      req.body;
    if (vendorId) bill.vendorId = vendorId;
    if (billDate) bill.billDate = new Date(billDate);
    if (dueDate) bill.dueDate = new Date(dueDate);
    if (category !== undefined) bill.category = category;
    if (description !== undefined) bill.description = description;
    if (totalAmount !== undefined) {
      bill.totalAmount = totalAmount;
      bill.balanceDue = totalAmount - bill.amountPaid;
    }
    await bill.save();

    res.json(bill);
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/jobs/bills/:id/approve ───────────────────────────────────────

export async function approveBill(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;
    const bill = await VendorBill.findOne({
      _id: req.params.id,
      companyId,
    });
    if (!bill) {
      res.status(404).json({ error: "Bill not found" });
      return;
    }
    if (bill.status !== "PENDING") {
      res.status(400).json({ error: "Only PENDING bills can be approved" });
      return;
    }

    bill.status = "APPROVED";
    bill.approvedBy = req.user!.userId;
    bill.approvedAt = new Date();
    await bill.save();

    res.json(bill);
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/jobs/bills/:id/pay ──────────────────────────────────────────

export async function payBill(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;
    const bill = await VendorBill.findOne({
      _id: req.params.id,
      companyId,
    });
    if (!bill) {
      res.status(404).json({ error: "Bill not found" });
      return;
    }
    if (!["APPROVED", "SCHEDULED"].includes(bill.status)) {
      res
        .status(400)
        .json({ error: "Bill must be APPROVED or SCHEDULED to pay" });
      return;
    }

    const { amount, paymentDate, paymentMethod, referenceNumber } =
      req.body as {
        amount: number;
        paymentDate?: string;
        paymentMethod?: string;
        referenceNumber?: string;
      };

    if (!amount || amount <= 0) {
      res.status(400).json({ error: "Amount must be positive" });
      return;
    }

    const payment = await VendorBillPayment.create({
      billId: bill._id,
      companyId,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      amount,
      paymentMethod: paymentMethod || "ACH",
      referenceNumber: referenceNumber || "",
      recordedBy: req.user!.userId,
    });

    bill.amountPaid += amount;
    bill.balanceDue = bill.totalAmount - bill.amountPaid;

    if (bill.balanceDue <= 0) {
      bill.status = "PAID";
    }
    await bill.save();

    res.json({ bill, payment });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/jobs/bills/aging ──────────────────────────────────────────────

export async function getBillAging(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;
    const now = new Date();

    const openBills = await VendorBill.find({
      companyId,
      status: { $in: ["APPROVED", "SCHEDULED", "OVERDUE"] },
    }).lean();

    const aging = {
      current: 0,
      days1to30: 0,
      days31to60: 0,
      days61to90: 0,
      over90: 0,
      total: 0,
    };

    for (const bill of openBills) {
      const daysPastDue = Math.floor(
        (now.getTime() - new Date(bill.dueDate).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      const balance = bill.balanceDue;

      if (daysPastDue <= 0) aging.current += balance;
      else if (daysPastDue <= 30) aging.days1to30 += balance;
      else if (daysPastDue <= 60) aging.days31to60 += balance;
      else if (daysPastDue <= 90) aging.days61to90 += balance;
      else aging.over90 += balance;

      aging.total += balance;
    }

    res.json({ aging, bills: openBills });
  } catch (err) {
    next(err);
  }
}
