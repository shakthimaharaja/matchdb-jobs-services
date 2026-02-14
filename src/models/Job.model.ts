import { Schema, model, Document, Types } from 'mongoose';

export interface IJob extends Document {
  _id: Types.ObjectId;
  title: string;
  description: string;
  vendorId: string;
  vendorEmail: string;
  recruiterName: string;
  recruiterPhone: string;
  location: string;
  jobType: 'full_time' | 'part_time' | 'contract' | 'remote' | 'internship';
  salaryMin: number | null;
  salaryMax: number | null;
  payPerHour: number | null;
  skillsRequired: string[];
  experienceRequired: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const JobSchema = new Schema<IJob>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    vendorId: { type: String, required: true, index: true },
    vendorEmail: { type: String, required: true },
    recruiterName: { type: String, default: '' },
    recruiterPhone: { type: String, default: '' },
    location: { type: String, default: '' },
    jobType: {
      type: String,
      enum: ['full_time', 'part_time', 'contract', 'remote', 'internship'],
      default: 'full_time',
    },
    salaryMin: { type: Number, default: null },
    salaryMax: { type: Number, default: null },
    payPerHour: { type: Number, default: null },
    skillsRequired: [{ type: String }],
    experienceRequired: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

export const Job = model<IJob>('Job', JobSchema);
