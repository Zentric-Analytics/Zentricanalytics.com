-- Unit 2 permission reconciliation for organizations initialized before
-- organization management permissions were introduced.
WITH permission_keys("key") AS (
  VALUES
    ('organization.structure.manage'),
    ('organization.structure.import'),
    ('organization.position.create'),
    ('organization.position.approve'),
    ('organization.position.manage_state'),
    ('organization.position.fill'),
    ('organization.assignment.transfer'),
    ('organization.report.read'),
    ('organization.report.export')
)
INSERT INTO "HrPermission" ("id", "organizationId", "key", "createdAt")
SELECT
  'u2perm_' || substr(md5(o."id" || ':' || p."key"), 1, 20),
  o."id",
  p."key",
  CURRENT_TIMESTAMP
FROM "HrOrganization" o
CROSS JOIN permission_keys p
ON CONFLICT ("organizationId", "key") DO NOTHING;

-- ADMIN receives the complete Unit 2 permission set.
INSERT INTO "HrRolePermission" ("id", "roleId", "permissionId", "createdAt")
SELECT
  'u2rp_' || substr(md5(r."id" || ':' || p."id"), 1, 20),
  r."id",
  p."id",
  CURRENT_TIMESTAMP
FROM "HrRole" r
JOIN "HrPermission" p ON p."organizationId" = r."organizationId"
WHERE r."key" = 'ADMIN'
  AND p."key" LIKE 'organization.%'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- HR_ADMIN receives Unit 2 organization permissions, matching the runtime
-- permission catalog. PAYROLL_ADMIN and EMPLOYEE intentionally receive none.
INSERT INTO "HrRolePermission" ("id", "roleId", "permissionId", "createdAt")
SELECT
  'u2rp_' || substr(md5(r."id" || ':' || p."id"), 1, 20),
  r."id",
  p."id",
  CURRENT_TIMESTAMP
FROM "HrRole" r
JOIN "HrPermission" p ON p."organizationId" = r."organizationId"
WHERE r."key" = 'HR_ADMIN'
  AND p."key" LIKE 'organization.%'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
