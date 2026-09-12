import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ transaction: vi.fn(), actor: vi.fn(), employee: vi.fn(), vacancy: vi.fn(), existing: vi.fn(), create: vi.fn(), update: vi.fn(), role: vi.fn(), assign: vi.fn(), audit: vi.fn(), invite: vi.fn(), lockNamed: vi.fn(), lockAccount: vi.fn() }));
vi.mock("../src/lib/hr/recruitment/hr-authority-lock", () => ({ lockNamedHrEligibility: m.lockNamed, lockHrAccountEligibility: m.lockAccount }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: m.transaction } }));
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
    m.transaction.mockReset().mockImplementation(async fn => fn({ hrUser: { findFirstOrThrow: m.actor, findUnique: m.existing, create: m.create }, hrEmployee: { findFirstOrThrow: m.employee, update: m.update }, hrVacancy: { findFirst: m.vacancy }, hrRole: { findUniqueOrThrow: m.role }, hrUserRole: { upsert: m.assign } }));
    m.actor.mockResolvedValue({ id: "hr", isPrimaryAdmin: false, roles: [{ role: { key: "HR_ADMIN" } }] });
    m.employee.mockResolvedValue(employee);
    m.vacancy.mockResolvedValue({ responsibleHrUserId: "hr" });
    m.existing.mockResolvedValue(null);
    m.create.mockResolvedValue({ id: "new-user" });
    m.role.mockResolvedValue({ id: "employee-role" });
    m.invite.mockResolvedValue({ invitation: { id: "invite" }, rawToken: "not-returned" });
  });
  it("retries an aborted provisioning transaction and reuses the winning account", async () => {
    m.transaction.mockRejectedValueOnce({ code: "P2034" });
    m.employee.mockResolvedValue({ ...employee, userId: "same-user" });
    m.existing.mockResolvedValue({ id: "same-user", employee: { id: "employee" }, status: "INVITED", passwordHash: null });
    expect(await createLinkedEmployeeInvitation(input)).toEqual({ userId: "same-user", invitationId: "invite" });
    expect(m.transaction).toHaveBeenCalledTimes(2);
    expect(m.create).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.invite).toHaveBeenCalledOnce();
  });
  it("bounds transaction conflict retries and never sends on exhaustion", async () => {
    m.transaction.mockRejectedValue({ code: "P2034" });
    await expect(createLinkedEmployeeInvitation(input)).rejects.toThrow("Reload");
    expect(m.transaction).toHaveBeenCalledTimes(3);
    expect(m.invite).not.toHaveBeenCalled();
  });
  it("rechecks authority on retry instead of carrying the previous permission forward", async () => {
    m.transaction.mockRejectedValueOnce({ code: "P2034" });
    m.actor.mockResolvedValue({ id: "hr", isPrimaryAdmin: false, roles: [] });
    await expect(createLinkedEmployeeInvitation(input)).rejects.toThrow("assigned HR");
    expect(m.transaction).toHaveBeenCalledTimes(2);
    expect(m.create).not.toHaveBeenCalled();
    expect(m.invite).not.toHaveBeenCalled();
  });
  it("does not retry an authority or unexpected provisioning failure", async () => {
    m.transaction.mockRejectedValue(new Error("Authority denied"));
    await expect(createLinkedEmployeeInvitation(input)).rejects.toThrow("Authority denied");
    expect(m.transaction).toHaveBeenCalledOnce();
    expect(m.invite).not.toHaveBeenCalled();
  });
  it("does not replay provisioning when the separate invitation step fails", async () => {
    m.invite.mockRejectedValueOnce({ code: "P2034" });
    await expect(createLinkedEmployeeInvitation(input)).rejects.toEqual({ code: "P2034" });
    expect(m.transaction).toHaveBeenCalledOnce();
    expect(m.invite).toHaveBeenCalledOnce();
  });
  it("links the completed applicant and invites company email without activating employment", async () => {
    expect(await createLinkedEmployeeInvitation(input)).toEqual({ userId: "new-user", invitationId: "invite" });
    expect(m.update).toHaveBeenCalledWith({ where: { id: "employee" }, data: { userId: "new-user" } });
    expect(m.invite).toHaveBeenCalledWith({ organizationId: "org", userId: "new-user", createdById: "hr", recipient: "company@zentricanalytics.com" }, expect.any(Function));
    expect(m.lockNamed).toHaveBeenCalledWith(expect.anything(), "org", "vacancy", "hr");
    expect(m.lockNamed.mock.invocationCallOrder[0]).toBeLessThan(m.actor.mock.invocationCallOrder[0]);
  });
  it("locks primary-admin eligibility even without a vacancy", async () => {
    m.employee.mockResolvedValue({ ...employee, recruitmentApplication: { ...application, vacancyId: null } });
    m.actor.mockResolvedValue({ id: "hr", isPrimaryAdmin: true, roles: [{ role: { key: "ADMIN" } }] });
    await createLinkedEmployeeInvitation(input);
    expect(m.lockAccount).toHaveBeenCalledWith(expect.anything(), "org", "hr");
    expect(m.lockAccount.mock.invocationCallOrder[0]).toBeLessThan(m.actor.mock.invocationCallOrder[0]);
  });
  it("rechecks lost HR authority in the separate invitation transaction", async () => {
    m.invite.mockImplementationOnce(async (_input, authorize) => {
      m.actor.mockResolvedValue({ id: "hr", isPrimaryAdmin: false, roles: [] });
      m.employee.mockResolvedValue({ ...employee, userId: "new-user" });
      await authorize({ hrEmployee: { findFirstOrThrow: m.employee }, hrUser: { findFirstOrThrow: m.actor }, hrVacancy: { findFirst: m.vacancy } });
      throw new Error("Unexpected authorization");
    });
    await expect(createLinkedEmployeeInvitation(input)).rejects.toThrow("assigned HR");
    expect(m.lockNamed).toHaveBeenCalledTimes(2);
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
  it.each([{ roles: [] }, { roles: [{ role: { key: "EMPLOYEE" } }] }])("blocks a named reviewer without a qualifying HR role", async ({ roles }) => {
    m.actor.mockResolvedValue({ id: "hr", isPrimaryAdmin: false, roles });
    await expect(createLinkedEmployeeInvitation(input)).rejects.toThrow("assigned HR");
    expect(m.create).not.toHaveBeenCalled();
    expect(m.assign).not.toHaveBeenCalled();
    expect(m.invite).not.toHaveBeenCalled();
  });
  it("does not treat the primary flag alone as administrator authority", async () => {
    m.actor.mockResolvedValue({ id: "hr", isPrimaryAdmin: true, roles: [{ role: { key: "EMPLOYEE" } }] });
    m.vacancy.mockResolvedValue(null);
    await expect(createLinkedEmployeeInvitation(input)).rejects.toThrow("assigned HR");
    expect(m.invite).not.toHaveBeenCalled();
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
  it("does not record a second account-link event when retrying an already linked invitation", async () => {
    m.employee.mockResolvedValue({ ...employee, userId: "same-user" });
    m.existing.mockResolvedValue({ id: "same-user", employee: { id: "employee" }, status: "INVITED", passwordHash: null });
    await createLinkedEmployeeInvitation(input);
    await createLinkedEmployeeInvitation(input);
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.update).not.toHaveBeenCalled();
  });
  it("does not reset an active account", async () => {
    m.existing.mockResolvedValue({ id: "same-user", employee: { id: "employee" }, status: "ACTIVE", passwordHash: "hash" });
    await expect(createLinkedEmployeeInvitation(input)).rejects.toThrow("already set up");
  });
});
