import mongoose, { Schema } from "mongoose";

export interface IProjectFinancial {
  _id: string;
  applicationId: string;
  employerId: string;
  candidateId: string;
  candidateName: string;
  jobTitle: string;
  vendorName: string;
  vendorCompanyName: string;
  vendorCompanyId: string;
  clientName: string;
  clientCompanyId: string;
  implementationPartner: string;
  pocName: string;
  pocEmail: string;
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
    employerId: { type: String, required: true },
    candidateId: { type: String, default: "" },
    candidateName: { type: String, default: "" },
    jobTitle: { type: String, default: "" },
    vendorName: { type: String, default: "" },
    vendorCompanyName: { type: String, default: "" },
    vendorCompanyId: { type: String, default: "" },
    clientName: { type: String, default: "" },
    clientCompanyId: { type: String, default: "" },
    implementationPartner: { type: String, default: "" },
    pocName: { type: String, default: "" },
    pocEmail: { type: String, default: "" },
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
  { applicationId: 1, employerId: 1 },
  { unique: true },
);
ProjectFinancialSchema.index({ employerId: 1, candidateId: 1 });

export const ProjectFinancial = mongoose.model<IProjectFinancial>(
  "ProjectFinancial",
  ProjectFinancialSchema,
);
