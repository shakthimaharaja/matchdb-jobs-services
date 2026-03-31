import mongoose, { Schema } from "mongoose";

export interface IClientCompany {
  _id: string;
  name: string;
  employerId: string;
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
    employerId: { type: String, required: true },
  },
  { timestamps: true },
);

ClientCompanySchema.index({ employerId: 1, name: 1 }, { unique: true });

export const ClientCompany = mongoose.model<IClientCompany>(
  "ClientCompany",
  ClientCompanySchema,
);
