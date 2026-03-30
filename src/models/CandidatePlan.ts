import mongoose, { Schema } from "mongoose";

export type CandidatePlanTier = "basic" | "standard" | "premium";
export type BillingCycle = "monthly" | "yearly" | "one-time";

export interface ICandidatePlan {
  _id: string;
  companyId: string;
  planName: string;
  tier: CandidatePlanTier;
  price: number;
  currency: string;
  billingCycle: BillingCycle;
  features: string[];
  stripePriceId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CandidatePlanSchema = new Schema<ICandidatePlan>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    companyId: { type: String, required: true },
    planName: { type: String, required: true },
    tier: {
      type: String,
      enum: ["basic", "standard", "premium"],
      default: "basic",
    },
    price: { type: Number, required: true },
    currency: { type: String, default: "USD" },
    billingCycle: {
      type: String,
      enum: ["monthly", "yearly", "one-time"],
      default: "monthly",
    },
    features: { type: [String], default: [] },
    stripePriceId: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

CandidatePlanSchema.index({ companyId: 1, tier: 1 });

export const CandidatePlan = mongoose.model<ICandidatePlan>(
  "CandidatePlan",
  CandidatePlanSchema,
);
