import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { authorizeInternalRequest } from "@/lib/hr/internal-auth";
import { enqueueHrEmail } from "@/lib/hr/notifications/outbox";

const inputSchema = z.object({
  versionId: z.string().cuid(),
  status: z.enum(["CLEAN", "QUARANTINED", "FAILED"]),
  provider: z.string().trim().min(2).max(100),
  reference: z.string().trim().max(200).optional(),
  reason: z.string().trim().min(3).max(500),
});

export async function POST(request: Request) {
  if (!authorizeInternalRequest(request, process.env.DOCUMENT_SCANNER_SECRET)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid scan result" }, { status: 400 });
  try {
    await prisma.$transaction(async (tx) => {
      const version = await tx.hrEmployeeDocumentVersion.findFirstOrThrow({ where: { id: parsed.data.versionId, scanStatus: "PENDING" }, include: { document: { include: { employee: { include: { user: true } } } } } });
      await tx.hrEmployeeDocumentVersion.update({ where: { id: version.id }, data: {
        scanStatus: parsed.data.status, scanCompletedAt: new Date(), scanProvider: parsed.data.provider,
        scanReference: parsed.data.reference, scanReason: parsed.data.reason,
      } });
      if (version.document.employee.user) await enqueueHrEmail(tx, {
        organizationId: version.organizationId, recipient: version.document.employee.user.email,
        template: "hr-document-scan-result", subject: "Employee document scan completed",
        payload: { documentId: version.documentId, documentVersionId: version.id, scanStatus: parsed.data.status },
        idempotencyKey: `hr-document-scan:${version.id}:${parsed.data.status}`,
      });
      await appendHrAudit(tx, { organizationId: version.organizationId, actorRole: "SYSTEM", entityType: "HrEmployeeDocumentVersion", entityId: version.id, action: "hr.document.scan.completed", previousValues: { scanStatus: "PENDING" }, newValues: { scanStatus: parsed.data.status, provider: parsed.data.provider, reference: parsed.data.reference }, reason: parsed.data.reason });
    }, { isolationLevel: "Serializable" });
  } catch {
    return NextResponse.json({ error: "Scan result was already recorded or the version does not exist" }, { status: 409 });
  }
  return NextResponse.json({ accepted: true }, { headers: { "Cache-Control": "no-store" } });
}
