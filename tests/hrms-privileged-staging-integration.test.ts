import { afterEach, expect, it, vi } from "vitest";
import { createEmployeeAction, saveEmployeeBankAccountAction, updateEmployeeProfileAction } from "@/app/hr/admin/employees/actions";
import { permissionsForRole } from "@/lib/hr/permissions/catalog";

const fixture = vi.hoisted(() => ({
  session: vi.fn(),
  create: vi.fn(),
  find: vi.fn(),
  update: vi.fn(),
  history: vi.fn(),
  audit: vi.fn(),
  bank: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/hr/auth/session", () => ({ getAuthenticatedHrUser: fixture.session }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  forbidden: () => { throw new Error("FORBIDDEN"); },
  redirect: (path: string) => { throw new Error(path); },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: fixture.transaction,
    hrEmployee: { findFirstOrThrow: fixture.find },
  },
}));

const employee = {
  employeeNumber: "FICTIONAL-123",
  legalFirstName: "Synthetic",
  lastName: "Employee",
  hireDate: "2030-01-01",
  employmentStatus: "ACTIVE",
};

function form(values: Record<string, string>) {
  const result = new FormData();
  for (const [name, value] of Object.entries(values)) result.set(name, value);
  return result;
}

function actor(role: Parameters<typeof permissionsForRole>[0], mfaEnabled = true) {
  vi.stubEnv("APP_ENV", "staging");
  fixture.session.mockResolvedValue({
    roles: [role],
    permissions: new Set(permissionsForRole(role)),
    user: { id: "fictional-admin", organizationId: "fictional-aurora", mfaEnabled },
  });
}

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

it("creates an employee with initial history and audit under the authenticated HR administrator's tenant", async () => {
  actor("HR_ADMIN");
  fixture.create.mockResolvedValue({ ...employee, id: "fictional-employee" });
  fixture.transaction.mockImplementation(async action => action({
    hrEmployee: { create: fixture.create },
    hrEmployeeStatusHistory: { create: fixture.history },
    hrAuditEvent: { create: fixture.audit },
  }));
  await createEmployeeAction(form({ ...employee, organizationId: "fictional-cobalt" }));
  const sameTenant = { organizationId: "fictional-aurora", employeeId: "fictional-employee" };
  expect(fixture.create).toHaveBeenCalledWith({ data: expect.objectContaining({ organizationId: sameTenant.organizationId }) });
  expect(fixture.history).toHaveBeenCalledWith({ data: expect.objectContaining({ ...sameTenant, newStatus: "ACTIVE" }) });
  expect(fixture.audit).toHaveBeenCalledWith({ data: expect.objectContaining({
    organizationId: sameTenant.organizationId, entityId: sameTenant.employeeId, action: "hr.employee.created",
  }) });
  expect(fixture.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
});

it("blocks a privileged write before a transaction when MFA is unenrolled", async () => {
  actor("HR_ADMIN", false);
  await expect(createEmployeeAction(form(employee))).rejects.toThrow("/hr/security");
  expect(fixture.transaction).not.toHaveBeenCalled();
});

it("denies employee provisioning and finance-reader bank updates at the server action boundary", async () => {
  actor("EMPLOYEE");
  await expect(createEmployeeAction(form(employee))).rejects.toThrow("FORBIDDEN");
  actor("FINANCE_READER");
  await expect(saveEmployeeBankAccountAction(form({}))).rejects.toThrow("FORBIDDEN");
  expect(fixture.find).not.toHaveBeenCalled();
  expect(fixture.transaction).not.toHaveBeenCalled();
});

it("looks up an employee in the authenticated tenant before allowing any update", async () => {
  actor("HR_ADMIN");
  const foreign = "c123456789012345678901234";
  fixture.find.mockRejectedValue(new Error("missing within tenant"));
  await expect(updateEmployeeProfileAction(form({
    ...employee, employeeId: foreign, reason: "Fictional tenant isolation",
  }))).rejects.toThrow("missing within tenant");
  expect(fixture.find).toHaveBeenCalledWith({ where: { id: foreign, organizationId: "fictional-aurora" } });
  expect(fixture.transaction).not.toHaveBeenCalled();
});
