import mongoose, { Schema } from "mongoose";

export interface IVendorCompany {
  _id: string;
  name: string;
  employerId: string;
  createdAt: Date;
  updatedAt: Date;
}

const VendorCompanySchema = new Schema<IVendorCompany>(
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

VendorCompanySchema.index({ employerId: 1, name: 1 }, { unique: true });

export const VendorCompany = mongoose.model<IVendorCompany>(
  "VendorCompany",
  VendorCompanySchema,
);
