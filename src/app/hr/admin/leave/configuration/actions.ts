"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { validateWeeklyPattern } from "@/lib/hr/leave/unit5";

const code = z.string().trim().min(2).max(32).regex(/^[A-Za-z0-9_-]+$/).transform((value) => value.toUpperCase());
const dateRangeFields = { effectiveFrom: z.coerce.date(), effectiveTo: z.coerce.date().optional().or(z.literal("")).transform((value) => value === "" ? undefined : value) };
function assertDateRange(input: { effectiveFrom: Date; effectiveTo?: Date }) { if (input.effectiveTo && input.effectiveTo <= input.effectiveFrom) throw new Error("Effective end must be after start."); }

export async function createWorkScheduleAction(formData: FormData) {
  const auth = await requirePermission("leave.policy.manage");
  const input = z.object({ code, name: z.string().trim().min(2).max(120), timezone: z.string().trim().min(3).max(100), weeklyPattern: z.string().min(2), ...dateRangeFields }).parse(Object.fromEntries(formData));
  assertDateRange(input);
  const weeklyPattern = validateWeeklyPattern(JSON.parse(input.weeklyPattern));
  await prisma.$transaction(async (tx) => {
    const schedule = await tx.hrWorkSchedule.upsert({ where: { organizationId_code: { organizationId: auth.user.organizationId, code: input.code } }, update: {}, create: { organizationId: auth.user.organizationId, code: input.code, name: input.name } });
    const latest = await tx.hrWorkScheduleVersion.findFirst({ where: { workScheduleId: schedule.id }, orderBy: { version: "desc" } });
    if (latest && (!latest.effectiveTo || latest.effectiveTo > input.effectiveFrom)) throw new Error("Close the prior schedule version before publishing an overlapping version.");
    const version = await tx.hrWorkScheduleVersion.create({ data: { workScheduleId: schedule.id, version: (latest?.version ?? 0) + 1, timezone: input.timezone, weeklyPattern, effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo, publishedAt: new Date(), createdById: auth.user.id } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrWorkScheduleVersion", entityId: version.id, action: "hr.leave.schedule.published", newValues: { scheduleId: schedule.id, version: version.version, timezone: input.timezone, effectiveFrom: input.effectiveFrom } });
  }, { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/leave/configuration");
}

export async function assignWorkScheduleAction(formData: FormData) {
  const auth = await requirePermission("leave.policy.manage");
  const input = z.object({ employeeId: z.string().cuid(), workScheduleVersionId: z.string().cuid(), reason: z.string().trim().min(3).max(500), ...dateRangeFields }).parse(Object.fromEntries(formData));
  assertDateRange(input);
  const [employee, version] = await Promise.all([
    prisma.hrEmployee.findFirstOrThrow({ where: { id: input.employeeId, organizationId: auth.user.organizationId } }),
    prisma.hrWorkScheduleVersion.findFirstOrThrow({ where: { id: input.workScheduleVersionId, workSchedule: { organizationId: auth.user.organizationId } } }),
  ]);
  await prisma.$transaction(async (tx) => {
    const assignment = await tx.hrWorkScheduleAssignment.create({ data: { organizationId: auth.user.organizationId, employeeId: employee.id, workScheduleId: version.workScheduleId, workScheduleVersionId: version.id, effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo, reason: input.reason, assignedById: auth.user.id } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrWorkScheduleAssignment", entityId: assignment.id, action: "hr.leave.schedule.assigned", newValues: { employeeId: employee.id, scheduleVersionId: version.id, effectiveFrom: input.effectiveFrom }, reason: input.reason });
  });
  revalidatePath("/hr/admin/leave/configuration");
}

export async function createHolidayCalendarAction(formData: FormData) {
  const auth = await requirePermission("leave.policy.manage");
  const input = z.object({ code, name: z.string().trim().min(2).max(120), timezone: z.string().trim().min(3).max(100), ...dateRangeFields }).parse(Object.fromEntries(formData));
  assertDateRange(input);
  await prisma.$transaction(async (tx) => {
    const calendar = await tx.hrHolidayCalendar.upsert({ where: { organizationId_code: { organizationId: auth.user.organizationId, code: input.code } }, update: {}, create: { organizationId: auth.user.organizationId, code: input.code, name: input.name } });
    const latest = await tx.hrHolidayCalendarVersion.findFirst({ where: { holidayCalendarId: calendar.id }, orderBy: { version: "desc" } });
    if (latest && (!latest.effectiveTo || latest.effectiveTo > input.effectiveFrom)) throw new Error("Close the prior calendar version before publishing an overlapping version.");
    const version = await tx.hrHolidayCalendarVersion.create({ data: { holidayCalendarId: calendar.id, version: (latest?.version ?? 0) + 1, timezone: input.timezone, effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo, publishedAt: new Date(), createdById: auth.user.id } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrHolidayCalendarVersion", entityId: version.id, action: "hr.leave.calendar.published", newValues: { calendarId: calendar.id, version: version.version, timezone: input.timezone } });
  }, { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/leave/configuration");
}

export async function assignHolidayCalendarAction(formData: FormData) {
  const auth = await requirePermission("leave.policy.manage");
  const input = z.object({ employeeId: z.string().cuid(), holidayCalendarVersionId: z.string().cuid(), reason: z.string().trim().min(3).max(500), ...dateRangeFields }).parse(Object.fromEntries(formData));
  assertDateRange(input);
  const [employee, version] = await Promise.all([
    prisma.hrEmployee.findFirstOrThrow({ where: { id: input.employeeId, organizationId: auth.user.organizationId } }),
    prisma.hrHolidayCalendarVersion.findFirstOrThrow({ where: { id: input.holidayCalendarVersionId, holidayCalendar: { organizationId: auth.user.organizationId } } }),
  ]);
  await prisma.$transaction(async (tx) => {
    const assignment = await tx.hrHolidayCalendarAssignment.create({ data: { organizationId: auth.user.organizationId, employeeId: employee.id, holidayCalendarId: version.holidayCalendarId, holidayCalendarVersionId: version.id, effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo, reason: input.reason, assignedById: auth.user.id } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrHolidayCalendarAssignment", entityId: assignment.id, action: "hr.leave.calendar.assigned", newValues: { employeeId: employee.id, calendarVersionId: version.id, effectiveFrom: input.effectiveFrom }, reason: input.reason });
  });
  revalidatePath("/hr/admin/leave/configuration");
}

export async function addHolidayOccurrenceAction(formData: FormData) {
  const auth = await requirePermission("leave.policy.manage");
  const input = z.object({ holidayCalendarVersionId: z.string().cuid(), code, name: z.string().trim().min(2).max(120), localDate: z.coerce.date(), durationMinutes: z.coerce.number().int().positive().max(1440).optional().or(z.literal("")).transform((value) => value === "" ? undefined : value), companyShutdown: z.coerce.boolean() }).parse({ ...Object.fromEntries(formData), companyShutdown: formData.has("companyShutdown") });
  const version = await prisma.hrHolidayCalendarVersion.findFirstOrThrow({ where: { id: input.holidayCalendarVersionId, holidayCalendar: { organizationId: auth.user.organizationId } } });
  await prisma.$transaction(async (tx) => {
    const occurrence = await tx.hrHolidayOccurrence.create({ data: { holidayCalendarVersionId: version.id, code: input.code, name: input.name, localDate: input.localDate, durationMinutes: input.durationMinutes, companyShutdown: input.companyShutdown } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrHolidayOccurrence", entityId: occurrence.id, action: "hr.leave.calendar.occurrence.created", newValues: { calendarVersionId: version.id, code: input.code, localDate: input.localDate } });
  });
  revalidatePath("/hr/admin/leave/configuration");
}

export async function createPolicyApplicabilityAction(formData: FormData) {
  const auth = await requirePermission("leave.policy.manage");
  const optional = z.string().trim().optional().transform((value) => value || undefined);
  const input = z.object({ leavePolicyId: z.string().cuid(), countryCode: optional, legalEntityId: optional, locationId: optional, employmentType: optional, gradeId: optional, minimumTenureDays: z.coerce.number().int().nonnegative().optional().or(z.literal("")).transform((value) => value === "" ? undefined : value), priority: z.coerce.number().int().min(-1000).max(1000) }).parse(Object.fromEntries(formData));
  const policy = await prisma.hrLeavePolicy.findFirstOrThrow({ where: { id: input.leavePolicyId, organizationId: auth.user.organizationId } });
  await prisma.$transaction(async (tx) => {
    const applicability = await tx.hrLeavePolicyApplicability.create({ data: { organizationId: auth.user.organizationId, leavePolicyId: policy.id, countryCode: input.countryCode, legalEntityId: input.legalEntityId, locationId: input.locationId, employmentType: input.employmentType as never, gradeId: input.gradeId, minimumTenureDays: input.minimumTenureDays, priority: input.priority } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrLeavePolicyApplicability", entityId: applicability.id, action: "hr.leave.policy.applicability.created", newValues: input });
  });
  revalidatePath("/hr/admin/leave/configuration");
}
