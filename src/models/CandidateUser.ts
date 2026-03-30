import mongoose, { Schema } from "mongoose";

export type CandidateAccountStatus =
  | "pending"
  | "active"
  | "inactive"
  | "suspended";

export interface ICandidateUser {
  _id: string;
  userType: "candidate";
  companyId: string;
  invitationId: string;
  fullName: string;
  email: string;
  phone: string;
  profilePhoto: string;
  candidatePlan: string;
  paymentStatus: "unpaid" | "paid" | "failed" | "refunded";
  subscriptionId: string;
  stripeCustomerId: string;
  status: CandidateAccountStatus;
  activatedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const CandidateUserSchema = new Schema<ICandidateUser>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    userType: { type: String, default: "candidate" },
    companyId: { type: String, required: true },
    invitationId: { type: String, required: true },
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, default: "" },
    profilePhoto: { type: String, default: "" },
    candidatePlan: { type: String, required: true },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid", "failed", "refunded"],
      default: "unpaid",
    },
    subscriptionId: { type: String, default: "" },
    stripeCustomerId: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "active", "inactive", "suspended"],
      default: "pending",
    },
    activatedAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

CandidateUserSchema.index({ companyId: 1 });
CandidateUserSchema.index({ companyId: 1, status: 1 });

export const CandidateUser = mongoose.model<ICandidateUser>(
  "CandidateUser",
  CandidateUserSchema,
);
