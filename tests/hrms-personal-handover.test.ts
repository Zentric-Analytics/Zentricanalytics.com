import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
const m = vi.hoisted(() => ({ access: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/hr/recruitment/stage-access", () => ({ assertRecruitmentStageAccess: m.access }));
vi.mock("@/lib/hr/audit", () => ({ appendHrAudit: m.audit }));
import { transferApprovedOnboardingProfile } from "../src/lib/hr/recruitment/personal-handover";

function fixture() {
  const submission = { id: "submission", version: 1, createdAt: new Date("2026-01-01"), signature: { confirmed: true },
    payload: { preferredName: "Test Preferred", residentialAddress: "1 Example Street", currentCity: "Example City", stateOfResidence: "Example State", nationality: "Not a residence country",
      emergencyContactName: "Test Contact", emergencyContactRelationship: "Fixture", emergencyContactPhone: "+12025550100" } };
  const stage = { status: "Approved", submissions: [submission], approvals: [{ id: "approval", action: "Approved", createdAt: new Date("2026-01-02") }] };
  const employee = { id: "employee", preferredName: null as string | null, employmentStatus: "DRAFT", addresses: [] as {type: string; isPrimary: boolean}[], emergencyContacts: [] as {id: string}[] };
  const tx = { jobApplication: { findFirstOrThrow: vi.fn().mockResolvedValue({ id: "app", stages: [stage] }) },
    hrEmployee: { findFirstOrThrow: vi.fn().mockResolvedValue(employee), update: vi.fn() },
    hrEmployeeAddress: { create: vi.fn() }, hrEmergencyContact: { create: vi.fn() }, hrAuditEvent: { findFirst: vi.fn().mockResolvedValue(null) } };
  return { tx, stage, submission, employee, run: () => transferApprovedOnboardingProfile(tx as unknown as Prisma.TransactionClient,
    { organizationId: "org", applicationId: "app", actorUserId: "hr" }) };
}
describe("approved personal onboarding transfer", () => {
  beforeEach(() => vi.clearAllMocks());
  it("fills absent fields on the existing identity without inventing a country", async () => {
    const f = fixture(); await f.run();
    expect(f.tx.hrEmployee.update).toHaveBeenCalledWith({ where: { id: "employee" }, data: { preferredName: "Test Preferred" } });
    expect(f.tx.hrEmployeeAddress.create).toHaveBeenCalledWith({ data: { employeeId: "employee", type: "HOME", line1: "1 Example Street", city: "Example City", state: "Example State", country: "", isPrimary: true } });
    expect(f.tx.hrEmergencyContact.create).toHaveBeenCalledWith({ data: { employeeId: "employee", fullName: "Test Contact", relationship: "Fixture", phone: "+12025550100", isPrimary: true } });
    const audit = m.audit.mock.calls[0][1];
    expect(audit.newValues).toMatchObject({ submissionId: "submission", submissionVersion: 1, stageApprovalId: "approval" });
    expect(JSON.stringify(audit)).not.toContain("Example Street");
    expect(JSON.stringify(audit)).not.toContain("12025550100");
  });
  it("preserves existing HR values and records", async () => {
    const f = fixture(); f.employee.preferredName = "HR edited";
    f.employee.addresses = [{ type: "HOME", isPrimary: true }]; f.employee.emergencyContacts = [{ id: "existing" }];
    await f.run(); expect(f.tx.hrEmployee.update).not.toHaveBeenCalled(); expect(f.tx.hrEmployeeAddress.create).not.toHaveBeenCalled(); expect(f.tx.hrEmergencyContact.create).not.toHaveBeenCalled();
  });
  it("does not recreate data deleted after an earlier transfer", async () => {
    const f = fixture(); f.tx.hrAuditEvent.findFirst.mockResolvedValue({ id: "prior" }); await f.run();
    expect(f.tx.hrEmployeeAddress.create).not.toHaveBeenCalled(); expect(f.tx.hrEmergencyContact.create).not.toHaveBeenCalled(); expect(m.audit).not.toHaveBeenCalled();
  });
  it.each(["Under Review", "Correction Requested", "Rejected"])("rejects an unapproved stage: %s", async status => {
    const f = fixture(); f.stage.status = status; await expect(f.run()).rejects.toThrow("approved onboarding"); expect(f.tx.hrEmployee.update).not.toHaveBeenCalled();
  });
  it("rejects a newer submission than the approval", async () => {
    const f = fixture(); f.submission.createdAt = new Date("2026-01-03"); await expect(f.run()).rejects.toThrow("approved onboarding");
  });
  it("rejects an unsigned submission", async () => {
    const f = fixture(); f.submission.signature.confirmed = false; await expect(f.run()).rejects.toThrow("approved onboarding");
  });
  it("rejects activated records", async () => {
    const f = fixture(); f.employee.employmentStatus = "ACTIVE"; await expect(f.run()).rejects.toThrow("unactivated");
  });
  it("keeps an existing primary mailing address primary", async () => {
    const f = fixture(); f.employee.addresses = [{ type: "MAILING", isPrimary: true }]; await f.run();
    expect(f.tx.hrEmployeeAddress.create.mock.calls[0][0].data.isPrimary).toBe(false);
  });
  it("does not create incomplete contact or address records", async () => {
    const f = fixture(); f.submission.payload.currentCity = ""; f.submission.payload.emergencyContactPhone = ""; await f.run();
    expect(f.tx.hrEmployeeAddress.create).not.toHaveBeenCalled(); expect(f.tx.hrEmergencyContact.create).not.toHaveBeenCalled();
  });
  it("enforces stage authority before reading personal information", async () => {
    const f = fixture(); m.access.mockRejectedValueOnce(new Error("Denied")); await expect(f.run()).rejects.toThrow("Denied"); expect(f.tx.jobApplication.findFirstOrThrow).not.toHaveBeenCalled();
  });
});
