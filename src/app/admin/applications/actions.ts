'use server';
import { revalidatePath } from 'next/cache';
import { isAdminSecretValid } from '@/lib/security';
import { approveStage1, recordAdminStage1Action } from '@/lib/workflow';
import { sendAndRecordEmail } from '@/lib/email';
import { prisma } from '@/lib/prisma';

export async function adminStage1Action(formData: FormData) {
  const secret = String(formData.get('adminSecret') ?? '');
  if (!isAdminSecretValid(secret)) throw new Error('Unauthorized');
  const applicationId = String(formData.get('applicationDbId'));
  const action = String(formData.get('action'));
  const notes = String(formData.get('notes') ?? '');
  const adminEmail = String(formData.get('adminEmail') ?? 'admin@zentricanalytics.com');
  if (action === 'approve') {
    await approveStage1(applicationId, adminEmail, notes);
    const app = await prisma.jobApplication.findUniqueOrThrow({ where: { id: applicationId }, include: { applicant: true } });
    await sendAndRecordEmail({ applicationId, to: app.applicant.email, template: 'stage-2-unlocked', subject: `Next stage unlocked: ${app.applicationId}`, body: `Stage 1 has been approved. Please return to Track Application to continue.` });
  } else if (action === 'reject') await recordAdminStage1Action(applicationId, 'Rejected', adminEmail, notes);
  else await recordAdminStage1Action(applicationId, 'Correction Requested', adminEmail, notes);
  revalidatePath('/admin/applications');
}
