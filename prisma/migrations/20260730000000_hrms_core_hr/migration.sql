-- Core HR is additive. Existing HR identities and recruitment records are preserved.
CREATE TYPE "HrRecordStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "HrEmploymentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED', 'ARCHIVED');
CREATE TYPE "HrEmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'TEMPORARY');
CREATE TYPE "HrAddressType" AS ENUM ('HOME', 'MAILING', 'EMERGENCY');
CREATE TYPE "HrIdentifierType" AS ENUM ('NATIONAL_ID', 'PASSPORT', 'TAX_ID', 'PENSION_ID', 'WORK_PERMIT', 'OTHER');

ALTER TABLE "HrEmployee"
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "dateOfBirth" TIMESTAMP(3),
  ADD COLUMN "employmentStatus" "HrEmploymentStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "hireDate" TIMESTAMP(3),
  ADD COLUMN "terminationDate" TIMESTAMP(3),
  ADD COLUMN "terminationReason" TEXT,
  ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE TABLE "HrDepartment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "HrRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "headEmployeeId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "HrDepartment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HrTeam" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "HrRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "HrTeam_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HrPosition" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "teamId" TEXT,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "salaryBandMinimum" DECIMAL(18,2),
  "salaryBandMaximum" DECIMAL(18,2),
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "status" "HrRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "HrPosition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HrPosition_salary_band_check" CHECK ("salaryBandMinimum" IS NULL OR "salaryBandMaximum" IS NULL OR "salaryBandMinimum" <= "salaryBandMaximum")
);

CREATE TABLE "HrEmployeeAssignment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "teamId" TEXT,
  "positionId" TEXT NOT NULL,
  "employmentType" "HrEmploymentType" NOT NULL,
  "location" TEXT,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "status" "HrAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "reason" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "endedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "HrEmployeeAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HrEmployeeAssignment_dates_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom")
);

CREATE TABLE "HrEmployeeAddress" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "type" "HrAddressType" NOT NULL,
  "line1" TEXT NOT NULL,
  "line2" TEXT,
  "city" TEXT NOT NULL,
  "state" TEXT,
  "postalCode" TEXT,
  "country" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrEmployeeAddress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HrEmergencyContact" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "relationship" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrEmergencyContact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HrEmployeeIdentifier" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "type" "HrIdentifierType" NOT NULL,
  "valueEncrypted" TEXT NOT NULL,
  "valueLastFour" TEXT,
  "issuingCountry" TEXT,
  "issuedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrEmployeeIdentifier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HrEmployeeBankAccount" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "bankName" TEXT NOT NULL,
  "accountName" TEXT NOT NULL,
  "accountNumberEncrypted" TEXT NOT NULL,
  "accountNumberLastFour" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "isPrimary" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrEmployeeBankAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HrEmployeeTaxProfile" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "taxCountry" TEXT NOT NULL,
  "taxIdentifierEncrypted" TEXT,
  "taxIdentifierLastFour" TEXT,
  "pensionProvider" TEXT,
  "pensionIdentifierEncrypted" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrEmployeeTaxProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HrDepartment_organizationId_code_key" ON "HrDepartment"("organizationId", "code");
CREATE UNIQUE INDEX "HrDepartment_organizationId_name_key" ON "HrDepartment"("organizationId", "name");
CREATE INDEX "HrDepartment_organizationId_status_name_idx" ON "HrDepartment"("organizationId", "status", "name");
CREATE UNIQUE INDEX "HrTeam_organizationId_code_key" ON "HrTeam"("organizationId", "code");
CREATE UNIQUE INDEX "HrTeam_departmentId_name_key" ON "HrTeam"("departmentId", "name");
CREATE INDEX "HrTeam_organizationId_status_name_idx" ON "HrTeam"("organizationId", "status", "name");
CREATE UNIQUE INDEX "HrPosition_organizationId_code_key" ON "HrPosition"("organizationId", "code");
CREATE INDEX "HrPosition_organizationId_status_title_idx" ON "HrPosition"("organizationId", "status", "title");
CREATE INDEX "HrPosition_departmentId_teamId_idx" ON "HrPosition"("departmentId", "teamId");
CREATE INDEX "HrEmployeeAssignment_organizationId_employeeId_status_effectiveFrom_effectiveTo_idx" ON "HrEmployeeAssignment"("organizationId", "employeeId", "status", "effectiveFrom", "effectiveTo");
CREATE INDEX "HrEmployeeAssignment_departmentId_positionId_status_idx" ON "HrEmployeeAssignment"("departmentId", "positionId", "status");
CREATE INDEX "HrEmployeeAddress_employeeId_type_isPrimary_idx" ON "HrEmployeeAddress"("employeeId", "type", "isPrimary");
CREATE INDEX "HrEmergencyContact_employeeId_isPrimary_idx" ON "HrEmergencyContact"("employeeId", "isPrimary");
CREATE UNIQUE INDEX "HrEmployeeIdentifier_employeeId_type_key" ON "HrEmployeeIdentifier"("employeeId", "type");
CREATE INDEX "HrEmployeeIdentifier_employeeId_expiresAt_idx" ON "HrEmployeeIdentifier"("employeeId", "expiresAt");
CREATE INDEX "HrEmployeeBankAccount_employeeId_isPrimary_idx" ON "HrEmployeeBankAccount"("employeeId", "isPrimary");
CREATE UNIQUE INDEX "HrEmployeeTaxProfile_employeeId_key" ON "HrEmployeeTaxProfile"("employeeId");

ALTER TABLE "HrDepartment" ADD CONSTRAINT "HrDepartment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrDepartment" ADD CONSTRAINT "HrDepartment_headEmployeeId_fkey" FOREIGN KEY ("headEmployeeId") REFERENCES "HrEmployee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HrTeam" ADD CONSTRAINT "HrTeam_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrTeam" ADD CONSTRAINT "HrTeam_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "HrDepartment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrPosition" ADD CONSTRAINT "HrPosition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrPosition" ADD CONSTRAINT "HrPosition_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "HrDepartment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrPosition" ADD CONSTRAINT "HrPosition_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "HrTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HrEmployeeAssignment" ADD CONSTRAINT "HrEmployeeAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrEmployeeAssignment" ADD CONSTRAINT "HrEmployeeAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrEmployeeAssignment" ADD CONSTRAINT "HrEmployeeAssignment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "HrDepartment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrEmployeeAssignment" ADD CONSTRAINT "HrEmployeeAssignment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "HrTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrEmployeeAssignment" ADD CONSTRAINT "HrEmployeeAssignment_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "HrPosition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrEmployeeAssignment" ADD CONSTRAINT "HrEmployeeAssignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrEmployeeAssignment" ADD CONSTRAINT "HrEmployeeAssignment_endedById_fkey" FOREIGN KEY ("endedById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrEmployeeAddress" ADD CONSTRAINT "HrEmployeeAddress_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HrEmergencyContact" ADD CONSTRAINT "HrEmergencyContact_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HrEmployeeIdentifier" ADD CONSTRAINT "HrEmployeeIdentifier_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HrEmployeeBankAccount" ADD CONSTRAINT "HrEmployeeBankAccount_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HrEmployeeTaxProfile" ADD CONSTRAINT "HrEmployeeTaxProfile_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "HrSupervisorAssignment" WHERE "departmentScopeId" IS NOT NULL) THEN
    RAISE EXCEPTION 'Core HR migration cannot safely map legacy departmentScopeId values. Clear or migrate them to HrDepartment IDs before retrying.';
  END IF;
END $$;
ALTER TABLE "HrSupervisorAssignment" ADD CONSTRAINT "HrSupervisorAssignment_departmentScopeId_fkey" FOREIGN KEY ("departmentScopeId") REFERENCES "HrDepartment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
