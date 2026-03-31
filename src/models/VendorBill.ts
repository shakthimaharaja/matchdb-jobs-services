import mongoose, { Schema } from "mongoose";

export type VendorBillStatus =
  | "PENDING"
  | "APPROVED"
  | "SCHEDULED"
  | "PAID"
  | "OVERDUE"
  | "VOID";

export interface IVendorBill {
  _id: string;
  companyId: string;
  vendorId: string;
  vendorName: string;
  billNumber: string;
  billDate: Date;
  dueDate: Date;
  category: string;
  description: string;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  status: VendorBillStatus;
  attachmentUrl: string;
  approvedBy: string | null;
  approvedAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const VendorBillSchema = new Schema<IVendorBill>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    companyId: { type: String, required: true },
    vendorId: { type: String, required: true },
    vendorName: { type: String, default: "" },
    billNumber: { type: String, default: "" },
    billDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    category: { type: String, default: "" },
    description: { type: String, default: "" },
    totalAmount: { type: Number, required: true },
    amountPaid: { type: Number, default: 0 },
    balanceDue: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "SCHEDULED", "PAID", "OVERDUE", "VOID"],
      default: "PENDING",
    },
    attachmentUrl: { type: String, default: "" },
    approvedBy: { type: String, default: null },
    approvedAt: { type: Date, default: null },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

VendorBillSchema.index({ companyId: 1, status: 1 });
VendorBillSchema.index({ companyId: 1, vendorId: 1 });
VendorBillSchema.index({ companyId: 1, dueDate: 1 });

export const VendorBill = mongoose.model<IVendorBill>(
  "VendorBill",
  VendorBillSchema,
);
