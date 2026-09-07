-- Additive: legacy team ownership and all historical records remain intact.
ALTER TABLE "HrVacancy" ADD COLUMN "responsibleHrUserId" TEXT;
ALTER TABLE "HrVacancy" ADD COLUMN "delegationVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "HrVacancy" ADD CONSTRAINT "HrVacancy_responsibleHrUserId_fkey"
  FOREIGN KEY ("responsibleHrUserId") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "HrVacancyDelegation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "vacancyId" TEXT NOT NULL,
  "delegateUserId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "endedById" TEXT,
  CONSTRAINT "HrVacancyDelegation_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "HrVacancy"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "HrVacancyDelegation_delegateUserId_fkey" FOREIGN KEY ("delegateUserId") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "HrVacancyDelegation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "HrVacancyDelegation_endedById_fkey" FOREIGN KEY ("endedById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "HrVacancyDelegation_vacancyId_endedAt_idx" ON "HrVacancyDelegation"("vacancyId", "endedAt");
CREATE INDEX "HrVacancyDelegation_delegateUserId_endedAt_idx" ON "HrVacancyDelegation"("delegateUserId", "endedAt");
CREATE UNIQUE INDEX "HrVacancyDelegation_active_delegate_key" ON "HrVacancyDelegation"("vacancyId", "delegateUserId") WHERE "endedAt" IS NULL;
