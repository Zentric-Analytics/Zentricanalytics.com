CREATE TYPE "HrVacancyStatus" AS ENUM ('DRAFT','PENDING_APPROVAL','RETURNED_FOR_CORRECTION','APPROVED','SCHEDULED','OPEN','PAUSED','CLOSED','FILLED','CANCELLED');
CREATE TYPE "HrVacancyApprovalDecision" AS ENUM ('APPROVED','RETURNED');

CREATE TABLE "HrVacancy" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "vacancyNumber" TEXT NOT NULL,
  "publicSlug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "hiringTeamId" TEXT NOT NULL,
  "vacancyOwnerId" TEXT NOT NULL,
  "hiringManagerId" TEXT,
  "responsibleHrTeamId" TEXT NOT NULL,
  "legalEntityId" TEXT,
  "locationId" TEXT,
  "gradeId" TEXT,
  "employmentType" "HrEmploymentType" NOT NULL,
  "workMode" "HrWorkMode" NOT NULL,
  "numberOfOpenings" INTEGER NOT NULL,
  "filledOpenings" INTEGER NOT NULL DEFAULT 0,
  "description" TEXT NOT NULL,
  "responsibilities" JSONB NOT NULL,
  "minimumQualifications" JSONB NOT NULL,
  "preferredQualifications" JSONB NOT NULL,
  "requiredDocuments" JSONB NOT NULL,
  "screeningQuestions" JSONB NOT NULL,
  "salaryMinimum" DECIMAL(18,2),
  "salaryMaximum" DECIMAL(18,2),
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "publicSalary" BOOLEAN NOT NULL DEFAULT false,
  "locationLabel" TEXT,
  "opensAt" TIMESTAMP(3),
  "applicationDeadline" TIMESTAMP(3),
  "scheduledPublishAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "careersVisible" BOOLEAN NOT NULL DEFAULT false,
  "status" "HrVacancyStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "approvedVersion" INTEGER,
  "approvalInvalidatedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrVacancy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HrVacancy_openings_check" CHECK ("numberOfOpenings" > 0 AND "filledOpenings" >= 0 AND "filledOpenings" <= "numberOfOpenings"),
  CONSTRAINT "HrVacancy_dates_check" CHECK ("applicationDeadline" IS NULL OR "opensAt" IS NULL OR "applicationDeadline" > "opensAt"),
  CONSTRAINT "HrVacancy_salary_check" CHECK ("salaryMinimum" IS NULL OR "salaryMaximum" IS NULL OR "salaryMaximum" >= "salaryMinimum")
);

CREATE TABLE "HrVacancyNumberSequence" (
  "organizationId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "lastValue" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrVacancyNumberSequence_pkey" PRIMARY KEY ("organizationId","year")
);

CREATE TABLE "HrVacancyApproval" (
  "id" TEXT NOT NULL,
  "vacancyId" TEXT NOT NULL,
  "vacancyVersion" INTEGER NOT NULL,
  "step" INTEGER NOT NULL,
  "decision" "HrVacancyApprovalDecision" NOT NULL,
  "comments" TEXT,
  "approverId" TEXT NOT NULL,
  "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrVacancyApproval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HrVacancyHistory" (
  "id" TEXT NOT NULL,
  "vacancyId" TEXT NOT NULL,
  "previousState" "HrVacancyStatus",
  "newState" "HrVacancyStatus" NOT NULL,
  "actorId" TEXT,
  "reason" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrVacancyHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HrVacancy_vacancyNumber_key" ON "HrVacancy"("vacancyNumber");
CREATE UNIQUE INDEX "HrVacancy_publicSlug_key" ON "HrVacancy"("publicSlug");
CREATE INDEX "HrVacancy_organizationId_status_updatedAt_idx" ON "HrVacancy"("organizationId","status","updatedAt");
CREATE INDEX "HrVacancy_hiringTeamId_status_idx" ON "HrVacancy"("hiringTeamId","status");
CREATE INDEX "HrVacancy_departmentId_status_idx" ON "HrVacancy"("departmentId","status");
CREATE INDEX "HrVacancy_status_careersVisible_publishedAt_applicationDeadline_idx" ON "HrVacancy"("status","careersVisible","publishedAt","applicationDeadline");
CREATE UNIQUE INDEX "HrVacancyApproval_vacancyId_vacancyVersion_step_key" ON "HrVacancyApproval"("vacancyId","vacancyVersion","step");
CREATE INDEX "HrVacancyApproval_approverId_decidedAt_idx" ON "HrVacancyApproval"("approverId","decidedAt");
CREATE INDEX "HrVacancyHistory_vacancyId_createdAt_idx" ON "HrVacancyHistory"("vacancyId","createdAt");
CREATE INDEX "HrVacancyHistory_correlationId_idx" ON "HrVacancyHistory"("correlationId");

ALTER TABLE "HrVacancy" ADD CONSTRAINT "HrVacancy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrVacancy" ADD CONSTRAINT "HrVacancy_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "HrDepartment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrVacancy" ADD CONSTRAINT "HrVacancy_hiringTeamId_fkey" FOREIGN KEY ("hiringTeamId") REFERENCES "HrHiringTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrVacancy" ADD CONSTRAINT "HrVacancy_responsibleHrTeamId_fkey" FOREIGN KEY ("responsibleHrTeamId") REFERENCES "HrHiringTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrVacancy" ADD CONSTRAINT "HrVacancy_vacancyOwnerId_fkey" FOREIGN KEY ("vacancyOwnerId") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrVacancy" ADD CONSTRAINT "HrVacancy_hiringManagerId_fkey" FOREIGN KEY ("hiringManagerId") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrVacancy" ADD CONSTRAINT "HrVacancy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrVacancy" ADD CONSTRAINT "HrVacancy_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrVacancyNumberSequence" ADD CONSTRAINT "HrVacancyNumberSequence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrVacancyApproval" ADD CONSTRAINT "HrVacancyApproval_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "HrVacancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HrVacancyApproval" ADD CONSTRAINT "HrVacancyApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrVacancyHistory" ADD CONSTRAINT "HrVacancyHistory_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "HrVacancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HrVacancyHistory" ADD CONSTRAINT "HrVacancyHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "HrUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
