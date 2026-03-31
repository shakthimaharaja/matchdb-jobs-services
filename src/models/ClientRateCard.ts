import mongoose, { Schema } from "mongoose";

export interface IClientRateCard {
  _id: string;
  clientId: string;
  companyId: string;
  candidateId: string;
  candidateName: string;
  jobTitle: string;
  billRate: number;
  payRate: number;
  overtimeBillRate: number;
  overtimePayRate: number;
  margin: number;
  marginPercent: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ClientRateCardSchema = new Schema<IClientRateCard>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    clientId: { type: String, required: true },
    companyId: { type: String, required: true },
    candidateId: { type: String, default: "" },
    candidateName: { type: String, default: "" },
    jobTitle: { type: String, default: "" },
    billRate: { type: Number, required: true },
    payRate: { type: Number, required: true },
    overtimeBillRate: { type: Number, default: 0 },
    overtimePayRate: { type: Number, default: 0 },
    margin: { type: Number, default: 0 },
    marginPercent: { type: Number, default: 0 },
    effectiveFrom: { type: Date, default: () => new Date() },
    effectiveTo: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Pre-save: compute margin & marginPercent
ClientRateCardSchema.pre("save", function () {
  this.margin = this.billRate - this.payRate;
  this.marginPercent =
    this.billRate > 0
      ? ((this.billRate - this.payRate) / this.billRate) * 100
      : 0;
});

ClientRateCardSchema.index({ clientId: 1, companyId: 1 });
ClientRateCardSchema.index({ companyId: 1, candidateId: 1 });
ClientRateCardSchema.index({ companyId: 1, isActive: 1 });

export const ClientRateCard = mongoose.model<IClientRateCard>(
  "ClientRateCard",
  ClientRateCardSchema,
);
