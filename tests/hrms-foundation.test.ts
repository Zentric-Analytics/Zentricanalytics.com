import { describe, expect, it } from "vitest";
import { canAssignRole, permissionsForRole } from "../src/lib/hr/permissions/catalog";
import { createOpaqueToken, hashHrPassword, hashOpaqueToken, normalizeHrEmail, passwordMeetsPolicy, sealHrCredential, unsealHrCredential, verifyHrPassword } from "../src/lib/hr/auth/crypto";
import { tokenCanBeConsumed } from "../src/lib/hr/auth/tokens";
import { safeAuditValues } from "../src/lib/hr/audit";
import { assertSafeOutboxPayload } from "../src/lib/hr/notifications/outbox";
import { assertProductionHrStorage } from "../src/lib/hr/storage";

describe("HRMS secure foundation", () => {
  it("hashes passwords and never returns plaintext", async () => {
    const hash = await hashHrPassword("StrongPassword123");
    expect(hash).not.toContain("StrongPassword123");
    await expect(verifyHrPassword("StrongPassword123", hash)).resolves.toBe(true);
    await expect(verifyHrPassword("WrongPassword123", hash)).resolves.toBe(false);
  });
  it("enforces the password policy", () => {
    expect(passwordMeetsPolicy("StrongPassword123")).toBe(true);
    expect(passwordMeetsPolicy("short")).toBe(false);
  });
  it("normalizes emails and hashes random opaque tokens", () => {
    const token = createOpaqueToken();
    expect(token.length).toBeGreaterThan(32);
    expect(hashOpaqueToken(token)).not.toContain(token);
    expect(normalizeHrEmail(" ADMIN@Example.COM ")).toBe("admin@example.com");
  });
  it("encrypts delivery credentials instead of storing raw invitation/reset tokens", () => {
    const secret = "a-secure-test-secret-that-is-longer-than-32-characters";
    const envelope = sealHrCredential("one-time-value", secret);
    expect(envelope).not.toContain("one-time-value");
    expect(unsealHrCredential(envelope, secret)).toBe("one-time-value");
    expect(() => unsealHrCredential(envelope, `${secret}-wrong`)).toThrow();
  });
  it("rejects expired, used, and revoked invitation/reset tokens", () => {
    const future = new Date(Date.now() + 10_000);
    expect(tokenCanBeConsumed({ status: "ACTIVE", expiresAt: future, usedAt: null })).toBe(true);
    expect(tokenCanBeConsumed({ status: "USED", expiresAt: future, usedAt: new Date() })).toBe(false);
    expect(tokenCanBeConsumed({ status: "REVOKED", expiresAt: future, usedAt: null })).toBe(false);
    expect(tokenCanBeConsumed({ status: "ACTIVE", expiresAt: new Date(0), usedAt: null })).toBe(false);
  });
  it("allows only ADMIN to assign administrative roles", () => {
    expect(canAssignRole(["ADMIN"], "ADMIN")).toBe(true);
    expect(canAssignRole(["HR_ADMIN"], "ADMIN")).toBe(false);
    expect(canAssignRole(["HR_ADMIN"], "PAYROLL_ADMIN")).toBe(false);
    expect(canAssignRole(["HR_ADMIN"], "EMPLOYEE")).toBe(true);
    expect(canAssignRole(["PAYROLL_ADMIN"], "EMPLOYEE")).toBe(false);
    expect(canAssignRole(["EMPLOYEE"], "EMPLOYEE")).toBe(false);
  });
  it("does not grant payroll or bank authority to HR_ADMIN", () => {
    expect(permissionsForRole("HR_ADMIN")).not.toContain("payroll.read_bank_details");
    expect(permissionsForRole("PAYROLL_ADMIN")).toContain("payroll.read_bank_details");
    expect(permissionsForRole("EMPLOYEE")).toContain("employee.read_self");
  });
  it("masks sensitive audit fields", () => {
    expect(safeAuditValues({ email: "safe@example.com", password: "secret", accountNumber: "123456" })).toEqual({ email: "safe@example.com", password: "[REDACTED]", accountNumber: "[REDACTED]" });
  });
  it("rejects sensitive notification payloads", () => {
    expect(() => assertSafeOutboxPayload({ userId: "u1" })).not.toThrow();
    expect(() => assertSafeOutboxPayload({ resetToken: "secret" })).toThrow("Sensitive outbox payload");
    expect(() => assertSafeOutboxPayload({ bankAccount: "123" })).toThrow("Sensitive outbox payload");
  });
  it("rejects local HR document storage in production", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousProvider = process.env.OBJECT_STORAGE_PROVIDER;
    Object.assign(process.env, { NODE_ENV: "production", OBJECT_STORAGE_PROVIDER: "local" });
    expect(() => assertProductionHrStorage()).toThrow("S3-compatible");
    Object.assign(process.env, { NODE_ENV: previousNodeEnv, OBJECT_STORAGE_PROVIDER: previousProvider });
  });
});
