import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ actor: vi.fn(), employee: vi.fn(), vacancy: vi.fn(), existing: vi.fn(), create: vi.fn(), update: vi.fn(), role: vi.fn(), assign: vi.fn(), audit: vi.fn(), invite: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: async (fn: (tx: unknown) => unknown) => fn({ hrUser: { findFirstOrThrow: m.actor, findUnique: m.existing, create: m.create }, hrEmployee: { findFirstOrThrow: m.employee, update: m.update }, hrVacancy: { findFirst: m.vacancy }, hrRole: { findUniqueOrThrow: m.role }, hrUserRole: { upsert: m.assign } }) } }));
vi.mock("@/lib/hr/audit", () => ({ appendHrAudit: m.audit }));
vi.mock("@/lib/hr/auth/invitations", () => ({ createHrInvitation: m.invite }));
import { createLinkedEmployeeInvitation } from "../src/lib/hr/recruitment/employee-access";
const input = { organizationId: "org", actorUserId: "hr", employeeId: "employee" };
const application = { id: "app", organizationId: "org", vacancyId: "vacancy", deletedAt: null, status: "Hired", stages: [{ stageOrder: 8, status: "Approved" }] };
const employee = { id: "employee", userId: null, employmentStatus: "DRAFT", companyEmail: "company@zentricanalytics.com", recruitmentApplication: application };
describe("linked employee invitations", () => {
  it.each(["TERMINATED", "SUSPENDED", "ARCHIVED", "RESIGNED"])("blocks account setup for %s employment", async (employmentStatus) => {
    m.employee.mockResolvedValue({ ...employee, employmentStatus });
    await expect(createLinkedEmployeeInvitation(input)).rejects.toThrow("employment status");
    expect(m.invite).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    m.actor.mockResolvedValue({ id: "hr", isPrimaryAdmin: false, roles: [{ role: { key: "HR_ADMIN" } }] });
    m.employee.mockResolvedValue(employee);
    m.vacancy.mockResolvedValue({ responsibleHrUserId: "hr" });
    m.existing.mockResolvedValue(null);
    m.create.mockResolvedValue({ id: "new-user" });
    m.role.mockResolvedValue({ id: "employee-role" });
    m.invite.mockResolvedValue({ invitation: { id: "invite" }, rawToken: "not-returned" });
  });
  it("links the completed applicant and invites company email without activating employment", async () => {
    expect(await createLinkedEmployeeInvitation(input)).toEqual({ userId: "new-user", invitationId: "invite" });
    expect(m.update).toHaveBeenCalledWith({ where: { id: "employee" }, data: { userId: "new-user" } });
    expect(m.invite).toHaveBeenCalledWith({ organizationId: "org", userId: "new-user", createdById: "hr", recipient: "company@zentricanalytics.com" });
  });
  it.each([null, { ...application, organizationId: "other" }, { ...application, status: "Review" }, { ...application, stages: [] }])("refuses incomplete or cross-org lineage", async (recruitmentApplication) => {
    m.employee.mockResolvedValue({ ...employee, recruitmentApplication });
    await expect(createLinkedEmployeeInvitation(input)).rejects.toThrow("final HR approval");
    expect(m.invite).not.toHaveBeenCalled();
  });
  it("refuses unassigned HR", async () => {
    m.vacancy.mockResolvedValue({ responsibleHrUserId: "other" });
    await expect(createLinkedEmployeeInvitation(input)).rejects.toThrow("assigned HR");
  });
  it("permits primary administrator", async () => {
    m.actor.mockResolvedValue({ id: "hr", isPrimaryAdmin: true, roles: [{ role: { key: "ADMIN" } }] });
    m.vacancy.mockResolvedValue(null);
    await createLinkedEmployeeInvitation(input);
    expect(m.invite).toHaveBeenCalledOnce();
  });
  it("refuses absent company email", async () => {
    m.employee.mockResolvedValue({ ...employee, companyEmail: null });
    await expect(createLinkedEmployeeInvitation(input)).rejects.toThrow("valid company email");
  });
  it("never adopts an unrelated email-only account", async () => {
    m.existing.mockResolvedValue({ id: "other-user", employee: null });
    await expect(createLinkedEmployeeInvitation(input)).rejects.toThrow("another account");
    expect(m.update).not.toHaveBeenCalled();
  });
  it("reuses existing linked invited account", async () => {
    m.employee.mockResolvedValue({ ...employee, userId: "same-user" });
    m.existing.mockResolvedValue({ id: "same-user", employee: { id: "employee" }, status: "INVITED", passwordHash: null });
    await createLinkedEmployeeInvitation(input);
    expect(m.create).not.toHaveBeenCalled();
  });
  it("does not reset an active account", async () => {
    m.existing.mockResolvedValue({ id: "same-user", employee: { id: "employee" }, status: "ACTIVE", passwordHash: "hash" });
    await expect(createLinkedEmployeeInvitation(input)).rejects.toThrow("already set up");
  });
});
