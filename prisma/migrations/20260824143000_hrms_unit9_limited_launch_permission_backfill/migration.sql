-- Backfill Unit 9 limited-launch permissions into persisted tenant RBAC.
WITH grants("roleKey", "permissionKey") AS (
  VALUES
    ('PAYROLL_ADMIN'::"HrRoleKey", 'payroll.exception.read'),
    ('PAYROLL_ADMIN'::"HrRoleKey", 'payroll.exception.manage'),
    ('PAYROLL_ADMIN'::"HrRoleKey", 'payroll.exception.resolve'),
    ('PAYROLL_ADMIN'::"HrRoleKey", 'payroll.population_partition.approve'),
    ('PAYROLL_ADMIN'::"HrRoleKey", 'payroll.roles.assign'),
    ('PAYROLL_COMPLIANCE_ADMIN'::"HrRoleKey", 'payroll.exception.read'),
    ('PAYROLL_COMPLIANCE_ADMIN'::"HrRoleKey", 'payroll.exception.manage'),
    ('PAYROLL_COMPLIANCE_ADMIN'::"HrRoleKey", 'payroll.exception.resolve')
), inserted_permissions AS (
  INSERT INTO "HrPermission" ("id", "organizationId", "key", "createdAt")
  SELECT md5(random()::text || clock_timestamp()::text || o."id" || g."permissionKey"),
         o."id", g."permissionKey", CURRENT_TIMESTAMP
  FROM "HrOrganization" o
  CROSS JOIN (SELECT DISTINCT "permissionKey" FROM grants) g
  ON CONFLICT ("organizationId", "key") DO NOTHING
  RETURNING "id"
)
INSERT INTO "HrRolePermission" ("id", "roleId", "permissionId", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || r."id" || p."id"),
       r."id", p."id", CURRENT_TIMESTAMP
FROM grants g
JOIN "HrRole" r ON r."key" = g."roleKey"
JOIN "HrPermission" p
  ON p."organizationId" = r."organizationId"
 AND p."key" = g."permissionKey"
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
