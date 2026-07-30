import { z } from "zod";

const code = z.string().trim().min(2).max(32).regex(/^[A-Za-z0-9_-]+$/).transform((value) => value.toUpperCase());
const optionalText = z.string().trim().max(500).optional().transform((value) => value || undefined);

export const departmentInput = z.object({
  code,
  name: z.string().trim().min(2).max(120),
  description: optionalText,
});

export const positionInput = z.object({
  code,
  title: z.string().trim().min(2).max(120),
  departmentId: z.string().cuid(),
  teamId: z.string().cuid().optional().or(z.literal("")).transform((value) => value || undefined),
  description: optionalText,
  salaryBandMinimum: z.coerce.number().nonnegative().optional().or(z.literal("")).transform((value) => value === "" ? undefined : value),
  salaryBandMaximum: z.coerce.number().nonnegative().optional().or(z.literal("")).transform((value) => value === "" ? undefined : value),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
}).refine(({ salaryBandMinimum, salaryBandMaximum }) => salaryBandMinimum === undefined || salaryBandMaximum === undefined || salaryBandMinimum <= salaryBandMaximum, {
  message: "Salary band minimum cannot exceed maximum.",
  path: ["salaryBandMaximum"],
});

export const employeeInput = z.object({
  employeeNumber: code,
  legalFirstName: z.string().trim().min(1).max(80),
  middleName: z.string().trim().max(80).optional().transform((value) => value || undefined),
  lastName: z.string().trim().min(1).max(80),
  preferredName: z.string().trim().max(80).optional().transform((value) => value || undefined),
  companyEmail: z.string().trim().email().max(180).optional().or(z.literal("")).transform((value) => value ? value.toLowerCase() : undefined),
  personalEmail: z.string().trim().email().max(180).optional().or(z.literal("")).transform((value) => value ? value.toLowerCase() : undefined),
  preferredNotificationEmail: z.string().trim().email().max(180).optional().or(z.literal("")).transform((value) => value ? value.toLowerCase() : undefined),
  companyEmailStatus: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "DISABLED"]).default("PENDING"),
  phone: z.string().trim().max(40).optional().transform((value) => value || undefined),
  hireDate: z.coerce.date(),
  startDate: z.coerce.date().optional().or(z.literal("")).transform((value) => value === "" ? undefined : value),
  workMode: z.enum(["ONSITE", "HYBRID", "REMOTE"]).optional().or(z.literal("")).transform((value) => value || undefined),
  probationEndDate: z.coerce.date().optional().or(z.literal("")).transform((value) => value === "" ? undefined : value),
  confirmationDate: z.coerce.date().optional().or(z.literal("")).transform((value) => value === "" ? undefined : value),
  noticePeriodStartDate: z.coerce.date().optional().or(z.literal("")).transform((value) => value === "" ? undefined : value),
  notes: z.string().trim().max(2000).optional().transform((value) => value || undefined),
  employmentStatus: z.enum(["DRAFT", "ONBOARDING", "ACTIVE", "ON_LEAVE", "SUSPENDED", "NOTICE_PERIOD", "TERMINATED", "RESIGNED"]),
});

export const employeeCreateInput = employeeInput.extend({
  employeeNumber: z.union([code, z.literal("")]).optional().transform((value) => value || undefined),
});

export const assignmentInput = z.object({
  employeeId: z.string().cuid(),
  departmentId: z.string().cuid(),
  teamId: z.string().cuid().optional().or(z.literal("")).transform((value) => value || undefined),
  positionId: z.string().cuid(),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN", "TEMPORARY"]),
  location: z.string().trim().max(120).optional().transform((value) => value || undefined),
  fte: z.coerce.number().positive().max(2).default(1),
  isPrimary: z.enum(["true", "false"]).optional().default("true").transform(value => value === "true"),
  effectiveFrom: z.coerce.date(),
  reason: z.string().trim().min(3).max(500),
});

export function rangesOverlap(left: { effectiveFrom: Date; effectiveTo: Date | null }, right: { effectiveFrom: Date; effectiveTo: Date | null }) {
  const leftEnd = left.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY;
  const rightEnd = right.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY;
  return left.effectiveFrom.getTime() < rightEnd && right.effectiveFrom.getTime() < leftEnd;
}

export function lastFour(value: string) {
  const normalized = value.replace(/\s+/g, "");
  return normalized.length <= 4 ? normalized : normalized.slice(-4);
}

export function wouldCreateSupervisorCycle(assignments: Array<{ supervisorEmployeeId: string; assignedEmployeeId: string | null }>, supervisorEmployeeId: string, assignedEmployeeId: string) {
  if (supervisorEmployeeId === assignedEmployeeId) return true;
  const reports = new Map<string, string[]>();
  for (const assignment of assignments) {
    if (!assignment.assignedEmployeeId) continue;
    reports.set(assignment.supervisorEmployeeId, [...(reports.get(assignment.supervisorEmployeeId) ?? []), assignment.assignedEmployeeId]);
  }
  const pending = [assignedEmployeeId];
  const visited = new Set<string>();
  while (pending.length) {
    const employeeId = pending.pop()!;
    if (employeeId === supervisorEmployeeId) return true;
    if (visited.has(employeeId)) continue;
    visited.add(employeeId);
    pending.push(...(reports.get(employeeId) ?? []));
  }
  return false;
}
