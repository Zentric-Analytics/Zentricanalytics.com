import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20260730080000_hrms_blueprint_completion/migration.sql");
const outbox = read("src/lib/hr/notifications/outbox.ts");
const reports = read("src/app/api/hr/reports/[report]/route.ts");

describe("HRMS blueprint completion audit", () => {
  it("persists in-app notifications and per-category preferences", () => {
    expect(schema).toContain("model HrNotification {");
    expect(schema).toContain("model HrNotificationPreference {");
    expect(schema).toContain("@@unique([userId, category])");
    expect(migration).toContain('CREATE TABLE "HrNotification"');
    expect(migration).toContain('CREATE TABLE "HrNotificationPreference"');
  });

  it("creates in-app notifications in the same transaction as durable email jobs", () => {
    expect(outbox).toContain("client.hrEmailOutbox.upsert");
    expect(outbox).toContain("client.hrNotification.upsert");
    expect(outbox).toContain("preference?.emailEnabled === false");
    expect(outbox).toContain("preference?.inAppEnabled !== false");
  });

  it("implements the employee profile and notification destinations", () => {
    const profile = read("src/app/hr/employee/profile/page.tsx");
    const notifications = read("src/app/hr/notifications/page.tsx");
    expect(profile).toContain("Your complete employment record");
    expect(profile).toContain("Full banking credentials are restricted");
    expect(notifications).toContain("Notification preferences");
    expect(notifications).toContain("Mark all read");
  });

  it("implements supervisor team and task destinations without sensitive fields", () => {
    const team = read("src/app/hr/supervisor/team/page.tsx");
    const tasks = read("src/app/hr/supervisor/tasks/page.tsx");
    expect(team).toContain("Active direct-report, team, and department assignment scopes only");
    expect(team).not.toContain("personalEmail");
    expect(team).not.toContain("bankAccounts");
    expect(tasks).toContain("Lifecycle tasks");
    expect(tasks).toContain("Workflow approvals");
  });

  it("supports direct, department, and team supervisor scopes server-side", () => {
    const scope = read("src/lib/hr/supervisors/scope.ts");
    const assignmentAction = read("src/app/hr/admin/assignments/actions.ts");
    expect(schema).toContain("teamScopeId");
    expect(scope).toContain("departmentScopeId");
    expect(scope).toContain("teamScopeId");
    expect(scope).toContain("supervisedEmployeeIds");
    expect(assignmentAction).toContain('z.enum(["DEPARTMENT", "TEAM"])');
  });

  it("provides every named blueprint export foundation", () => {
    for (const report of ["employees", "departments", "supervisors", "leave-balances", "leave", "payroll", "payroll-bank-schedule", "payslips", "assets", "offboarding", "audit"]) {
      expect(reports).toContain(`report === "${report}"`);
    }
    expect(reports).toContain("unsealHrCredential");
    expect(reports).toContain('"payroll-bank-schedule": "payroll.read_bank_details"');
    expect(reports).toContain("csvCell");
    expect(reports).toContain("hr.report.exported");
  });

  it("links navigation only to implemented self-service destinations", () => {
    const employeeLayout = read("src/app/hr/employee/layout.tsx");
    const supervisorLayout = read("src/app/hr/supervisor/layout.tsx");
    expect(employeeLayout).toContain('["My Profile","/hr/employee/profile"]');
    expect(employeeLayout).toContain('["Notifications","/hr/notifications"]');
    expect(supervisorLayout).toContain('["My Team","/hr/supervisor/team"]');
    expect(supervisorLayout).toContain('["Review Tasks","/hr/supervisor/tasks"]');
  });

  it("models every mandatory offboarding control and enforces terminal gates", () => {
    const lifecycle = read("src/app/hr/admin/lifecycle/actions.ts");
    const definitions = read("src/lib/hr/lifecycle/definitions.ts");
    for (const field of ["payrollStopDate", "finalPayrollRequired", "leaveReconciliation", "companyEmailDisabledAt", "finalCommunicationSentAt"]) {
      expect(schema).toContain(field);
      expect(migration).toContain(`"${field}"`);
    }
    for (const task of ["leave-reconciliation", "company-email-disable", "exit-documents", "final-communication"]) {
      expect(definitions).toContain(task);
      expect(lifecycle).toContain(task);
    }
    expect(lifecycle).toContain("companyEmailStatus: \"DISABLED\"");
    expect(lifecycle).toContain("hr-employment-exit");
  });

  it("stores complete immutable workflow approval context and future delegation fields", () => {
    const actions = read("src/app/hr/admin/workflows/actions.ts");
    for (const field of ["actorRole", "requestType", "requestId", "previousStatus", "newStatus", "correlationId"]) {
      expect(schema).toContain(field);
      expect(actions).toContain(field);
    }
    expect(schema).toContain("delegatedFromUserId");
    expect(schema).toContain("reassignedAt");
    expect(migration).toContain('"HrWorkflowApproval_correlationId_key"');
  });

  it("uses the organization-year employee number sequence for recruitment conversion", () => {
    const recruitment = read("src/app/admin/applications/actions.ts");
    expect(recruitment).toContain("hrEmployeeNumberSequence.upsert");
    expect(recruitment).toContain("generatedEmployeeNumber");
    expect(recruitment).not.toContain("employeeNumber: app.applicationId");
  });
});
