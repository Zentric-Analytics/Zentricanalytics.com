import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { unsealHrCredential } from "@/lib/hr/auth/crypto";
import { getAuthenticatedHrUser } from "@/lib/hr/auth/session";
import { csvCell } from "@/lib/hr/payroll/engine";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedHrUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.permissions.has("payroll.export")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const type = new URL(request.url).searchParams.get("type") === "bank" ? "bank" : "summary";
  if (type === "bank" && !auth.permissions.has("payroll.read_bank_details")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const run = await prisma.hrPayrollRun.findFirst({
    where: { id, organizationId: auth.user.organizationId, status: type === "bank" ? { in: ["LOCKED", "PAID"] } : { in: ["CALCULATED", "REVIEWED", "APPROVED", "LOCKED", "PAID"] } },
    include: { period: true, items: { include: { employee: { include: { bankAccounts: { where: { isPrimary: true }, take: 1 } } } }, orderBy: { employeeNumber: "asc" } } },
  });
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const rows = type === "bank"
    ? [["Employee number", "Employee name", "Bank", "Account name", "Account number", "Currency", "Net pay", "Payment status"], ...run.items.map((item) => {
      const account = item.employee.bankAccounts[0];
      if (!account) throw new Error(`Employee ${item.employeeNumber} has no primary bank account.`);
      return [item.employeeNumber, item.employeeName, account.bankName, account.accountName, unsealHrCredential(account.accountNumberEncrypted), item.currency, item.netPay.toFixed(2), item.paymentStatus];
    })]
    : [["Employee number", "Employee name", "Currency", "Base salary", "Gross earnings", "Deductions", "Employer benefits", "Net pay", "Payment status"], ...run.items.map((item) => [item.employeeNumber, item.employeeName, item.currency, item.baseSalary.toFixed(2), item.grossEarnings.toFixed(2), item.totalDeductions.toFixed(2), item.employerBenefits.toFixed(2), item.netPay.toFixed(2), item.paymentStatus])];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
  const fileName = `payroll-${type}-${run.period.name.replace(/[^a-zA-Z0-9_-]+/g, "-")}-v${run.version}.csv`;
  const checksum = crypto.createHash("sha256").update(csv).digest("hex");
  await prisma.$transaction(async (tx) => {
    const record = await tx.hrPayrollExport.create({ data: { organizationId: auth.user.organizationId, runId: run.id, type, fileName, checksum, rowCount: run.items.length, createdById: auth.user.id } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrPayrollExport", entityId: record.id, action: "hr.payroll.export.generated", newValues: { runId: run.id, type, rowCount: run.items.length, checksum } });
  });
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${fileName}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
