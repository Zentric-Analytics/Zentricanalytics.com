import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Prisma } from '@prisma/client';

import { StatusBadge } from '@/components/StatusBadge';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/admin-auth';
import { adminStage1Action } from '../actions';

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
  if (params.warning === 'email_failed') messages.push('Stage 1 was approved, but the unlock email could not be sent. Please retry email delivery or contact the candidate manually.');
  if (params.error === 'action_failed') messages.push('The admin action could not be completed. Please refresh and try again.');
  if (params.error === 'missing_stage') messages.push('Required hiring stage data is missing. Please contact an administrator.');
  if (params.error === 'invalid_action') messages.push('Invalid admin action.');
  return messages;
}

export default async function AdminApplicationDetail({
  params,
  searchParams,
}: PageProps) {
  const [resolvedParams, resolvedSearchParams, adminSession] = await Promise.all([params, searchParams, getAdminSession()]);
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
          <div className="mt-2"><StatusBadge status={stageOneStatus} /></div>
        </div>
        <div className="flex flex-col gap-2 text-sm text-slate-600 sm:items-end">
          <span>Signed in as {adminSession.email}</span>
          <Link className="btn btn-secondary" href="/admin/logout">Logout</Link>
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
        <form action={adminStage1Action} className="mt-4 flex flex-wrap gap-2">
          <input type="hidden" name="applicationDbId" value={application.id} />
          <input className="input max-w-xs" name="notes" placeholder="Optional notes" />
          <button className="btn btn-secondary" name="action" value="approve">Approve Stage 1</button>
          <button className="btn btn-secondary" name="action" value="correction">Request correction</button>
          <button className="btn btn-secondary" name="action" value="reject">Reject</button>
        </form>
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
