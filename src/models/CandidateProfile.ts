import mongoose, { Schema } from "mongoose";

export interface ICandidateProfile {
  _id: string;
  candidateId: string;
  displayId: string; // e.g. "CND-0001" — human-readable unique candidate ID
  username: string;
  name: string;
  email: string;
  phone: string;
  currentCompany: string;
  currentRole: string;
  preferredJobType: string;
  expectedHourlyRate?: number;
  experienceYears: number;
  skills: string[];
  location: string;
  profileCountry: string;
  bio: string;
  resumeSummary: string;
  resumeExperience: string;
  resumeEducation: string;
  resumeAchievements: string;
  visibilityConfig?: Record<string, string[]>;
  companyId: string;
  companyName: string;
  profileLocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CandidateProfileSchema = new Schema<ICandidateProfile>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    candidateId: { type: String, required: true, unique: true },
    displayId: { type: String, default: "", unique: true, sparse: true },
    username: { type: String, default: "" },
    name: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    currentCompany: { type: String, default: "" },
    currentRole: { type: String, default: "" },
    preferredJobType: { type: String, default: "" },
    expectedHourlyRate: { type: Number, default: null },
    experienceYears: { type: Number, default: 0 },
    skills: { type: [String], default: [] },
    location: { type: String, default: "" },
    profileCountry: { type: String, default: "" },
    bio: { type: String, default: "" },
    resumeSummary: { type: String, default: "" },
    resumeExperience: { type: String, default: "" },
    resumeEducation: { type: String, default: "" },
    resumeAchievements: { type: String, default: "" },
    visibilityConfig: { type: Schema.Types.Mixed, default: null },
    companyId: { type: String, default: "" },
    companyName: { type: String, default: "" },
    profileLocked: { type: Boolean, default: false },
  },
  { timestamps: true },
);

CandidateProfileSchema.index({ createdAt: -1 });
CandidateProfileSchema.index({ companyId: 1 });

export const CandidateProfile = mongoose.model<ICandidateProfile>(
  "CandidateProfile",
  CandidateProfileSchema,
);
