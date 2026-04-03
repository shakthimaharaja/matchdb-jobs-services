import { Request, Response, NextFunction } from "express";
import { Invoice } from "../models/Invoice";
import { InvoicePayment } from "../models/InvoicePayment";
import { Timesheet } from "../models/Timesheet";
import { ClientRateCard } from "../models/ClientRateCard";

// ─── GET /api/jobs/invoices ─────────────────────────────────────────────────

export async function listInvoices(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;
    const { status, clientId, page = "1", limit = "20" } = req.query;
    const filter: Record<string, unknown> = { companyId };
    if (status) filter.status = status;
    if (clientId) filter.clientId = clientId;

    const skip = (Number(page) - 1) * Number(limit);
    const [data, total] = await Promise.all([
      Invoice.find(filter)
        .sort({ invoiceDate: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Invoice.countDocuments(filter),
    ]);

    res.json({ data, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/jobs/invoices ────────────────────────────────────────────────

export async function createInvoice(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;
    const body = req.body as {
      clientId: string;
      invoiceDate?: string;
      dueDate: string;
      lineItems?: Array<{
        candidateId?: string;
        description: string;
        hours: number;
        rate: number;
        timesheetId?: string;
      }>;
      notes?: string;
      taxRate?: number;
    };

    // Generate invoice number
    const count = await Invoice.countDocuments({ companyId });
    const invoiceNumber = `INV-${String(count + 1).padStart(6, "0")}`;

    // Calculate line item amounts
    const lineItems = (body.lineItems || []).map((item) => ({
      ...item,
      amount: item.hours * item.rate,
    }));

    const subtotal = lineItems.reduce((sum, li) => sum + li.amount, 0);
    const taxRate = body.taxRate || 0;
    const taxAmount = (subtotal * taxRate) / 100;
    const totalAmount = subtotal + taxAmount;

    const invoice = await Invoice.create({
      companyId,
      clientId: body.clientId,
      invoiceNumber,
      invoiceDate: body.invoiceDate ? new Date(body.invoiceDate) : new Date(),
      dueDate: new Date(body.dueDate),
      lineItems,
      subtotal,
      taxRate,
      taxAmount,
      totalAmount,
      amountPaid: 0,
      balanceDue: totalAmount,
      status: "DRAFT",
      createdBy: req.user!.userId,
      notes: body.notes || "",
    });

    res.status(201).json(invoice);
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/jobs/invoices/:id ─────────────────────────────────────────────

export async function getInvoice(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      companyId,
    }).lean();
    if (!invoice) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }

    // Include payments
    const payments = await InvoicePayment.find({
      invoiceId: invoice._id,
    }).lean();

    res.json({ ...invoice, payments });
  } catch (err) {
    next(err);
  }
}

// ─── PUT /api/jobs/invoices/:id ─────────────────────────────────────────────

export async function updateInvoice(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      companyId,
    });
    if (!invoice) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }
    if (invoice.status !== "DRAFT") {
      res.status(400).json({ error: "Only DRAFT invoices can be edited" });
      return;
    }

    const { lineItems, dueDate, notes, taxRate } = req.body;
    if (lineItems) {
      invoice.lineItems = lineItems.map(
        (item: { hours: number; rate: number; [key: string]: unknown }) => ({
          ...item,
          amount: item.hours * item.rate,
        }),
      );
      invoice.subtotal = invoice.lineItems.reduce(
        (sum: number, li: { amount: number }) => sum + li.amount,
        0,
      );
    }
    if (taxRate !== undefined) invoice.taxRate = taxRate;
    invoice.taxAmount = (invoice.subtotal * invoice.taxRate) / 100;
    invoice.totalAmount = invoice.subtotal + invoice.taxAmount;
    invoice.balanceDue = invoice.totalAmount - invoice.amountPaid;
    if (dueDate) invoice.dueDate = new Date(dueDate);
    if (notes !== undefined) invoice.notes = notes;
    await invoice.save();

    res.json(invoice);
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/jobs/invoices/:id/send ───────────────────────────────────────

export async function sendInvoice(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      companyId,
    });
    if (!invoice) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }
    if (!["DRAFT", "SENT"].includes(invoice.status)) {
      res
        .status(400)
        .json({ error: "Invoice cannot be sent in current status" });
      return;
    }

    invoice.status = "SENT";
    invoice.sentAt = new Date();
    await invoice.save();

    // FUTURE: Email integration — send invoice PDF to client billing email

    res.json(invoice);
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/jobs/invoices/:id/record-payment ────────────────────────────

export async function recordInvoicePayment(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      companyId,
    });
    if (!invoice) {
      res.status(404).json({ error: "Invoice not found" });
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

    const payment = await InvoicePayment.create({
      invoiceId: invoice._id,
      companyId,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      amount,
      paymentMethod: paymentMethod || "ACH",
      referenceNumber: referenceNumber || "",
      recordedBy: req.user!.userId,
    });

    invoice.amountPaid += amount;
    invoice.balanceDue = invoice.totalAmount - invoice.amountPaid;

    if (invoice.balanceDue <= 0) {
      invoice.status = "PAID";
      invoice.paidAt = new Date();
    } else if (invoice.amountPaid > 0) {
      invoice.status = "PARTIAL";
    }

    await invoice.save();

    res.json({ invoice, payment });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/jobs/invoices/aging ───────────────────────────────────────────

export async function getInvoiceAging(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;
    const now = new Date();

    const openInvoices = await Invoice.find({
      companyId,
      status: { $in: ["SENT", "VIEWED", "PARTIAL", "OVERDUE"] },
    }).lean();

    const aging = {
      current: 0,
      days1to30: 0,
      days31to60: 0,
      days61to90: 0,
      over90: 0,
      total: 0,
    };

    for (const inv of openInvoices) {
      const daysPastDue = Math.floor(
        (now.getTime() - new Date(inv.dueDate).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      const balance = inv.balanceDue;

      if (daysPastDue <= 0) aging.current += balance;
      else if (daysPastDue <= 30) aging.days1to30 += balance;
      else if (daysPastDue <= 60) aging.days31to60 += balance;
      else if (daysPastDue <= 90) aging.days61to90 += balance;
      else aging.over90 += balance;

      aging.total += balance;
    }

    res.json({ aging, invoices: openInvoices });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/jobs/invoices/generate-from-timesheets ───────────────────────
// Pull approved timesheets for a client and auto-generate invoice line items

export async function generateInvoiceFromTimesheets(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;
    const { clientId, startDate, endDate } = req.body as {
      clientId: string;
      startDate: string;
      endDate: string;
    };

    // Get approved, non-invoiced timesheets in range
    const timesheets = await Timesheet.find({
      companyId,
      status: "approved",
      weekStart: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
      invoiceId: { $in: ["", null] },
    }).lean();

    // Build line items from timesheets using rate cards
    const lineItems = [];
    for (const ts of timesheets) {
      const rateCard = await ClientRateCard.findOne({
        clientId,
        companyId,
        candidateId: ts.candidateId,
        isActive: true,
      }).lean();

      const billRate = rateCard?.billRate || ts.billRate || 0;
      const regularAmount = (ts.regularHours || 0) * billRate;
      const overtimeAmount =
        (ts.overtimeHours || 0) *
        (rateCard?.overtimeBillRate || billRate * 1.5);

      lineItems.push({
        candidateId: ts.candidateId,
        description: `${ts.candidateName} — ${ts.jobTitle} (Week of ${new Date(ts.weekStart).toLocaleDateString()})`,
        hours: ts.totalHours || 0,
        rate: billRate,
        amount: regularAmount + overtimeAmount,
        timesheetId: ts._id,
      });
    }

    res.json({
      clientId,
      lineItems,
      subtotal: lineItems.reduce((sum, li) => sum + li.amount, 0),
      timesheetCount: timesheets.length,
    });
  } catch (err) {
    next(err);
  }
}
