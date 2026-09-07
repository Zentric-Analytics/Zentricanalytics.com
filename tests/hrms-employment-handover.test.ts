import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
const m = vi.hoisted(() => ({ access: vi.fn(), audit: vi.fn(), occupancy: vi.fn() }));
vi.mock("@/lib/hr/recruitment/stage-access", () => ({ assertRecruitmentStageAccess: m.access }));
vi.mock("@/lib/hr/audit", () => ({ appendHrAudit: m.audit }));
vi.mock("@/lib/hr/organization/position-commands", () => ({ reconcilePositionOccupancy: m.occupancy }));
import { reconcileRecruitmentEmployment } from "../src/lib/hr/recruitment/employment-handover";

const input = { organizationId: "org", applicationId: "app", actorUserId: "hr" };
const startDate = new Date("2027-01-05T00:00:00Z");
function fixture() {
  const terms = { id: "terms", positionId: "position", departmentId: "department", legalEntityId: "entity", employmentType: "FULL_TIME", workMode: "REMOTE", startDate, location: "Remote" };
  const employee = { id: "employee", userId: "existing-login", employmentStatus: "DRAFT", employmentAssignments: [], hireDate: null, startDate: null, workMode: null };
  const offer = { acceptedVersion: terms, acceptance: { offerVersionId: "terms", applicantId: "person" }, approvals: [{ offerVersionId: "terms", decision: "APPROVED" }] };
  const tx = {
    jobApplication: { findFirstOrThrow: vi.fn().mockResolvedValue({ id: "app", applicantId: "person" }) },
    hrEmployee: { findFirstOrThrow: vi.fn().mockResolvedValue(employee), update: vi.fn().mockResolvedValue(employee) },
    hrRecruitmentOffer: { findFirstOrThrow: vi.fn().mockResolvedValue(offer) },
    hrPosition: { findFirstOrThrow: vi.fn().mockResolvedValue({ id: "position", teamId: "team", lifecycleStatus: "OPEN", headcountLimit: 1, fullTimeEquivalent: 1 }) },
    hrLegalEntity: { findFirstOrThrow: vi.fn().mockResolvedValue({ id: "entity" }) },
    hrPreHireConversion: { findUnique: vi.fn().mockResolvedValue(null) },
    hrEmployeeAssignment: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn() },
  };
  return { tx, employee, offer, run: () => reconcileRecruitmentEmployment(tx as unknown as Prisma.TransactionClient, input) };
}
describe("accepted employment reconciliation", () => {
  beforeEach(() => vi.clearAllMocks());
  it("fills accepted terms without changing identity, login or employment status", async () => {
    const f = fixture(); await f.run();
    expect(f.tx.hrEmployee.update).toHaveBeenCalledWith({ where: { id: "employee" }, data: { hireDate: startDate, startDate, workMode: "REMOTE" } });
    expect(f.tx.hrEmployeeAssignment.create).toHaveBeenCalledWith({ data: expect.objectContaining({ employeeId: "employee", positionId: "position", departmentId: "department", effectiveFrom: startDate }) });
    expect(m.audit).toHaveBeenCalledOnce();
    expect(m.audit.mock.calls[0][1]).not.toHaveProperty("applicationId");
    expect(m.audit.mock.calls[0][1].newValues).toEqual({ applicationId: "app", offerVersionId: "terms" });
  });
  it("scopes reads and requires completed final approval", async () => {
    const f = fixture(); await f.run();
    expect(m.access).toHaveBeenCalledWith(f.tx, { ...input, stage: 8 });
    expect(f.tx.jobApplication.findFirstOrThrow).toHaveBeenCalledWith({ where: expect.objectContaining({ organizationId: "org", status: "Hired", deletedAt: null, stages: { some: { stageOrder: 8, status: "Approved" } } }) });
  });
  it("refuses unauthorized repair before reading records", async () => {
    const f = fixture(); m.access.mockRejectedValueOnce(new Error("Not assigned HR"));
    await expect(f.run()).rejects.toThrow("Not assigned HR");
    expect(f.tx.hrEmployee.update).not.toHaveBeenCalled();
  });
  it("refuses a different accepted version", async () => {
    const f = fixture(); f.offer.acceptance.offerVersionId = "other";
    await expect(f.run()).rejects.toThrow("approved, accepted");
    expect(f.tx.hrEmployeeAssignment.create).not.toHaveBeenCalled();
  });
  it("refuses unapproved terms", async () => {
    const f = fixture(); f.offer.approvals = [];
    await expect(f.run()).rejects.toThrow("approved, accepted");
  });
  it("does not overwrite conflicting dates", async () => {
    const f = fixture(); f.tx.hrEmployee.findFirstOrThrow.mockResolvedValue({ ...f.employee, hireDate: new Date("2026-01-01") });
    await expect(f.run()).rejects.toThrow("conflict");
    expect(f.tx.hrEmployee.update).not.toHaveBeenCalled();
  });
  it("does not modify an active employee with incomplete details", async () => {
    const f = fixture(); f.employee.employmentStatus = "ACTIVE";
    await expect(f.run()).rejects.toThrow("unactivated");
  });
  it("is a no-op on repeat, preserving the original assignment", async () => {
    const f = fixture(); f.tx.hrEmployee.findFirstOrThrow.mockResolvedValue({ ...f.employee, hireDate: startDate, startDate, workMode: "REMOTE", employmentAssignments: [{ id: "assignment", reason: "Accepted recruitment offer version terms", positionId: "position", departmentId: "department", legalEntityId: "entity", employmentType: "FULL_TIME", location: "Remote", effectiveFrom: startDate, status: "ACTIVE" }] });
    await f.run(); expect(f.tx.hrEmployeeAssignment.create).not.toHaveBeenCalled(); expect(f.tx.hrEmployee.update).not.toHaveBeenCalled(); expect(m.audit).not.toHaveBeenCalled();
  });
  it("blocks occupied positions before creating an assignment", async () => {
    const f = fixture(); f.tx.hrEmployeeAssignment.findMany.mockResolvedValue([{ fte: 1 }]);
    await expect(f.run()).rejects.toThrow("capacity");
    expect(f.tx.hrEmployeeAssignment.create).not.toHaveBeenCalled();
  });
});
