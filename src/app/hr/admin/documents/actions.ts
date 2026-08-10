"use server";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { documentMetadataInput, documentMustBeRestricted, validateHrDocumentFile } from "@/lib/hr/documents/validation";
import { enqueueHrEmail } from "@/lib/hr/notifications/outbox";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { hrObjectStorage, hrStorageProvider } from "@/lib/hr/storage";

function canUploadForEmployee(auth: Awaited<ReturnType<typeof requirePermission>>, employeeId: string) {
  return auth.user.employee?.id === employeeId || auth.permissions.has("document.update");
}

async function persistVersion(input: {
  auth: Awaited<ReturnType<typeof requirePermission>>;
  documentId: string;
  file: File;
  bytes: Uint8Array;
  version: number;
}) {
  const validated = validateHrDocumentFile(input.file, input.bytes);
  const checksum = crypto.createHash("sha256").update(input.bytes).digest("hex");
  const storageKey = `quarantine/documents/${input.auth.user.organizationId}/${input.documentId}/v${input.version}-${crypto.randomUUID()}`;
  const storage = hrObjectStorage();
  const location = await storage.quarantineUpload(storageKey, input.bytes, validated.contentType, checksum);
  try {
    const stored = await storage.headVersion(location);
    if (stored.sizeBytes !== input.bytes.byteLength) throw new Error("Stored document size verification failed.");
    if (stored.checksum !== checksum) throw new Error("Stored document checksum metadata verification failed.");
    return { ...validated, checksum, storageKey, storageProvider: hrStorageProvider(), storageBucket: location.bucket, storageVersionId: location.versionId, storageEtag: location.eTag, location };
  } catch (error) {
    await storage.deleteVersion(location).catch(() => undefined);
    throw error;
  }
}

export async function uploadEmployeeDocumentAction(formData: FormData) {
  const auth = await requirePermission("document.upload");
  const metadata = documentMetadataInput.parse({ ...Object.fromEntries(formData), restricted: formData.has("restricted") });
  if (!canUploadForEmployee(auth, metadata.employeeId)) throw new Error("Forbidden");
  const employee = await prisma.hrEmployee.findFirstOrThrow({ where: { id: metadata.employeeId, organizationId: auth.user.organizationId } });
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) throw new Error("Select a document to upload.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const documentId = crypto.randomUUID();
  const stored = await persistVersion({ auth, documentId, file, bytes, version: 1 });
  try {
    await prisma.$transaction(async (tx) => {
      const document = await tx.hrEmployeeDocument.create({ data: { id: documentId, organizationId: auth.user.organizationId, employeeId: employee.id, category: metadata.category, title: metadata.title, restricted: metadata.restricted || documentMustBeRestricted(metadata.category), expiresAt: metadata.expiresAt, createdById: auth.user.id } });
      const version = await tx.hrEmployeeDocumentVersion.create({ data: { organizationId: auth.user.organizationId, documentId: document.id, version: 1, originalFileName: file.name.slice(0, 500), displayFileName: stored.displayFileName, contentType: stored.contentType, sizeBytes: stored.sizeBytes, storageProvider: stored.storageProvider, storageBucket: stored.storageBucket, storageKey: stored.storageKey, storageVersionId: stored.storageVersionId, storageEtag: stored.storageEtag, checksum: stored.checksum, uploadedById: auth.user.id } });
      await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrEmployeeDocument", entityId: document.id, action: "hr.document.uploaded", newValues: { employeeId: employee.id, category: document.category, restricted: document.restricted, expiresAt: document.expiresAt, version: version.version, checksum: version.checksum } });
    });
  } catch (error) {
    await hrObjectStorage().deleteVersion(stored.location).catch(() => undefined);
    throw error;
  }
  revalidatePath("/hr/admin/documents");
  revalidatePath("/hr/employee/documents");
}

export async function uploadEmployeeDocumentVersionAction(formData: FormData) {
  const auth = await requirePermission("document.upload");
  const documentId = z.string().uuid().parse(formData.get("documentId"));
  const document = await prisma.hrEmployeeDocument.findFirstOrThrow({ where: { id: documentId, organizationId: auth.user.organizationId, archivedAt: null }, include: { versions: { orderBy: { version: "desc" }, take: 1 } } });
  if (!canUploadForEmployee(auth, document.employeeId)) throw new Error("Forbidden");
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) throw new Error("Select a document to upload.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const nextVersion = (document.versions[0]?.version ?? 0) + 1;
  const stored = await persistVersion({ auth, documentId, file, bytes, version: nextVersion });
  try {
    await prisma.$transaction(async (tx) => {
      const version = await tx.hrEmployeeDocumentVersion.create({ data: { organizationId: auth.user.organizationId, documentId, version: nextVersion, originalFileName: file.name.slice(0, 500), displayFileName: stored.displayFileName, contentType: stored.contentType, sizeBytes: stored.sizeBytes, storageProvider: stored.storageProvider, storageBucket: stored.storageBucket, storageKey: stored.storageKey, storageVersionId: stored.storageVersionId, storageEtag: stored.storageEtag, checksum: stored.checksum, uploadedById: auth.user.id } });
      await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrEmployeeDocumentVersion", entityId: version.id, action: "hr.document.version.uploaded", newValues: { documentId, version: nextVersion, checksum: stored.checksum } });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    await hrObjectStorage().deleteVersion(stored.location).catch(() => undefined);
    throw error;
  }
  revalidatePath("/hr/admin/documents");
  revalidatePath("/hr/employee/documents");
}

const scanInput = z.object({ versionId: z.string().cuid(), status: z.enum(["CLEAN", "QUARANTINED", "FAILED"]), provider: z.string().trim().min(2).max(80), reference: z.string().trim().max(160).optional().transform((value) => value || undefined), reason: z.string().trim().min(3).max(500) });
export async function recordDocumentScanAction(formData: FormData) {
  const auth = await requirePermission("document.update");
  const input = scanInput.parse(Object.fromEntries(formData));
  await prisma.$transaction(async (tx) => {
    const version = await tx.hrEmployeeDocumentVersion.findFirstOrThrow({ where: { id: input.versionId, organizationId: auth.user.organizationId, scanStatus: "PENDING" }, include: { document: { include: { employee: { include: { user: true } } } } } });
    const scanCompletedAt = new Date();
    await tx.hrEmployeeDocumentVersion.update({ where: { id: version.id }, data: { scanStatus: input.status, scanProvider: input.provider, scanReference: input.reference, scanReason: input.reason, scanCompletedAt, releasedAt: input.status === "CLEAN" ? scanCompletedAt : null, scanRecordedById: auth.user.id } });
    if (version.document.employee.user) await enqueueHrEmail(tx, { organizationId: auth.user.organizationId, recipient: version.document.employee.user.email, template: input.status === "CLEAN" ? "hr-document-available" : "hr-document-scan-attention", subject: input.status === "CLEAN" ? "An HR document is available" : "An HR document upload needs attention", payload: { documentId: version.documentId }, idempotencyKey: `hr-document-scan:${version.id}:${input.status}` });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrEmployeeDocumentVersion", entityId: version.id, action: "hr.document.scan.recorded", previousValues: { scanStatus: version.scanStatus }, newValues: { scanStatus: input.status, scanProvider: input.provider }, reason: input.reason });
  });
  revalidatePath("/hr/admin/documents");
  revalidatePath("/hr/employee/documents");
}

export async function archiveEmployeeDocumentAction(formData: FormData) {
  const auth = await requirePermission("document.archive");
  const id = z.string().uuid().parse(formData.get("id"));
  const reason = z.string().trim().min(3).max(500).parse(formData.get("reason"));
  await prisma.$transaction(async (tx) => {
    await tx.hrEmployeeDocument.findFirstOrThrow({ where: { id, organizationId: auth.user.organizationId, archivedAt: null }, select: { id: true } });
    await tx.hrEmployeeDocument.update({ where: { id }, data: { archivedAt: new Date(), archivedById: auth.user.id, archiveReason: reason } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrEmployeeDocument", entityId: id, action: "hr.document.archived", previousValues: { archived: false }, newValues: { archived: true }, reason });
  });
  revalidatePath("/hr/admin/documents");
  revalidatePath("/hr/employee/documents");
}

const metadataUpdateInput = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(2).max(160),
  expiresAt: z.coerce.date().optional().or(z.literal("")).transform((value) => value === "" ? undefined : value),
  retentionStatus: z.enum(["ACTIVE", "HOLD", "EXPIRED", "PENDING_DELETION"]),
  restricted: z.boolean(),
  reason: z.string().trim().min(3).max(500),
});
export async function updateEmployeeDocumentMetadataAction(formData: FormData) {
  const auth = await requirePermission("document.update");
  const input = metadataUpdateInput.parse({ ...Object.fromEntries(formData), restricted: formData.has("restricted") });
  await prisma.$transaction(async (tx) => {
    const document = await tx.hrEmployeeDocument.findFirstOrThrow({ where: { id: input.id, organizationId: auth.user.organizationId, archivedAt: null } });
    const restricted = input.restricted || documentMustBeRestricted(document.category);
    await tx.hrEmployeeDocument.update({ where: { id: document.id }, data: { title: input.title, expiresAt: input.expiresAt, retentionStatus: input.retentionStatus, restricted } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrEmployeeDocument", entityId: document.id, action: "hr.document.metadata.updated", previousValues: { title: document.title, expiresAt: document.expiresAt, retentionStatus: document.retentionStatus, restricted: document.restricted }, newValues: { title: input.title, expiresAt: input.expiresAt, retentionStatus: input.retentionStatus, restricted }, reason: input.reason });
  });
  revalidatePath("/hr/admin/documents");
  revalidatePath("/hr/employee/documents");
}

export async function sendDocumentExpiryRemindersAction(formData: FormData) {
  const auth = await requirePermission("document.update");
  const asOf = z.coerce.date().parse(formData.get("asOf"));
  const deadline = new Date(asOf);
  deadline.setUTCDate(deadline.getUTCDate() + 30);
  const documents = await prisma.hrEmployeeDocument.findMany({ where: { organizationId: auth.user.organizationId, archivedAt: null, retentionStatus: "ACTIVE", expiresAt: { gte: asOf, lte: deadline } }, include: { employee: { include: { user: true } } } });
  await prisma.$transaction(async (tx) => {
    for (const document of documents) if (document.employee.user) await enqueueHrEmail(tx, { organizationId: auth.user.organizationId, recipient: document.employee.user.email, template: "hr-document-expiring", subject: "An HR document is approaching expiration", payload: { documentId: document.id }, idempotencyKey: `hr-document-expiry:${document.id}:${asOf.toISOString().slice(0, 10)}` });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrEmployeeDocument", action: "hr.document.expiry_reminders.queued", newValues: { asOf, documentCount: documents.length } });
  });
  revalidatePath("/hr/admin/documents");
}
