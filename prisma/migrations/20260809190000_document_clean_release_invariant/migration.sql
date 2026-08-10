-- Reconcile legacy/manual clean results with the explicit release invariant.
-- These versions were already downloadable under the prior CLEAN-only policy.
ALTER TABLE "HrEmployeeDocumentVersion"
DISABLE TRIGGER "HrEmployeeDocumentVersion_protected_update";

UPDATE "HrEmployeeDocumentVersion"
SET "releasedAt" = COALESCE("scanCompletedAt", "uploadedAt")
WHERE "scanStatus" = 'CLEAN'
  AND "releasedAt" IS NULL;

ALTER TABLE "HrEmployeeDocumentVersion"
ENABLE TRIGGER "HrEmployeeDocumentVersion_protected_update";
