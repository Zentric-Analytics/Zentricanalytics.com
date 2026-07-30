CREATE TABLE "HrEmployeeProvisioningDraft" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "currentStep" INTEGER NOT NULL DEFAULT 1,
  "version" INTEGER NOT NULL DEFAULT 1,
  "payload" JSONB NOT NULL,
  "readinessScore" INTEGER NOT NULL DEFAULT 0,
  "submittedAt" TIMESTAMP(3),
  "finalizedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "finalizedById" TEXT,
  "finalizedEmployeeId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrEmployeeProvisioningDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HrEmployeeProvisioningDraft_finalizedEmployeeId_key"
  ON "HrEmployeeProvisioningDraft"("finalizedEmployeeId");
CREATE INDEX "HrEmployeeProvisioningDraft_organizationId_status_updatedAt_idx"
  ON "HrEmployeeProvisioningDraft"("organizationId", "status", "updatedAt");
CREATE INDEX "HrEmployeeProvisioningDraft_createdById_status_idx"
  ON "HrEmployeeProvisioningDraft"("createdById", "status");

ALTER TABLE "HrEmployeeProvisioningDraft"
  ADD CONSTRAINT "HrEmployeeProvisioningDraft_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrEmployeeProvisioningDraft"
  ADD CONSTRAINT "HrEmployeeProvisioningDraft_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrEmployeeProvisioningDraft"
  ADD CONSTRAINT "HrEmployeeProvisioningDraft_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrEmployeeProvisioningDraft"
  ADD CONSTRAINT "HrEmployeeProvisioningDraft_finalizedById_fkey"
  FOREIGN KEY ("finalizedById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrEmployeeProvisioningDraft"
  ADD CONSTRAINT "HrEmployeeProvisioningDraft_finalizedEmployeeId_fkey"
  FOREIGN KEY ("finalizedEmployeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
