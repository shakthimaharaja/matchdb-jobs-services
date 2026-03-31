import mongoose, { Schema } from "mongoose";

export type DayOfWeek =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export interface ITimeEntry {
  _id: string;
  timesheetId: string;
  entryDate: Date;
  dayOfWeek: DayOfWeek;
  regularHours: number;
  overtimeHours: number;
  ptoHours: number;
  sickHours: number;
  holidayHours: number;
  totalHours: number;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const TimeEntrySchema = new Schema<ITimeEntry>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    timesheetId: { type: String, required: true },
    entryDate: { type: Date, required: true },
    dayOfWeek: {
      type: String,
      enum: [
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "FRIDAY",
        "SATURDAY",
        "SUNDAY",
      ],
      required: true,
    },
    regularHours: { type: Number, default: 0 },
    overtimeHours: { type: Number, default: 0 },
    ptoHours: { type: Number, default: 0 },
    sickHours: { type: Number, default: 0 },
    holidayHours: { type: Number, default: 0 },
    totalHours: { type: Number, default: 0 },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

// Compute totalHours before save
TimeEntrySchema.pre("save", function () {
  this.totalHours =
    this.regularHours +
    this.overtimeHours +
    this.ptoHours +
    this.sickHours +
    this.holidayHours;
});

TimeEntrySchema.index({ timesheetId: 1, entryDate: 1 }, { unique: true });

export const TimeEntry = mongoose.model<ITimeEntry>(
  "TimeEntry",
  TimeEntrySchema,
);
