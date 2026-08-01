CREATE TYPE "HrHiringTeamStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "HrHiringTeamMembershipStatus" AS ENUM ('ACTIVE', 'ENDED');
CREATE TYPE "HrRecruitmentQueueStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "HrHiringTeam" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "departmentId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "HrHiringTeamStatus" NOT NULL DEFAULT 'ACTIVE',
  "defaultResponsibleHrTeamId" TEXT,
  "createdById" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deactivatedAt" TIMESTAMP(3),
  CONSTRAINT "HrHiringTeam_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HrHiringTeamMember" (
  "id" TEXT NOT NULL,
  "hiringTeamId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "HrHiringTeamMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "addedById" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrHiringTeamMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HrHiringTeamMemberPermission" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "permission" TEXT NOT NULL,
  "grantedById" TEXT NOT NULL,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "HrHiringTeamMemberPermission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HrDepartmentHiringTeamDefault" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "hiringTeamId" TEXT NOT NULL,
  "responsibleHrTeamId" TEXT NOT NULL,
  "configuredById" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrDepartmentHiringTeamDefault_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HrRecruitmentRoutingRule" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "departmentId" TEXT,
  "legalEntityId" TEXT,
  "locationId" TEXT,
  "employmentType" "HrEmploymentType",
  "ownerTeamId" TEXT,
  "ownerUserId" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrRecruitmentRoutingRule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HrRecruitmentRoutingRule_owner_check" CHECK ("ownerTeamId" IS NOT NULL OR "ownerUserId" IS NOT NULL)
);

CREATE TABLE "HrRecruitmentFallbackQueue" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "ownerTeamId" TEXT NOT NULL,
  "ownerUserId" TEXT,
  "status" "HrRecruitmentQueueStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdById" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrRecruitmentFallbackQueue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HrHiringTeam_organizationId_name_key" ON "HrHiringTeam"("organizationId", "name");
CREATE INDEX "HrHiringTeam_organizationId_status_name_idx" ON "HrHiringTeam"("organizationId", "status", "name");
CREATE INDEX "HrHiringTeam_departmentId_status_idx" ON "HrHiringTeam"("departmentId", "status");
CREATE UNIQUE INDEX "HrHiringTeamMember_hiringTeamId_userId_key" ON "HrHiringTeamMember"("hiringTeamId", "userId");
CREATE INDEX "HrHiringTeamMember_userId_status_idx" ON "HrHiringTeamMember"("userId", "status");
CREATE INDEX "HrHiringTeamMember_hiringTeamId_status_idx" ON "HrHiringTeamMember"("hiringTeamId", "status");
CREATE UNIQUE INDEX "HrHiringTeamMemberPermission_memberId_permission_key" ON "HrHiringTeamMemberPermission"("memberId", "permission");
CREATE INDEX "HrHiringTeamMemberPermission_permission_revokedAt_idx" ON "HrHiringTeamMemberPermission"("permission", "revokedAt");
CREATE UNIQUE INDEX "HrDepartmentHiringTeamDefault_departmentId_key" ON "HrDepartmentHiringTeamDefault"("departmentId");
CREATE INDEX "HrDepartmentHiringTeamDefault_organizationId_departmentId_idx" ON "HrDepartmentHiringTeamDefault"("organizationId", "departmentId");
CREATE INDEX "HrRecruitmentRoutingRule_organizationId_active_priority_idx" ON "HrRecruitmentRoutingRule"("organizationId", "active", "priority");
CREATE INDEX "HrRecruitmentRoutingRule_departmentId_employmentType_active_idx" ON "HrRecruitmentRoutingRule"("departmentId", "employmentType", "active");
CREATE UNIQUE INDEX "HrRecruitmentFallbackQueue_organizationId_name_key" ON "HrRecruitmentFallbackQueue"("organizationId", "name");
CREATE INDEX "HrRecruitmentFallbackQueue_organizationId_status_idx" ON "HrRecruitmentFallbackQueue"("organizationId", "status");

ALTER TABLE "HrHiringTeam" ADD CONSTRAINT "HrHiringTeam_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrHiringTeam" ADD CONSTRAINT "HrHiringTeam_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "HrDepartment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrHiringTeam" ADD CONSTRAINT "HrHiringTeam_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrHiringTeam" ADD CONSTRAINT "HrHiringTeam_defaultResponsibleHrTeamId_fkey" FOREIGN KEY ("defaultResponsibleHrTeamId") REFERENCES "HrHiringTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrHiringTeamMember" ADD CONSTRAINT "HrHiringTeamMember_hiringTeamId_fkey" FOREIGN KEY ("hiringTeamId") REFERENCES "HrHiringTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HrHiringTeamMember" ADD CONSTRAINT "HrHiringTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrHiringTeamMember" ADD CONSTRAINT "HrHiringTeamMember_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrHiringTeamMemberPermission" ADD CONSTRAINT "HrHiringTeamMemberPermission_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "HrHiringTeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HrHiringTeamMemberPermission" ADD CONSTRAINT "HrHiringTeamMemberPermission_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrDepartmentHiringTeamDefault" ADD CONSTRAINT "HrDepartmentHiringTeamDefault_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrDepartmentHiringTeamDefault" ADD CONSTRAINT "HrDepartmentHiringTeamDefault_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "HrDepartment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrDepartmentHiringTeamDefault" ADD CONSTRAINT "HrDepartmentHiringTeamDefault_hiringTeamId_fkey" FOREIGN KEY ("hiringTeamId") REFERENCES "HrHiringTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrDepartmentHiringTeamDefault" ADD CONSTRAINT "HrDepartmentHiringTeamDefault_responsibleHrTeamId_fkey" FOREIGN KEY ("responsibleHrTeamId") REFERENCES "HrHiringTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrDepartmentHiringTeamDefault" ADD CONSTRAINT "HrDepartmentHiringTeamDefault_configuredById_fkey" FOREIGN KEY ("configuredById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrRecruitmentRoutingRule" ADD CONSTRAINT "HrRecruitmentRoutingRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrRecruitmentRoutingRule" ADD CONSTRAINT "HrRecruitmentRoutingRule_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "HrDepartment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrRecruitmentRoutingRule" ADD CONSTRAINT "HrRecruitmentRoutingRule_ownerTeamId_fkey" FOREIGN KEY ("ownerTeamId") REFERENCES "HrHiringTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrRecruitmentRoutingRule" ADD CONSTRAINT "HrRecruitmentRoutingRule_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrRecruitmentRoutingRule" ADD CONSTRAINT "HrRecruitmentRoutingRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrRecruitmentFallbackQueue" ADD CONSTRAINT "HrRecruitmentFallbackQueue_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrRecruitmentFallbackQueue" ADD CONSTRAINT "HrRecruitmentFallbackQueue_ownerTeamId_fkey" FOREIGN KEY ("ownerTeamId") REFERENCES "HrHiringTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrRecruitmentFallbackQueue" ADD CONSTRAINT "HrRecruitmentFallbackQueue_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrRecruitmentFallbackQueue" ADD CONSTRAINT "HrRecruitmentFallbackQueue_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

WITH permission_keys("key") AS (
  VALUES
  ('hiring_team.manage'), ('hiring_team.create'), ('hiring_team.view'), ('hiring_team.update'),
  ('hiring_team.manage_members'), ('hiring_team.manage_permissions'), ('hiring_team.deactivate'),
  ('vacancy.create'), ('vacancy.view'), ('vacancy.edit'), ('vacancy.submit'), ('vacancy.approve'),
  ('vacancy.publish'), ('vacancy.pause'), ('vacancy.close'), ('vacancy.cancel'), ('vacancy.fill'),
  ('vacancy.reassign'), ('application.view'), ('application.review'), ('application.request_information'),
  ('application.shortlist'), ('application.reject'), ('application.hold'), ('interview.schedule'),
  ('interview.reschedule'), ('interview.cancel'), ('interview.feedback.submit'), ('interview.feedback.view'),
  ('assessment.create'), ('assessment.evaluate'), ('offer.create'), ('offer.edit'), ('offer.submit'),
  ('offer.approve'), ('offer.issue'), ('offer.cancel'), ('handover.view'), ('handover.review'),
  ('handover.request_information'), ('handover.return'), ('handover.approve'), ('handover.cancel'),
  ('document.verify'), ('document.reject'), ('document.request_replacement'), ('employee.prehire.create'),
  ('employee.activate'), ('onboarding.view'), ('onboarding.manage'), ('onboarding.complete_task'),
  ('onboarding.override'), ('recruitment.admin')
)
INSERT INTO "HrPermission" ("id", "organizationId", "key", "createdAt")
SELECT 'u3perm_' || substr(md5(o."id" || ':' || p."key"), 1, 20), o."id", p."key", CURRENT_TIMESTAMP
FROM "HrOrganization" o CROSS JOIN permission_keys p
ON CONFLICT ("organizationId", "key") DO NOTHING;

INSERT INTO "HrRolePermission" ("id", "roleId", "permissionId", "createdAt")
SELECT 'u3rp_' || substr(md5(r."id" || ':' || p."id"), 1, 20), r."id", p."id", CURRENT_TIMESTAMP
FROM "HrRole" r JOIN "HrPermission" p ON p."organizationId" = r."organizationId"
WHERE r."key" IN ('ADMIN', 'HR_ADMIN') AND (
  p."key" LIKE 'hiring_team.%' OR p."key" LIKE 'vacancy.%' OR p."key" LIKE 'application.%'
  OR p."key" LIKE 'interview.%' OR p."key" LIKE 'assessment.%' OR p."key" LIKE 'offer.%'
  OR p."key" LIKE 'handover.%' OR p."key" IN ('document.verify', 'document.reject', 'document.request_replacement',
  'employee.prehire.create', 'employee.activate', 'onboarding.view', 'onboarding.manage',
  'onboarding.complete_task', 'onboarding.override', 'recruitment.admin')
)
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
