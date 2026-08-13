-- Preserve confidential calibration deliberation and backfill the correlated
-- review-finalization audit event for records finalized before this correction.
UPDATE "HrPerformanceReview" r
SET "employeeFacingRationale" = 'Finalized through the governed review and calibration process.'
WHERE r."status" = 'FINALIZED'
  AND EXISTS (
    SELECT 1 FROM "HrCalibrationDecision" d
    WHERE d."reviewId" = r."id"
      AND d."finalizedAt" IS NOT NULL
      AND r."employeeFacingRationale" = d."rationale"
  );

INSERT INTO "HrAuditEvent" (
  "id", "organizationId", "actorUserId", "actorRole", "entityType", "entityId",
  "action", "newValues", "reason", "correlationId", "createdAt"
)
SELECT
  'u7calfix-' || md5(r."id" || ':' || d."id"),
  r."organizationId", s."createdById", 'TALENT_ADMIN', 'HrPerformanceReview', r."id",
  'hr.performance.review.finalized',
  jsonb_build_object(
    'status', 'FINALIZED',
    'version', r."version",
    'calibratedDecisionId', d."id",
    'calibratedDecisionVersion', d."version",
    'finalizedRatingItemId', r."finalizedRatingItemId",
    'remediatedAudit', true
  ),
  'Backfill correlated finalization evidence and protect confidential calibration rationale.',
  r."correlationId", COALESCE(r."finalizedAt", d."finalizedAt", CURRENT_TIMESTAMP)
FROM "HrPerformanceReview" r
JOIN "HrCalibrationDecision" d ON d."reviewId" = r."id" AND d."finalizedAt" IS NOT NULL
JOIN "HrCalibrationSession" s ON s."id" = d."sessionId"
WHERE r."status" = 'FINALIZED'
  AND NOT EXISTS (
    SELECT 1 FROM "HrAuditEvent" a
    WHERE a."organizationId" = r."organizationId"
      AND a."entityType" = 'HrPerformanceReview'
      AND a."entityId" = r."id"
      AND a."action" = 'hr.performance.review.finalized'
  )
ON CONFLICT ("id") DO NOTHING;
