import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { getAuthenticatedHrUser } from "@/lib/hr/auth/session";
import { hrObjectStorage } from "@/lib/hr/storage";
import { privilegedMfaRequired } from "@/lib/hr/permissions/authorize";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedHrUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (privilegedMfaRequired(auth)) return NextResponse.json({ error: "MFA enrollment required" }, { status: 403 });
  const { id } = await params;
  const version = await prisma.hrEmployeeDocumentVersion.findFirst({ where: { id, organizationId: auth.user.organizationId, scanStatus: "CLEAN" }, include: { document: true } });
  if (!version) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const self = auth.user.employee?.id === version.document.employeeId && auth.permissions.has("document.read_self") && !version.document.archivedAt;
  const authorizedStaff = version.document.restricted ? auth.permissions.has("document.read_sensitive") : auth.permissions.has("document.read_employee") || auth.permissions.has("document.read_sensitive");
  if (!self && !authorizedStaff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const bytes = await hrObjectStorage().getAuthorized({ provider: version.storageProvider, bucket: version.storageBucket ?? undefined, key: version.storageKey, versionId: version.storageVersionId ?? undefined, eTag: version.storageEtag ?? undefined, checksum: version.checksum });
  const forwardedIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipHash = crypto.createHash("sha256").update(`${process.env.AUTH_SECRET ?? ""}:${forwardedIp}`).digest("hex");
  const userAgent = request.headers.get("user-agent")?.slice(0, 500);
  await prisma.$transaction(async (tx) => {
    await tx.hrDocumentAccessLog.create({ data: { organizationId: auth.user.organizationId, documentVersionId: version.id, actorUserId: auth.user.id, action: "DOWNLOAD", ipHash, userAgent } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrEmployeeDocumentVersion", entityId: version.id, action: "hr.document.downloaded", newValues: { documentId: version.documentId, version: version.version }, ipHash, userAgent });
  });
  const fileName = version.displayFileName.replace(/[\r\n"]/g, "_");
  return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": version.contentType, "Content-Length": String(bytes.byteLength), "Content-Disposition": `attachment; filename="${fileName}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" } });
}
