-- Preserve explicit carryover-out projection without overloading expiry.
ALTER TABLE "HrLeaveAccountPeriod" ADD COLUMN "carriedOut" DECIMAL(12,4) NOT NULL DEFAULT 0;
