import mongoose, { Schema } from "mongoose";

export type ExpenseCategoryType = "REVENUE" | "EXPENSE" | "PAYROLL" | "TAX";

export interface IExpenseCategory {
  _id: string;
  companyId: string;
  name: string;
  type: ExpenseCategoryType;
  parentId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseCategorySchema = new Schema<IExpenseCategory>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    companyId: { type: String, required: true },
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ["REVENUE", "EXPENSE", "PAYROLL", "TAX"],
      required: true,
    },
    parentId: { type: String, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

ExpenseCategorySchema.index({ companyId: 1, type: 1 });
ExpenseCategorySchema.index({ companyId: 1, isActive: 1 });

export const ExpenseCategory = mongoose.model<IExpenseCategory>(
  "ExpenseCategory",
  ExpenseCategorySchema,
);
