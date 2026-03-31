import mongoose, { Schema } from "mongoose";

export interface ITimesheet {
  _id: string;
  candidateId: string;
  candidateName: string;
  employerId: string;
  companyId: string;
  applicationId: string;
  jobTitle: string;
  weekStart: Date;
  entries: any;
  totalHours: number;
  status: string;
  submittedAt?: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  rejectionNote: string;
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
    entries: { type: Schema.Types.Mixed, default: null },
    totalHours: { type: Number, default: 0 },
    status: { type: String, default: "draft" },
    submittedAt: { type: Date, default: null },
    approvedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    rejectionNote: { type: String, default: "" },
  },
  { timestamps: true },
);

TimesheetSchema.index({ candidateId: 1, weekStart: 1 }, { unique: true });
TimesheetSchema.index({ employerId: 1, status: 1 });
TimesheetSchema.index({ candidateId: 1, weekStart: -1 });

export const Timesheet = mongoose.model<ITimesheet>(
  "Timesheet",
  TimesheetSchema,
);
