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

export async function publishScheduleIntervals(tx: Prisma.TransactionClient, context: Context, input: { workScheduleVersionId: string; intervals: Array<{ weekday: number; startLocalMinute: number; endLocalMinute: number; endDayOffset?: number; expectedMinutes: number; paidBreakMinutes?: number; unpaidBreakMinutes?: number; flexibleStartMinute?: number; flexibleEndMinute?: number }> }) {
  const version = await tx.hrWorkScheduleVersion.findFirstOrThrow({ where: { id: input.workScheduleVersionId, workSchedule: { organizationId: context.organizationId } } });
  const intervals = assertNoScheduleOverlap(input.intervals);
  if (await tx.hrScheduleInterval.count({ where: { workScheduleVersionId: version.id } })) throw new Error("Published schedule intervals are immutable; create a new schedule version.");
  await tx.hrScheduleInterval.createMany({ data: intervals.map((interval, sequence) => ({ organizationId: context.organizationId, workScheduleVersionId: version.id, sequence: sequence + 1, ...interval, flexibleStartMinute: input.intervals[sequence].flexibleStartMinute, flexibleEndMinute: input.intervals[sequence].flexibleEndMinute })) });
  await appendHrAudit(tx, { ...context, entityType: "HrWorkScheduleVersion", entityId: version.id, action: "hr.time.schedule.intervals_published", newValues: { version: version.version, intervalCount: intervals.length, effectiveFrom: version.effectiveFrom, effectiveTo: version.effectiveTo } });
  return intervals.length;
}
