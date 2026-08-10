import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { authorizeInternalRequest } from "@/lib/hr/internal-auth";
import { assertExactScanTarget, GuardDutyS3MalwareScanner, type MalwareScanResult } from "@/lib/hr/documents/malware-scanner";
import { enqueueHrEmail } from "@/lib/hr/notifications/outbox";
import { hrObjectStorage, type PrivateObjectLocation } from "@/lib/hr/storage";

const genericInput = z.object({
  versionId: z.string().cuid(), status: z.enum(["CLEAN", "QUARANTINED", "FAILED"]),
  provider: z.string().trim().min(2).max(100), reference: z.string().trim().max(200).optional(),
  reason: z.string().trim().min(3).max(500),
});

export async function POST(request: Request) {
  if (!authorizeInternalRequest(request, process.env.DOCUMENT_SCANNER_SECRET)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await request.json().catch(() => null);
  const generic = genericInput.safeParse(payload);
  try {
    let versionId: string;
    let result: MalwareScanResult;
    if (generic.success) {
      if (process.env.APP_ENV === "production" && process.env.MALWARE_SCANNER_PROVIDER === "aws-guardduty-s3") throw new Error("Generic scan callbacks are disabled for the production scanner.");
      versionId = generic.data.versionId;
      result = { eventId: generic.data.reference ?? `generic:${versionId}:${generic.data.status}`, provider: generic.data.provider, providerStatus: generic.data.status, status: generic.data.status, reason: generic.data.reason, location: { key: "" } };
    } else {
      result = new GuardDutyS3MalwareScanner().parseResult(payload);
      const matched = await prisma.hrEmployeeDocumentVersion.findFirst({ where: { storageBucket: result.location.bucket, storageKey: result.location.key, storageVersionId: result.location.versionId } });
      if (!matched) throw new Error("No immutable document version matches this scan result.");
      versionId = matched.id;
      const location: PrivateObjectLocation = { provider: matched.storageProvider, bucket: matched.storageBucket ?? undefined, key: matched.storageKey, versionId: matched.storageVersionId ?? undefined, eTag: matched.storageEtag ?? undefined, checksum: matched.checksum };
      assertExactScanTarget(result, location);
      const metadata = await hrObjectStorage().headVersion(location);
      if (metadata.checksum !== matched.checksum) throw new Error("Provider object checksum does not match the document version.");
      if (metadata.scanStatus && metadata.scanStatus !== result.providerStatus) throw new Error("Provider scan event and object tag disagree.");
    }
    const recorded = await prisma.$transaction(async (tx) => {
      const version = await tx.hrEmployeeDocumentVersion.findUniqueOrThrow({ where: { id: versionId }, include: { document: { include: { employee: { include: { user: true } } } } } });
      if (version.providerScanEventId === result.eventId) return false;
      if (version.scanStatus !== "PENDING") throw new Error("conflicting terminal scan result");
      await tx.hrEmployeeDocumentVersion.update({ where: { id: version.id }, data: {
        scanStatus: result.status, scanCompletedAt: new Date(), scanProvider: result.provider,
        scanReference: result.eventId, scanReason: result.reason, providerScanEventId: result.eventId,
        providerScanStatus: result.providerStatus, releasedAt: result.status === "CLEAN" ? new Date() : null,
      } });
      await tx.hrLeaveEvidence.updateMany({ where: { documentVersionId: version.id, status: "PENDING_SCAN" }, data: { status: result.status === "CLEAN" ? "SATISFIED" : result.status === "QUARANTINED" ? "REJECTED_MALWARE" : "SCAN_FAILED" } });
      if (version.document.employee.user) await enqueueHrEmail(tx, {
        organizationId: version.organizationId, recipient: version.document.employee.user.email,
        template: "hr-document-scan-result", subject: "Employee document scan completed",
        payload: { documentId: version.documentId, documentVersionId: version.id, scanStatus: result.status },
        idempotencyKey: `hr-document-scan:${version.id}:${result.status}`,
      });
      await appendHrAudit(tx, { organizationId: version.organizationId, actorRole: "SYSTEM", entityType: "HrEmployeeDocumentVersion", entityId: version.id, action: "hr.document.scan.completed", previousValues: { scanStatus: "PENDING" }, newValues: { scanStatus: result.status, provider: result.provider, providerStatus: result.providerStatus, eventId: result.eventId, storageVersionId: version.storageVersionId }, reason: result.reason });
      return true;
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ accepted: true, alreadyRecorded: !recorded }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Scan result is invalid, stale, or conflicts with the immutable document version" }, { status: 409 });
  }
}
