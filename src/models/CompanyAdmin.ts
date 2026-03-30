import mongoose, { Schema } from "mongoose";

export type SubscriptionPlan = "basic" | "pro";

export interface ICompanyAdmin {
  _id: string;
  companyId: string;
  companyName: string;
  adminUserId: string;
  adminEmail: string;
  adminName: string;
  subscriptionPlan: SubscriptionPlan;
  seatLimit: number;
  seatsUsed: number;
  createdAt: Date;
  updatedAt: Date;
}

export const PLAN_SEAT_LIMITS: Record<SubscriptionPlan, number> = {
  basic: 5,
  pro: 10,
};

const CompanyAdminSchema = new Schema<ICompanyAdmin>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    companyId: { type: String, required: true, unique: true },
    companyName: { type: String, required: true },
    adminUserId: { type: String, required: true, unique: true },
    adminEmail: { type: String, required: true },
    adminName: { type: String, default: "" },
    subscriptionPlan: {
      type: String,
      enum: ["basic", "pro"],
      default: "basic",
    },
    seatLimit: { type: Number, default: PLAN_SEAT_LIMITS.basic },
    seatsUsed: { type: Number, default: 0 },
  },
  { timestamps: true },
);

CompanyAdminSchema.index({ adminEmail: 1 });

export const CompanyAdmin = mongoose.model<ICompanyAdmin>(
  "CompanyAdmin",
  CompanyAdminSchema,
);
