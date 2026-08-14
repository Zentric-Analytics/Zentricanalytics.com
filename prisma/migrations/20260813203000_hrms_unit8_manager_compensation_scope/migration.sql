-- Supervisors are derived from effective HrSupervisorAssignment rows. The
-- route still intersects every query with those direct-report IDs, so this
-- permission exposes no unrelated compensation to ordinary employees.
INSERT INTO "HrRolePermission" ("id", "roleId", "permissionId", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || r."id" || p."id"), r."id", p."id", CURRENT_TIMESTAMP
FROM "HrRole" r
JOIN "HrPermission" p ON p."organizationId" = r."organizationId"
WHERE r."key" = 'EMPLOYEE'
  AND p."key" = 'compensation.recommendation.create'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
