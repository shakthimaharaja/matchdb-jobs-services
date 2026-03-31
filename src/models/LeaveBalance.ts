import mongoose, { Schema } from "mongoose";

export type LeaveType = "PTO" | "SICK" | "VACATION" | "PERSONAL" | "UNPAID";

export interface ILeaveBalance {
  _id: string;
  companyId: string;
  personId: string;
  personType: "WORKER" | "CANDIDATE";
  leaveType: LeaveType;
  year: number;
  totalAllotted: number;
  used: number;
  remaining: number;
  carryOver: number;
  createdAt: Date;
  updatedAt: Date;
}

const LeaveBalanceSchema = new Schema<ILeaveBalance>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    companyId: { type: String, required: true },
    personId: { type: String, required: true },
    personType: {
      type: String,
      enum: ["WORKER", "CANDIDATE"],
      required: true,
    },
    leaveType: {
      type: String,
      enum: ["PTO", "SICK", "VACATION", "PERSONAL", "UNPAID"],
      required: true,
    },
    year: { type: Number, required: true },
    totalAllotted: { type: Number, default: 0 },
    used: { type: Number, default: 0 },
    remaining: { type: Number, default: 0 },
    carryOver: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Compute remaining before save
LeaveBalanceSchema.pre("save", function () {
  this.remaining = this.totalAllotted + this.carryOver - this.used;
});

LeaveBalanceSchema.index(
  { companyId: 1, personId: 1, leaveType: 1, year: 1 },
  { unique: true },
);

export const LeaveBalance = mongoose.model<ILeaveBalance>(
  "LeaveBalance",
  LeaveBalanceSchema,
);
