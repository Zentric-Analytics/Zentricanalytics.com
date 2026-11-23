import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { permissionsForRole } from "@/lib/hr/permissions/catalog";

const fixture = vi.hoisted(() => ({
  session: vi.fn(), list: vi.fn(), calculateAdjustment: vi.fn(),
  run: vi.fn(), runs: vi.fn(), item: vi.fn(), transaction: vi.fn(), storage: vi.fn(), results: vi.fn(),
}));
vi.mock("@/lib/hr/auth/session", () => ({ getAuthenticatedHrUser: fixture.session }));
vi.mock("@/lib/hr/payroll/unit9-service", () => ({
  listUnit9Runs: fixture.list, createUnit9Run: vi.fn(), createUnit9ManualAdjustment: fixture.calculateAdjustment,
}));
vi.mock("@/lib/hr/audit", () => ({ appendHrAudit: vi.fn() }));
vi.mock("@/lib/hr/storage", () => ({ hrObjectStorage: () => ({ get: fixture.storage }) }));
vi.mock("@/app/hr/admin/payroll/actions", () => ({ createPayrollRunAction: vi.fn() }));
vi.mock("@/app/hr/admin/payroll/payslips/actions", () => ({ generatePayslipAction: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    hrPayrollRun: { findFirst: fixture.run, findMany: fixture.runs }, hrPayrollItem: { findFirst: fixture.item },
    hrPayrollPeriod: { findMany: async () => [] }, hrEmployee: { findMany: async () => [] }, $transaction: fixture.transaction,
    hrPayrollAuthoritativeRun: { findFirst: async () => ({ id: "run" }) },
    hrPayrollCertificationIssue: { findMany: async () => [] },
    hrPayrollInputSnapshot: { findMany: async () => [] },
    hrPayrollCalculationAttempt: { findMany: async () => [] },
    hrPayrollAuthoritativeResult: { findMany: fixture.results },
    hrPayrollReconciliation: { findMany: async () => [] },
    hrPayrollRiskFinding: { findMany: async () => [] },
    hrPayrollRunApproval: { findMany: async () => [] },
  },
}));

import { GET as listUnit9 } from "@/app/api/hr/payroll/unit9/runs/route";
import { GET as getUnit9 } from "@/app/api/hr/payroll/unit9/runs/[id]/route";
import { POST as addAdjustment } from "@/app/api/hr/payroll/unit9/runs/[id]/adjustments/route";
import { GET as exportLegacy } from "@/app/api/hr/payroll/runs/[id]/export/route";
import { GET as downloadPayslip } from "@/app/api/hr/payroll/payslips/[id]/route";
import { GET as exportReport } from "@/app/api/hr/reports/[report]/route";
import PayrollPage from "@/app/hr/admin/payroll/page";

const params = { params: Promise.resolve({ id: "fictional" }) };
const request = new Request("https://example.invalid/api/hr/payroll/runs/fictional/export");
function login(role: Parameters<typeof permissionsForRole>[0], mfaEnabled = true, extra: string[] = [], secret?: string) {
  fixture.session.mockResolvedValue({
    roles: [role], permissions: new Set([...permissionsForRole(role), ...extra]),
    user: { id: "user", organizationId: "tenant", employee: { id: "employee" }, mfaEnabled, mfaSecretEncrypted: secret },
  });
}

afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Unit 9 route authorization", () => {
  it.each([
    ["PAYROLL_ADMIN", false, undefined],
    ["PAYROLL_ADMIN", false, "pending-enrollment"],
    ["PAYROLL_AUDITOR", false, "replacement-secret"],
    ["EMPLOYEE", true, undefined],
  ] as const)("rejects restricted access for %s", async (role, enabled, secret) => {
    vi.stubEnv("APP_ENV", "production");
    login(role, enabled, [], secret);
    expect((await listUnit9()).status).toBe(403);
    expect(fixture.list).not.toHaveBeenCalled();
  });

  it("rejects a missing session and allows a permitted MFA-enrolled actor", async () => {
    vi.stubEnv("APP_ENV", "staging");
    fixture.session.mockResolvedValueOnce(null);
    expect((await listUnit9()).status).toBe(401);
    login("PAYROLL_AUDITOR");
    fixture.list.mockResolvedValue([]);
    expect((await listUnit9()).status).toBe(200);
    expect(fixture.list).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ organizationId: "tenant" }));
  });

  it("requires MFA before an authorized payroll adjustment reaches the service", async () => {
    vi.stubEnv("APP_ENV", "production");
    const adjustment = () => new Request(request.url, {
      method: "POST",
      body: JSON.stringify({ employeeId: "cm00000000000000000000001", category: "QA", amount: "10", reason: "Fictional adjustment", evidence: {} }),
    });
    login("PAYROLL_PROCESSOR", false, [], "enrollment-in-progress");
    expect((await addAdjustment(adjustment(), params)).status).toBe(403);
    expect(fixture.calculateAdjustment).not.toHaveBeenCalled();
    login("PAYROLL_PROCESSOR");
    fixture.calculateAdjustment.mockResolvedValue({ id: "fictional-adjustment" });
    expect((await addAdjustment(adjustment(), params)).status).toBe(200);
  });

  it("keeps Unit 9 individual results out of general payroll responses", async () => {
    login("FINANCE_READER");
    const limited = await getUnit9(request, params);
    expect(limited.status).toBe(200);
    expect((await limited.json()).results).toEqual([]);
    expect(fixture.results).not.toHaveBeenCalled();
    login("PAYROLL_ADMIN");
    fixture.results.mockResolvedValue([{ id: "result", netPay: "2100.00" }]);
    expect((await (await getUnit9(request, params)).json()).results).toEqual([{ id: "result", netPay: "2100.00" }]);
  });
});

describe("legacy payroll salary access", () => {
  it.each(["FINANCE_READER", "PAYROLL_AUDITOR"] as const)("renders run summaries without selecting salary items for %s", async (role) => {
    vi.stubGlobal("React", React);
    login(role);
    fixture.runs.mockResolvedValue([{ id: "run", period: { name: "Fictional period" }, version: 1, status: "LOCKED", _count: { items: 1 }, approvals: [] }]);
    const html = renderToStaticMarkup(await PayrollPage());
    expect(html).toContain("1 employee snapshots");
    expect(html).not.toContain("Summary CSV");
    expect(html).not.toContain("Deductions");
    expect(fixture.runs).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.not.objectContaining({ items: expect.anything() }),
    }));
  });

  it.each(["FINANCE_READER", "PAYROLL_AUDITOR", "PAYMENT_OPERATOR"] as const)(
    "returns no salary information or financial queries for %s",
    async (role) => {
      login(role, true, ["payroll.export", "report.export"]);
      expect((await exportLegacy(request, params)).status).toBe(403);
      expect((await exportReport(request, { params: Promise.resolve({ report: "payslips" }) })).status).toBe(403);
      expect((await downloadPayslip(request, params)).status).toBe(403);
      expect(fixture.run).not.toHaveBeenCalled();
      expect(fixture.item).not.toHaveBeenCalled();
    },
  );

  it("retains payroll administrator CSV access and employee access to their own payslip", async () => {
    login("PAYROLL_ADMIN");
    const amount = { toFixed: () => "2100.00" };
    fixture.run.mockResolvedValue({ id: "fictional", period: { name: "Example" }, version: 1, items: [
      { employeeNumber: "QA", employeeName: "Fictional", currency: "NGN", baseSalary: amount,
        grossEarnings: amount, totalDeductions: amount, employerBenefits: amount, netPay: amount, paymentStatus: "PENDING" },
    ] });
    const response = await exportLegacy(request, params);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("2100.00");
    login("EMPLOYEE");
    fixture.item.mockResolvedValue({ id: "fictional", payslip: { id: "page", fileName: "example.pdf", storageKey: "example" } });
    fixture.storage.mockResolvedValue(Buffer.from("fictional PDF"));
    expect((await downloadPayslip(request, params)).status).toBe(200);
    expect(fixture.item).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "fictional", organizationId: "tenant", employeeId: "employee" },
    }));
  });
});
