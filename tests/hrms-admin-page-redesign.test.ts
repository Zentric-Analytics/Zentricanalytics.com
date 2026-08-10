import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("HRMS page-level redesign", () => {
  it("keeps every governed department action in the redesigned register", () => {
    const page = read("src/app/hr/admin/departments/page.tsx");
    for (const action of ["createDepartmentAction", "createTeamAction", "updateDepartmentAction", "archiveTeamAction", "archiveDepartmentAction"]) expect(page).toContain(`action={${action}}`);
    expect(page).toContain("Department register");
    expect(page).toContain("headEmployeeId");
  });

  it("keeps the position lifecycle decisions and governed capacity visible", () => {
    const page = read("src/app/hr/admin/positions/page.tsx");
    for (const action of ["createPositionAction", "submitPositionAction", "openPositionAction"]) expect(page).toContain(action);
    expect(page).toContain("PositionDecisionForm");
    expect(page).toContain("headcountLimit");
    expect(page).toContain("fullTimeEquivalent");
  });

  it("keeps report exports permission-gated and employee data live", () => {
    const reports = read("src/app/hr/admin/reports/page.tsx");
    const employees = read("src/app/hr/admin/employees/page.tsx");
    expect(reports).toContain('auth.permissions.has("report.export")');
    expect(reports).toContain('auth.permissions.has("payroll.read_bank_details")');
    expect(reports).toContain('auth.permissions.has("audit.read")');
    expect(employees).toContain("prisma.hrEmployee.findMany");
    expect(employees).toContain("employmentAssignments");
    expect(employees).toContain("/hr/admin/employees/new");
  });
});
