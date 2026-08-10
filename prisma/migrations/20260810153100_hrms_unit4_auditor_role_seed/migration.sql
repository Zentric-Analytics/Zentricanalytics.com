INSERT INTO "HrRole" ("id", "organizationId", "key", "name", "description", "system", "createdAt", "updatedAt")
SELECT 'unit4_auditor_role_' || md5(o."id"), o."id", 'AUDITOR', 'AUDITOR', 'Read-only tenant audit evidence', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "HrOrganization" o
ON CONFLICT ("organizationId", "key") DO NOTHING;

INSERT INTO "HrRolePermission" ("id", "roleId", "permissionId", "createdAt")
SELECT 'unit4_auditor_permission_' || md5(r."id" || ':' || p."id"), r."id", p."id", CURRENT_TIMESTAMP
FROM "HrRole" r
JOIN "HrPermission" p ON p."organizationId" = r."organizationId"
WHERE r."key" = 'AUDITOR' AND p."key" IN ('audit.read', 'report.read')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
