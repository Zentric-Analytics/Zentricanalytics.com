import { prisma } from './prisma';
import { stages, generateApplicationId } from './hiring';

export async function nextApplicationId() {
  const count = await prisma.jobApplication.count();
  return generateApplicationId(count + 1);
}

export async function createStageRows(applicationId: string) {
  await prisma.hiringStage.createMany({ data: stages.map((stage) => ({
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
