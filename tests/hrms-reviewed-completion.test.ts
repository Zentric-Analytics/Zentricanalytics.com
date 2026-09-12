import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
const m = vi.hoisted(() => ({ access: vi.fn(), evidence: vi.fn(), employment: vi.fn(), profile: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/hr/recruitment/personal-handover", () => ({ transferApprovedOnboardingProfile: m.profile }));
vi.mock("@/lib/hr/recruitment/stage-access", () => ({ assertRecruitmentStageAccess: m.access }));
vi.mock("@/lib/hr/recruitment/stage-evidence", () => ({ reconcileApprovedStageEvidence: m.evidence }));
vi.mock("@/lib/hr/recruitment/employment-handover", () => ({ reconcileRecruitmentEmployment: m.employment }));
vi.mock("@/lib/hr/audit", () => ({ appendHrAudit: m.audit }));
import { completeReviewedRecruitment } from "../src/lib/hr/recruitment/reviewed-completion";
function fixture() {
  const date = new Date("2026-01-01");
  const employee = { id: "employee", userId: "same-user", employmentStatus: "DRAFT", startDate: date };
  const requirements = [{ definitionId: "rtw", blocking: true, status: "VERIFIED", expiresAt: null }];
  const app = { id: "app", applicantId: "person", createdAt: date, stages: Array.from({ length: 8 }, (_, i) => ({ id: `stage${i+1}`, stageOrder: i+1, status: "Approved", title: `Stage ${i+1}`, approvedAt: date })) };
  const tx = { hrEmployee: { findFirstOrThrow: vi.fn().mockResolvedValue(employee), findUniqueOrThrow: vi.fn().mockResolvedValue(employee), update: vi.fn() },
    hrPreHireConversion: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "conversion" }) },
    hrRecruitmentHandover: { findFirstOrThrow: vi.fn().mockResolvedValue({ id: "handover", requirements, documentReviews: [] }), update: vi.fn() },
    hrRecruitmentRequirementDefinition: { findMany: vi.fn().mockResolvedValue([{ id: "rtw", name: "Right-to-work verification" }]) },
    jobApplication: { findFirstOrThrow: vi.fn().mockResolvedValue(app), update: vi.fn() },
    hrLifecycleInstance: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "lifecycle" }) },
    hrLifecycleTemplate: { upsert: vi.fn().mockResolvedValue({ id: "template" }) },
    hrCandidateEmployeeLink: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
    hrEmployeeStatusHistory: { create: vi.fn() },
  };
  return { tx, requirements, app, run: () => completeReviewedRecruitment(tx as unknown as Prisma.TransactionClient, { organizationId: "org", applicationId: "app", actorUserId: "hr" }) };
}
describe("reviewed recruitment completion", () => {
  beforeEach(() => vi.clearAllMocks());
  it("records eight completed source stages on the same employee, without activating them", async () => {
    const f = fixture(); await f.run(); const data = f.tx.hrLifecycleInstance.create.mock.calls[0][0].data;
    expect(data.employeeId).toBe("employee"); expect(data.status).toBe("COMPLETED");
    expect(data.tasks.create).toHaveLength(8); expect(data.tasks.create.every((t: {status: string}) => t.status === "COMPLETED")).toBe(true);
    // Mirrors HrLifecycleTask_terminal_state_check: completed rows require
    // a timestamp, actor and notes. Mock-only tests previously missed the actor.
    for (const task of data.tasks.create) {
      expect(task.completedAt).toBeInstanceOf(Date);
      expect(task.completedById).toBe('hr');
      expect(task.completionNotes.trim().length).toBeGreaterThanOrEqual(3);
      expect(task.evidenceReference).toMatch(/^recruitment-stage:/);
    }
    expect(f.tx.hrEmployee.update).toHaveBeenCalledWith({ where: { id: "employee" }, data: { employmentStatus: "PRE_HIRE" } });
    expect(f.tx.hrPreHireConversion.create.mock.calls[0][0].data.employeeId).toBe("employee");
    expect(m.profile).toHaveBeenCalledWith(f.tx, { organizationId: "org", applicationId: "app", actorUserId: "hr" });
  });
  it("blocks unsupported verification before creating onboarding", async () => {
    const f = fixture(); f.requirements[0].status = "NOT_STARTED";
    await expect(f.run()).rejects.toThrow("Right-to-work"); expect(f.tx.hrLifecycleInstance.create).not.toHaveBeenCalled();
  });
  it("does not duplicate or overwrite existing onboarding", async () => {
    const f = fixture(); f.tx.hrLifecycleInstance.findFirst.mockResolvedValue({ id: "existing" } as never);
    await expect(f.run()).rejects.toThrow("Existing onboarding"); expect(f.tx.hrLifecycleInstance.create).not.toHaveBeenCalled();
  });
  it("is idempotent for an already connected record", async () => {
    const f = fixture(); f.tx.hrPreHireConversion.findUnique.mockResolvedValue({ id: "existing", organizationId: "org", applicationId: "app" } as never);
    expect(await f.run()).toMatchObject({ id: "existing" }); expect(m.evidence).not.toHaveBeenCalled(); expect(f.tx.hrLifecycleInstance.create).not.toHaveBeenCalled();
    expect(m.profile).toHaveBeenCalledOnce();
  });
  it("rejects a conversion belonging to a different organization or application before transfer", async () => {
    for (const previous of [
      { id: "existing", organizationId: "other-org", applicationId: "app" },
      { id: "existing", organizationId: "org", applicationId: "other-app" },
    ]) {
      const f = fixture();
      m.profile.mockClear();
      f.tx.hrPreHireConversion.findUnique.mockResolvedValue(previous as never);
      await expect(f.run()).rejects.toThrow("Conflicting employee conversion");
      expect(m.profile).not.toHaveBeenCalled();
      expect(f.tx.hrLifecycleInstance.create).not.toHaveBeenCalled();
    }
  });
  it("preserves each source stage approval time and reference without creating another approval", async () => {
    const f = fixture();
    f.app.stages.forEach((stage, index) => { stage.approvedAt = new Date(Date.UTC(2026, 0, index + 1)); });
    await f.run();
    const tasks = f.tx.hrLifecycleInstance.create.mock.calls[0][0].data.tasks.create;
    for (const [index, stage] of f.app.stages.entries()) {
      expect(tasks[index].completedAt).toEqual(stage.approvedAt);
      expect(tasks[index].evidenceReference).toBe(`recruitment-stage:${stage.id}`);
      expect(tasks[index].completionNotes).toContain("not a new stage approval");
    }
  });
  it("blocks incomplete stages", async () => {
    const f = fixture(); f.app.stages[5].status = "Correction Requested";
    await expect(f.run()).rejects.toThrow("All eight");
  });
  it("blocks conflicting candidate links", async () => {
    const f = fixture(); f.tx.hrCandidateEmployeeLink.findUnique.mockResolvedValue({ employeeId: "other" } as never);
    await expect(f.run()).rejects.toThrow("Conflicting candidate");
  });
});
