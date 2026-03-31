import mongoose, { Schema } from "mongoose";

export type InvoiceStatus =
  | "DRAFT"
  | "SENT"
  | "VIEWED"
  | "PARTIAL"
  | "PAID"
  | "OVERDUE"
  | "VOID"
  | "WRITE_OFF";

export interface IInvoiceLineItem {
  candidateId: string;
  candidateName: string;
  description: string;
  hours: number;
  rate: number;
  amount: number;
  periodStart: Date | null;
  periodEnd: Date | null;
  timesheetId: string;
  sortOrder: number;
}

export interface IInvoice {
  _id: string;
  companyId: string;
  clientId: string;
  clientName: string;
  invoiceNumber: string;
  poNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  lineItems: IInvoiceLineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  status: InvoiceStatus;
  notes: string;
  pdfUrl: string;
  sentAt: Date | null;
  paidAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceLineItemSchema = new Schema<IInvoiceLineItem>(
  {
    candidateId: { type: String, default: "" },
    candidateName: { type: String, default: "" },
    description: { type: String, required: true },
    hours: { type: Number, default: 0 },
    rate: { type: Number, default: 0 },
    amount: { type: Number, required: true },
    periodStart: { type: Date, default: null },
    periodEnd: { type: Date, default: null },
    timesheetId: { type: String, default: "" },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: false },
);

const InvoiceSchema = new Schema<IInvoice>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    companyId: { type: String, required: true },
    clientId: { type: String, required: true },
    clientName: { type: String, default: "" },
    invoiceNumber: { type: String, required: true, unique: true },
    poNumber: { type: String, default: "" },
    invoiceDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    lineItems: { type: [InvoiceLineItemSchema], default: [] },
    subtotal: { type: Number, required: true },
    taxRate: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    amountPaid: { type: Number, default: 0 },
    balanceDue: { type: Number, default: 0 },
    status: {
      type: String,
      enum: [
        "DRAFT",
        "SENT",
        "VIEWED",
        "PARTIAL",
        "PAID",
        "OVERDUE",
        "VOID",
        "WRITE_OFF",
      ],
      default: "DRAFT",
    },
    notes: { type: String, default: "" },
    pdfUrl: { type: String, default: "" },
    sentAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

InvoiceSchema.index({ companyId: 1, status: 1 });
InvoiceSchema.index({ companyId: 1, clientId: 1 });
InvoiceSchema.index({ companyId: 1, dueDate: 1 });

export const Invoice = mongoose.model<IInvoice>("Invoice", InvoiceSchema);
