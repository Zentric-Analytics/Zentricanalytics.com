import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { changePreHireState } from "../src/lib/hr/recruitment/onboarding";

function fixture(status = "PRE_HIRE") {
  const startDate = new Date("2026-09-10");
  const mocks = {
    hrEmployee: { findFirstOrThrow: vi.fn().mockResolvedValue({ id: "employee", employmentStatus: status, startDate }), update: vi.fn() },
    hrEmployeeStatusHistory: { create: vi.fn() },
    hrEmployeeAssignment: { updateMany: vi.fn() },
    hrAuditEvent: { create: vi.fn() },
  };
  return { mocks, tx: mocks as unknown as Prisma.TransactionClient, startDate };
}
const input = { organizationId: "org", employeeId: "employee", actorUserId: "hr", reason: "Synthetic hold test" };

describe("pre-hire status history", () => {
  it.each([
    ["PRE_HIRE", "ON_HOLD"], ["ON_HOLD", "PRE_HIRE"], ["PRE_HIRE", "CANCELLED"],
  ] as const)("records %s to %s with the same actor and reason as audit", async (from, to) => {
    const f = fixture(from);
    await changePreHireState(f.tx, { ...input, to });
    expect(f.mocks.hrEmployeeStatusHistory.create).toHaveBeenCalledExactlyOnceWith({ data: {
      organizationId: "org", employeeId: "employee", previousStatus: from, newStatus: to,
      effectiveAt: expect.any(Date), changedById: "hr", reason: input.reason,
    } });
    expect(f.mocks.hrAuditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      actorUserId: "hr", reason: input.reason, previousValues: expect.objectContaining({ employmentStatus: from }),
      newValues: expect.objectContaining({ employmentStatus: to }),
    }) });
    expect(f.mocks.hrEmployee.update).toHaveBeenCalledWith({ where: { id: "employee" }, data: { employmentStatus: to, startDate: f.startDate } });
    expect(f.mocks.hrEmployeeAssignment.updateMany).not.toHaveBeenCalled();
  });
  it("does not invent a status transition for a date-only edit", async () => {
    const f = fixture();
    await changePreHireState(f.tx, { ...input, to: "PRE_HIRE", startDate: new Date("2026-09-11") });
    expect(f.mocks.hrEmployeeStatusHistory.create).not.toHaveBeenCalled();
    expect(f.mocks.hrEmployeeAssignment.updateMany).toHaveBeenCalledOnce();
    expect(f.mocks.hrAuditEvent.create).toHaveBeenCalledOnce();
  });
  it("propagates history failures to the caller's transaction", async () => {
    const f = fixture();
    f.mocks.hrEmployeeStatusHistory.create.mockRejectedValueOnce(new Error("history unavailable"));
    await expect(changePreHireState(f.tx, { ...input, to: "ON_HOLD" })).rejects.toThrow("history unavailable");
    expect(f.mocks.hrAuditEvent.create).not.toHaveBeenCalled();
  });
  it("rejects a missing reason before changing data", async () => {
    const f = fixture();
    await expect(changePreHireState(f.tx, { ...input, to: "ON_HOLD", reason: " " })).rejects.toThrow("reason");
    expect(f.mocks.hrEmployee.update).not.toHaveBeenCalled();
  });
});
