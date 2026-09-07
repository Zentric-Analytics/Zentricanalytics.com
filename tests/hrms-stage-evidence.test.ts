import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
const mocks = vi.hoisted(() => ({ access: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/hr/recruitment/stage-access", () => ({ assertRecruitmentStageAccess: mocks.access }));
vi.mock("@/lib/hr/audit", () => ({ appendHrAudit: mocks.audit }));
import { reconcileApprovedStageEvidence } from "../src/lib/hr/recruitment/stage-evidence";
function fixture() {
  const date = new Date("2026-01-01");
  const stages = [2, 6, 8].map(order => ({ id: `stage${order}`, stageOrder: order, status: "Approved",
    approvals: [{ id: `approval${order}`, action: "Approved", adminEmail: "hr@example.test", createdAt: date }],
    submissions: [{ id: `submission${order}`, version: 1, createdAt: date, signature: { confirmed: true },
      payload: order === 8 ? { confirmed: { candidateIdentityReviewed: true, payrollStatutoryHandlingReviewed: true } } : order === 2 ? { primaryIdType: "Passport", primaryIdNumber: "synthetic" } : { bankName: "Test", accountName: "Test", accountNumber: "123456", declarations: { payrollProcessingConsent: true } },
      documents: [{ uploadedDocumentId: "doc", uploadedDocument: { applicationId: "app", kind: "Stage 2 Primary ID Document" } }],
    }],
  }));
  const requirements = ["IDENTITY", "PAYROLL_DETAILS", "RIGHT_TO_WORK"].map(key => ({ id: key, definitionId: key, status: "NOT_STARTED", version: 1, evidence: null, evaluatedAt: null, expiresAt: null }));
  const tx = { jobApplication: { findFirstOrThrow: vi.fn().mockResolvedValue({ id: "app", stages }) },
    hrRecruitmentHandover: { findFirstOrThrow: vi.fn().mockResolvedValue({ id: "handover", status: "PENDING_HR_REVIEW", requirements }) },
    hrUser: { findFirst: vi.fn().mockResolvedValue({ id: "hr" }) },
    hrRecruitmentRequirementDefinition: { findMany: vi.fn().mockResolvedValue(requirements.map(r => ({ id: r.id, key: r.id }))) },
    hrRecruitmentRequirement: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) } };
  return { tx, stages, requirements, run: () => reconcileApprovedStageEvidence(tx as unknown as Prisma.TransactionClient, { organizationId: "org", applicationId: "app", actorUserId: "hr" }) };
}
describe("approved stage evidence bridge", () => {
  beforeEach(() => vi.clearAllMocks());
  it("carries matching evidence references but neither secrets nor a fabricated right-to-work decision", async () => {
    const f = fixture(); expect((await f.run()).updated).toEqual(["IDENTITY", "PAYROLL_DETAILS"]);
    const writes = JSON.stringify(f.tx.hrRecruitmentRequirement.updateMany.mock.calls);
    expect(writes).toContain("submission2"); expect(writes).not.toContain("123456"); expect(writes).not.toContain("synthetic");
    expect(writes).not.toContain("RIGHT_TO_WORK");
  });
  it("refuses another final reviewer", async () => {
    const f = fixture(); f.tx.hrUser.findFirst.mockResolvedValue({ id: "other" });
    await expect(f.run()).rejects.toThrow("final HR reviewer"); expect(f.tx.hrRecruitmentRequirement.updateMany).not.toHaveBeenCalled();
  });
  it("requires authorization before reading evidence", async () => {
    const f = fixture(); mocks.access.mockRejectedValueOnce(new Error("Denied"));
    await expect(f.run()).rejects.toThrow("Denied"); expect(f.tx.jobApplication.findFirstOrThrow).not.toHaveBeenCalled();
  });
  it("does not adopt submissions made after approval", async () => {
    const f = fixture(); f.stages[0].submissions[0].createdAt = new Date("2027-01-01");
    expect((await f.run()).updated).toEqual(["PAYROLL_DETAILS"]);
  });
  it("does not override rejected or already verified requirements", async () => {
    const f = fixture(); f.requirements[0].status = "REJECTED"; f.requirements[1].status = "VERIFIED";
    expect((await f.run()).updated).toEqual([]);
  });
  it("does not adopt unsigned or unchecked evidence", async () => {
    const f = fixture(); f.stages[0].submissions[0].signature.confirmed = false;
    f.stages[2].submissions[0].payload = { confirmed: { candidateIdentityReviewed: false, payrollStatutoryHandlingReviewed: false } };
    expect((await f.run()).updated).toEqual([]);
  });
  it("refuses concurrent requirement changes", async () => {
    const f = fixture(); f.tx.hrRecruitmentRequirement.updateMany.mockResolvedValue({ count: 0 });
    await expect(f.run()).rejects.toThrow("concurrently");
  });
});
