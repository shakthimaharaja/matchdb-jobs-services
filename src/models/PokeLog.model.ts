import { Schema, model } from 'mongoose';

/**
 * Tracks monthly poke counts per user for rate-limiting.
 * One document per (userId, yearMonth) pair — e.g., ("abc123", "2026-02").
 * The unique compound index ensures atomic $inc operations are safe.
 */
const PokeLogSchema = new Schema(
  {
    userId:    { type: String, required: true },
    yearMonth: { type: String, required: true }, // "YYYY-MM"
    count:     { type: Number, default: 0 },
  },
  { timestamps: true },
);

PokeLogSchema.index({ userId: 1, yearMonth: 1 }, { unique: true });

export const PokeLog = model('PokeLog', PokeLogSchema);
