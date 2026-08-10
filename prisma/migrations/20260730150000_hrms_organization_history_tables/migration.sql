-- Forward-only repair for staging databases that applied the initial Unit 2
-- migration before import and revision-history tables were added to that file.
CREATE TABLE IF NOT EXISTS "HrOrganizationImportBatch" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'VALIDATED',
  "originalName" TEXT NOT NULL,
  "rowCount" INTEGER NOT NULL,
  "validCount" INTEGER NOT NULL,
  "invalidCount" INTEGER NOT NULL,
  "createdById" TEXT NOT NULL,
  "committedById" TEXT,
  "committedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrOrganizationImportBatch_organization_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS "HrOrganizationImportBatch_scope_idx"
  ON "HrOrganizationImportBatch"("organizationId","status","createdAt");

CREATE TABLE IF NOT EXISTS "HrOrganizationImportRow" (
  "id" TEXT PRIMARY KEY,
  "batchId" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "payload" JSONB NOT NULL,
  "valid" BOOLEAN NOT NULL,
  "errors" JSONB NOT NULL,
  "committedId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrOrganizationImportRow_batch_fkey"
    FOREIGN KEY ("batchId") REFERENCES "HrOrganizationImportBatch"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "HrOrganizationImportRow_batchId_rowNumber_key"
  ON "HrOrganizationImportRow"("batchId","rowNumber");
CREATE INDEX IF NOT EXISTS "HrOrganizationImportRow_valid_idx"
  ON "HrOrganizationImportRow"("batchId","valid");

CREATE TABLE IF NOT EXISTS "HrOrganizationStructureRevision" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "payload" JSONB NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrOrganizationStructureRevision_dates_check"
    CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom"),
  CONSTRAINT "HrOrganizationStructureRevision_organization_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS "HrOrganizationStructureRevision_version_key"
  ON "HrOrganizationStructureRevision"("organizationId","entityType","entityId","version");
CREATE INDEX IF NOT EXISTS "HrOrganizationStructureRevision_effective_idx"
  ON "HrOrganizationStructureRevision"("organizationId","entityType","effectiveFrom","effectiveTo");
