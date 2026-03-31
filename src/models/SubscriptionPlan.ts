import mongoose, { Schema } from "mongoose";

export interface ISubscriptionPlan {
  _id: string;
  name: string;
  slug: string; // "starter" | "growth" | "business" | "enterprise"
  maxJobPostings: number | null; // null = unlimited
  maxCandidates: number | null;
  maxWorkers: number | null;
  priceMonthly: number;
  priceYearly: number;
  extraAdminFee: number; // per additional admin per month
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionPlanSchema = new Schema<ISubscriptionPlan>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    maxJobPostings: { type: Number, default: null },
    maxCandidates: { type: Number, default: null },
    maxWorkers: { type: Number, default: null },
    priceMonthly: { type: Number, default: 0 },
    priceYearly: { type: Number, default: 0 },
    extraAdminFee: { type: Number, default: 20 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const SubscriptionPlan = mongoose.model<ISubscriptionPlan>(
  "SubscriptionPlan",
  SubscriptionPlanSchema,
);

/** Seed the default plans — call once during app startup or migration. */
export const DEFAULT_PLANS: Omit<
  ISubscriptionPlan,
  "_id" | "createdAt" | "updatedAt"
>[] = [
  {
    name: "Starter",
    slug: "starter",
    maxJobPostings: 5,
    maxCandidates: 50,
    maxWorkers: 3,
    priceMonthly: 49,
    priceYearly: 490,
    extraAdminFee: 20,
    isActive: true,
  },
  {
    name: "Growth",
    slug: "growth",
    maxJobPostings: 25,
    maxCandidates: 250,
    maxWorkers: 10,
    priceMonthly: 149,
    priceYearly: 1490,
    extraAdminFee: 20,
    isActive: true,
  },
  {
    name: "Business",
    slug: "business",
    maxJobPostings: 100,
    maxCandidates: 1000,
    maxWorkers: 30,
    priceMonthly: 399,
    priceYearly: 3990,
    extraAdminFee: 20,
    isActive: true,
  },
  {
    name: "Enterprise",
    slug: "enterprise",
    maxJobPostings: null,
    maxCandidates: null,
    maxWorkers: null,
    priceMonthly: 0, // custom pricing
    priceYearly: 0,
    extraAdminFee: 20,
    isActive: true,
  },
];
