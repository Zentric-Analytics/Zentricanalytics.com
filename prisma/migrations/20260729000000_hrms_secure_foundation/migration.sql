-- CreateEnum
CREATE TYPE "HrRoleKey" AS ENUM ('ADMIN', 'HR_ADMIN', 'PAYROLL_ADMIN', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "HrUserStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "HrTokenStatus" AS ENUM ('ACTIVE', 'USED', 'REVOKED');

-- CreateEnum
CREATE TYPE "HrAssignmentStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "HrSupervisorAssignmentType" AS ENUM ('DIRECT_REPORT', 'DEPARTMENT', 'TEAM', 'WORKFLOW');

-- CreateEnum
CREATE TYPE "HrOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED', 'ABANDONED');

-- CreateTable
CREATE TABLE "HrOrganization" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "taxIdentificationNumber" TEXT,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'NGN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrOrganization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrUser" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "status" "HrUserStatus" NOT NULL DEFAULT 'INVITED',
    "emailVerifiedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecretEncrypted" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrRole" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" "HrRoleKey" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "system" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPermission" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrUserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedById" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "HrUserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrRolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrRolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrAccountInvitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "HrTokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrAccountInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "HrTokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrPasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrLoginAttempt" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "emailHash" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "succeeded" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrLoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrEmployee" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "employeeNumber" TEXT NOT NULL,
    "legalFirstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "preferredName" TEXT,
    "companyEmail" TEXT,
    "personalEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrSupervisorAssignment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supervisorEmployeeId" TEXT NOT NULL,
    "assignedEmployeeId" TEXT,
    "departmentScopeId" TEXT,
    "assignmentType" "HrSupervisorAssignmentType" NOT NULL,
    "status" "HrAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "capabilities" JSONB NOT NULL,
    "assignedByUserId" TEXT NOT NULL,
    "endedByUserId" TEXT,
    "reason" TEXT NOT NULL,
    "endReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "HrSupervisorAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrAuditEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorRole" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "action" TEXT NOT NULL,
    "previousValues" JSONB,
    "newValues" JSONB,
    "reason" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrEmailOutbox" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "HrOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "provider" TEXT,
    "providerMessageId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "HrEmailOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrEmailDeliveryAttempt" (
    "id" TEXT NOT NULL,
    "outboxId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" "HrOutboxStatus" NOT NULL,
    "provider" TEXT,
    "providerMessageId" TEXT,
    "safeError" TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrEmailDeliveryAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrOrganizationSetting" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrOrganizationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HrOrganization_slug_key" ON "HrOrganization"("slug");

-- CreateIndex
CREATE INDEX "HrUser_organizationId_status_idx" ON "HrUser"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HrUser_organizationId_email_key" ON "HrUser"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "HrRole_organizationId_key_key" ON "HrRole"("organizationId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "HrPermission_organizationId_key_key" ON "HrPermission"("organizationId", "key");

-- CreateIndex
CREATE INDEX "HrUserRole_roleId_revokedAt_idx" ON "HrUserRole"("roleId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrUserRole_userId_roleId_key" ON "HrUserRole"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "HrRolePermission_roleId_permissionId_key" ON "HrRolePermission"("roleId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "HrSession_tokenHash_key" ON "HrSession"("tokenHash");

-- CreateIndex
CREATE INDEX "HrSession_userId_expiresAt_revokedAt_idx" ON "HrSession"("userId", "expiresAt", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrAccountInvitation_tokenHash_key" ON "HrAccountInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "HrAccountInvitation_organizationId_userId_status_expiresAt_idx" ON "HrAccountInvitation"("organizationId", "userId", "status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrPasswordResetToken_tokenHash_key" ON "HrPasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "HrPasswordResetToken_userId_status_expiresAt_idx" ON "HrPasswordResetToken"("userId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "HrLoginAttempt_organizationId_emailHash_ipHash_createdAt_idx" ON "HrLoginAttempt"("organizationId", "emailHash", "ipHash", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrEmployee_userId_key" ON "HrEmployee"("userId");

-- CreateIndex
CREATE INDEX "HrEmployee_organizationId_lastName_legalFirstName_idx" ON "HrEmployee"("organizationId", "lastName", "legalFirstName");

-- CreateIndex
CREATE UNIQUE INDEX "HrEmployee_organizationId_employeeNumber_key" ON "HrEmployee"("organizationId", "employeeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "HrEmployee_organizationId_companyEmail_key" ON "HrEmployee"("organizationId", "companyEmail");

-- CreateIndex
CREATE INDEX "HrSupervisorAssignment_organizationId_supervisorEmployeeId__idx" ON "HrSupervisorAssignment"("organizationId", "supervisorEmployeeId", "status", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "HrSupervisorAssignment_organizationId_assignedEmployeeId_st_idx" ON "HrSupervisorAssignment"("organizationId", "assignedEmployeeId", "status");

-- CreateIndex
CREATE INDEX "HrAuditEvent_organizationId_entityType_entityId_createdAt_idx" ON "HrAuditEvent"("organizationId", "entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "HrAuditEvent_organizationId_actorUserId_createdAt_idx" ON "HrAuditEvent"("organizationId", "actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "HrAuditEvent_correlationId_idx" ON "HrAuditEvent"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "HrEmailOutbox_idempotencyKey_key" ON "HrEmailOutbox"("idempotencyKey");

-- CreateIndex
CREATE INDEX "HrEmailOutbox_status_nextAttemptAt_idx" ON "HrEmailOutbox"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "HrEmailOutbox_organizationId_createdAt_idx" ON "HrEmailOutbox"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrEmailDeliveryAttempt_outboxId_attemptNumber_key" ON "HrEmailDeliveryAttempt"("outboxId", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "HrOrganizationSetting_organizationId_key_key" ON "HrOrganizationSetting"("organizationId", "key");

-- AddForeignKey
ALTER TABLE "HrUser" ADD CONSTRAINT "HrUser_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrRole" ADD CONSTRAINT "HrRole_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrPermission" ADD CONSTRAINT "HrPermission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrUserRole" ADD CONSTRAINT "HrUserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "HrUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrUserRole" ADD CONSTRAINT "HrUserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "HrRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrRolePermission" ADD CONSTRAINT "HrRolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "HrRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrRolePermission" ADD CONSTRAINT "HrRolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "HrPermission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrSession" ADD CONSTRAINT "HrSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "HrUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrAccountInvitation" ADD CONSTRAINT "HrAccountInvitation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "HrUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrAccountInvitation" ADD CONSTRAINT "HrAccountInvitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrPasswordResetToken" ADD CONSTRAINT "HrPasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "HrUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrLoginAttempt" ADD CONSTRAINT "HrLoginAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "HrUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrEmployee" ADD CONSTRAINT "HrEmployee_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrEmployee" ADD CONSTRAINT "HrEmployee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "HrUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrSupervisorAssignment" ADD CONSTRAINT "HrSupervisorAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrSupervisorAssignment" ADD CONSTRAINT "HrSupervisorAssignment_supervisorEmployeeId_fkey" FOREIGN KEY ("supervisorEmployeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrSupervisorAssignment" ADD CONSTRAINT "HrSupervisorAssignment_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrSupervisorAssignment" ADD CONSTRAINT "HrSupervisorAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrSupervisorAssignment" ADD CONSTRAINT "HrSupervisorAssignment_endedByUserId_fkey" FOREIGN KEY ("endedByUserId") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrAuditEvent" ADD CONSTRAINT "HrAuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrAuditEvent" ADD CONSTRAINT "HrAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "HrUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrEmailOutbox" ADD CONSTRAINT "HrEmailOutbox_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrEmailDeliveryAttempt" ADD CONSTRAINT "HrEmailDeliveryAttempt_outboxId_fkey" FOREIGN KEY ("outboxId") REFERENCES "HrEmailOutbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrOrganizationSetting" ADD CONSTRAINT "HrOrganizationSetting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
