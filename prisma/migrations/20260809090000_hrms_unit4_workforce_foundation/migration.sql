-- Unit 4 foundation is additive. Existing employee rows remain authoritative and
-- are reconciled to stable Person and WorkRelationship anchors.
CREATE TYPE "HrWorkRelationshipStatus" AS ENUM ('ACTIVE', 'NOTICE_PERIOD', 'SUSPENDED', 'ENDED', 'CANCELLED');
CREATE TYPE "HrWorkforceEventType" AS ENUM ('JOB_CHANGE', 'POSITION_CHANGE', 'PROMOTION', 'TRANSFER', 'DEPARTMENT_CHANGE', 'TEAM_CHANGE', 'MANAGER_CHANGE', 'LOCATION_CHANGE', 'LEGAL_ENTITY_TRANSFER', 'GRADE_CHANGE', 'EMPLOYMENT_TYPE_CHANGE', 'WORK_ARRANGEMENT_CHANGE', 'CONTRACT_CHANGE', 'PROBATION_CONFIRMATION', 'PROBATION_EXTENSION', 'RESIGNATION', 'TERMINATION', 'RETIREMENT', 'CONTRACT_EXPIRY', 'REHIRE');
CREATE TYPE "HrWorkforceEventStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'RETURNED', 'APPROVED', 'SCHEDULED', 'APPLYING', 'APPLIED', 'REJECTED', 'CANCELLED', 'FAILED');
CREATE TYPE "HrProfileChangeRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'MORE_INFORMATION_REQUIRED', 'APPROVED', 'REJECTED', 'CANCELLED', 'APPLIED');

CREATE TABLE "HrPerson" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "identityKeyHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrPerson_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "HrEmployee" ADD COLUMN "personId" TEXT;

CREATE TABLE "HrWorkRelationship" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "relationshipRef" TEXT NOT NULL,
  "status" "HrWorkRelationshipStatus" NOT NULL DEFAULT 'ACTIVE',
  "startedAt" TIMESTAMP(3) NOT NULL,
  "noticeDate" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "endReason" TEXT,
  "rehireOfId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrWorkRelationship_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HrWorkforceEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "workRelationshipId" TEXT,
  "reference" TEXT NOT NULL,
  "type" "HrWorkforceEventType" NOT NULL,
  "status" "HrWorkforceEventStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "reason" TEXT NOT NULL,
  "currentSnapshot" JSONB NOT NULL,
  "proposedSnapshot" JSONB NOT NULL,
  "requestedEffectiveAt" TIMESTAMP(3) NOT NULL,
  "initiatedById" TEXT NOT NULL,
  "ownerUserId" TEXT,
  "workflowInstanceId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "scheduledAt" TIMESTAMP(3),
  "appliedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrWorkforceEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HrWorkforceEvent_version_check" CHECK ("version" > 0)
);

CREATE TABLE "HrWorkforceEventVersion" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "currentSnapshot" JSONB NOT NULL,
  "proposedSnapshot" JSONB NOT NULL,
  "reason" TEXT NOT NULL,
  "evidenceVersionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrWorkforceEventVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HrWorkforceEventVersion_version_check" CHECK ("version" > 0)
);

CREATE TABLE "HrWorkforceEventExecutionAttempt" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventVersion" INTEGER NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "claimTokenHash" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "safeError" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "HrWorkforceEventExecutionAttempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HrWorkforceEventExecutionAttempt_attempt_check" CHECK ("attemptNumber" > 0)
);

CREATE TABLE "HrProfileChangeRequest" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "status" "HrProfileChangeRequestStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "fieldKey" TEXT NOT NULL,
  "currentValueRedacted" JSONB,
  "proposedValueEncrypted" TEXT,
  "proposedValueRedacted" JSONB NOT NULL,
  "effectiveAt" TIMESTAMP(3),
  "evidenceVersionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "requestedById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "reviewReason" TEXT,
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "appliedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "correlationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrProfileChangeRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HrProfileChangeRequest_version_check" CHECK ("version" > 0)
);

CREATE UNIQUE INDEX "HrPerson_organizationId_identityKeyHash_key" ON "HrPerson"("organizationId", "identityKeyHash");
CREATE INDEX "HrPerson_organizationId_createdAt_idx" ON "HrPerson"("organizationId", "createdAt");
CREATE INDEX "HrEmployee_organizationId_personId_idx" ON "HrEmployee"("organizationId", "personId");
CREATE UNIQUE INDEX "HrWorkRelationship_organizationId_relationshipRef_key" ON "HrWorkRelationship"("organizationId", "relationshipRef");
CREATE INDEX "HrWorkRelationship_organizationId_personId_status_idx" ON "HrWorkRelationship"("organizationId", "personId", "status");
CREATE INDEX "HrWorkRelationship_employeeId_status_startedAt_endedAt_idx" ON "HrWorkRelationship"("employeeId", "status", "startedAt", "endedAt");
CREATE UNIQUE INDEX "HrWorkforceEvent_organizationId_reference_key" ON "HrWorkforceEvent"("organizationId", "reference");
CREATE UNIQUE INDEX "HrWorkforceEvent_organizationId_idempotencyKey_key" ON "HrWorkforceEvent"("organizationId", "idempotencyKey");
CREATE UNIQUE INDEX "HrWorkforceEvent_organizationId_correlationId_key" ON "HrWorkforceEvent"("organizationId", "correlationId");
CREATE INDEX "HrWorkforceEvent_organizationId_status_requestedEffectiveAt_idx" ON "HrWorkforceEvent"("organizationId", "status", "requestedEffectiveAt");
CREATE INDEX "HrWorkforceEvent_employeeId_status_requestedEffectiveAt_idx" ON "HrWorkforceEvent"("employeeId", "status", "requestedEffectiveAt");
CREATE UNIQUE INDEX "HrWorkforceEventVersion_eventId_version_key" ON "HrWorkforceEventVersion"("eventId", "version");
CREATE INDEX "HrWorkforceEventVersion_eventId_createdAt_idx" ON "HrWorkforceEventVersion"("eventId", "createdAt");
CREATE UNIQUE INDEX "HrWorkforceEventExecutionAttempt_claimTokenHash_key" ON "HrWorkforceEventExecutionAttempt"("claimTokenHash");
CREATE UNIQUE INDEX "HrWorkforceEventExecutionAttempt_event_version_attempt_key" ON "HrWorkforceEventExecutionAttempt"("eventId", "eventVersion", "attemptNumber");
CREATE INDEX "HrWorkforceEventExecutionAttempt_status_startedAt_idx" ON "HrWorkforceEventExecutionAttempt"("status", "startedAt");
CREATE UNIQUE INDEX "HrProfileChangeRequest_organizationId_correlationId_key" ON "HrProfileChangeRequest"("organizationId", "correlationId");
CREATE INDEX "HrProfileChangeRequest_organizationId_status_createdAt_idx" ON "HrProfileChangeRequest"("organizationId", "status", "createdAt");
CREATE INDEX "HrProfileChangeRequest_employeeId_fieldKey_status_idx" ON "HrProfileChangeRequest"("employeeId", "fieldKey", "status");

ALTER TABLE "HrPerson" ADD CONSTRAINT "HrPerson_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrEmployee" ADD CONSTRAINT "HrEmployee_personId_fkey" FOREIGN KEY ("personId") REFERENCES "HrPerson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrWorkRelationship" ADD CONSTRAINT "HrWorkRelationship_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrWorkRelationship" ADD CONSTRAINT "HrWorkRelationship_personId_fkey" FOREIGN KEY ("personId") REFERENCES "HrPerson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrWorkRelationship" ADD CONSTRAINT "HrWorkRelationship_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrWorkRelationship" ADD CONSTRAINT "HrWorkRelationship_rehireOfId_fkey" FOREIGN KEY ("rehireOfId") REFERENCES "HrWorkRelationship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrWorkforceEvent" ADD CONSTRAINT "HrWorkforceEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrWorkforceEvent" ADD CONSTRAINT "HrWorkforceEvent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrWorkforceEvent" ADD CONSTRAINT "HrWorkforceEvent_workRelationshipId_fkey" FOREIGN KEY ("workRelationshipId") REFERENCES "HrWorkRelationship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrWorkforceEventVersion" ADD CONSTRAINT "HrWorkforceEventVersion_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "HrWorkforceEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrWorkforceEventExecutionAttempt" ADD CONSTRAINT "HrWorkforceEventExecutionAttempt_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "HrWorkforceEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrProfileChangeRequest" ADD CONSTRAINT "HrProfileChangeRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrProfileChangeRequest" ADD CONSTRAINT "HrProfileChangeRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reconcile the existing employee population without changing existing IDs or
-- overwriting any Unit 1-3 attribute.
INSERT INTO "HrPerson" ("id", "organizationId", "identityKeyHash", "createdAt", "updatedAt")
SELECT 'legacy_person_' || md5(e."id"), e."organizationId", 'legacy:' || md5(e."id"), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "HrEmployee" e
WHERE e."personId" IS NULL;

UPDATE "HrEmployee" e
SET "personId" = 'legacy_person_' || md5(e."id")
WHERE e."personId" IS NULL;

INSERT INTO "HrWorkRelationship" (
  "id", "organizationId", "personId", "employeeId", "relationshipRef", "status", "startedAt", "noticeDate", "endedAt", "endReason", "createdAt", "updatedAt"
)
SELECT
  'legacy_relationship_' || md5(e."id"),
  e."organizationId",
  e."personId",
  e."id",
  'WR-LEGACY-' || e."employeeNumber",
  CASE
    WHEN e."employmentStatus" = 'NOTICE_PERIOD' THEN 'NOTICE_PERIOD'::"HrWorkRelationshipStatus"
    WHEN e."employmentStatus" = 'SUSPENDED' THEN 'SUSPENDED'::"HrWorkRelationshipStatus"
    WHEN e."employmentStatus" IN ('TERMINATED', 'RESIGNED', 'ARCHIVED') THEN 'ENDED'::"HrWorkRelationshipStatus"
    WHEN e."employmentStatus" = 'CANCELLED' THEN 'CANCELLED'::"HrWorkRelationshipStatus"
    ELSE 'ACTIVE'::"HrWorkRelationshipStatus"
  END,
  COALESCE(e."startDate", e."hireDate", e."createdAt"),
  e."noticePeriodStartDate",
  e."terminationDate",
  e."terminationReason",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "HrEmployee" e
WHERE NOT EXISTS (
  SELECT 1 FROM "HrWorkRelationship" wr
  WHERE wr."organizationId" = e."organizationId" AND wr."employeeId" = e."id"
);

-- Register Unit 4 capabilities using deterministic IDs so the migration is
-- repeat-safe in restored staging validation environments.
WITH permission_keys("key") AS (
  VALUES
    ('employee.profile_change.request'), ('employee.profile_change.review'),
    ('workforce_event.create'), ('workforce_event.review'), ('workforce_event.apply'),
    ('workforce_event.read_self'), ('workforce_event.read_team')
)
INSERT INTO "HrPermission" ("id", "organizationId", "key", "description", "createdAt")
SELECT 'unit4_permission_' || md5(o."id" || ':' || p."key"), o."id", p."key", 'Unit 4 workforce operations permission', CURRENT_TIMESTAMP
FROM "HrOrganization" o CROSS JOIN permission_keys p
ON CONFLICT ("organizationId", "key") DO NOTHING;

INSERT INTO "HrRolePermission" ("id", "roleId", "permissionId", "createdAt")
SELECT 'unit4_role_permission_' || md5(r."id" || ':' || p."id"), r."id", p."id", CURRENT_TIMESTAMP
FROM "HrRole" r
JOIN "HrPermission" p ON p."organizationId" = r."organizationId"
WHERE p."key" IN ('employee.profile_change.request', 'employee.profile_change.review', 'workforce_event.create', 'workforce_event.review', 'workforce_event.apply', 'workforce_event.read_self', 'workforce_event.read_team')
  AND (
    r."key" IN ('ADMIN', 'HR_ADMIN')
    OR (r."key" = 'EMPLOYEE' AND p."key" IN ('employee.profile_change.request', 'workforce_event.read_self'))
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
