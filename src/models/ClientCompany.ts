import mongoose, { Schema } from "mongoose";

export type ClientStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PROSPECT";

export interface IClientCompany {
  _id: string;
  name: string;
  legalName: string;
  employerId: string;
  companyId: string;
  // Contact
  billingEmail: string;
  billingContact: string;
  phone: string;
  // Address
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  // Financials
  paymentTerms: number; // days (e.g. 30, 60, 90)
  creditLimit: number;
  taxId: string;
  // Status
  status: ClientStatus;
  notes: string;
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
    legalName: { type: String, default: "" },
    employerId: { type: String, required: true },
    companyId: { type: String, default: "" },
    billingEmail: { type: String, default: "" },
    billingContact: { type: String, default: "" },
    phone: { type: String, default: "" },
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    zip: { type: String, default: "" },
    country: { type: String, default: "US" },
    paymentTerms: { type: Number, default: 30 },
    creditLimit: { type: Number, default: 0 },
    taxId: { type: String, default: "" },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "SUSPENDED", "PROSPECT"],
      default: "ACTIVE",
    },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

ClientCompanySchema.index({ employerId: 1, name: 1 }, { unique: true });
ClientCompanySchema.index({ companyId: 1, status: 1 });

export const ClientCompany = mongoose.model<IClientCompany>(
  "ClientCompany",
  ClientCompanySchema,
);
