import mongoose, { Schema } from "mongoose";

export interface IMarketerCandidate {
  _id: string;
  companyId: string;
  marketerId: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  inviteStatus: string;
  inviteToken?: string;
  inviteSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MarketerCandidateSchema = new Schema<IMarketerCandidate>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    companyId: { type: String, required: true },
    marketerId: { type: String, required: true },
    candidateId: { type: String, default: "" },
    candidateName: { type: String, default: "" },
    candidateEmail: { type: String, required: true },
    inviteStatus: { type: String, default: "none" },
    inviteToken: { type: String, sparse: true, unique: true },
    inviteSentAt: { type: Date, default: null },
  },
  { timestamps: true },
);

MarketerCandidateSchema.index(
  { companyId: 1, candidateEmail: 1 },
  { unique: true },
);
MarketerCandidateSchema.index({ marketerId: 1 });

export const MarketerCandidate = mongoose.model<IMarketerCandidate>(
  "MarketerCandidate",
  MarketerCandidateSchema,
);
