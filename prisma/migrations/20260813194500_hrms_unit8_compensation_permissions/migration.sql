WITH role_seed("key", "name", "description") AS (
  VALUES
    ('COMPENSATION_ADMIN'::"HrRoleKey", 'Compensation Administrator', 'Governed compensation architecture, cycle, budget, decision and reward authority.'),
    ('BUDGET_OWNER'::"HrRoleKey", 'Compensation Budget Owner', 'Scoped compensation budget and decision approval authority.'),
    ('PAYROLL_READER'::"HrRoleKey", 'Payroll Compensation Reader', 'Read-only access to approved payroll-authoritative compensation handoffs.')
)
INSERT INTO "HrRole" ("id","organizationId","key","name","description","system","createdAt","updatedAt")
SELECT md5(random()::text || clock_timestamp()::text || o."id" || r."key"::text), o."id", r."key", r."name", r."description", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "HrOrganization" o CROSS JOIN role_seed r
ON CONFLICT ("organizationId","key") DO NOTHING;

WITH permission_keys("key") AS (
  VALUES
    ('compensation.read_self'), ('compensation.read_team'), ('compensation.read_scoped'),
    ('compensation.architecture.manage'), ('compensation.cycle.manage'),
    ('compensation.budget.manage'), ('compensation.budget.approve'),
    ('compensation.recommendation.create'), ('compensation.recommendation.review'),
    ('compensation.calibration.manage'), ('compensation.exception.approve'), ('compensation.decision.approve'),
    ('compensation.reward.manage'), ('compensation.statement.read'), ('compensation.report.read'),
    ('compensation.payroll_handoff.read'), ('compensation.audit.read')
)
INSERT INTO "HrPermission" ("id","organizationId","key","createdAt")
SELECT md5(random()::text || clock_timestamp()::text || o."id" || p."key"), o."id", p."key", CURRENT_TIMESTAMP
FROM "HrOrganization" o CROSS JOIN permission_keys p
ON CONFLICT ("organizationId","key") DO NOTHING;

WITH comp_keys("key") AS (
  VALUES
    ('compensation.read_self'), ('compensation.read_team'), ('compensation.read_scoped'),
    ('compensation.architecture.manage'), ('compensation.cycle.manage'), ('compensation.budget.manage'), ('compensation.budget.approve'),
    ('compensation.recommendation.create'), ('compensation.recommendation.review'), ('compensation.calibration.manage'),
    ('compensation.exception.approve'), ('compensation.decision.approve'), ('compensation.reward.manage'),
    ('compensation.statement.read'), ('compensation.report.read'), ('compensation.payroll_handoff.read'), ('compensation.audit.read')
), employee_keys("key") AS (VALUES ('compensation.read_self'), ('compensation.statement.read')),
budget_keys("key") AS (VALUES ('compensation.read_scoped'), ('compensation.budget.approve'), ('compensation.decision.approve'), ('compensation.report.read')),
payroll_keys("key") AS (VALUES ('compensation.read_scoped'), ('compensation.payroll_handoff.read')),
grants AS (
  SELECT r."id" AS "roleId", p."id" AS "permissionId"
  FROM "HrRole" r JOIN "HrPermission" p ON p."organizationId" = r."organizationId"
  WHERE (r."key" = 'COMPENSATION_ADMIN' AND p."key" IN (SELECT "key" FROM comp_keys))
     OR (r."key" = 'BUDGET_OWNER' AND p."key" IN (SELECT "key" FROM budget_keys))
     OR (r."key" = 'PAYROLL_READER' AND p."key" IN (SELECT "key" FROM payroll_keys))
     OR (r."key" = 'EMPLOYEE' AND p."key" IN (SELECT "key" FROM employee_keys))
     OR (r."key" = 'AUDITOR' AND p."key" = 'compensation.audit.read')
)
INSERT INTO "HrRolePermission" ("id","roleId","permissionId","createdAt")
SELECT md5(random()::text || clock_timestamp()::text || g."roleId" || g."permissionId"), g."roleId", g."permissionId", CURRENT_TIMESTAMP
FROM grants g ON CONFLICT ("roleId","permissionId") DO NOTHING;
