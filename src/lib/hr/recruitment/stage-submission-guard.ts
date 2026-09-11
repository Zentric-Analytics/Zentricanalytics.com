import type { Prisma } from '@prisma/client';
import { StageAuthorityError } from './stage-authority-error';

export class StageSubmissionChangedError extends StageAuthorityError {
  constructor() { super('The applicant submission changed. Reload and review the current response.'); }
}

/** The stage lock orders candidate submission commits with reviewer decisions. */
export async function assertStageSubmissionSnapshot(tx: Prisma.TransactionClient, input: {
  applicationId: string; organizationId: string; stage: number; expectedSubmissionId: string | null;
}) {
  if (input.expectedSubmissionId === null) throw new StageSubmissionChangedError();
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT s.id FROM "HiringStage" s
    JOIN "JobApplication" a ON a.id = s."applicationId"
    WHERE a.id = ${input.applicationId} AND a."organizationId" = ${input.organizationId}
      AND s."stageOrder" = ${input.stage} FOR SHARE OF s`;
  if (rows.length !== 1) throw new StageSubmissionChangedError();
  const latest = await tx.stageSubmission.findFirst({ where: { stageId: rows[0].id }, orderBy: { version: 'desc' }, select: { id: true } });
  if ((latest?.id ?? '') !== input.expectedSubmissionId) throw new StageSubmissionChangedError();
}
