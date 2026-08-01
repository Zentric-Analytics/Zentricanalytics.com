-- Forward-only reconciliation for environments that applied Unit 2 before its
-- compatibility backfill was added. Every statement is deterministic and
-- idempotent so fresh and previously migrated environments converge.

INSERT INTO "HrLegalEntity" ("id","organizationId","code","name","registeredName","countryCode","registrationNumber","defaultCurrency","timezone","status","effectiveFrom","createdAt","updatedAt")
SELECT 'c'||substr(md5(o."id"||':legal-entity'),1,24), o."id", 'DEFAULT', o."name", o."name", 'NG', o."registrationNumber", o."defaultCurrency", 'Africa/Lagos', 'ACTIVE', o."createdAt", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "HrOrganization" o ON CONFLICT ("organizationId","code") DO NOTHING;

INSERT INTO "HrBusinessUnit" ("id","organizationId","legalEntityId","code","name","description","status","effectiveFrom","createdAt","updatedAt")
SELECT 'c'||substr(md5(o."id"||':business-unit'),1,24), o."id", le."id", 'DEFAULT', o."name", 'Compatibility business unit for legacy records', 'ACTIVE', o."createdAt", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "HrOrganization" o
JOIN "HrLegalEntity" le ON le."organizationId" = o."id" AND le."code" = 'DEFAULT'
ON CONFLICT ("organizationId","code") DO NOTHING;

INSERT INTO "HrDivision" ("id","organizationId","businessUnitId","code","name","status","effectiveFrom","createdAt","updatedAt")
SELECT 'c'||substr(md5(o."id"||':division'),1,24), o."id", bu."id", 'DEFAULT', 'General', 'ACTIVE', o."createdAt", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "HrOrganization" o
JOIN "HrBusinessUnit" bu ON bu."organizationId" = o."id" AND bu."code" = 'DEFAULT'
ON CONFLICT ("organizationId","code") DO NOTHING;

INSERT INTO "HrLocation" ("id","organizationId","legalEntityId","code","name","locationType","countryCode","timezone","workMode","status","effectiveFrom","createdAt","updatedAt")
SELECT 'c'||substr(md5(o."id"||':location'),1,24), o."id", le."id", 'DEFAULT', 'Primary Location', 'HEAD_OFFICE', 'NG', 'Africa/Lagos', 'HYBRID', 'ACTIVE', o."createdAt", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "HrOrganization" o
JOIN "HrLegalEntity" le ON le."organizationId" = o."id" AND le."code" = 'DEFAULT'
ON CONFLICT ("organizationId","code") DO NOTHING;

INSERT INTO "HrCostCenter" ("id","organizationId","legalEntityId","code","name","currency","status","effectiveFrom","createdAt","updatedAt")
SELECT 'c'||substr(md5(o."id"||':cost-center'),1,24), o."id", le."id", 'DEFAULT', 'General', o."defaultCurrency", 'ACTIVE', o."createdAt", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "HrOrganization" o
JOIN "HrLegalEntity" le ON le."organizationId" = o."id" AND le."code" = 'DEFAULT'
ON CONFLICT ("organizationId","code") DO NOTHING;

INSERT INTO "HrJobFamily" ("id","organizationId","code","name","description","status","createdAt","updatedAt")
SELECT 'c'||substr(md5(o."id"||':job-family'),1,24), o."id", 'DEFAULT', 'General', 'Compatibility job family for legacy positions', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "HrOrganization" o ON CONFLICT ("organizationId","code") DO NOTHING;

INSERT INTO "HrGrade" ("id","organizationId","code","name","level","currency","status","createdAt","updatedAt")
SELECT 'c'||substr(md5(o."id"||':grade'),1,24), o."id", 'DEFAULT', 'Unclassified', 1, o."defaultCurrency", 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "HrOrganization" o ON CONFLICT ("organizationId","code") DO NOTHING;

INSERT INTO "HrJobProfile" ("id","organizationId","jobFamilyId","code","title","description","standardGradeId","status","createdAt","updatedAt")
SELECT 'c'||substr(md5(o."id"||':job-profile'),1,24), o."id", jf."id", 'DEFAULT', 'Unclassified Role', 'Compatibility job profile for legacy positions', g."id", 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "HrOrganization" o
JOIN "HrJobFamily" jf ON jf."organizationId" = o."id" AND jf."code" = 'DEFAULT'
JOIN "HrGrade" g ON g."organizationId" = o."id" AND g."code" = 'DEFAULT'
ON CONFLICT ("organizationId","code") DO NOTHING;

UPDATE "HrPosition" p SET
  "legalEntityId" = le."id",
  "businessUnitId" = bu."id",
  "divisionId" = d."id",
  "locationId" = l."id",
  "costCenterId" = cc."id",
  "jobProfileId" = jp."id",
  "gradeId" = g."id"
FROM "HrLegalEntity" le, "HrBusinessUnit" bu, "HrDivision" d, "HrLocation" l, "HrCostCenter" cc, "HrJobProfile" jp, "HrGrade" g
WHERE p."legalEntityId" IS NULL
  AND le."organizationId" = p."organizationId" AND le."code" = 'DEFAULT'
  AND bu."organizationId" = p."organizationId" AND bu."code" = 'DEFAULT'
  AND d."organizationId" = p."organizationId" AND d."code" = 'DEFAULT'
  AND l."organizationId" = p."organizationId" AND l."code" = 'DEFAULT'
  AND cc."organizationId" = p."organizationId" AND cc."code" = 'DEFAULT'
  AND jp."organizationId" = p."organizationId" AND jp."code" = 'DEFAULT'
  AND g."organizationId" = p."organizationId" AND g."code" = 'DEFAULT';

UPDATE "HrEmployeeAssignment" a SET
  "legalEntityId" = le."id",
  "businessUnitId" = bu."id",
  "divisionId" = d."id",
  "locationId" = l."id",
  "costCenterId" = cc."id",
  "placementSnapshot" = jsonb_build_object('migration','unit-02-default-backfill','departmentId',a."departmentId",'positionId',a."positionId")
FROM "HrLegalEntity" le, "HrBusinessUnit" bu, "HrDivision" d, "HrLocation" l, "HrCostCenter" cc
WHERE a."legalEntityId" IS NULL
  AND le."organizationId" = a."organizationId" AND le."code" = 'DEFAULT'
  AND bu."organizationId" = a."organizationId" AND bu."code" = 'DEFAULT'
  AND d."organizationId" = a."organizationId" AND d."code" = 'DEFAULT'
  AND l."organizationId" = a."organizationId" AND l."code" = 'DEFAULT'
  AND cc."organizationId" = a."organizationId" AND cc."code" = 'DEFAULT';

UPDATE "HrPosition" p SET "lifecycleStatus" =
  CASE WHEN EXISTS (
    SELECT 1 FROM "HrEmployeeAssignment" a
    WHERE a."positionId" = p."id" AND a."status" = 'ACTIVE'
      AND (a."effectiveTo" IS NULL OR a."effectiveTo" > CURRENT_TIMESTAMP)
  ) THEN 'FILLED'::"HrPositionLifecycleStatus" ELSE 'OPEN'::"HrPositionLifecycleStatus" END;
