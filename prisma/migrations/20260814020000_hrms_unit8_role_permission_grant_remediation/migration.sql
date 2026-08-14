-- Remediate grants that could not observe permissions inserted by the sibling
-- data-modifying CTE in the prior migration's single PostgreSQL statement.
WITH grants("roleKey", "permissionKey") AS (
  VALUES
    ('COMPENSATION_ADMIN'::"HrRoleKey", 'compensation.budget.read'),
    ('COMPENSATION_ADMIN'::"HrRoleKey", 'compensation.exception.review'),
    ('COMPENSATION_ADMIN'::"HrRoleKey", 'compensation.read_all'),
    ('COMPENSATION_ADMIN'::"HrRoleKey", 'compensation.bonus.manage'),
    ('COMPENSATION_ADMIN'::"HrRoleKey", 'compensation.retroactive.manage'),
    ('BUDGET_OWNER'::"HrRoleKey", 'compensation.budget.read'),
    ('BUDGET_OWNER'::"HrRoleKey", 'compensation.budget.manage'),
    ('BUDGET_OWNER'::"HrRoleKey", 'compensation.recommendation.review')
)
INSERT INTO "HrPermission" ("id", "organizationId", "key", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || o."id" || g."permissionKey"),
       o."id", g."permissionKey", CURRENT_TIMESTAMP
FROM "HrOrganization" o CROSS JOIN (SELECT DISTINCT "permissionKey" FROM grants) g
ON CONFLICT ("organizationId", "key") DO NOTHING;

WITH grants("roleKey", "permissionKey") AS (
  VALUES
    ('COMPENSATION_ADMIN'::"HrRoleKey", 'compensation.budget.read'),
    ('COMPENSATION_ADMIN'::"HrRoleKey", 'compensation.exception.review'),
    ('COMPENSATION_ADMIN'::"HrRoleKey", 'compensation.read_all'),
    ('COMPENSATION_ADMIN'::"HrRoleKey", 'compensation.bonus.manage'),
    ('COMPENSATION_ADMIN'::"HrRoleKey", 'compensation.retroactive.manage'),
    ('BUDGET_OWNER'::"HrRoleKey", 'compensation.budget.read'),
    ('BUDGET_OWNER'::"HrRoleKey", 'compensation.budget.manage'),
    ('BUDGET_OWNER'::"HrRoleKey", 'compensation.recommendation.review')
)
INSERT INTO "HrRolePermission" ("id", "roleId", "permissionId", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || r."id" || p."id"),
       r."id", p."id", CURRENT_TIMESTAMP
FROM grants g
JOIN "HrRole" r ON r."key" = g."roleKey"
JOIN "HrPermission" p ON p."organizationId" = r."organizationId" AND p."key" = g."permissionKey"
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
