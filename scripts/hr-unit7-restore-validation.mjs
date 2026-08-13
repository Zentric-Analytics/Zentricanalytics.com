import { PrismaClient } from "@prisma/client";

function requireEvidence(condition, message) {
  if (!condition) throw new Error(message);
}

const target = new URL(process.env.RESTORE_DATABASE_URL ?? "postgresql://missing/missing");
const databaseName = target.pathname.slice(1);
if (process.env.APP_ENV !== "staging" || process.env.DR_RESTORE_CONFIRM !== "isolated-restore" || !/^zentric_unit7_restore(?:_|$)/.test(databaseName)) {
  throw new Error("Refusing Unit 7 validation outside an explicitly confirmed isolated staging restore target.");
}

const prisma = new PrismaClient({ datasourceUrl: target.toString() });
try {
  const migrations = await prisma.$queryRaw`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY started_at`;
  const pendingMigrations = await prisma.$queryRaw`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL`;
  requireEvidence(migrations.length === 43 && pendingMigrations.length === 0, "The restored database does not contain exactly 43 completed migrations with none pending.");

  const employee = await prisma.hrEmployee.findFirstOrThrow({ where: { employeeNumber: "U7-IMMEDIATE-001" } });
  const person = await prisma.hrPerson.findUniqueOrThrow({ where: { id: employee.personId } });
  const relationships = await prisma.hrWorkRelationship.findMany({ where: { personId: person.id }, orderBy: { startedAt: "asc" } });
  const event = await prisma.hrWorkforceEvent.findFirstOrThrow({ where: { reference: "WFE-2026-5B0A5F70" } });
  const promotionCase = await prisma.hrPromotionCase.findFirstOrThrow({ where: { workforceEventId: event.id } });
  const decision = await prisma.hrPromotionDecision.findUniqueOrThrow({ where: { promotionCaseId: promotionCase.id } });
  const readiness = await prisma.hrPromotionReadinessAssessment.findUniqueOrThrow({ where: { id: decision.readinessAssessmentId } });
  const promotionReviewIds = (await prisma.hrPerformanceReview.findMany({
    where: {
      organizationId: employee.organizationId,
      employeeId: employee.id,
      workRelationshipId: promotionCase.workRelationshipId,
      assignmentId: promotionCase.assignmentId,
    },
    select: { id: true },
  })).map(({ id }) => id);
  const calibration = promotionCase.calibrationDecisionId
    ? await prisma.hrCalibrationDecision.findUniqueOrThrow({ where: { id: promotionCase.calibrationDecisionId } })
    : await prisma.hrCalibrationDecision.findFirst({
      where: { organizationId: employee.organizationId, reviewId: { in: promotionReviewIds }, finalizedAt: { not: null } },
      orderBy: [{ finalizedAt: "desc" }, { version: "desc" }],
    });
  requireEvidence(calibration, "The validated promotion case lost its calibration decision.");
  const review = await prisma.hrPerformanceReview.findUniqueOrThrow({ where: { id: calibration.reviewId } });
  const submissions = await prisma.hrPerformanceReviewSubmission.findMany({ where: { reviewId: review.id } });
  const managerSubmission = submissions.find(({ submissionType }) => submissionType === "MANAGER");
  const selfSubmission = submissions.find(({ submissionType }) => submissionType === "SELF");
  requireEvidence(managerSubmission && selfSubmission, "The immutable self/manager review submissions are incomplete.");
  requireEvidence(managerSubmission.ratingItemId === calibration.managerRatingItemId, "The original manager recommendation no longer matches the calibration snapshot.");
  requireEvidence(Boolean(calibration.managerRatingItemId) && Boolean(calibration.calibratedRatingItemId), "The manager recommendation and calibrated outcome were not stored as separate immutable fields.");
  const employeeRationale = String(review.employeeFacingRationale ?? "").toLowerCase();
  const calibrationRationale = String(calibration.rationale ?? "").trim().toLowerCase();
  requireEvidence(employeeRationale && (!calibrationRationale || !employeeRationale.includes(calibrationRationale)), "Employee-facing rationale exposes calibration deliberation.");

  const [goals, evidence, feedback, developmentPlans, assignments, attempts, audits, notifications, outbox, currentJob, targetJob, currentLevel, targetLevel] = await Promise.all([
    prisma.hrPerformanceGoal.count({ where: { employeeId: employee.id } }),
    prisma.hrPerformanceEvidence.count({ where: { employeeId: employee.id } }),
    prisma.hrPerformanceFeedback.count({ where: { employeeId: employee.id } }),
    prisma.hrDevelopmentPlan.findMany({ where: { employeeId: employee.id } }),
    prisma.hrEmployeeAssignment.findMany({ where: { employeeId: employee.id }, orderBy: { effectiveFrom: "asc" } }),
    prisma.hrWorkforceEventExecutionAttempt.findMany({ where: { eventId: event.id } }),
    prisma.hrAuditEvent.findMany({ where: { correlationId: event.correlationId } }),
    prisma.hrNotification.findMany({ where: { organizationId: employee.organizationId, OR: [{ body: { contains: event.reference } }, { href: { contains: event.id } }] } }),
    prisma.$queryRawUnsafe('SELECT id, status FROM "HrEmailOutbox" WHERE payload::text LIKE $1 OR "idempotencyKey" LIKE $2 OR "idempotencyKey" LIKE $3', `%${promotionCase.id}%`, `%${decision.id}%`, `%${event.id}%`),
    prisma.hrJobProfileVersion.findUnique({ where: { id: promotionCase.currentJobProfileVersionId } }),
    prisma.hrJobProfileVersion.findUnique({ where: { id: promotionCase.targetJobProfileVersionId } }),
    prisma.hrCompanyLevelVersion.findUnique({ where: { id: promotionCase.currentLevelVersionId } }),
    prisma.hrCompanyLevelVersion.findUnique({ where: { id: promotionCase.targetLevelVersionId } }),
  ]);

  requireEvidence(relationships.some(({ id }) => id === promotionCase.workRelationshipId), "Promotion work relationship is orphaned.");
  requireEvidence(goals > 0 && evidence > 0 && feedback > 0, "Goal, evidence, or feedback lineage is incomplete.");
  requireEvidence(developmentPlans.length > 0 && readiness.version > 0, "Development/readiness history is incomplete.");
  requireEvidence(currentJob && targetJob && currentLevel && targetLevel, "Job profile or company-level version lineage is orphaned.");
  requireEvidence(assignments.length >= 2 && assignments.filter(({ status }) => status === "ACTIVE").length === 1, "Final assignment state is invalid.");
  const previousAssignment = assignments.find(({ id }) => id === promotionCase.assignmentId);
  const activeAssignment = assignments.find(({ status }) => status === "ACTIVE");
  requireEvidence(previousAssignment?.effectiveTo && previousAssignment.status !== "ACTIVE", "The previous assignment was not historically closed.");
  requireEvidence(activeAssignment && event.appliedAt
    && activeAssignment.effectiveFrom.getTime() === event.appliedAt.getTime()
    && activeAssignment.effectiveFrom.getTime() >= event.requestedEffectiveAt.getTime()
    && previousAssignment.effectiveTo?.getTime() === activeAssignment.effectiveFrom.getTime(), "The replacement assignment is not effective at the governed promotion boundary.");
  requireEvidence(attempts.length === 1 && attempts[0].status === "COMPLETED", "The promotion workforce event was not applied exactly once.");
  requireEvidence(event.status === "APPLIED" && event.appliedAt, "The governed Unit 4 promotion event is not applied.");
  requireEvidence(audits.length > 0, "Correlated immutable audit evidence is missing.");
  requireEvidence(notifications.length > 0 || outbox.length > 0, "Notification/outbox lineage is missing.");

  const duplicateDecisions = await prisma.hrPromotionDecision.count({ where: { promotionCaseId: promotionCase.id } });
  const duplicateEvents = await prisma.hrWorkforceEvent.count({ where: { correlationId: event.correlationId } });
  const overlapCount = assignments.reduce((count, assignment, index) => count + assignments.slice(index + 1).filter((other) => {
    const aEnd = assignment.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY;
    const bEnd = other.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY;
    return assignment.effectiveFrom.getTime() < bEnd && other.effectiveFrom.getTime() < aEnd;
  }).length, 0);
  requireEvidence(duplicateDecisions === 1 && duplicateEvents === 1 && overlapCount === 0, "Duplicate authoritative promotion or overlapping assignment evidence exists.");

  console.info(JSON.stringify({
    result: "PASS",
    database: databaseName,
    migrations: migrations.length,
    personId: person.id,
    workRelationshipId: promotionCase.workRelationshipId,
    previousAssignmentId: previousAssignment.id,
    newAssignmentId: activeAssignment.id,
    promotionCaseId: promotionCase.id,
    promotionDecisionId: decision.id,
    workforceEventId: event.id,
    auditCorrelationId: event.correlationId,
    counts: { relationships: relationships.length, goals, evidence, feedback, reviews: submissions.length, developmentPlans: developmentPlans.length, assignments: assignments.length, executionAttempts: attempts.length, audits: audits.length, notifications: notifications.length, outbox: outbox.length },
    duplicates: { promotionDecisions: duplicateDecisions - 1, workforceEvents: duplicateEvents - 1, assignmentOverlaps: overlapCount },
    confidentiality: { managerRecommendationPreserved: true, calibratedOutcomeSeparate: true, employeeRationaleSafe: true },
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
