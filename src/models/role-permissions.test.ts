/**
 * role-permissions.test.ts
 *
 * Verifies ROLE_PERMISSIONS mapping correctness and completeness.
 */
import { describe, it, expect } from "vitest";
import {
  ROLE_PERMISSIONS,
  PERMISSIONS,
  resolveRoleKey,
  type UserRole,
} from "../models/CompanyUser";

const ALL_ROLES: UserRole[] = ["admin", "manager", "vendor", "marketer"];

describe("ROLE_PERMISSIONS", () => {
  it("defines permissions for admin, manager, vendor, and marketer department keys", () => {
    expect(ROLE_PERMISSIONS).toHaveProperty("admin");
    expect(ROLE_PERMISSIONS).toHaveProperty("manager");
    expect(ROLE_PERMISSIONS).toHaveProperty("vendor");
    expect(ROLE_PERMISSIONS).toHaveProperty("marketer_accounts");
    expect(ROLE_PERMISSIONS).toHaveProperty("marketer_immigration");
    expect(ROLE_PERMISSIONS).toHaveProperty("marketer_placement");
  });

  it("admin has all defined permissions", () => {
    const adminPerms = new Set(ROLE_PERMISSIONS.admin);
    for (const perm of Object.values(PERMISSIONS)) {
      expect(adminPerms.has(perm)).toBe(true);
    }
  });

  it("manager has operational permissions but not subscription or company_settings", () => {
    const managerPerms = new Set(ROLE_PERMISSIONS.manager);
    expect(managerPerms.has("dashboard")).toBe(true);
    expect(managerPerms.has("job_postings")).toBe(true);
    expect(managerPerms.has("candidates")).toBe(true);
    expect(managerPerms.has("subscription")).toBe(false);
    expect(managerPerms.has("company_settings")).toBe(false);
  });

  it("vendor has job_postings and hiring_firing but not finance or immigration", () => {
    const vendorPerms = new Set(ROLE_PERMISSIONS.vendor);
    expect(vendorPerms.has("job_postings")).toBe(true);
    expect(vendorPerms.has("hiring_firing")).toBe(true);
    expect(vendorPerms.has("finance")).toBe(false);
    expect(vendorPerms.has("immigration")).toBe(false);
  });

  it("marketer_immigration has immigration permission", () => {
    expect(ROLE_PERMISSIONS.marketer_immigration).toContain("immigration");
  });

  it("marketer_accounts has finance but not immigration", () => {
    const perms = new Set(ROLE_PERMISSIONS.marketer_accounts);
    expect(perms.has("finance")).toBe(true);
    expect(perms.has("immigration")).toBe(false);
  });
});

describe("resolveRoleKey", () => {
  it("returns role name for non-marketer roles", () => {
    expect(resolveRoleKey("admin")).toBe("admin");
    expect(resolveRoleKey("manager")).toBe("manager");
    expect(resolveRoleKey("vendor")).toBe("vendor");
  });

  it("returns marketer_{dept} for marketer with department", () => {
    expect(resolveRoleKey("marketer", "accounts")).toBe("marketer_accounts");
    expect(resolveRoleKey("marketer", "immigration")).toBe(
      "marketer_immigration",
    );
    expect(resolveRoleKey("marketer", "placement")).toBe("marketer_placement");
  });

  it("defaults to marketer_accounts when marketer has no department", () => {
    expect(resolveRoleKey("marketer")).toBe("marketer_accounts");
    expect(resolveRoleKey("marketer", null as any)).toBe("marketer_accounts");
  });
});
