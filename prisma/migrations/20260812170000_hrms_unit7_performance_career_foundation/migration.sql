-- CreateEnum
CREATE TYPE "HrPerformancePublishStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');

-- CreateEnum
CREATE TYPE "HrPerformanceVisibility" AS ENUM ('EMPLOYEE_VISIBLE', 'MANAGER_EMPLOYEE', 'HR_CONFIDENTIAL', 'CALIBRATION_ONLY');

-- CreateEnum
CREATE TYPE "HrPerformanceGoalStatus" AS ENUM ('DRAFT', 'PROPOSED', 'ACTIVE', 'RETURNED', 'REVISED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HrPerformanceReviewStatus" AS ENUM ('NOT_STARTED', 'SELF_REVIEW', 'MANAGER_REVIEW', 'CALIBRATION', 'FINALIZED', 'RETURNED', 'SKIPPED_SELF');

-- CreateEnum
CREATE TYPE "HrCalibrationStatus" AS ENUM ('DRAFT', 'POPULATION_LOCKED', 'IN_SESSION', 'DECISIONS_PENDING', 'FINALIZED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HrDevelopmentPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'REVISED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HrPromotionReadinessState" AS ENUM ('NOT_YET_READY', 'DEVELOPING', 'APPROACHING_READY', 'READY_NOW');

-- CreateEnum
CREATE TYPE "HrPromotionCaseStatus" AS ENUM ('DRAFT', 'MANAGER_RECOMMENDED', 'CALIBRATION', 'HR_REVIEW', 'BUSINESS_APPROVAL', 'APPROVED', 'EXECUTION_PENDING', 'APPLIED', 'RETURNED', 'DEFERRED', 'REJECTED', 'WITHDRAWN', 'CONFLICTED', 'FAILED');

-- CreateTable
CREATE TABLE "HrJobFunction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "HrPerformancePublishStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrJobFunction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrCareerTrack" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "HrPerformancePublishStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrCareerTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrCompanyLevel" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrCompanyLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrCompanyLevelVersion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "companyLevelId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "HrPerformancePublishStatus" NOT NULL DEFAULT 'DRAFT',
    "expectations" JSONB NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "supersedesId" TEXT,
    "contentHash" TEXT NOT NULL,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrCompanyLevelVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrJobProfileVersion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobProfileId" TEXT NOT NULL,
    "jobFunctionId" TEXT NOT NULL,
    "careerTrackId" TEXT NOT NULL,
    "companyLevelVersionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "responsibilities" JSONB NOT NULL,
    "requirements" JSONB NOT NULL,
    "status" "HrPerformancePublishStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "supersedesId" TEXT,
    "contentHash" TEXT NOT NULL,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrJobProfileVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrCompetency" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrCompetency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrCompetencyVersion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "definition" TEXT NOT NULL,
    "evidenceGuide" JSONB,
    "status" "HrPerformancePublishStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "contentHash" TEXT NOT NULL,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrCompetencyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrCompetencyExpectation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobProfileVersionId" TEXT NOT NULL,
    "competencyVersionId" TEXT NOT NULL,
    "companyLevelVersionId" TEXT NOT NULL,
    "expectation" TEXT NOT NULL,
    "evidenceGuide" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrCompetencyExpectation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrRatingScale" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrRatingScale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrRatingScaleVersion" (
    "id" TEXT NOT NULL,
    "ratingScaleId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "HrPerformancePublishStatus" NOT NULL DEFAULT 'DRAFT',
    "contentHash" TEXT NOT NULL,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrRatingScaleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrRatingScaleItem" (
    "id" TEXT NOT NULL,
    "ratingScaleVersionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrRatingScaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrReviewTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrReviewTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrReviewTemplateVersion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reviewTemplateId" TEXT NOT NULL,
    "ratingScaleVersionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "sections" JSONB NOT NULL,
    "status" "HrPerformancePublishStatus" NOT NULL DEFAULT 'DRAFT',
    "contentHash" TEXT NOT NULL,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrReviewTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPerformanceCycle" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cycleType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "selfReviewOpensAt" TIMESTAMP(3),
    "managerReviewOpensAt" TIMESTAMP(3),
    "calibrationOpensAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3) NOT NULL,
    "population" JSONB NOT NULL,
    "workflowDefinitionId" TEXT,
    "reviewTemplateVersionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "correlationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrPerformanceCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPerformanceGoal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT,
    "ownerUserId" TEXT NOT NULL,
    "cycleId" TEXT,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT,
    "goalType" TEXT NOT NULL,
    "status" "HrPerformanceGoalStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "correlationId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrPerformanceGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPerformanceGoalVersion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "outcomeDescription" TEXT NOT NULL,
    "measure" JSONB,
    "weight" DECIMAL(5,2),
    "dueAt" TIMESTAMP(3) NOT NULL,
    "contributors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "alignmentGoalId" TEXT,
    "alignmentVersion" INTEGER,
    "changeReason" TEXT NOT NULL,
    "proposedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "supersedesId" TEXT,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrPerformanceGoalVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrGoalMilestone" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "goalVersionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrGoalMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrGoalProgress" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "goalVersion" INTEGER NOT NULL,
    "progress" INTEGER NOT NULL,
    "note" TEXT,
    "recordedById" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrGoalProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPerformanceEvidence" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "evidenceType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceVersion" TEXT,
    "documentVersionId" TEXT,
    "visibility" "HrPerformanceVisibility" NOT NULL,
    "occurredFrom" TIMESTAMP(3) NOT NULL,
    "occurredTo" TIMESTAMP(3),
    "correlationId" TEXT NOT NULL,
    "supersedesId" TEXT,
    "sealedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrPerformanceEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPerformanceFeedback" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "visibility" "HrPerformanceVisibility" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "content" JSONB NOT NULL,
    "supersedesId" TEXT,
    "correlationId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrPerformanceFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPerformanceCheckIn" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "managerEmployeeId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "cadence" TEXT,
    "topics" JSONB NOT NULL,
    "blockers" JSONB,
    "agreedActions" JSONB NOT NULL,
    "followUpAt" TIMESTAMP(3),
    "visibility" "HrPerformanceVisibility" NOT NULL DEFAULT 'MANAGER_EMPLOYEE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersedesId" TEXT,
    "correlationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrPerformanceCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPerformanceReview" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workRelationshipId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "managerEmployeeId" TEXT NOT NULL,
    "reviewerUserId" TEXT NOT NULL,
    "jobProfileVersionId" TEXT NOT NULL,
    "companyLevelVersionId" TEXT NOT NULL,
    "reviewTemplateVersionId" TEXT NOT NULL,
    "status" "HrPerformanceReviewStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "correlationId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "finalizedRatingItemId" TEXT,
    "employeeFacingRationale" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrPerformanceReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPerformanceReviewSubmission" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "submissionType" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "submittedById" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "ratingItemId" TEXT,
    "rationale" TEXT,
    "evidenceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contentHash" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrPerformanceReviewSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrCalibrationSession" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "population" JSONB NOT NULL,
    "status" "HrCalibrationStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "correlationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrCalibrationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrCalibrationGrant" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" JSONB NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "grantedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrCalibrationGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrCalibrationDecision" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "reviewVersion" INTEGER NOT NULL,
    "managerRatingItemId" TEXT NOT NULL,
    "calibratedRatingItemId" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "decidedById" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrCalibrationDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrCareerInterest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "preferredTrackId" TEXT,
    "targetJobProfileId" TEXT,
    "targetLevelId" TEXT,
    "developmentInterests" JSONB NOT NULL,
    "mobilityInterest" JSONB,
    "visibility" TEXT NOT NULL DEFAULT 'EMPLOYEE_MANAGER_HR',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersedesId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrCareerInterest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrDevelopmentPlan" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "managerEmployeeId" TEXT NOT NULL,
    "status" "HrDevelopmentPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "correlationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrDevelopmentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrDevelopmentPlanVersion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "expectationVersionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "changeReason" TEXT NOT NULL,
    "supersedesId" TEXT,
    "contentHash" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrDevelopmentPlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrDevelopmentAction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planVersionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "gap" TEXT NOT NULL,
    "targetCapability" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "mentorUserId" TEXT,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "reviewDate" TIMESTAMP(3),
    "evidenceRequired" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrDevelopmentAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPromotionReadinessAssessment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workRelationshipId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "currentJobProfileVersionId" TEXT NOT NULL,
    "currentLevelVersionId" TEXT NOT NULL,
    "targetJobProfileVersionId" TEXT NOT NULL,
    "targetLevelVersionId" TEXT NOT NULL,
    "assessorUserId" TEXT NOT NULL,
    "cycleId" TEXT,
    "state" "HrPromotionReadinessState" NOT NULL,
    "evidenceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "gaps" JSONB NOT NULL,
    "rationale" TEXT NOT NULL,
    "employeeFacingRationale" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersedesId" TEXT,
    "correlationId" TEXT NOT NULL,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrPromotionReadinessAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPromotionCase" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workRelationshipId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "currentJobProfileVersionId" TEXT NOT NULL,
    "currentLevelVersionId" TEXT NOT NULL,
    "currentCareerTrackId" TEXT NOT NULL,
    "targetJobProfileVersionId" TEXT NOT NULL,
    "targetLevelVersionId" TEXT NOT NULL,
    "targetCareerTrackId" TEXT NOT NULL,
    "readinessAssessmentId" TEXT NOT NULL,
    "calibrationDecisionId" TEXT,
    "workflowInstanceId" TEXT,
    "status" "HrPromotionCaseStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "businessJustification" TEXT NOT NULL,
    "proposedEffectiveAt" TIMESTAMP(3) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "workforceEventId" TEXT,
    "workforceEventVersion" INTEGER,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrPromotionCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPromotionDecision" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "promotionCaseId" TEXT NOT NULL,
    "caseVersion" INTEGER NOT NULL,
    "decision" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "readinessAssessmentId" TEXT NOT NULL,
    "currentSnapshot" JSONB NOT NULL,
    "targetSnapshot" JSONB NOT NULL,
    "proposedEffectiveAt" TIMESTAMP(3) NOT NULL,
    "decidedByIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "correlationId" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrPromotionDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPerformanceJobRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "windowKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "claimTokenHash" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "checkpoint" JSONB,
    "safeError" TEXT,
    "correlationId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "HrPerformanceJobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HrJobFunction_organizationId_status_effectiveFrom_effective_idx" ON "HrJobFunction"("organizationId", "status", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "HrJobFunction_organizationId_code_key" ON "HrJobFunction"("organizationId", "code");

-- CreateIndex
CREATE INDEX "HrCareerTrack_organizationId_status_effectiveFrom_effective_idx" ON "HrCareerTrack"("organizationId", "status", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "HrCareerTrack_organizationId_code_key" ON "HrCareerTrack"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompanyLevel_organizationId_code_key" ON "HrCompanyLevel"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompanyLevel_organizationId_displayOrder_key" ON "HrCompanyLevel"("organizationId", "displayOrder");

-- CreateIndex
CREATE INDEX "HrCompanyLevelVersion_organizationId_status_effectiveFrom_e_idx" ON "HrCompanyLevelVersion"("organizationId", "status", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompanyLevelVersion_companyLevelId_version_key" ON "HrCompanyLevelVersion"("companyLevelId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompanyLevelVersion_organizationId_contentHash_key" ON "HrCompanyLevelVersion"("organizationId", "contentHash");

-- CreateIndex
CREATE INDEX "HrJobProfileVersion_organizationId_status_effectiveFrom_eff_idx" ON "HrJobProfileVersion"("organizationId", "status", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "HrJobProfileVersion_careerTrackId_companyLevelVersionId_idx" ON "HrJobProfileVersion"("careerTrackId", "companyLevelVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "HrJobProfileVersion_jobProfileId_version_key" ON "HrJobProfileVersion"("jobProfileId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "HrJobProfileVersion_organizationId_contentHash_key" ON "HrJobProfileVersion"("organizationId", "contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompetency_organizationId_code_key" ON "HrCompetency"("organizationId", "code");

-- CreateIndex
CREATE INDEX "HrCompetencyVersion_organizationId_status_effectiveFrom_eff_idx" ON "HrCompetencyVersion"("organizationId", "status", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompetencyVersion_competencyId_version_key" ON "HrCompetencyVersion"("competencyId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompetencyVersion_organizationId_contentHash_key" ON "HrCompetencyVersion"("organizationId", "contentHash");

-- CreateIndex
CREATE INDEX "HrCompetencyExpectation_organizationId_companyLevelVersionI_idx" ON "HrCompetencyExpectation"("organizationId", "companyLevelVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompetencyExpectation_jobProfileVersionId_competencyVersi_key" ON "HrCompetencyExpectation"("jobProfileVersionId", "competencyVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "HrRatingScale_organizationId_code_key" ON "HrRatingScale"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "HrRatingScaleVersion_ratingScaleId_version_key" ON "HrRatingScaleVersion"("ratingScaleId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "HrRatingScaleItem_ratingScaleVersionId_code_key" ON "HrRatingScaleItem"("ratingScaleVersionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "HrRatingScaleItem_ratingScaleVersionId_displayOrder_key" ON "HrRatingScaleItem"("ratingScaleVersionId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "HrReviewTemplate_organizationId_code_key" ON "HrReviewTemplate"("organizationId", "code");

-- CreateIndex
CREATE INDEX "HrReviewTemplateVersion_organizationId_status_idx" ON "HrReviewTemplateVersion"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HrReviewTemplateVersion_reviewTemplateId_version_key" ON "HrReviewTemplateVersion"("reviewTemplateId", "version");

-- CreateIndex
CREATE INDEX "HrPerformanceCycle_organizationId_status_startsAt_endsAt_idx" ON "HrPerformanceCycle"("organizationId", "status", "startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrPerformanceCycle_organizationId_code_key" ON "HrPerformanceCycle"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "HrPerformanceCycle_organizationId_correlationId_key" ON "HrPerformanceCycle"("organizationId", "correlationId");

-- CreateIndex
CREATE INDEX "HrPerformanceGoal_organizationId_ownerUserId_status_idx" ON "HrPerformanceGoal"("organizationId", "ownerUserId", "status");

-- CreateIndex
CREATE INDEX "HrPerformanceGoal_employeeId_cycleId_status_idx" ON "HrPerformanceGoal"("employeeId", "cycleId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HrPerformanceGoal_organizationId_idempotencyKey_key" ON "HrPerformanceGoal"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "HrPerformanceGoal_organizationId_correlationId_key" ON "HrPerformanceGoal"("organizationId", "correlationId");

-- CreateIndex
CREATE INDEX "HrPerformanceGoalVersion_organizationId_dueAt_idx" ON "HrPerformanceGoalVersion"("organizationId", "dueAt");

-- CreateIndex
CREATE INDEX "HrPerformanceGoalVersion_alignmentGoalId_alignmentVersion_idx" ON "HrPerformanceGoalVersion"("alignmentGoalId", "alignmentVersion");

-- CreateIndex
CREATE UNIQUE INDEX "HrPerformanceGoalVersion_goalId_version_key" ON "HrPerformanceGoalVersion"("goalId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "HrGoalMilestone_goalVersionId_sequence_key" ON "HrGoalMilestone"("goalVersionId", "sequence");

-- CreateIndex
CREATE INDEX "HrGoalProgress_goalId_recordedAt_idx" ON "HrGoalProgress"("goalId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrGoalProgress_organizationId_correlationId_key" ON "HrGoalProgress"("organizationId", "correlationId");

-- CreateIndex
CREATE INDEX "HrPerformanceEvidence_employeeId_visibility_occurredFrom_idx" ON "HrPerformanceEvidence"("employeeId", "visibility", "occurredFrom");

-- CreateIndex
CREATE INDEX "HrPerformanceEvidence_sourceType_sourceId_sourceVersion_idx" ON "HrPerformanceEvidence"("sourceType", "sourceId", "sourceVersion");

-- CreateIndex
CREATE UNIQUE INDEX "HrPerformanceEvidence_organizationId_correlationId_key" ON "HrPerformanceEvidence"("organizationId", "correlationId");

-- CreateIndex
CREATE INDEX "HrPerformanceFeedback_employeeId_visibility_submittedAt_idx" ON "HrPerformanceFeedback"("employeeId", "visibility", "submittedAt");

-- CreateIndex
CREATE INDEX "HrPerformanceFeedback_authorUserId_status_idx" ON "HrPerformanceFeedback"("authorUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HrPerformanceFeedback_organizationId_correlationId_key" ON "HrPerformanceFeedback"("organizationId", "correlationId");

-- CreateIndex
CREATE INDEX "HrPerformanceCheckIn_employeeId_occurredAt_idx" ON "HrPerformanceCheckIn"("employeeId", "occurredAt");

-- CreateIndex
CREATE INDEX "HrPerformanceCheckIn_managerEmployeeId_occurredAt_idx" ON "HrPerformanceCheckIn"("managerEmployeeId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrPerformanceCheckIn_organizationId_correlationId_key" ON "HrPerformanceCheckIn"("organizationId", "correlationId");

-- CreateIndex
CREATE INDEX "HrPerformanceReview_organizationId_reviewerUserId_status_idx" ON "HrPerformanceReview"("organizationId", "reviewerUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HrPerformanceReview_cycleId_employeeId_workRelationshipId_key" ON "HrPerformanceReview"("cycleId", "employeeId", "workRelationshipId");

-- CreateIndex
CREATE UNIQUE INDEX "HrPerformanceReview_organizationId_correlationId_key" ON "HrPerformanceReview"("organizationId", "correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "HrPerformanceReview_organizationId_idempotencyKey_key" ON "HrPerformanceReview"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "HrPerformanceReviewSubmission_organizationId_submittedById__idx" ON "HrPerformanceReviewSubmission"("organizationId", "submittedById", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrPerformanceReviewSubmission_reviewId_submissionType_versi_key" ON "HrPerformanceReviewSubmission"("reviewId", "submissionType", "version");

-- CreateIndex
CREATE INDEX "HrCalibrationSession_organizationId_cycleId_status_idx" ON "HrCalibrationSession"("organizationId", "cycleId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HrCalibrationSession_organizationId_correlationId_key" ON "HrCalibrationSession"("organizationId", "correlationId");

-- CreateIndex
CREATE INDEX "HrCalibrationGrant_organizationId_userId_effectiveFrom_effe_idx" ON "HrCalibrationGrant"("organizationId", "userId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "HrCalibrationGrant_sessionId_userId_key" ON "HrCalibrationGrant"("sessionId", "userId");

-- CreateIndex
CREATE INDEX "HrCalibrationDecision_organizationId_finalizedAt_idx" ON "HrCalibrationDecision"("organizationId", "finalizedAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrCalibrationDecision_sessionId_reviewId_version_key" ON "HrCalibrationDecision"("sessionId", "reviewId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "HrCalibrationDecision_organizationId_correlationId_key" ON "HrCalibrationDecision"("organizationId", "correlationId");

-- CreateIndex
CREATE INDEX "HrCareerInterest_organizationId_employeeId_effectiveFrom_ef_idx" ON "HrCareerInterest"("organizationId", "employeeId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "HrDevelopmentPlan_employeeId_status_idx" ON "HrDevelopmentPlan"("employeeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HrDevelopmentPlan_organizationId_correlationId_key" ON "HrDevelopmentPlan"("organizationId", "correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "HrDevelopmentPlanVersion_planId_version_key" ON "HrDevelopmentPlanVersion"("planId", "version");

-- CreateIndex
CREATE INDEX "HrDevelopmentAction_organizationId_ownerUserId_status_targe_idx" ON "HrDevelopmentAction"("organizationId", "ownerUserId", "status", "targetDate");

-- CreateIndex
CREATE UNIQUE INDEX "HrDevelopmentAction_planVersionId_sequence_key" ON "HrDevelopmentAction"("planVersionId", "sequence");

-- CreateIndex
CREATE INDEX "HrPromotionReadinessAssessment_employeeId_targetJobProfileV_idx" ON "HrPromotionReadinessAssessment"("employeeId", "targetJobProfileVersionId", "targetLevelVersionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrPromotionReadinessAssessment_organizationId_correlationId_key" ON "HrPromotionReadinessAssessment"("organizationId", "correlationId");

-- CreateIndex
CREATE INDEX "HrPromotionCase_employeeId_targetJobProfileVersionId_status_idx" ON "HrPromotionCase"("employeeId", "targetJobProfileVersionId", "status", "proposedEffectiveAt");

-- CreateIndex
CREATE INDEX "HrPromotionCase_organizationId_status_proposedEffectiveAt_idx" ON "HrPromotionCase"("organizationId", "status", "proposedEffectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrPromotionCase_organizationId_idempotencyKey_key" ON "HrPromotionCase"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "HrPromotionCase_organizationId_correlationId_key" ON "HrPromotionCase"("organizationId", "correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "HrPromotionDecision_promotionCaseId_key" ON "HrPromotionDecision"("promotionCaseId");

-- CreateIndex
CREATE UNIQUE INDEX "HrPromotionDecision_organizationId_correlationId_key" ON "HrPromotionDecision"("organizationId", "correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "HrPerformanceJobRun_claimTokenHash_key" ON "HrPerformanceJobRun"("claimTokenHash");

-- CreateIndex
CREATE INDEX "HrPerformanceJobRun_organizationId_status_startedAt_idx" ON "HrPerformanceJobRun"("organizationId", "status", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrPerformanceJobRun_organizationId_jobType_windowKey_key" ON "HrPerformanceJobRun"("organizationId", "jobType", "windowKey");

-- CreateIndex
CREATE UNIQUE INDEX "HrPerformanceJobRun_organizationId_correlationId_key" ON "HrPerformanceJobRun"("organizationId", "correlationId");

-- Unit 7 references are deliberately restrictive: published/history records
-- cannot cascade away when a parent aggregate is retired.
ALTER TABLE "HrCompanyLevelVersion" ADD CONSTRAINT "HrCompanyLevelVersion_companyLevelId_fkey" FOREIGN KEY ("companyLevelId") REFERENCES "HrCompanyLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrJobProfileVersion" ADD CONSTRAINT "HrJobProfileVersion_jobFunctionId_fkey" FOREIGN KEY ("jobFunctionId") REFERENCES "HrJobFunction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrJobProfileVersion" ADD CONSTRAINT "HrJobProfileVersion_careerTrackId_fkey" FOREIGN KEY ("careerTrackId") REFERENCES "HrCareerTrack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrJobProfileVersion" ADD CONSTRAINT "HrJobProfileVersion_companyLevelVersionId_fkey" FOREIGN KEY ("companyLevelVersionId") REFERENCES "HrCompanyLevelVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrCompetencyVersion" ADD CONSTRAINT "HrCompetencyVersion_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "HrCompetency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrCompetencyExpectation" ADD CONSTRAINT "HrCompetencyExpectation_jobProfileVersionId_fkey" FOREIGN KEY ("jobProfileVersionId") REFERENCES "HrJobProfileVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrCompetencyExpectation" ADD CONSTRAINT "HrCompetencyExpectation_competencyVersionId_fkey" FOREIGN KEY ("competencyVersionId") REFERENCES "HrCompetencyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrRatingScaleVersion" ADD CONSTRAINT "HrRatingScaleVersion_ratingScaleId_fkey" FOREIGN KEY ("ratingScaleId") REFERENCES "HrRatingScale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrRatingScaleItem" ADD CONSTRAINT "HrRatingScaleItem_ratingScaleVersionId_fkey" FOREIGN KEY ("ratingScaleVersionId") REFERENCES "HrRatingScaleVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrReviewTemplateVersion" ADD CONSTRAINT "HrReviewTemplateVersion_reviewTemplateId_fkey" FOREIGN KEY ("reviewTemplateId") REFERENCES "HrReviewTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrReviewTemplateVersion" ADD CONSTRAINT "HrReviewTemplateVersion_ratingScaleVersionId_fkey" FOREIGN KEY ("ratingScaleVersionId") REFERENCES "HrRatingScaleVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrPerformanceCycle" ADD CONSTRAINT "HrPerformanceCycle_reviewTemplateVersionId_fkey" FOREIGN KEY ("reviewTemplateVersionId") REFERENCES "HrReviewTemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrPerformanceGoalVersion" ADD CONSTRAINT "HrPerformanceGoalVersion_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "HrPerformanceGoal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrGoalMilestone" ADD CONSTRAINT "HrGoalMilestone_goalVersionId_fkey" FOREIGN KEY ("goalVersionId") REFERENCES "HrPerformanceGoalVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrGoalProgress" ADD CONSTRAINT "HrGoalProgress_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "HrPerformanceGoal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrPerformanceReviewSubmission" ADD CONSTRAINT "HrPerformanceReviewSubmission_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "HrPerformanceReview"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrCalibrationGrant" ADD CONSTRAINT "HrCalibrationGrant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "HrCalibrationSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrCalibrationDecision" ADD CONSTRAINT "HrCalibrationDecision_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "HrCalibrationSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrCalibrationDecision" ADD CONSTRAINT "HrCalibrationDecision_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "HrPerformanceReview"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrDevelopmentPlanVersion" ADD CONSTRAINT "HrDevelopmentPlanVersion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "HrDevelopmentPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrDevelopmentAction" ADD CONSTRAINT "HrDevelopmentAction_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "HrDevelopmentPlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrPromotionCase" ADD CONSTRAINT "HrPromotionCase_readinessAssessmentId_fkey" FOREIGN KEY ("readinessAssessmentId") REFERENCES "HrPromotionReadinessAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrPromotionDecision" ADD CONSTRAINT "HrPromotionDecision_promotionCaseId_fkey" FOREIGN KEY ("promotionCaseId") REFERENCES "HrPromotionCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrPromotionDecision" ADD CONSTRAINT "HrPromotionDecision_readinessAssessmentId_fkey" FOREIGN KEY ("readinessAssessmentId") REFERENCES "HrPromotionReadinessAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "HrPromotionCase_active_target_effective_key"
ON "HrPromotionCase" ("organizationId", "employeeId", "targetJobProfileVersionId", "targetLevelVersionId", "proposedEffectiveAt")
WHERE "status" NOT IN ('APPLIED', 'REJECTED', 'WITHDRAWN', 'FAILED');
