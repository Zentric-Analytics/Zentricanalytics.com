import type { Prisma } from "@prisma/client";
import { enqueueHrEmail } from "../notifications/outbox";

/** Route submission notices without including submitted documents or form data. */
export async function notifyRecruitmentStageSubmitted(tx: Prisma.TransactionClient, input: { applicationId: string; stage: 2 | 3 | 5 | 6 | 7; submissionId: string }) {
  const app = await tx.jobApplication.findUniqueOrThrow({ where: { id: input.applicationId } });
  if (!app.organizationId) return 0; // Unmapped historical applications require administrative reconciliation.
  if (!app.vacancyId || app.deletedAt) throw new Error("A current vacancy link is required for submission routing.");
  const vacancy = await tx.hrVacancy.findFirstOrThrow({ where: { id: app.vacancyId, organizationId: app.organizationId } });
  const recipients: Array<{ id: string; email: string }> = [];
  if (input.stage >= 6) {
    if (!vacancy.responsibleHrUserId) throw new Error("A named HR reviewer must be assigned before submission.");
    recipients.push(await tx.hrUser.findFirstOrThrow({ where: { id: vacancy.responsibleHrUserId, organizationId: app.organizationId, status: "ACTIVE" }, select: { id: true, email: true } }));
  } else {
    const now = new Date();
    const members = await tx.hrHiringTeamMember.findMany({ where: { hiringTeamId: vacancy.hiringTeamId, status: "ACTIVE", effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }], user: { organizationId: app.organizationId, status: "ACTIVE" }, hiringTeam: { organizationId: app.organizationId, status: "ACTIVE" } }, include: { user: true } });
    recipients.push(...members.map(member => member.user));
    if (input.stage === 5) {
      const creator = await tx.hrUser.findFirst({ where: { id: vacancy.createdById, organizationId: app.organizationId, status: "ACTIVE" }, select: { id: true, email: true } });
      if (creator) recipients.push(creator);
    }
  }
  const unique = [...new Map(recipients.map(person => [person.id, person])).values()];
  if (!unique.length) throw new Error("No active reviewer is available for this submission.");
  for (const person of unique) await enqueueHrEmail(tx, { organizationId: app.organizationId, recipient: person.email, template: "hr-recruitment-stage-submitted", subject: `Application stage ${input.stage} is ready for review`, payload: { applicationId: app.id, stage: input.stage, href: `/hr/recruitment/${app.id}` }, idempotencyKey: `stage-submitted:${input.submissionId}:${person.id}` });
  return unique.length;
}
