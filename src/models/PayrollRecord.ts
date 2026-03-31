import mongoose, { Schema } from "mongoose";

export type PayeeType = "WORKER" | "CANDIDATE";
export type PaymentMethod = "DIRECT_DEPOSIT" | "CHECK" | "WIRE";
export type PaymentStatus = "PENDING" | "SCHEDULED" | "COMPLETED" | "FAILED";

export interface IPayrollRecord {
  _id: string;
  payPeriodId: string;
  payeeId: string;
  payeeType: PayeeType;
  companyId: string;
  payeeName: string;
  payeeEmail: string;

  // Hours (sourced from Fieldglass timesheets)
  regularHours: number;
  overtimeHours: number;
  ptoHours: number;
  hourlyRate: number;
  salaryAmount: number;

  // Earnings
  grossPay: number;
  bonus: number;
  commission: number;
  reimbursements: number;

  // Deductions (W-2 only, zero for 1099)
  federalTax: number;
  stateTax: number;
  localTax: number;
  ficaSS: number;
  ficaMedicare: number;
  healthInsurance: number;
  dentalInsurance: number;
  visionInsurance: number;
  retirement401k: number;
  otherDeductions: number;
  totalDeductions: number;

  // Net
  netPay: number;

  // Employer costs (W-2 only)
  employerFica: number;
  employerFuta: number;
  employerSuta: number;
  employerBenefits: number;

  // Status & Payment
  status: string;
  paymentMethod: PaymentMethod | null;
  paymentStatus: PaymentStatus;
  paymentDate: Date | null;

  // Link to Fieldglass timesheet(s)
  timesheetIds: string[];

  createdAt: Date;
  updatedAt: Date;
}

const PayrollRecordSchema = new Schema<IPayrollRecord>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    payPeriodId: { type: String, required: true },
    payeeId: { type: String, required: true },
    payeeType: {
      type: String,
      enum: ["WORKER", "CANDIDATE"],
      required: true,
    },
    companyId: { type: String, required: true },
    payeeName: { type: String, default: "" },
    payeeEmail: { type: String, default: "" },
    regularHours: { type: Number, default: 0 },
    overtimeHours: { type: Number, default: 0 },
    ptoHours: { type: Number, default: 0 },
    hourlyRate: { type: Number, default: 0 },
    salaryAmount: { type: Number, default: 0 },
    grossPay: { type: Number, required: true },
    bonus: { type: Number, default: 0 },
    commission: { type: Number, default: 0 },
    reimbursements: { type: Number, default: 0 },
    federalTax: { type: Number, default: 0 },
    stateTax: { type: Number, default: 0 },
    localTax: { type: Number, default: 0 },
    ficaSS: { type: Number, default: 0 },
    ficaMedicare: { type: Number, default: 0 },
    healthInsurance: { type: Number, default: 0 },
    dentalInsurance: { type: Number, default: 0 },
    visionInsurance: { type: Number, default: 0 },
    retirement401k: { type: Number, default: 0 },
    otherDeductions: { type: Number, default: 0 },
    totalDeductions: { type: Number, required: true },
    netPay: { type: Number, required: true },
    employerFica: { type: Number, default: 0 },
    employerFuta: { type: Number, default: 0 },
    employerSuta: { type: Number, default: 0 },
    employerBenefits: { type: Number, default: 0 },
    paymentMethod: {
      type: String,
      enum: ["DIRECT_DEPOSIT", "CHECK", "WIRE", null],
      default: null,
    },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "SCHEDULED", "COMPLETED", "FAILED"],
      default: "PENDING",
    },
    status: {
      type: String,
      enum: ["DRAFT", "PROCESSED", "VOIDED"],
      default: "DRAFT",
    },
    paymentDate: { type: Date, default: null },
    timesheetIds: { type: [String], default: [] },
  },
  { timestamps: true },
);

PayrollRecordSchema.index({ payPeriodId: 1, payeeId: 1 }, { unique: true });
PayrollRecordSchema.index({ companyId: 1, payeeId: 1 });
PayrollRecordSchema.index({ payeeId: 1, payeeType: 1 });

export const PayrollRecord = mongoose.model<IPayrollRecord>(
  "PayrollRecord",
  PayrollRecordSchema,
);
