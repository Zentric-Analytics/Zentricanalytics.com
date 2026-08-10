import { z } from "zod";
import { HR_PERMISSIONS, type HrPermissionKey } from "../permissions/catalog";

export const HIRING_TEAM_MEMBER_PERMISSIONS = HR_PERMISSIONS.filter((permission) =>
  permission.startsWith("vacancy.")
  || permission.startsWith("application.")
  || permission.startsWith("interview.")
  || permission.startsWith("assessment.")
  || permission.startsWith("offer.")
  || permission.startsWith("handover."),
);

export const hiringTeamInput = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional().transform((value) => value || undefined),
  departmentId: z.string().cuid().optional().or(z.literal("")).transform((value) => value || undefined),
  defaultResponsibleHrTeamId: z.string().cuid().optional().or(z.literal("")).transform((value) => value || undefined),
});

export const hiringTeamMemberInput = z.object({
  hiringTeamId: z.string().cuid(),
  userId: z.string().cuid(),
  permissions: z.array(z.enum(HIRING_TEAM_MEMBER_PERMISSIONS as [HrPermissionKey, ...HrPermissionKey[]])).min(1),
  expectedVersion: z.coerce.number().int().positive().default(1),
});

export type RecruitmentRoutingRule = {
  id: string;
  priority: number;
  departmentId: string | null;
  legalEntityId: string | null;
  locationId: string | null;
  employmentType: string | null;
  ownerTeamId: string | null;
  ownerUserId: string | null;
};

export function selectRecruitmentRoute(
  rules: RecruitmentRoutingRule[],
  context: { departmentId?: string | null; legalEntityId?: string | null; locationId?: string | null; employmentType?: string | null },
) {
  const matches = rules.filter((rule) =>
    (!rule.departmentId || rule.departmentId === context.departmentId)
    && (!rule.legalEntityId || rule.legalEntityId === context.legalEntityId)
    && (!rule.locationId || rule.locationId === context.locationId)
    && (!rule.employmentType || rule.employmentType === context.employmentType),
  );
  return matches.sort((a, b) => {
    const specificityA = [a.departmentId, a.legalEntityId, a.locationId, a.employmentType].filter(Boolean).length;
    const specificityB = [b.departmentId, b.legalEntityId, b.locationId, b.employmentType].filter(Boolean).length;
    return specificityB - specificityA || a.priority - b.priority || a.id.localeCompare(b.id);
  })[0] ?? null;
}

export function effectiveHiringTeamPermissions(input: {
  organizationPermissions: ReadonlySet<string>;
  membershipActive: boolean;
  teamPermissions: readonly string[];
}) {
  if (!input.membershipActive) return new Set<string>();
  return new Set(input.teamPermissions.filter((permission) => input.organizationPermissions.has(permission)));
}

export function assertHiringTeamPermission(input: {
  organizationPermissions: ReadonlySet<string>;
  membershipActive: boolean;
  teamPermissions: readonly string[];
  required: HrPermissionKey;
}) {
  if (!effectiveHiringTeamPermissions(input).has(input.required)) {
    throw new Error(`Hiring Team permission required: ${input.required}.`);
  }
}

export function assertOptimisticVersion(actual: number, expected: number) {
  if (actual !== expected) throw new Error("This Hiring Team was updated by another user. Reload and try again.");
}
