import mongoose, { Schema } from "mongoose";

export type TimesheetAuditAction =
  | "CREATED"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "RECALLED"
  | "ENTRY_ADDED"
  | "ENTRY_UPDATED"
  | "ENTRY_DELETED"
  | "COMMENT_ADDED"
  | "STATUS_CHANGED";

export interface ITimesheetAuditLog {
  _id: string;
  timesheetId: string;
  action: TimesheetAuditAction;
  performedBy: string;
  previousValue: string;
  newValue: string;
  notes: string;
  ipAddress: string;
  createdAt: Date;
  updatedAt: Date;
}

const TimesheetAuditLogSchema = new Schema<ITimesheetAuditLog>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    timesheetId: { type: String, required: true },
    action: {
      type: String,
      enum: [
        "CREATED",
        "SUBMITTED",
        "APPROVED",
        "REJECTED",
        "RECALLED",
        "ENTRY_ADDED",
        "ENTRY_UPDATED",
        "ENTRY_DELETED",
        "COMMENT_ADDED",
        "STATUS_CHANGED",
      ],
      required: true,
    },
    performedBy: { type: String, required: true },
    previousValue: { type: String, default: "" },
    newValue: { type: String, default: "" },
    notes: { type: String, default: "" },
    ipAddress: { type: String, default: "" },
  },
  { timestamps: true },
);

TimesheetAuditLogSchema.index({ timesheetId: 1, createdAt: -1 });
TimesheetAuditLogSchema.index({ performedBy: 1 });

export const TimesheetAuditLog = mongoose.model<ITimesheetAuditLog>(
  "TimesheetAuditLog",
  TimesheetAuditLogSchema,
);
