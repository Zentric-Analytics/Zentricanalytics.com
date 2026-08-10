-- Add an explicit immutable credit/debit direction while preserving positive ledger amounts.
ALTER TABLE "HrLeaveLedgerEntry" ADD COLUMN "impactSign" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "HrLeaveLedgerEntry" ADD CONSTRAINT "HrLeaveLedgerEntry_impact_sign_check" CHECK ("impactSign" IN (-1, 1));
