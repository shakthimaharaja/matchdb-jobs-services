import mongoose, { Schema } from "mongoose";
import { randomUUID } from "node:crypto";

export interface ICompanyInvite {
  _id: string;
  companyId: string;
  companyName: string;
  marketerId: string;
  marketerEmail: string;
  candidateEmail: string;
  candidateName: string;
  offerNote: string;
  token: string;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CompanyInviteSchema = new Schema<ICompanyInvite>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    companyId: { type: String, required: true },
    companyName: { type: String, default: "" },
    marketerId: { type: String, required: true },
    marketerEmail: { type: String, default: "" },
    candidateEmail: { type: String, required: true },
    candidateName: { type: String, default: "" },
    offerNote: { type: String, default: "" },
    token: { type: String, default: () => randomUUID(), unique: true },
    status: { type: String, default: "pending" },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true },
);

CompanyInviteSchema.index(
  { companyId: 1, candidateEmail: 1 },
  { unique: true },
);

export const CompanyInvite = mongoose.model<ICompanyInvite>(
  "CompanyInvite",
  CompanyInviteSchema,
);
