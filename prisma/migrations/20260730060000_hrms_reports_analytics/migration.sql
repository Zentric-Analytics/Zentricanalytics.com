-- Reporting is read-only over existing normalized data; this migration grants its
-- granular permissions to existing initialized organizations.
ALTER TABLE "JobApplication" ADD COLUMN "organizationId" TEXT;
UPDATE "JobApplication" application
SET "organizationId" = organization."id"
FROM "HrOrganization" organization
WHERE organization."slug" = 'zentric-analytics' AND application."organizationId" IS NULL;
CREATE INDEX "JobApplication_organizationId_status_createdAt_idx" ON "JobApplication"("organizationId", "status", "createdAt");
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "HrPermission" ("id", "organizationId", "key", "createdAt")
SELECT 'perm_' || md5(random()::text || o."id" || permission_key), o."id", permission_key, CURRENT_TIMESTAMP
FROM "HrOrganization" o
CROSS JOIN (VALUES ('report.read'), ('report.export')) AS permissions(permission_key)
ON CONFLICT ("organizationId", "key") DO NOTHING;

INSERT INTO "HrRolePermission" ("id", "roleId", "permissionId", "createdAt")
SELECT 'rp_' || md5(random()::text || r."id" || p."id"), r."id", p."id", CURRENT_TIMESTAMP
FROM "HrRole" r
JOIN "HrPermission" p ON p."organizationId" = r."organizationId" AND p."key" IN ('report.read', 'report.export')
WHERE r."key" IN ('ADMIN', 'HR_ADMIN', 'PAYROLL_ADMIN')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
