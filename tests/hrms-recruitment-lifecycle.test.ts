import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { applicationSubmissionInput } from "../src/lib/hr/recruitment/applications";
import { interviewInput } from "../src/lib/hr/recruitment/interviews";
import { offerVersionInput } from "../src/lib/hr/recruitment/offers";
import { evaluateActivationReadiness, evaluatePreHireEligibility } from "../src/lib/hr/recruitment/states";

const cuid = (suffix: string) => `cm12345678901234567890${suffix}`;

describe("governed application intake", () => {
  it("normalizes contact data and requires explicit privacy consent", () => {
    const result = applicationSubmissionInput.parse({
      organizationId: cuid("01"),
      vacancyId: cuid("02"),
      idempotencyKey: "browser-retry-key-0001",
      firstName: " Ada ",
      lastName: " Lovelace ",
      email: "ADA@EXAMPLE.COM",
      privacyConsent: true,
    });
    expect(result.email).toBe("ada@example.com");
    expect(result.firstName).toBe("Ada");
    expect(() => applicationSubmissionInput.parse({ ...result, privacyConsent: false })).toThrow();
  });

  it("requires a durable idempotency key", () => {
    expect(() => applicationSubmissionInput.parse({
      organizationId: cuid("01"),
      vacancyId: cuid("02"),
      idempotencyKey: "short",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      privacyConsent: true,
    })).toThrow();
  });
});

describe("interviews and immutable offer versions", () => {
  it("rejects reversed interview time ranges", () => {
    expect(() => interviewInput.parse({
      organizationId: cuid("01"),
      applicationId: cuid("02"),
      title: "Technical interview",
      startsAt: "2026-08-02T11:00:00Z",
      endsAt: "2026-08-02T10:00:00Z",
      timeZone: "UTC",
      participantUserIds: [cuid("03")],
    })).toThrow();
  });

  it("rejects expired and non-positive offers", () => {
    const base = {
      positionId: cuid("01"),
      positionTitle: "Data Engineer",
      departmentId: cuid("02"),
      legalEntityId: cuid("03"),
      employmentType: "FULL_TIME",
      salary: 1000,
      currency: "ngn",
      payFrequency: "MONTHLY",
      workMode: "HYBRID",
      startDate: "2027-01-01T00:00:00Z",
      contractType: "PERMANENT",
      expiresAt: "2027-01-01T00:00:00Z",
    };
    expect(offerVersionInput.parse(base).currency).toBe("NGN");
    expect(() => offerVersionInput.parse({ ...base, salary: 0 })).toThrow();
    expect(() => offerVersionInput.parse({ ...base, expiresAt: "2020-01-01T00:00:00Z" })).toThrow();
  });
});

describe("handover and activation gates", () => {
  it("reports every pre-hire blocker deterministically", () => {
    const result = evaluatePreHireEligibility({
      handoverStatus: "IN_REVIEW",
      acceptedOfferValid: false,
      employmentDetailsComplete: false,
      employeeAlreadyLinked: false,
      requiredApprovalsComplete: false,
      requirements: [{ key: "identity", blocking: true, status: "REJECTED" }],
    });
    expect(result.eligible).toBe(false);
    expect(result.blockers).toEqual([
      "handover_not_approved",
      "accepted_offer_invalid",
      "employment_details_incomplete",
      "required_approvals_missing",
      "requirement:identity:rejected",
    ]);
  });

  it("keeps employee and user activation readiness server controlled", () => {
    const result = evaluateActivationReadiness({
      finalHrApprovalComplete: true,
      blockingRequirementsComplete: true,
      startDate: new Date("2026-08-01T00:00:00Z"),
      now: new Date("2026-07-31T23:59:59Z"),
      securitySetupComplete: false,
      activeAssignmentExists: true,
      cancelledOrOnHold: false,
    });
    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual(["start_date_not_reached", "security_setup_incomplete"]);
  });
});

describe("database and worker safety", () => {
  it("ships additive constraints for the complete traceability chain", () => {
    const migration = fs.readFileSync(path.join(process.cwd(), "prisma/migrations/20260731020000_hrms_recruitment_lifecycle/migration.sql"), "utf8");
    for (const fragment of [
      'UNIQUE INDEX "Applicant_applicantNumber_key"',
      'UNIQUE INDEX "JobApplication_applicationReference_key"',
      'UNIQUE INDEX "HrRecruitmentHandover_offerAcceptanceId_key"',
      'UNIQUE INDEX "HrPreHireConversion_employeeId_key"',
      'FOREIGN KEY ("vacancyId") REFERENCES "HrVacancy"',
      'CHECK ("endsAt" > "startsAt")',
    ]) expect(migration).toContain(fragment);
    expect(migration).not.toMatch(/DROP TABLE|DROP COLUMN/);
  });

  it("authenticates scheduled activation and processes each employee transactionally", () => {
    const route = fs.readFileSync(path.join(process.cwd(), "src/app/api/internal/hr/recruitment-activation/route.ts"), "utf8");
    expect(route).toContain("ORGANIZATION_WORKER_SECRET");
    expect(route).toContain("authorizeInternalRequest");
    expect(route).toContain("prisma.$transaction");
  });
});
