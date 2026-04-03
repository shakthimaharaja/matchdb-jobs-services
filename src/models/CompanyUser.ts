import mongoose, { Schema } from "mongoose";

export type UserRole = "admin" | "manager" | "vendor" | "marketer";
export type MarketerDepartment = "accounts" | "immigration" | "placement";
export type UserStatus = "active" | "invited" | "deactivated";

export type WorkerLifecycle =
  | "INVITED"
  | "ONBOARDING"
  | "ACTIVE"
  | "ON_ASSIGNMENT"
  | "OFFBOARDING"
  | "TERMINATED";

export type EmploymentType = "W2" | "1099" | "CORP_TO_CORP";
export type PayFrequency = "WEEKLY" | "BIWEEKLY" | "SEMI_MONTHLY" | "MONTHLY";

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
  // ADP (People) permissions
  PAYROLL: "payroll",
  PAY_STUBS: "pay_stubs",
  WORKER_LIFECYCLE: "worker_lifecycle",
  // QuickBooks (Money) permissions
  CLIENTS: "clients",
  INVOICES: "invoices",
  VENDORS: "vendors",
  BILLS: "bills",
  FINANCIAL_REPORTS: "financial_reports",
  CASH_FLOW: "cash_flow",
  MARGIN_TRACKING: "margin_tracking",
  // Fieldglass (Timesheets) permissions
  TIMESHEET_APPROVE: "timesheet_approve",
  LEAVE_MANAGEMENT: "leave_management",
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
    "timesheet_approve",
    "leave_management",
    "worker_lifecycle",
  ],

  vendor: ["dashboard", "job_postings", "hiring_firing"],

  marketer_accounts: [
    "dashboard",
    "finance",
    "candidates",
    "projects",
    "staffing",
    "payroll",
    "invoices",
    "bills",
    "financial_reports",
    "cash_flow",
    "margin_tracking",
    "clients",
    "vendors",
  ],

  marketer_immigration: [
    "dashboard",
    "immigration",
    "candidates",
    "projects",
    "staffing",
  ],

  marketer_placement: [
    "dashboard",
    "staffing",
    "placement",
    "timesheet_approve",
  ],
};

/**
 * Resolve the permission-key for a given role + optional department.
 */
export function resolveRoleKey(
  role: UserRole,
  department?: string | null,
): string {
  if (role === "marketer") {
    const marketerDepartment =
      department === "immigration" || department === "placement"
        ? department
        : "accounts";
    return `marketer_${marketerDepartment}`;
  }
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
  // Worker lifecycle (ADP)
  lifecycleStatus: WorkerLifecycle;
  employmentType: EmploymentType | null;
  hourlyRate: number;
  salaryAmount: number;
  payFrequency: PayFrequency | null;
  bankAccountInfo: {
    bankName: string;
    routingNumber: string;
    accountLast4: string;
    accountType: string;
  } | null;
  taxInfo: {
    ssn_last4: string;
    filingStatus: string;
    allowances: number;
    additionalWithholding: number;
  } | null;
  benefitsEnrolled: string[];
  onboardingChecklist: {
    step: string;
    completed: boolean;
    completedAt: Date | null;
  }[];
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
    // Worker lifecycle (ADP)
    lifecycleStatus: {
      type: String,
      enum: [
        "INVITED",
        "ONBOARDING",
        "ACTIVE",
        "ON_ASSIGNMENT",
        "OFFBOARDING",
        "TERMINATED",
      ],
      default: "INVITED",
    },
    employmentType: {
      type: String,
      enum: ["W2", "1099", "CORP_TO_CORP", null],
      default: null,
    },
    hourlyRate: { type: Number, default: 0 },
    salaryAmount: { type: Number, default: 0 },
    payFrequency: {
      type: String,
      enum: ["WEEKLY", "BIWEEKLY", "SEMI_MONTHLY", "MONTHLY", null],
      default: null,
    },
    bankAccountInfo: {
      type: new Schema(
        {
          bankName: { type: String, default: "" },
          routingNumber: { type: String, default: "" },
          accountLast4: { type: String, default: "" },
          accountType: { type: String, default: "checking" },
        },
        { _id: false },
      ),
      default: null,
    },
    taxInfo: {
      type: new Schema(
        {
          ssn_last4: { type: String, default: "" },
          filingStatus: { type: String, default: "single" },
          allowances: { type: Number, default: 0 },
          additionalWithholding: { type: Number, default: 0 },
        },
        { _id: false },
      ),
      default: null,
    },
    benefitsEnrolled: { type: [String], default: [] },
    onboardingChecklist: {
      type: [
        new Schema(
          {
            step: { type: String, required: true },
            completed: { type: Boolean, default: false },
            completedAt: { type: Date, default: null },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
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
