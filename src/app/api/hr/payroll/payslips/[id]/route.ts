import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { getAuthenticatedHrUser } from "@/lib/hr/auth/session";
import { hrObjectStorage } from "@/lib/hr/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedHrUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const item = await prisma.hrPayrollItem.findFirst({ where: { id, organizationId: auth.user.organizationId }, include: { payslip: true } });
  if (!item?.payslip) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const ownPayslip = auth.user.employee?.id === item.employeeId && auth.permissions.has("employee.read_self");
  if (!ownPayslip && !auth.permissions.has("payroll.read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const bytes = await hrObjectStorage().get(item.payslip.storageKey);
  await appendHrAudit(prisma, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrPayslip", entityId: item.payslip.id, action: "hr.payroll.payslip.downloaded", newValues: { payrollItemId: item.id } });
  const fileName = item.payslip.fileName.replace(/[\r\n"]/g, "_");
  return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Length": String(bytes.byteLength), "Content-Disposition": `attachment; filename="${fileName}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
