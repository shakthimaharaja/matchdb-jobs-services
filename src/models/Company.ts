import mongoose, { Schema } from "mongoose";

export interface ICompany {
  _id: string;
  name: string;
  marketerId: string;
  marketerEmail: string;
  createdAt: Date;
  updatedAt: Date;
}

const CompanySchema = new Schema<ICompany>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    name: { type: String, required: true },
    marketerId: { type: String, required: true, unique: true },
    marketerEmail: { type: String, required: true },
  },
  { timestamps: true },
);

CompanySchema.index({ name: 1 });

export const Company = mongoose.model<ICompany>("Company", CompanySchema);
