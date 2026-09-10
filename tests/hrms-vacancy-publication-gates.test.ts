import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { transitionVacancy } from "../src/lib/hr/recruitment/vacancies";
import { appendHrAudit } from "../src/lib/hr/audit";
import { enqueueHrEmail } from "../src/lib/hr/notifications/outbox";

vi.mock("../src/lib/hr/audit", () => ({ appendHrAudit: vi.fn() }));
vi.mock("../src/lib/hr/notifications/outbox", () => ({ enqueueHrEmail: vi.fn() }));

function fixture() {
  const vacancy = {
    id: "vacancy", organizationId: "org", status: "APPROVED", version: 3,
    approvedVersion: 3, createdById: "creator", hiringTeamId: "team",
    vacancyOwnerId: "creator", responsibleHrTeamId: "hr-team",
    hiringTeam: { status: "ACTIVE" }, responsibleHrTeam: { status: "ACTIVE" },
    vacancyOwner: { status: "ACTIVE", email: "owner@example.invalid" },
    responsibleHrUser: { status: "ACTIVE", roles: [{ role: { key: "HR_ADMIN" } }] },
    approvals: [{ vacancyVersion: 3 }],
    scheduledPublishAt: new Date("2099-01-01T12:00:00Z"), applicationDeadline: null as Date | null,
  };
  const tx = {
    hrVacancy: { findFirstOrThrow: vi.fn().mockResolvedValue(vacancy), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    hrHiringTeamMember: { count: vi.fn().mockResolvedValue(1) },
    hrVacancyHistory: { create: vi.fn() },
    hrVacancyApproval: { create: vi.fn() },
    hrUser: { findFirst: vi.fn().mockResolvedValue({ id: "creator" }), findMany: vi.fn() },
  };
  const run = (options: Partial<Parameters<typeof transitionVacancy>[1]> = {}) => transitionVacancy(tx as unknown as Prisma.TransactionClient, {
    vacancyId: "vacancy", organizationId: "org", actorUserId: "creator",
    expectedVersion: 3, to: "OPEN", reason: "Synthetic publication gate test",
    ...options,
  });
  const expectNoWrites = () => {
    expect(tx.hrVacancy.updateMany).not.toHaveBeenCalled();
    expect(tx.hrVacancyHistory.create).not.toHaveBeenCalled();
    expect(tx.hrVacancyApproval.create).not.toHaveBeenCalled();
    expect(appendHrAudit).not.toHaveBeenCalled();
    expect(enqueueHrEmail).not.toHaveBeenCalled();
  };
  return { vacancy, tx, run, expectNoWrites };
}

describe("vacancy publication service blocking gates", () => {
  beforeEach(() => vi.clearAllMocks());
  it.each([
    ["primary", "primary", true], ["primary", "secondary", false], ["primary", "hr", false],
    ["secondary", "primary", true], ["secondary", "hr", true], ["secondary", "secondary", false],
    ["secondary", "other-admin", false], ["hr", "primary", true], ["hr", "secondary", true],
    ["hr", "hr", false], ["primary", "employee", false], ["secondary", "employee", false],
    ["hr", "employee", false],
  ])("approval service: %s creator and %s approver allows=%s", async (creatorId, actorId, allowed) => {
    const f = fixture();
    f.vacancy.status = "PENDING_APPROVAL";
    f.vacancy.createdById = String(creatorId);
    const person = (id: string) => ({ id, isPrimaryAdmin: id === "primary", roles: [{ role: {
      key: id === "hr" ? "HR_ADMIN" : id === "employee" ? "EMPLOYEE" : "ADMIN",
    } }] });
    f.tx.hrUser.findMany.mockResolvedValue([...new Set([String(creatorId), String(actorId)])].map(person));
    const request = f.run({ to: "APPROVED", actorUserId: String(actorId) });
    if (allowed) {
      await expect(request).resolves.toMatchObject({ status: "APPROVED", version: 4 });
      expect(f.tx.hrVacancyApproval.create).toHaveBeenCalledTimes(1);
      expect(f.tx.hrVacancyApproval.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ approverId: actorId, vacancyVersion: 4 }) }));
      expect(f.tx.hrVacancyHistory.create).toHaveBeenCalledTimes(1);
      expect(enqueueHrEmail).toHaveBeenCalledTimes(1);
    } else {
      await expect(request).rejects.toThrow("not eligible");
      f.expectNoWrites();
    }
    expect(f.tx.hrUser.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId: "org", status: "ACTIVE" }),
      include: { roles: { where: { revokedAt: null }, include: { role: true } } },
    }));
  });
  it("rejects an unapproved draft without writes or email", async () => {
    const f = fixture(); f.vacancy.status = "DRAFT";
    await expect(f.run()).rejects.toThrow("cannot transition"); f.expectNoWrites();
  });
  it("rejects missing approval evidence", async () => {
    const f = fixture(); f.vacancy.approvals = [];
    await expect(f.run()).rejects.toThrow("required_approvals_missing"); f.expectNoWrites();
  });
  it("rejects approval for a different version", async () => {
    const f = fixture(); f.vacancy.approvals = [{ vacancyVersion: 2 }];
    await expect(f.run()).rejects.toThrow("required_approvals_missing"); f.expectNoWrites();
  });
  it("rejects an inactive hiring team", async () => {
    const f = fixture(); f.vacancy.hiringTeam.status = "INACTIVE";
    await expect(f.run()).rejects.toThrow("active_hiring_team_missing"); f.expectNoWrites();
  });
  it("rejects a team without active members", async () => {
    const f = fixture(); f.tx.hrHiringTeamMember.count.mockResolvedValue(0);
    await expect(f.run()).rejects.toThrow("at least one active member"); f.expectNoWrites();
  });
  it("rejects inactive responsible HR", async () => {
    const f = fixture(); f.vacancy.responsibleHrUser.status = "INACTIVE";
    await expect(f.run()).rejects.toThrow("active responsible HR person"); f.expectNoWrites();
  });
  it("rejects responsible HR without the required role", async () => {
    const f = fixture(); f.vacancy.responsibleHrUser.roles = [];
    await expect(f.run()).rejects.toThrow("active responsible HR person"); f.expectNoWrites();
  });
  it("rejects an outdated page", async () => {
    const f = fixture(); f.vacancy.version = 4;
    await expect(f.run()).rejects.toThrow("changed since this page loaded"); f.expectNoWrites();
  });
  it.each(["OPEN", "SCHEDULED"] as const)("rechecks revoked publisher authority inside the %s transaction", async to => {
    const f = fixture();
    f.tx.hrUser.findFirst.mockResolvedValue(null);
    await expect(f.run({ to, scheduledPublishAt: f.vacancy.scheduledPublishAt })).rejects.toThrow("publication permission");
    f.expectNoWrites();
  });
  it("publishes an eligible vacancy through a version-conditional write", async () => {
    const f = fixture(); await expect(f.run()).resolves.toMatchObject({ status: "OPEN", version: 4 });
    expect(f.tx.hrVacancy.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "vacancy", organizationId: "org", version: 3 },
      data: expect.objectContaining({ careersVisible: true, status: "OPEN" }),
    }));
    expect(enqueueHrEmail).toHaveBeenCalledTimes(1);
  });
  it("reopens a paused vacancy with unchanged valid approval and active ownership", async () => {
    const f = fixture(); f.vacancy.status = "PAUSED";
    await expect(f.run()).resolves.toMatchObject({ status: "OPEN" });
  });
  it.each(["missing", "different-version"])("does not reopen paused vacancy with %s approval", async (kind) => {
    const f = fixture(); f.vacancy.status = "PAUSED";
    f.vacancy.approvals = kind === "missing" ? [] : [{ vacancyVersion: 2 }];
    await expect(f.run()).rejects.toThrow("required_approvals_missing"); f.expectNoWrites();
  });
  it("does not reopen paused vacancy with an inactive team", async () => {
    const f = fixture(); f.vacancy.status = "PAUSED"; f.vacancy.hiringTeam.status = "INACTIVE";
    await expect(f.run()).rejects.toThrow("active_hiring_team_missing"); f.expectNoWrites();
  });
  it("does not reopen paused vacancy without active team members", async () => {
    const f = fixture(); f.vacancy.status = "PAUSED"; f.tx.hrHiringTeamMember.count.mockResolvedValue(0);
    await expect(f.run()).rejects.toThrow("at least one active member"); f.expectNoWrites();
  });
  it("does not reopen paused vacancy with inactive responsible HR", async () => {
    const f = fixture(); f.vacancy.status = "PAUSED"; f.vacancy.responsibleHrUser.status = "INACTIVE";
    await expect(f.run()).rejects.toThrow("active responsible HR person"); f.expectNoWrites();
  });
  it("does not reopen paused vacancy from an outdated page", async () => {
    const f = fixture(); f.vacancy.status = "PAUSED"; f.vacancy.version = 4;
    await expect(f.run()).rejects.toThrow("changed since this page loaded"); f.expectNoWrites();
  });
  it("requires a future time before scheduling", async () => {
    const f = fixture();
    for (const scheduledPublishAt of [undefined, new Date("invalid"), new Date("2000-01-01")]) {
      await expect(f.run({ to: "SCHEDULED", scheduledPublishAt })).rejects.toThrow("future publication");
    }
    f.expectNoWrites();
  });
  it("stores a future schedule without making the vacancy visible", async () => {
    const f = fixture();
    await f.run({ to: "SCHEDULED", scheduledPublishAt: f.vacancy.scheduledPublishAt });
    expect(f.tx.hrVacancy.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      status: "SCHEDULED", careersVisible: false, scheduledPublishAt: f.vacancy.scheduledPublishAt,
    }) }));
  });
  it("rejects publication after the application deadline", async () => {
    const f = fixture(); f.vacancy.applicationDeadline = new Date("2000-01-01");
    await expect(f.run()).rejects.toThrow("application deadline"); f.expectNoWrites();
  });
  it("does not publish a schedule early", async () => {
    const f = fixture(); f.vacancy.status = "SCHEDULED";
    await expect(f.run({ source: "SCHEDULED_JOB", now: new Date("2099-01-01T11:59:59Z") })).rejects.toThrow("not due");
    f.expectNoWrites();
  });
  it("publishes a due schedule with System history and audit attribution", async () => {
    const f = fixture(); f.vacancy.status = "SCHEDULED";
    await f.run({ source: "SCHEDULED_JOB", now: f.vacancy.scheduledPublishAt });
    expect(f.tx.hrVacancyHistory.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ actorId: null, source: "SCHEDULED_JOB" }) }));
    expect(appendHrAudit).toHaveBeenCalledWith(f.tx, expect.objectContaining({ actorUserId: undefined, actorRole: "SYSTEM" }));
    expect(enqueueHrEmail).toHaveBeenCalledTimes(1);
  });
  it.each(["permission", "approval", "team", "HR", "concurrent"])("rechecks %s before automatic publication", async kind => {
    const f = fixture(); f.vacancy.status = "SCHEDULED";
    if (kind === "permission") f.tx.hrUser.findFirst.mockResolvedValue(null);
    if (kind === "approval") f.vacancy.approvals = [];
    if (kind === "team") f.vacancy.hiringTeam.status = "INACTIVE";
    if (kind === "HR") f.vacancy.responsibleHrUser.status = "INACTIVE";
    if (kind === "concurrent") f.tx.hrVacancy.updateMany.mockResolvedValue({ count: 0 });
    await expect(f.run({ source: "SCHEDULED_JOB", now: f.vacancy.scheduledPublishAt })).rejects.toThrow();
    expect(f.tx.hrVacancyHistory.create).not.toHaveBeenCalled();
    expect(appendHrAudit).not.toHaveBeenCalled(); expect(enqueueHrEmail).not.toHaveBeenCalled();
  });
});
