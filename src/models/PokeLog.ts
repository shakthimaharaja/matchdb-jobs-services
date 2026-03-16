import mongoose, { Schema } from "mongoose";

export interface IPokeLog {
  _id: string;
  userId: string;
  yearMonth: string;
  count: number;
  createdAt: Date;
  updatedAt: Date;
}

const PokeLogSchema = new Schema<IPokeLog>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    userId: { type: String, required: true },
    yearMonth: { type: String, required: true },
    count: { type: Number, default: 0 },
  },
  { timestamps: true },
);

PokeLogSchema.index({ userId: 1, yearMonth: 1 }, { unique: true });

export const PokeLog = mongoose.model<IPokeLog>("PokeLog", PokeLogSchema);
