/**
 * role-permissions.test.ts
 *
 * Verifies ROLE_PERMISSIONS mapping correctness and completeness.
 */
import { describe, it, expect } from "vitest";
import { ROLE_PERMISSIONS, type UserRole } from "../models/CompanyUser";

const ALL_ROLES: UserRole[] = [
  "admin",
  "finance",
  "hr",
  "operations",
  "marketing",
  "viewer",
];

describe("ROLE_PERMISSIONS", () => {
  it("defines permissions for all 6 roles", () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_PERMISSIONS).toHaveProperty(role);
      expect(Array.isArray(ROLE_PERMISSIONS[role])).toBe(true);
      expect(ROLE_PERMISSIONS[role].length).toBeGreaterThan(0);
    }
  });

  it("admin has all permissions (superset of every other role)", () => {
    const adminPerms = new Set(ROLE_PERMISSIONS.admin);
    for (const role of ALL_ROLES) {
      if (role === "admin") continue;
      for (const perm of ROLE_PERMISSIONS[role]) {
        expect(adminPerms.has(perm)).toBe(true);
      }
    }
  });

  it("marketing has invite:candidate permission", () => {
    expect(ROLE_PERMISSIONS.marketing).toContain("invite:candidate");
  });

  it("viewer has no management permissions", () => {
    const viewerPerms = ROLE_PERMISSIONS.viewer;
    const managementPerms = viewerPerms.filter((p) => p.includes(":manage"));
    expect(managementPerms.length).toBe(0);
  });

  it("viewer only has read/view permissions", () => {
    for (const perm of ROLE_PERMISSIONS.viewer) {
      expect(perm).toMatch(/:view$|^reports:/);
    }
  });

  it("finance role has finance:view and finance:manage", () => {
    expect(ROLE_PERMISSIONS.finance).toContain("finance:view");
    expect(ROLE_PERMISSIONS.finance).toContain("finance:manage");
  });

  it("hr role has hr:view and hr:manage", () => {
    expect(ROLE_PERMISSIONS.hr).toContain("hr:view");
    expect(ROLE_PERMISSIONS.hr).toContain("hr:manage");
  });

  it("operations role has operations:view and operations:manage", () => {
    expect(ROLE_PERMISSIONS.operations).toContain("operations:view");
    expect(ROLE_PERMISSIONS.operations).toContain("operations:manage");
  });

  it("admin can invite both employees and candidates", () => {
    expect(ROLE_PERMISSIONS.admin).toContain("invite:employee");
    expect(ROLE_PERMISSIONS.admin).toContain("invite:candidate");
  });

  it("non-admin roles cannot invite employees", () => {
    for (const role of ALL_ROLES) {
      if (role === "admin") continue;
      expect(ROLE_PERMISSIONS[role]).not.toContain("invite:employee");
    }
  });

  it("only admin can manage settings", () => {
    expect(ROLE_PERMISSIONS.admin).toContain("settings:manage");
    for (const role of ALL_ROLES) {
      if (role === "admin") continue;
      expect(ROLE_PERMISSIONS[role]).not.toContain("settings:manage");
    }
  });
});
