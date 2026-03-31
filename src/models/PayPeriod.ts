import mongoose, { Schema } from "mongoose";

export type PayPeriodStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "PROCESSED"
  | "VOIDED";

export type PayFrequency = "WEEKLY" | "BIWEEKLY" | "SEMI_MONTHLY" | "MONTHLY";

export interface IPayPeriod {
  _id: string;
  companyId: string;
  periodStart: Date;
  periodEnd: Date;
  payDate: Date;
  frequency: PayFrequency;
  status: PayPeriodStatus;
  includeWorkers: boolean;
  includeCandidates: boolean;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  recordCount: number;
  employeeCount: number;
  createdBy: string;
  approvedBy: string | null;
  approvedAt: Date | null;
  processedAt: Date | null;
  processedBy: string | null;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const PayPeriodSchema = new Schema<IPayPeriod>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    companyId: { type: String, required: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    payDate: { type: Date, required: true },
    frequency: {
      type: String,
      enum: ["WEEKLY", "BIWEEKLY", "SEMI_MONTHLY", "MONTHLY"],
      default: "BIWEEKLY",
    },
    status: {
      type: String,
      enum: ["DRAFT", "IN_REVIEW", "APPROVED", "PROCESSED", "VOIDED"],
      default: "DRAFT",
    },
    includeWorkers: { type: Boolean, default: true },
    includeCandidates: { type: Boolean, default: true },
    totalGross: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    totalNet: { type: Number, default: 0 },
    recordCount: { type: Number, default: 0 },
    employeeCount: { type: Number, default: 0 },
    createdBy: { type: String, required: true },
    approvedBy: { type: String, default: null },
    approvedAt: { type: Date, default: null },
    processedAt: { type: Date, default: null },
    processedBy: { type: String, default: null },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

PayPeriodSchema.index({ companyId: 1, periodStart: 1, periodEnd: 1 });
PayPeriodSchema.index({ companyId: 1, status: 1 });

export const PayPeriod = mongoose.model<IPayPeriod>(
  "PayPeriod",
  PayPeriodSchema,
);
