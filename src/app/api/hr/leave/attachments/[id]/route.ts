import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedHrUser } from "@/lib/hr/auth/session";
import { hrObjectStorage } from "@/lib/hr/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedHrUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const attachment = await prisma.hrLeaveAttachment.findFirst({ where: { id, request: { organizationId: auth.user.organizationId } }, include: { request: { select: { employeeId: true } } } });
  if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  let allowed = auth.user.employee?.id === attachment.request.employeeId || auth.permissions.has("leave.read_all") || auth.permissions.has("document.read_employee");
  if (!allowed && auth.user.employee) {
    allowed = Boolean(await prisma.hrSupervisorAssignment.findFirst({ where: { organizationId: auth.user.organizationId, supervisorEmployeeId: auth.user.employee.id, assignedEmployeeId: attachment.request.employeeId, status: "ACTIVE", effectiveFrom: { lte: new Date() }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }] }, select: { id: true } }));
  }
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const bytes = await hrObjectStorage().get(attachment.storageKey);
  const fileName = attachment.fileName.replace(/[\r\n"]/g, "_");
  return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": attachment.contentType, "Content-Length": String(bytes.byteLength), "Content-Disposition": `attachment; filename="${fileName}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
