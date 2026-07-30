-- Reconcile positions created after the original backfill but before
-- creation-time default placement was enforced.
UPDATE "HrPosition" p SET
  "legalEntityId" = COALESCE(p."legalEntityId", le."id"),
  "businessUnitId" = COALESCE(p."businessUnitId", bu."id"),
  "divisionId" = COALESCE(p."divisionId", d."id"),
  "locationId" = COALESCE(p."locationId", l."id"),
  "costCenterId" = COALESCE(p."costCenterId", cc."id"),
  "jobProfileId" = COALESCE(p."jobProfileId", jp."id"),
  "gradeId" = COALESCE(p."gradeId", g."id")
FROM "HrLegalEntity" le,
     "HrBusinessUnit" bu,
     "HrDivision" d,
     "HrLocation" l,
     "HrCostCenter" cc,
     "HrJobProfile" jp,
     "HrGrade" g
WHERE (
    p."legalEntityId" IS NULL OR p."businessUnitId" IS NULL OR
    p."divisionId" IS NULL OR p."locationId" IS NULL OR
    p."costCenterId" IS NULL OR p."jobProfileId" IS NULL OR p."gradeId" IS NULL
  )
  AND le."organizationId" = p."organizationId" AND le."code" = 'DEFAULT'
  AND bu."organizationId" = p."organizationId" AND bu."code" = 'DEFAULT'
  AND d."organizationId" = p."organizationId" AND d."code" = 'DEFAULT'
  AND l."organizationId" = p."organizationId" AND l."code" = 'DEFAULT'
  AND cc."organizationId" = p."organizationId" AND cc."code" = 'DEFAULT'
  AND jp."organizationId" = p."organizationId" AND jp."code" = 'DEFAULT'
  AND g."organizationId" = p."organizationId" AND g."code" = 'DEFAULT';
