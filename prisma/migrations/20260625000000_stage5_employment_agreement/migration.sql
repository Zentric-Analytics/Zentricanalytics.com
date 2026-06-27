ALTER TABLE "EmploymentAgreement" ADD COLUMN "title" TEXT NOT NULL DEFAULT 'Employment Agreement + Role Schedule';
ALTER TABLE "EmploymentAgreement" ADD COLUMN "releasedAt" TIMESTAMP(3);
ALTER TABLE "EmploymentAgreement" ADD COLUMN "releasedByAdminEmail" TEXT;
ALTER TABLE "EmploymentAgreement" ADD COLUMN "candidateSubmittedAt" TIMESTAMP(3);
ALTER TABLE "EmploymentAgreement" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "EmploymentAgreement" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "EmploymentAgreement" ADD CONSTRAINT "EmploymentAgreement_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
