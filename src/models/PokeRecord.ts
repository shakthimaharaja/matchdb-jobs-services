import mongoose, { Schema } from "mongoose";

export interface IPokeRecord {
  _id: string;
  senderId: string;
  senderName: string;
  senderEmail: string;
  senderType: string;
  targetId: string;
  targetVendorId?: string;
  targetEmail: string;
  targetName: string;
  subject: string;
  isEmail: boolean;
  jobId?: string;
  jobTitle?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PokeRecordSchema = new Schema<IPokeRecord>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    senderId: { type: String, required: true },
    senderName: { type: String, default: "" },
    senderEmail: { type: String, default: "" },
    senderType: { type: String, required: true },
    targetId: { type: String, required: true },
    targetVendorId: { type: String, default: null },
    targetEmail: { type: String, required: true },
    targetName: { type: String, default: "" },
    subject: { type: String, default: "" },
    isEmail: { type: Boolean, default: false },
    jobId: { type: String, default: null },
    jobTitle: { type: String, default: null },
  },
  { timestamps: true },
);

PokeRecordSchema.index(
  { senderId: 1, targetId: 1, isEmail: 1 },
  { unique: true },
);
PokeRecordSchema.index({ senderId: 1 });
PokeRecordSchema.index({ targetId: 1 });

export const PokeRecord = mongoose.model<IPokeRecord>(
  "PokeRecord",
  PokeRecordSchema,
);
