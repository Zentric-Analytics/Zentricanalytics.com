'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/admin-auth';
import { approveStage1, recordAdminStage1Action, StageActionError } from '@/lib/workflow';
import { sendAndRecordEmail } from '@/lib/email';
import { prisma } from '@/lib/prisma';

function logAdminDiagnostics(diagnostics: Record<string, unknown>) { console.info('adminStageActionDiagnostics', diagnostics); }
function redirectPath(applicationId?: string | null, params = '') { return applicationId ? `/admin/applications/${applicationId}${params}` : `/admin/applications${params}`; }

async function safeSendEmail(input: { applicationId: string; template: string; subject: string; body: string }) {
  try {
    const app = await prisma.jobApplication.findUnique({ where: { id: input.applicationId }, include: { applicant: true } });
    if (!app) return { attempted: false, status: 'application_missing' };
    const record = await sendAndRecordEmail({ applicationId: input.applicationId, to: app.applicant.email, template: input.template, subject: input.subject, body: input.body });
    return { attempted: true, status: record.status };
  } catch (error) {
    return { attempted: true, status: 'failed', errorName: error instanceof Error ? error.name : 'UnknownError' };
  }
}

export async function adminStage1Action(formData: FormData) {
  const applicationIdValue = formData.get('applicationDbId');
  const applicationId = typeof applicationIdValue === 'string' ? applicationIdValue : '';
  const actionValue = formData.get('action');
  const action = typeof actionValue === 'string' ? actionValue : '';
  const notesValue = formData.get('notes');
  const notes = typeof notesValue === 'string' ? notesValue : '';
  const diagnostics: Record<string, unknown> = { adminStageActionRequested: true, adminAuthenticated: false, action, applicationIdPresent: Boolean(applicationId), applicationFound: false, stage1Found: false, stage2Found: false, previousStage1Status: null, approvalTransactionSucceeded: false, emailAttempted: false, emailStatus: 'not_attempted', redirectStatus: null };
  let destination = redirectPath(applicationId, '?error=action_failed');

  try {
    const adminSession = await getAdminSession();
    diagnostics.adminAuthenticated = Boolean(adminSession);
    if (!adminSession) {
      diagnostics.redirectStatus = 'login';
      destination = '/admin/login';
    } else if (!applicationId) {
      diagnostics.redirectStatus = 'missing_application_id';
      destination = redirectPath(null, '?error=action_failed');
    } else if (!['approve', 'reject', 'correction'].includes(action)) {
      diagnostics.redirectStatus = 'invalid_action';
      destination = redirectPath(applicationId, '?error=invalid_action');
    } else {
      const app = await prisma.jobApplication.findUnique({ where: { id: applicationId }, select: { id: true, applicationId: true } });
      diagnostics.applicationFound = Boolean(app);
      if (!app) {
        diagnostics.redirectStatus = 'missing_application';
        destination = redirectPath(null, '?error=action_failed');
      } else if (action === 'approve') {
      const result = await approveStage1(applicationId, adminSession.email, notes);
      diagnostics.stage1Found = result.stage1Found; diagnostics.stage2Found = result.stage2Found; diagnostics.previousStage1Status = result.previousStage1Status; diagnostics.approvalTransactionSucceeded = true;
      const email = await safeSendEmail({ applicationId, template: 'stage-2-unlocked', subject: `Next stage unlocked: ${app.applicationId}`, body: 'Stage 1 has been approved. Please return to Track Application to continue.' });
      diagnostics.emailAttempted = email.attempted; diagnostics.emailStatus = email.status;
      destination = redirectPath(applicationId, `?success=${result.alreadyApproved ? 'already_approved' : 'approved'}${email.status === 'sent' ? '' : '&warning=email_failed'}`);
      } else {
      const workflowAction = action === 'reject' ? 'Rejected' : 'Correction Requested';
      const result = await recordAdminStage1Action(applicationId, workflowAction, adminSession.email, notes);
      diagnostics.stage1Found = result.stage1Found; diagnostics.previousStage1Status = result.previousStage1Status; diagnostics.approvalTransactionSucceeded = true;
      const email = await safeSendEmail({ applicationId, template: action === 'reject' ? 'application-rejected' : 'correction-requested', subject: action === 'reject' ? `Application update: ${app.applicationId}` : `Correction requested: ${app.applicationId}`, body: action === 'reject' ? 'Thank you for your interest in Zentric Analytics. We are unable to move your application forward at this time.' : 'A correction has been requested for your application. Please return to Track Application to review the request.' });
      diagnostics.emailAttempted = email.attempted; diagnostics.emailStatus = email.status;
      destination = redirectPath(applicationId, `?success=${action === 'reject' ? 'rejected' : 'correction'}${email.status === 'sent' ? '' : '&warning=email_failed'}`);
      }
    }
  } catch (error) {
    diagnostics.errorName = error instanceof Error ? error.name : 'UnknownError';
    if (error instanceof StageActionError && error.code === 'missing_stage') destination = redirectPath(applicationId, '?error=missing_stage');
    else if (error instanceof StageActionError && error.code === 'missing_application') destination = redirectPath(null, '?error=action_failed');
    else destination = redirectPath(applicationId, '?error=action_failed');
  } finally {
    revalidatePath('/admin/applications');
    if (applicationId) revalidatePath(`/admin/applications/${applicationId}`);
    diagnostics.redirectStatus = destination;
    logAdminDiagnostics(diagnostics);
  }
  redirect(destination);
}
