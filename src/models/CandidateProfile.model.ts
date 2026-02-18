import { Schema, model, Document, Types } from "mongoose";

export interface ICandidateProfile extends Document {
  _id: Types.ObjectId;
  candidateId: string;
  name: string;
  email: string;
  phone: string;
  currentCompany: string;
  currentRole: string;
  preferredJobType: string;
  expectedHourlyRate: number | null;
  experienceYears: number;
  skills: string[];
  location: string;
  bio: string;
  // Resume sections — captured on profile creation, locked after
  resumeSummary: string;
  resumeExperience: string;
  resumeEducation: string;
  resumeAchievements: string;
  visibilityConfig: Record<string, string[]>;
  profileLocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CandidateProfileSchema = new Schema<ICandidateProfile>(
  {
    candidateId: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    currentCompany: { type: String, default: "" },
    currentRole: { type: String, default: "" },
    preferredJobType: { type: String, default: "" },
    expectedHourlyRate: { type: Number, default: null },
    experienceYears: { type: Number, default: 0 },
    skills: [{ type: String }],
    location: { type: String, default: "" },
    bio: { type: String, default: "" },
    resumeSummary: { type: String, default: "" },
    resumeExperience: { type: String, default: "" },
    resumeEducation: { type: String, default: "" },
    resumeAchievements: { type: String, default: "" },
    visibilityConfig: { type: Schema.Types.Mixed, default: {} },
    profileLocked: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const CandidateProfile = model<ICandidateProfile>(
  "CandidateProfile",
  CandidateProfileSchema,
);
