import mongoose, { Schema } from "mongoose";
import { randomUUID } from "node:crypto";

export type CandidateInviteStatus =
  | "pending"
  | "payment_pending"
  | "active"
  | "expired"
  | "revoked";

export type PaymentStatus = "unpaid" | "paid" | "failed" | "refunded";

export interface ICandidateInvitation {
  _id: string;
  companyId: string;
  companyName: string;
  invitedByUserId: string;
  invitedByName: string;
  invitedByRole: "admin" | "marketing";
  candidateName: string;
  candidateEmail: string;
  candidatePlan: string; // tier id
  candidatePlanName: string; // display name
  jobTitle: string;
  personalNote: string;
  token: string;
  tokenExpiresAt: Date;
  status: CandidateInviteStatus;
  paymentStatus: PaymentStatus;
  paymentSessionId: string;
  registeredAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const CandidateInvitationSchema = new Schema<ICandidateInvitation>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    companyId: { type: String, required: true },
    companyName: { type: String, default: "" },
    invitedByUserId: { type: String, required: true },
    invitedByName: { type: String, default: "" },
    invitedByRole: {
      type: String,
      enum: ["admin", "marketing"],
      required: true,
    },
    candidateName: { type: String, default: "" },
    candidateEmail: { type: String, required: true },
    candidatePlan: { type: String, required: true },
    candidatePlanName: { type: String, default: "" },
    jobTitle: { type: String, default: "" },
    personalNote: { type: String, default: "" },
    token: { type: String, default: () => randomUUID(), unique: true },
    tokenExpiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 72 * 60 * 60 * 1000), // 72h
    },
    status: {
      type: String,
      enum: ["pending", "payment_pending", "active", "expired", "revoked"],
      default: "pending",
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid", "failed", "refunded"],
      default: "unpaid",
    },
    paymentSessionId: { type: String, default: "" },
    registeredAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true },
);

CandidateInvitationSchema.index({ companyId: 1, candidateEmail: 1 });
CandidateInvitationSchema.index({ companyId: 1, status: 1 });
CandidateInvitationSchema.index({ tokenExpiresAt: 1 });

export const CandidateInvitation = mongoose.model<ICandidateInvitation>(
  "CandidateInvitation",
  CandidateInvitationSchema,
);
