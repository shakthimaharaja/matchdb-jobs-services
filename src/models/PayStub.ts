import mongoose, { Schema } from "mongoose";

export interface IPayStub {
  _id: string;
  payrollRecordId: string;
  payPeriodId: string;
  payeeId: string;
  payeeType: "WORKER" | "CANDIDATE";
  companyId: string;
  stubNumber: string;
  periodStart: Date;
  periodEnd: Date;
  payDate: Date;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  pdfUrl: string;
  isViewed: boolean;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PayStubSchema = new Schema<IPayStub>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    payrollRecordId: { type: String, required: true },
    payPeriodId: { type: String, required: true },
    payeeId: { type: String, required: true },
    payeeType: {
      type: String,
      enum: ["WORKER", "CANDIDATE"],
      required: true,
    },
    companyId: { type: String, required: true },
    stubNumber: { type: String, required: true, unique: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    payDate: { type: Date, required: true },
    grossPay: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    netPay: { type: Number, default: 0 },
    pdfUrl: { type: String, default: "" },
    isViewed: { type: Boolean, default: false },
    generatedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

PayStubSchema.index({ payeeId: 1, payeeType: 1 });
PayStubSchema.index({ companyId: 1, payPeriodId: 1 });

export const PayStub = mongoose.model<IPayStub>("PayStub", PayStubSchema);
