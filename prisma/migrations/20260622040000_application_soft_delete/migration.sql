ALTER TABLE "JobApplication" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "JobApplication" ADD COLUMN IF NOT EXISTS "deletedByAdminEmail" TEXT;
ALTER TABLE "JobApplication" ADD COLUMN IF NOT EXISTS "deleteReason" TEXT;
ALTER TABLE "JobApplication" ADD COLUMN IF NOT EXISTS "restoredAt" TIMESTAMP(3);
ALTER TABLE "JobApplication" ADD COLUMN IF NOT EXISTS "restoredByAdminEmail" TEXT;
CREATE INDEX IF NOT EXISTS "JobApplication_deletedAt_idx" ON "JobApplication"("deletedAt");
