import mongoose, { Schema } from "mongoose";
import { randomUUID } from "node:crypto";

export type InviteStatus = "pending" | "accepted" | "expired" | "revoked";

export interface IEmployeeInvitation {
  _id: string;
  companyId: string;
  invitedByAdminId: string;
  inviteeEmail: string;
  inviteeName: string;
  assignedRole: string;
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
    assignedRole: { type: String, default: "viewer" },
    token: { type: String, default: () => randomUUID(), unique: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "expired", "revoked"],
      default: "pending",
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 48 * 60 * 60 * 1000), // 48h
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
