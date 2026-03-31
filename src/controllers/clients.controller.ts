import { Request, Response, NextFunction } from "express";
import { ClientCompany } from "../models/ClientCompany";
import { ClientRateCard } from "../models/ClientRateCard";

// ─── GET /api/jobs/clients ──────────────────────────────────────────────────

export async function listClients(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;
    const { status, page = "1", limit = "50" } = req.query;
    const filter: any = { companyId };
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [data, total] = await Promise.all([
      ClientCompany.find(filter)
        .sort({ name: 1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      ClientCompany.countDocuments(filter),
    ]);

    res.json({ data, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/jobs/clients ─────────────────────────────────────────────────

export async function createClient(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;
    const body = req.body as {
      name: string;
      legalName?: string;
      billingEmail?: string;
      billingContact?: string;
      phone?: string;
      address?: string;
      city?: string;
      state?: string;
      zip?: string;
      country?: string;
      paymentTerms?: number;
      creditLimit?: number;
      taxId?: string;
      notes?: string;
    };

    const client = await ClientCompany.create({
      ...body,
      companyId,
      employerId: req.user!.userId,
    });

    res.status(201).json(client);
  } catch (err) {
    next(err);
  }
}

// ─── PUT /api/jobs/clients/:id ──────────────────────────────────────────────

export async function updateClient(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;
    const client = await ClientCompany.findOne({
      _id: req.params.id,
      companyId,
    });
    if (!client) {
      res.status(404).json({ error: "Client not found" });
      return;
    }

    Object.assign(client, req.body);
    await client.save();
    res.json(client);
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/jobs/clients/:id ──────────────────────────────────────────────

export async function getClient(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;
    const client = await ClientCompany.findOne({
      _id: req.params.id,
      companyId,
    }).lean();
    if (!client) {
      res.status(404).json({ error: "Client not found" });
      return;
    }
    res.json(client);
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/jobs/clients/:id/rate-cards ───────────────────────────────────

export async function getClientRateCards(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;
    const cards = await ClientRateCard.find({
      clientId: req.params.id,
      companyId,
    }).lean();
    res.json({ data: cards });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/jobs/clients/:id/rate-cards ──────────────────────────────────

export async function createRateCard(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;
    const body = req.body as {
      candidateId?: string;
      roleName?: string;
      billRate: number;
      payRate: number;
      overtimeBillRate?: number;
      overtimePayRate?: number;
      effectiveDate?: string;
      endDate?: string;
      currency?: string;
    };

    const card = await ClientRateCard.create({
      ...body,
      clientId: req.params.id,
      companyId,
      effectiveDate: body.effectiveDate
        ? new Date(body.effectiveDate)
        : new Date(),
      endDate: body.endDate ? new Date(body.endDate) : null,
    });

    res.status(201).json(card);
  } catch (err) {
    next(err);
  }
}
