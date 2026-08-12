import { Prisma, type HrEmploymentType, type HrTimeTrackingMode, type HrWorkMode } from "@prisma/client";
import { appendHrAudit } from "@/lib/hr/audit";
import { assertNoScheduleOverlap } from "./domain";

type Context = { organizationId: string; actorUserId: string; actorRole?: string };

export async function createTimePolicyVersion(tx: Prisma.TransactionClient, context: Context, input: { policyId: string; trackingMode: HrTimeTrackingMode; timezone: string; graceBeforeMinutes: number; graceAfterMinutes: number; maximumOfflineDelayMin: number; maximumFutureSkewMin: number; dailyOvertimeMinutes?: number; weeklyOvertimeMinutes?: number; allowCategoryStacking?: boolean; breakRules?: Prisma.InputJsonValue; effectiveFrom: Date; effectiveTo?: Date }) {
  try { new Intl.DateTimeFormat("en", { timeZone: input.timezone }).format(input.effectiveFrom); } catch { throw new Error("Time policy timezone must be a valid IANA timezone."); }
  if (input.effectiveTo && input.effectiveTo <= input.effectiveFrom) throw new Error("Time policy effective end must be after its start.");
  const policy = await tx.hrTimePolicy.findFirstOrThrow({ where: { id: input.policyId, organizationId: context.organizationId } });
  const overlapping = await tx.hrTimePolicyVersion.findFirst({ where: { timePolicyId: policy.id, publishedAt: { not: null }, effectiveFrom: { lt: input.effectiveTo ?? new Date("9999-12-31") }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.effectiveFrom } }] } });
  if (overlapping) throw new Error("Published time-policy versions cannot overlap.");
  const latest = await tx.hrTimePolicyVersion.findFirst({ where: { timePolicyId: policy.id }, orderBy: { version: "desc" } });
  const version = await tx.hrTimePolicyVersion.create({ data: { timePolicyId: policy.id, version: (latest?.version ?? 0) + 1, trackingMode: input.trackingMode, timezone: input.timezone, graceBeforeMinutes: input.graceBeforeMinutes, graceAfterMinutes: input.graceAfterMinutes, maximumOfflineDelayMin: input.maximumOfflineDelayMin, maximumFutureSkewMin: input.maximumFutureSkewMin, dailyOvertimeMinutes: input.dailyOvertimeMinutes, weeklyOvertimeMinutes: input.weeklyOvertimeMinutes, allowCategoryStacking: input.allowCategoryStacking ?? false, breakRules: input.breakRules, effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo, publishedAt: new Date(), createdById: context.actorUserId } });
  await appendHrAudit(tx, { ...context, entityType: "HrTimePolicyVersion", entityId: version.id, action: "hr.time.policy.published", newValues: { policyId: policy.id, version: version.version, trackingMode: version.trackingMode, timezone: version.timezone, effectiveFrom: version.effectiveFrom, effectiveTo: version.effectiveTo }, correlationId: version.id });
  return version;
}

export async function createTimePolicyApplicability(tx: Prisma.TransactionClient, context: Context, input: { timePolicyId: string; legalEntityId?: string; countryCode?: string; employeeType?: HrEmploymentType; positionId?: string; gradeId?: string; departmentId?: string; locationId?: string; workMode?: HrWorkMode; priority: number; effectiveFrom: Date; effectiveTo?: Date }) {
  await tx.hrTimePolicy.findFirstOrThrow({ where: { id: input.timePolicyId, organizationId: context.organizationId } });
  if (input.effectiveTo && input.effectiveTo <= input.effectiveFrom) throw new Error("Policy applicability effective end must be after its start.");
  const applicability = await tx.hrTimePolicyApplicability.create({ data: { ...input, organizationId: context.organizationId } });
  await appendHrAudit(tx, { ...context, entityType: "HrTimePolicyApplicability", entityId: applicability.id, action: "hr.time.policy.applicability_created", newValues: { timePolicyId: input.timePolicyId, priority: input.priority, effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo, scopes: { legalEntityId: input.legalEntityId, countryCode: input.countryCode, employeeType: input.employeeType, positionId: input.positionId, gradeId: input.gradeId, departmentId: input.departmentId, locationId: input.locationId, workMode: input.workMode } } });
  return applicability;
}

export async function assignTimePolicy(tx: Prisma.TransactionClient, context: Context, input: { employeeId: string; timePolicyVersionId: string; effectiveFrom: Date; effectiveTo?: Date; reason: string }) {
  if (input.effectiveTo && input.effectiveTo <= input.effectiveFrom) throw new Error("Time-policy assignment end must be after its start.");
  const [employee, assignment, relationship, version] = await Promise.all([
    tx.hrEmployee.findFirst({ where: { id: input.employeeId, organizationId: context.organizationId, employmentStatus: "ACTIVE" } }),
    tx.hrEmployeeAssignment.findFirst({ where: { organizationId: context.organizationId, employeeId: input.employeeId, status: "ACTIVE", effectiveFrom: { lte: input.effectiveFrom }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.effectiveFrom } }] }, orderBy: { effectiveFrom: "desc" } }),
    tx.hrWorkRelationship.findFirst({ where: { organizationId: context.organizationId, employeeId: input.employeeId, status: { in: ["ACTIVE", "NOTICE_PERIOD", "SUSPENDED"] }, startedAt: { lte: input.effectiveFrom }, OR: [{ endedAt: null }, { endedAt: { gt: input.effectiveFrom } }] }, orderBy: { startedAt: "desc" } }),
    tx.hrTimePolicyVersion.findFirst({ where: { id: input.timePolicyVersionId, publishedAt: { not: null }, timePolicy: { organizationId: context.organizationId, status: "ACTIVE" } }, include: { timePolicy: true } }),
  ]);
  if (!employee || !assignment || !relationship || !version) throw new Error("Time-policy assignment requires a tenant-scoped active employee, relationship, assignment, and published policy version.");
  const overlap = await tx.hrTimePolicyAssignment.findFirst({ where: { organizationId: context.organizationId, employeeId: employee.id, assignmentId: assignment.id, effectiveFrom: { lt: input.effectiveTo ?? new Date("9999-12-31T00:00:00.000Z") }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.effectiveFrom } }] } });
  if (overlap) throw new Error("Effective time-policy assignments cannot overlap for an employment assignment.");
  const policyAssignment = await tx.hrTimePolicyAssignment.create({ data: { organizationId: context.organizationId, employeeId: employee.id, workRelationshipId: relationship.id, assignmentId: assignment.id, timePolicyId: version.timePolicyId, timePolicyVersionId: version.id, effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo, reason: input.reason, assignedById: context.actorUserId } });
  await appendHrAudit(tx, { ...context, entityType: "HrTimePolicyAssignment", entityId: policyAssignment.id, action: "hr.time.policy.assigned", newValues: { employeeId: employee.id, workRelationshipId: relationship.id, assignmentId: assignment.id, timePolicyId: version.timePolicyId, timePolicyVersionId: version.id, effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo }, reason: input.reason, correlationId: policyAssignment.id });
  return policyAssignment;
}

export async function publishScheduleIntervals(tx: Prisma.TransactionClient, context: Context, input: { workScheduleVersionId: string; intervals: Array<{ weekday: number; startLocalMinute: number; endLocalMinute: number; endDayOffset?: number; expectedMinutes: number; paidBreakMinutes?: number; unpaidBreakMinutes?: number; flexibleStartMinute?: number; flexibleEndMinute?: number }> }) {
  const version = await tx.hrWorkScheduleVersion.findFirstOrThrow({ where: { id: input.workScheduleVersionId, workSchedule: { organizationId: context.organizationId } } });
  const intervals = assertNoScheduleOverlap(input.intervals);
  if (await tx.hrScheduleInterval.count({ where: { workScheduleVersionId: version.id } })) throw new Error("Published schedule intervals are immutable; create a new schedule version.");
  await tx.hrScheduleInterval.createMany({ data: intervals.map((interval, sequence) => ({ organizationId: context.organizationId, workScheduleVersionId: version.id, sequence: sequence + 1, ...interval, flexibleStartMinute: input.intervals[sequence].flexibleStartMinute, flexibleEndMinute: input.intervals[sequence].flexibleEndMinute })) });
  await appendHrAudit(tx, { ...context, entityType: "HrWorkScheduleVersion", entityId: version.id, action: "hr.time.schedule.intervals_published", newValues: { version: version.version, intervalCount: intervals.length, effectiveFrom: version.effectiveFrom, effectiveTo: version.effectiveTo } });
  return intervals.length;
}
