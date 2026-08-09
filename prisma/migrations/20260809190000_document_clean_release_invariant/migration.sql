-- Reconcile legacy/manual clean results with the explicit release invariant.
-- These versions were already downloadable under the prior CLEAN-only policy.
UPDATE "HrEmployeeDocumentVersion"
SET "releasedAt" = COALESCE("scanCompletedAt", "uploadedAt")
WHERE "scanStatus" = 'CLEAN'
  AND "releasedAt" IS NULL;

