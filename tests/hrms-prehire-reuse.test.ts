import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
const m = vi.hoisted(() => ({ eligibility: vi.fn(), reconcile: vi.fn() }));
vi.mock("@/lib/hr/recruitment/handover", () => ({ evaluateHandoverEligibility: m.eligibility }));
vi.mock("@/lib/hr/recruitment/employment-handover", () => ({ reconcileRecruitmentEmployment: m.reconcile }));
vi.mock("@/lib/hr/audit", () => ({ appendHrAudit: vi.fn() }));
vi.mock("@/lib/hr/notifications/outbox", () => ({ enqueueHrEmail: vi.fn() }));
vi.mock("@/lib/hr/organization/position-commands", () => ({ reconcilePositionOccupancy: vi.fn() }));
import { convertApprovedHandoverToPreHire } from "../src/lib/hr/recruitment/prehire";

describe("pre-hire reuses final-approval identity", () => {
  it("preserves employee number and user link without allocating a second identity or assignment", async () => {
    m.eligibility.mockResolvedValue({ eligible: true, blockers: [] });
    const employee = { id: "employee", organizationId: "org", employeeNumber: "existing-number", userId: "existing-account", employmentStatus: "DRAFT" };
    const tx = {
      hrPreHireConversion: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "conversion" }) },
      hrRecruitmentHandover: { findFirstOrThrow: vi.fn().mockResolvedValue({ id: "handover", applicationId: "app", offerAcceptance: { offer: { acceptedVersion: { positionId: "position", departmentId: "department", startDate: new Date("2027-01-01") } } } }), update: vi.fn() },
      jobApplication: { findFirstOrThrow: vi.fn().mockResolvedValue({ id: "app", applicantId: "person", applicant: { email: "test@example.com", fullName: "Test Person" } }), update: vi.fn() },
      hrEmployee: { findUnique: vi.fn().mockResolvedValue(employee), update: vi.fn().mockResolvedValue(employee), create: vi.fn() },
      hrEmployeeNumberSequence: { upsert: vi.fn() },
      hrPosition: { findFirstOrThrow: vi.fn().mockResolvedValue({ id: "position" }) },
      hrLifecycleTemplate: { findFirst: vi.fn().mockResolvedValue({ id: "template", tasks: [] }) },
      hrEmployeeStatusHistory: { create: vi.fn() },
      hrEmployeeAssignment: { create: vi.fn() },
      hrLifecycleInstance: { create: vi.fn().mockResolvedValue({ id: "lifecycle" }) },
      hrCandidateEmployeeLink: { create: vi.fn() },
    };
    await convertApprovedHandoverToPreHire(tx as unknown as Prisma.TransactionClient, { organizationId: "org", handoverId: "handover", actorUserId: "hr", idempotencyKey: "conversion" });
    expect(tx.hrEmployee.create).not.toHaveBeenCalled();
    expect(tx.hrEmployeeNumberSequence.upsert).not.toHaveBeenCalled();
    expect(tx.hrEmployeeAssignment.create).not.toHaveBeenCalled();
    expect(tx.hrEmployee.update).toHaveBeenCalledWith({ where: { id: "employee" }, data: { employmentStatus: "PRE_HIRE" } });
    expect(tx.hrPreHireConversion.create).toHaveBeenCalledWith({ data: expect.objectContaining({ employeeId: "employee" }) });
    expect(m.reconcile).toHaveBeenCalledOnce();
  });
  it("returns a prior conversion without any further writes", async () => {
    const conversion = { id: "existing-conversion" };
    const tx = { hrPreHireConversion: { findFirst: vi.fn().mockResolvedValue(conversion) } };
    expect(await convertApprovedHandoverToPreHire(tx as unknown as Prisma.TransactionClient, { organizationId: "org", handoverId: "handover", actorUserId: "hr", idempotencyKey: "retry" })).toBe(conversion);
  });
});
