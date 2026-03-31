import mongoose, { Schema } from "mongoose";

export interface ICompanyAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface ICompany {
  _id: string;
  displayId: string; // e.g. "CMP-0001" — human-readable unique company ID
  name: string;
  legalName: string;
  ein: string;
  address: ICompanyAddress;
  phone: string;
  email: string;
  website: string;
  industry: string;
  companySize: string;
  logoUrl: string;
  /** The shell User._id of the initial admin who created the company */
  adminUserId: string;
  adminEmail: string;
  // ── Subscription fields ──
  subscriptionPlanId: string | null;
  subscriptionStatus: "active" | "cancelled" | "expired" | "past_due" | "none";
  billingCycle: "monthly" | "yearly";
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  extraAdminCount: number;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const AddressSchema = new Schema<ICompanyAddress>(
  {
    street: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    zip: { type: String, default: "" },
    country: { type: String, default: "US" },
  },
  { _id: false },
);

const CompanySchema = new Schema<ICompany>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    displayId: { type: String, default: "", unique: true, sparse: true },
    name: { type: String, required: true },
    legalName: { type: String, default: "" },
    ein: { type: String, default: "" },
    address: { type: AddressSchema, default: () => ({}) },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    website: { type: String, default: "" },
    industry: { type: String, default: "" },
    companySize: { type: String, default: "" },
    logoUrl: { type: String, default: "" },
    adminUserId: { type: String, required: true },
    adminEmail: { type: String, required: true },
    // Subscription
    subscriptionPlanId: { type: String, default: null },
    subscriptionStatus: {
      type: String,
      enum: ["active", "cancelled", "expired", "past_due", "none"],
      default: "none",
    },
    billingCycle: {
      type: String,
      enum: ["monthly", "yearly"],
      default: "monthly",
    },
    currentPeriodStart: { type: Date, default: null },
    currentPeriodEnd: { type: Date, default: null },
    extraAdminCount: { type: Number, default: 0 },
    stripeCustomerId: { type: String, default: null },
    stripeSubscriptionId: { type: String, default: null },
  },
  { timestamps: true },
);

CompanySchema.index({ name: 1 });
CompanySchema.index({ adminUserId: 1 }, { unique: true });
CompanySchema.index({ adminEmail: 1 });

export const Company = mongoose.model<ICompany>("Company", CompanySchema);
