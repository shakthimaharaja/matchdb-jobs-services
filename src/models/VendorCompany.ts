import mongoose, { Schema } from "mongoose";

export interface IVendorCompany {
  _id: string;
  name: string;
  marketerId: string;
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
    marketerId: { type: String, required: true },
  },
  { timestamps: true },
);

VendorCompanySchema.index({ marketerId: 1, name: 1 }, { unique: true });

export const VendorCompany = mongoose.model<IVendorCompany>(
  "VendorCompany",
  VendorCompanySchema,
);
