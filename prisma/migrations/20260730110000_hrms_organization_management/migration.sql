CREATE TYPE "HrPositionLifecycleStatus" AS ENUM ('DRAFT','PENDING_APPROVAL','REJECTED','APPROVED','OPEN','PARTIALLY_FILLED','FILLED','FROZEN','CLOSED','CANCELLED');
CREATE TYPE "HrOrganizationChangeStatus" AS ENUM ('DRAFT','PENDING_APPROVAL','APPROVED','SCHEDULED','COMPLETED','FAILED','CANCELLED');
CREATE TYPE "HrLocationType" AS ENUM ('HEAD_OFFICE','REGIONAL_OFFICE','BRANCH','CLIENT_SITE','REMOTE','VIRTUAL');

ALTER TABLE "HrPosition"
  ADD COLUMN "legalEntityId" TEXT,
  ADD COLUMN "businessUnitId" TEXT,
  ADD COLUMN "divisionId" TEXT,
  ADD COLUMN "locationId" TEXT,
  ADD COLUMN "costCenterId" TEXT,
  ADD COLUMN "jobProfileId" TEXT,
  ADD COLUMN "gradeId" TEXT,
  ADD COLUMN "reportsToPositionId" TEXT,
  ADD COLUMN "lifecycleStatus" "HrPositionLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "headcountLimit" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "fullTimeEquivalent" DECIMAL(5,2) NOT NULL DEFAULT 1,
  ADD COLUMN "budgetedAmount" DECIMAL(18,2),
  ADD COLUMN "availableFrom" TIMESTAMP(3),
  ADD COLUMN "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "effectiveTo" TIMESTAMP(3),
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "requestedById" TEXT,
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3);

ALTER TABLE "HrEmployeeAssignment"
  ADD COLUMN "legalEntityId" TEXT,
  ADD COLUMN "businessUnitId" TEXT,
  ADD COLUMN "divisionId" TEXT,
  ADD COLUMN "locationId" TEXT,
  ADD COLUMN "costCenterId" TEXT,
  ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "fte" DECIMAL(5,2) NOT NULL DEFAULT 1,
  ADD COLUMN "placementSnapshot" JSONB,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "HrPosition"
  ADD CONSTRAINT "HrPosition_headcount_check" CHECK ("headcountLimit" > 0),
  ADD CONSTRAINT "HrPosition_fte_check" CHECK ("fullTimeEquivalent" > 0),
  ADD CONSTRAINT "HrPosition_effective_dates_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom");
ALTER TABLE "HrEmployeeAssignment"
  ADD CONSTRAINT "HrEmployeeAssignment_fte_check" CHECK ("fte" > 0),
  ADD CONSTRAINT "HrEmployeeAssignment_effective_dates_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom");

CREATE TABLE "HrLegalEntity" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL,
  "registeredName" TEXT, "countryCode" TEXT NOT NULL, "registrationNumber" TEXT, "taxIdentifierEncrypted" TEXT,
  "defaultCurrency" TEXT NOT NULL, "timezone" TEXT NOT NULL, "status" "HrRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "effectiveFrom" TIMESTAMP(3) NOT NULL, "effectiveTo" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrLegalEntity_dates_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom"),
  CONSTRAINT "HrLegalEntity_organization_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "HrLegalEntity_organizationId_code_key" ON "HrLegalEntity"("organizationId","code");
CREATE INDEX "HrLegalEntity_scope_idx" ON "HrLegalEntity"("organizationId","status","effectiveFrom","effectiveTo");

CREATE TABLE "HrBusinessUnit" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "legalEntityId" TEXT NOT NULL, "parentBusinessUnitId" TEXT,
  "code" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT, "status" "HrRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "effectiveFrom" TIMESTAMP(3) NOT NULL, "effectiveTo" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrBusinessUnit_organization_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT,
  CONSTRAINT "HrBusinessUnit_legalEntity_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "HrLegalEntity"("id") ON DELETE RESTRICT,
  CONSTRAINT "HrBusinessUnit_parent_fkey" FOREIGN KEY ("parentBusinessUnitId") REFERENCES "HrBusinessUnit"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "HrBusinessUnit_organizationId_code_key" ON "HrBusinessUnit"("organizationId","code");
CREATE INDEX "HrBusinessUnit_scope_idx" ON "HrBusinessUnit"("organizationId","legalEntityId","status","effectiveFrom","effectiveTo");

CREATE TABLE "HrDivision" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "businessUnitId" TEXT NOT NULL, "parentDivisionId" TEXT,
  "code" TEXT NOT NULL, "name" TEXT NOT NULL, "status" "HrRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "effectiveFrom" TIMESTAMP(3) NOT NULL, "effectiveTo" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrDivision_organization_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT,
  CONSTRAINT "HrDivision_businessUnit_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "HrBusinessUnit"("id") ON DELETE RESTRICT,
  CONSTRAINT "HrDivision_parent_fkey" FOREIGN KEY ("parentDivisionId") REFERENCES "HrDivision"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "HrDivision_organizationId_code_key" ON "HrDivision"("organizationId","code");
CREATE INDEX "HrDivision_scope_idx" ON "HrDivision"("organizationId","businessUnitId","status","effectiveFrom","effectiveTo");

CREATE TABLE "HrLocation" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "legalEntityId" TEXT NOT NULL, "parentLocationId" TEXT,
  "code" TEXT NOT NULL, "name" TEXT NOT NULL, "locationType" "HrLocationType" NOT NULL, "countryCode" TEXT NOT NULL,
  "region" TEXT, "city" TEXT, "addressProtected" JSONB, "timezone" TEXT NOT NULL, "workMode" "HrWorkMode",
  "status" "HrRecordStatus" NOT NULL DEFAULT 'ACTIVE', "effectiveFrom" TIMESTAMP(3) NOT NULL, "effectiveTo" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrLocation_organization_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT,
  CONSTRAINT "HrLocation_legalEntity_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "HrLegalEntity"("id") ON DELETE RESTRICT,
  CONSTRAINT "HrLocation_parent_fkey" FOREIGN KEY ("parentLocationId") REFERENCES "HrLocation"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "HrLocation_organizationId_code_key" ON "HrLocation"("organizationId","code");
CREATE INDEX "HrLocation_scope_idx" ON "HrLocation"("organizationId","legalEntityId","status","effectiveFrom","effectiveTo");

CREATE TABLE "HrCostCenter" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "legalEntityId" TEXT NOT NULL, "parentCostCenterId" TEXT,
  "code" TEXT NOT NULL, "name" TEXT NOT NULL, "ownerPositionId" TEXT, "budgetAmount" DECIMAL(18,2), "currency" TEXT NOT NULL,
  "status" "HrRecordStatus" NOT NULL DEFAULT 'ACTIVE', "effectiveFrom" TIMESTAMP(3) NOT NULL, "effectiveTo" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrCostCenter_organization_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT,
  CONSTRAINT "HrCostCenter_legalEntity_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "HrLegalEntity"("id") ON DELETE RESTRICT,
  CONSTRAINT "HrCostCenter_parent_fkey" FOREIGN KEY ("parentCostCenterId") REFERENCES "HrCostCenter"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "HrCostCenter_organizationId_code_key" ON "HrCostCenter"("organizationId","code");
CREATE INDEX "HrCostCenter_scope_idx" ON "HrCostCenter"("organizationId","legalEntityId","status","effectiveFrom","effectiveTo");

CREATE TABLE "HrJobFamily" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT,
  "status" "HrRecordStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrJobFamily_organization_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "HrJobFamily_organizationId_code_key" ON "HrJobFamily"("organizationId","code");
CREATE INDEX "HrJobFamily_scope_idx" ON "HrJobFamily"("organizationId","status","name");

CREATE TABLE "HrJobProfile" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "jobFamilyId" TEXT NOT NULL, "code" TEXT NOT NULL, "title" TEXT NOT NULL,
  "description" TEXT, "responsibilities" JSONB, "minimumRequirements" JSONB, "standardGradeId" TEXT,
  "status" "HrRecordStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrJobProfile_organization_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT,
  CONSTRAINT "HrJobProfile_jobFamily_fkey" FOREIGN KEY ("jobFamilyId") REFERENCES "HrJobFamily"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "HrJobProfile_organizationId_code_key" ON "HrJobProfile"("organizationId","code");
CREATE INDEX "HrJobProfile_scope_idx" ON "HrJobProfile"("organizationId","jobFamilyId","status","title");

CREATE TABLE "HrGrade" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL, "level" INTEGER NOT NULL,
  "currency" TEXT NOT NULL, "minimumSalary" DECIMAL(18,2), "midpointSalary" DECIMAL(18,2), "maximumSalary" DECIMAL(18,2),
  "status" "HrRecordStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrGrade_salary_range_check" CHECK ("minimumSalary" IS NULL OR "midpointSalary" IS NULL OR "minimumSalary" <= "midpointSalary"),
  CONSTRAINT "HrGrade_salary_max_check" CHECK ("midpointSalary" IS NULL OR "maximumSalary" IS NULL OR "midpointSalary" <= "maximumSalary"),
  CONSTRAINT "HrGrade_organization_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "HrGrade_organizationId_code_key" ON "HrGrade"("organizationId","code");
CREATE UNIQUE INDEX "HrGrade_organizationId_level_key" ON "HrGrade"("organizationId","level");
CREATE INDEX "HrGrade_scope_idx" ON "HrGrade"("organizationId","status","level");

CREATE TABLE "HrPositionApproval" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "positionId" TEXT NOT NULL, "requestedById" TEXT NOT NULL,
  "decidedById" TEXT, "decision" "HrWorkflowDecision", "reason" TEXT NOT NULL, "decisionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "decidedAt" TIMESTAMP(3),
  CONSTRAINT "HrPositionApproval_organization_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT,
  CONSTRAINT "HrPositionApproval_position_fkey" FOREIGN KEY ("positionId") REFERENCES "HrPosition"("id") ON DELETE RESTRICT
);
CREATE INDEX "HrPositionApproval_scope_idx" ON "HrPositionApproval"("organizationId","positionId","createdAt");

CREATE TABLE "HrOrganizationChange" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "entityType" TEXT NOT NULL, "entityId" TEXT NOT NULL,
  "status" "HrOrganizationChangeStatus" NOT NULL DEFAULT 'DRAFT', "effectiveAt" TIMESTAMP(3) NOT NULL,
  "payload" JSONB NOT NULL, "requestedById" TEXT NOT NULL, "approvedById" TEXT, "approvedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3), "failedAt" TIMESTAMP(3), "failureCode" TEXT, "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrOrganizationChange_organization_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT
);
CREATE INDEX "HrOrganizationChange_due_idx" ON "HrOrganizationChange"("organizationId","status","effectiveAt");

CREATE TABLE "HrOrganizationImportBatch" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "kind" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'VALIDATED',
  "originalName" TEXT NOT NULL, "rowCount" INTEGER NOT NULL, "validCount" INTEGER NOT NULL, "invalidCount" INTEGER NOT NULL,
  "createdById" TEXT NOT NULL, "committedById" TEXT, "committedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrOrganizationImportBatch_organization_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT
);
CREATE INDEX "HrOrganizationImportBatch_scope_idx" ON "HrOrganizationImportBatch"("organizationId","status","createdAt");
CREATE TABLE "HrOrganizationImportRow" (
  "id" TEXT PRIMARY KEY, "batchId" TEXT NOT NULL, "rowNumber" INTEGER NOT NULL, "payload" JSONB NOT NULL,
  "valid" BOOLEAN NOT NULL, "errors" JSONB NOT NULL, "committedId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrOrganizationImportRow_batch_fkey" FOREIGN KEY ("batchId") REFERENCES "HrOrganizationImportBatch"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "HrOrganizationImportRow_batchId_rowNumber_key" ON "HrOrganizationImportRow"("batchId","rowNumber");
CREATE INDEX "HrOrganizationImportRow_valid_idx" ON "HrOrganizationImportRow"("batchId","valid");
CREATE TABLE "HrOrganizationStructureRevision" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "entityType" TEXT NOT NULL, "entityId" TEXT NOT NULL,
  "version" INTEGER NOT NULL, "payload" JSONB NOT NULL, "effectiveFrom" TIMESTAMP(3) NOT NULL, "effectiveTo" TIMESTAMP(3),
  "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrOrganizationStructureRevision_dates_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom"),
  CONSTRAINT "HrOrganizationStructureRevision_organization_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "HrOrganizationStructureRevision_version_key" ON "HrOrganizationStructureRevision"("organizationId","entityType","entityId","version");
CREATE INDEX "HrOrganizationStructureRevision_effective_idx" ON "HrOrganizationStructureRevision"("organizationId","entityType","effectiveFrom","effectiveTo");

-- Preserve legacy behavior while making existing positions immediately usable.
UPDATE "HrPosition" p SET "lifecycleStatus" =
  CASE WHEN EXISTS (
    SELECT 1 FROM "HrEmployeeAssignment" a
    WHERE a."positionId" = p."id" AND a."status" = 'ACTIVE'
      AND (a."effectiveTo" IS NULL OR a."effectiveTo" > CURRENT_TIMESTAMP)
  ) THEN 'FILLED'::"HrPositionLifecycleStatus" ELSE 'OPEN'::"HrPositionLifecycleStatus" END;
