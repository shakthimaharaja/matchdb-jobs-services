import { Request, Response, NextFunction } from "express";
import { VendorCompany } from "../models/VendorCompany";

// ─── GET /api/jobs/vendors ──────────────────────────────────────────────────

export async function listVendors(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;
    const { status, page = "1", limit = "50" } = req.query;
    const filter: Record<string, unknown> = { companyId };
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [data, total] = await Promise.all([
      VendorCompany.find(filter)
        .sort({ name: 1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      VendorCompany.countDocuments(filter),
    ]);

    res.json({ data, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/jobs/vendors ─────────────────────────────────────────────────

export async function createVendor(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;
    const body = req.body as {
      name: string;
      contactName?: string;
      email?: string;
      phone?: string;
      address?: string;
      city?: string;
      state?: string;
      zip?: string;
      country?: string;
      paymentTerms?: number;
      taxId?: string;
      category?: string;
      notes?: string;
    };

    const vendor = await VendorCompany.create({
      ...body,
      companyId,
      employerId: req.user!.userId,
    });

    res.status(201).json(vendor);
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/jobs/vendors/:id ──────────────────────────────────────────────

export async function getVendor(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;
    const vendor = await VendorCompany.findOne({
      _id: req.params.id,
      companyId,
    }).lean();
    if (!vendor) {
      res.status(404).json({ error: "Vendor not found" });
      return;
    }
    res.json(vendor);
  } catch (err) {
    next(err);
  }
}

// ─── PUT /api/jobs/vendors/:id ──────────────────────────────────────────────

export async function updateVendor(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = req.companyUser!;
    const vendor = await VendorCompany.findOne({
      _id: req.params.id,
      companyId,
    });
    if (!vendor) {
      res.status(404).json({ error: "Vendor not found" });
      return;
    }

    Object.assign(vendor, req.body);
    await vendor.save();
    res.json(vendor);
  } catch (err) {
    next(err);
  }
}
