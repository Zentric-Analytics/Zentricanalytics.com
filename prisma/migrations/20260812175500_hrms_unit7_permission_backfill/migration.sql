-- Unit 7 permissions are additive. Existing installations skip bootstrap, so
-- grant the new catalog explicitly while preserving all existing assignments.
WITH permission_keys("key") AS (
  VALUES
    ('performance.goal.read_self'), ('performance.goal.manage_self'), ('performance.goal.read_team'), ('performance.goal.review_team'), ('performance.goal.read_all'), ('performance.goal.admin'),
    ('performance.feedback.create'), ('performance.feedback.read_self'), ('performance.feedback.read_team'), ('performance.feedback.read_confidential'),
    ('performance.checkin.manage_self'), ('performance.checkin.manage_team'),
    ('performance.review.submit_self'), ('performance.review.read_self'), ('performance.review.manage_team'), ('performance.review.read_all'), ('performance.review.admin'),
    ('performance.calibration.participate'), ('performance.calibration.admin'),
    ('performance.career.manage_self'), ('performance.career.read_team'), ('performance.development.manage_self'), ('performance.development.manage_team'), ('performance.development.admin'),
    ('performance.readiness.read_self'), ('performance.readiness.assess'), ('performance.promotion.recommend'), ('performance.promotion.review'), ('performance.promotion.approve'),
    ('performance.framework.manage'), ('performance.report.read'), ('performance.report.export'), ('performance.audit.read')
)
INSERT INTO "HrPermission" ("id", "organizationId", "key", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || o."id" || p."key"), o."id", p."key", CURRENT_TIMESTAMP
FROM "HrOrganization" o CROSS JOIN permission_keys p
ON CONFLICT ("organizationId", "key") DO NOTHING;

WITH unit7_keys("key") AS (
  VALUES
    ('performance.goal.read_self'), ('performance.goal.manage_self'), ('performance.goal.read_team'), ('performance.goal.review_team'), ('performance.goal.read_all'), ('performance.goal.admin'),
    ('performance.feedback.create'), ('performance.feedback.read_self'), ('performance.feedback.read_team'), ('performance.feedback.read_confidential'),
    ('performance.checkin.manage_self'), ('performance.checkin.manage_team'),
    ('performance.review.submit_self'), ('performance.review.read_self'), ('performance.review.manage_team'), ('performance.review.read_all'), ('performance.review.admin'),
    ('performance.calibration.participate'), ('performance.calibration.admin'),
    ('performance.career.manage_self'), ('performance.career.read_team'), ('performance.development.manage_self'), ('performance.development.manage_team'), ('performance.development.admin'),
    ('performance.readiness.read_self'), ('performance.readiness.assess'), ('performance.promotion.recommend'), ('performance.promotion.review'), ('performance.promotion.approve'),
    ('performance.framework.manage'), ('performance.report.read'), ('performance.report.export'), ('performance.audit.read')
), employee_keys("key") AS (
  VALUES ('performance.goal.read_self'), ('performance.goal.manage_self'), ('performance.feedback.create'), ('performance.feedback.read_self'),
    ('performance.checkin.manage_self'), ('performance.review.submit_self'), ('performance.review.read_self'), ('performance.career.manage_self'),
    ('performance.development.manage_self'), ('performance.readiness.read_self')
), grants AS (
  SELECT r."id" AS "roleId", p."id" AS "permissionId"
  FROM "HrRole" r JOIN "HrPermission" p ON p."organizationId" = r."organizationId"
  WHERE (r."key" IN ('ADMIN', 'HR_ADMIN') AND p."key" IN (SELECT "key" FROM unit7_keys))
     OR (r."key" = 'EMPLOYEE' AND p."key" IN (SELECT "key" FROM employee_keys))
)
INSERT INTO "HrRolePermission" ("id", "roleId", "permissionId", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || g."roleId" || g."permissionId"), g."roleId", g."permissionId", CURRENT_TIMESTAMP
FROM grants g
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "HrRolePermission" ("id", "roleId", "permissionId", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || r."id" || p."id"), r."id", p."id", CURRENT_TIMESTAMP
FROM "HrRole" r JOIN "HrPermission" p ON p."organizationId" = r."organizationId" AND p."key" = 'performance.audit.read'
WHERE r."key" = 'AUDITOR'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
