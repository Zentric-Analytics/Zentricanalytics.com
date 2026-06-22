import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { stages, generateApplicationId } from './hiring';

export async function nextApplicationId(tx: Prisma.TransactionClient | typeof prisma = prisma, date = new Date()) {
  const year = date.getUTCFullYear();
  const sequence = await tx.applicationSequence.upsert({
    where: { year },
    create: { year, nextValue: 2 },
    update: { nextValue: { increment: 1 } },
  });
  return generateApplicationId(sequence.nextValue - 1, date);
}

export async function createApplicationWithRetry<T>(create: (applicationId: string) => Promise<T>, date = new Date(), attempts = 3) {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const applicationId = await nextApplicationId(prisma, date);
    try { return await create(applicationId); } catch (error) {
      lastError = error;
      if (!(typeof error === 'object' && error && 'code' in error && error.code === 'P2002')) throw error;
    }
  }
  throw lastError;
}

export async function createStageRows(applicationId: string, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  await tx.hiringStage.createMany({ data: stages.map((stage) => ({
    applicationId, stageKey: stage.key, stageOrder: stage.order, title: stage.title,
    status: stage.order === 1 ? 'Under Review' : 'Locked', unlockedAt: stage.order === 1 ? new Date() : null,
  })) });
}

export async function approveStage1(applicationId: string, adminEmail: string, notes?: string) {
  const stage1 = await prisma.hiringStage.findFirstOrThrow({ where: { applicationId, stageOrder: 1 } });
  const stage2 = await prisma.hiringStage.findFirstOrThrow({ where: { applicationId, stageOrder: 2 } });
  await prisma.$transaction([
    prisma.hiringStage.update({ where: { id: stage1.id }, data: { status: 'Approved', approvedAt: new Date() } }),
    prisma.hiringStage.update({ where: { id: stage2.id }, data: { status: 'Available', unlockedAt: new Date() } }),
    prisma.jobApplication.update({ where: { id: applicationId }, data: { status: 'Candidate Information Required', currentStageOrder: 2 } }),
    prisma.stageApproval.create({ data: { stageId: stage1.id, action: 'Approved', adminEmail, notes } }),
    prisma.auditLog.create({ data: { applicationId, actorType: 'admin', actorRef: adminEmail, action: 'Admin approved Stage 1', metadata: { notes } } }),
  ]);
}

export async function recordAdminStage1Action(applicationId: string, action: 'Rejected' | 'Correction Requested', adminEmail: string, notes?: string) {
  const stage1 = await prisma.hiringStage.findFirstOrThrow({ where: { applicationId, stageOrder: 1 } });
  await prisma.$transaction([
    prisma.hiringStage.update({ where: { id: stage1.id }, data: { status: action } }),
    prisma.jobApplication.update({ where: { id: applicationId }, data: { status: action === 'Rejected' ? 'Rejected' : 'Application Submitted' } }),
    prisma.stageApproval.create({ data: { stageId: stage1.id, action, adminEmail, notes } }),
    prisma.auditLog.create({ data: { applicationId, actorType: 'admin', actorRef: adminEmail, action: action === 'Rejected' ? 'Admin rejected Stage 1' : 'Admin requested correction', metadata: { notes } } }),
  ]);
}
