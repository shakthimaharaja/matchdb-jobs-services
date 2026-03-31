import mongoose, { Schema } from "mongoose";

/**
 * Counter — atomic auto-increment sequence generator.
 *
 * Each document represents a named sequence (e.g. "candidate", "worker", "company").
 * `getNextId()` atomically increments and returns the next value, formatted
 * with a prefix (CND-0001, WKR-0001, CMP-0001).
 */
export interface ICounter {
  _id: string; // sequence name: "candidate" | "worker" | "company"
  seq: number;
}

const CounterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export const Counter = mongoose.model<ICounter>("Counter", CounterSchema);

const PREFIX_MAP: Record<string, string> = {
  candidate: "CND",
  worker: "WKR",
  company: "CMP",
};

/**
 * Atomically get the next sequential ID for a given sequence.
 * Returns formatted string like "CND-0001", "WKR-0042", "CMP-0003".
 */
export async function getNextId(
  sequenceName: "candidate" | "worker" | "company",
): Promise<string> {
  const counter = await Counter.findByIdAndUpdate(
    sequenceName,
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  const prefix = PREFIX_MAP[sequenceName];
  return `${prefix}-${String(counter.seq).padStart(4, "0")}`;
}
