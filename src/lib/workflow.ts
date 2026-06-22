import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { stages, generateApplicationId } from './hiring';

export class StageActionError extends Error {
  constructor(public code: 'missing_application' | 'missing_stage' | 'action_failed', message: string) { super(message); this.name = 'StageActionError'; }
}

export async function nextApplicationId(tx: Prisma.TransactionClient | typeof prisma = prisma, date = new Date()) {
  const year = date.getUTCFullYear();
  const sequence = await tx.applicationSequence.upsert({ where: { year }, create: { year, nextValue: 2 }, update: { nextValue: { increment: 1 } } });
  return generateApplicationId(sequence.nextValue - 1, date);
}

export async function createApplicationWithRetry<T>(create: (applicationId: string) => Promise<T>, date = new Date(), attempts = 3) {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const applicationId = await nextApplicationId(prisma, date);
    try { return await create(applicationId); } catch (error) { lastError = error; if (!(typeof error === 'object' && error && 'code' in error && error.code === 'P2002')) throw error; }
  }
  throw lastError;
}

export async function createStageRows(applicationId: string, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  await tx.hiringStage.createMany({ data: stages.map((stage) => ({ applicationId, stageKey: stage.key, stageOrder: stage.order, title: stage.title, status: stage.order === 1 ? 'Under Review' : 'Locked', unlockedAt: stage.order === 1 ? new Date() : null })) });
}

export async function approveStage1(applicationId: string, adminEmail: string, notes?: string) {
  return prisma.$transaction(async (tx) => {
    const app = await tx.jobApplication.findUnique({ where: { id: applicationId } });
    if (!app) throw new StageActionError('missing_application', 'Application not found.');
    const [stage1, stage2] = await Promise.all([
      tx.hiringStage.findFirst({ where: { applicationId, stageOrder: 1 } }),
      tx.hiringStage.findFirst({ where: { applicationId, stageOrder: 2 } }),
    ]);
    if (!stage1 || !stage2) throw new StageActionError('missing_stage', 'Required stage row is missing.');
    const alreadyApproved = stage1.status === 'Approved';
    if (!alreadyApproved) await tx.hiringStage.update({ where: { id: stage1.id }, data: { status: 'Approved', approvedAt: new Date() } });
    if (stage2.status !== 'Available') await tx.hiringStage.update({ where: { id: stage2.id }, data: { status: 'Available', unlockedAt: stage2.unlockedAt ?? new Date() } });
    await tx.jobApplication.update({ where: { id: applicationId }, data: { status: 'Candidate Information Required', currentStageOrder: 2 } });
    if (!alreadyApproved) await tx.stageApproval.create({ data: { stageId: stage1.id, action: 'Approved', adminEmail, notes } });
    await tx.auditLog.create({ data: { applicationId, actorType: 'admin', actorRef: adminEmail, action: alreadyApproved ? 'Admin approval skipped; Stage 1 already approved' : 'Admin approved Stage 1', metadata: { alreadyApproved } } });
    return { alreadyApproved, stage1Found: true, stage2Found: true, previousStage1Status: stage1.status };
  });
}

export async function recordAdminStage1Action(applicationId: string, action: 'Rejected' | 'Correction Requested', adminEmail: string, notes?: string) {
  return prisma.$transaction(async (tx) => {
    const app = await tx.jobApplication.findUnique({ where: { id: applicationId } });
    if (!app) throw new StageActionError('missing_application', 'Application not found.');
    const stage1 = await tx.hiringStage.findFirst({ where: { applicationId, stageOrder: 1 } });
    if (!stage1) throw new StageActionError('missing_stage', 'Stage 1 row is missing.');
    const alreadySameStatus = stage1.status === action;
    if (!alreadySameStatus) await tx.hiringStage.update({ where: { id: stage1.id }, data: { status: action } });
    await tx.jobApplication.update({ where: { id: applicationId }, data: { status: action === 'Rejected' ? 'Rejected' : 'Application Submitted' } });
    if (!alreadySameStatus) await tx.stageApproval.create({ data: { stageId: stage1.id, action, adminEmail, notes } });
    await tx.auditLog.create({ data: { applicationId, actorType: 'admin', actorRef: adminEmail, action: action === 'Rejected' ? 'Admin rejected Stage 1' : 'Admin requested correction', metadata: { alreadySameStatus } } });
    return { alreadySameStatus, stage1Found: true, stage2Found: null, previousStage1Status: stage1.status };
  });
}

export async function approveStage2(applicationId: string, adminEmail: string, notes?: string) {
  return prisma.$transaction(async (tx) => {
    const app = await tx.jobApplication.findUnique({ where: { id: applicationId } });
    if (!app || app.deletedAt) throw new StageActionError('missing_application', 'Application not found.');
    const [stage2, stage3] = await Promise.all([
      tx.hiringStage.findFirst({ where: { applicationId, stageOrder: 2 } }),
      tx.hiringStage.findFirst({ where: { applicationId, stageOrder: 3 } }),
    ]);
    if (!stage2 || !stage3) throw new StageActionError('missing_stage', 'Required stage row is missing.');
    const alreadyApproved = stage2.status === 'Approved';
    if (!alreadyApproved) await tx.hiringStage.update({ where: { id: stage2.id }, data: { status: 'Approved', approvedAt: new Date() } });
    if (stage3.status === 'Locked') await tx.hiringStage.update({ where: { id: stage3.id }, data: { status: 'Available', unlockedAt: stage3.unlockedAt ?? new Date() } });
    await tx.jobApplication.update({ where: { id: applicationId }, data: { status: 'Screening', currentStageOrder: 3 } });
    if (!alreadyApproved) await tx.stageApproval.create({ data: { stageId: stage2.id, action: 'Approved', adminEmail, notes } });
    await tx.auditLog.create({ data: { applicationId, actorType: 'admin', actorRef: adminEmail, action: alreadyApproved ? 'Admin approval skipped; Stage 2 already approved' : 'Admin approved Stage 2', metadata: { alreadyApproved } } });
    return { alreadyApproved, stage2Found: true, stage3Found: true, previousStage2Status: stage2.status };
  });
}

export async function recordAdminStage2Action(applicationId: string, action: 'Rejected' | 'Correction Requested', adminEmail: string, notes?: string) {
  return prisma.$transaction(async (tx) => {
    const app = await tx.jobApplication.findUnique({ where: { id: applicationId } });
    if (!app || app.deletedAt) throw new StageActionError('missing_application', 'Application not found.');
    const stage2 = await tx.hiringStage.findFirst({ where: { applicationId, stageOrder: 2 } });
    if (!stage2) throw new StageActionError('missing_stage', 'Stage 2 row is missing.');
    const alreadySameStatus = stage2.status === action;
    if (!alreadySameStatus) await tx.hiringStage.update({ where: { id: stage2.id }, data: { status: action } });
    await tx.jobApplication.update({ where: { id: applicationId }, data: { status: action === 'Rejected' ? 'Rejected' : 'Candidate Information Required' } });
    if (!alreadySameStatus) await tx.stageApproval.create({ data: { stageId: stage2.id, action, adminEmail, notes } });
    await tx.auditLog.create({ data: { applicationId, actorType: 'admin', actorRef: adminEmail, action: action === 'Rejected' ? 'Admin rejected Stage 2' : 'Admin requested Stage 2 correction', metadata: { alreadySameStatus } } });
    return { alreadySameStatus, stage2Found: true, previousStage2Status: stage2.status };
  });
}
