import { notFound } from 'next/navigation';
import type { Prisma } from '@prisma/client';

import { StatusBadge } from '@/components/StatusBadge';
import { prisma } from '@/lib/prisma';
import { isAdminSecretValid } from '@/lib/security';

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
  searchParams: Promise<{ adminSecret?: string }>;
};

function formatDateTime(value?: Date | null) {
  return value ? value.toISOString() : 'Missing';
}

export default async function AdminApplicationDetail({
  params,
  searchParams,
}: PageProps) {
  const [resolvedParams, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);

  if (!isAdminSecretValid(resolvedSearchParams.adminSecret)) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <h1 className="text-3xl font-bold">Unauthorized</h1>
      </main>
    );
  }

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
      <h1 className="text-3xl font-bold">{application.applicationId}</h1>
      <StatusBadge status={stageOneStatus} />

      <section className="card mt-6 p-5">
        <h2 className="font-bold">Applicant</h2>
        <p>
          {application.applicant.fullName} · {application.applicant.email} ·{' '}
          {application.applicant.phone ?? 'No phone provided'}
        </p>
        <p>{application.applicant.location ?? 'No location provided'}</p>
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
        <h2 className="font-bold">Uploaded CV metadata</h2>
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
