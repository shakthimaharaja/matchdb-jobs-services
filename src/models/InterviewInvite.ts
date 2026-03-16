import mongoose, { Schema } from "mongoose";

export interface IInterviewInvite {
  _id: string;
  vendorId: string;
  vendorEmail: string;
  vendorName: string;
  candidateEmail: string;
  candidateName: string;
  jobId: string;
  jobTitle: string;
  interviewDate?: Date;
  interviewTime: string;
  interviewType: string;
  interviewLink: string;
  notes: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

const InterviewInviteSchema = new Schema<IInterviewInvite>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    vendorId: { type: String, required: true },
    vendorEmail: { type: String, default: "" },
    vendorName: { type: String, default: "" },
    candidateEmail: { type: String, required: true },
    candidateName: { type: String, default: "" },
    jobId: { type: String, default: "" },
    jobTitle: { type: String, default: "" },
    interviewDate: { type: Date, default: null },
    interviewTime: { type: String, default: "" },
    interviewType: { type: String, default: "" },
    interviewLink: { type: String, default: "" },
    notes: { type: String, default: "" },
    status: { type: String, default: "pending" },
  },
  { timestamps: true },
);

InterviewInviteSchema.index({ vendorId: 1, createdAt: -1 });
InterviewInviteSchema.index({ candidateEmail: 1, createdAt: -1 });

export const InterviewInvite = mongoose.model<IInterviewInvite>(
  "InterviewInvite",
  InterviewInviteSchema,
);
