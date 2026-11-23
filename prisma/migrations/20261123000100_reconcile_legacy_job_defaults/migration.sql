-- Restore missing legacy defaults without changing existing families, profiles,
-- or their assignments. Scope the repair to organizations with the other
-- six DEFAULT dimensions from the original compatibility backfill.
BEGIN;

CREATE TEMP TABLE legacy_job_default_organizations ON COMMIT DROP AS
SELECT grade."organizationId", grade."id" AS "gradeId"
FROM "HrGrade" grade
WHERE grade."code" = 'DEFAULT'
  AND EXISTS (SELECT 1 FROM "HrLegalEntity" x WHERE x."organizationId" = grade."organizationId" AND x."code" = 'DEFAULT')
  AND EXISTS (SELECT 1 FROM "HrBusinessUnit" x WHERE x."organizationId" = grade."organizationId" AND x."code" = 'DEFAULT')
  AND EXISTS (SELECT 1 FROM "HrDivision" x WHERE x."organizationId" = grade."organizationId" AND x."code" = 'DEFAULT')
  AND EXISTS (SELECT 1 FROM "HrLocation" x WHERE x."organizationId" = grade."organizationId" AND x."code" = 'DEFAULT')
  AND EXISTS (SELECT 1 FROM "HrCostCenter" x WHERE x."organizationId" = grade."organizationId" AND x."code" = 'DEFAULT');

INSERT INTO "HrJobFamily" ("id", "organizationId", "code", "name", "description", "status", "createdAt", "updatedAt")
SELECT 'c' || substr(md5(o."organizationId" || ':legacy-job-family-repair'), 1, 24),
       o."organizationId", 'DEFAULT', 'General', 'Compatibility job family for legacy positions',
       'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM legacy_job_default_organizations o
ON CONFLICT ("organizationId", "code") DO NOTHING;

INSERT INTO "HrJobProfile" ("id", "organizationId", "jobFamilyId", "code", "title", "description", "standardGradeId", "status", "createdAt", "updatedAt")
SELECT 'c' || substr(md5(o."organizationId" || ':legacy-job-profile-repair'), 1, 24),
       o."organizationId", family."id", 'DEFAULT', 'Unclassified Role',
       'Compatibility job profile for legacy positions', o."gradeId", 'ACTIVE',
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM legacy_job_default_organizations o
JOIN "HrJobFamily" family ON family."organizationId" = o."organizationId" AND family."code" = 'DEFAULT'
ON CONFLICT ("organizationId", "code") DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM legacy_job_default_organizations o
    WHERE NOT EXISTS (
      SELECT 1 FROM "HrJobProfile" p WHERE p."organizationId" = o."organizationId" AND p."code" = 'DEFAULT'
    )
  ) THEN
    RAISE EXCEPTION 'Legacy job profile reconciliation is incomplete. Verify organization defaults.';
  END IF;
END
$$;

COMMIT;
