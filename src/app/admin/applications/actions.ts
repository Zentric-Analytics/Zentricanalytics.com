'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/admin-auth';
import { approveStage1, approveStage2, approveStage3, recordAdminStage1Action, recordAdminStage2Action, recordAdminStage3Action, StageActionError } from '@/lib/workflow';
import { sendAndRecordEmail } from '@/lib/email';
import { prisma } from '@/lib/prisma';
import { deletePrivateUpload } from '@/lib/storage';
import { parseStage3Metadata, stage3InstructionSchema, offerSchema, parseOfferDate } from '@/lib/hiring';

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
          const email = await safeSendEmail({ applicationId, template: 'stage-3-instructions-available', subject: `Stage 3 instructions are available: ${app.applicationId}`, body: 'Stage 3 instructions are available. Please return to Track Application to review and respond.' });
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
      const email = await safeSendEmail({ applicationId, template: 'stage-4-unlocked', subject: `Offer stage available: ${app.applicationId}`, body: 'Stage 3 has been approved. The Offer Stage is now available.' });
      destination = redirectPath(applicationId, `?success=${result.alreadyApproved ? 'stage3_already_approved' : 'stage3_approved'}${email.status === 'sent' ? '' : '&warning=email_failed'}`);
    } else if (['correction','reject'].includes(action)) {
      await recordAdminStage3Action(applicationId, action === 'reject' ? 'Rejected' : 'Correction Requested', adminSession.email, notes);
      const email = await safeSendEmail({ applicationId, template: action === 'reject' ? 'stage-3-rejected' : 'stage-3-correction-requested', subject: action === 'reject' ? `Application update: ${app.applicationId}` : `Stage 3 correction requested: ${app.applicationId}`, body: action === 'reject' ? 'We are unable to move your application forward after Stage 3 review.' : 'A correction has been requested for Stage 3. Please return to Track Application to update your response.' });
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
          if (releasing) email = await safeSendEmail({ applicationId, template: 'offer-ready', subject: `Your offer is ready for review: ${app.applicationId}`, body: 'Your offer is ready for review. Please return to Track Application to review your offer.' });
          diagnostics.emailAttempted = email.attempted; diagnostics.emailStatus = email.status;
          destination = redirectPath(applicationId, `?success=${releasing ? 'offer_released' : 'offer_draft'}${releasing && email.status !== 'sent' ? '&warning=email_failed' : ''}`);
        }
      }
    }
  } catch (error) { diagnostics.errorName = error instanceof Error ? error.name : 'UnknownError'; }
  finally { revalidatePath('/admin/applications'); if (applicationId) revalidatePath(`/admin/applications/${applicationId}`); logAdminDiagnostics(diagnostics); }
  redirect(destination);
}
