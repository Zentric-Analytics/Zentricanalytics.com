import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";

const databaseUrl = new URL(process.env.DATABASE_URL ?? "postgresql://missing/missing");
if (process.env.HR_STAGING_DOCUMENT_CONFIRM !== "staging-only" || databaseUrl.pathname.slice(1) !== "zentric_analytics_staging") throw new Error("Refusing document conflict validation outside staging.");
for (const name of ["OBJECT_STORAGE_ENDPOINT", "OBJECT_STORAGE_BUCKET", "OBJECT_STORAGE_REGION", "OBJECT_STORAGE_ACCESS_KEY_ID", "OBJECT_STORAGE_SECRET_ACCESS_KEY"]) if (!process.env[name]) throw new Error(`Missing staging storage configuration: ${name}`);

const prisma = new PrismaClient();
const run = `unit3-document-conflict-${Date.now()}`;
const bucket = process.env.OBJECT_STORAGE_BUCKET;
const s3 = new S3Client({ endpoint: process.env.OBJECT_STORAGE_ENDPOINT, region: process.env.OBJECT_STORAGE_REGION, forcePathStyle: process.env.OBJECT_STORAGE_FORCE_PATH_STYLE !== "false", credentials: { accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY_ID, secretAccessKey: process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY } });

try {
  const application = await prisma.jobApplication.findFirstOrThrow({ where: { applicationReference: "APL-2026-000010" } });
  const handover = await prisma.hrRecruitmentHandover.findFirstOrThrow({ where: { applicationId: application.id } });
  const actor = await prisma.hrUser.findFirstOrThrow({ where: { organizationId: application.organizationId, status: "ACTIVE" }, select: { id: true } });
  const key1 = `${application.applicationId}/${run}-v1.pdf`;
  const key2 = `${application.applicationId}/${run}-v2.pdf`;
  const bytes1 = Buffer.from("Unit 3 exact-version validation document version 1\n");
  const bytes2 = Buffer.from("Unit 3 exact-version validation document version 2\n");
  for (const [Key, Body] of [[key1, bytes1], [key2, bytes2]]) await s3.send(new PutObjectCommand({ Bucket: bucket, Key, Body, ContentType: "application/pdf", ServerSideEncryption: process.env.OBJECT_STORAGE_SERVER_SIDE_ENCRYPTION === "AES256" ? "AES256" : undefined }));
  const [head1, head2] = await Promise.all([key1, key2].map((Key) => s3.send(new HeadObjectCommand({ Bucket: bucket, Key }))));

  const v1 = await prisma.uploadedDocument.create({ data: { applicationId: application.id, kind: "UNIT3_EXACT_VERSION", fileName: `${run}-v1.pdf`, mimeType: "application/pdf", sizeBytes: bytes1.length, provider: "s3-compatible", storageKey: key1, restricted: true } });
  const review1 = await prisma.hrRecruitmentDocumentReview.create({ data: { handoverId: handover.id, uploadedDocumentId: v1.id, documentVersion: 1, reviewScope: "HR", status: "REPLACEMENT_REQUESTED", reviewedById: actor.id, reviewedAt: new Date(), reason: "Unit 3 exact-version conflict validation" } });
  const v2 = await prisma.uploadedDocument.create({ data: { applicationId: application.id, kind: "UNIT3_EXACT_VERSION", fileName: `${run}-v2.pdf`, mimeType: "application/pdf", sizeBytes: bytes2.length, provider: "s3-compatible", storageKey: key2, restricted: true } });

  const review2 = await prisma.$transaction(async (tx) => {
    const claimed = await tx.hrRecruitmentDocumentReview.updateMany({ where: { id: review1.id, status: "REPLACEMENT_REQUESTED", replacedById: null }, data: { replacedById: v2.id } });
    if (claimed.count !== 1) throw new Error("Applicant replacement did not atomically claim version 1.");
    const created = await tx.hrRecruitmentDocumentReview.create({ data: { handoverId: handover.id, uploadedDocumentId: v2.id, documentVersion: 2, reviewScope: "HR", status: "PENDING" } });
    await tx.hrAuditEvent.create({ data: { organizationId: application.organizationId, actorUserId: actor.id, entityType: "HrRecruitmentDocumentReview", entityId: review1.id, action: "hr.recruitment.document.replacement_submitted", newValues: { priorDocumentId: v1.id, replacementDocumentId: v2.id, priorVersion: 1, replacementVersion: 2 }, reason: run, correlationId: run } });
    return created;
  });

  const staleClaim = await prisma.hrRecruitmentDocumentReview.updateMany({ where: { id: review1.id, replacedById: null }, data: { status: "VERIFIED", reviewedById: actor.id, reviewedAt: new Date() } });
  const staleMessage = staleClaim.count === 0 ? "A newer document version was submitted. Review the latest version." : "STALE_REVIEW_INCORRECTLY_ACCEPTED";
  if (staleClaim.count !== 0) throw new Error(staleMessage);

  const beforeDecision = await prisma.hrRecruitmentDocumentReview.findUniqueOrThrow({ where: { id: review2.id } });
  if (beforeDecision.status !== "PENDING") throw new Error("Version 2 did not require a new HR decision.");
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.hrRecruitmentDocumentReview.updateMany({ where: { id: review2.id, replacedById: null, status: "PENDING" }, data: { status: "VERIFIED", reviewedById: actor.id, reviewedAt: new Date(), reason: "Exact version 2 verified" } });
    if (claimed.count !== 1) throw new Error("Version 2 exact review could not be claimed.");
    await tx.hrAuditEvent.create({ data: { organizationId: application.organizationId, actorUserId: actor.id, entityType: "HrRecruitmentDocumentReview", entityId: review2.id, action: "hr.recruitment.document.verified", newValues: { uploadedDocumentId: v2.id, documentVersion: 2, status: "VERIFIED" }, reason: run, correlationId: run } });
  });

  const [final1, final2, documents, audits] = await Promise.all([
    prisma.hrRecruitmentDocumentReview.findUniqueOrThrow({ where: { id: review1.id } }),
    prisma.hrRecruitmentDocumentReview.findUniqueOrThrow({ where: { id: review2.id } }),
    prisma.uploadedDocument.count({ where: { id: { in: [v1.id, v2.id] }, restricted: true } }),
    prisma.hrAuditEvent.findMany({ where: { correlationId: run }, orderBy: { createdAt: "asc" }, select: { action: true, entityId: true, newValues: true } }),
  ]);
  if (documents !== 2 || final1.replacedById !== v2.id || final1.status === "VERIFIED" || final2.status !== "VERIFIED" || audits.length !== 2) throw new Error("Exact-version preservation or audit verification failed.");
  console.log(JSON.stringify({ run, database: databaseUrl.pathname.slice(1), application: application.applicationId, storage: { version1: { key: key1, size: head1.ContentLength }, version2: { key: key2, size: head2.ContentLength } }, version1: { documentId: v1.id, reviewId: review1.id, status: final1.status, replacedById: final1.replacedById }, staleReview: { accepted: false, message: staleMessage }, version2: { documentId: v2.id, reviewId: review2.id, statusBeforeDecision: beforeDecision.status, statusAfterDecision: final2.status }, audits }, null, 2));
} finally {
  await prisma.$disconnect();
}
