ALTER TABLE "UploadedDocument" ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'local-private';

CREATE TABLE IF NOT EXISTS "ApplicationSequence" (
  "year" INTEGER NOT NULL,
  "nextValue" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApplicationSequence_pkey" PRIMARY KEY ("year")
);

CREATE TABLE IF NOT EXISTS "RateLimitEvent" (
  "id" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RateLimitEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RateLimitEvent_scope_keyHash_createdAt_idx" ON "RateLimitEvent"("scope", "keyHash", "createdAt");
