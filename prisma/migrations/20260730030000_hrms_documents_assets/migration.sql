-- Additive HRMS employee documents and asset custody history.
CREATE TYPE "HrDocumentCategory" AS ENUM ('EMPLOYMENT_AGREEMENT', 'OFFER_LETTER', 'IDENTITY_DOCUMENT', 'TAX_DOCUMENT', 'BANK_DOCUMENT', 'QUALIFICATION_CERTIFICATE', 'POLICY_ACKNOWLEDGEMENT', 'LEAVE_SUPPORT', 'PERFORMANCE', 'DISCIPLINARY', 'EXIT_DOCUMENT', 'OTHER');
CREATE TYPE "HrDocumentScanStatus" AS ENUM ('PENDING', 'CLEAN', 'QUARANTINED', 'FAILED');
CREATE TYPE "HrDocumentRetentionStatus" AS ENUM ('ACTIVE', 'HOLD', 'EXPIRED', 'PENDING_DELETION');
CREATE TYPE "HrAssetStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'UNDER_REPAIR', 'LOST', 'RETIRED', 'DISPOSED');
CREATE TYPE "HrAssetCondition" AS ENUM ('NEW', 'GOOD', 'FAIR', 'DAMAGED', 'UNUSABLE');
CREATE TYPE "HrAssetAssignmentStatus" AS ENUM ('ACTIVE', 'RETURNED', 'CANCELLED', 'LOST');

CREATE TABLE "HrEmployeeDocument" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "category" "HrDocumentCategory" NOT NULL,
  "title" TEXT NOT NULL,
  "restricted" BOOLEAN NOT NULL DEFAULT false,
  "retentionStatus" "HrDocumentRetentionStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "archiveReason" TEXT,
  "createdById" TEXT NOT NULL,
  "archivedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrEmployeeDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HrEmployeeDocumentVersion" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "originalFileName" TEXT NOT NULL,
  "displayFileName" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "storageProvider" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "checksum" TEXT NOT NULL,
  "scanStatus" "HrDocumentScanStatus" NOT NULL DEFAULT 'PENDING',
  "scanProvider" TEXT,
  "scanReference" TEXT,
  "scanReason" TEXT,
  "scanCompletedAt" TIMESTAMP(3),
  "scanRecordedById" TEXT,
  "uploadedById" TEXT NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrEmployeeDocumentVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HrEmployeeDocumentVersion_version_check" CHECK ("version" > 0),
  CONSTRAINT "HrEmployeeDocumentVersion_size_check" CHECK ("sizeBytes" > 0)
);

CREATE TABLE "HrDocumentAccessLog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "documentVersionId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "purpose" TEXT,
  "ipHash" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrDocumentAccessLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HrAsset" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "assetTag" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "manufacturer" TEXT,
  "model" TEXT,
  "serialNumber" TEXT,
  "purchaseDate" TIMESTAMP(3),
  "purchaseValue" DECIMAL(18,2),
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "condition" "HrAssetCondition" NOT NULL DEFAULT 'GOOD',
  "status" "HrAssetStatus" NOT NULL DEFAULT 'AVAILABLE',
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrAsset_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HrAsset_purchase_value_check" CHECK ("purchaseValue" IS NULL OR "purchaseValue" >= 0)
);

CREATE TABLE "HrAssetAssignment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL,
  "expectedReturnAt" TIMESTAMP(3),
  "issueCondition" "HrAssetCondition" NOT NULL,
  "issueNotes" TEXT,
  "acknowledgedAt" TIMESTAMP(3),
  "returnedAt" TIMESTAMP(3),
  "returnCondition" "HrAssetCondition",
  "returnNotes" TEXT,
  "status" "HrAssetAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "assignedById" TEXT NOT NULL,
  "returnRecordedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrAssetAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HrAssetAssignment_expected_return_check" CHECK ("expectedReturnAt" IS NULL OR "expectedReturnAt" >= "assignedAt"),
  CONSTRAINT "HrAssetAssignment_return_state_check" CHECK (
    ("status" = 'ACTIVE' AND "returnedAt" IS NULL AND "returnCondition" IS NULL AND "returnRecordedById" IS NULL)
    OR ("status" = 'RETURNED' AND "returnedAt" IS NOT NULL AND "returnCondition" IS NOT NULL AND "returnRecordedById" IS NOT NULL)
    OR "status" IN ('CANCELLED', 'LOST')
  ),
  CONSTRAINT "HrAssetAssignment_return_check" CHECK ("returnedAt" IS NULL OR "returnedAt" >= "assignedAt")
);

CREATE INDEX "HrEmployeeDocument_organizationId_category_retentionStatus_archivedAt_idx" ON "HrEmployeeDocument"("organizationId", "category", "retentionStatus", "archivedAt");
CREATE INDEX "HrEmployeeDocument_employeeId_createdAt_idx" ON "HrEmployeeDocument"("employeeId", "createdAt");
CREATE INDEX "HrEmployeeDocument_organizationId_expiresAt_idx" ON "HrEmployeeDocument"("organizationId", "expiresAt");
CREATE UNIQUE INDEX "HrEmployeeDocumentVersion_storageKey_key" ON "HrEmployeeDocumentVersion"("storageKey");
CREATE UNIQUE INDEX "HrEmployeeDocumentVersion_documentId_version_key" ON "HrEmployeeDocumentVersion"("documentId", "version");
CREATE INDEX "HrEmployeeDocumentVersion_organizationId_scanStatus_uploadedAt_idx" ON "HrEmployeeDocumentVersion"("organizationId", "scanStatus", "uploadedAt");
CREATE INDEX "HrEmployeeDocumentVersion_checksum_idx" ON "HrEmployeeDocumentVersion"("checksum");
CREATE INDEX "HrDocumentAccessLog_organizationId_createdAt_idx" ON "HrDocumentAccessLog"("organizationId", "createdAt");
CREATE INDEX "HrDocumentAccessLog_documentVersionId_createdAt_idx" ON "HrDocumentAccessLog"("documentVersionId", "createdAt");
CREATE INDEX "HrDocumentAccessLog_actorUserId_createdAt_idx" ON "HrDocumentAccessLog"("actorUserId", "createdAt");
CREATE UNIQUE INDEX "HrAsset_organizationId_assetTag_key" ON "HrAsset"("organizationId", "assetTag");
CREATE UNIQUE INDEX "HrAsset_organizationId_serialNumber_key" ON "HrAsset"("organizationId", "serialNumber");
CREATE INDEX "HrAsset_organizationId_status_type_idx" ON "HrAsset"("organizationId", "status", "type");
CREATE INDEX "HrAssetAssignment_organizationId_status_expectedReturnAt_idx" ON "HrAssetAssignment"("organizationId", "status", "expectedReturnAt");
CREATE INDEX "HrAssetAssignment_employeeId_status_assignedAt_idx" ON "HrAssetAssignment"("employeeId", "status", "assignedAt");
CREATE INDEX "HrAssetAssignment_assetId_status_assignedAt_idx" ON "HrAssetAssignment"("assetId", "status", "assignedAt");
CREATE UNIQUE INDEX "HrAssetAssignment_one_active_asset" ON "HrAssetAssignment"("assetId") WHERE "status" = 'ACTIVE';

ALTER TABLE "HrEmployeeDocument" ADD CONSTRAINT "HrEmployeeDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrEmployeeDocument" ADD CONSTRAINT "HrEmployeeDocument_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrEmployeeDocument" ADD CONSTRAINT "HrEmployeeDocument_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrEmployeeDocument" ADD CONSTRAINT "HrEmployeeDocument_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrEmployeeDocumentVersion" ADD CONSTRAINT "HrEmployeeDocumentVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrEmployeeDocumentVersion" ADD CONSTRAINT "HrEmployeeDocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "HrEmployeeDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrEmployeeDocumentVersion" ADD CONSTRAINT "HrEmployeeDocumentVersion_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrEmployeeDocumentVersion" ADD CONSTRAINT "HrEmployeeDocumentVersion_scanRecordedById_fkey" FOREIGN KEY ("scanRecordedById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrDocumentAccessLog" ADD CONSTRAINT "HrDocumentAccessLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrDocumentAccessLog" ADD CONSTRAINT "HrDocumentAccessLog_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "HrEmployeeDocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrDocumentAccessLog" ADD CONSTRAINT "HrDocumentAccessLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrAsset" ADD CONSTRAINT "HrAsset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrAsset" ADD CONSTRAINT "HrAsset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrAssetAssignment" ADD CONSTRAINT "HrAssetAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrAssetAssignment" ADD CONSTRAINT "HrAssetAssignment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "HrAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrAssetAssignment" ADD CONSTRAINT "HrAssetAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrAssetAssignment" ADD CONSTRAINT "HrAssetAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrAssetAssignment" ADD CONSTRAINT "HrAssetAssignment_returnRecordedById_fkey" FOREIGN KEY ("returnRecordedById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER "HrEmployeeDocument_no_delete"
BEFORE DELETE ON "HrEmployeeDocument" FOR EACH ROW EXECUTE FUNCTION hr_prevent_immutable_mutation();
CREATE TRIGGER "HrDocumentAccessLog_immutable"
BEFORE UPDATE OR DELETE ON "HrDocumentAccessLog" FOR EACH ROW EXECUTE FUNCTION hr_prevent_immutable_mutation();
CREATE TRIGGER "HrAsset_no_delete"
BEFORE DELETE ON "HrAsset" FOR EACH ROW EXECUTE FUNCTION hr_prevent_immutable_mutation();
CREATE TRIGGER "HrAssetAssignment_no_delete"
BEFORE DELETE ON "HrAssetAssignment" FOR EACH ROW EXECUTE FUNCTION hr_prevent_immutable_mutation();

CREATE OR REPLACE FUNCTION hr_protect_document_version()
RETURNS trigger AS $$
BEGIN
  IF OLD."scanStatus" <> 'PENDING'
     OR NEW."organizationId" <> OLD."organizationId"
     OR NEW."documentId" <> OLD."documentId"
     OR NEW."version" <> OLD."version"
     OR NEW."originalFileName" <> OLD."originalFileName"
     OR NEW."displayFileName" <> OLD."displayFileName"
     OR NEW."contentType" <> OLD."contentType"
     OR NEW."sizeBytes" <> OLD."sizeBytes"
     OR NEW."storageProvider" <> OLD."storageProvider"
     OR NEW."storageKey" <> OLD."storageKey"
     OR NEW."checksum" <> OLD."checksum"
     OR NEW."uploadedById" <> OLD."uploadedById"
     OR NEW."uploadedAt" <> OLD."uploadedAt"
     OR NEW."scanStatus" = 'PENDING'
     OR NEW."scanCompletedAt" IS NULL THEN
    RAISE EXCEPTION 'Document versions are immutable except for one terminal scan result';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "HrEmployeeDocumentVersion_protected_update"
BEFORE UPDATE ON "HrEmployeeDocumentVersion" FOR EACH ROW EXECUTE FUNCTION hr_protect_document_version();
CREATE TRIGGER "HrEmployeeDocumentVersion_no_delete"
BEFORE DELETE ON "HrEmployeeDocumentVersion" FOR EACH ROW EXECUTE FUNCTION hr_prevent_immutable_mutation();

CREATE OR REPLACE FUNCTION hr_protect_asset_assignment()
RETURNS trigger AS $$
BEGIN
  IF OLD."status" <> 'ACTIVE'
     OR NEW."organizationId" <> OLD."organizationId"
     OR NEW."assetId" <> OLD."assetId"
     OR NEW."employeeId" <> OLD."employeeId"
     OR NEW."assignedAt" <> OLD."assignedAt"
     OR NEW."expectedReturnAt" IS DISTINCT FROM OLD."expectedReturnAt"
     OR NEW."issueCondition" <> OLD."issueCondition"
     OR NEW."issueNotes" IS DISTINCT FROM OLD."issueNotes"
     OR NEW."assignedById" <> OLD."assignedById"
     OR NEW."createdAt" <> OLD."createdAt"
     OR (OLD."acknowledgedAt" IS NOT NULL AND NEW."acknowledgedAt" IS DISTINCT FROM OLD."acknowledgedAt") THEN
    RAISE EXCEPTION 'Asset assignment custody history is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "HrAssetAssignment_protected_update"
BEFORE UPDATE ON "HrAssetAssignment" FOR EACH ROW EXECUTE FUNCTION hr_protect_asset_assignment();
