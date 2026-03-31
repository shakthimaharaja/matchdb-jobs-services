/**
 * rbac.middleware.test.ts
 *
 * Unit tests for the RBAC middleware:
 *   - resolveCompanyUser
 *   - requireRole
 *   - requirePermission
 *   - requireSeatAvailable
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

// ── Mock Mongoose models ──────────────────────────────────────────────────────
const mockCompanyUserFindOne = vi.fn();
const mockCompanyAdminFindOne = vi.fn();

vi.mock("../models/CompanyUser", () => ({
  CompanyUser: {
    findOne: (...args: unknown[]) => mockCompanyUserFindOne(...args),
  },
  ROLE_PERMISSIONS: {
    admin: [
      "dashboard",
      "job_postings",
      "hiring_firing",
      "candidates",
      "workers",
      "finance",
      "immigration",
      "projects",
      "staffing",
      "placement",
      "subscription",
      "invite_workers",
      "manage_roles",
      "company_settings",
    ],
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
  },
  resolveRoleKey: (role: string, department?: string | null) => {
    if (role === "marketer" && department) return `marketer_${department}`;
    return role;
  },
}));

vi.mock("../models/CompanyAdmin", () => ({
  CompanyAdmin: {
    findOne: (...args: unknown[]) => mockCompanyAdminFindOne(...args),
  },
}));

vi.mock("../models/SubscriptionPlan", () => ({
  SubscriptionPlan: {
    findById: () => ({ lean: () => null }),
  },
}));

// Mock requireAuth to just call next() and set req.user
vi.mock("./auth.middleware", () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    req.user = {
      userId: "user-1",
      email: "test@test.com",
      userType: "employer",
      plan: "pro_plus",
      username: "test",
    };
    next();
  },
}));

import {
  resolveCompanyUser,
  requireRole,
  requirePermission,
  requireSeatAvailable,
} from "./rbac.middleware";

// ── Helpers ──

function mockReq(overrides?: Partial<Request>): Request {
  return {
    user: null,
    companyUser: undefined,
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

function mockNext(): NextFunction {
  return vi.fn();
}

// ── Tests ──

describe("resolveCompanyUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("attaches companyUser when company user found", async () => {
    mockCompanyUserFindOne.mockReturnValue({
      lean: () => ({
        _id: "cu-1",
        companyId: "comp-1",
        role: "admin",
        permissions: [],
      }),
    });

    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    resolveCompanyUser(req, res, next);

    // Since requireAuth is sync in our mock, middleware runs synchronously
    await vi.waitFor(() => {
      expect(next).toHaveBeenCalled();
    });

    expect(req.companyUser).toBeDefined();
    expect(req.companyUser!.companyId).toBe("comp-1");
    expect(req.companyUser!.role).toBe("admin");
    // When permissions empty, ROLE_PERMISSIONS["admin"] is used
    expect(req.companyUser!.permissions).toContain("dashboard");
  });

  it("returns 403 when user has no active company membership", async () => {
    mockCompanyUserFindOne.mockReturnValue({ lean: () => null });

    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    resolveCompanyUser(req, res, next);

    await vi.waitFor(() => {
      expect(res.status).toHaveBeenCalledWith(403);
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "No active company membership found" }),
    );
    expect(next).not.toHaveBeenCalled();
  });
});

describe("requireRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows request when user's role matches", async () => {
    mockCompanyUserFindOne.mockReturnValue({
      lean: () => ({
        _id: "cu-1",
        companyId: "comp-1",
        role: "admin",
        permissions: [],
      }),
    });

    const middleware = requireRole("admin", "manager");
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    middleware(req, res, next);

    await vi.waitFor(() => {
      expect(next).toHaveBeenCalled();
    });
  });

  it("blocks request when user's role doesn't match", async () => {
    mockCompanyUserFindOne.mockReturnValue({
      lean: () => ({
        _id: "cu-1",
        companyId: "comp-1",
        role: "vendor",
        permissions: [],
      }),
    });

    const middleware = requireRole("admin", "manager");
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    middleware(req, res, next);

    await vi.waitFor(() => {
      expect(res.status).toHaveBeenCalledWith(403);
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Forbidden: insufficient role",
        required: ["admin", "manager"],
        actual: "vendor",
      }),
    );
  });
});

describe("requirePermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows request when user has required permission", async () => {
    mockCompanyUserFindOne.mockReturnValue({
      lean: () => ({
        _id: "cu-1",
        companyId: "comp-1",
        role: "manager",
        permissions: [
          "dashboard",
          "job_postings",
          "hiring_firing",
          "candidates",
          "workers",
          "projects",
          "staffing",
          "placement",
        ],
      }),
    });

    const middleware = requirePermission("candidates");
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    middleware(req, res, next);

    await vi.waitFor(() => {
      expect(next).toHaveBeenCalled();
    });
  });

  it("blocks request when user lacks required permission", async () => {
    mockCompanyUserFindOne.mockReturnValue({
      lean: () => ({
        _id: "cu-1",
        companyId: "comp-1",
        role: "vendor",
        permissions: ["dashboard", "job_postings", "hiring_firing"],
      }),
    });

    const middleware = requirePermission("finance");
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    middleware(req, res, next);

    await vi.waitFor(() => {
      expect(res.status).toHaveBeenCalledWith(403);
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Forbidden: missing permissions",
        required: ["finance"],
      }),
    );
  });

  it("requires ALL permissions when multiple specified", async () => {
    mockCompanyUserFindOne.mockReturnValue({
      lean: () => ({
        _id: "cu-1",
        companyId: "comp-1",
        role: "vendor",
        permissions: ["dashboard", "job_postings"],
      }),
    });

    const middleware = requirePermission("job_postings", "finance");
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    middleware(req, res, next);

    await vi.waitFor(() => {
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});

describe("requireSeatAvailable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows when seats available", async () => {
    mockCompanyUserFindOne.mockReturnValue({
      lean: () => ({
        _id: "cu-1",
        companyId: "comp-1",
        role: "admin",
        permissions: [],
      }),
    });

    mockCompanyAdminFindOne.mockReturnValue({
      lean: () => ({
        companyId: "comp-1",
        seatsUsed: 3,
        seatLimit: 5,
        subscriptionPlan: "basic",
      }),
    });

    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    requireSeatAvailable(req, res, next);

    await vi.waitFor(() => {
      expect(next).toHaveBeenCalled();
    });
  });

  it("blocks when seat limit reached", async () => {
    mockCompanyUserFindOne.mockReturnValue({
      lean: () => ({
        _id: "cu-1",
        companyId: "comp-1",
        role: "admin",
        permissions: [],
      }),
    });

    mockCompanyAdminFindOne.mockReturnValue({
      lean: () => ({
        companyId: "comp-1",
        seatsUsed: 5,
        seatLimit: 5,
        subscriptionPlan: "basic",
      }),
    });

    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    requireSeatAvailable(req, res, next);

    await vi.waitFor(() => {
      expect(res.status).toHaveBeenCalledWith(403);
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Seat limit reached",
        seatsUsed: 5,
        seatLimit: 5,
      }),
    );
  });

  it("returns 404 when company admin record missing", async () => {
    mockCompanyUserFindOne.mockReturnValue({
      lean: () => ({
        _id: "cu-1",
        companyId: "comp-1",
        role: "admin",
        permissions: [],
      }),
    });

    mockCompanyAdminFindOne.mockReturnValue({ lean: () => null });

    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    requireSeatAvailable(req, res, next);

    await vi.waitFor(() => {
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
