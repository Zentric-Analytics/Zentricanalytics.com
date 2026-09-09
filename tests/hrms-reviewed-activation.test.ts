import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { activateReadyEmployee } from "../src/lib/hr/recruitment/prehire";
vi.mock("../src/lib/hr/notifications/outbox", () => ({ enqueueHrEmail: vi.fn() }));
const now = new Date("2026-09-05");
function fixture(overrides: Record<string, unknown> = {}) {
  const employee = { id: "employee", organizationId: "org", companyEmail: "employee@company.test", employmentStatus: "PRE_HIRE", startDate: new Date("2026-09-01"), legalFirstName: "Test", lastName: "Person", employmentAssignments: [{ id: "assignment" }], lifecycleInstances: [{ id: "lifecycle", tasks: [{ required: true, status: "COMPLETED" }] }], user: { id: "user", organizationId: "org", email: "employee@company.test", passwordHash: "hash", mfaEnabled: true, status: "ACTIVE", roles: [{ role: { key: "EMPLOYEE" } }] }, ...overrides };
  const mocks = { hrRecruitmentActivation: { findFirst: vi.fn().mockResolvedValue(null), upsert: vi.fn().mockResolvedValue({ employeeActivatedAt: now }) }, hrEmployee: { findFirstOrThrow: vi.fn().mockResolvedValue(employee), update: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) }, hrPreHireConversion: { findUnique: vi.fn().mockResolvedValue({ id: "conversion", organizationId: "org", applicationId: "application", lifecycleInstanceId: "lifecycle" }) }, hrEmployeeStatusHistory: { create: vi.fn() }, hrAuditEvent: { create: vi.fn() } };
  Object.assign(employee, { recruitmentApplicationId: "application" });
  const fullMocks = { ...mocks, hiringStage: { findFirst: vi.fn().mockResolvedValue({ status: "Approved" }) } };
  return { tx: fullMocks as unknown as Prisma.TransactionClient, mocks: fullMocks, employee };
}
const input = { organizationId: "org", employeeId: "employee", actorUserId: "hr", source: "USER" as const, now };
describe("reviewed recruitment activation", () => {
  it.each(["USER", "SCHEDULED_JOB"] as const)("records activation history atomically via %s", async source => {
    const f = fixture();
    await activateReadyEmployee(f.tx, { ...input, source });
    const actor = source === "USER" ? "hr" : null;
    expect(f.mocks.hrEmployeeStatusHistory.create).toHaveBeenCalledExactlyOnceWith({ data: {
      organizationId: "org", employeeId: "employee", previousStatus: "PRE_HIRE", newStatus: "ACTIVE",
      effectiveAt: now, changedById: actor, source, reason: `Activation readiness passed via ${source}`,
    } });
    expect(f.mocks.hrAuditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ actorUserId: actor ?? undefined }) });
  });
  it("does not repeat an already recorded activation", async () => {
    const f = fixture(); f.mocks.hrRecruitmentActivation.findFirst.mockResolvedValue({ employeeActivatedAt: now } as never);
    await activateReadyEmployee(f.tx, input);
    expect(f.mocks.hrEmployee.updateMany).not.toHaveBeenCalled();
    expect(f.mocks.hrEmployeeStatusHistory.create).not.toHaveBeenCalled();
  });
  it("rejects a concurrent state change without history or audit", async () => {
    const f = fixture(); f.mocks.hrEmployee.updateMany.mockResolvedValue({ count: 0 });
    await expect(activateReadyEmployee(f.tx, input)).rejects.toThrow("state changed");
    expect(f.mocks.hrEmployeeStatusHistory.create).not.toHaveBeenCalled();
    expect(f.mocks.hrAuditEvent.create).not.toHaveBeenCalled();
  });
  it("propagates history failure so the caller rolls back activation", async () => {
    const f = fixture(); f.mocks.hrEmployeeStatusHistory.create.mockRejectedValue(new Error("history unavailable"));
    await expect(activateReadyEmployee(f.tx, input)).rejects.toThrow("history unavailable");
    expect(f.mocks.hrRecruitmentActivation.upsert).not.toHaveBeenCalled();
    expect(f.mocks.hrAuditEvent.create).not.toHaveBeenCalled();
  });
  it("requires an actor for a manual activation", async () => {
    const f = fixture();
    await expect(activateReadyEmployee(f.tx, { ...input, actorUserId: undefined })).rejects.toThrow("requires an actor");
    expect(f.mocks.hrEmployee.updateMany).not.toHaveBeenCalled();
  });
  it.each(["ACTIVE", "TERMINATED", "ARCHIVED", "DRAFT"])("does not invent a pre-hire transition from %s", async employmentStatus => {
    const f = fixture({ employmentStatus });
    await expect(activateReadyEmployee(f.tx, input)).rejects.toThrow("not eligible");
    expect(f.mocks.hrEmployeeStatusHistory.create).not.toHaveBeenCalled();
  });
  it("does not substitute an unrelated completed lifecycle", async () => {
    const f = fixture({ lifecycleInstances: [{ id: "unrelated", tasks: [{ required: true, status: "COMPLETED" }] }] });
    await expect(activateReadyEmployee(f.tx, input)).rejects.toThrow("blocking_requirements_incomplete");
    expect(f.mocks.hrEmployee.update).not.toHaveBeenCalled();
  });
  it("does not provision an account from personal email", async () => {
    const { tx, mocks } = fixture({ user: null, personalEmail: "personal@example.test" });
    await expect(activateReadyEmployee(tx, input)).rejects.toThrow("blocked");
    expect(mocks.hrEmployee.update).not.toHaveBeenCalled();
  });
  it("requires login company identity to match employee record", async () => {
    const { tx } = fixture({ companyEmail: "other@company.test" });
    await expect(activateReadyEmployee(tx, input)).rejects.toThrow("company-email");
  });
  it("requires an active employee role", async () => {
    const f = fixture();
    f.employee.user.roles = [];
    await expect(activateReadyEmployee(f.tx, input)).rejects.toThrow("employee role");
  });
  it("does not reactivate suspended or incomplete-security accounts", async () => {
    for (const patch of [{ status: "SUSPENDED" }, { mfaEnabled: false }, { passwordHash: "" }]) {
      const f = fixture(); Object.assign(f.employee.user, patch);
      await expect(activateReadyEmployee(f.tx, input)).rejects.toThrow("blocked");
    }
  });
  it("retains employment start-date and required-task gates", async () => {
    for (const override of [{ startDate: new Date("2026-10-01") }, { lifecycleInstances: [{ tasks: [{ required: true, status: "PENDING" }] }] }]) {
      const { tx } = fixture(override);
      await expect(activateReadyEmployee(tx, input)).rejects.toThrow("blocked");
    }
  });
  it("activates a ready employee without issuing another invitation", async () => {
    const { tx, mocks } = fixture();
    await expect(activateReadyEmployee(tx, input)).resolves.toMatchObject({ employeeActivatedAt: now });
    expect(mocks.hrEmployee.updateMany).toHaveBeenCalledWith({ where: { id: "employee", organizationId: "org", employmentStatus: "PRE_HIRE" }, data: { employmentStatus: "ACTIVE" } });
  });
  it("requires stage eight final approval even for an existing linked account", async () => {
    const { tx, mocks } = fixture();
    mocks.hiringStage.findFirst.mockResolvedValueOnce(null);
    await expect(activateReadyEmployee(tx, input)).rejects.toThrow("blocked");
  });
});
