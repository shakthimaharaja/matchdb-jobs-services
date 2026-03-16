import mongoose, { Schema } from "mongoose";

export interface IJob {
  _id: string;
  vendorId: string;
  vendorEmail: string;
  recruiterName: string;
  recruiterPhone: string;
  title: string;
  description: string;
  location: string;
  jobCountry: string;
  jobState: string;
  jobCity: string;
  jobType: string;
  jobSubType: string;
  workMode: string;
  salaryMin?: number;
  salaryMax?: number;
  payPerHour?: number;
  skillsRequired: string[];
  experienceRequired: number;
  applicationCount: number;
  isActive: boolean;
  sourceUserId: string;
  sourceCompanyId: string;
  createdAt: Date;
  updatedAt: Date;
}

const JobSchema = new Schema<IJob>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    vendorId: { type: String, required: true },
    vendorEmail: { type: String, required: true },
    recruiterName: { type: String, default: "" },
    recruiterPhone: { type: String, default: "" },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    location: { type: String, default: "" },
    jobCountry: { type: String, default: "" },
    jobState: { type: String, default: "" },
    jobCity: { type: String, default: "" },
    jobType: { type: String, required: true },
    jobSubType: { type: String, default: "" },
    workMode: { type: String, default: "" },
    salaryMin: { type: Number, default: null },
    salaryMax: { type: Number, default: null },
    payPerHour: { type: Number, default: null },
    skillsRequired: { type: [String], default: [] },
    experienceRequired: { type: Number, default: 0 },
    applicationCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    sourceUserId: { type: String, default: "" },
    sourceCompanyId: { type: String, default: "" },
  },
  { timestamps: true },
);

JobSchema.index({ vendorId: 1, createdAt: -1 });
JobSchema.index({ isActive: 1, createdAt: -1 });
JobSchema.index({ sourceUserId: 1 });

export const Job = mongoose.model<IJob>("Job", JobSchema);
