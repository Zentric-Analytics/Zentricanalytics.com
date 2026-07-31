import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { timingSafeSecret } from "../src/lib/hr/internal-auth";
import { retryAt, safeWorkerError } from "../src/lib/hr/notifications/worker";
import { generateTotpSecret, totpCode, totpProvisioningUri, verifyTotp } from "../src/lib/hr/auth/totp";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("HRMS production hardening", () => {
  it("implements RFC-compatible TOTP with a bounded verification window", () => {
    const rfcSecret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    expect(totpCode(rfcSecret, 59_000)).toBe("287082");
    expect(verifyTotp("287082", rfcSecret, 59_000)).toBe(true);
    expect(verifyTotp("000000", rfcSecret, 59_000)).toBe(false);
    expect(generateTotpSecret()).toMatch(/^[A-Z2-7]{32}$/);
    expect(totpProvisioningUri("admin@example.com", rfcSecret)).toContain("otpauth://totp/");
  });
  it("compares internal secrets in constant time and rejects weak configuration", () => {
    const secret = "a".repeat(64);
    expect(timingSafeSecret(secret, secret)).toBe(true);
    expect(timingSafeSecret("wrong", secret)).toBe(false);
    expect(timingSafeSecret("short", "short")).toBe(false);
  });
  it("uses bounded exponential outbox retries and redacts worker errors", () => {
    const now = new Date("2026-08-01T00:00:00.000Z");
    expect(retryAt(1, now).toISOString()).toBe("2026-08-01T00:05:00.000Z");
    expect(retryAt(5, now).toISOString()).toBe("2026-08-01T01:20:00.000Z");
    process.env.EMAIL_WORKER_SECRET = "b".repeat(64);
    expect(safeWorkerError(`Bearer ${process.env.EMAIL_WORKER_SECRET}`)).not.toContain(process.env.EMAIL_WORKER_SECRET);
  });

  it("supports immediate single-message delivery with durable retry fallback", () => {
    const worker = read("src/lib/hr/notifications/worker.ts");
    const invitations = read("src/lib/hr/auth/invitations.ts");
    expect(worker).toContain("export async function processHrOutboxItem");
    expect(invitations).toContain("await processHrOutboxItem(invitation.outboxId)");
    expect(invitations).toContain("durable cron worker remains the fallback");
  });
  it("protects workers, scanner callbacks and metrics with distinct bearer secrets", () => {
    for (const file of ["src/app/api/internal/hr/outbox/route.ts", "src/app/api/internal/hr/document-scan/route.ts", "src/app/api/internal/hr/metrics/route.ts"]) {
      const source = read(file);
      expect(source).toContain("authorizeInternalRequest");
      expect(source).toContain('"Cache-Control": "no-store"');
    }
    expect(read("src/app/api/internal/hr/outbox/route.ts")).toContain("EMAIL_WORKER_SECRET");
    expect(read("src/app/api/internal/hr/document-scan/route.ts")).toContain("DOCUMENT_SCANNER_SECRET");
    expect(read("src/app/api/internal/hr/metrics/route.ts")).toContain("MONITORING_SECRET");
  });
  it("exposes minimal liveness and database-backed readiness", () => {
    expect(read("src/app/api/health/live/route.ts")).not.toContain("process.env");
    const ready = read("src/app/api/health/ready/route.ts");
    expect(ready).toContain("SELECT 1");
    expect(ready).toContain("503");
    expect(ready).not.toContain("DATABASE_URL");
  });
  it("requires production storage, workers, monitoring, backups, PITR, restore drills, and privileged MFA", () => {
    const preflight = read("scripts/hr-preflight-lib.mjs");
    for (const key of ["OBJECT_STORAGE_PROVIDER", "DOCUMENT_SCANNER_SECRET", "MONITORING_SECRET", "DATABASE_BACKUP_RETENTION_DAYS", "DATABASE_PITR_ENABLED", "BACKUP_LAST_RESTORE_TEST_AT", "privilegedWithoutMfa"]) expect(preflight).toContain(key);
  });
  it("adds immutable delivery history and monitoring indexes non-destructively", () => {
    const migration = read("prisma/migrations/20260730070000_hrms_production_hardening/migration.sql");
    expect(migration).toContain("HrEmailDeliveryAttempt_immutable");
    expect(migration).toContain("HrUser_mfa_secret_check");
    expect(migration).toContain("scanStatus_uploadedAt_idx");
    expect(migration).not.toMatch(/\bDROP\s+(TABLE|COLUMN)/i);
  });
  it("sets the hardened HTTP response policy", () => {
    const config = read("next.config.mjs");
    for (const header of ["Strict-Transport-Security", "Content-Security-Policy", "Cross-Origin-Opener-Policy", "X-Frame-Options", "X-Content-Type-Options"]) expect(config).toContain(header);
  });
  it("makes HR sessions available to protected API routes and rotates them without extending absolute expiry", () => {
    const session = read("src/lib/hr/auth/session.ts");
    const rotation = read("src/app/api/hr/session/rotate/route.ts");
    expect(session).toContain('path: "/"');
    expect(session).toContain("current.expiresAt");
    expect(session).toContain("revokedAt: now");
    expect(rotation).toContain('"sec-fetch-site"');
    expect(rotation).toContain("same-origin");
  });
});
