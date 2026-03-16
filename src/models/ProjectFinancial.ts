import mongoose, { Schema } from "mongoose";

export interface IProjectFinancial {
  _id: string;
  applicationId: string;
  marketerId: string;
  candidateId: string;
  candidateName: string;
  jobTitle: string;
  vendorName: string;
  billRate: number;
  payRate: number;
  hoursWorked: number;
  projectStart?: Date | null;
  projectEnd?: Date | null;
  stateCode: string;
  stateTaxPct: number;
  cashPct: number;
  totalBilled: number;
  totalPay: number;
  taxAmount: number;
  cashAmount: number;
  netPayable: number;
  amountPaid: number;
  amountPending: number;
  notes: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectFinancialSchema = new Schema<IProjectFinancial>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    applicationId: { type: String, required: true },
    marketerId: { type: String, required: true },
    candidateId: { type: String, default: "" },
    candidateName: { type: String, default: "" },
    jobTitle: { type: String, default: "" },
    vendorName: { type: String, default: "" },
    billRate: { type: Number, default: 0 },
    payRate: { type: Number, default: 0 },
    hoursWorked: { type: Number, default: 0 },
    projectStart: { type: Date, default: null },
    projectEnd: { type: Date, default: null },
    stateCode: { type: String, default: "" },
    stateTaxPct: { type: Number, default: 0 },
    cashPct: { type: Number, default: 0 },
    totalBilled: { type: Number, default: 0 },
    totalPay: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    cashAmount: { type: Number, default: 0 },
    netPayable: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    amountPending: { type: Number, default: 0 },
    notes: { type: String, default: "" },
    status: { type: String, default: "active" },
  },
  { timestamps: true },
);

ProjectFinancialSchema.index(
  { applicationId: 1, marketerId: 1 },
  { unique: true },
);
ProjectFinancialSchema.index({ marketerId: 1, candidateId: 1 });

export const ProjectFinancial = mongoose.model<IProjectFinancial>(
  "ProjectFinancial",
  ProjectFinancialSchema,
);
