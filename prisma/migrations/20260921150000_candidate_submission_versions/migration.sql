-- Preserve signed/audited history: never silently renumber existing submissions.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "StageSubmission" GROUP BY "stageId", "version" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate StageSubmission versions require reviewed reconciliation before this migration. No historical rows have been changed.';
  END IF;
END $$;
CREATE UNIQUE INDEX "StageSubmission_stageId_version_key" ON "StageSubmission"("stageId", "version");
