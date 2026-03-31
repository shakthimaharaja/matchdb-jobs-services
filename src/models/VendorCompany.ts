import mongoose, { Schema } from "mongoose";

export type VendorStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";
export type VendorCategory =
  | "STAFFING"
  | "TECHNOLOGY"
  | "CONSULTING"
  | "OTHER";

export interface IVendorCompany {
  _id: string;
  name: string;
  employerId: string;
  companyId: string;
  // Contact
  contactName: string;
  email: string;
  phone: string;
  // Address
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  // Financials
  paymentTerms: number;
  taxId: string;
  // Classification
  category: VendorCategory;
  status: VendorStatus;
  notes: string;
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
    companyId: { type: String, default: "" },
    contactName: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    zip: { type: String, default: "" },
    country: { type: String, default: "US" },
    paymentTerms: { type: Number, default: 30 },
    taxId: { type: String, default: "" },
    category: {
      type: String,
      enum: ["STAFFING", "TECHNOLOGY", "CONSULTING", "OTHER"],
      default: "OTHER",
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "SUSPENDED"],
      default: "ACTIVE",
    },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

VendorCompanySchema.index({ employerId: 1, name: 1 }, { unique: true });
VendorCompanySchema.index({ companyId: 1, status: 1 });

export const VendorCompany = mongoose.model<IVendorCompany>(
  "VendorCompany",
  VendorCompanySchema,
);
