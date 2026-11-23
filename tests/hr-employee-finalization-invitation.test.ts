import { afterEach, expect, it, vi } from "vitest";
import { finalizeEmployeeProvisioning } from "@/lib/hr/employees/finalize-provisioning";

vi.mock("@/lib/hr/audit", () => ({ appendHrAudit: vi.fn() }));
vi.mock("@/lib/hr/organization/position-commands", () => ({ reconcilePositionOccupancy: vi.fn() }));

const departmentId = "cm00000000000000000000001";
const positionId = "cm00000000000000000000002";
const input = { draftId: "draft", actorUserId: "approver", organizationId: "organization" };

function fixture(sendInvitation: boolean, email = "fictional@example.invalid") {
  const day = "2026-11-23";
  const draft = {
    id: input.draftId, createdById: "maker",
    payload: {
      personal: { legalFirstName: "Fictional", lastName: "Employee", personalEmail: email },
      employment: { employeeNumber: "QA1", hireDate: day, startDate: day, employmentType: "FULL_TIME" },
      assignment: { departmentId, positionId, effectiveFrom: day, reason: "Fictional fixture" },
      access: { createUser: true, sendInvitation, email, role: "EMPLOYEE" },
    },
  };
  let finalized = false;
  const tx = {
    hrEmployeeProvisioningDraft: {
      findFirstOrThrow: vi.fn(async () => { if (finalized) throw new Error("No pending draft"); return draft; }),
      update: vi.fn(async () => { finalized = true; }),
    },
    hrDepartment: { findFirstOrThrow: vi.fn().mockResolvedValue({ id: departmentId }) },
    hrPosition: { findFirstOrThrow: vi.fn().mockResolvedValue({ id: positionId, departmentId }) },
    hrEmployee: { count: vi.fn().mockResolvedValue(0), create: vi.fn().mockResolvedValue({ id: "employee" }), update: vi.fn() },
    hrEmployeeStatusHistory: { create: vi.fn() },
    hrEmployeeAssignment: { create: vi.fn() },
    hrRole: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "employee-role" }) },
    hrUser: { create: vi.fn().mockResolvedValue({ id: "account" }), findFirst: vi.fn().mockResolvedValue({ id: "account" }) },
    hrUserRole: { create: vi.fn() },
    hrAccountInvitation: { create: vi.fn(async ({ data }) => ({ id: "invitation", ...data })) },
    hrNotificationPreference: { findUnique: vi.fn().mockResolvedValue(null) },
    hrEmailOutbox: { upsert: vi.fn(async ({ create }) => create) },
    hrNotification: { upsert: vi.fn() },
  };
  return { tx, finalize: () => finalizeEmployeeProvisioning(tx as never, input) };
}

afterEach(() => vi.unstubAllEnvs());

it("finalizes an approved employee with an invitation accepted by the real outbox guard", async () => {
  vi.stubEnv("AUTH_SECRET", "fictional-secret-at-least-thirty-two-bytes");
  const { tx, finalize } = fixture(true);
  expect(await finalize()).toEqual({ id: "employee" });
  const [{ data: invitation }] = tx.hrAccountInvitation.create.mock.calls[0];
  const [{ create: outbox }] = tx.hrEmailOutbox.upsert.mock.calls[0];
  expect(invitation.userId).toBe("account");
  expect(outbox).toMatchObject({
    invitationId: "invitation", messageExpiresAt: invitation.expiresAt,
    safetyContractVersion: 1, dispatchPhase: "NONE",
    payload: { invitationId: "invitation", credentialEnvelope: expect.any(String) },
  });
  expect(tx.hrEmployee.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: "account" }) }));
  await expect(finalize()).rejects.toThrow("No pending draft");
  expect(tx.hrEmailOutbox.upsert).toHaveBeenCalledTimes(1);
});

it("finalizes an employee and account without an optional invitation", async () => {
  const { tx, finalize } = fixture(false);
  await expect(finalize()).resolves.toEqual({ id: "employee" });
  expect(tx.hrUser.create).toHaveBeenCalledTimes(1);
  expect(tx.hrAccountInvitation.create).not.toHaveBeenCalled();
  expect(tx.hrEmailOutbox.upsert).not.toHaveBeenCalled();
});

it("rejects invalid invitation data before writes and propagates outbox failure to the transaction", async () => {
  const invalid = fixture(true, "invalid-address");
  await expect(invalid.finalize()).rejects.toThrow();
  expect(invalid.tx.hrEmployee.create).not.toHaveBeenCalled();
  vi.stubEnv("AUTH_SECRET", "fictional-secret-at-least-thirty-two-bytes");
  const failed = fixture(true);
  failed.tx.hrEmailOutbox.upsert.mockRejectedValue(new Error("Outbox write failed"));
  await expect(failed.finalize()).rejects.toThrow("Outbox write failed");
  expect(failed.tx.hrEmployeeProvisioningDraft.update).not.toHaveBeenCalled();
});
