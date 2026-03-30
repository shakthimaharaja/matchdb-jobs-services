import mongoose, { Schema } from "mongoose";

export type UserRole =
  | "admin"
  | "finance"
  | "hr"
  | "operations"
  | "marketing"
  | "viewer";
export type UserStatus = "active" | "inactive" | "suspended";

/**
 * Predefined permissions per role.
 * The admin role implicitly has ALL permissions.
 */
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: [
    "users:manage",
    "users:view",
    "invite:employee",
    "invite:candidate",
    "finance:view",
    "finance:manage",
    "hr:view",
    "hr:manage",
    "operations:view",
    "operations:manage",
    "reports:view",
    "settings:manage",
    "candidates:view",
    "candidates:manage",
  ],
  finance: ["finance:view", "finance:manage", "reports:view"],
  hr: ["hr:view", "hr:manage", "reports:view"],
  operations: ["operations:view", "operations:manage", "reports:view"],
  marketing: [
    "invite:candidate",
    "candidates:view",
    "candidates:manage",
    "reports:view",
  ],
  viewer: [
    "finance:view",
    "hr:view",
    "operations:view",
    "reports:view",
    "candidates:view",
  ],
};

export interface ICompanyUser {
  _id: string;
  companyId: string;
  userId: string; // references shell User._id
  email: string;
  fullName: string;
  role: UserRole;
  permissions: string[];
  status: UserStatus;
  invitationId: string | null;
  lastLoginAt: Date | null;
  lastActiveAt: Date | null;
  onlineStatus: "online" | "away" | "offline";
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CompanyUserSchema = new Schema<ICompanyUser>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    companyId: { type: String, required: true },
    userId: { type: String, required: true },
    email: { type: String, required: true },
    fullName: { type: String, default: "" },
    role: {
      type: String,
      enum: ["admin", "finance", "hr", "operations", "marketing", "viewer"],
      default: "viewer",
    },
    permissions: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },
    invitationId: { type: String, default: null },
    lastLoginAt: { type: Date, default: null },
    lastActiveAt: { type: Date, default: null },
    onlineStatus: {
      type: String,
      enum: ["online", "away", "offline"],
      default: "offline",
    },
    joinedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

CompanyUserSchema.index({ companyId: 1, userId: 1 }, { unique: true });
CompanyUserSchema.index({ companyId: 1, email: 1 }, { unique: true });
CompanyUserSchema.index({ companyId: 1, role: 1 });
CompanyUserSchema.index({ companyId: 1, status: 1 });

export const CompanyUser = mongoose.model<ICompanyUser>(
  "CompanyUser",
  CompanyUserSchema,
);
