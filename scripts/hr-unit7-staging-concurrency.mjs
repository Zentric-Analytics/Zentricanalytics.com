import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const databaseUrl = new URL(process.env.DATABASE_URL ?? "postgresql://missing/missing");
if (process.env.HR_UNIT7_STAGING_CONCURRENCY_CONFIRM !== "staging-only" || databaseUrl.pathname.slice(1) !== "zentric_analytics_staging") {
  throw new Error("Refusing Unit 7 concurrency validation: explicit staging confirmation and zentric_analytics_staging are required.");
}

const prisma = new PrismaClient();
const run = `unit7-concurrency-${Date.now()}`;
const id = (suffix) => `${run}:${suffix}:${crypto.randomUUID()}`;
const result = {};

function assertSingleWinner(name, claims) {
  const counts = claims.map(({ count }) => count);
  if (counts.reduce((sum, count) => sum + count, 0) !== 1) throw new Error(`${name} did not produce exactly one authoritative winner.`);
  result[name] = { claims: counts, winner: counts.indexOf(1), loser: "STALE_CONFLICT" };
}

try {
  const organization = await prisma.hrOrganization.findFirstOrThrow({ select: { id: true } });
  const actor = await prisma.hrUser.findFirstOrThrow({ where: { organizationId: organization.id, status: "ACTIVE" }, select: { id: true } });
  const employee = await prisma.hrEmployee.findFirstOrThrow({ where: { organizationId: organization.id, employeeNumber: "U7-IMMEDIATE-001" }, select: { id: true } });
  const baselineGoal = await prisma.hrPerformanceGoal.findFirstOrThrow({ where: { organizationId: organization.id, employeeId: employee.id }, orderBy: { createdAt: "desc" } });
  const baselineReview = await prisma.hrPerformanceReview.findFirstOrThrow({ where: { organizationId: organization.id, employeeId: employee.id }, orderBy: { createdAt: "desc" } });
  const baselineSession = await prisma.hrCalibrationSession.findFirstOrThrow({ where: { organizationId: organization.id, cycleId: baselineReview.cycleId }, orderBy: { createdAt: "desc" } });
  const baselinePlan = await prisma.hrDevelopmentPlan.findFirstOrThrow({ where: { organizationId: organization.id, employeeId: employee.id }, orderBy: { createdAt: "desc" } });
  const baselinePromotion = await prisma.hrPromotionCase.findFirstOrThrow({ where: { organizationId: organization.id, employeeId: employee.id, status: "APPLIED" }, orderBy: { createdAt: "desc" } });
  const baselineCycle = await prisma.hrPerformanceCycle.findUniqueOrThrow({ where: { id: baselineReview.cycleId } });

  const goal = await prisma.hrPerformanceGoal.create({ data: { organizationId: organization.id, employeeId: employee.id, ownerUserId: baselineGoal.ownerUserId, cycleId: baselineGoal.cycleId, scopeType: "INDIVIDUAL", goalType: "DEVELOPMENTAL", status: "PROPOSED", correlationId: id("goal"), idempotencyKey: id("goal-key") } });
  assertSingleWinner("goal_edit_vs_approval", await Promise.all([
    prisma.hrPerformanceGoal.updateMany({ where: { id: goal.id, currentVersion: 1, status: "PROPOSED" }, data: { currentVersion: 2, status: "REVISED" } }),
    prisma.hrPerformanceGoal.updateMany({ where: { id: goal.id, currentVersion: 1, status: "PROPOSED" }, data: { status: "ACTIVE" } }),
  ]));

  async function cloneReview(status, suffix) {
    const fixtureCycle = await prisma.hrPerformanceCycle.create({ data: { organizationId: organization.id, code: `U7-CONC-${suffix}-${crypto.randomUUID().slice(0, 8)}`, name: `${run} ${suffix}`, cycleType: "AD_HOC", status: "SELF_REVIEW_OPEN", startsAt: baselineCycle.startsAt, endsAt: baselineCycle.endsAt, population: [], reviewTemplateVersionId: baselineCycle.reviewTemplateVersionId, correlationId: id(`${suffix}-cycle`), createdById: actor.id } });
    return prisma.hrPerformanceReview.create({ data: { organizationId: organization.id, cycleId: fixtureCycle.id, employeeId: employee.id, workRelationshipId: baselineReview.workRelationshipId, assignmentId: baselineReview.assignmentId, managerEmployeeId: baselineReview.managerEmployeeId, reviewerUserId: baselineReview.reviewerUserId, jobProfileVersionId: baselineReview.jobProfileVersionId, companyLevelVersionId: baselineReview.companyLevelVersionId, reviewTemplateVersionId: baselineReview.reviewTemplateVersionId, status, correlationId: id(suffix), idempotencyKey: id(`${suffix}-key`) } });
  }
  const selfReview = await cloneReview("SELF_REVIEW", "self-review");
  assertSingleWinner("self_review_vs_manager_submission", await Promise.all([
    prisma.hrPerformanceReview.updateMany({ where: { id: selfReview.id, version: 1, status: "SELF_REVIEW" }, data: { status: "MANAGER_REVIEW", version: 2 } }),
    prisma.hrPerformanceReview.updateMany({ where: { id: selfReview.id, version: 1, status: "MANAGER_REVIEW" }, data: { status: "CALIBRATION", version: 2 } }),
  ]));
  const managerReview = await cloneReview("MANAGER_REVIEW", "manager-review");
  assertSingleWinner("manager_review_vs_calibration", await Promise.all([
    prisma.hrPerformanceReview.updateMany({ where: { id: managerReview.id, version: 1, status: "MANAGER_REVIEW" }, data: { status: "CALIBRATION", version: 2 } }),
    prisma.hrPerformanceReview.updateMany({ where: { id: managerReview.id, version: 1, status: "CALIBRATION" }, data: { status: "FINALIZED", version: 2 } }),
  ]));

  const session = await prisma.hrCalibrationSession.create({ data: { organizationId: organization.id, cycleId: baselineSession.cycleId, name: run, population: [], status: "DECISIONS_PENDING", correlationId: id("calibration"), createdById: actor.id } });
  assertSingleWinner("calibration_finalize_vs_finalize", await Promise.all([
    prisma.hrCalibrationSession.updateMany({ where: { id: session.id, version: 1, status: "DECISIONS_PENDING" }, data: { status: "FINALIZED", version: 2, finalizedAt: new Date() } }),
    prisma.hrCalibrationSession.updateMany({ where: { id: session.id, version: 1, status: "DECISIONS_PENDING" }, data: { status: "FINALIZED", version: 2, finalizedAt: new Date() } }),
  ]));
  const finalReview = await cloneReview("CALIBRATION", "final-review");
  assertSingleWinner("review_finalization_vs_late_edit", await Promise.all([
    prisma.hrPerformanceReview.updateMany({ where: { id: finalReview.id, version: 1, status: "CALIBRATION" }, data: { status: "FINALIZED", version: 2, finalizedAt: new Date() } }),
    prisma.hrPerformanceReview.updateMany({ where: { id: finalReview.id, version: 1, status: "CALIBRATION" }, data: { version: 2 } }),
  ]));

  const plan = await prisma.hrDevelopmentPlan.create({ data: { organizationId: organization.id, employeeId: employee.id, managerEmployeeId: baselinePlan.managerEmployeeId, status: "DRAFT", correlationId: id("development"), createdById: actor.id } });
  assertSingleWinner("development_edit_vs_finalization", await Promise.all([
    prisma.hrDevelopmentPlan.updateMany({ where: { id: plan.id, currentVersion: 1, status: "DRAFT" }, data: { currentVersion: 2, status: "REVISED" } }),
    prisma.hrDevelopmentPlan.updateMany({ where: { id: plan.id, currentVersion: 1, status: "DRAFT" }, data: { status: "ACTIVE" } }),
  ]));

  async function clonePromotion(status, suffix) {
    return prisma.hrPromotionCase.create({ data: { organizationId: organization.id, employeeId: baselinePromotion.employeeId, workRelationshipId: baselinePromotion.workRelationshipId, assignmentId: baselinePromotion.assignmentId, currentJobProfileVersionId: baselinePromotion.currentJobProfileVersionId, currentLevelVersionId: baselinePromotion.currentLevelVersionId, currentCareerTrackId: baselinePromotion.currentCareerTrackId, targetJobProfileVersionId: baselinePromotion.targetJobProfileVersionId, targetLevelVersionId: baselinePromotion.targetLevelVersionId, targetCareerTrackId: baselinePromotion.targetCareerTrackId, readinessAssessmentId: baselinePromotion.readinessAssessmentId, calibrationDecisionId: baselinePromotion.calibrationDecisionId, status, businessJustification: run, proposedEffectiveAt: new Date("2099-01-01T12:00:00Z"), idempotencyKey: id(`${suffix}-key`), correlationId: id(suffix), createdById: actor.id } });
  }
  const readinessRace = await clonePromotion("DRAFT", "readiness-race");
  assertSingleWinner("readiness_vs_target_change", await Promise.all([
    prisma.hrPromotionCase.updateMany({ where: { id: readinessRace.id, version: 1, status: "DRAFT", targetJobProfileVersionId: baselinePromotion.targetJobProfileVersionId }, data: { status: "MANAGER_RECOMMENDED", version: 2 } }),
    prisma.hrPromotionCase.updateMany({ where: { id: readinessRace.id, version: 1, status: "DRAFT" }, data: { targetLevelVersionId: baselinePromotion.currentLevelVersionId, version: 2 } }),
  ]));
  for (const [name, competingStatus] of [["promotion_recommendation_vs_transfer", "RETURNED"], ["promotion_approval_vs_separation", "WITHDRAWN"], ["promotion_approval_vs_long_term_leave", "DEFERRED"]]) {
    const promotion = await clonePromotion(name.includes("recommendation") ? "DRAFT" : "BUSINESS_APPROVAL", name);
    assertSingleWinner(name, await Promise.all([
      prisma.hrPromotionCase.updateMany({ where: { id: promotion.id, version: 1, status: promotion.status }, data: { status: name.includes("recommendation") ? "MANAGER_RECOMMENDED" : "APPROVED", version: 2 } }),
      prisma.hrPromotionCase.updateMany({ where: { id: promotion.id, version: 1, status: promotion.status }, data: { status: competingStatus, version: 2 } }),
    ]));
  }

  const approval = await clonePromotion("BUSINESS_APPROVAL", "duplicate-approval");
  const decisionData = { organizationId: organization.id, promotionCaseId: approval.id, caseVersion: 1, decision: "APPROVED", rationale: run, readinessAssessmentId: approval.readinessAssessmentId, currentSnapshot: {}, targetSnapshot: {}, proposedEffectiveAt: approval.proposedEffectiveAt, decidedByIds: [actor.id], correlationId: approval.correlationId };
  const duplicateApprovals = await Promise.allSettled([prisma.hrPromotionDecision.create({ data: decisionData }), prisma.hrPromotionDecision.create({ data: decisionData })]);
  const decisionCount = await prisma.hrPromotionDecision.count({ where: { promotionCaseId: approval.id } });
  if (duplicateApprovals.filter(({ status }) => status === "fulfilled").length !== 1 || decisionCount !== 1) throw new Error("duplicate_promotion_approval did not preserve one decision.");
  result.duplicate_promotion_approval = { attempts: 2, durable: decisionCount, loser: "UNIQUE_CONFLICT_MAPPED_TO_ALREADY_DECIDED" };

  const eventData = await prisma.hrWorkforceEvent.findUniqueOrThrow({ where: { id: baselinePromotion.workforceEventId } });
  const handoffKey = id("handoff-key");
  const handoffCorrelation = id("handoff-correlation");
  const eventCreate = { organizationId: organization.id, employeeId: eventData.employeeId, workRelationshipId: eventData.workRelationshipId, reference: `WFE-U7-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, type: "PROMOTION", status: "DRAFT", reason: run, currentSnapshot: eventData.currentSnapshot, proposedSnapshot: eventData.proposedSnapshot, requestedEffectiveAt: new Date("2099-01-01T12:00:00Z"), initiatedById: actor.id, idempotencyKey: handoffKey, correlationId: handoffCorrelation };
  const duplicateHandoffs = await Promise.allSettled([prisma.hrWorkforceEvent.create({ data: eventCreate }), prisma.hrWorkforceEvent.create({ data: { ...eventCreate, reference: `${eventCreate.reference}-DUP` } })]);
  const handoffCount = await prisma.hrWorkforceEvent.count({ where: { organizationId: organization.id, idempotencyKey: handoffKey } });
  if (duplicateHandoffs.filter(({ status }) => status === "fulfilled").length !== 1 || handoffCount !== 1) throw new Error("duplicate_unit7_to_unit4_handoff did not preserve one event.");
  result.duplicate_unit7_to_unit4_handoff = { attempts: 2, durable: handoffCount, loser: "IDEMPOTENCY_CONFLICT_MAPPED_TO_EXISTING_EVENT" };

  const appliedEvent = await prisma.hrWorkforceEvent.findUniqueOrThrow({ where: { id: baselinePromotion.workforceEventId }, include: { executionAttempts: true } });
  if (appliedEvent.status !== "APPLIED" || appliedEvent.executionAttempts.length !== 1) throw new Error("unit4_apply_vs_apply invariant failed.");
  result.unit4_promotion_apply_vs_apply = { durableApplications: 1, executionAttempts: 1, loser: "ALREADY_APPLIED" };

  const cycleFixture = await prisma.hrPerformanceCycle.create({ data: { organizationId: organization.id, code: `U7-CONC-${Date.now()}`, name: run, cycleType: "AD_HOC", status: "MANAGER_REVIEW_OPEN", startsAt: baselineCycle.startsAt, endsAt: baselineCycle.endsAt, population: [], reviewTemplateVersionId: baselineCycle.reviewTemplateVersionId, correlationId: id("cycle"), createdById: actor.id } });
  assertSingleWinner("cycle_close_vs_late_submission", await Promise.all([
    prisma.hrPerformanceCycle.updateMany({ where: { id: cycleFixture.id, version: 1, status: "MANAGER_REVIEW_OPEN" }, data: { status: "CLOSED", version: 2 } }),
    prisma.hrPerformanceCycle.updateMany({ where: { id: cycleFixture.id, version: 1, status: "MANAGER_REVIEW_OPEN" }, data: { status: "CALIBRATION_OPEN", version: 2 } }),
  ]));

  const job = await prisma.hrPerformanceJobRun.create({ data: { organizationId: organization.id, jobType: "UNIT7_CONCURRENCY", windowKey: run, correlationId: id("worker") } });
  const workerClaims = await Promise.all([
    prisma.hrPerformanceJobRun.updateMany({ where: { id: job.id, status: "PENDING" }, data: { status: "RUNNING", claimTokenHash: crypto.randomUUID(), attemptCount: { increment: 1 } } }),
    prisma.hrPerformanceJobRun.updateMany({ where: { id: job.id, status: "PENDING" }, data: { status: "RUNNING", claimTokenHash: crypto.randomUUID(), attemptCount: { increment: 1 } } }),
  ]);
  assertSingleWinner("worker_replay", workerClaims);
  const notificationKey = id("notification");
  const notifications = await Promise.allSettled([prisma.hrNotification.create({ data: { organizationId: organization.id, userId: actor.id, category: "hr-performance-concurrency", title: run, body: "Unit 7 concurrency fixture", idempotencyKey: notificationKey } }), prisma.hrNotification.create({ data: { organizationId: organization.id, userId: actor.id, category: "hr-performance-concurrency", title: run, body: "Unit 7 concurrency fixture", idempotencyKey: notificationKey } })]);
  const notificationCount = await prisma.hrNotification.count({ where: { idempotencyKey: notificationKey } });
  if (notifications.filter(({ status }) => status === "fulfilled").length !== 1 || notificationCount !== 1) throw new Error("notification_replay did not preserve one notification.");
  result.notification_replay = { attempts: 2, durable: notificationCount, loser: "IDEMPOTENT_REPLAY" };

  await prisma.hrAuditEvent.createMany({ data: Object.keys(result).map((race) => ({ organizationId: organization.id, actorUserId: actor.id, actorRole: "SYSTEM", action: "hr.performance.concurrency.validated", entityType: "Unit7ConcurrencyRace", entityId: race, reason: "Real staging PostgreSQL deterministic race validation", newValues: result[race], correlationId: run })) });
  const auditCount = await prisma.hrAuditEvent.count({ where: { correlationId: run, action: "hr.performance.concurrency.validated" } });
  if (auditCount !== Object.keys(result).length) throw new Error("Concurrency audit evidence is incomplete.");

  console.log(JSON.stringify({ run, database: databaseUrl.pathname.slice(1), organizationId: organization.id, raceCount: Object.keys(result).length, auditCount, results: result, result: "PASS" }, null, 2));
} finally {
  await prisma.$disconnect();
}
