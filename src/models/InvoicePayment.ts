import mongoose, { Schema } from "mongoose";

export interface IInvoicePayment {
  _id: string;
  invoiceId: string;
  companyId: string;
  paymentDate: Date;
  amount: number;
  paymentMethod: string;
  referenceNumber: string;
  notes: string;
  recordedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const InvoicePaymentSchema = new Schema<IInvoicePayment>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    invoiceId: { type: String, required: true },
    companyId: { type: String, required: true },
    paymentDate: { type: Date, required: true },
    amount: { type: Number, required: true },
    paymentMethod: {
      type: String,
      enum: ["ACH", "WIRE", "CHECK", "CREDIT_CARD"],
      default: "ACH",
    },
    referenceNumber: { type: String, default: "" },
    notes: { type: String, default: "" },
    recordedBy: { type: String, required: true },
  },
  { timestamps: true },
);

InvoicePaymentSchema.index({ invoiceId: 1 });
InvoicePaymentSchema.index({ companyId: 1, paymentDate: -1 });

export const InvoicePayment = mongoose.model<IInvoicePayment>(
  "InvoicePayment",
  InvoicePaymentSchema,
);
