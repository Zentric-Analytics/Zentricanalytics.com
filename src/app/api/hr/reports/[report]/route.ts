import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { unsealHrCredential } from "@/lib/hr/auth/crypto";
import { getAuthenticatedHrUser } from "@/lib/hr/auth/session";
import { privilegedMfaRequired } from "@/lib/hr/permissions/authorize";
import { csvCell } from "@/lib/hr/payroll/engine";
import { reportPeriod, safeReportFileName } from "@/lib/hr/reports/metrics";
import type { HrPermissionKey } from "@/lib/hr/permissions/catalog";

const rules: Record<string, HrPermissionKey> = {
  headcount: "employee.read_all",
  turnover: "employee.read_all",
  recruitment: "employee.read_all",
  employees: "employee.read_all",
  departments: "employee.read_all",
  supervisors: "employee.read_all",
  leave: "leave.read_all",
  "leave-balances": "leave.read_all",
  payroll: "payroll.read",
  "payroll-bank-schedule": "payroll.read_bank_details",
  payslips: "payroll.read",
  assets: "asset.manage",
  offboarding: "employee.read_all",
  audit: "audit.read",
};

type Cell = string | number | Date | null | undefined;
function csv(rows: Cell[][]) {
  return `\uFEFF${rows.map((row) => row.map((value) => csvCell(value instanceof Date ? value.toISOString() : value)).join(",")).join("\r\n")}\r\n`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ report: string }> }) {
  const auth = await getAuthenticatedHrUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (privilegedMfaRequired(auth)) return NextResponse.json({ error: "MFA enrollment required" }, { status: 403 });
  const { report } = await params;
  const modulePermission = rules[report];
  if (!modulePermission) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!auth.permissions.has("report.export") || !auth.permissions.has(modulePermission)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const organizationId = auth.user.organizationId;
  const current = reportPeriod(new Date().getUTCFullYear());
  let rows: Cell[][] = [];
  if (report === "headcount") {
    const now = new Date();
    const records = await prisma.hrEmployeeAssignment.findMany({ where: { organizationId, status: "ACTIVE", effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] }, include: { department: true } });
    const totals = new Map<string, number>();
    for (const item of records) totals.set(item.department.name, (totals.get(item.department.name) ?? 0) + 1);
    rows = [["Department", "Active headcount"], ...[...totals.entries()].sort((left, right) => left[0].localeCompare(right[0]))];
  } else if (report === "turnover") {
    const [hires, exits] = await Promise.all([
      prisma.hrEmployee.findMany({ where: { organizationId, hireDate: { gte: current.startsAt, lt: current.endsAt } }, select: { hireDate: true } }),
      prisma.hrEmployee.findMany({ where: { organizationId, terminationDate: { gte: current.startsAt, lt: current.endsAt } }, select: { terminationDate: true } }),
    ]);
    rows = [["Month", "Hires", "Terminations"], ...Array.from({ length: 12 }, (_, month) => {
      const label = new Date(Date.UTC(current.startsAt.getUTCFullYear(), month, 1)).toLocaleString("en", { month: "long", timeZone: "UTC" });
      return [label, hires.filter(({ hireDate }) => hireDate?.getUTCMonth() === month).length, exits.filter(({ terminationDate }) => terminationDate?.getUTCMonth() === month).length];
    })];
  } else if (report === "recruitment") {
    const records = await prisma.jobApplication.groupBy({ by: ["status"], where: { organizationId, deletedAt: null, createdAt: { gte: current.startsAt, lt: current.endsAt } }, _count: { _all: true } });
    rows = [["Pipeline status", "Applications"], ...records.sort((left, right) => left.status.localeCompare(right.status)).map((item) => [item.status, item._count._all])];
  } else if (report === "employees") {
    const records = await prisma.hrEmployee.findMany({ where: { organizationId }, orderBy: [{ lastName: "asc" }, { legalFirstName: "asc" }], take: 10_000 });
    rows = [["Employee number", "First name", "Middle name", "Last name", "Preferred name", "Company email", "Phone", "Status", "Hire date", "Termination date"], ...records.map((item) => [item.employeeNumber, item.legalFirstName, item.middleName, item.lastName, item.preferredName, item.companyEmail, item.phone, item.employmentStatus, item.hireDate, item.terminationDate])];
  } else if (report === "departments") {
    const records = await prisma.hrEmployeeAssignment.findMany({ where: { organizationId, status: "ACTIVE" }, include: { employee: true, department: true, team: true, position: true }, orderBy: [{ department: { name: "asc" } }, { employee: { lastName: "asc" } }], take: 10_000 });
    rows = [["Department", "Team", "Employee number", "Employee", "Position", "Employment type", "Location", "Effective from"], ...records.map((item) => [item.department.name, item.team?.name, item.employee.employeeNumber, `${item.employee.legalFirstName} ${item.employee.lastName}`, item.position.title, item.employmentType, item.location, item.effectiveFrom])];
  } else if (report === "supervisors") {
    const records = await prisma.hrSupervisorAssignment.findMany({ where: { organizationId }, include: { supervisorEmployee: true, assignedEmployee: true, departmentScope: true }, orderBy: { effectiveFrom: "desc" }, take: 10_000 });
    rows = [["Supervisor number", "Supervisor", "Assigned employee number", "Assigned employee", "Department scope", "Type", "Status", "Effective from", "Effective to"], ...records.map((item) => [item.supervisorEmployee.employeeNumber, `${item.supervisorEmployee.legalFirstName} ${item.supervisorEmployee.lastName}`, item.assignedEmployee?.employeeNumber, item.assignedEmployee ? `${item.assignedEmployee.legalFirstName} ${item.assignedEmployee.lastName}` : null, item.departmentScope?.name, item.assignmentType, item.status, item.effectiveFrom, item.effectiveTo])];
  } else if (report === "leave") {
    const records = await prisma.hrLeaveRequest.findMany({ where: { organizationId, startDate: { gte: current.startsAt, lt: current.endsAt } }, include: { employee: true, leaveType: true }, orderBy: { startDate: "asc" }, take: 10_000 });
    rows = [["Employee number", "Employee", "Leave type", "Start", "End", "Amount", "Status", "Submitted", "Decided"], ...records.map((item) => [item.employee.employeeNumber, `${item.employee.legalFirstName} ${item.employee.lastName}`, item.leaveType.name, item.startDate, item.endDate, item.amount.toString(), item.status, item.submittedAt, item.decidedAt])];
  } else if (report === "leave-balances") {
    const records = await prisma.hrLeaveBalance.findMany({ where: { organizationId, periodYear: current.startsAt.getUTCFullYear() }, include: { employee: true, leaveType: true }, orderBy: [{ employee: { lastName: "asc" } }, { leaveType: { name: "asc" } }], take: 10_000 });
    rows = [["Employee number", "Employee", "Leave type", "Year", "Opening", "Accrued", "Carried over", "Adjusted", "Reserved", "Used", "Expired"], ...records.map((item) => [item.employee.employeeNumber, `${item.employee.legalFirstName} ${item.employee.lastName}`, item.leaveType.name, item.periodYear, item.opening.toString(), item.accrued.toString(), item.carriedOver.toString(), item.adjusted.toString(), item.reserved.toString(), item.used.toString(), item.expired.toString()])];
  } else if (report === "payroll") {
    const records = await prisma.hrPayrollRun.findMany({ where: { organizationId, period: { startsAt: { gte: current.startsAt, lt: current.endsAt } }, status: { in: ["CALCULATED", "REVIEWED", "APPROVED", "LOCKED", "PAID"] } }, include: { period: true, items: true }, orderBy: [{ period: { startsAt: "asc" } }, { version: "asc" }], take: 500 });
    rows = [["Period", "Version", "Status", "Employees", "Currency", "Gross earnings", "Deductions", "Benefits", "Net pay"], ...records.map((run) => {
      const totals = run.items.reduce((sum, item) => ({ gross: sum.gross.add(item.grossEarnings), deductions: sum.deductions.add(item.totalDeductions), benefits: sum.benefits.add(item.employerBenefits), net: sum.net.add(item.netPay) }), { gross: new Prisma.Decimal(0), deductions: new Prisma.Decimal(0), benefits: new Prisma.Decimal(0), net: new Prisma.Decimal(0) });
      return [run.period.name, run.version, run.status, run.items.length, run.items[0]?.currency ?? "", totals.gross.toFixed(2), totals.deductions.toFixed(2), totals.benefits.toFixed(2), totals.net.toFixed(2)];
    })];
  } else if (report === "payroll-bank-schedule") {
    const records = await prisma.hrPayrollItem.findMany({ where: { organizationId, run: { status: { in: ["LOCKED", "PAID"] }, period: { startsAt: { gte: current.startsAt, lt: current.endsAt } } } }, include: { run: { include: { period: true } }, employee: { include: { bankAccounts: { where: { isPrimary: true }, take: 1 } } } }, orderBy: [{ run: { period: { startsAt: "asc" } } }, { employeeNumber: "asc" }], take: 10_000 });
    rows = [["Period", "Employee number", "Employee", "Bank", "Account name", "Account number", "Currency", "Net pay", "Payment status"], ...records.map((item) => { const account = item.employee.bankAccounts[0]; return [item.run.period.name, item.employeeNumber, item.employeeName, account?.bankName, account?.accountName, account ? unsealHrCredential(account.accountNumberEncrypted) : null, item.currency, item.netPay.toFixed(2), item.paymentStatus]; })];
  } else if (report === "payslips") {
    const records = await prisma.hrPayrollItem.findMany({ where: { organizationId, payslip: { isNot: null }, run: { period: { startsAt: { gte: current.startsAt, lt: current.endsAt } } } }, include: { run: { include: { period: true } }, payslip: true }, orderBy: [{ run: { period: { startsAt: "asc" } } }, { employeeNumber: "asc" }], take: 10_000 });
    rows = [["Period", "Employee number", "Employee", "Currency", "Net pay", "Generated at", "Payment status"], ...records.map((item) => [item.run.period.name, item.employeeNumber, item.employeeName, item.currency, item.netPay.toFixed(2), item.payslip?.generatedAt, item.paymentStatus])];
  } else if (report === "assets") {
    const records = await prisma.hrAsset.findMany({ where: { organizationId }, include: { assignments: { where: { status: "ACTIVE" }, include: { employee: true }, take: 1 } }, orderBy: { assetTag: "asc" }, take: 10_000 });
    rows = [["Asset tag", "Type", "Name", "Manufacturer", "Model", "Serial", "Condition", "Status", "Assigned employee number", "Assigned date"], ...records.map((item) => [item.assetTag, item.type, item.name, item.manufacturer, item.model, item.serialNumber, item.condition, item.status, item.assignments[0]?.employee.employeeNumber, item.assignments[0]?.assignedAt])];
  } else if (report === "offboarding") {
    const records = await prisma.hrLifecycleInstance.findMany({ where: { organizationId, type: "OFFBOARDING" }, include: { employee: true, tasks: true }, orderBy: { effectiveDate: "desc" }, take: 10_000 });
    rows = [["Employee number", "Employee", "Status", "Effective date", "Started", "Completed", "Required tasks", "Completed required tasks", "Knowledge transfer employee ID"], ...records.map((item) => [item.employee.employeeNumber, `${item.employee.legalFirstName} ${item.employee.lastName}`, item.status, item.effectiveDate, item.startedAt, item.completedAt, item.tasks.filter(({ required }) => required).length, item.tasks.filter(({ required, status }) => required && status === "COMPLETED").length, item.knowledgeTransferToId])];
  } else if (report === "audit") {
    const records = await prisma.hrAuditEvent.findMany({ where: { organizationId, createdAt: { gte: current.startsAt, lt: current.endsAt } }, orderBy: { createdAt: "desc" }, take: 10_000 });
    rows = [["Timestamp", "Actor user ID", "Actor role", "Entity type", "Entity ID", "Action", "Reason", "Correlation ID"], ...records.map((item) => [item.createdAt, item.actorUserId, item.actorRole, item.entityType, item.entityId, item.action, item.reason, item.correlationId])];
  }
  const body = csv(rows);
  await appendHrAudit(prisma, { organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrReport", entityId: report, action: "hr.report.exported", newValues: { report, rowCount: Math.max(0, rows.length - 1), periodYear: current.startsAt.getUTCFullYear() } });
  return new NextResponse(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${safeReportFileName(report)}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
