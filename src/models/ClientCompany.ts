import mongoose, { Schema } from "mongoose";

export interface IClientCompany {
  _id: string;
  name: string;
  marketerId: string;
  createdAt: Date;
  updatedAt: Date;
}

const ClientCompanySchema = new Schema<IClientCompany>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    name: { type: String, required: true },
    marketerId: { type: String, required: true },
  },
  { timestamps: true },
);

ClientCompanySchema.index({ marketerId: 1, name: 1 }, { unique: true });

export const ClientCompany = mongoose.model<IClientCompany>(
  "ClientCompany",
  ClientCompanySchema,
);
