-- Preserve existing human attribution, while representing scheduled actions honestly.
ALTER TABLE "HrEmployeeStatusHistory"
  ALTER COLUMN "changedById" DROP NOT NULL,
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'USER';

ALTER TABLE "HrEmployeeStatusHistory"
  ADD CONSTRAINT "HrEmployeeStatusHistory_actor_source_check" CHECK (
    ("source" = 'USER' AND "changedById" IS NOT NULL)
    OR ("source" = 'SCHEDULED_JOB' AND "changedById" IS NULL)
  );
