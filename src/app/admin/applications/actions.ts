'use server';
import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '@/lib/admin-auth';
import { approveStage1, recordAdminStage1Action } from '@/lib/workflow';
import { sendAndRecordEmail } from '@/lib/email';
import { prisma } from '@/lib/prisma';

export async function adminStage1Action(formData: FormData) {
  const adminSession = await requireAdminSession();
  const applicationId = String(formData.get('applicationDbId'));
  const action = String(formData.get('action'));
  const notes = String(formData.get('notes') ?? '');
  const adminEmail = adminSession.email;
  if (action === 'approve') {
    await approveStage1(applicationId, adminEmail, notes);
    const app = await prisma.jobApplication.findUniqueOrThrow({ where: { id: applicationId }, include: { applicant: true } });
    await sendAndRecordEmail({ applicationId, to: app.applicant.email, template: 'stage-2-unlocked', subject: `Next stage unlocked: ${app.applicationId}`, body: `Stage 1 has been approved. Please return to Track Application to continue.` });
  } else if (action === 'reject') {
    await recordAdminStage1Action(applicationId, 'Rejected', adminEmail, notes);
    const app = await prisma.jobApplication.findUniqueOrThrow({ where: { id: applicationId }, include: { applicant: true } });
    await sendAndRecordEmail({ applicationId, to: app.applicant.email, template: 'application-rejected', subject: `Application update: ${app.applicationId}`, body: `Thank you for your interest in Zentric Analytics. We are unable to move your application forward at this time.` });
  } else {
    await recordAdminStage1Action(applicationId, 'Correction Requested', adminEmail, notes);
    const app = await prisma.jobApplication.findUniqueOrThrow({ where: { id: applicationId }, include: { applicant: true } });
    await sendAndRecordEmail({ applicationId, to: app.applicant.email, template: 'correction-requested', subject: `Correction requested: ${app.applicationId}`, body: `A correction has been requested for your application. Please return to Track Application to review the request.` });
  }
  revalidatePath('/admin/applications');
}
