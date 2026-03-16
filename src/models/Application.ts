import mongoose, { Schema } from "mongoose";

export interface IApplication {
  _id: string;
  jobId: string;
  jobTitle: string;
  candidateId: string;
  candidateEmail: string;
  coverLetter: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

const ApplicationSchema = new Schema<IApplication>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    jobId: { type: String, required: true },
    jobTitle: { type: String, default: "" },
    candidateId: { type: String, required: true },
    candidateEmail: { type: String, required: true },
    coverLetter: { type: String, default: "" },
    status: { type: String, default: "pending" },
  },
  { timestamps: true },
);

ApplicationSchema.index({ jobId: 1, candidateId: 1 }, { unique: true });
ApplicationSchema.index({ candidateId: 1 });

export const Application = mongoose.model<IApplication>(
  "Application",
  ApplicationSchema,
);
