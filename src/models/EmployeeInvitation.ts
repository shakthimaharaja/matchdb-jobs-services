import mongoose, { Schema } from "mongoose";
import { randomUUID } from "node:crypto";

export type InviteStatus = "pending" | "accepted" | "expired" | "revoked";

export interface IEmployeeInvitation {
  _id: string;
  companyId: string;
  invitedByAdminId: string;
  inviteeEmail: string;
  inviteeName: string;
  assignedRole: string; // "admin" | "manager" | "vendor" | "marketer"
  assignedDepartment: string | null; // only if role = marketer
  token: string;
  status: InviteStatus;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const EmployeeInvitationSchema = new Schema<IEmployeeInvitation>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    companyId: { type: String, required: true },
    invitedByAdminId: { type: String, required: true },
    inviteeEmail: { type: String, required: true },
    inviteeName: { type: String, default: "" },
    assignedRole: {
      type: String,
      enum: ["admin", "manager", "vendor", "marketer"],
      default: "vendor",
    },
    assignedDepartment: {
      type: String,
      enum: ["accounts", "immigration", "placement", null],
      default: null,
    },
    token: { type: String, default: () => randomUUID(), unique: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "expired", "revoked"],
      default: "pending",
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 72 * 60 * 60 * 1000), // 72h
    },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

EmployeeInvitationSchema.index({ companyId: 1, inviteeEmail: 1 });
EmployeeInvitationSchema.index({ expiresAt: 1 });

export const EmployeeInvitation = mongoose.model<IEmployeeInvitation>(
  "EmployeeInvitation",
  EmployeeInvitationSchema,
);
