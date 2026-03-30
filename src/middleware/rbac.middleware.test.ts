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
  },
}));

vi.mock("../models/CompanyAdmin", () => ({
  CompanyAdmin: {
    findOne: (...args: unknown[]) => mockCompanyAdminFindOne(...args),
  },
}));

// Mock requireAuth to just call next() and set req.user
vi.mock("./auth.middleware", () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    req.user = {
      userId: "user-1",
      email: "test@test.com",
      userType: "marketer",
      plan: "marketer",
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
    expect(req.companyUser!.permissions).toContain("users:manage");
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

    const middleware = requireRole("admin", "marketing");
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
        role: "viewer",
        permissions: [],
      }),
    });

    const middleware = requireRole("admin", "marketing");
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
        required: ["admin", "marketing"],
        actual: "viewer",
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
        role: "marketing",
        permissions: [
          "invite:candidate",
          "candidates:view",
          "candidates:manage",
          "reports:view",
        ],
      }),
    });

    const middleware = requirePermission("invite:candidate");
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
        role: "viewer",
        permissions: [
          "finance:view",
          "hr:view",
          "operations:view",
          "reports:view",
          "candidates:view",
        ],
      }),
    });

    const middleware = requirePermission("invite:candidate");
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
        required: ["invite:candidate"],
      }),
    );
  });

  it("requires ALL permissions when multiple specified", async () => {
    mockCompanyUserFindOne.mockReturnValue({
      lean: () => ({
        _id: "cu-1",
        companyId: "comp-1",
        role: "marketing",
        permissions: ["invite:candidate"],
      }),
    });

    const middleware = requirePermission("invite:candidate", "users:manage");
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
