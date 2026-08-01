import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mergeProvisioningStep, provisioningPayloadSchema, provisioningReadiness } from "../src/lib/hr/employees/provisioning";

const complete = {
  personal: { legalFirstName: "Ada", lastName: "Okafor", personalEmail: "ada@example.test" },
  employment: { hireDate: "2026-08-01", startDate: "2026-08-03", employmentType: "FULL_TIME" as const },
  assignment: { departmentId: "ck1234567890123456789012", positionId: "ck2234567890123456789012", primaryManagerId: "ck3234567890123456789012", effectiveFrom: "2026-08-03", reason: "New hire" },
  compensation: { currency: "NGN", baseSalary: "1000000.00", effectiveFrom: "2026-08-03", reason: "Approved offer" },
  payroll: { bankName: "Example Bank", accountName: "Ada Okafor", accountNumber: "0123456789", taxCountry: "Nigeria" },
  access: { createUser: true, email: "ada@zentric.example", role: "EMPLOYEE" as const, sendInvitation: true },
  onboarding: { start: false },
};

describe("employee provisioning workflow", () => {
  it("calculates complete readiness", () => expect(provisioningReadiness(provisioningPayloadSchema.parse(complete))).toMatchObject({ score: 100, blocking: [] }));
  it("blocks activation without an assignment", () => expect(provisioningReadiness(provisioningPayloadSchema.parse({ ...complete, assignment: {} })).blocking.map(item => item.key)).toContain("assignment"));
  it("blocks activation without a manager", () => expect(provisioningReadiness(provisioningPayloadSchema.parse({ ...complete, assignment: { ...complete.assignment, primaryManagerId: undefined } })).blocking.map(item => item.key)).toContain("manager"));
  it("does not require an account when account creation is disabled", () => expect(provisioningReadiness(provisioningPayloadSchema.parse({ ...complete, access: { createUser: false } })).checks.find(item => item.key === "access")?.ready).toBe(true));
  it("requires a template when onboarding is enabled", () => expect(provisioningReadiness(provisioningPayloadSchema.parse({ ...complete, onboarding: { start: true } })).checks.find(item => item.key === "onboarding")?.ready).toBe(false));
  it("merges a saved step without losing earlier sections", () => {
    const merged = mergeProvisioningStep(complete, "employment", { location: "Lagos" });
    expect(merged.personal?.legalFirstName).toBe("Ada");
    expect(merged.employment?.location).toBe("Lagos");
  });
  it("rejects floating-point salary input outside a decimal string", () => expect(() => provisioningPayloadSchema.parse({ compensation: { baseSalary: 1000.1 } })).toThrow());
  it("uses a serializable transaction and independent activation", () => {
    const actions = readFileSync("src/app/hr/admin/employees/new/actions.ts", "utf8");
    const service = readFileSync("src/lib/hr/employees/finalize-provisioning.ts", "utf8");
    expect(actions).toContain('isolationLevel: "Serializable"');
    expect(service).toContain("Employee creator cannot perform final activation");
    expect(service).toContain("Privileged initial roles require");
    expect(service).toContain("Compensation requires currency");
    expect(service).toContain("Onboarding requires an active onboarding template");
  });
  it("creates all final records inside the transaction client", () => {
    const service = readFileSync("src/lib/hr/employees/finalize-provisioning.ts", "utf8");
    for (const model of ["hrEmployee.create", "hrEmployeeAssignment.create", "hrSupervisorAssignment.create", "hrSalaryRecord.create", "hrEmployeeBankAccount.create", "hrUser.create", "hrLifecycleInstance.create"]) expect(service).toContain(`tx.${model}`);
  });
  it("provides the eight-step route and Employee 360 quick actions", () => {
    const wizard = readFileSync("src/components/EmployeeProvisioningWizard.tsx", "utf8");
    const profile = readFileSync("src/app/hr/admin/employees/[id]/page.tsx", "utf8");
    expect(wizard).toContain("Step {step} of 8");
    expect(profile).toContain("Employee profile sections");
    expect(profile).toContain("Assign or transfer");
  });
});
