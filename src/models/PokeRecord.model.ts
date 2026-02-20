import { Schema, model, Document } from 'mongoose';

export interface IPokeRecord extends Document {
  senderId: string;
  senderName: string;
  senderEmail: string;
  senderType: 'vendor' | 'candidate';
  targetId: string;         // candidateProfileId (vendor→candidate) | jobId (candidate→vendor)
  targetVendorId?: string;  // vendorId of the job — set when candidate sends (for vendor received query)
  targetEmail: string;
  targetName: string;
  subject: string;
  isEmail: boolean;         // false = quick poke, true = mail template
  jobId?: string;
  jobTitle?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PokeRecordSchema = new Schema<IPokeRecord>(
  {
    senderId:       { type: String, required: true, index: true },
    senderName:     { type: String, default: '' },
    senderEmail:    { type: String, default: '' },
    senderType:     { type: String, enum: ['vendor', 'candidate'], required: true },
    targetId:       { type: String, required: true, index: true },
    targetVendorId: { type: String, index: true },
    targetEmail:    { type: String, required: true },
    targetName:     { type: String, default: '' },
    subject:        { type: String, default: '' },
    isEmail:        { type: Boolean, default: false },
    jobId:          { type: String },
    jobTitle:       { type: String },
  },
  { timestamps: true },
);

// One poke AND one email allowed per sender+target (separate records per isEmail value)
PokeRecordSchema.index({ senderId: 1, targetId: 1, isEmail: 1 }, { unique: true });

export const PokeRecord = model<IPokeRecord>('PokeRecord', PokeRecordSchema);
