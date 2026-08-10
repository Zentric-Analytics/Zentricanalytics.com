CREATE TABLE "HrPasswordResetChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "status" "HrTokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "verifiedAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HrPasswordResetChallenge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HrPasswordResetChallenge_codeHash_key" ON "HrPasswordResetChallenge"("codeHash");
CREATE INDEX "HrPasswordResetChallenge_userId_status_expiresAt_idx" ON "HrPasswordResetChallenge"("userId", "status", "expiresAt");
ALTER TABLE "HrPasswordResetChallenge" ADD CONSTRAINT "HrPasswordResetChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "HrUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
