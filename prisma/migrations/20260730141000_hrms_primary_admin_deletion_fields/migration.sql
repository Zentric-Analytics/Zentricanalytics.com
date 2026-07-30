ALTER TABLE "HrUser"
  ADD COLUMN "isPrimaryAdmin" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "deletedById" TEXT;

-- Existing organizations receive exactly one primary administrator: the
-- earliest active user holding the system ADMIN role.
WITH ranked_admins AS (
  SELECT
    u."id",
    row_number() OVER (
      PARTITION BY u."organizationId"
      ORDER BY u."createdAt" ASC, u."id" ASC
    ) AS ordinal
  FROM "HrUser" u
  JOIN "HrUserRole" ur ON ur."userId" = u."id" AND ur."revokedAt" IS NULL
  JOIN "HrRole" r ON r."id" = ur."roleId" AND r."key" = 'ADMIN'
  WHERE u."status" = 'ACTIVE'
)
UPDATE "HrUser"
SET "isPrimaryAdmin" = true
FROM ranked_admins
WHERE "HrUser"."id" = ranked_admins."id"
  AND ranked_admins.ordinal = 1;

CREATE UNIQUE INDEX "HrUser_one_primary_admin_per_organization"
  ON "HrUser" ("organizationId")
  WHERE "isPrimaryAdmin" = true;

ALTER TABLE "HrUser"
  ADD CONSTRAINT "HrUser_primary_admin_not_deleted"
  CHECK (NOT "isPrimaryAdmin" OR "status" <> 'DELETED');
