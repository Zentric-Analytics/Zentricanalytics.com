import type { Prisma } from "@prisma/client";
import { appendHrAudit } from "../audit";

type Scope = { organizationId: string; vacancyId: string; actorUserId: string; actorRole?: string };

async function scopedVacancy(tx: Prisma.TransactionClient, input: Scope) {
  await tx.hrUser.findFirstOrThrow({ where: { id: input.actorUserId, organizationId: input.organizationId, status: "ACTIVE" } });
  return tx.hrVacancy.findFirstOrThrow({ where: { id: input.vacancyId, organizationId: input.organizationId } });
}

function memberWhere(organizationId: string, hiringTeamId: string, userIds: string[], now: Date) {
  return {
    hiringTeamId, userId: { in: userIds }, status: "ACTIVE" as const,
    effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    user: { organizationId, status: "ACTIVE" as const },
    hiringTeam: { organizationId, status: "ACTIVE" as const },
  };
}

/** Must run in the same transaction as the approval it authorizes. No global role is granted. */
export async function assertVacancyCreatorOrDelegate(tx: Prisma.TransactionClient, input: Scope) {
  const vacancy = await scopedVacancy(tx, input);
  if (vacancy.createdById === input.actorUserId) return vacancy;
  // Hold the same row lock as manual revocation until the caller's approval commits.
  const locked = await tx.hrVacancy.updateMany({ where: { id: vacancy.id, organizationId: input.organizationId, delegationVersion: vacancy.delegationVersion }, data: { delegationVersion: { increment: 1 } } });
  if (locked.count !== 1) throw new Error("Delegation changed concurrently. Reload and try again.");
  const delegation = await tx.hrVacancyDelegation.findFirst({ where: {
    vacancyId: vacancy.id, delegateUserId: input.actorUserId, endedAt: null,
  } });
  const member = delegation && await tx.hrHiringTeamMember.findFirst({
    where: memberWhere(input.organizationId, vacancy.hiringTeamId, [input.actorUserId], new Date()),
  });
  if (!member) throw new Error("Only the vacancy creator or an active selected delegate may approve for this vacancy.");
  return vacancy;
}

/** Replaces the active delegate selection while retaining ended history. */
export async function delegateVacancyApprovals(tx: Prisma.TransactionClient, input: Scope & { delegateUserIds: string[]; reason: string }) {
  const reason = input.reason.trim();
  if (!reason || reason.length > 2000) throw new Error("Provide an absence reason of up to 2000 characters.");
  const ids = [...new Set(input.delegateUserIds)];
  if (!ids.length || ids.some((id) => !id.trim())) throw new Error("Select at least one specific hiring-team member.");
  const vacancy = await scopedVacancy(tx, input);
  if (vacancy.createdById !== input.actorUserId) throw new Error("Only the vacancy creator may assign delegates.");
  const now = new Date();
  const members = await tx.hrHiringTeamMember.findMany({ where: memberWhere(input.organizationId, vacancy.hiringTeamId, ids, now), select: { userId: true } });
  const eligible = new Set(members.map((member) => member.userId));
  if (ids.some((id) => !eligible.has(id))) throw new Error("Every delegate must be an active member of this vacancy's hiring team.");
  // Serialize replacement/end operations without overwriting another creator action.
  const changed = await tx.hrVacancy.updateMany({ where: { id: vacancy.id, organizationId: input.organizationId, delegationVersion: vacancy.delegationVersion }, data: { delegationVersion: { increment: 1 } } });
  if (changed.count !== 1) throw new Error("Vacancy changed concurrently. Reload and try again.");
  await tx.hrVacancyDelegation.updateMany({ where: { vacancyId: vacancy.id, endedAt: null }, data: { endedAt: now, endedById: input.actorUserId } });
  await tx.hrVacancyDelegation.createMany({ data: ids.map((delegateUserId) => ({ vacancyId: vacancy.id, delegateUserId, createdById: input.actorUserId, reason })) });
  await appendHrAudit(tx, { organizationId: input.organizationId, actorUserId: input.actorUserId, actorRole: input.actorRole, entityType: "HrVacancy", entityId: vacancy.id, action: "hr.recruitment.vacancy.delegated", reason, newValues: { delegateUserIds: ids } });
}

export async function endVacancyDelegation(tx: Prisma.TransactionClient, input: Scope) {
  const vacancy = await scopedVacancy(tx, input);
  if (vacancy.createdById !== input.actorUserId) throw new Error("Only the vacancy creator may end delegation.");
  const changed = await tx.hrVacancy.updateMany({ where: { id: vacancy.id, organizationId: input.organizationId, delegationVersion: vacancy.delegationVersion }, data: { delegationVersion: { increment: 1 } } });
  if (changed.count !== 1) throw new Error("Vacancy changed concurrently. Reload and try again.");
  const result = await tx.hrVacancyDelegation.updateMany({ where: { vacancyId: vacancy.id, endedAt: null }, data: { endedAt: new Date(), endedById: input.actorUserId } });
  await appendHrAudit(tx, { organizationId: input.organizationId, actorUserId: input.actorUserId, actorRole: input.actorRole, entityType: "HrVacancy", entityId: vacancy.id, action: "hr.recruitment.vacancy.delegation-ended", reason: "Creator manually ended delegation", newValues: { endedCount: result.count } });
}
