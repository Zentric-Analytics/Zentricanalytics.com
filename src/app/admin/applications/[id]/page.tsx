import { notFound, redirect } from 'next/navigation';
import type { Prisma } from '@prisma/client';

import { AdminLogoutButton } from '@/components/AdminLogoutButton';
import { StatusBadge } from '@/components/StatusBadge';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/admin-auth';
import { adminStage1Action, permanentlyDeleteApplicationAction, restoreApplicationAction, softDeleteApplicationAction } from '../actions';

type AdminApplication = Prisma.JobApplicationGetPayload<{
  include: {
    applicant: true;
    stages: {
      include: {
        submissions: {
          include: {
            signature: true;
            documents: {
              include: {
                uploadedDocument: true;
              };
            };
          };
        };
        approvals: true;
      };
    };
    emails: true;
    auditLogs: true;
  };
}>;

type ApplicationStage = AdminApplication['stages'][number];
type ApplicantDocument = NonNullable<
  ApplicationStage['submissions'][number]
>['documents'][number];
type EmailNotification = AdminApplication['emails'][number];
type AuditLog = AdminApplication['auditLogs'][number];

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

function formatDateTime(value?: Date | null) {
  return value ? value.toISOString() : 'Missing';
}

function actionBanner(params: Record<string, string | undefined>) {
  const messages: string[] = [];
  if (params.success === 'approved') messages.push('Stage 1 was approved and Stage 2 is now available.');
  if (params.success === 'already_approved') messages.push('Stage 1 is already approved.');
  if (params.success === 'rejected') messages.push('Application was rejected.');
  if (params.success === 'correction') messages.push('Correction was requested.');
  if (params.success === 'soft_deleted') messages.push('Application moved to deleted records.');
  if (params.success === 'restored') messages.push('Application restored.');
  if (params.warning === 'email_failed') messages.push('Stage 1 was approved, but the unlock email could not be sent. Please retry email delivery or contact the candidate manually.');
  if (params.error === 'action_failed') messages.push('The admin action could not be completed. Please refresh and try again.');
  if (params.error === 'missing_stage') messages.push('Required hiring stage data is missing. Please contact an administrator.');
  if (params.error === 'invalid_action') messages.push('Invalid admin action.');
  if (params.error === 'invalid_confirmation') messages.push('Confirmation did not match. No records were deleted.');
  if (params.error === 'restore_before_stage_action') messages.push('Restore this application before taking stage actions.');
  if (params.error === 'delete_failed') messages.push('Delete failed. Please refresh and try again.');
  if (params.error === 'file_delete_failed') messages.push('Private file deletion failed, so the application was not permanently deleted.');
  return messages;
}

export default async function AdminApplicationDetail({
  params,
  searchParams,
}: PageProps) {
  const [resolvedParams, resolvedSearchParams, adminSession] = await Promise.all([params, searchParams, getAdminSession()]);
  console.info('adminSessionPresentOnPageLoad', { page: '/admin/applications/[id]', present: Boolean(adminSession) });
  if (!adminSession) redirect('/admin/login');

  const application = await prisma.jobApplication.findUnique({
    where: { id: resolvedParams.id },
    include: {
      applicant: true,
      stages: {
        orderBy: { stageOrder: 'asc' },
        include: {
          submissions: {
            include: {
              signature: true,
              documents: {
                include: {
                  uploadedDocument: true,
                },
              },
            },
          },
          approvals: true,
        },
      },
      emails: true,
      auditLogs: true,
    },
  });

  if (!application) {
    notFound();
  }

  const stageOne = application.stages.find(
    (stage: ApplicationStage) => stage.stageOrder === 1,
  );
  const stageOneSubmission = stageOne?.submissions[0];
  const stageOneStatus = stageOne?.status ?? application.status;
  const signature = stageOneSubmission?.signature;
  const documents = stageOneSubmission?.documents ?? [];

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{application.applicationId}</h1>
          <div className="mt-2 flex gap-2"><StatusBadge status={stageOneStatus} />{application.deletedAt ? <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">Deleted</span> : null}</div>
        </div>
        <div className="flex flex-col gap-2 text-sm text-slate-600 sm:items-end">
          <span>Signed in as {adminSession.email}</span>
          <AdminLogoutButton />
        </div>
      </header>

      {actionBanner(resolvedSearchParams).map((message) => (
        <p className="card mt-4 border border-amber-200 bg-amber-50 p-4 text-sm" key={message}>{message}</p>
      ))}

      <section className="card mt-6 p-5">
        <h2 className="font-bold">Applicant</h2>
        <p><strong>Full name:</strong> {application.applicant.fullName}</p>
        <p><strong>First:</strong> {application.applicant.firstName ?? 'Legacy record'} · <strong>Initial:</strong> {application.applicant.middleInitial ?? '—'} · <strong>Last:</strong> {application.applicant.lastName ?? 'Legacy record'}</p>
        <p><strong>Email:</strong> {application.applicant.email}</p>
        <p><strong>Country:</strong> {application.applicant.phoneCountryName ?? 'Not captured'} ({application.applicant.phoneDialCode ?? '—'})</p>
        <p><strong>Phone:</strong> {application.applicant.phoneE164 ?? application.applicant.phone ?? 'No phone provided'}</p>
        <p>{application.applicant.location ?? 'No location provided'}</p>
        <p><strong>Role selected:</strong> {application.roleAppliedFor} · <strong>Experience:</strong> {application.experienceLevel ?? 'Not provided'}</p>
      </section>

      <section className="card mt-6 p-5">
        <h2 className="font-bold">Stage 1 answers</h2>
        {stageOneSubmission ? (
          <pre className="whitespace-pre-wrap text-sm">
            {JSON.stringify(stageOneSubmission.payload ?? {}, null, 2)}
          </pre>
        ) : (
          <p>No Stage 1 submission found.</p>
        )}
      </section>

      <section className="card mt-6 p-5">
        <h2 className="font-bold">Uploaded document metadata</h2>
        {documents.length > 0 ? (
          documents.map((document: ApplicantDocument) => {
            const uploadedDocument = document.uploadedDocument;

            return (
              <p key={document.id}>
                {uploadedDocument?.fileName ?? 'Missing uploaded document'} ·{' '}
                {uploadedDocument?.mimeType ?? 'Unknown MIME type'} ·{' '}
                {uploadedDocument?.sizeBytes ?? 0} bytes
              </p>
            );
          })
        ) : (
          <p>No uploaded documents found.</p>
        )}
      </section>

      <section className="card mt-6 p-5">
        <h2 className="font-bold">Signature</h2>
        {signature ? (
          <p>
            {signature.typedName || 'Missing typed name'} ·{' '}
            {signature.confirmed ? 'Confirmed' : 'Missing'} ·{' '}
            {formatDateTime(signature.signedAt)}
          </p>
        ) : (
          <p>Missing signature.</p>
        )}
      </section>

      <section className="card mt-6 p-5">
        <h2 className="font-bold">Stage 1 admin actions</h2>
        {application.deletedAt ? <p className="mt-3 text-sm font-semibold text-red-700">Restore this application before taking stage actions.</p> : (
        <form action={adminStage1Action} className="mt-4 flex flex-wrap gap-2">
          <input type="hidden" name="applicationDbId" value={application.id} />
          <input className="input max-w-xs" name="notes" placeholder="Optional notes" />
          <button className="btn btn-secondary" name="action" value="approve">Approve Stage 1</button>
          <button className="btn btn-secondary" name="action" value="correction">Request correction</button>
          <button className="btn btn-secondary" name="action" value="reject">Reject</button>
        </form>
        )}
      </section>

      <section className="card mt-6 border border-red-200 bg-red-50 p-5">
        <h2 className="font-bold text-red-800">Delete controls</h2>
        {application.deletedAt ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm">Deleted {formatDateTime(application.deletedAt)} by {application.deletedByAdminEmail ?? 'unknown admin'}. Reason: {application.deleteReason || 'No reason provided'}.</p>
            <form action={restoreApplicationAction}>
              <input type="hidden" name="applicationDbId" value={application.id} />
              <button className="btn btn-secondary">Restore application</button>
            </form>
            <form action={permanentlyDeleteApplicationAction} className="space-y-3 rounded border border-red-300 bg-white p-4">
              <input type="hidden" name="applicationDbId" value={application.id} />
              <p className="font-semibold text-red-800">This permanently deletes the application and cannot be undone.</p>
              <label className="block text-sm font-semibold">Type {application.applicationId} to confirm permanent delete</label>
              <input className="input" name="confirmationApplicationId" placeholder={application.applicationId} required />
              <button className="btn bg-red-700 text-white hover:bg-red-800">Permanently delete</button>
            </form>
          </div>
        ) : (
          <form action={softDeleteApplicationAction} className="mt-4 space-y-3">
            <input type="hidden" name="applicationDbId" value={application.id} />
            <label className="block text-sm font-semibold">Optional reason</label>
            <textarea className="input" name="deleteReason" maxLength={500} />
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="confirmDelete" value="DELETE" required /> Confirm moving this application to deleted records</label>
            <button className="btn bg-red-700 text-white hover:bg-red-800">Move to deleted records</button>
          </form>
        )}
      </section>

      <section className="card mt-6 p-5">
        <h2 className="font-bold">Email history</h2>
        {application.emails.length > 0 ? (
          application.emails.map((email: EmailNotification) => (
            <p key={email.id}>
              {formatDateTime(email.createdAt)} · {email.template} ·{' '}
              {email.status} · {email.toEmail}
            </p>
          ))
        ) : (
          <p>No email history found.</p>
        )}
      </section>

      <section className="card mt-6 p-5">
        <h2 className="font-bold">Audit logs</h2>
        {application.auditLogs.length > 0 ? (
          application.auditLogs.map((log: AuditLog) => (
            <p key={log.id}>
              {formatDateTime(log.createdAt)} · {log.actorType} · {log.action}
            </p>
          ))
        ) : (
          <p>No audit logs found.</p>
        )}
      </section>
    </main>
  );
}
