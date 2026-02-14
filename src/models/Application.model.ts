import { Schema, model, Document, Types } from 'mongoose';

export type ApplicationStatus = 'pending' | 'reviewing' | 'shortlisted' | 'rejected' | 'hired';

export interface IApplication extends Document {
  _id: Types.ObjectId;
  jobId: string;
  jobTitle: string;
  candidateId: string;
  candidateEmail: string;
  coverLetter: string;
  status: ApplicationStatus;
  createdAt: Date;
  updatedAt: Date;
}

const ApplicationSchema = new Schema<IApplication>(
  {
    jobId: { type: String, required: true, index: true },
    jobTitle: { type: String, default: '' },
    candidateId: { type: String, required: true, index: true },
    candidateEmail: { type: String, required: true },
    coverLetter: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'reviewing', 'shortlisted', 'rejected', 'hired'],
      default: 'pending',
    },
  },
  { timestamps: true },
);

// Prevent duplicate applications
ApplicationSchema.index({ jobId: 1, candidateId: 1 }, { unique: true });

export const Application = model<IApplication>('Application', ApplicationSchema);
