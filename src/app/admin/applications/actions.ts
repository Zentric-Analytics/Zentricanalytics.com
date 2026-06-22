'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/admin-auth';
import { approveStage1, approveStage2, recordAdminStage1Action, recordAdminStage2Action, StageActionError } from '@/lib/workflow';
import { sendAndRecordEmail } from '@/lib/email';
import { prisma } from '@/lib/prisma';
import { deletePrivateUpload } from '@/lib/storage';

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
    diagnostics.adminActionSessionPresent = Boolean(adminSession);
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
      const app = await prisma.jobApplication.findUnique({ where: { id: applicationId }, select: { id: true, applicationId: true, deletedAt: true } });
      diagnostics.applicationFound = Boolean(app);
      if (!app) {
        diagnostics.redirectStatus = 'missing_application';
        destination = redirectPath(null, '?error=action_failed');
      } else if (app.deletedAt) {
        diagnostics.redirectStatus = 'restore_before_stage_action';
        destination = redirectPath(applicationId, '?error=restore_before_stage_action');
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

function deleteRedirect(code: string, applicationId?: string | null) {
  return redirectPath(applicationId, code ? `?${code}` : '');
}

function safeReason(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim().slice(0, 500) : '';
}

export async function softDeleteApplicationAction(formData: FormData) {
  const applicationId = String(formData.get('applicationDbId') ?? '');
  const confirmation = String(formData.get('confirmDelete') ?? '');
  const reason = safeReason(formData.get('deleteReason'));
  let destination = deleteRedirect('error=delete_failed', applicationId);
  const adminSession = await getAdminSession();
  if (!adminSession) redirect('/admin/login');
  if (!applicationId || confirmation !== 'DELETE') redirect(deleteRedirect('error=invalid_confirmation', applicationId));
  try {
    const app = await prisma.jobApplication.findUnique({ where: { id: applicationId }, select: { id: true, deletedAt: true } });
    if (!app) destination = deleteRedirect('error=action_failed', null);
    else {
      await prisma.$transaction(async (tx) => {
        await tx.auditLog.create({ data: { applicationId, actorType: 'admin', actorRef: adminSession.email, action: 'Admin soft delete requested', metadata: { reasonPresent: Boolean(reason) } } });
        await tx.jobApplication.update({ where: { id: applicationId }, data: { deletedAt: new Date(), deletedByAdminEmail: adminSession.email, deleteReason: reason || null, restoredAt: null, restoredByAdminEmail: null } });
        await tx.auditLog.create({ data: { applicationId, actorType: 'admin', actorRef: adminSession.email, action: 'Admin soft deleted application', metadata: { reasonPresent: Boolean(reason) } } });
      });
      destination = '/admin/applications?success=soft_deleted';
    }
  } catch { destination = deleteRedirect('error=delete_failed', applicationId); }
  revalidatePath('/admin/applications'); revalidatePath('/admin/applications/deleted'); if (applicationId) revalidatePath(`/admin/applications/${applicationId}`);
  redirect(destination);
}

export async function restoreApplicationAction(formData: FormData) {
  const applicationId = String(formData.get('applicationDbId') ?? '');
  let destination = '/admin/applications/deleted?error=action_failed';
  const adminSession = await getAdminSession();
  if (!adminSession) redirect('/admin/login');
  try {
    const app = await prisma.jobApplication.findUnique({ where: { id: applicationId }, select: { id: true, deletedAt: true } });
    if (app?.deletedAt) {
      await prisma.jobApplication.update({ where: { id: applicationId }, data: { deletedAt: null, deletedByAdminEmail: null, deleteReason: null, restoredAt: new Date(), restoredByAdminEmail: adminSession.email, auditLogs: { create: { actorType: 'admin', actorRef: adminSession.email, action: 'Admin restored application' } } } });
      destination = `/admin/applications/${applicationId}?success=restored`;
    }
  } catch { destination = '/admin/applications/deleted?error=action_failed'; }
  revalidatePath('/admin/applications'); revalidatePath('/admin/applications/deleted'); if (applicationId) revalidatePath(`/admin/applications/${applicationId}`);
  redirect(destination);
}

export async function permanentlyDeleteApplicationAction(formData: FormData) {
  const applicationId = String(formData.get('applicationDbId') ?? '');
  const typedPublicId = String(formData.get('confirmationApplicationId') ?? '').trim();
  let destination = '/admin/applications/deleted?error=delete_failed';
  const diagnostics: Record<string, unknown> = { adminAction: 'permanent_delete_application', applicationPublicIdPresent: Boolean(typedPublicId), applicationFound: false, isSoftDeleted: false, confirmationMatches: false, relatedRecordsCounted: false, privateFilesDeleted: false, dbDeleteSucceeded: false, redirectStatus: null };
  const adminSession = await getAdminSession();
  if (!adminSession) redirect('/admin/login');
  try {
    const app = await prisma.jobApplication.findUnique({ where: { id: applicationId }, include: { documents: { select: { id: true, storageKey: true, provider: true } } } });
    diagnostics.applicationFound = Boolean(app); diagnostics.isSoftDeleted = Boolean(app?.deletedAt); diagnostics.confirmationMatches = Boolean(app && app.applicationId === typedPublicId);
    if (!app || !app.deletedAt) destination = '/admin/applications/deleted?error=restore_before_stage_action';
    else if (app.applicationId !== typedPublicId) destination = `/admin/applications/${applicationId}?error=invalid_confirmation`;
    else {
      const stageIds = (await prisma.hiringStage.findMany({ where: { applicationId }, select: { id: true } })).map((s) => s.id);
      const submissionIds = (await prisma.stageSubmission.findMany({ where: { stageId: { in: stageIds } }, select: { id: true } })).map((s) => s.id);
      diagnostics.relatedRecordsCounted = true;
      let filesReady = false;
      try { await Promise.all(app.documents.map((d) => deletePrivateUpload(d.storageKey, d.provider))); diagnostics.privateFilesDeleted = true; filesReady = true; } catch (error) { diagnostics.errorName = error instanceof Error ? error.name : 'UnknownError'; destination = `/admin/applications/${applicationId}?error=file_delete_failed`; console.info('adminPermanentDeleteDiagnostics', { ...diagnostics, redirectStatus: destination }); }
      if (filesReady) await prisma.$transaction(async (tx) => {
        await tx.applicantDocument.deleteMany({ where: { OR: [{ submissionId: { in: submissionIds } }, { uploadedDocumentId: { in: app.documents.map((d) => d.id) } }] } });
        await tx.electronicSignature.deleteMany({ where: { submissionId: { in: submissionIds } } });
        await tx.stageSubmission.deleteMany({ where: { id: { in: submissionIds } } });
        await tx.stageApproval.deleteMany({ where: { stageId: { in: stageIds } } });
        await tx.hiringStage.deleteMany({ where: { id: { in: stageIds } } });
        await tx.emailNotification.deleteMany({ where: { applicationId } });
        await tx.adminNote.deleteMany({ where: { applicationId } });
        await tx.applicationAccessCode.deleteMany({ where: { applicationId } });
        await tx.auditLog.deleteMany({ where: { applicationId } });
        await tx.uploadedDocument.deleteMany({ where: { applicationId } });
        await tx.jobApplication.delete({ where: { id: applicationId } });
        const remaining = await tx.jobApplication.count({ where: { applicantId: app.applicantId } });
        if (remaining === 0) await tx.applicant.delete({ where: { id: app.applicantId } });
      });
      if (filesReady) { diagnostics.dbDeleteSucceeded = true; destination = '/admin/applications/deleted?success=permanent_deleted'; }
    }
  } catch (error) { diagnostics.errorName = error instanceof Error ? error.name : 'UnknownError'; destination = '/admin/applications/deleted?error=delete_failed'; }
  finally { diagnostics.redirectStatus = destination; console.info('adminPermanentDeleteDiagnostics', diagnostics); revalidatePath('/admin/applications'); revalidatePath('/admin/applications/deleted'); }
  redirect(destination);
}

export async function adminStage2Action(formData: FormData) {
  const applicationId = String(formData.get('applicationDbId') ?? '');
  const action = String(formData.get('action') ?? '');
  const notes = String(formData.get('notes') ?? '').slice(0, 500);
  let destination = redirectPath(applicationId, '?error=action_failed');
  const diagnostics: Record<string, unknown> = { adminStage2ActionRequested: true, adminAuthenticated: false, action, applicationIdPresent: Boolean(applicationId), transactionSucceeded: false, emailAttempted: false, emailStatus: 'not_attempted' };
  try {
    const adminSession = await getAdminSession();
    diagnostics.adminAuthenticated = Boolean(adminSession);
    if (!adminSession) destination = '/admin/login';
    else if (!['approve', 'reject', 'correction'].includes(action)) destination = redirectPath(applicationId, '?error=invalid_action');
    else {
      const app = await prisma.jobApplication.findUnique({ where: { id: applicationId }, select: { id: true, applicationId: true, deletedAt: true } });
      if (!app) destination = redirectPath(null, '?error=action_failed');
      else if (app.deletedAt) destination = redirectPath(applicationId, '?error=restore_before_stage_action');
      else if (action === 'approve') {
        const result = await approveStage2(applicationId, adminSession.email, notes);
        diagnostics.transactionSucceeded = true;
        const email = await safeSendEmail({ applicationId, template: 'stage-3-unlocked', subject: `Next stage unlocked: ${app.applicationId}`, body: 'Stage 2 has been approved. Please return to Track Application to view your next unlocked stage.' });
        diagnostics.emailAttempted = email.attempted; diagnostics.emailStatus = email.status;
        destination = redirectPath(applicationId, `?success=${result.alreadyApproved ? 'stage2_already_approved' : 'stage2_approved'}${email.status === 'sent' ? '' : '&warning=email_failed'}`);
      } else {
        const result = await recordAdminStage2Action(applicationId, action === 'reject' ? 'Rejected' : 'Correction Requested', adminSession.email, notes);
        diagnostics.transactionSucceeded = true;
        const email = await safeSendEmail({ applicationId, template: action === 'reject' ? 'stage-2-rejected' : 'stage-2-correction-requested', subject: action === 'reject' ? `Application update: ${app.applicationId}` : `Stage 2 correction requested: ${app.applicationId}`, body: action === 'reject' ? 'We are unable to move your application forward after identity review.' : 'A correction has been requested for Stage 2. Please return to Track Application to update your information.' });
        diagnostics.emailAttempted = email.attempted; diagnostics.emailStatus = email.status;
        destination = redirectPath(applicationId, `?success=${action === 'reject' ? 'stage2_rejected' : 'stage2_correction'}${email.status === 'sent' ? '' : '&warning=email_failed'}`);
      }
    }
  } catch (error) { diagnostics.errorName = error instanceof Error ? error.name : 'UnknownError'; destination = redirectPath(applicationId, '?error=action_failed'); }
  finally { revalidatePath('/admin/applications'); if (applicationId) revalidatePath(`/admin/applications/${applicationId}`); logAdminDiagnostics(diagnostics); }
  redirect(destination);
}
