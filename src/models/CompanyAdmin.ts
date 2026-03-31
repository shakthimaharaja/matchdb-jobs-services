import mongoose, { Schema } from "mongoose";

/**
 * CompanyAdmin — tracks per-company admin configuration, seat usage,
 * and references the active subscription plan.
 */
export interface ICompanyAdmin {
  _id: string;
  companyId: string;
  companyName: string;
  adminUserId: string;
  adminEmail: string;
  adminName: string;
  subscriptionPlanId: string | null; // refs SubscriptionPlan._id
  seatLimit: number;
  seatsUsed: number;
  createdAt: Date;
  updatedAt: Date;
}

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
    subscriptionPlanId: { type: String, default: null },
    seatLimit: { type: Number, default: 3 }, // starter default
    seatsUsed: { type: Number, default: 0 },
  },
  { timestamps: true },
);

CompanyAdminSchema.index({ adminEmail: 1 });

export const CompanyAdmin = mongoose.model<ICompanyAdmin>(
  "CompanyAdmin",
  CompanyAdminSchema,
);
