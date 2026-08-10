ALTER TABLE "HrEmployeeDocumentVersion"
  ADD COLUMN "storageBucket" TEXT,
  ADD COLUMN "storageVersionId" TEXT,
  ADD COLUMN "storageEtag" TEXT,
  ADD COLUMN "scanRequestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "providerScanEventId" TEXT,
  ADD COLUMN "providerScanStatus" TEXT,
  ADD COLUMN "releasedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "HrEmployeeDocumentVersion_providerScanEventId_key"
  ON "HrEmployeeDocumentVersion"("providerScanEventId");

CREATE INDEX "HrEmployeeDocumentVersion_storageBucket_storageKey_storageVersionId_idx"
  ON "HrEmployeeDocumentVersion"("storageBucket", "storageKey", "storageVersionId");
