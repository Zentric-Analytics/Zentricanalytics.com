import { readFileSync } from "node:fs";
import type { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sealHrCredential } from "../src/lib/hr/auth/crypto";
import { validateHrDocumentFile } from "../src/lib/hr/documents/validation";
import { assertIndependentPayrollActor } from "../src/lib/hr/payroll/engine";
import { hrEmailBody, hrEmailContent } from "../src/lib/hr/notifications/worker";
import { privilegedMfaRequired } from "../src/lib/hr/permissions/mfa-policy";
import { activeSupervisorForEmployee, supervisedEmployeeIds } from "../src/lib/hr/supervisors/scope";

const read = (path: string) => readFileSync(path, "utf8");

describe("final HRMS remediation security behavior", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("enforces maker-checker separation for payroll review and approval", () => {
    expect(() => assertIndependentPayrollActor("creator", ["creator"], "Payroll review")).toThrow("different authorized user");
    expect(() => assertIndependentPayrollActor("reviewer", ["creator", "reviewer"], "Payroll approval")).toThrow("different authorized user");
    expect(() => assertIndependentPayrollActor("approver", ["creator", "reviewer"], "Payroll approval")).not.toThrow();
  });

  it("rejects spoofed MIME metadata when leave or employee document bytes do not match", () => {
    const spoofedBytes = new TextEncoder().encode("<html><script>alert(1)</script>");
    const fakePdf = new File([spoofedBytes], "claim.pdf", { type: "application/pdf" });
    expect(() => validateHrDocumentFile(fakePdf, spoofedBytes)).toThrow("genuine PDF");
  });

  it("builds credential links with fragments rather than server-visible query parameters", () => {
    vi.stubEnv("AUTH_SECRET", "local-test-auth-secret-with-more-than-thirty-two-characters");
    const rawToken = "opaque-random-single-use-token-value";
    const body = hrEmailBody("hr-password-reset", { credentialEnvelope: sealHrCredential(rawToken) }, "https://staging.example.test/");
    expect(body).toContain("/hr/password-reset/redeem#token=");
    expect(body).not.toContain("?token=");
    expect(body).not.toContain(`\n${rawToken}\n`);
    expect(() => hrEmailBody("hr-password-reset", { credentialEnvelope: sealHrCredential(rawToken) }, "http://insecure.example.test")).toThrow("HTTPS");
  });

  it("renders offer and handover emails with scoped HTTPS links", () => {
    const offer = hrEmailBody(
      "hr-offer-issued",
      { href: "/careers/offers/offer-123" },
      "https://staging.zentricanalytics.com/",
    );
    expect(offer).toContain("exact approved offer");
    expect(offer).toContain("https://staging.zentricanalytics.com/careers/offers/offer-123");
    expect(hrEmailContent("hr-offer-issued", { href: "/careers/offers/offer-123" }, "https://staging.zentricanalytics.com").html).toContain("Review &amp; Accept Offer");
    expect(() => hrEmailBody("hr-offer-issued", { href: "//untrusted.example" }, "https://staging.zentricanalytics.com")).toThrow("safe relative link");
    expect(() => hrEmailBody("hr-handover-created", { href: "/hr/admin/handovers/handover-123" }, "http://staging.example.test")).toThrow("HTTPS");
  });

  it("requires MFA for privileged staging and production accounts only", () => {
    vi.stubEnv("APP_ENV", "staging");
    expect(privilegedMfaRequired({ roles: ["ADMIN"], user: { mfaEnabled: false } })).toBe(true);
    expect(privilegedMfaRequired({ roles: ["EMPLOYEE"], user: { mfaEnabled: false } })).toBe(false);
    expect(privilegedMfaRequired({ roles: ["PAYROLL_ADMIN"], user: { mfaEnabled: true } })).toBe(false);
  });

  it("resolves direct, team, and department supervisor scope without crossing organizations", async () => {
    const client = {
      hrSupervisorAssignment: {
        findMany: vi.fn(async () => [
          { assignedEmployeeId: "direct", departmentScopeId: "department-a", teamScopeId: "team-a" },
        ]),
      },
      hrEmployeeAssignment: {
        findMany: vi.fn(async ({ where }) => {
          expect(where.organizationId).toBe("org-a");
          return [{ employeeId: "team-member" }, { employeeId: "department-member" }];
        }),
      },
    } as unknown as PrismaClient;
    await expect(supervisedEmployeeIds(client, { organizationId: "org-a", supervisorEmployeeId: "supervisor" }))
      .resolves.toEqual(["direct", "team-member", "department-member"]);
  });

  it("selects direct supervisors ahead of team and department candidates", async () => {
    const direct = { assignedEmployeeId: "employee", teamScopeId: null, departmentScopeId: null, supervisorEmployee: { userId: "direct-user" } };
    const client = {
      hrEmployeeAssignment: { findFirst: vi.fn(async () => ({ departmentId: "department-a", teamId: "team-a" })) },
      hrSupervisorAssignment: { findMany: vi.fn(async () => [
        { assignedEmployeeId: null, teamScopeId: null, departmentScopeId: "department-a", supervisorEmployee: { userId: "department-user" } },
        { assignedEmployeeId: null, teamScopeId: "team-a", departmentScopeId: null, supervisorEmployee: { userId: "team-user" } },
        direct,
      ]) },
    } as unknown as PrismaClient;
    await expect(activeSupervisorForEmployee(client, { organizationId: "org-a", employeeId: "employee" })).resolves.toBe(direct);
  });

  it("revokes sessions after every role assignment and revocation", () => {
    const actions = read("src/app/hr/admin/users/actions.ts");
    expect(actions).toMatch(/assignHrRoleAction[\s\S]*?revokeAllHrSessions\(target\.id\)/);
    expect(actions).toMatch(/revokeHrRoleAction[\s\S]*?revokeAllHrSessions\(input\.userId\)/);
  });

  it("provides a guarded non-recurring Render release flow", () => {
    const render = read("render.yaml");
    const release = read("scripts/hr-release.mjs");
    expect(render).toContain("preDeployCommand: yarn hr:release");
    expect(render).toContain("startCommand: yarn start");
    expect(release).toContain('HR_BOOTSTRAP_ENABLED');
    expect(release).toContain('["prisma", "migrate", "deploy"]');
    expect(release).toContain("runHrPreflight");
    expect(release).not.toContain("console.info(process.env");
  });

  it("makes scanner callback retries idempotent while rejecting conflicts", () => {
    const scanner = read("src/app/api/internal/hr/document-scan/route.ts");
    expect(scanner).toContain("sameResult");
    expect(scanner).toContain("alreadyRecorded: !recorded");
    expect(scanner).toContain("conflicting terminal scan result");
  });
});
