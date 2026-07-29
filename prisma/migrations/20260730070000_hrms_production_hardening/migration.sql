ALTER TABLE "HrUser" ADD COLUMN "mfaLastUsedStep" BIGINT;
ALTER TABLE "HrUser"
  ADD CONSTRAINT "HrUser_mfa_secret_check" CHECK (
    ("mfaEnabled" AND "mfaSecretEncrypted" IS NOT NULL)
    OR (NOT "mfaEnabled" AND "mfaLastUsedStep" IS NULL)
  );

ALTER TABLE "HrEmailOutbox"
  ADD CONSTRAINT "HrEmailOutbox_attempt_count_check" CHECK ("attemptCount" >= 0 AND "attemptCount" <= 100);

CREATE INDEX "HrLoginAttempt_succeeded_createdAt_idx" ON "HrLoginAttempt"("succeeded", "createdAt");
CREATE INDEX "HrEmployeeDocumentVersion_scanStatus_uploadedAt_idx" ON "HrEmployeeDocumentVersion"("scanStatus", "uploadedAt");
CREATE INDEX "HrEmailOutbox_status_createdAt_idx" ON "HrEmailOutbox"("status", "createdAt");

CREATE OR REPLACE FUNCTION hr_prevent_delivery_attempt_mutation() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'Email delivery attempts are immutable'; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "HrEmailDeliveryAttempt_immutable"
BEFORE UPDATE OR DELETE ON "HrEmailDeliveryAttempt"
FOR EACH ROW EXECUTE FUNCTION hr_prevent_delivery_attempt_mutation();
