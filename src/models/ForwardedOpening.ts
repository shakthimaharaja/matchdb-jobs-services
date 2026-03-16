import mongoose, { Schema } from "mongoose";

export interface IForwardedOpening {
  _id: string;
  marketerId: string;
  marketerEmail: string;
  companyId: string;
  companyName: string;
  candidateEmail: string;
  candidateName: string;
  jobId: string;
  jobTitle: string;
  jobLocation: string;
  jobType: string;
  jobSubType: string;
  vendorEmail: string;
  skillsRequired: string[];
  payPerHour?: number;
  salaryMin?: number;
  salaryMax?: number;
  note: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

const ForwardedOpeningSchema = new Schema<IForwardedOpening>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    marketerId: { type: String, required: true },
    marketerEmail: { type: String, default: "" },
    companyId: { type: String, required: true },
    companyName: { type: String, default: "" },
    candidateEmail: { type: String, required: true },
    candidateName: { type: String, default: "" },
    jobId: { type: String, required: true },
    jobTitle: { type: String, default: "" },
    jobLocation: { type: String, default: "" },
    jobType: { type: String, default: "" },
    jobSubType: { type: String, default: "" },
    vendorEmail: { type: String, default: "" },
    skillsRequired: { type: [String], default: [] },
    payPerHour: { type: Number, default: null },
    salaryMin: { type: Number, default: null },
    salaryMax: { type: Number, default: null },
    note: { type: String, default: "" },
    status: { type: String, default: "pending" },
  },
  { timestamps: true },
);

ForwardedOpeningSchema.index(
  { marketerId: 1, candidateEmail: 1, jobId: 1 },
  { unique: true },
);
ForwardedOpeningSchema.index({ candidateEmail: 1, createdAt: -1 });

export const ForwardedOpening = mongoose.model<IForwardedOpening>(
  "ForwardedOpening",
  ForwardedOpeningSchema,
);
