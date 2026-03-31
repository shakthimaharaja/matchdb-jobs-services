import mongoose, { Schema } from "mongoose";

export type TimesheetStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "recalled";

export interface ITimesheet {
  _id: string;
  candidateId: string;
  candidateName: string;
  employerId: string;
  companyId: string;
  applicationId: string;
  jobTitle: string;
  weekStart: Date;
  weekEnd: Date;
  entries: any;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  ptoHours: number;
  sickHours: number;
  holidayHours: number;
  // Rate snapshot (from ClientRateCard at submission time)
  payRate: number;
  billRate: number;
  estimatedPay: number;
  estimatedBill: number;
  estimatedMargin: number;
  status: TimesheetStatus;
  submittedAt?: Date;
  approvedBy: string;
  approvedAt?: Date;
  rejectedBy: string;
  rejectedAt?: Date;
  rejectionNote: string;
  // Linked records
  payrollRecordId: string;
  invoiceId: string;
  createdAt: Date;
  updatedAt: Date;
}

const TimesheetSchema = new Schema<ITimesheet>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    candidateId: { type: String, required: true },
    candidateName: { type: String, default: "" },
    employerId: { type: String, required: true },
    companyId: { type: String, default: "" },
    applicationId: { type: String, default: "" },
    jobTitle: { type: String, default: "" },
    weekStart: { type: Date, required: true },
    weekEnd: { type: Date, default: null },
    entries: { type: Schema.Types.Mixed, default: null },
    totalHours: { type: Number, default: 0 },
    regularHours: { type: Number, default: 0 },
    overtimeHours: { type: Number, default: 0 },
    ptoHours: { type: Number, default: 0 },
    sickHours: { type: Number, default: 0 },
    holidayHours: { type: Number, default: 0 },
    payRate: { type: Number, default: 0 },
    billRate: { type: Number, default: 0 },
    estimatedPay: { type: Number, default: 0 },
    estimatedBill: { type: Number, default: 0 },
    estimatedMargin: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["draft", "submitted", "approved", "rejected", "recalled"],
      default: "draft",
    },
    submittedAt: { type: Date, default: null },
    approvedBy: { type: String, default: "" },
    approvedAt: { type: Date, default: null },
    rejectedBy: { type: String, default: "" },
    rejectedAt: { type: Date, default: null },
    rejectionNote: { type: String, default: "" },
    payrollRecordId: { type: String, default: "" },
    invoiceId: { type: String, default: "" },
  },
  { timestamps: true },
);

TimesheetSchema.index({ candidateId: 1, weekStart: 1 }, { unique: true });
TimesheetSchema.index({ employerId: 1, status: 1 });
TimesheetSchema.index({ candidateId: 1, weekStart: -1 });
TimesheetSchema.index({ companyId: 1, status: 1 });

export const Timesheet = mongoose.model<ITimesheet>(
  "Timesheet",
  TimesheetSchema,
);
