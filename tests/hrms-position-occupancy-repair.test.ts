import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
vi.mock("@/lib/hr/audit", () => ({ appendHrAudit: vi.fn() }));
import { appendHrAudit } from "@/lib/hr/audit";
import { repairPositionOccupancy } from "../src/lib/hr/organization/position-commands";

function fixture(state = "FILLED", ftes: number[] = []) {
  const position = { id: "position", organizationId: "org", version: 3, status: "ACTIVE", approvedAt: new Date(), lifecycleStatus: state, headcountLimit: 2, fullTimeEquivalent: new Prisma.Decimal(2) };
  const tx = { hrPosition: { findFirstOrThrow: vi.fn().mockResolvedValue(position), update: vi.fn() }, hrEmployeeAssignment: { findMany: vi.fn().mockResolvedValue(ftes.map(fte => ({ fte: new Prisma.Decimal(fte) }))) } };
  return { position, tx, run: (expectedVersion = 3) => repairPositionOccupancy(tx as unknown as Prisma.TransactionClient, { organizationId: "org", actorUserId: "admin" }, { positionId: "position", expectedVersion, reason: "Reconcile reviewed capacity" }) };
}
describe("governed position occupancy repair", () => {
  it("reopens an empty filled position and audits it", async () => {
    const f = fixture();
    expect(await f.run()).toBe("OPEN");
    expect(f.tx.hrPosition.update).toHaveBeenCalledWith({ where: { id: "position" }, data: { lifecycleStatus: "OPEN", version: { increment: 1 } } });
    expect(appendHrAudit).toHaveBeenCalledWith(f.tx, expect.objectContaining({ action: "hr.position.occupancy_reconciled", organizationId: "org" }));
  });
  it.each([[[1], "PARTIALLY_FILLED"], [[1, 1], "FILLED"]] as const)("derives actual occupied capacity %j", async (ftes, status) => {
    expect(await fixture("FILLED", [...ftes]).run()).toBe(status);
  });
  it.each(["DRAFT", "PENDING_APPROVAL", "FROZEN", "CLOSED", "CANCELLED"])("preserves %s", async status => {
    const f = fixture(status); await expect(f.run()).rejects.toThrow("Only active, approved"); expect(f.tx.hrPosition.update).not.toHaveBeenCalled();
  });
  it("rejects stale versions", async () => { await expect(fixture().run(2)).rejects.toThrow("Position changed"); });
  it("rejects archived positions", async () => { const f = fixture(); f.position.status = "ARCHIVED"; await expect(f.run()).rejects.toThrow("Only active, approved"); });
  it("does not hide over-capacity assignments", async () => { await expect(fixture("FILLED", [1, 1, 1]).run()).rejects.toThrow("capacity"); });
  it("scopes assignment reads to the organization", async () => {
    const f = fixture(); await f.run(); expect(f.tx.hrEmployeeAssignment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: "org", positionId: "position", status: "ACTIVE" }) }));
  });
});
