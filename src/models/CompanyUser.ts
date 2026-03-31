import mongoose, { Schema } from "mongoose";

export type UserRole = "admin" | "manager" | "vendor" | "marketer";
export type MarketerDepartment = "accounts" | "immigration" | "placement";
export type UserStatus = "active" | "invited" | "deactivated";

/**
 * Permission constants — used in RBAC middleware and frontend guards.
 */
export const PERMISSIONS = {
  DASHBOARD: "dashboard",
  JOB_POSTINGS: "job_postings",
  HIRING_FIRING: "hiring_firing",
  CANDIDATES: "candidates",
  WORKERS: "workers",
  FINANCE: "finance",
  IMMIGRATION: "immigration",
  PROJECTS: "projects",
  STAFFING: "staffing",
  PLACEMENT: "placement",
  SUBSCRIPTION: "subscription",
  INVITE_WORKERS: "invite_workers",
  MANAGE_ROLES: "manage_roles",
  COMPANY_SETTINGS: "company_settings",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Role → permissions mapping.
 * MARKETER is further scoped by department; the key is `marketer_<department>`.
 */
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: Object.values(PERMISSIONS),

  manager: [
    "dashboard",
    "job_postings",
    "hiring_firing",
    "candidates",
    "workers",
    "projects",
    "staffing",
    "placement",
  ],

  vendor: ["dashboard", "job_postings", "hiring_firing"],

  marketer_accounts: [
    "dashboard",
    "finance",
    "candidates",
    "projects",
    "staffing",
  ],

  marketer_immigration: [
    "dashboard",
    "immigration",
    "candidates",
    "projects",
    "staffing",
  ],

  marketer_placement: ["dashboard", "staffing", "placement"],
};

/**
 * Resolve the permission-key for a given role + optional department.
 */
export function resolveRoleKey(
  role: UserRole,
  department?: string | null,
): string {
  if (role === "marketer" && department) return `marketer_${department}`;
  return role;
}

export interface ICompanyUser {
  _id: string;
  companyId: string;
  userId: string; // references shell User._id
  workerId: string; // e.g. "WKR-0001" — human-readable unique worker ID
  email: string;
  fullName: string;
  phone: string;
  designation: string;
  role: UserRole;
  department: MarketerDepartment | null; // only for role === "marketer"
  permissions: string[];
  status: UserStatus;
  invitationId: string | null;
  invitedBy: string | null; // userId of the admin who invited
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
    workerId: { type: String, default: "", unique: true, sparse: true },
    email: { type: String, required: true },
    fullName: { type: String, default: "" },
    phone: { type: String, default: "" },
    designation: { type: String, default: "" },
    role: {
      type: String,
      enum: ["admin", "manager", "vendor", "marketer"],
      default: "vendor",
    },
    department: {
      type: String,
      enum: ["accounts", "immigration", "placement", null],
      default: null,
    },
    permissions: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["active", "invited", "deactivated"],
      default: "active",
    },
    invitationId: { type: String, default: null },
    invitedBy: { type: String, default: null },
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
