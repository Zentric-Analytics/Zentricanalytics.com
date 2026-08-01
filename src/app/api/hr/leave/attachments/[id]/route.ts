import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedHrUser } from "@/lib/hr/auth/session";
import { appendHrAudit } from "@/lib/hr/audit";
import { hrObjectStorage } from "@/lib/hr/storage";
import { supervisedEmployeeIds } from "@/lib/hr/supervisors/scope";
import { privilegedMfaRequired } from "@/lib/hr/permissions/authorize";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedHrUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (privilegedMfaRequired(auth)) return NextResponse.json({ error: "MFA enrollment required" }, { status: 403 });
  const { id } = await params;
  const attachment = await prisma.hrLeaveAttachment.findFirst({ where: { id, request: { organizationId: auth.user.organizationId } }, include: { request: { select: { employeeId: true } } } });
  if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  let allowed = auth.user.employee?.id === attachment.request.employeeId || auth.permissions.has("leave.read_all") || auth.permissions.has("document.read_employee");
  if (!allowed && auth.user.employee) {
    const employeeIds = await supervisedEmployeeIds(prisma, { organizationId: auth.user.organizationId, supervisorEmployeeId: auth.user.employee.id });
    allowed = employeeIds.includes(attachment.request.employeeId);
  }
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const bytes = await hrObjectStorage().get(attachment.storageKey);
  await appendHrAudit(prisma, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrLeaveAttachment", entityId: attachment.id, action: "hr.leave.attachment.downloaded", newValues: { leaveRequestId: attachment.requestId } });
  const fileName = attachment.fileName.replace(/[\r\n"]/g, "_");
  return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": attachment.contentType, "Content-Length": String(bytes.byteLength), "Content-Disposition": `attachment; filename="${fileName}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
