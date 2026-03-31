import mongoose, { Schema } from "mongoose";

export interface IEmployerCandidate {
  _id: string;
  companyId: string;
  employerId: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  inviteStatus: string;
  inviteToken?: string;
  inviteSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const EmployerCandidateSchema = new Schema<IEmployerCandidate>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    companyId: { type: String, required: true },
    employerId: { type: String, required: true },
    candidateId: { type: String, default: "" },
    candidateName: { type: String, default: "" },
    candidateEmail: { type: String, required: true },
    inviteStatus: { type: String, default: "none" },
    inviteToken: { type: String, sparse: true, unique: true },
    inviteSentAt: { type: Date, default: null },
  },
  { timestamps: true },
);

EmployerCandidateSchema.index(
  { companyId: 1, candidateEmail: 1 },
  { unique: true },
);
EmployerCandidateSchema.index({ employerId: 1 });

export const EmployerCandidate = mongoose.model<IEmployerCandidate>(
  "MarketerCandidate",
  EmployerCandidateSchema,
  "marketercandidates",
);
