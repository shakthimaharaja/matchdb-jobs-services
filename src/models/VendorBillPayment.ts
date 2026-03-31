import mongoose, { Schema } from "mongoose";

export interface IVendorBillPayment {
  _id: string;
  billId: string;
  companyId: string;
  paymentDate: Date;
  amount: number;
  paymentMethod: string;
  referenceNumber: string;
  recordedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const VendorBillPaymentSchema = new Schema<IVendorBillPayment>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    billId: { type: String, required: true },
    companyId: { type: String, required: true },
    paymentDate: { type: Date, required: true },
    amount: { type: Number, required: true },
    paymentMethod: {
      type: String,
      enum: ["ACH", "WIRE", "CHECK", "CREDIT_CARD"],
      default: "ACH",
    },
    referenceNumber: { type: String, default: "" },
    recordedBy: { type: String, required: true },
  },
  { timestamps: true },
);

VendorBillPaymentSchema.index({ billId: 1 });
VendorBillPaymentSchema.index({ companyId: 1, paymentDate: -1 });

export const VendorBillPayment = mongoose.model<IVendorBillPayment>(
  "VendorBillPayment",
  VendorBillPaymentSchema,
);
