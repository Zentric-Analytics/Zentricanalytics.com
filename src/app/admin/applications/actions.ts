'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/admin-auth';
import { approveStage1, approveStage2, approveStage3, recordAdminStage1Action, recordAdminStage2Action, recordAdminStage3Action, StageActionError } from '@/lib/workflow';
import { sendAndRecordEmail } from '@/lib/email';
import { prisma } from '@/lib/prisma';
import { deletePrivateUpload } from '@/lib/storage';
import { parseStage3Metadata, stage3InstructionSchema, offerSchema, parseOfferDate, stage5AgreementSchema, toStage5RoleSchedule, stage6AdminDecisionSchema, stage7AdminDecisionSchema, stage8AdminFinalDecisionSchema, stage8ChecklistKeys, toStage8ChecklistPayload } from '@/lib/hiring';
import { applicationRejectedEmail, correctionRequestedEmail, offerReadyEmail, stage2CorrectionRequestedEmail, stage2RejectedEmail, stage2UnlockedEmail, stage3CorrectionRequestedEmail, stage3InstructionsAvailableEmail, stage3RejectedEmail, stage3UnlockedEmail, stage4UnlockedEmail, stage5AgreementReleasedEmail, stage5CorrectionRequestedEmail, stage5RejectedEmail, stage6UnlockedEmail, stage6CorrectionRequestedEmail, stage6RejectedEmail, stage7UnlockedEmail, stage7CorrectionRequestedEmail, stage7RejectedEmail, stage8UnlockedEmail, stage8FinalReviewCorrectionEmail, stage8RejectedEmail, hiringWorkflowCompletedEmail } from '../../../lib/email-templates';

function logAdminDiagnostics(diagnostics: Record<string, unknown>) { console.info('adminStageActionDiagnostics', diagnostics); }
function redirectPath(applicationId?: string | null, params = '') { return applicationId ? `/admin/applications/${applicationId}${params}` : `/admin/applications${params}`; }

async function safeSendEmail(input: { applicationId: string; template: string; subject: string; body: string; html: string }) {
  try {
    const app = await prisma.jobApplication.findUnique({ where: { id: input.applicationId }, include: { applicant: true } });
    if (!app) return { attempted: false, status: 'application_missing' };
    const record = await sendAndRecordEmail({ applicationId: input.applicationId, to: app.applicant.email, template: input.template, subject: input.subject, body: input.body, html: input.html });
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
      const email = await safeSendEmail({ applicationId, template: 'stage-2-unlocked', ...stage2UnlockedEmail({ applicationId: app.applicationId }) });
      diagnostics.emailAttempted = email.attempted; diagnostics.emailStatus = email.status;
      destination = redirectPath(applicationId, `?success=${result.alreadyApproved ? 'already_approved' : 'approved'}${email.status === 'sent' ? '' : '&warning=email_failed'}`);
      } else {
      const workflowAction = action === 'reject' ? 'Rejected' : 'Correction Requested';
      const result = await recordAdminStage1Action(applicationId, workflowAction, adminSession.email, notes);
      diagnostics.stage1Found = result.stage1Found; diagnostics.previousStage1Status = result.previousStage1Status; diagnostics.approvalTransactionSucceeded = true;
      const email = await safeSendEmail({ applicationId, template: action === 'reject' ? 'application-rejected' : 'correction-requested', ...(action === 'reject' ? applicationRejectedEmail({ applicationId: app.applicationId }) : correctionRequestedEmail({ applicationId: app.applicationId })) });
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
        const email = await safeSendEmail({ applicationId, template: 'stage-3-unlocked', ...stage3UnlockedEmail({ applicationId: app.applicationId }) });
        diagnostics.emailAttempted = email.attempted; diagnostics.emailStatus = email.status;
        destination = redirectPath(applicationId, `?success=${result.alreadyApproved ? 'stage2_already_approved' : 'stage2_approved'}${email.status === 'sent' ? '' : '&warning=email_failed'}`);
      } else {
        await recordAdminStage2Action(applicationId, action === 'reject' ? 'Rejected' : 'Correction Requested', adminSession.email, notes);
        diagnostics.transactionSucceeded = true;
        const email = await safeSendEmail({ applicationId, template: action === 'reject' ? 'stage-2-rejected' : 'stage-2-correction-requested', ...(action === 'reject' ? stage2RejectedEmail({ applicationId: app.applicationId }) : stage2CorrectionRequestedEmail({ applicationId: app.applicationId })) });
        diagnostics.emailAttempted = email.attempted; diagnostics.emailStatus = email.status;
        destination = redirectPath(applicationId, `?success=${action === 'reject' ? 'stage2_rejected' : 'stage2_correction'}${email.status === 'sent' ? '' : '&warning=email_failed'}`);
      }
    }
  } catch (error) { diagnostics.errorName = error instanceof Error ? error.name : 'UnknownError'; destination = redirectPath(applicationId, '?error=action_failed'); }
  finally { revalidatePath('/admin/applications'); if (applicationId) revalidatePath(`/admin/applications/${applicationId}`); logAdminDiagnostics(diagnostics); }
  redirect(destination);
}

export async function adminStage3InstructionAction(formData: FormData) {
  const applicationId = String(formData.get('applicationDbId') ?? '');
  const diagnostics: Record<string, unknown> = { stage3InstructionActionRequested: true, adminAuthenticated: false, applicationFound: false, stage3Found: false, metadataSaved: false, emailAttempted: false, emailStatus: 'not_attempted' };
  let destination = redirectPath(applicationId, '?error=action_failed');
  try {
    const adminSession = await getAdminSession();
    diagnostics.adminAuthenticated = Boolean(adminSession);
    if (!adminSession) destination = '/admin/login';
    else {
      const parsed = stage3InstructionSchema.safeParse({
        screeningType: String(formData.get('screeningType') ?? ''), title: String(formData.get('title') ?? ''), instructions: String(formData.get('instructions') ?? ''), interviewMode: String(formData.get('interviewMode') ?? 'Not applicable'), meetingLink: String(formData.get('meetingLink') ?? ''), location: String(formData.get('location') ?? ''), scheduledAt: String(formData.get('scheduledAt') ?? ''), deadlineAt: String(formData.get('deadlineAt') ?? ''), requiresCandidateResponse: formData.get('requiresCandidateResponse') === 'on', requiresUpload: formData.get('requiresUpload') === 'on', allowedUploadNote: String(formData.get('allowedUploadNote') ?? ''),
      });
      if (!parsed.success) destination = redirectPath(applicationId, '?error=stage3_validation');
      else {
        const app = await prisma.jobApplication.findUnique({ where: { id: applicationId }, include: { stages: true } });
        diagnostics.applicationFound = Boolean(app);
        const stage3 = app?.stages.find((s) => s.stageOrder === 3);
        diagnostics.stage3Found = Boolean(stage3);
        if (!app) destination = redirectPath(null, '?error=action_failed');
        else if (app.deletedAt) destination = redirectPath(applicationId, '?error=restore_before_stage_action');
        else if (!stage3 || !['Available','In Progress','Correction Requested','Submitted','Under Review','Approved'].includes(stage3.status)) destination = redirectPath(applicationId, '?error=missing_stage');
        else {
          const metadata = { ...parseStage3Metadata(stage3.metadata), ...parsed.data, releasedAt: parseStage3Metadata(stage3.metadata).releasedAt ?? new Date().toISOString(), releasedByAdminEmail: adminSession.email, updatedAt: new Date().toISOString() };
          const status = ['Approved','Under Review','Correction Requested'].includes(stage3.status) ? stage3.status : 'In Progress';
          const appStatus = parsed.data.screeningType.includes('Interview') ? 'Interview Scheduled' : parsed.data.screeningType === 'Assessment' ? 'Assessment Required' : 'Screening';
          await prisma.$transaction(async (tx) => {
            await tx.hiringStage.update({ where: { id: stage3.id }, data: { metadata, status, unlockedAt: stage3.unlockedAt ?? new Date() } });
            await tx.jobApplication.update({ where: { id: applicationId }, data: { status: appStatus, currentStageOrder: 3 } });
            await tx.auditLog.create({ data: { applicationId, actorType: 'admin', actorRef: adminSession.email, action: 'Admin released Stage 3 instructions', metadata: { screeningType: parsed.data.screeningType, requiresCandidateResponse: parsed.data.requiresCandidateResponse, requiresUpload: parsed.data.requiresUpload } } });
          });
          diagnostics.metadataSaved = true;
          const email = await safeSendEmail({ applicationId, template: 'stage-3-instructions-available', ...stage3InstructionsAvailableEmail({ applicationId: app.applicationId }) });
          diagnostics.emailAttempted = email.attempted; diagnostics.emailStatus = email.status;
          destination = redirectPath(applicationId, `?success=stage3_released${email.status === 'sent' ? '' : '&warning=email_failed'}`);
        }
      }
    }
  } catch (error) { diagnostics.errorName = error instanceof Error ? error.name : 'UnknownError'; }
  finally { revalidatePath('/admin/applications'); if (applicationId) revalidatePath(`/admin/applications/${applicationId}`); logAdminDiagnostics(diagnostics); }
  redirect(destination);
}

export async function adminStage3Action(formData: FormData) {
  const applicationId = String(formData.get('applicationDbId') ?? '');
  const action = String(formData.get('action') ?? '');
  const notes = String(formData.get('notes') ?? '').slice(0, 500);
  let destination = redirectPath(applicationId, '?error=action_failed');
  const adminSession = await getAdminSession();
  if (!adminSession) redirect('/admin/login');
  const app = await prisma.jobApplication.findUnique({ where: { id: applicationId }, select: { applicationId: true, deletedAt: true } });
  if (!app) redirect(redirectPath(null, '?error=action_failed'));
  if (app.deletedAt) redirect(redirectPath(applicationId, '?error=restore_before_stage_action'));
  try {
    if (action === 'approve') {
      const result = await approveStage3(applicationId, adminSession.email, notes);
      const email = await safeSendEmail({ applicationId, template: 'stage-4-unlocked', ...stage4UnlockedEmail({ applicationId: app.applicationId }) });
      destination = redirectPath(applicationId, `?success=${result.alreadyApproved ? 'stage3_already_approved' : 'stage3_approved'}${email.status === 'sent' ? '' : '&warning=email_failed'}`);
    } else if (['correction','reject'].includes(action)) {
      await recordAdminStage3Action(applicationId, action === 'reject' ? 'Rejected' : 'Correction Requested', adminSession.email, notes);
      const email = await safeSendEmail({ applicationId, template: action === 'reject' ? 'stage-3-rejected' : 'stage-3-correction-requested', ...(action === 'reject' ? stage3RejectedEmail({ applicationId: app.applicationId }) : stage3CorrectionRequestedEmail({ applicationId: app.applicationId })) });
      destination = redirectPath(applicationId, `?success=${action === 'reject' ? 'stage3_rejected' : 'stage3_correction'}${email.status === 'sent' ? '' : '&warning=email_failed'}`);
    } else destination = redirectPath(applicationId, '?error=invalid_action');
  } catch { destination = redirectPath(applicationId, '?error=action_failed'); }
  revalidatePath('/admin/applications'); revalidatePath(`/admin/applications/${applicationId}`);
  redirect(destination);
}

export async function adminOfferAction(formData: FormData) {
  const applicationId = String(formData.get('applicationDbId') ?? '');
  const action = String(formData.get('action') ?? 'draft');
  const diagnostics: Record<string, unknown> = { offerAdminActionRequested: true, adminAuthenticated: false, applicationFound: false, stage4Found: false, offerFound: false, offerStatus: null, dbWriteSucceeded: false, emailAttempted: false, emailStatus: 'not_attempted' };
  let destination = redirectPath(applicationId, '?error=action_failed');
  try {
    const adminSession = await getAdminSession(); diagnostics.adminAuthenticated = Boolean(adminSession);
    if (!adminSession) destination = '/admin/login';
    else {
      const app = await prisma.jobApplication.findUnique({ where: { id: applicationId }, include: { stages: true, offer: true } });
      diagnostics.applicationFound = Boolean(app); diagnostics.offerFound = Boolean(app?.offer); diagnostics.offerStatus = app?.offer?.status ?? null;
      const stage4 = app?.stages.find((s) => s.stageOrder === 4); diagnostics.stage4Found = Boolean(stage4);
      if (!app) destination = redirectPath(null, '?error=action_failed');
      else if (app.deletedAt) destination = redirectPath(applicationId, '?error=restore_before_stage_action');
      else if (!stage4 || !['Available','In Progress','Submitted','Under Review','Approved','Completed'].includes(stage4.status)) destination = redirectPath(applicationId, '?error=missing_stage');
      else if (action === 'withdraw') {
        if (app.offer && app.offer.status === 'Released') {
          await prisma.$transaction(async (tx) => { await tx.offer.update({ where: { applicationId }, data: { status: 'Withdrawn' } }); await tx.hiringStage.update({ where: { id: stage4.id }, data: { status: 'Available' } }); await tx.auditLog.create({ data: { applicationId, actorType: 'admin', actorRef: adminSession.email, action: 'Admin withdrew offer' } }); });
          diagnostics.dbWriteSucceeded = true;
        }
        destination = redirectPath(applicationId, '?success=offer_withdrawn');
      } else {
        const parsed = offerSchema.safeParse(Object.fromEntries(formData.entries()));
        if (!parsed.success) destination = redirectPath(applicationId, '?error=offer_validation');
        else if (app.offer && ['Accepted','Declined','Withdrawn','Expired'].includes(app.offer.status)) destination = redirectPath(applicationId, '?error=invalid_action');
        else {
          const releasing = action === 'release';
          await prisma.$transaction(async (tx) => {
            await tx.offer.upsert({ where: { applicationId }, create: { applicationId, roleOffered: parsed.data.roleOffered, salary: parsed.data.salary, startDate: parseOfferDate(parsed.data.startDate), workMode: parsed.data.workMode, reportingManager: parsed.data.reportingManager || null, probationPeriod: parsed.data.probationPeriod || null, offerExpiryDate: parsed.data.offerExpiryDate ? parseOfferDate(parsed.data.offerExpiryDate) : null, specialConditions: parsed.data.specialConditions || null, status: releasing ? 'Released' : 'Draft', releasedAt: releasing ? new Date() : null, releasedByAdminEmail: releasing ? adminSession.email : null }, update: { roleOffered: parsed.data.roleOffered, salary: parsed.data.salary, startDate: parseOfferDate(parsed.data.startDate), workMode: parsed.data.workMode, reportingManager: parsed.data.reportingManager || null, probationPeriod: parsed.data.probationPeriod || null, offerExpiryDate: parsed.data.offerExpiryDate ? parseOfferDate(parsed.data.offerExpiryDate) : null, specialConditions: parsed.data.specialConditions || null, status: releasing ? 'Released' : 'Draft', releasedAt: releasing ? new Date() : app.offer?.releasedAt, releasedByAdminEmail: releasing ? adminSession.email : app.offer?.releasedByAdminEmail } });
            await tx.hiringStage.update({ where: { id: stage4.id }, data: { status: releasing ? 'In Progress' : 'Available', unlockedAt: stage4.unlockedAt ?? new Date() } });
            await tx.jobApplication.update({ where: { id: applicationId }, data: { status: releasing ? 'Offer Sent' : 'Offer Pending', currentStageOrder: 4 } });
            await tx.auditLog.create({ data: { applicationId, actorType: 'admin', actorRef: adminSession.email, action: releasing ? 'Admin released offer' : 'Admin saved draft offer', metadata: { offerStatus: releasing ? 'Released' : 'Draft' } } });
          });
          diagnostics.dbWriteSucceeded = true;
          let email = { attempted: false, status: 'not_attempted' };
          // Keep the candidate-facing offer-ready subject visible in this action: Your offer is ready for review.
          if (releasing) email = await safeSendEmail({ applicationId, template: 'offer-ready', ...offerReadyEmail({ applicationId: app.applicationId }) });
          diagnostics.emailAttempted = email.attempted; diagnostics.emailStatus = email.status;
          destination = redirectPath(applicationId, `?success=${releasing ? 'offer_released' : 'offer_draft'}${releasing && email.status !== 'sent' ? '&warning=email_failed' : ''}`);
        }
      }
    }
  } catch (error) { diagnostics.errorName = error instanceof Error ? error.name : 'UnknownError'; }
  finally { revalidatePath('/admin/applications'); if (applicationId) revalidatePath(`/admin/applications/${applicationId}`); logAdminDiagnostics(diagnostics); }
  redirect(destination);
}

export async function adminStage5AgreementAction(formData: FormData) {
  const applicationId = String(formData.get('applicationDbId') ?? '');
  const action = String(formData.get('action') ?? 'draft');
  let destination = redirectPath(applicationId, '?error=action_failed');
  const adminSession = await getAdminSession();
  if (!adminSession) redirect('/admin/login');
  try {
    const app = await prisma.jobApplication.findUnique({ where: { id: applicationId }, include: { applicant: true, stages: true, offer: true, employmentAgreement: true } });
    const stage5 = app?.stages.find((s) => s.stageOrder === 5);
    if (!app) redirect(redirectPath(null, '?error=action_failed'));
    if (app.deletedAt) redirect(redirectPath(applicationId, '?error=restore_before_stage_action'));
    if (!stage5) redirect(redirectPath(applicationId, '?error=missing_stage'));
    if (app.offer?.status !== 'Accepted') redirect(redirectPath(applicationId, '?error=stage5_offer_required'));
    if (app.employmentAgreement && ['Approved','Rejected'].includes(app.employmentAgreement.status)) redirect(redirectPath(applicationId, '?error=invalid_action'));
    const parsed = stage5AgreementSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) redirect(redirectPath(applicationId, '?error=stage5_validation'));
    const releasing = action === 'release';
    await prisma.$transaction(async (tx) => {
      await tx.employmentAgreement.upsert({ where: { applicationId }, create: { applicationId, title: parsed.data.title, version: parsed.data.version, agreementText: parsed.data.agreementText, roleSchedule: toStage5RoleSchedule(parsed.data), status: releasing ? 'Released' : 'Draft', releasedAt: releasing ? new Date() : null, releasedByAdminEmail: releasing ? adminSession.email : null }, update: { title: parsed.data.title, version: parsed.data.version, agreementText: parsed.data.agreementText, roleSchedule: toStage5RoleSchedule(parsed.data), status: releasing ? 'Released' : 'Draft', releasedAt: releasing ? new Date() : app.employmentAgreement?.releasedAt, releasedByAdminEmail: releasing ? adminSession.email : app.employmentAgreement?.releasedByAdminEmail } });
      await tx.hiringStage.update({ where: { id: stage5.id }, data: { status: releasing ? 'In Progress' : 'Available', unlockedAt: stage5.unlockedAt ?? new Date() } });
      await tx.jobApplication.update({ where: { id: applicationId }, data: { status: 'Agreement Pending', currentStageOrder: 5 } });
      await tx.auditLog.create({ data: { applicationId, actorType: 'admin', actorRef: adminSession.email, action: releasing ? 'Admin released Stage 5 agreement' : 'Admin saved Stage 5 agreement draft', metadata: { agreementStatus: releasing ? 'Released' : 'Draft', version: parsed.data.version } } });
    });
    if (releasing) {
      const email = await safeSendEmail({ applicationId, template: 'stage-5-agreement-released', ...stage5AgreementReleasedEmail({ applicationId: app.applicationId, candidateName: app.applicant?.fullName }) });
      destination = redirectPath(applicationId, `?success=stage5_released${email.status === 'sent' ? '' : '&warning=email_failed'}`);
    } else destination = redirectPath(applicationId, '?success=stage5_draft');
  } catch (error) { if ((error as Error).message === 'NEXT_REDIRECT') throw error; destination = redirectPath(applicationId, '?error=action_failed'); }
  revalidatePath('/admin/applications'); revalidatePath(`/admin/applications/${applicationId}`);
  redirect(destination);
}

export async function adminStage5Action(formData: FormData) {
  const applicationId = String(formData.get('applicationDbId') ?? '');
  const action = String(formData.get('action') ?? '');
  const notes = String(formData.get('notes') ?? '').slice(0, 500);
  let destination = redirectPath(applicationId, '?error=action_failed');
  const adminSession = await getAdminSession();
  if (!adminSession) redirect('/admin/login');
  try {
    const app = await prisma.jobApplication.findUnique({ where: { id: applicationId }, include: { applicant: true, stages: { include: { submissions: { include: { signature: true }, orderBy: { createdAt: 'desc' } } } }, employmentAgreement: true } });
    const stage5 = app?.stages.find((s) => s.stageOrder === 5);
    const stage6 = app?.stages.find((s) => s.stageOrder === 6);
    if (!app) redirect(redirectPath(null, '?error=action_failed'));
    if (app.deletedAt) redirect(redirectPath(applicationId, '?error=restore_before_stage_action'));
    if (!stage5) redirect(redirectPath(applicationId, '?error=missing_stage'));
    const submission = stage5.submissions[0];
    const signature = submission?.signature;
    if (action === 'approve' && (!submission || !signature?.confirmed)) redirect(redirectPath(applicationId, '?error=stage5_missing_submission'));
    await prisma.$transaction(async (tx) => {
      if (action === 'approve') {
        await tx.hiringStage.update({ where: { id: stage5.id }, data: { status: 'Approved', approvedAt: new Date() } });
        await tx.stageApproval.create({ data: { stageId: stage5.id, action: 'Approved', adminEmail: adminSession.email, notes } });
        if (app.employmentAgreement) await tx.employmentAgreement.update({ where: { applicationId }, data: { status: 'Approved', approvedAt: new Date() } });
        if (stage6 && stage6.status === 'Locked') await tx.hiringStage.update({ where: { id: stage6.id }, data: { status: 'Available', unlockedAt: stage6.unlockedAt ?? new Date() } });
        await tx.jobApplication.update({ where: { id: applicationId }, data: { status: 'Onboarding Pending', currentStageOrder: 6 } });
        await tx.auditLog.create({ data: { applicationId, actorType: 'admin', actorRef: adminSession.email, action: 'Admin approved Stage 5', metadata: { signatureConfirmed: true } } });
        await tx.auditLog.create({ data: { applicationId, actorType: 'system', action: 'Stage 6 unlocked after Stage 5 approval', metadata: { stage6Status: stage6 ? 'Available' : 'missing' } } });
      } else if (action === 'correction') {
        await tx.hiringStage.update({ where: { id: stage5.id }, data: { status: 'Correction Requested' } });
        await tx.stageApproval.create({ data: { stageId: stage5.id, action: 'Correction Requested', adminEmail: adminSession.email, notes } });
        await tx.jobApplication.update({ where: { id: applicationId }, data: { status: 'Agreement Pending', currentStageOrder: 5 } });
        await tx.auditLog.create({ data: { applicationId, actorType: 'admin', actorRef: adminSession.email, action: 'Admin requested Stage 5 correction', metadata: { notesPresent: Boolean(notes) } } });
      } else if (action === 'reject') {
        await tx.hiringStage.update({ where: { id: stage5.id }, data: { status: 'Rejected' } });
        await tx.stageApproval.create({ data: { stageId: stage5.id, action: 'Rejected', adminEmail: adminSession.email, notes } });
        if (app.employmentAgreement) await tx.employmentAgreement.update({ where: { applicationId }, data: { status: 'Rejected' } });
        await tx.jobApplication.update({ where: { id: applicationId }, data: { status: 'Rejected', currentStageOrder: 5 } });
        await tx.auditLog.create({ data: { applicationId, actorType: 'admin', actorRef: adminSession.email, action: 'Admin rejected Stage 5', metadata: { notesPresent: Boolean(notes) } } });
      } else throw new Error('Invalid action');
    });
    const template = action === 'approve' ? ['stage-6-unlocked', stage6UnlockedEmail] as const : action === 'correction' ? ['stage-5-correction-requested', stage5CorrectionRequestedEmail] as const : ['stage-5-rejected', stage5RejectedEmail] as const;
    const email = await safeSendEmail({ applicationId, template: template[0], ...template[1]({ applicationId: app.applicationId, candidateName: app.applicant.fullName }) });
    destination = redirectPath(applicationId, `?success=${action === 'approve' ? 'stage5_approved' : action === 'correction' ? 'stage5_correction' : 'stage5_rejected'}${email.status === 'sent' ? '' : '&warning=email_failed'}`);
  } catch (error) { if ((error as Error).message === 'NEXT_REDIRECT') throw error; destination = redirectPath(applicationId, '?error=action_failed'); }
  revalidatePath('/admin/applications'); revalidatePath(`/admin/applications/${applicationId}`);
  redirect(destination);
}


export async function adminStage6Action(formData: FormData) {
  const parsed = stage6AdminDecisionSchema.safeParse(Object.fromEntries(formData.entries()));
  const applicationId = String(formData.get('applicationDbId') ?? '');
  let destination = redirectPath(applicationId, '?error=action_failed');
  const adminSession = await getAdminSession();
  if (!adminSession) redirect('/admin/login');
  if (!parsed.success) redirect(redirectPath(applicationId, '?error=stage6_validation'));
  const { action, notes } = parsed.data;
  try {
    const app = await prisma.jobApplication.findUnique({ where: { id: applicationId }, include: { applicant: true, stages: { include: { submissions: { include: { signature: true }, orderBy: { createdAt: 'desc' } } } } } });
    const stage6 = app?.stages.find((s) => s.stageOrder === 6);
    const stage7 = app?.stages.find((s) => s.stageOrder === 7);
    if (!app) redirect(redirectPath(null, '?error=action_failed'));
    if (app.deletedAt) redirect(redirectPath(applicationId, '?error=restore_before_stage_action'));
    if (!stage6) redirect(redirectPath(applicationId, '?error=missing_stage'));
    const submission = stage6.submissions[0];
    const signature = submission?.signature;
    if (action === 'approve' && (!submission || !signature?.confirmed)) redirect(redirectPath(applicationId, '?error=stage6_missing_submission'));
    await prisma.$transaction(async (tx) => {
      if (action === 'approve') {
        await tx.hiringStage.update({ where: { id: stage6.id }, data: { status: 'Approved', approvedAt: new Date() } });
        await tx.stageApproval.create({ data: { stageId: stage6.id, action: 'Approved', adminEmail: adminSession.email, notes } });
        if (stage7 && stage7.status === 'Locked') await tx.hiringStage.update({ where: { id: stage7.id }, data: { status: 'Available', unlockedAt: stage7.unlockedAt ?? new Date() } });
        await tx.jobApplication.update({ where: { id: applicationId }, data: { status: 'Final Review', currentStageOrder: 7 } });
        await tx.auditLog.create({ data: { applicationId, actorType: 'admin', actorRef: adminSession.email, action: 'Admin approved Stage 6', metadata: { signatureConfirmed: true } } });
        await tx.auditLog.create({ data: { applicationId, actorType: 'system', action: 'Stage 7 unlocked after Stage 6 approval', metadata: { stage7Status: stage7 ? 'Available' : 'missing' } } });
      } else if (action === 'correction') {
        await tx.hiringStage.update({ where: { id: stage6.id }, data: { status: 'Correction Requested' } });
        await tx.stageApproval.create({ data: { stageId: stage6.id, action: 'Correction Requested', adminEmail: adminSession.email, notes } });
        await tx.jobApplication.update({ where: { id: applicationId }, data: { status: 'Onboarding Pending', currentStageOrder: 6 } });
        await tx.auditLog.create({ data: { applicationId, actorType: 'admin', actorRef: adminSession.email, action: 'Admin requested Stage 6 correction', metadata: { notesPresent: Boolean(notes) } } });
      } else {
        await tx.hiringStage.update({ where: { id: stage6.id }, data: { status: 'Rejected' } });
        await tx.stageApproval.create({ data: { stageId: stage6.id, action: 'Rejected', adminEmail: adminSession.email, notes } });
        await tx.jobApplication.update({ where: { id: applicationId }, data: { status: 'Rejected', currentStageOrder: 6 } });
        await tx.auditLog.create({ data: { applicationId, actorType: 'admin', actorRef: adminSession.email, action: 'Admin rejected Stage 6', metadata: { notesPresent: Boolean(notes) } } });
      }
    });
    const template = action === 'approve' ? ['stage-7-unlocked', stage7UnlockedEmail] as const : action === 'correction' ? ['stage-6-correction-requested', stage6CorrectionRequestedEmail] as const : ['stage-6-rejected', stage6RejectedEmail] as const;
    const email = await safeSendEmail({ applicationId, template: template[0], ...template[1]({ applicationId: app.applicationId, candidateName: app.applicant.fullName }) });
    destination = redirectPath(applicationId, `?success=${action === 'approve' ? 'stage6_approved' : action === 'correction' ? 'stage6_correction' : 'stage6_rejected'}${email.status === 'sent' ? '' : '&warning=email_failed'}`);
  } catch (error) { if ((error as Error).message === 'NEXT_REDIRECT') throw error; destination = redirectPath(applicationId, '?error=action_failed'); }
  revalidatePath('/admin/applications'); revalidatePath(`/admin/applications/${applicationId}`);
  redirect(destination);
}


export async function adminStage7Action(formData: FormData) {
  const parsed = stage7AdminDecisionSchema.safeParse(Object.fromEntries(formData.entries()));
  const applicationId = String(formData.get('applicationDbId') ?? '');
  let destination = redirectPath(applicationId, '?error=action_failed');
  const adminSession = await getAdminSession();
  if (!adminSession) redirect('/admin/login');
  if (!parsed.success) redirect(redirectPath(applicationId, '?error=stage7_validation'));
  const { action, notes } = parsed.data;
  try {
    const app = await prisma.jobApplication.findUnique({ where: { id: applicationId }, include: { applicant: true, stages: { include: { submissions: { include: { signature: true }, orderBy: { createdAt: 'desc' } } } } } });
    const stage7 = app?.stages.find((s) => s.stageOrder === 7);
    const stage8 = app?.stages.find((s) => s.stageOrder === 8);
    if (!app) redirect(redirectPath(null, '?error=action_failed'));
    if (app.deletedAt) redirect(redirectPath(applicationId, '?error=restore_before_stage_action'));
    if (!stage7) redirect(redirectPath(applicationId, '?error=missing_stage'));
    const submission = stage7.submissions[0];
    const signature = submission?.signature;
    if (action === 'approve' && (!submission || !signature?.confirmed)) redirect(redirectPath(applicationId, '?error=stage7_missing_submission'));
    await prisma.$transaction(async (tx) => {
      if (action === 'approve') {
        await tx.hiringStage.update({ where: { id: stage7.id }, data: { status: 'Approved', approvedAt: new Date() } });
        await tx.stageApproval.create({ data: { stageId: stage7.id, action: 'Approved', adminEmail: adminSession.email, notes } });
        if (stage8 && stage8.status === 'Locked') await tx.hiringStage.update({ where: { id: stage8.id }, data: { status: 'Available', unlockedAt: stage8.unlockedAt ?? new Date() } });
        await tx.jobApplication.update({ where: { id: applicationId }, data: { status: 'Final Review', currentStageOrder: 8 } });
        await tx.auditLog.create({ data: { applicationId, actorType: 'admin', actorRef: adminSession.email, action: 'Admin approved Stage 7', metadata: { signatureConfirmed: true, acknowledgementVersion: 1 } } });
        await tx.auditLog.create({ data: { applicationId, actorType: 'system', action: 'Stage 8 unlocked after Stage 7 approval', metadata: { stage8Status: stage8 ? 'Available' : 'missing' } } });
      } else if (action === 'correction') {
        await tx.hiringStage.update({ where: { id: stage7.id }, data: { status: 'Correction Requested' } });
        await tx.stageApproval.create({ data: { stageId: stage7.id, action: 'Correction Requested', adminEmail: adminSession.email, notes } });
        await tx.jobApplication.update({ where: { id: applicationId }, data: { status: 'Final Review', currentStageOrder: 7 } });
        await tx.auditLog.create({ data: { applicationId, actorType: 'admin', actorRef: adminSession.email, action: 'Admin requested Stage 7 correction', metadata: { notesPresent: Boolean(notes) } } });
      } else {
        await tx.hiringStage.update({ where: { id: stage7.id }, data: { status: 'Rejected' } });
        await tx.stageApproval.create({ data: { stageId: stage7.id, action: 'Rejected', adminEmail: adminSession.email, notes } });
        await tx.jobApplication.update({ where: { id: applicationId }, data: { status: 'Rejected', currentStageOrder: 7 } });
        await tx.auditLog.create({ data: { applicationId, actorType: 'admin', actorRef: adminSession.email, action: 'Admin rejected Stage 7', metadata: { notesPresent: Boolean(notes) } } });
      }
    });
    const template = action === 'approve' ? ['stage-8-unlocked', stage8UnlockedEmail] as const : action === 'correction' ? ['stage-7-correction-requested', stage7CorrectionRequestedEmail] as const : ['stage-7-rejected', stage7RejectedEmail] as const;
    const email = await safeSendEmail({ applicationId, template: template[0], ...template[1]({ applicationId: app.applicationId, candidateName: app.applicant.fullName }) });
    destination = redirectPath(applicationId, `?success=${action === 'approve' ? 'stage7_approved' : action === 'correction' ? 'stage7_correction' : 'stage7_rejected'}${email.status === 'sent' ? '' : '&warning=email_failed'}`);
  } catch (error) { if ((error as Error).message === 'NEXT_REDIRECT') throw error; destination = redirectPath(applicationId, '?error=action_failed'); }
  revalidatePath('/admin/applications'); revalidatePath(`/admin/applications/${applicationId}`);
  redirect(destination);
}


const approvedOrCompleted = (status?: string | null) => status === 'Approved' || status === 'Completed';

export async function adminStage8Action(formData: FormData) {
  const parsed = stage8AdminFinalDecisionSchema.safeParse(Object.fromEntries(formData.entries()));
  const applicationId = String(formData.get('applicationDbId') ?? '');
  let destination = redirectPath(applicationId, '?error=action_failed');
  const adminSession = await getAdminSession();
  if (!adminSession) redirect('/admin/login');
  if (!parsed.success) redirect(redirectPath(applicationId, '?error=stage8_validation'));
  const { action, finalHrNotes, candidateFacingNote } = parsed.data;
  try {
    const app = await prisma.jobApplication.findUnique({ where: { id: applicationId }, include: { applicant: true, offer: true, stages: { include: { submissions: { include: { signature: true, documents: true }, orderBy: { createdAt: 'desc' } } } } } });
    if (!app) redirect(redirectPath(null, '?error=action_failed'));
    if (app.deletedAt) redirect(redirectPath(applicationId, '?error=restore_before_stage_action'));
    const stagesByOrder = new Map(app.stages.map((stage) => [stage.stageOrder, stage]));
    const stage8 = stagesByOrder.get(8);
    const stage7 = stagesByOrder.get(7);
    if (!stage8) redirect(redirectPath(applicationId, '?error=missing_stage'));
    if (stage8.status === 'Rejected' && action === 'finalize') redirect(redirectPath(applicationId, '?error=stage8_reopen_not_supported'));
    const priorStagesReady = [1, 2, 3, 5, 6, 7].every((order) => approvedOrCompleted(stagesByOrder.get(order)?.status)) && approvedOrCompleted(stagesByOrder.get(4)?.status) && app.offer?.status === 'Accepted';
    if (action === 'finalize' && (!priorStagesReady || !approvedOrCompleted(stage7?.status))) redirect(redirectPath(applicationId, '?error=stage8_prior_stages_incomplete'));
    await prisma.$transaction(async (tx) => {
      if (action === 'finalize') {
        const version = (await tx.stageSubmission.count({ where: { stageId: stage8.id } })) + 1;
        await tx.stageSubmission.create({ data: { stageId: stage8.id, version, payload: toStage8ChecklistPayload(parsed.data), status: 'Approved', submittedAt: new Date() } });
        await tx.hiringStage.update({ where: { id: stage8.id }, data: { status: 'Approved', approvedAt: new Date(), submittedAt: stage8.submittedAt ?? new Date() } });
        await tx.stageApproval.create({ data: { stageId: stage8.id, action: 'Approved', adminEmail: adminSession.email, notes: finalHrNotes || null } });
        await tx.jobApplication.update({ where: { id: applicationId }, data: { status: 'Hired', currentStageOrder: 8 } });
        const hrOrganization = await tx.hrOrganization.findUnique({ where: { slug: 'zentric-analytics' }, select: { id: true } });
        if (hrOrganization) {
          const nameParts = app.applicant.fullName.trim().split(/\s+/);
          const existingEmployee = await tx.hrEmployee.findUnique({ where: { recruitmentApplicationId: app.id } });
          const employee = existingEmployee ?? await tx.hrEmployee.create({
            data: {
              organizationId: hrOrganization.id,
              recruitmentApplicationId: app.id,
              employeeNumber: app.applicationId,
              legalFirstName: app.applicant.firstName || nameParts[0] || 'Pending',
              middleName: app.applicant.middleInitial || (nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : null),
              lastName: app.applicant.lastName || nameParts.at(-1) || 'Pending',
              personalEmail: app.applicant.email.trim().toLowerCase(),
              phone: app.applicant.phoneE164 || app.applicant.phone,
              employmentStatus: 'DRAFT',
            },
          });
          if (!existingEmployee) await tx.hrAuditEvent.create({ data: { organizationId: hrOrganization.id, actorRole: 'LEGACY_RECRUITMENT_ADMIN', entityType: 'HrEmployee', entityId: employee.id, action: 'hr.employee.created_from_recruitment', newValues: { recruitmentApplicationId: app.id, employeeNumber: app.applicationId, status: 'DRAFT' }, reason: 'Final recruitment approval', correlationId: `recruitment:${app.id}` } });
        }
        await tx.auditLog.create({ data: { applicationId, actorType: 'admin', actorRef: adminSession.email, action: 'Admin finalized Stage 8', metadata: { checklistConfirmed: true, checklistItemCount: stage8ChecklistKeys.length, finalHrNotesPresent: Boolean(finalHrNotes), candidateFacingNotePresent: Boolean(candidateFacingNote) } } });
        await tx.auditLog.create({ data: { applicationId, actorType: 'admin', actorRef: adminSession.email, action: 'Final HR checklist confirmed', metadata: { checklistVersion: 1, confirmedItemCount: stage8ChecklistKeys.length } } });
        await tx.auditLog.create({ data: { applicationId, actorType: 'system', action: 'Hiring workflow completed', metadata: { finalStageOrder: 8, applicationStatus: 'Hired' } } });
      } else if (action === 'correction') {
        await tx.hiringStage.update({ where: { id: stage8.id }, data: { status: 'Correction Requested' } });
        await tx.stageApproval.create({ data: { stageId: stage8.id, action: 'Correction Requested', adminEmail: adminSession.email, notes: finalHrNotes || null } });
        await tx.jobApplication.update({ where: { id: applicationId }, data: { status: 'Final Review', currentStageOrder: 8 } });
        await tx.auditLog.create({ data: { applicationId, actorType: 'admin', actorRef: adminSession.email, action: 'Admin requested Stage 8 correction', metadata: { notesPresent: Boolean(finalHrNotes), candidateFacingNotePresent: Boolean(candidateFacingNote) } } });
      } else {
        await tx.hiringStage.update({ where: { id: stage8.id }, data: { status: 'Rejected' } });
        await tx.stageApproval.create({ data: { stageId: stage8.id, action: 'Rejected', adminEmail: adminSession.email, notes: finalHrNotes || null } });
        await tx.jobApplication.update({ where: { id: applicationId }, data: { status: 'Rejected', currentStageOrder: 8 } });
        await tx.auditLog.create({ data: { applicationId, actorType: 'admin', actorRef: adminSession.email, action: 'Admin rejected Stage 8', metadata: { notesPresent: Boolean(finalHrNotes), candidateFacingNotePresent: Boolean(candidateFacingNote) } } });
      }
    });
    const template = action === 'finalize' ? ['hiring-workflow-completed', hiringWorkflowCompletedEmail] as const : action === 'correction' ? ['stage-8-correction-requested', stage8FinalReviewCorrectionEmail] as const : ['stage-8-rejected', stage8RejectedEmail] as const;
    const email = await safeSendEmail({ applicationId, template: template[0], ...template[1]({ applicationId: app.applicationId, candidateName: app.applicant.fullName }) });
    destination = redirectPath(applicationId, `?success=${action === 'finalize' ? 'stage8_finalized' : action === 'correction' ? 'stage8_correction' : 'stage8_rejected'}${email.status === 'sent' ? '' : '&warning=email_failed'}`);
  } catch (error) { if ((error as Error).message === 'NEXT_REDIRECT') throw error; destination = redirectPath(applicationId, '?error=action_failed'); }
  revalidatePath('/admin/applications'); revalidatePath(`/admin/applications/${applicationId}`);
  redirect(destination);
}
